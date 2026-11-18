// SPDX-License-Identifier: Apache-2.0
//
// Test spans (SPN; DEC-U1-01, US-Q1): a send span (producer) per publish, a
// receive span (consumer) per Delivery; a forwarding hop's spans are children
// of the received context, linked to tenant code's span when that differs.
// Without the test SDK, identifiers are generated (TRC-03).
import { randomBytes } from 'node:crypto';
import {
  context,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  type Context,
  type Link,
  type SpanContext,
} from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

let exporter: InMemorySpanExporter | undefined;

export function enableTestSdk(): void {
  exporter = new InMemorySpanExporter();
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }),
  );
}

export const sdkEnabled = (): boolean => exporter !== undefined;
const tracer = () => trace.getTracer('soorma-reference-driver');
const hex = (n: number): string => randomBytes(n).toString('hex');

export function parseTraceparent(tp: unknown): SpanContext | undefined {
  if (typeof tp !== 'string') return undefined;
  const m = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(-|$)/.exec(tp);
  if (!m || m[1] === 'ff' || /^0+$/.test(m[2] ?? '') || /^0+$/.test(m[3] ?? '')) return undefined;
  if (m[1] === '00' && tp.length !== 55) return undefined;
  return {
    traceId: m[2] ?? '',
    spanId: m[3] ?? '',
    traceFlags: parseInt(m[4] ?? '0', 16),
    isRemote: true,
  };
}

const MESSAGING = (op: 'send' | 'receive') => ({
  'messaging.operation.type': op,
  'messaging.operation.name': op,
  'messaging.system': 'soorma',
});

export interface SendSpan {
  traceparent: string;
  end(errorCode?: string): void;
}

/** The send span: child of `received` when forwarding, else of tenant code's span. */
export function startSend(opts: {
  tenant?: Context;
  received?: SpanContext | undefined;
  forwarding: boolean;
}): SendSpan {
  const tenantSpan = opts.tenant ? trace.getSpanContext(opts.tenant) : undefined;
  let parent: Context = opts.tenant ?? context.active();
  const links: Link[] = [];
  if (opts.forwarding) {
    parent = opts.received ? trace.setSpanContext(ROOT_CONTEXT, opts.received) : ROOT_CONTEXT;
    if (
      tenantSpan &&
      !(
        opts.received &&
        tenantSpan.spanId === opts.received.spanId &&
        tenantSpan.traceId === opts.received.traceId
      )
    ) {
      links.push({ context: tenantSpan });
    }
  }
  const span = tracer().startSpan(
    'send',
    { kind: SpanKind.PRODUCER, attributes: MESSAGING('send'), links },
    parent,
  );
  const sc = span.spanContext();
  let traceparent: string;
  if (trace.isSpanContextValid(sc)) {
    traceparent = `00-${sc.traceId}-${sc.spanId}-${sc.traceFlags.toString(16).padStart(2, '0')}`;
  } else if (opts.forwarding && opts.received) {
    traceparent = `00-${opts.received.traceId}-${hex(8)}-${opts.received.traceFlags.toString(16).padStart(2, '0')}`;
  } else {
    traceparent = `00-${hex(16)}-${hex(8)}-00`;
  }
  return {
    traceparent,
    end(errorCode?: string) {
      if (errorCode !== undefined) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.setAttribute('error.type', errorCode);
      }
      span.end();
    },
  };
}

export function recordReceive(received: SpanContext | undefined): void {
  const parent = received ? trace.setSpanContext(ROOT_CONTEXT, received) : ROOT_CONTEXT;
  tracer()
    .startSpan('receive', { kind: SpanKind.CONSUMER, attributes: MESSAGING('receive') }, parent)
    .end();
}

export function tenantContext(name: string): {
  ctx: Context;
  ids: { traceId: string; spanId: string };
  end: () => void;
} {
  const span = tracer().startSpan(name);
  const sc = span.spanContext();
  return {
    ctx: trace.setSpan(context.active(), span),
    ids: { traceId: sc.traceId, spanId: sc.spanId },
    end: () => span.end(),
  };
}

const KIND: Record<number, string> = {
  0: 'internal',
  1: 'server',
  2: 'client',
  3: 'producer',
  4: 'consumer',
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
