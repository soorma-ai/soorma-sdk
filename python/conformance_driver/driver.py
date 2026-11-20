# SPDX-License-Identifier: Apache-2.0
#
# The Python conformance driver (PH-DRV; conformance/README.md). It speaks the
# driver protocol (JSON lines: commands on stdin, one reply per line on stdout,
# diagnostics on stderr) and calls only soorma's public interface, except where
# the protocol allows otherwise: `describe`'s values (soorma._limits), the
# timing hook (soorma._internal.test_values), `inspect` (U1's sys.getrefcount
# check and the loop's own list of transports, timers and tasks), `spans`,
# `env`, `docs` and `warnings`. Commands run concurrently, each as a task, as
# the TypeScript driver's do. Test only; part of no distribution.
from __future__ import annotations

import asyncio
import base64
import dataclasses
import gc
import json
import math
import os
import platform
import sys
import threading
import warnings
from collections.abc import Awaitable, Callable, Mapping
from importlib.metadata import version
from pathlib import Path
from typing import Any

import soorma
from names import exported_names, settable_members
from soorma import (
    AgentClient,
    AgentClientOptions,
    ClientStateError,
    CredentialInfo,
    Delivery,
    DeliveryError,
    ProblemError,
    PublishAccepted,
    SecretSourceError,
    SoormaWarning,
    StreamEnded,
    StreamStarted,
    Subscription,
    TransportError,
)
from soorma._internal.test_values import set_test_values
from soorma._limits import D_LANG, LIMITS
from spans import enable_test_sdk, finished_spans, in_tenant_span

PACKAGE = Path(__file__).resolve().parents[1]
OPTION_NAMES = {
    "dataGatewayUrl": "data_gateway_url",
    "eventIngestUrl": "event_ingest_url",
    "caFile": "ca_file",
}
DRIVER_ARGS = {"values", "secret", "otel", "logLevel", "render"}

# Every warning the process emits is recorded, never printed: `warnings` reports
# the SDK's, in order, since `create`.
_recorder = warnings.catch_warnings(record=True)
_recorded = _recorder.__enter__()


class DriverError(Exception):
    def __init__(self, data: dict[str, Any]) -> None:
        super().__init__(str(data.get("type")))
        self.data = data


class State:
    client: AgentClient | None = None
    subscription: Subscription | None = None
    pull: asyncio.Task[Any] | None = None
    render = False
    secret: str | None = None  # the test provider's string (U1's check holds it)
    baseline: int | None = None
    provider_calls = 0
    refs = 0
    deliveries: dict[str, Delivery] = {}  # noqa: RUF012 - one driver, one state
    tasks: set[asyncio.Task[Any]] = set()  # noqa: RUF012 - the driver's own tasks
    main: asyncio.Task[Any] | None = None


S = State()


def need() -> AgentClient:
    if S.client is None:
        raise DriverError({"type": "ClientStateError", "state": "none"})
    return S.client


def as_error(e: BaseException) -> dict[str, Any]:
    if S.render:
        sys.stderr.write(f"{e}\n{e!r}\n")
    if isinstance(e, DriverError):
        return e.data
    if isinstance(e, ProblemError):
        out: dict[str, Any] = {
            "type": "ProblemError",
            "status": e.status,
            "code": e.code,
            "title": e.title,
            "detail": e.detail,
        }
        if e.retry_after is not None:
            out["retryAfter"] = e.retry_after
        if e.problem is not None:
            out["problem"] = e.problem
        return out
    if isinstance(e, TransportError):
        return {"type": "TransportError", "reason": e.reason}
    if isinstance(e, SecretSourceError):
        out = {"type": "SecretSourceError", "reason": e.reason}
        if e.path is not None:
            out["path"] = e.path
        return out
    if isinstance(e, ClientStateError):
        return {"type": "ClientStateError", "state": e.state}
    return {"type": type(e).__name__, "message": str(e)}


def provider(spec: Mapping[str, Any]) -> Callable[[], Any]:
    def counted(p: Callable[[], Any]) -> Callable[[], Any]:
        def call() -> Any:
            S.provider_calls += 1
            return p()

        return call

    kind = spec.get("kind")
    if kind == "test":
        # U1's Python check: the provider returns this one string, and the check counts
        # references to it (conformance/README.md, CDI-02).
        S.secret = base64.b64decode(str(spec.get("bytes", ""))).decode("utf-8")
        return counted(lambda: S.secret)
    if kind == "file":
        return counted(soorma.file_secret(str(spec.get("path"))))
    if kind == "literal":
        value = str(spec.get("value"))
        return counted(lambda: value)

    def failing() -> str:
        raise RuntimeError("the provider failed")

    return counted(failing)


