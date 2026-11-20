# SPDX-License-Identifier: Apache-2.0
#
# The subscription (C-17; SUB, STR; P-04, P-10), against a local TLS server as
# S4 with S3 scripted: items in order, heartbeats consumed, an end resubscribed
# (STR-03); a subscribe Problem raised with no terminal end (SUB-05); one active
# subscription (SUB-04); close and leaving `async with` (SUB-07; PH-LIFE-02);
# backpressure that never times out a paused stream (TC-PH-081); a replacement
# behind a full queue (TC-PH-082); an event over L_event (RCV-09); L_ends;
# credential_refused revoking; forwarding a Delivery; the collection test
# (TC-PH-076's subscription half); and a process leaving `async with` exits
# (TC-PH-071; PH-LIFE-04).
from __future__ import annotations

import asyncio
import gc
import json
import os
import subprocess
import sys
import textwrap
import time
import warnings
import weakref
from collections.abc import Awaitable, Callable, Iterator
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from soorma import (
    AgentClient,
    ClientStateError,
    Delivery,
    DeliveryError,
    ProblemError,
    StreamEnded,
    StreamStarted,
    SubscriptionItem,
    _client,
    _keeper,
    _limits,
)
from soorma._limits import LIMITS

from .conftest import Certs, Server
from .test_client import EVENTS, Platform, accepted, options
from .test_keeper import BOOT, RENEW, cred

SSE_HEAD = (
    b"HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\ntransfer-encoding: chunked\r\n\r\n"
)
TP = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"


def chunk(data: bytes) -> bytes:
    return f"{len(data):x}\r\n".encode() + data + b"\r\n"


def delivery(label: str, payload: object = None) -> bytes:
    env = json.dumps({"traceContext": {"traceparent": TP}, "label": label})
    body = {"envelope": "ENV", "seal": f"seal-{label}", "payload": payload or {"l": label}}
    data = json.dumps(body).replace('"ENV"', env)
    return chunk(f"event: delivery\ndata: {data}\n\n".encode())


def end(code: str) -> bytes:
    return chunk(f'event: end\ndata: {{"code":"{code}"}}\n\n'.encode())


HEARTBEAT = chunk(b": heartbeat\n\n")
LAST = b"0\r\n\r\n"

Handler = Callable[[int, asyncio.StreamWriter], Awaitable[None]]


def serve(server: Server, handler: Handler) -> None:
    """Each connection gets its index (0, 1, ...) and the writer."""

    async def on(_req: bytes, w: asyncio.StreamWriter) -> None:
        await handler(len(server.requests) - 1, w)

    server.handler = on


def write(*parts: bytes) -> Handler:
    async def h(_i: int, w: asyncio.StreamWriter) -> None:
        w.write(b"".join(parts))
        await w.drain()

    return h


@pytest.fixture
def platform(monkeypatch: pytest.MonkeyPatch) -> Iterator[Platform]:
    p = Platform({BOOT: [cred("A", 3600) for _ in range(4)], RENEW: [], EVENTS: []})
    monkeypatch.setattr(_keeper, "post", p.post)
    monkeypatch.setattr(_client, "post", p.post)
    yield p


def fast(monkeypatch: pytest.MonkeyPatch, **values: int) -> None:
    limits = replace(LIMITS, B_init=20, B_cap=50, **values)
    monkeypatch.setattr(_limits, "capture", lambda: limits)


async def started(certs: Certs, server: Server) -> AgentClient:
    client = AgentClient(options(event_ingest_url=server.url, ca_file=str(certs.ca)))
    await client.start()
    return client


async def take(it: Any, n: int, within: float = 5) -> list[SubscriptionItem]:
    out: list[SubscriptionItem] = []
    async with asyncio.timeout(within):
        for _ in range(n):
            out.append(await anext(it))
    return out


def kinds(items: list[SubscriptionItem]) -> list[str]:
    out: list[str] = []
    for i in items:
        if isinstance(i, StreamStarted):
            out.append("started")
        elif isinstance(i, StreamEnded):
            out.append(f"ended:{i.code}:{'T' if i.terminal else 'F'}")
        elif isinstance(i, Delivery):
            out.append(i.envelope["label"])  # type: ignore[typeddict-item]
        else:
            assert isinstance(i, DeliveryError)
            out.append(f"error:{i.reason}")
    return out


