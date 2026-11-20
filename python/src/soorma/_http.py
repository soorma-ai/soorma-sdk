# SPDX-License-Identifier: Apache-2.0
#
# The HTTP/1.1 response parser (P-07; NFR-U4-07 to -11; RCV-09): sans-IO, fed
# bytes, returning events, so it cannot hang. Strict and bounded, because the
# SDK parses untrusted responses with its own code:
# - CRLF only in the head and in chunked framing; no obs-fold; a token header
#   name; a status line `HTTP/1.1 SP 3DIGIT SP reason`;
# - bounds on the status line, each header line, the header count, the head, a
#   non-stream body (B_body), each chunk-size line, the trailers, each SSE event
#   (L_event) and each SSE line;
# - Content-Length with Transfer-Encoding, differing lengths, or any coding
#   but exactly `chunked`, refused; chunk extensions ignored; trailers read,
#   bounded and discarded;
# - every failure a TransportError with a reason, never the bytes.
# An SSE event over L_event is discarded up to its blank line, keeping nothing,
# and reported as EventTooLarge; the stream continues.
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum, auto

from ._errors import TransportError

STATUS_LINE_MAX = 1024
HEADER_LINE_MAX = 8 * 1024
HEADER_COUNT_MAX = 100
HEAD_MAX = 64 * 1024
CHUNK_LINE_MAX = 1024
TRAILERS_MAX = 16 * 1024
TRAILER_COUNT_MAX = 32
SSE_LINE_MAX = 1024 * 1024

_STATUS = re.compile(rb"HTTP/1\.1 ([0-9]{3}) ([\t\x20-\x7e\x80-\xff]*)")
_TOKEN = re.compile(rb"[!#$%&'*+\-.^_`|~0-9A-Za-z]+")
_VALUE = re.compile(rb"[\t\x20-\x7e\x80-\xff]*")
_HEX = re.compile(rb"([0-9A-Fa-f]{1,16})(?:[ \t]*;[\t\x20-\x7e\x80-\xff]*)?")
_DIGITS = re.compile(rb"[0-9]{1,19}")


@dataclass(frozen=True, slots=True)
class Head:
    """The status and headers; names lower-cased, in order."""

    status: int
    headers: tuple[tuple[str, str], ...]

    def get(self, name: str) -> str | None:
        for k, v in self.headers:
            if k == name:
                return v
        return None


@dataclass(frozen=True, slots=True)
class Body:
    """A complete non-stream body, at most B_body bytes."""

    data: bytes


@dataclass(frozen=True, slots=True)
class SseEvent:
    """One SSE event with data (SSE: an event without data is not dispatched)."""

    name: str
    data: str


@dataclass(frozen=True, slots=True)
class EventTooLarge:
    """An SSE event over L_event, already discarded (RCV-09)."""


@dataclass(frozen=True, slots=True)
class StreamEnd:
    """The stream's body ended (the final chunk, or the connection closed)."""


Event = Head | Body | SseEvent | EventTooLarge | StreamEnd


def _fail(reason: str) -> TransportError:
    return TransportError(reason)


class _State(Enum):
    STATUS = auto()
    HEADERS = auto()
    LENGTH = auto()
    CHUNK_SIZE = auto()
    CHUNK_DATA = auto()
    CHUNK_CRLF = auto()
    TRAILERS = auto()
    UNTIL_CLOSE = auto()
    DONE = auto()


