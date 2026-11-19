// SPDX-License-Identifier: Apache-2.0
//
// Spans through the OpenTelemetry API only (C-19; SPN-01 to SPN-07; DEC-U1-01;
// soorma-sdk GAP-INT-002's work-around). Messaging conventions at OpenTelemetry
// semantic conventions 1.45.0, written here as constants; no soorma-defined
// span name or attribute; messaging.system is `soorma` (DEC-U1-11). No exporter,
// sampler or provider (SPN-05). The received context is parsed here, never
// through the global propagator, which may be unset (TH-SPN-02).
import { randomBytes } from 'node:crypto';
import {
  context,
  createTraceState,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  type Context,
  type Link,
  type SpanContext,
} from '@opentelemetry/api';
import type { TraceContext } from './types.ts';

/** OpenTelemetry semantic conventions 1.45.0, messaging (TS-U3-07). */
export const SEMCONV = {
  OPERATION_TYPE: 'messaging.operation.type',
  OPERATION_NAME: 'messaging.operation.name',
  SYSTEM: 'messaging.system',
  ERROR_TYPE: 'error.type',
} as const;

const tracer = () => trace.getTracer('@soorma/sdk', '0.1.0');
const hex = (bytes: number): string => randomBytes(bytes).toString('hex');
const flags = (n: number): string => (n & 0xff).toString(16).padStart(2, '0');

/** A received traceparent as a remote span context, or undefined if it does not parse (TRC). */
export function receivedContext(tc: unknown): SpanContext | undefined {
  if (tc === null || typeof tc !== 'object') return undefined;
  const { traceparent, tracestate } = tc as { traceparent?: unknown; tracestate?: unknown };
  if (typeof traceparent !== 'string') return undefined;
  const m = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(-|$)/.exec(traceparent);
  if (!m || m[1] === 'ff' || /^0+$/.test(m[2] ?? '') || /^0+$/.test(m[3] ?? '')) return undefined;
  if (m[1] === '00' && traceparent.length !== 55) return undefined;
  return {
    traceId: m[2] ?? '',
    spanId: m[3] ?? '',
    traceFlags: parseInt(m[4] ?? '0', 16),
    isRemote: true,
    ...(typeof tracestate === 'string' && tracestate.length > 0
      ? { traceState: createTraceState(tracestate) }
      : {}),
  };
}

const attributes = (op: 'send' | 'receive') => ({
  [SEMCONV.OPERATION_TYPE]: op,
  [SEMCONV.OPERATION_NAME]: op,
  [SEMCONV.SYSTEM]: 'soorma',
});

/** Tenant code's active span, when it is valid and not the received context. */
function activeLink(received: SpanContext | undefined): Link[] {
  const active = trace.getSpanContext(context.active());
  if (!active || !trace.isSpanContextValid(active)) return [];
  if (received && active.traceId === received.traceId && active.spanId === received.spanId)
    return [];
  return [{ context: active }];
}

export interface SendSpan {
  traceContext: TraceContext;
  end(errorType?: string): void;
}

/**
 * The send span (SPN-02 to SPN-04): a client publish parents on the active
 * context; a forward parents on the received context (DEC-U1-01) and links the
 * active span when it differs; an unparseable received context gives a root
 * span linking the active span (SPN-03). The draft's traceparent is the span's
 * context, or generated when no OpenTelemetry SDK is installed (TRC-03).
 */
export function startSend(forwarding: boolean, receivedTc?: unknown): SendSpan {
  const received = forwarding ? receivedContext(receivedTc) : undefined;
  let parent: Context;
  let links: Link[] = [];
  if (!forwarding) {
    parent = context.active();
  } else {
    parent = received ? trace.setSpanContext(ROOT_CONTEXT, received) : ROOT_CONTEXT;
    links = activeLink(received);
  }
  const span = tracer().startSpan(
    'send',
    { kind: SpanKind.PRODUCER, attributes: attributes('send'), links },
    parent,
  );
  const sc = span.spanContext();
  let traceparent: string;
  let tracestate: string | undefined;
  if (trace.isSpanContextValid(sc)) {
    traceparent = `00-${sc.traceId}-${sc.spanId}-${flags(sc.traceFlags)}`;
    const ts = sc.traceState?.serialize();
    if (ts) tracestate = ts;
  } else if (received) {
    traceparent = `00-${received.traceId}-${hex(8)}-${flags(received.traceFlags)}`;
  } else {
    traceparent = `00-${hex(16)}-${hex(8)}-00`;
  }
  return {
    traceContext: tracestate === undefined ? { traceparent } : { traceparent, tracestate },
    end(errorType?: string) {
      if (errorType !== undefined) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.setAttribute(SEMCONV.ERROR_TYPE, errorType);
      }
      span.end();
    },
  };
}

/**
 * The receive span (SPN-02, SPN-03): started and ended as the Delivery is
 * yielded; its parent is the received context, never the active one, and it
 * links nothing (the user's ruling). Unparseable: a root span linking the
 * active span.
 */
export function recordReceive(receivedTc: unknown): void {
  const received = receivedContext(receivedTc);
  const parent = received ? trace.setSpanContext(ROOT_CONTEXT, received) : ROOT_CONTEXT;
  const links = received ? [] : activeLink(undefined);
  tracer()
    .startSpan(
      'receive',
      { kind: SpanKind.CONSUMER, attributes: attributes('receive'), links },
      parent,
    )
    .end();
}
