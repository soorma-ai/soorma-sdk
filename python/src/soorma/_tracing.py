# SPDX-License-Identifier: Apache-2.0
#
# Spans through opentelemetry-api only (C-19; SPN-01 to SPN-07; DEC-U1-01;
# soorma-sdk GAP-INT-002's work-around; PH-SPN). Messaging conventions at
# OpenTelemetry semantic conventions 1.45.0, written here as constants; no
# soorma-defined span name or attribute; messaging.system is `soorma`
# (DEC-U1-11). No exporter, sampler or provider (SPN-05).
#
# The received context is parsed here, never through a propagator, which may be
# unset (PH-SPN-02). Defence in depth (the user, G3): traceparent and tracestate
# are parsed by this module within W3C Trace Context's limits, and TraceState is
# built from these pairs only; TraceState.from_header and every propagator's
# extract are never called. A tracestate is read to at most 32 list members and
# 512 characters; members past either limit are dropped, as W3C allows, and so
# is a member that is not a valid key=value pair, or a repeated key.
from __future__ import annotations

import re
import secrets
from collections.abc import Sequence
from dataclasses import dataclass

from opentelemetry import context as otel_context
from opentelemetry import trace
from opentelemetry.context import Context
from opentelemetry.trace import (
    Link,
    NonRecordingSpan,
    Span,
    SpanContext,
    SpanKind,
    Status,
    StatusCode,
    TraceFlags,
    TraceState,
)

from ._types import TraceContext

# OpenTelemetry semantic conventions 1.45.0, messaging (TS-U4-09).
OPERATION_TYPE = "messaging.operation.type"
OPERATION_NAME = "messaging.operation.name"
SYSTEM = "messaging.system"
ERROR_TYPE = "error.type"

TRACER_NAME = "soorma"
TRACER_VERSION = "0.1.0"

MAX_TRACESTATE_MEMBERS = 32
MAX_TRACESTATE_LENGTH = 512

_TRACEPARENT = re.compile(r"([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(-.*)?")
_KEY = re.compile(
    r"[a-z][_0-9a-z\-*/]{0,255}|[a-z0-9][_0-9a-z\-*/]{0,240}@[a-z][_0-9a-z\-*/]{0,13}"
)
_VALUE = re.compile(r"[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,255}[\x21-\x2b\x2d-\x3c\x3e-\x7e]")
_OWS = " \t"


def _tracer() -> trace.Tracer:
    return trace.get_tracer(TRACER_NAME, TRACER_VERSION)


def _hex(n: int) -> str:
    return secrets.token_hex(n)


def _trace_id_hex() -> str:
    while (t := _hex(16)) == "0" * 32:
        pass
    return t


def _span_id_hex() -> str:
    while (s := _hex(8)) == "0" * 16:
        pass
    return s


def parse_tracestate(text: str) -> list[tuple[str, str]]:
    """W3C list members as (key, value) pairs, within 32 members and 512 characters."""
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    length = 0
    for raw in text.split(","):
        member = raw.strip(_OWS)
        if not member:
            continue
        if len(pairs) >= MAX_TRACESTATE_MEMBERS:
            break
        key, eq, value = member.partition("=")
        if not eq or not _KEY.fullmatch(key) or not _VALUE.fullmatch(value) or key in seen:
            continue
        added = len(member) + (1 if pairs else 0)
        if length + added > MAX_TRACESTATE_LENGTH:
            break
        length += added
        seen.add(key)
        pairs.append((key, value))
    return pairs


def received_context(tc: object) -> SpanContext | None:
    """A received trace context as a remote span context, or None if it does not parse."""
    if not isinstance(tc, dict):
        return None
    traceparent = tc.get("traceparent")
    tracestate = tc.get("tracestate")
    if not isinstance(traceparent, str):
        return None
    m = _TRACEPARENT.fullmatch(traceparent)
    if m is None:
        return None
    version, trace_id, span_id, flags, rest = m.groups()
    if version == "ff" or set(trace_id) == {"0"} or set(span_id) == {"0"}:
        return None
    if version == "00" and rest is not None:
        return None
    pairs: Sequence[tuple[str, str]] = (
        parse_tracestate(tracestate) if isinstance(tracestate, str) else []
    )
    return SpanContext(
        trace_id=int(trace_id, 16),
        span_id=int(span_id, 16),
        is_remote=True,
        trace_flags=TraceFlags(int(flags, 16)),
        trace_state=TraceState(pairs) if pairs else None,
    )