def details(c: CredentialInfo) -> dict[str, Any]:
    env = c.environment
    return {
        "agent": c.agent,
        "instance": c.instance,
        "environment": {k: env[k] for k in env},
        "expiresAt": c.expires_at,
    }


def item(i: object) -> dict[str, Any]:
    if isinstance(i, StreamStarted):
        return {"kind": "streamStarted"}
    if isinstance(i, StreamEnded):
        return {"kind": "streamEnded", "code": i.code, "terminal": i.terminal}
    if isinstance(i, DeliveryError):
        return {"kind": "deliveryError", "reason": i.reason, "text": i.text}
    assert isinstance(i, Delivery)
    S.refs += 1
    ref = str(S.refs)
    S.deliveries[ref] = i
    out: dict[str, Any] = {
        "kind": "delivery",
        "ref": ref,
        "envelope": i.envelope,
        "envelopeText": i.envelope_text,
        "seal": i.seal,
        "payloadText": i.payload_text,
        "payloadParsed": i.payload_parsed,
    }
    if i.payload_parsed:
        out["payload"] = i.payload
    return out


async def next_item(ms: float) -> dict[str, Any]:
    """Waits up to `ms`; a pull still pending stays pending for the next `next`."""
    if S.subscription is None:
        raise DriverError({"type": "ClientStateError", "state": "not subscribed"})
    if S.pull is None:
        sub = S.subscription
        S.pull = asyncio.ensure_future(anext(sub))
        S.tasks.add(S.pull)
    done, _ = await asyncio.wait({S.pull}, timeout=ms / 1000)
    if not done:
        return {"timeout": True}
    pull, S.pull = S.pull, None
    S.tasks.discard(pull)
    try:
        value = pull.result()
    except StopAsyncIteration:
        return {"kind": "done"}
    return item(value)


def open_resources() -> dict[str, int]:
    """The loop's own view of what is still open (CC-PRB-07): socket transports not
    closing, timers not cancelled, and tasks that are not the driver's."""
    loop = asyncio.get_running_loop()
    sockets: set[int] = set()
    for o in gc.get_objects():
        if isinstance(o, asyncio.BaseTransport) and not o.is_closing():
            sock = o.get_extra_info("socket")
            if sock is not None and sock.fileno() != -1:
                sockets.add(sock.fileno())
    scheduled = getattr(loop, "_scheduled", [])
    timers = sum(1 for h in scheduled if not h.cancelled())
    mine = {asyncio.current_task(), S.main, *S.tasks}
    streams = sum(1 for t in asyncio.all_tasks() if t not in mine and not t.done())
    return {"sockets": len(sockets), "streams": streams, "timers": timers}


def docs(topic: str) -> str:
    heading = "## Spans" if topic == "spans" else "## Delivery"
    text = (PACKAGE / "README.md").read_text(encoding="utf-8")
    start = text.find(f"\n{heading}\n")
    if start < 0:
        return ""
    end = text.find("\n## ", start + len(heading) + 2)
    return " ".join(text[start + 1 : end if end >= 0 else None].split())


async def close_client() -> None:
    c = S.client
    S.client = None
    S.subscription = None
    if S.pull is not None:
        S.pull.cancel()
        S.pull = None
    if c is not None:
        await c.close()