@pytest.mark.asyncio
async def test_items_in_order_an_end_resubscribes_and_close_ends_it(
    certs: Certs, server: Server, platform: Platform, monkeypatch: pytest.MonkeyPatch
) -> None:
    fast(monkeypatch)
    streams = [
        write(SSE_HEAD, delivery("d1"), HEARTBEAT, delivery("d2"), end("overflow")),
        write(SSE_HEAD, delivery("d3")),
    ]
    serve(server, lambda i, w: streams[i](i, w))
    client = await started(certs, server)
    async with client, client.subscribe() as sub:
        items = await take(sub, 6)
        assert kinds(items) == ["started", "d1", "d2", "ended:overflow:F", "started", "d3"]
        pending = asyncio.ensure_future(anext(sub))
        await asyncio.sleep(0.05)
        await sub.close()
        last = await pending
        assert kinds([last]) == ["ended:None:T"]
        with pytest.raises(StopAsyncIteration):
            await anext(sub)
    first = server.requests[0].decode()
    assert first.startswith("POST /subscriptions HTTP/1.1\r\n")
    assert "\r\nAuthorization: Bearer A\r\n" in first
    assert "\r\nSoorma-Contract-Version: 0.1.0\r\n" in first
    assert "\r\nAccept: text/event-stream\r\n" in first
    draft = json.loads(first.split("\r\n\r\n", 1)[1])
    assert list(draft) == ["draft"]
    assert list(draft["draft"]) == ["clientContractVersion", "traceContext"]


@pytest.mark.asyncio
async def test_a_subscribe_problem_is_raised_with_no_terminal_end(
    certs: Certs, server: Server, platform: Platform
) -> None:
    problem = b'{"status":403,"code":"forbidden"}'
    serve(
        server,
        write(
            b"HTTP/1.1 403 Forbidden\r\ncontent-type: application/problem+json\r\n"
            + f"content-length: {len(problem)}\r\n\r\n".encode()
            + problem
        ),
    )
    client = await started(certs, server)
    async with client:
        sub = client.subscribe()
        with pytest.raises(ProblemError) as e:
            await anext(sub)
        assert (e.value.status, e.value.code) == (403, "forbidden")
        with pytest.raises(StopAsyncIteration):
            await anext(sub)
        await sub.close()


@pytest.mark.asyncio
async def test_a_503_subscribe_is_retried(
    certs: Certs, server: Server, platform: Platform, monkeypatch: pytest.MonkeyPatch
) -> None:
    fast(monkeypatch)
    busy = b"HTTP/1.1 503 Busy\r\nretry-after: 0\r\ncontent-length: 2\r\n\r\n{}"
    streams = [write(busy), write(SSE_HEAD, delivery("d1"))]
    serve(server, lambda i, w: streams[i](i, w))
    client = await started(certs, server)
    async with client, client.subscribe() as sub:
        assert kinds(await take(sub, 2)) == ["started", "d1"]
    assert len(server.requests) == 2


@pytest.mark.asyncio
async def test_one_active_subscription_per_client(
    certs: Certs, server: Server, platform: Platform
) -> None:
    serve(server, write(SSE_HEAD))
    client = await started(certs, server)
    async with client:
        first = client.subscribe()
        with pytest.raises(ClientStateError) as e:
            client.subscribe()
        assert e.value.state == "subscribed"
        await first.close()
        second = client.subscribe()
        assert kinds(await take(second, 1)) == ["started"]
        await second.close()


@pytest.mark.asyncio
async def test_leaving_async_with_closes_the_stream(
    certs: Certs, server: Server, platform: Platform
) -> None:
    serve(server, write(SSE_HEAD, delivery("d1")))
    client = await started(certs, server)
    async with client:
        async with client.subscribe() as sub:
            async for item in sub:
                if isinstance(item, Delivery):
                    break
        await asyncio.wait_for(server.closed.wait(), 5)
        assert "finished=True" in repr(sub)


@pytest.mark.asyncio
async def test_a_paused_stream_never_times_out_and_a_resume_restarts_t_idle(
    certs: Certs, server: Server, platform: Platform, monkeypatch: pytest.MonkeyPatch
) -> None:
    # TC-PH-081: N_buf 2, T_idle 300 ms; ten Deliveries arrive at once, then silence.
    fast(monkeypatch, N_buf=2, T_idle=300)
    serve(server, write(SSE_HEAD, *(delivery(f"d{n}") for n in range(10))))
    client = await started(certs, server)
    async with client, client.subscribe() as sub:
        assert kinds(await take(sub, 1)) == ["started"]
        await asyncio.sleep(0.9)  # three times T_idle, paused with a full queue
        items = await take(sub, 10)
        assert kinds(items) == [f"d{n}" for n in range(10)]
        # Drained and silent: T_idle runs from the resume and ends the stream.
        t0 = time.monotonic()
        assert kinds(await take(sub, 1)) == ["ended:None:F"]
        assert time.monotonic() - t0 >= 0.25


