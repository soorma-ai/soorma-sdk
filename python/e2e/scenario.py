# SPDX-License-Identifier: Apache-2.0
#
# The Python end-to-end scenario (business-logic-model §10; PH-E2E; FR-19;
# TC-PH-061 to 063), against soorma-core's real stack after U2's core-up, setup
# and prove-stack. Both agents run in this one process, each with its own
# instance identifier and its own secret file (file_secret, on the files setup
# wrote). The installed package, never the source tree or the values hook; the
# OpenTelemetry SDK and exporter are this scenario's, never the package's.
#
# Run from the repository root, with Python 3.11 or 3.12 (soorma-ai/soorma-core#36):
#   python python/e2e/scenario.py
# It exits 0 when every step holds, and with an AssertionError naming the step
# when one does not.
from __future__ import annotations

import asyncio
import gc
import json
import time
import warnings
from collections.abc import Callable
from pathlib import Path
from typing import Any

from opentelemetry import context, trace
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from soorma import (
    AgentClient,
    AgentClientOptions,
    Delivery,
    JsonValue,
    SoormaWarning,
    StreamStarted,
    file_secret,
    new_instance_id,
)

ROOT = Path(__file__).resolve().parents[2]
STACK = ROOT / ".e2e" / "stack.json"
SKEW_S = 14 * 60
PAYLOAD: JsonValue = {"hello": "B"}
R_MIN_S = 30.0  # spec §0's R_min for Python (NFR Requirements); never set by a hook here


async def until(ok: Callable[[], bool], seconds: float) -> bool:
    """Polls `ok` every 100 ms until it holds or `seconds` pass; returns whether it held."""
    end = time.monotonic() + seconds
    while not ok():
        if time.monotonic() >= end:
            return False
        await asyncio.sleep(0.1)
    return True


def open_sockets() -> int:
    sockets: set[int] = set()
    for o in gc.get_objects():
        if isinstance(o, asyncio.BaseTransport) and not o.is_closing():
            sock = o.get_extra_info("socket")
            if sock is not None and sock.fileno() != -1:
                sockets.add(sock.fileno())
    return len(sockets)


def skew_warnings(caught: list[warnings.WarningMessage]) -> list[str]:
    return [w.message.code for w in caught if isinstance(w.message, SoormaWarning)]


class SkewedClock:
    """Only time.time and time.time_ns, 14 minutes ahead and advancing (PH-E2E)."""

    def __init__(self) -> None:
        self._time = time.time
        self._time_ns = time.time_ns

    def __enter__(self) -> None:
        real, real_ns = self._time, self._time_ns
        time.time = lambda: real() + SKEW_S
        time.time_ns = lambda: real_ns() + SKEW_S * 1_000_000_000

    def __exit__(self, *_: object) -> None:
        time.time = self._time
        time.time_ns = self._time_ns