class ResponseParser:
    """One response. `feed` bytes as they arrive; `eof` when the connection closes."""

    def __init__(self, *, max_body: int, max_event: int, stream: bool = False) -> None:
        self._max_body = max_body
        self._max_event = max_event
        self._stream_allowed = stream
        self._state = _State.STATUS
        self._buf = bytearray()
        self._head_bytes = 0
        self._header_count = 0
        self._status = 0
        self._headers: list[tuple[str, str]] = []
        self._remaining = 0
        self._body = bytearray()
        self._body_size = 0
        self._trailer_bytes = 0
        self._trailer_count = 0
        self._sse: _SseReader | None = None
        self._failed = False

    @property
    def done(self) -> bool:
        return self._state is _State.DONE

    def feed(self, data: bytes) -> list[Event]:
        if self._failed:
            raise _fail("malformed-response")
        try:
            self._buf += data
            out: list[Event] = []
            while self._step(out):
                pass
            return out
        except TransportError:
            self._failed = True
            self._buf.clear()
            self._body.clear()
            raise

    def eof(self) -> list[Event]:
        """The connection closed: the response ends here, or it is truncated."""
        if self._failed:
            raise _fail("malformed-response")
        if self._state is _State.DONE:
            return []
        if self._state is _State.UNTIL_CLOSE:
            self._state = _State.DONE
            return self._finish_body()
        self._failed = True
        if self._sse is not None:
            # A stream ending without its final chunk is a drop, not a refusal.
            self._state = _State.DONE
            return [StreamEnd()]
        raise _fail("truncated-response")

    # ---- one step of the state machine; False when it needs more bytes ----

    def _step(self, out: list[Event]) -> bool:
        state = self._state
        if state is _State.STATUS:
            line = self._line(STATUS_LINE_MAX, head=True)
            if line is None:
                return False
            m = _STATUS.fullmatch(line)
            if not m:
                raise _fail("malformed-response")
            self._status = int(m.group(1))
            if self._status < 200:  # interim responses: not sent by the contract's servers
                raise _fail("malformed-response")
            self._state = _State.HEADERS
            return True
        if state is _State.HEADERS:
            line = self._line(HEADER_LINE_MAX, head=True)
            if line is None:
                return False
            if line == b"":
                out.append(self._begin_body())
                if self._state is _State.DONE:  # an empty body: complete at once
                    out.extend(self._finish_body())
                return True
            self._header(line)
            return True
        if state is _State.LENGTH:
            if not self._buf:
                return False
            take = min(self._remaining, len(self._buf))
            self._consume_body(bytes(self._buf[:take]), out)
            del self._buf[:take]
            self._remaining -= take
            if self._remaining == 0:
                self._state = _State.DONE
                out.extend(self._finish_body())
            return True
        if state is _State.CHUNK_SIZE:
            line = self._line(CHUNK_LINE_MAX)
            if line is None:
                return False
            m = _HEX.fullmatch(line)
            if not m:
                raise _fail("malformed-response")
            size = int(m.group(1), 16)
            if size == 0:
                self._state = _State.TRAILERS
            else:
                if self._sse is None and self._body_size + size > self._max_body:
                    raise _fail("response-too-large")
                self._remaining = size
                self._state = _State.CHUNK_DATA
            return True
        if state is _State.CHUNK_DATA:
            if not self._buf:
                return False
            take = min(self._remaining, len(self._buf))
            self._consume_body(bytes(self._buf[:take]), out)
            del self._buf[:take]
            self._remaining -= take
            if self._remaining == 0:
                self._state = _State.CHUNK_CRLF
            return True
        if state is _State.CHUNK_CRLF:
            if len(self._buf) < 2:
                return False
            if self._buf[:2] != b"\r\n":
                raise _fail("malformed-response")
            del self._buf[:2]
            self._state = _State.CHUNK_SIZE
            return True
        if state is _State.TRAILERS:
            line = self._line(HEADER_LINE_MAX)
            if line is None:
                return False
            if line == b"":
                self._state = _State.DONE
                out.extend(self._finish_body())
                return True
            self._trailer_count += 1
            self._trailer_bytes += len(line) + 2
            if self._trailer_count > TRAILER_COUNT_MAX or self._trailer_bytes > TRAILERS_MAX:
                raise _fail("response-too-large")
            if line[:1] in (b" ", b"\t") or b":" not in line:
                raise _fail("malformed-response")
            return True
        if state is _State.UNTIL_CLOSE:
            if not self._buf:
                return False
            self._consume_body(bytes(self._buf), out)
            self._buf.clear()
            return True
        # DONE: anything more is not part of this response.
        if self._buf:
            raise _fail("malformed-response")
        return False

    def _line(self, limit: int, *, head: bool = False) -> bytes | None:
        """One CRLF-terminated line, or None for more bytes; a bare CR or LF is malformed."""
        at = self._buf.find(b"\n")
        if at < 0:
            if len(self._buf) > limit + 1:
                raise _fail("response-too-large")
            if b"\r" in self._buf[:-1]:
                raise _fail("malformed-response")
            return None
        if at == 0 or self._buf[at - 1] != 0x0D:
            raise _fail("malformed-response")
        if at - 1 > limit:
            raise _fail("response-too-large")
        line = bytes(self._buf[: at - 1])
        if b"\r" in line:
            raise _fail("malformed-response")
        del self._buf[: at + 1]
        if head:
            self._head_bytes += at + 1
            if self._head_bytes > HEAD_MAX:
                raise _fail("response-too-large")
        return line

    def _header(self, line: bytes) -> None:
        if line[:1] in (b" ", b"\t"):  # obs-fold
            raise _fail("malformed-response")
        self._header_count += 1
        if self._header_count > HEADER_COUNT_MAX:
            raise _fail("response-too-large")
        colon = line.find(b":")
        if colon <= 0 or not _TOKEN.fullmatch(line[:colon]):
            raise _fail("malformed-response")
        value = line[colon + 1 :].strip(b" \t")
        if not _VALUE.fullmatch(value):
            raise _fail("malformed-response")
        self._headers.append((line[:colon].decode("ascii").lower(), value.decode("latin-1")))

    def _begin_body(self) -> Head:
        head = Head(self._status, tuple(self._headers))
        lengths = [v for k, v in self._headers if k == "content-length"]
        codings = [v for k, v in self._headers if k == "transfer-encoding"]
        if lengths and codings:
            raise _fail("malformed-response")
        sse = (
            self._stream_allowed
            and self._status == 200
            and (head.get("content-type") or "").split(";")[0].strip().lower()
            == "text/event-stream"
        )
        if sse:
            self._sse = _SseReader(self._max_event)
        if codings:
            if len(codings) != 1 or codings[0].strip().lower() != "chunked":
                raise _fail("malformed-response")
            self._state = _State.CHUNK_SIZE
        elif lengths:
            values = {v.strip() for v in ",".join(lengths).split(",")}
            if len(values) != 1:
                raise _fail("malformed-response")
            text = values.pop().encode("ascii", "replace")
            if not _DIGITS.fullmatch(text):
                raise _fail("malformed-response")
            self._remaining = int(text)
            if self._sse is None and self._remaining > self._max_body:
                raise _fail("response-too-large")
            self._state = _State.LENGTH if self._remaining else _State.DONE
        elif self._status in (204, 304):
            self._state = _State.DONE
        else:
            self._state = _State.UNTIL_CLOSE
        return head

    def _consume_body(self, data: bytes, out: list[Event]) -> None:
        if self._sse is not None:
            out.extend(self._sse.feed(data))
            return
        self._body_size += len(data)
        if self._body_size > self._max_body:
            raise _fail("response-too-large")
        self._body += data

    def _finish_body(self) -> list[Event]:
        if self._sse is not None:
            return [*self._sse.end(), StreamEnd()]
        data = bytes(self._body)
        self._body.clear()
        return [Body(data)]