async def handle(op: str, args: dict[str, Any]) -> dict[str, Any]:
    if op == "describe":
        return {
            "language": "python",
            "runtime": f"python {platform.python_version()}",
            "sdkVersion": version("soorma"),
            "values": dataclasses.asdict(LIMITS),
            "depthBound": D_LANG,
            "faults": [],
        }
    if op == "create":
        await close_client()
        if args.get("otel") is True:
            enable_test_sdk()
        S.render = args.get("render") is True
        S.provider_calls = 0
        S.secret = None
        S.baseline = None
        _recorded.clear()
        options = {OPTION_NAMES.get(k, k): v for k, v in args.items() if k not in DRIVER_ARGS}
        options["secret"] = provider(args.get("secret") or {})
        set_test_values(args.get("values"))
        try:
            S.client = AgentClient(AgentClientOptions(**options))
        finally:
            set_test_values(None)  # captured when the client is constructed
        if S.render:
            sys.stderr.write(f"{S.client}\n{S.client!r}\n")
        return {}
    if op == "start":
        client = need()
        if S.secret is not None:
            S.baseline = sys.getrefcount(S.secret)
        await client.start()
        return {"credential": details(client.credential)}
    if op == "credential":
        try:
            return {"credential": details(need().credential)}
        except (ClientStateError, DriverError):
            return {"credential": None}
    if op in ("publish", "forward"):
        in_span = (args.get("inSpan") or {}).get("name")
        payload = args.get("payload")
        send: Callable[[], Awaitable[PublishAccepted]]
        if op == "forward":
            d = S.deliveries.get(str(args.get("ref")))
            if d is None:
                raise DriverError({"type": "ClientStateError", "state": "no such delivery"})
            send = lambda: d.publish(payload)  # noqa: E731
        else:
            c = need()
            send = lambda: c.publish(payload)  # noqa: E731
        value, tenant = await in_tenant_span(None if in_span is None else str(in_span), send)
        tc: dict[str, Any] = {"traceparent": value.trace_context.traceparent}
        if value.trace_context.tracestate is not None:
            tc["tracestate"] = value.trace_context.tracestate
        return {"traceContext": tc, **({"tenantSpan": tenant} if tenant else {})}
    if op == "subscribe":
        S.subscription = need().subscribe()
        S.pull = None
        return {}
    if op == "next":
        return await next_item(float(args.get("timeoutMs", 3000)))
    if op == "closeSubscription":
        if S.subscription is not None:
            await S.subscription.close()
        return {}
    if op == "close":
        if S.client is not None:
            await S.client.close()
        return {}
    if op == "fileSecret":
        pending = soorma.file_secret(str(args.get("path")))()
        assert not isinstance(pending, str)
        read = await asyncio.wait_for(pending, float(args.get("timeoutMs", 3000)) / 1000)
        return {"length": len(read)}
    if op == "newInstanceId":
        return {"value": soorma.new_instance_id()}
    if op == "warnings":
        found = [w.message for w in _recorded if isinstance(w.message, SoormaWarning)]
        return {
            "warnings": [
                {"code": "clock-skew" if w.code == "SOORMA_CLOCK_SKEW" else w.code} for w in found
            ]
        }
    if op == "inspect":
        checks = args.get("checks") or []
        out: dict[str, Any] = {}
        if "providerCalls" in checks:
            out["providerCalls"] = S.provider_calls
        if "secretRetained" in checks:
            gc.collect()
            if S.secret is None or S.baseline is None:
                out["secretRetained"] = {"found": False, "count": 0}
            else:
                extra = sys.getrefcount(S.secret) - S.baseline
                out["secretRetained"] = {"found": extra > 0, "count": max(0, extra)}
        if "openResources" in checks:
            out["openResources"] = open_resources()
        return out
    if op == "spans":
        return finished_spans()
    if op == "names":
        return {"names": exported_names()}
    if op == "surface":
        return {"members": settable_members()}
    if op == "env":
        for k, v in (args.get("set") or {}).items():
            os.environ[str(k)] = str(v)
        return {}
    if op == "docs":
        return {"text": docs(str(args.get("topic")))}
    raise DriverError({"type": "UnsupportedOperation", "op": op})


def _plain(o: object) -> object:
    """JSON the runner can read: mappings as objects, tuples as arrays, and a
    non-finite float (Python parses 1e400 as inf, natively, as JavaScript gives
    Infinity) as null, which is what JSON.stringify writes for it."""
    if isinstance(o, float) and not math.isfinite(o):
        return None
    if isinstance(o, Mapping):
        return {str(k): _plain(v) for k, v in o.items()}
    if isinstance(o, list | tuple):
        return [_plain(v) for v in o]
    return o


def send(o: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(_plain(o), ensure_ascii=False, allow_nan=False) + "\n")
    sys.stdout.flush()


async def run(id_: object, op: str, args: dict[str, Any]) -> None:
    try:
        result = await handle(op, args)
    except Exception as e:
        send({"id": id_, "ok": False, "error": as_error(e)})
    else:
        send({"id": id_, "ok": True, "result": result})


async def main() -> None:
    loop = asyncio.get_running_loop()
    S.main = asyncio.current_task()
    lines: asyncio.Queue[str | None] = asyncio.Queue()

    def read() -> None:
        for line in sys.stdin:
            loop.call_soon_threadsafe(lines.put_nowait, line)
        loop.call_soon_threadsafe(lines.put_nowait, None)

    threading.Thread(target=read, daemon=True).start()
    while (line := await lines.get()) is not None:
        if not line.strip():
            continue
        command = json.loads(line)
        task = loop.create_task(run(command.get("id"), command["op"], command.get("args") or {}))
        S.tasks.add(task)
        task.add_done_callback(S.tasks.discard)
    await close_client()


if __name__ == "__main__":
    asyncio.run(main())
