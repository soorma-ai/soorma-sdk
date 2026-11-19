// SPDX-License-Identifier: Apache-2.0
//
// The TypeScript end-to-end scenario (business-logic-model §10; TH-E2E-02 to 04;
// FR-19; TC-TH-061 to 063), against soorma-core's real stack after U2's
// core-up, setup and prove-stack. Both agents in this one process, each with its
// own instance identifier and its own secret file (fileSecret, on the files
// setup wrote). The built package (dist/) through `@soorma/sdk`; the
// OpenTelemetry SDK and exporter are this test's, never the package's. It never
// uses the values hook. Run with `pnpm e2e:scenario-typescript`, after
// `pnpm --filter @soorma/sdk build`; `pnpm test` excludes it.
import { context, trace, type Context } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import { AgentClient, fileSecret, newInstanceId, type Delivery } from '@soorma/sdk';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { layout, REPOSITORY_ROOT } from '../../e2e/src/stack.ts';
import { LIMITS } from '../src/limits.ts';

interface StackDescription {
  environment: { organization: string; project: string; environment: string };
  s3: string;
  s4: string;
  ca: string;
  agents: { agent: string; secretFile: string }[];
}

const SKEW_MS = 14 * 60_000;
const PAYLOAD = { hello: 'B' };

/** Polls `ok` every 100 ms until it holds or `ms` pass; returns whether it held. */
async function until(ok: () => boolean, ms: number): Promise<boolean> {
  const end = performance.now() + ms;
  while (!ok()) {
    if (performance.now() >= end) return false;
    await sleep(100);
  }
  return true;
}

const openSockets = (): number =>
  process
    .getActiveResourcesInfo()
    .filter((t) => ['TCPSocketWrap', 'TCPWRAP', 'TLSWrap', 'TLSWRAP'].includes(t)).length;

const traceIdOf = (traceparent: string): string => traceparent.split('-')[1] ?? '';
const spanIdOf = (traceparent: string): string => traceparent.split('-')[2] ?? '';