class _SseReader:
    """SSE lines (LF, CRLF or CR) grouped into events at blank lines (RCV-09)."""

    def __init__(self, max_event: int) -> None:
        self._max_event = max_event
        self._line = bytearray()
        self._line_len = 0  # bytes of the current line, counted even while discarding
        self._after_cr = False
        self._event_bytes = 0
        self._discarding = False
        self._name = ""
        self._data: list[str] = []

    def feed(self, data: bytes) -> list[Event]:
        out: list[Event] = []
        start = 0
        i = 0
        n = len(data)
        while i < n:
            b = data[i]
            if self._after_cr:
                self._after_cr = False
                if b == 0x0A:  # the LF of a CRLF: the CR already ended the line
                    i += 1
                    start = i
                    continue
            if b in (0x0A, 0x0D):
                self._append(data[start:i])
                self._end_line(out)
                self._after_cr = b == 0x0D
                i += 1
                start = i
                continue
            i += 1
        self._append(data[start:n])
        return out

    def end(self) -> list[Event]:
        # An event without its blank line is not dispatched (SSE).
        return []

    def _append(self, chunk: bytes) -> None:
        if not chunk:
            return
        self._line_len += len(chunk)
        self._event_bytes += len(chunk)
        if self._discarding:
            return
        if self._event_bytes > self._max_event or self._line_len > SSE_LINE_MAX:
            self._discard()
            return
        self._line += chunk

    def _discard(self) -> None:
        """Past the bound: keep nothing more of this event until its blank line."""
        self._discarding = True
        self._line.clear()
        self._data.clear()
        self._name = ""

    def _end_line(self, out: list[Event]) -> None:
        blank = self._line_len == 0
        line = bytes(self._line)
        self._line.clear()
        self._line_len = 0
        if blank:
            self._dispatch(out)
            return
        self._event_bytes += 1  # the line's terminator
        if self._discarding:
            return
        if self._event_bytes > self._max_event:
            self._discard()
            return
        text = line.decode("utf-8", "replace")
        if text.startswith(":"):
            return
        field, _, value = text.partition(":")
        if value.startswith(" "):
            value = value[1:]
        if field == "event":
            self._name = value
        elif field == "data":
            self._data.append(value)

    def _dispatch(self, out: list[Event]) -> None:
        if self._discarding:
            out.append(EventTooLarge())
        elif self._data:
            out.append(SseEvent(self._name or "message", "\n".join(self._data)))
        self._discarding = False
        self._event_bytes = 0
        self._name = ""
        self._data.clear()
