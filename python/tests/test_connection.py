# SPDX-License-Identifier: Apache-2.0
#
# The connection (P-07): the request written exactly; a bounded body; a chunked
# event stream delivered in order, with pause and resume; an untrusted
# certificate (tls); a closed port (connection, not sent); a reset after the
# request (connection, sent); T_req (timeout); a body over B_body
# (response-too-large, the socket dropped); and abort() closing the socket.
from __future__ import annotations

import asyncio
import socket

import pytest

from soorma import TransportError
from soorma._connection import open_request, request_bytes
from soorma._http import Event, SseEvent, StreamEnd

from .conftest import Certs, Server, client_context

MAX = 64 * 1024


def reply(raw: bytes):  # type: ignore[no-untyped-def]
    async def handler(_req: bytes, w: asyncio.StreamWriter) -> None:
        w.write(raw)
        await w.drain()

    return handler


@pytest.mark.asyncio
async def test_the_request_is_written_exactly_and_the_body_read(
    certs: Certs, server: Server
) -> None:
    server.handler = reply(
        b'HTTP/1.1 202 Accepted\r\ncontent-length: 13\r\n\r\n{"accepted":1}'[:-1]
    )
    req = request_bytes(
        server.url,
        "/events",
        {"Authorization": "Bearer t"},
        b'{"draft":{}}',
        accept="application/json",
    )
    head, conn = await open_request(
        server.url, req, client_context(certs.ca), t_req=5, max_body=MAX, max_event=MAX
    )
    assert head.status == 202
    assert await conn.body() == b'{"accepted":1'
    conn.abort()
    assert server.requests == [req]
    assert req.endswith(b'\r\n\r\n{"draft":{}}')


@pytest.mark.asyncio
async def test_a_chunked_event_stream_arrives_in_order_and_pauses(
    certs: Certs, server: Server
) -> None:
    events = [b"event: delivery\ndata: one\n\n", b": hb\n\n", b"event: end\ndata: {}\n\n"]
    raw = (
        b"HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\ntransfer-encoding: chunked\r\n\r\n"
    )
    raw += b"".join(f"{len(e):x}\r\n".encode() + e + b"\r\n" for e in events) + b"0\r\n\r\n"
    server.handler = reply(raw)
    req = request_bytes(server.url, "/subscriptions", {}, b"{}", accept="text/event-stream")
    head, conn = await open_request(
        server.url, req, client_context(certs.ca), t_req=5, max_body=MAX, max_event=MAX, stream=True
    )
    assert head.status == 200
    got: list[Event] = []
    done = asyncio.Event()

    def on(e: Event) -> None:
        got.append(e)
        if isinstance(e, StreamEnd):
            done.set()

    conn.pause_reading()
    conn.resume_reading()
    conn.listen(on)
    await asyncio.wait_for(done.wait(), 5)
    assert got == [SseEvent("delivery", "one"), SseEvent("end", "{}"), StreamEnd()]
    conn.abort()


@pytest.mark.asyncio
async def test_an_untrusted_certificate_is_tls(certs: Certs, server: Server) -> None:
    req = request_bytes(server.url, "/x", {}, None, accept="application/json")
    with pytest.raises(TransportError) as e:
        await open_request(
            server.url,
            req,
            client_context(certs.untrusted_ca),
            t_req=5,
            max_body=MAX,
            max_event=MAX,
        )
    assert e.value.reason == "tls"


@pytest.mark.asyncio
async def test_a_closed_port_is_connection_and_not_sent(certs: Certs) -> None:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    url = f"https://localhost:{port}"
    with pytest.raises(TransportError) as e:
        await open_request(
            url,
            request_bytes(url, "/x", {}, None, accept="*/*"),
            client_context(certs.ca),
            t_req=5,
            max_body=MAX,
            max_event=MAX,
        )
    assert e.value.reason == "connection"
    assert e.value._sent is False


@pytest.mark.asyncio
async def test_a_reset_after_the_request_is_connection_and_sent(
    certs: Certs, server: Server
) -> None:
    async def reset(_req: bytes, w: asyncio.StreamWriter) -> None:
        w.transport.abort()

    server.handler = reset
    req = request_bytes(server.url, "/x", {}, b"{}", accept="*/*")
    with pytest.raises(TransportError) as e:
        await open_request(
            server.url, req, client_context(certs.ca), t_req=5, max_body=MAX, max_event=MAX
        )
    assert e.value.reason == "connection"
    assert e.value._sent is True


@pytest.mark.asyncio
async def test_no_head_within_t_req_is_timeout(certs: Certs, server: Server) -> None:
    async def silent(_req: bytes, _w: asyncio.StreamWriter) -> None:
        await asyncio.sleep(10)

    server.handler = silent
    req = request_bytes(server.url, "/x", {}, b"{}", accept="*/*")
    with pytest.raises(TransportError) as e:
        await open_request(
            server.url, req, client_context(certs.ca), t_req=0.3, max_body=MAX, max_event=MAX
        )
    assert e.value.reason == "timeout"


@pytest.mark.asyncio
async def test_a_body_over_the_bound_is_response_too_large_and_the_socket_dropped(
    certs: Certs, server: Server
) -> None:
    async def big(_req: bytes, w: asyncio.StreamWriter) -> None:
        w.write(b"HTTP/1.1 413 Too Large\r\ntransfer-encoding: chunked\r\n\r\n")
        for _ in range(8):
            w.write(b"4000\r\n" + b"F" * 0x4000 + b"\r\n")
            await w.drain()

    server.handler = big
    req = request_bytes(server.url, "/events", {}, b"{}", accept="*/*")

    async def call() -> None:
        # The refusal comes from open_request when the head and the over-large chunk
        # arrive together, or from body() when they arrive apart: either is correct.
        head, conn = await open_request(
            server.url, req, client_context(certs.ca), t_req=5, max_body=MAX, max_event=MAX
        )
        assert head.status == 413
        await conn.body()

    with pytest.raises(TransportError) as e:
        await call()
    assert e.value.reason == "response-too-large"
    assert "FFFF" not in str(e.value)
    await asyncio.wait_for(server.closed.wait(), 5)


@pytest.mark.asyncio
async def test_abort_closes_an_open_stream(certs: Certs, server: Server) -> None:
    async def hold(_req: bytes, w: asyncio.StreamWriter) -> None:
        w.write(
            b"HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\n"
            b"transfer-encoding: chunked\r\n\r\n"
        )
        await w.drain()

    server.handler = hold
    req = request_bytes(server.url, "/subscriptions", {}, b"{}", accept="text/event-stream")
    _, conn = await open_request(
        server.url, req, client_context(certs.ca), t_req=5, max_body=MAX, max_event=MAX, stream=True
    )
    assert conn.open
    conn.abort()
    assert not conn.open
    await asyncio.wait_for(server.closed.wait(), 5)