describe('two agents on the real stack (FR-19)', () => {
  // Step 1: the stack description, and the test's own tracer provider.
  const stack = JSON.parse(readFileSync(layout(REPOSITORY_ROOT).stack, 'utf8')) as StackDescription;
  const exporter = new InMemorySpanExporter();
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }),
  );
  const secretFile = (agent: string): string => {
    const a = stack.agents.find((x) => x.agent === agent);
    if (!a) throw new Error(`.e2e/stack.json has no ${agent}: run setup --agents agent-a,agent-b`);
    return a.secretFile;
  };
  const client = (agent: string): AgentClient =>
    new AgentClient({
      dataGatewayUrl: stack.s3,
      eventIngestUrl: stack.s4,
      caFile: stack.ca,
      agent,
      instance: newInstanceId(),
      secret: fileSecret(secretFile(agent)),
    });

  const warnings: string[] = [];
  const onWarning = (w: Error & { code?: string }): void => {
    if (w.name === 'SoormaWarning') warnings.push(String(w.code));
  };
  process.on('warning', onWarning);
  const socketsBefore = openSockets();
  const a = client('agent-a');
  const b = client('agent-b');

  afterAll(async () => {
    vi.useRealTimers();
    process.off('warning', onWarning);
    await Promise.allSettled([a.close(), b.close()]);
  });

  it('runs the scenario: one real renewal, A to B, one trace across the hop', async () => {
    // Step 2: only Date is faked, 14 minutes ahead (TH-E2E-04); timers stay real.
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    vi.setSystemTime(Date.now() + SKEW_MS);

    await b.start();
    await sleep(0); // the warning is emitted on the next tick
    expect(warnings).toEqual(['SOORMA_CLOCK_SKEW']); // B's lineage warns once
    await a.start();
    await sleep(0);
    expect(warnings).toEqual(['SOORMA_CLOCK_SKEW', 'SOORMA_CLOCK_SKEW']); // and A's once
    expect(b.credential.agent).toBe('agent-b');
    expect(a.credential.agent).toBe('agent-a');
    expect(b.credential.environment).toEqual(stack.environment);
    expect(a.credential.environment).toEqual(stack.environment);

    // Step 3: B renews once, from the real S3: held until R_min after the bootstrap.
    const bootstrapped = b.credential.expiresAt;
    const startedAt = performance.now();
    expect(await until(() => b.credential.expiresAt !== bootstrapped, LIMITS.R_min + 30_000)).toBe(
      true,
    );
    const renewedAt = performance.now();
    expect(renewedAt - startedAt).toBeGreaterThanOrEqual(LIMITS.R_min - 1_000);
    const renewed = b.credential.expiresAt;
    expect(Date.parse(renewed)).toBeGreaterThan(Date.parse(bootstrapped));
    // No second renewal before R_min on the monotonic clock (1 s less the poll's lag).
    expect(await until(() => b.credential.expiresAt !== renewed, LIMITS.R_min - 1_000)).toBe(false);
    // The renewal warned no more: once per lineage.
    expect(warnings).toEqual(['SOORMA_CLOCK_SKEW', 'SOORMA_CLOCK_SKEW']);

    // Step 4: the real Date again.
    vi.useRealTimers();

    // Step 5: a decoy span, active while B subscribes and runs its loop (TH-E2E-03).
    const tracer = trace.getTracer('scenario');
    const decoy = tracer.startSpan('decoy');
    const decoyCtx: Context = trace.setSpan(context.active(), decoy);
    const items: { kind: string }[] = [];
    const received: Delivery[] = [];
    const loop = context.with(decoyCtx, async () => {
      for await (const item of b.subscribe()) {
        items.push({ kind: item.kind });
        if (item.kind === 'delivery') received.push(item);
      }
    });
    expect(await until(() => items.some((i) => i.kind === 'streamStarted'), 15_000)).toBe(true);

    // Step 6: A publishes outside the decoy.
    const accepted = await a.publish(PAYLOAD);
    const sent = accepted.traceContext.traceparent;
    expect(sent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
    expect(trace.getSpan(context.active())).toBeUndefined();

    // Step 7: B receives it: the envelope carries A's draft's traceparent.
    const mine = (d: Delivery): boolean => d.envelope.traceContext?.traceparent === sent;
    expect(await until(() => received.some(mine), 15_000)).toBe(true);
    const delivery = received.find(mine) as Delivery;
    expect(delivery.envelope).toBeTypeOf('object');
    expect(delivery.seal).toBeTypeOf('string');
    expect(delivery.seal.length).toBeGreaterThan(0);
    expect(delivery.payloadParsed).toBe(true);
    expect(delivery.payload).toEqual(PAYLOAD);

    // Step 8: one trace across the hop; the decoy neither parent nor linked.
    decoy.end();
    const spans = (): ReadableSpan[] => exporter.getFinishedSpans();
    const traceId = traceIdOf(sent);
    const isReceive = (s: ReadableSpan): boolean =>
      s.spanContext().traceId === traceId && s.name === 'receive';
    expect(await until(() => spans().some(isReceive), 5_000)).toBe(true);
    const send = spans().filter((s) => s.spanContext().traceId === traceId && s.name === 'send');
    expect(send).toHaveLength(1);
    const sendSpanId = send[0]?.spanContext().spanId;
    expect(sendSpanId).toBe(spanIdOf(sent));
    const receives = spans().filter(isReceive);
    const decoyId = decoy.spanContext();
    for (const r of receives) {
      expect(r.parentSpanContext?.spanId).toBe(sendSpanId);
      expect(r.parentSpanContext?.traceId).toBe(traceId);
      expect(r.parentSpanContext?.spanId).not.toBe(decoyId.spanId);
      expect(
        r.links.some(
          (l) => l.context.spanId === decoyId.spanId || l.context.traceId === decoyId.traceId,
        ),
      ).toBe(false);
    }

    // Step 9: close both; nothing is left open.
    await Promise.all([b.close(), a.close()]);
    await loop;
    expect(await until(() => openSockets() <= socketsBefore, 5_000)).toBe(true);
  }, 180_000);
});