@pytest.mark.asyncio
async def test_a_replacement_behind_a_full_queue_follows_the_old_stream(
    certs: Certs, server: Server, platform: Platform, monkeypatch: pytest.MonkeyPatch
) -> None:
    # TC-PH-082: the old stream's Deliveries, its superseded end, then the new stream's.
    fast(monkeypatch, N_buf=2)
    second_opened = asyncio.Event()

    async def old(_i: int, w: asyncio.StreamWriter) -> None:
        w.write(SSE_HEAD + b"".join(delivery(f"d{n}") for n in range(5)))
        await w.drain()
        await second_opened.wait()
        w.write(end("superseded") + LAST)
        await w.drain()

    async def new(_i: int, w: asyncio.StreamWriter) -> None:
        second_opened.set()
        w.write(SSE_HEAD + delivery("n1") + delivery("n2"))
        await w.drain()

    streams = [old, new]
    serve(server, lambda i, w: streams[i](i, w))
    client = await started(certs, server)
    async with client, client.subscribe() as sub:
        assert kinds(await take(sub, 1)) == ["started"]
        sub._core.credential(False)  # a renewal: the same lineage, a new credential
        await asyncio.wait_for(second_opened.wait(), 5)
        await asyncio.sleep(0.1)
        items = await take(sub, 9)
    assert kinds(items) == [
        "d0",
        "d1",
        "d2",
        "d3",
        "d4",
        "ended:superseded:F",
        "started",
        "n1",
        "n2",
    ]


@pytest.mark.asyncio
async def test_an_event_over_l_event_is_a_delivery_error_and_the_stream_continues(
    certs: Certs, server: Server, platform: Platform, monkeypatch: pytest.MonkeyPatch
) -> None:
    fast(monkeypatch, L_event=4096)
    big = delivery("big", payload={"x": "y" * 8000})
    serve(server, write(SSE_HEAD, delivery("d1"), big, delivery("d2")))
    client = await started(certs, server)
    async with client, client.subscribe() as sub:
        items = await take(sub, 4)
    assert kinds(items) == ["started", "d1", "error:event-too-large", "d2"]
    assert items[2] == DeliveryError("event-too-large", "")


@pytest.mark.asyncio
async def test_l_ends_consecutive_ends_without_a_delivery_are_terminal(
    certs: Certs, server: Server, platform: Platform, monkeypatch: pytest.MonkeyPatch
) -> None:
    fast(monkeypatch, L_ends=3)
    serve(server, write(SSE_HEAD, end("overflow")))
    client = await started(certs, server)
    async with client, client.subscribe() as sub:
        items = await take(sub, 6)
        assert kinds(items) == [
            "started",
            "ended:overflow:F",
            "started",
            "ended:overflow:F",
            "started",
            "ended:overflow:T",
        ]
        with pytest.raises(StopAsyncIteration):
            await anext(sub)


@pytest.mark.asyncio
async def test_a_credential_refused_end_is_terminal_and_revokes_the_client(
    certs: Certs, server: Server, platform: Platform
) -> None:
    serve(server, write(SSE_HEAD, end("credential_refused")))
    client = await started(certs, server)
    async with client, client.subscribe() as sub:
        assert kinds(await take(sub, 2)) == ["started", "ended:credential_refused:T"]
        with pytest.raises(ClientStateError) as e:
            await client.publish(1)
        assert e.value.state == "revoked"


@pytest.mark.asyncio
async def test_a_delivery_publish_forwards_its_envelope_byte_for_byte(
    certs: Certs, server: Server, platform: Platform
) -> None:
    serve(server, write(SSE_HEAD, delivery("d1")))
    platform.replies[EVENTS] = [accepted()]
    client = await started(certs, server)
    async with client, client.subscribe() as sub:
        items = await take(sub, 2)
        d = items[1]
        assert isinstance(d, Delivery)
        result = await d.publish({"seen": True})
    _, _, body = platform.calls[-1]
    assert body is not None
    text = body.decode()
    assert f'"inbound":{{"envelope":{d.envelope_text},"seal":"seal-d1"}}' in text
    _, trace_id, span_id, _ = result.trace_context.traceparent.split("-")
    assert trace_id == TP.split("-")[1]
    assert span_id != TP.split("-")[2]