async def main() -> None:
    # Step 1: the stack description, and the scenario's own tracer provider.
    stack: dict[str, Any] = json.loads(STACK.read_text(encoding="utf-8"))
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    secret_files = {a["agent"]: a["secretFile"] for a in stack["agents"]}

    def client(agent: str) -> AgentClient:
        assert agent in secret_files, f"{STACK} has no {agent}: run setup --agents agent-a,agent-b"
        return AgentClient(
            AgentClientOptions(
                data_gateway_url=stack["s3"],
                event_ingest_url=stack["s4"],
                ca_file=stack["ca"],
                agent=agent,
                instance=new_instance_id(),
                secret=file_secret(secret_files[agent]),
            )
        )

    sockets_before = open_sockets()
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("default")
        a, b = client("agent-a"), client("agent-b")
        async with a, b:
            # Step 2: the clock 14 minutes ahead; each start warns once, for its lineage.
            with SkewedClock():
                await b.start()
                assert skew_warnings(caught) == ["SOORMA_CLOCK_SKEW"], "step 2: B warns once"
                await a.start()
                assert skew_warnings(caught) == ["SOORMA_CLOCK_SKEW"] * 2, "step 2: A once"
                assert b.credential.agent == "agent-b"
                assert a.credential.agent == "agent-a"
                for c in (a, b):
                    env = c.credential.environment
                    got = {k: env[k] for k in ("organization", "project", "environment")}
                    assert got == stack["environment"], "step 2: the environment"

                # Step 3: B renews once, from the real S3, held until R_min after bootstrap.
                bootstrapped = b.credential.expires_at
                started = time.monotonic()
                renewed_in_time = await until(
                    lambda: b.credential.expires_at != bootstrapped, R_MIN_S + 30
                )
                assert renewed_in_time, "step 3: B renewed"
                assert time.monotonic() - started >= R_MIN_S - 1, "step 3: not before R_min"
                renewed = b.credential.expires_at
                assert renewed > bootstrapped, "step 3: a later expiry"
                again = await until(lambda: b.credential.expires_at != renewed, R_MIN_S - 1)
                assert not again, "step 3: no second renewal within R_min"
                assert skew_warnings(caught) == ["SOORMA_CLOCK_SKEW"] * 2, "step 3: no warning"
            # Step 4: the real clock again (SkewedClock's exit).

            # Step 5: a decoy span, current while B subscribes and runs its loop.
            tracer = trace.get_tracer("scenario")
            decoy = tracer.start_span("decoy")
            items: list[object] = []
            received: list[Delivery] = []

            async def consume() -> None:
                async with b.subscribe() as subscription:
                    async for item in subscription:
                        items.append(item)
                        if isinstance(item, Delivery):
                            received.append(item)

            token = context.attach(trace.set_span_in_context(decoy))
            try:
                loop = asyncio.create_task(consume())
            finally:
                context.detach(token)
            assert await until(lambda: any(isinstance(i, StreamStarted) for i in items), 15), (
                "step 5: B's stream started"
            )

            # Step 6: A publishes outside the decoy.
            assert not trace.get_current_span().get_span_context().is_valid
            accepted = await a.publish(PAYLOAD)
            sent = accepted.trace_context.traceparent
            parts = sent.split("-")
            assert len(parts) == 4 and len(parts[1]) == 32 and len(parts[2]) == 16, "step 6"

            # Step 7: B receives it; the envelope carries A's draft's traceparent.
            def mine(d: Delivery) -> bool:
                tc: Any = d.envelope.get("traceContext") or {}
                return bool(tc.get("traceparent") == sent)

            assert await until(lambda: any(mine(d) for d in received), 15), "step 7: received"
            delivery = next(d for d in received if mine(d))
            assert isinstance(delivery.seal, str) and delivery.seal, "step 7: a seal"
            assert delivery.payload_parsed, "step 7: parsed"
            assert delivery.payload == PAYLOAD, "step 7: A's payload"

            # Step 8: one trace across the hop; the decoy neither parent nor linked.
            decoy.end()
            trace_id = int(parts[1], 16)

            def spans(name: str) -> list[ReadableSpan]:
                return [
                    s
                    for s in exporter.get_finished_spans()
                    if s.name == name and s.context is not None and s.context.trace_id == trace_id
                ]

            assert await until(lambda: bool(spans("receive")), 5), "step 8: a receive span"
            (send,) = spans("send")
            assert send.context is not None
            assert send.context.span_id == int(parts[2], 16), "step 8: A's send span"
            decoy_sc = decoy.get_span_context()
            for r in spans("receive"):
                assert r.parent is not None, "step 8: the receive span has a parent"
                assert r.parent.span_id == send.context.span_id, "step 8: parent is A's send"
                assert r.parent.trace_id == trace_id
                assert r.parent.span_id != decoy_sc.span_id, "step 8: the decoy is not parent"
                assert not any(
                    link.context.span_id == decoy_sc.span_id
                    or link.context.trace_id == decoy_sc.trace_id
                    for link in r.links
                ), "step 8: the decoy is not linked"

            # Step 9: close both (leaving `async with` closes B's subscription too).
            await b.close()
            await loop
        assert await until(lambda: open_sockets() <= sockets_before, 5), "step 9: sockets"
        gc.collect()
        unclosed = [w for w in caught if issubclass(w.category, ResourceWarning)]
        assert unclosed == [], "step 9: no ResourceWarning"
    provider.shutdown()
    print("e2e-python: every step held")


if __name__ == "__main__":
    asyncio.run(main())
