# SPDX-License-Identifier: Apache-2.0
#
# Tracing (PH-SPN; Step 23a): traceparent and tracestate parsed by the SDK within
# W3C's limits, never through TraceState.from_header or a propagator's extract;
# the send and receive spans' parents and links (DEC-U1-01); the draft's
# traceparent only from this hop's own span, else generated (TRC-04).
from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from opentelemetry import context as otel_context
from opentelemetry import propagate, trace
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import SpanKind, StatusCode, TraceState
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

from soorma import _tracing
from soorma._tracing import (
    parse_tracestate,
    received_context,
    record_receive,
    start_send,
    subscribe_trace_context,
)

TRACE = "4bf92f3577b34da6a3ce929d0e0e4736"
SPAN = "00f067aa0ba902b7"
TP = f"00-{TRACE}-{SPAN}-01"


@pytest.fixture
def spans(monkeypatch: pytest.MonkeyPatch) -> Iterator[InMemorySpanExporter]:
    """A test SDK for this test only: the SDK's tracer comes from it."""
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    monkeypatch.setattr(
        _tracing, "_tracer", lambda: provider.get_tracer(_tracing.TRACER_NAME, "0.1.0")
    )
    yield exporter
    provider.shutdown()


@pytest.fixture
def no_header_parsing(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Fails the test if TraceState.from_header or any propagator's extract is called."""
    called: list[str] = []

    def trap(name: str) -> Any:
        def f(*_a: Any, **_k: Any) -> Any:
            called.append(name)
            raise AssertionError(f"{name} called")

        return f

    monkeypatch.setattr(TraceState, "from_header", classmethod(trap("from_header")))
    monkeypatch.setattr(TraceContextTextMapPropagator, "extract", trap("tracecontext.extract"))
    monkeypatch.setattr(propagate, "extract", trap("propagate.extract"))
    monkeypatch.setattr(propagate.get_global_textmap(), "extract", trap("global.extract"))
    return called


@pytest.mark.parametrize(
    ("tp", "ok"),
    [
        (TP, True),
        (f"00-{TRACE}-{SPAN}-00", True),
        (f"01-{TRACE}-{SPAN}-01-future-fields", True),
        (f"01-{TRACE}-{SPAN}-01", True),
        (f"00-{TRACE}-{SPAN}-01-extra", False),
        (f"ff-{TRACE}-{SPAN}-01", False),
        (f"00-{'0' * 32}-{SPAN}-01", False),
        (f"00-{TRACE}-{'0' * 16}-01", False),
        (f"00-{TRACE.upper()}-{SPAN}-01", False),
        (f"00-{TRACE}-{SPAN}-1", False),
        (f"00-{TRACE[:-1]}-{SPAN}-01", False),
        (f"01-{TRACE}-{SPAN}-01x", False),
        ("", False),
    ],
)
def test_traceparent_parsing(tp: str, ok: bool) -> None:
    sc = received_context({"traceparent": tp})
    assert (sc is not None) is ok
    if sc is not None:
        assert (f"{sc.trace_id:032x}", f"{sc.span_id:016x}") == (TRACE, SPAN)
        assert sc.is_remote


@pytest.mark.parametrize("tc", [None, "x", [], {"traceparent": 1}, {}])
def test_a_context_that_is_not_an_object_with_a_traceparent_is_none(tc: object) -> None:
    assert received_context(tc) is None


def test_tracestate_is_read_within_32_members() -> None:
    text = ",".join(f"k{i}=v{i}" for i in range(40))
    pairs = parse_tracestate(text)
    assert pairs == [(f"k{i}", f"v{i}") for i in range(32)]


def test_tracestate_is_read_within_512_characters() -> None:
    member = "k{:02d}=" + "v" * 60  # 64 characters each
    text = ",".join(member.format(i) for i in range(10))
    pairs = parse_tracestate(text)
    # 7 members and 6 commas are 454 characters; an eighth would make 519.
    assert len(pairs) == 7
    assert len(",".join(f"{k}={v}" for k, v in pairs)) <= 512


def test_invalid_members_and_repeated_keys_are_dropped() -> None:
    text = "a=1, B=2,c,=3, d= ,e=has=eq,a=again,\tf@vendor=ok\t,,g=" + "v" * 257 + ",h=ok"
    assert parse_tracestate(text) == [("a", "1"), ("f@vendor", "ok"), ("h", "ok")]


def test_the_received_tracestate_is_built_from_own_pairs_only(
    no_header_parsing: list[str], spans: InMemorySpanExporter
) -> None:
    tc = {"traceparent": TP, "tracestate": "rojo=00f067aa0ba902b7,congo=t61rcWkgMzE"}
    sc = received_context(tc)
    assert sc is not None
    assert sc.trace_state is not None
    assert list(sc.trace_state.items()) == [("rojo", "00f067aa0ba902b7"), ("congo", "t61rcWkgMzE")]
    send = start_send(forwarding=True, received_tc=tc)
    send.end()
    record_receive(tc)
    assert send.trace_context.tracestate == "rojo=00f067aa0ba902b7,congo=t61rcWkgMzE"
    assert no_header_parsing == []


def test_a_client_publish_parents_on_the_active_span(spans: InMemorySpanExporter) -> None:
    tracer = trace.get_tracer("tenant", tracer_provider=_provider_of(spans))
    with tracer.start_as_current_span("tenant-work") as active:
        send = start_send(forwarding=False)
        send.end()
    s = _one(spans, "send")
    assert s.parent is not None
    assert s.parent.span_id == active.get_span_context().span_id
    assert s.kind == SpanKind.PRODUCER
    assert dict(s.attributes or {}) == {
        "messaging.operation.type": "send",
        "messaging.operation.name": "send",
        "messaging.system": "soorma",
    }
    assert s.links == ()
    assert send.trace_context.traceparent == (
        f"00-{s.context.trace_id:032x}-{s.context.span_id:016x}-{int(s.context.trace_flags):02x}"
    )


def test_a_forward_parents_on_the_received_context_and_links_a_decoy(
    spans: InMemorySpanExporter,
) -> None:
    tracer = trace.get_tracer("tenant", tracer_provider=_provider_of(spans))
    with tracer.start_as_current_span("decoy") as decoy:
        send = start_send(forwarding=True, received_tc={"traceparent": TP})
        send.end("conflict")
        record_receive({"traceparent": TP})
    s = _one(spans, "send")
    assert s.parent is not None
    assert (f"{s.parent.trace_id:032x}", f"{s.parent.span_id:016x}") == (TRACE, SPAN)
    assert [link.context.span_id for link in s.links] == [decoy.get_span_context().span_id]
    assert s.status.status_code == StatusCode.ERROR
    assert (s.attributes or {})["error.type"] == "conflict"
    r = _one(spans, "receive")
    assert r.parent is not None
    assert f"{r.parent.span_id:016x}" == SPAN
    assert r.links == ()
    assert r.kind == SpanKind.CONSUMER


def test_an_unparseable_received_context_gives_a_root_linking_the_active_span(
    spans: InMemorySpanExporter,
) -> None:
    tracer = trace.get_tracer("tenant", tracer_provider=_provider_of(spans))
    with tracer.start_as_current_span("tenant-work") as active:
        start_send(forwarding=True, received_tc={"traceparent": "garbage"}).end()
        record_receive({"traceparent": "garbage"})
    for name in ("send", "receive"):
        s = _one(spans, name)
        assert s.parent is None
        assert [link.context.span_id for link in s.links] == [active.get_span_context().span_id]


def test_without_an_sdk_the_draft_traceparent_is_never_the_parents() -> None:
    # The global provider is the API's default here: non-recording spans.
    received = {"traceparent": TP}
    fwd = start_send(forwarding=True, received_tc=received)
    fwd.end()
    _, trace_id, span_id, flags = fwd.trace_context.traceparent.split("-")
    assert (trace_id, flags) == (TRACE, "01")
    assert span_id != SPAN
    own = start_send(forwarding=False)
    own.end()
    _, trace_id, span_id, flags = own.trace_context.traceparent.split("-")
    assert len(trace_id) == 32 and len(span_id) == 16 and flags == "00"
    assert own.trace_context.tracestate is None


def test_without_an_sdk_under_an_active_context_publish_is_random_and_subscribe_follows() -> None:
    # TRC-03: with no valid span context, a client publish's identifiers are random and
    # its flags 00; a subscribe (no span) takes the active trace with a fresh span id.
    sc = received_context({"traceparent": TP})
    assert sc is not None
    token = otel_context.attach(trace.set_span_in_context(trace.NonRecordingSpan(sc)))
    try:
        send = start_send(forwarding=False)
        send.end()
        sub = subscribe_trace_context()
    finally:
        otel_context.detach(token)
    _, trace_id, span_id, flags = send.trace_context.traceparent.split("-")
    assert (trace_id != TRACE, span_id != SPAN, flags) == (True, True, "00")
    _, trace_id, span_id, flags = sub.traceparent.split("-")
    assert (trace_id, span_id != SPAN, flags) == (TRACE, True, "01")


def test_a_subscribe_without_an_active_trace_is_random_with_flags_00() -> None:
    a, b = subscribe_trace_context(), subscribe_trace_context()
    assert a.traceparent != b.traceparent
    assert a.traceparent.endswith("-00")
    assert a.tracestate is None


def _provider_of(exporter: InMemorySpanExporter) -> TracerProvider:
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    return provider


def _one(exporter: InMemorySpanExporter, name: str) -> ReadableSpan:
    found = [s for s in exporter.get_finished_spans() if s.name == name]
    assert len(found) == 1, [s.name for s in exporter.get_finished_spans()]
    return found[0]
