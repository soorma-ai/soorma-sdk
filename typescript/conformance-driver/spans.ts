// SPDX-License-Identifier: Apache-2.0
//
// The TypeScript driver's test OpenTelemetry SDK (conformance/README.md:
// `create.otel`, `spans`, `inSpan`): an in-memory exporter and an
// AsyncLocalStorage context manager, so a tenant span the driver makes is
// tenant code's active span across the SDK's awaits. The package itself
// installs none of this (SPN-05).
import { context, SpanKind, SpanStatusCode, trace, type Context } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

let exporter: InMemorySpanExporter | undefined;

export function enableTestSdk(): void {
  if (exporter) {
    exporter.reset();
    return;
  }
  exporter = new InMemorySpanExporter();
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }),
  );
}

/** A tenant span, made active for `fn` and ended after it. */
export async function inTenantSpan<T>(
  name: string | undefined,
  fn: () => Promise<T>,
): Promise<{ value: T; tenantSpan?: { traceId: string; spanId: string } }> {
  if (name === undefined) return { value: await fn() };
  const span = trace.getTracer('soorma-typescript-driver').startSpan(name);
  const sc = span.spanContext();
  const ctx: Context = trace.setSpan(context.active(), span);
  try {
    return {
      value: await context.with(ctx, fn),
      tenantSpan: { traceId: sc.traceId, spanId: sc.spanId },
    };
  } finally {
    span.end();
  }
}

const KIND: Record<number, string> = {
  [SpanKind.INTERNAL]: 'internal',
  [SpanKind.SERVER]: 'server',
  [SpanKind.CLIENT]: 'client',
  [SpanKind.PRODUCER]: 'producer',
  [SpanKind.CONSUMER]: 'consumer',
};

export function finishedSpans(): { spans: object[]; providerIsNoop: boolean } {
  if (!exporter) return { spans: [], providerIsNoop: true };
  return {
    providerIsNoop: false,
    spans: exporter
      .getFinishedSpans()
      .filter((s) => s.kind === SpanKind.PRODUCER || s.kind === SpanKind.CONSUMER)
      .map((s) => ({
        name: s.name,
        kind: KIND[s.kind] ?? String(s.kind),
        traceId: s.spanContext().traceId,
        spanId: s.spanContext().spanId,
        ...(s.parentSpanContext ? { parentSpanId: s.parentSpanContext.spanId } : {}),
        links: s.links.map((l) => ({ traceId: l.context.traceId, spanId: l.context.spanId })),
        status:
          s.status.code === SpanStatusCode.ERROR
            ? 'error'
            : s.status.code === SpanStatusCode.OK
              ? 'ok'
              : 'unset',
        attributes: s.attributes,
      })),
  };
}