def _attributes(op: str) -> dict[str, str]:
    return {OPERATION_TYPE: op, OPERATION_NAME: op, SYSTEM: "soorma"}


def _parent(received: SpanContext | None) -> Context:
    """The received context as explicit parent, or a root (an empty context)."""
    if received is None:
        return Context()
    return trace.set_span_in_context(NonRecordingSpan(received), Context())


def _active_links(received: SpanContext | None) -> list[Link]:
    """Tenant code's active span, when it is valid and not the received context."""
    active = trace.get_current_span().get_span_context()
    if not active.is_valid:
        return []
    if (
        received is not None
        and active.trace_id == received.trace_id
        and active.span_id == received.span_id
    ):
        return []
    return [Link(active)]


@dataclass(slots=True)
class SendSpan:
    trace_context: TraceContext
    _span: Span

    def end(self, error_type: str | None = None) -> None:
        if error_type is not None:
            self._span.set_status(Status(StatusCode.ERROR))
            self._span.set_attribute(ERROR_TYPE, error_type)
        self._span.end()


def start_send(*, forwarding: bool, received_tc: object = None) -> SendSpan:
    """The send span (SPN-02 to SPN-04; PH-SPN-03, -04)."""
    received = received_context(received_tc) if forwarding else None
    links: list[Link] = []
    if not forwarding:
        parent = otel_context.get_current()
    else:
        parent = _parent(received)
        links = _active_links(received)
    span = _tracer().start_span(
        "send", context=parent, kind=SpanKind.PRODUCER, attributes=_attributes("send"), links=links
    )
    sc = span.get_span_context()
    # Without an OpenTelemetry SDK the API returns a span carrying the parent's own
    # context: that is not this hop's span, so it is never the draft's (TRC-04).
    parent_sc = trace.get_current_span(parent).get_span_context()
    own = sc.is_valid and not (
        parent_sc.is_valid and parent_sc.trace_id == sc.trace_id and parent_sc.span_id == sc.span_id
    )
    tracestate: str | None = None
    if own:
        traceparent = f"00-{sc.trace_id:032x}-{sc.span_id:016x}-{int(sc.trace_flags):02x}"
        if sc.trace_state:
            tracestate = sc.trace_state.to_header()
    elif received is not None:
        traceparent = (
            f"00-{received.trace_id:032x}-{_span_id_hex()}-{int(received.trace_flags):02x}"
        )
    else:
        traceparent = f"00-{_trace_id_hex()}-{_span_id_hex()}-00"
    return SendSpan(TraceContext(traceparent, tracestate), span)


def record_receive(received_tc: object) -> None:
    """The receive span: its parent the received context, never the active one, and it
    links nothing (PH-SPN-03). Unparseable: a root span linking the active span."""
    received = received_context(received_tc)
    links = [] if received is not None else _active_links(None)
    _tracer().start_span(
        "receive",
        context=_parent(received),
        kind=SpanKind.CONSUMER,
        attributes=_attributes("receive"),
        links=links,
    ).end()


def subscribe_trace_context() -> TraceContext:
    """A subscribe's draft context (DRF-01, TRC-01): no span. Tenant code's active trace,
    when there is one, with a fresh span id; otherwise random identifiers, flags 00."""
    active = trace.get_current_span().get_span_context()
    if active.is_valid:
        return TraceContext(
            f"00-{active.trace_id:032x}-{_span_id_hex()}-{int(active.trace_flags):02x}"
        )
    return TraceContext(f"00-{_trace_id_hex()}-{_span_id_hex()}-00")
