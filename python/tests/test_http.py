# SPDX-License-Identifier: Apache-2.0
#
# The response parser (P-07; NFR-U4-07 to -11; RCV-09): table-driven malformed,
# oversized, conflicting and truncated input (TC-PH-085), valid responses fed at
# every split, SSE events and their bound, and a seeded fuzz test (TC-PH-086):
# every input ends in a response or TransportError, never another exception,
# never a buffer past the bounds. No error message holds the input's bytes.
from __future__ import annotations

import itertools
import random

import pytest

from soorma import TransportError
from soorma._http import (
    HEAD_MAX,
    HEADER_LINE_MAX,
    SSE_LINE_MAX,
    Body,
    Event,
    EventTooLarge,
    Head,
    ResponseParser,
    SseEvent,
    StreamEnd,
)

MARK = "SECRETMARK"
MAX_BODY = 64 * 1024
MAX_EVENT = 4096


def run(
    raw: bytes,
    *,
    splits: list[int] | None = None,
    stream: bool = False,
    max_body: int = MAX_BODY,
    max_event: int = MAX_EVENT,
    eof: bool = True,
) -> list[Event]:
    p = ResponseParser(max_body=max_body, max_event=max_event, stream=stream)
    out: list[Event] = []
    cuts = [0, *(splits or []), len(raw)]
    for a, b in itertools.pairwise(cuts):
        out += p.feed(raw[a:b])
    if eof:
        out += p.eof()
    return out


def head(*lines: str, status: str = "HTTP/1.1 200 OK") -> bytes:
    return ("\r\n".join([status, *lines]) + "\r\n\r\n").encode()


def reason_of(raw: bytes, **kw: object) -> str:
    with pytest.raises(TransportError) as e:
        run(raw, **kw)  # type: ignore[arg-type]
    assert MARK not in str(e.value)
    assert MARK not in repr(e.value)
    return e.value.reason


# ---- malformed, conflicting, oversized, truncated (TC-PH-085) ----