@pytest.mark.asyncio
async def test_a_forgotten_open_subscription_is_collected_and_warns_once(
    certs: Certs, server: Server, platform: Platform
) -> None:
    serve(server, write(SSE_HEAD, HEARTBEAT))
    client = await started(certs, server)
    sub = client.subscribe()
    assert kinds(await take(sub, 1)) == ["started"]
    core = sub._core
    conn = core._current.conn if core._current is not None else None
    assert conn is not None and conn.open
    tasks_before = asyncio.all_tasks()
    ref = weakref.ref(sub)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        del sub
        gc.collect()
    assert ref() is None
    unclosed = [w for w in caught if issubclass(w.category, ResourceWarning)]
    assert [str(w.message) for w in unclosed] == ["unclosed Subscription"]
    assert not conn.open
    assert core.finished
    assert asyncio.all_tasks() == tasks_before  # nothing scheduled
    await asyncio.wait_for(server.closed.wait(), 5)  # the server saw the socket close
    assert not core._work
    await client.close()


@pytest.mark.asyncio
async def test_a_closed_subscription_collected_emits_nothing(
    certs: Certs, server: Server, platform: Platform
) -> None:
    serve(server, write(SSE_HEAD))
    client = await started(certs, server)
    async with client:
        sub = client.subscribe()
        await sub.close()
        ref = weakref.ref(sub)
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            del sub
            gc.collect()
        assert ref() is None
        assert [w for w in caught if issubclass(w.category, ResourceWarning)] == []


CHILD = textwrap.dedent(
    """
    import asyncio, json, ssl, sys, time
    from soorma import AgentClient, AgentClientOptions, Delivery, _keeper
    from soorma._transport import Reply

    CA, CERT, KEY, MODE = sys.argv[1:5]
    CRED = json.dumps({"credential": "A", "agent": "a", "instance": "i",
        "environment": {"organization": "o", "project": "p", "environment": "e"},
        "expiresAt": "2099-01-01T00:00:00Z"}).encode()

    async def boot(*_a, **_k):
        return Reply(200, {}, CRED)

    _keeper.post = boot

    async def handle(reader, writer):
        await reader.readuntil(b"\\r\\n\\r\\n")
        writer.write(b"HTTP/1.1 200 OK\\r\\ncontent-type: text/event-stream\\r\\n"
                     b"transfer-encoding: chunked\\r\\n\\r\\n")
        await writer.drain()
        await reader.read()

    async def main():
        ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ctx.load_cert_chain(CERT, KEY)
        srv = await asyncio.start_server(handle, "127.0.0.1", 0, ssl=ctx)
        port = srv.sockets[0].getsockname()[1]
        client = AgentClient(AgentClientOptions(
            data_gateway_url="https://localhost:1", event_ingest_url=f"https://localhost:{port}",
            agent="a", instance="i", secret=lambda: "s", ca_file=CA))
        await client.start()
        if MODE == "with":
            async with client.subscribe() as sub:
                async for _item in sub:
                    break
        else:
            async for _item in client.subscribe():
                break  # left open: asyncio.run() must still end the process
        print("returned", flush=True)

    asyncio.run(main())
    """
)


@pytest.mark.parametrize("mode", ["with", "bare"])
def test_a_process_whose_main_coroutine_returns_exits(certs: Certs, mode: str) -> None:
    src = Path(__file__).resolve().parents[1] / "src"
    env = {"PATH": os.environ.get("PATH", ""), "PYTHONPATH": str(src)}
    args = [
        sys.executable,
        "-W",
        "ignore::ResourceWarning",
        "-c",
        CHILD,
        str(certs.ca),
        str(certs.cert),
        str(certs.key),
        mode,
    ]
    with subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env) as proc:
        try:
            assert proc.stdout is not None
            assert proc.stderr is not None
            line = proc.stdout.readline()
            assert line == b"returned\n", proc.stderr.read()
            t0 = time.monotonic()
            proc.wait(timeout=5)
            assert time.monotonic() - t0 < 1.0
            assert proc.returncode == 0, proc.stderr.read()
        finally:
            if proc.poll() is None:
                proc.kill()
