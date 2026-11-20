# SPDX-License-Identifier: Apache-2.0
#
# The Python driver's test OpenTelemetry SDK (conformance/README.md:
# `create.otel`, `spans`, `inSpan`): a tracer provider with an in-memory
# exporter. Python's context is a contextvar, so a tenant span the driver makes
# is tenant code's active span across the SDK's awaits and the tasks it starts.
# The package itself installs none of this (SPN-05).
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import SpanKind, StatusCode

T = TypeVar("T")

_exporter: InMemorySpanExporter | None = None


def enable_test_sdk() -> None:
    global _exporter  # noqa: PLW0603 - one test SDK per driver process
    if _exporter is not None:
        _exporter.clear()
        return
    _exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(_exporter))
    trace.set_tracer_provider(provider)


async def in_tenant_span(
    name: str | None, fn: Callable[[], Awaitable[T]]
) -> tuple[T, dict[str, str] | None]:
    """A tenant span, made current for `fn` and ended after it."""
    if name is None:
        return await fn(), None
    tracer = trace.get_tracer("soorma-python-driver")
    with tracer.start_as_current_span(name) as span:
        sc = span.get_span_context()
        value = await fn()
    return value, {"traceId": f"{sc.trace_id:032x}", "spanId": f"{sc.span_id:016x}"}


_KIND = {
    SpanKind.INTERNAL: "internal",
    SpanKind.SERVER: "server",
    SpanKind.CLIENT: "client",
    SpanKind.PRODUCER: "producer",
    SpanKind.CONSUMER: "consumer",
}
_STATUS = {StatusCode.ERROR: "error", StatusCode.OK: "ok", StatusCode.UNSET: "unset"}


def finished_spans() -> dict[str, Any]:
    if _exporter is None:
        return {"spans": [], "providerIsNoop": True}
    out: list[dict[str, Any]] = []
    for s in _exporter.get_finished_spans():
        if s.kind not in (SpanKind.PRODUCER, SpanKind.CONSUMER) or s.context is None:
            continue
        span: dict[str, Any] = {
            "name": s.name,
            "kind": _KIND[s.kind],
            "traceId": f"{s.context.trace_id:032x}",
            "spanId": f"{s.context.span_id:016x}",
            "links": [
                {
                    "traceId": f"{link.context.trace_id:032x}",
                    "spanId": f"{link.context.span_id:016x}",
                }
                for link in s.links
            ],
            "status": _STATUS[s.status.status_code],
            "attributes": dict(s.attributes or {}),
        }
        if s.parent is not None:
            span["parentSpanId"] = f"{s.parent.span_id:016x}"
        out.append(span)
    return {"spans": out, "providerIsNoop": False}