BIG = "x" * (HEADER_LINE_MAX + 10)
CASES: list[tuple[str, bytes, str]] = [
    (
        "bare LF in the status line",
        f"HTTP/1.1 200 {MARK}\ncontent-length: 0\r\n\r\n".encode(),
        "malformed-response",
    ),
    ("HTTP/1.0", head("content-length: 0", status=f"HTTP/1.0 200 {MARK}"), "malformed-response"),
    (
        "a two-digit status",
        head("content-length: 0", status=f"HTTP/1.1 20 {MARK}"),
        "malformed-response",
    ),
    ("no reason separator", head("content-length: 0", status="HTTP/1.1 200"), "malformed-response"),
    (
        "an interim response",
        head("content-length: 0", status=f"HTTP/1.1 100 {MARK}"),
        "malformed-response",
    ),
    ("obs-fold", head("content-length: 0", f" {MARK}"), "malformed-response"),
    (
        "a space in a header name",
        head(f"bad name: {MARK}", "content-length: 0"),
        "malformed-response",
    ),
    ("a header line with no colon", head(f"{MARK}", "content-length: 0"), "malformed-response"),
    (
        "a control byte in a value",
        head(f"x: {MARK}\x01", "content-length: 0"),
        "malformed-response",
    ),
    (
        "a bare CR inside a header line",
        head(f"x: {MARK}\ry", "content-length: 0"),
        "malformed-response",
    ),
    (
        "bare LF ending a header",
        f"HTTP/1.1 200 OK\r\nx: {MARK}\ncontent-length: 0\r\n\r\n".encode(),
        "malformed-response",
    ),
    (
        "Content-Length with Transfer-Encoding",
        head("content-length: 3", "transfer-encoding: chunked") + MARK.encode(),
        "malformed-response",
    ),
    (
        "differing Content-Lengths",
        head("content-length: 5, 6") + MARK.encode(),
        "malformed-response",
    ),
    (
        "two different Content-Length headers",
        head("content-length: 5", "content-length: 6") + MARK.encode(),
        "malformed-response",
    ),
    ("a non-decimal length", head("content-length: 0x10") + MARK.encode(), "malformed-response"),
    ("a negative length", head("content-length: -1") + MARK.encode(), "malformed-response"),
    (
        "a coding other than chunked",
        head("transfer-encoding: gzip, chunked") + MARK.encode(),
        "malformed-response",
    ),
    (
        "two Transfer-Encoding headers",
        head("transfer-encoding: chunked", "transfer-encoding: chunked") + b"0\r\n\r\n",
        "malformed-response",
    ),
    (
        "a bad chunk size",
        head("transfer-encoding: chunked") + f"zz{MARK}\r\n".encode(),
        "malformed-response",
    ),
    (
        "chunk data without its CRLF",
        head("transfer-encoding: chunked") + f"5\r\n{MARK[:5]}XX0\r\n\r\n".encode(),
        "malformed-response",
    ),
    (
        "bytes after the response",
        head("content-length: 2") + f"ok{MARK}".encode(),
        "malformed-response",
    ),
    (
        "an oversized status line",
        head("content-length: 0", status="HTTP/1.1 200 " + MARK + "x" * 1100),
        "response-too-large",
    ),
    (
        "an oversized header line",
        head(f"x: {MARK}{BIG}", "content-length: 0"),
        "response-too-large",
    ),
    (
        "too many headers",
        head(*[f"x{n}: {MARK}" for n in range(101)], "content-length: 0"),
        "response-too-large",
    ),
    (
        "an oversized head",
        head(*[f"x{n}: {MARK}{'y' * 8000}" for n in range(9)], "content-length: 0"),
        "response-too-large",
    ),
    (
        "a Content-Length over the body bound",
        head(f"content-length: {MAX_BODY + 1}") + MARK.encode(),
        "response-too-large",
    ),
    (
        "a chunked body over the body bound",
        head("transfer-encoding: chunked")
        + (f"{0x8000:x}\r\n" + MARK + "x" * (0x8000 - len(MARK)) + "\r\n").encode() * 3,
        "response-too-large",
    ),
    (
        "an oversized chunk-size line",
        head("transfer-encoding: chunked") + f"5;{MARK}{'e' * 1100}\r\n".encode(),
        "response-too-large",
    ),
    (
        "too many trailers",
        head("transfer-encoding: chunked")
        + b"0\r\n"
        + "".join(f"t{n}: {MARK}\r\n" for n in range(33)).encode()
        + b"\r\n",
        "response-too-large",
    ),
    (
        "oversized trailers",
        head("transfer-encoding: chunked")
        + b"0\r\n"
        + "".join(f"t{n}: {MARK}{'v' * 2000}\r\n" for n in range(9)).encode()
        + b"\r\n",
        "response-too-large",
    ),
    (
        "a close-delimited body over the bound",
        head() + MARK.encode() * (MAX_BODY // len(MARK) + 1),
        "response-too-large",
    ),
    (
        "the connection closing in the head",
        f"HTTP/1.1 200 OK\r\nx: {MARK}".encode(),
        "truncated-response",
    ),
    (
        "the connection closing in a length body",
        head("content-length: 100") + MARK.encode(),
        "truncated-response",
    ),
    (
        "the connection closing in a chunked body",
        head("transfer-encoding: chunked") + f"20\r\n{MARK}".encode(),
        "truncated-response",
    ),
]


@pytest.mark.parametrize(("name", "raw", "reason"), CASES, ids=[c[0] for c in CASES])
def test_refused_with_its_reason_and_never_the_bytes(name: str, raw: bytes, reason: str) -> None:
    assert reason_of(raw) == reason


@pytest.mark.parametrize(("name", "raw", "reason"), CASES, ids=[c[0] for c in CASES])
def test_refused_the_same_fed_a_byte_at_a_time(name: str, raw: bytes, reason: str) -> None:
    assert reason_of(raw, splits=list(range(1, len(raw)))) == reason


def test_a_refusal_holds_nothing_and_refuses_again() -> None:
    p = ResponseParser(max_body=MAX_BODY, max_event=MAX_EVENT)
    with pytest.raises(TransportError):
        p.feed(head("content-length: 3", "transfer-encoding: chunked"))
    with pytest.raises(TransportError):
        p.feed(b"more")


# ---- valid responses, at every split ----

VALID: list[tuple[str, bytes, bytes]] = [
    (
        "a length body",
        head("Content-Type: application/json", "Content-Length: 11") + b'{"ok":true}',
        b'{"ok":true}',
    ),
    ("an empty length body", head("content-length: 0"), b""),
    ("equal repeated lengths", head("content-length: 2, 2", "Content-Length: 2") + b"ok", b"ok"),
    (
        "a chunked body, extensions ignored, trailers discarded",
        head("Transfer-Encoding: Chunked")
        + b"3;name=val\r\nabc\r\n2\r\nde\r\n0\r\nx-trailer: t\r\n\r\n",
        b"abcde",
    ),
    ("a close-delimited body", head() + b"until close", b"until close"),
    ("204, no body", head(status="HTTP/1.1 204 No Content"), b""),
]


@pytest.mark.parametrize(("name", "raw", "body"), VALID, ids=[v[0] for v in VALID])
def test_valid_responses_parse_the_same_at_every_split(name: str, raw: bytes, body: bytes) -> None:
    whole = run(raw)
    assert isinstance(whole[0], Head)
    assert whole[-1] == Body(body)
    for cut in range(1, len(raw)):
        assert run(raw, splits=[cut]) == whole


def test_header_names_are_lower_cased_and_values_trimmed() -> None:
    h = run(head("X-Thing:  value \t", "content-length: 0"))[0]
    assert isinstance(h, Head)
    assert h.status == 200
    assert h.get("x-thing") == "value"


# ---- SSE streams (RCV-09) ----


def sse(*events: bytes, chunked: bool = True, final: bool = False) -> bytes:
    body = b"".join(events)
    if not chunked:
        return head("content-type: text/event-stream") + body
    framed = b"".join(f"{len(part):x}\r\n".encode() + part + b"\r\n" for part in events if part)
    return (
        head("Content-Type: text/event-stream; charset=utf-8", "transfer-encoding: chunked")
        + framed
        + (b"0\r\n\r\n" if final else b"")
    )


def items(events: list[Event]) -> list[object]:
    return [e for e in events if not isinstance(e, Head)]


def test_sse_events_names_data_lines_comments_and_every_line_ending() -> None:
    raw = sse(
        b": heartbeat\n\n",
        b"event: delivery\ndata: one\ndata: two\n\n",
        b"event: end\r\ndata: {}\r\n\r\n",
        b"data: cr\r\r",
        b"event: nothing\n\n",
    )
    assert items(run(raw, stream=True)) == [
        SseEvent("delivery", "one\ntwo"),
        SseEvent("end", "{}"),
        SseEvent("message", "cr"),
        StreamEnd(),
    ]
    for cut in range(1, len(raw)):
        assert items(run(raw, stream=True, splits=[cut])) == items(run(raw, stream=True))


def big_event(n_bytes: int) -> bytes:
    line = b"data: " + b"x" * 93 + b"\n"
    return b"event: delivery\n" + line * (n_bytes // len(line) + 1) + b"\n"


def test_an_event_over_the_bound_is_one_error_and_the_next_event_still_arrives() -> None:
    raw = sse(big_event(MAX_EVENT * 4), b"event: delivery\ndata: next\n\n")
    assert items(run(raw, stream=True, splits=list(range(100, len(raw), 997)))) == [
        EventTooLarge(),
        SseEvent("delivery", "next"),
        StreamEnd(),
    ]


def test_one_line_longer_than_the_bound_is_the_same() -> None:
    raw = sse(b"data: " + b"y" * (MAX_EVENT + 10) + b"\n\n", b"data: ok\n\n")
    assert items(run(raw, stream=True)) == [EventTooLarge(), SseEvent("message", "ok"), StreamEnd()]


def test_an_event_at_exactly_the_bound_is_read() -> None:
    # "data: " + value + "\n" counts len(line) + 1 bytes before the blank line.
    value = "z" * (MAX_EVENT - len("data: ") - 1)
    raw = sse(f"data: {value}\n\n".encode())
    assert items(run(raw, stream=True)) == [SseEvent("message", value), StreamEnd()]
    raw = sse(f"data: {value}z\n\n".encode())
    assert items(run(raw, stream=True)) == [EventTooLarge(), StreamEnd()]


def test_a_stream_dropped_without_its_final_chunk_ends_and_is_not_refused() -> None:
    assert items(run(sse(b"data: a\n\n"), stream=True)) == [SseEvent("message", "a"), StreamEnd()]


def test_a_refused_subscribe_is_a_bounded_body_not_a_stream() -> None:
    raw = (
        head(
            "content-type: application/problem+json",
            "content-length: 2",
            status="HTTP/1.1 403 Forbidden",
        )
        + b"{}"
    )
    assert run(raw, stream=True)[-1] == Body(b"{}")


def test_the_sse_line_buffer_is_bounded_whatever_the_event_bound() -> None:
    raw = sse(b"data: " + b"q" * (SSE_LINE_MAX + 5) + b"\n\n", b"data: after\n\n")
    assert items(run(raw, stream=True, max_event=SSE_LINE_MAX * 4)) == [
        EventTooLarge(),
        SseEvent("message", "after"),
        StreamEnd(),
    ]


# ---- the fuzz test (TC-PH-086) ----

SEEDS = range(40)
VALID_RAW = [v[1] for v in VALID] + [sse(b"event: delivery\ndata: x\n\n", final=True)]


def mutate(rng: random.Random, raw: bytes) -> bytes:
    b = bytearray(raw)
    for _ in range(rng.randint(1, 6)):
        op = rng.randrange(5)
        if op == 0 and b:  # flip a byte
            b[rng.randrange(len(b))] = rng.randrange(256)
        elif op == 1 and b:  # truncate
            del b[rng.randrange(len(b)) :]
        elif op == 2:  # insert random bytes
            at = rng.randrange(len(b) + 1)
            b[at:at] = rng.randbytes(rng.randint(1, 64))
        elif op == 3:  # duplicate a line
            lines = bytes(b).split(b"\r\n")
            if lines:
                k = rng.randrange(len(lines))
                lines.insert(k, lines[k])
                b = bytearray(b"\r\n".join(lines))
        else:  # an oversized line
            at = rng.randrange(len(b) + 1)
            b[at:at] = b"x" * rng.choice([HEADER_LINE_MAX + 1, HEAD_MAX, 2000])
    return bytes(b)


def splits(rng: random.Random, n: int) -> list[int]:
    return sorted(rng.sample(range(1, n), min(n - 1, rng.randint(0, 12)))) if n > 1 else []


@pytest.mark.parametrize("seed", SEEDS)
def test_fuzz_ends_in_a_response_or_a_transport_error(seed: int) -> None:
    rng = random.Random(seed)
    for _ in range(60):
        raw = (
            rng.randbytes(rng.randint(0, 4096))
            if rng.random() < 0.3
            else mutate(rng, rng.choice(VALID_RAW))
        )
        p = ResponseParser(max_body=MAX_BODY, max_event=MAX_EVENT, stream=rng.random() < 0.5)
        cuts = [0, *splits(rng, len(raw)), len(raw)]
        try:
            for a, b in itertools.pairwise(cuts):
                p.feed(raw[a:b])
                # Never a buffer past the bounds: the head and one body chunk at most.
                assert len(p._buf) <= HEAD_MAX + len(raw)
                assert len(p._body) <= MAX_BODY
            p.eof()
        except TransportError as e:
            assert e.reason in {"malformed-response", "response-too-large", "truncated-response"}
