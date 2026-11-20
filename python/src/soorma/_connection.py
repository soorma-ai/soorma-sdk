# SPDX-License-Identifier: Apache-2.0
#
# One HTTPS request over one connection (P-07; U4-NFR-D-Q1 A): an
# asyncio.Protocol feeding the sans-IO ResponseParser. The request is written
# exactly as assembled (FWD-02's byte-for-byte splice); nothing is buffered
# beside the parser; `pause_reading` and `resume_reading` are SUB-06's
# backpressure; `abort` is close()'s and the collection finalizer's synchronous
# cleanup; T_req bounds the wait for the response head. Every failure is a
# TransportError with a reason, never the bytes; `sent` tells the retry policy
# whether the request may have reached the server (PRB-08, PRB-09).
from __future__ import annotations

import asyncio
import ssl
from collections import deque
from collections.abc import Callable
from urllib.parse import urlsplit

from ._errors import TransportError
from ._http import Body, Event, Head, ResponseParser, StreamEnd


class Connection(asyncio.Protocol):
    """One request and its response. Created by `open_request`."""

    def __init__(self, request: bytes, parser: ResponseParser) -> None:
        self._request = request
        self._parser = parser
        self._loop = asyncio.get_running_loop()
        self._transport: asyncio.Transport | None = None
        self._head: asyncio.Future[Head] = self._loop.create_future()
        self._body: asyncio.Future[bytes] = self._loop.create_future()
        self._events: deque[Event] = deque()
        self._listener: Callable[[Event], None] | None = None
        self._ended = False
        self._error: BaseException | None = None
        self.sent = False
        self._received = False
        # Futures nobody awaits must not report "exception never retrieved".
        for f in (self._head, self._body):
            f.add_done_callback(lambda f: f.cancelled() or f.exception())

    # ---- asyncio.Protocol ----

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        assert isinstance(transport, asyncio.Transport)
        self._transport = transport
        transport.write(self._request)
        self.sent = True
        self._request = b""

    def data_received(self, data: bytes) -> None:
        self._received = True
        try:
            events = self._parser.feed(data)
        except TransportError as e:
            self._fail(e)
            return
        self._deliver(events)

    def eof_received(self) -> bool | None:
        return None  # let the transport close; connection_lost finishes the response

    def connection_lost(self, exc: Exception | None) -> None:
        self._transport = None
        if self._ended or self._error is not None:
            return
        if not self._received:  # closed or reset with no answer at all (PRB-09)
            self._fail(TransportError("connection", sent=self.sent))
            return
        try:
            events = self._parser.eof()
        except TransportError as e:
            self._fail(e)
            return
        self._deliver(events)
        if not self._ended:
            self._fail(TransportError("connection"))

    # ---- what a core uses ----

    async def head(self) -> Head:
        return await self._head

    async def body(self) -> bytes:
        """The whole non-stream body (at most B_body bytes)."""
        return await self._body

    def listen(self, listener: Callable[[Event], None]) -> None:
        """Stream events after the head, in order; buffered ones first."""
        self._listener = listener
        while self._events:
            listener(self._events.popleft())

    def pause_reading(self) -> None:
        if self._transport is not None and self._transport.is_reading():
            self._transport.pause_reading()

    def resume_reading(self) -> None:
        if self._transport is not None and not self._transport.is_reading():
            self._transport.resume_reading()

    def abort(self) -> None:
        """Synchronous: the socket is dropped, nothing awaited or scheduled (PH-LIFE-03)."""
        self._ended = True
        transport, self._transport = self._transport, None
        if transport is not None:
            transport.abort()
        for f in (self._head, self._body):
            if not f.done():
                f.set_exception(TransportError("connection"))

    @property
    def open(self) -> bool:
        return self._transport is not None

    # ---- internals ----

    def _deliver(self, events: list[Event]) -> None:
        for e in events:
            if isinstance(e, Head):
                if not self._head.done():
                    self._head.set_result(e)
                continue
            if isinstance(e, Body):
                self._ended = True
                if not self._body.done():
                    self._body.set_result(e.data)
                continue
            if self._listener is not None:
                self._listener(e)
            else:
                self._events.append(e)
        if self._parser.done:
            self._ended = True

    def _fail(self, error: TransportError) -> None:
        self._error = error
        transport, self._transport = self._transport, None
        if transport is not None:
            transport.abort()
        for f in (self._head, self._body):
            if not f.done():
                f.set_exception(error)
        # A stream refused mid-way (malformed framing, an over-large chunk) ends, for its
        # reader, like a drop; the error stays readable on `error`.
        if self._listener is not None and self._head.done() and not self._head.exception():
            self._listener(StreamEnd())

    @property
    def error(self) -> BaseException | None:
        return self._error


def request_bytes(
    url: str, path: str, headers: dict[str, str], body: bytes | None, *, accept: str
) -> bytes:
    """A POST written exactly: no header but these, the body as given."""
    u = urlsplit(url)
    host = u.hostname or ""
    port = u.port or 443
    lines = [
        f"POST {path} HTTP/1.1",
        f"Host: {host}:{port}",
        f"Accept: {accept}",
        "Connection: close",
    ]
    if body is not None:
        lines += ["Content-Type: application/json", f"Content-Length: {len(body)}"]
    else:
        lines += ["Content-Length: 0"]
    lines += [f"{k}: {v}" for k, v in headers.items()]
    return ("\r\n".join(lines) + "\r\n\r\n").encode("latin-1") + (body or b"")


async def open_request(
    url: str,
    request: bytes,
    ssl_context: ssl.SSLContext,
    *,
    t_req: float,
    max_body: int,
    max_event: int,
    stream: bool = False,
) -> tuple[Head, Connection]:
    """Connects, writes the request, and returns once the head has arrived (within `t_req`,
    seconds: T_req)."""
    u = urlsplit(url)
    if u.scheme != "https" or not u.hostname:
        raise TransportError("connection")
    loop = asyncio.get_running_loop()
    parser = ResponseParser(max_body=max_body, max_event=max_event, stream=stream)
    conn = Connection(request, parser)
    try:
        async with asyncio.timeout(t_req):
            await loop.create_connection(
                lambda: conn,
                host=u.hostname,
                port=u.port or 443,
                ssl=ssl_context,
                server_hostname=u.hostname,
            )
            head = await conn.head()
    except TransportError as e:
        e._sent = conn.sent
        conn.abort()
        raise
    except TimeoutError:
        conn.abort()
        raise TransportError("timeout", sent=conn.sent) from None
    except ssl.SSLCertVerificationError:
        conn.abort()
        raise TransportError("tls") from None
    except ssl.SSLError:
        conn.abort()
        raise TransportError("tls") from None
    except OSError:
        conn.abort()
        raise TransportError("connection", sent=conn.sent) from None
    except asyncio.CancelledError:
        conn.abort()
        raise
    return head, conn
