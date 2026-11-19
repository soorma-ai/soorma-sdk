// SPDX-License-Identifier: Apache-2.0
//
// G4: the payload check (TH-PUB-01; TC-TH-070), drafts and publish bodies
// (DRF, PUB, FWD; TC-TH-023, 028 to 034), the options (TH-API; TC-TH-001, 004,
// 074), and the spans (TH-SPN; SPN-02 to SPN-07; DEC-U1-01, with the decoy).
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Reply = { status: number; headers: Record<string, string>; body: string };
const sent: { path: string; body?: string; headers: Record<string, string> }[] = [];
let replies: (() => Reply)[] = [];

vi.mock('./transport.ts', async (orig) => {
  const real = await orig<typeof import('./transport.ts')>();
  return {
    ...real,
    buildTrustStore: vi.fn(async () => []),
    post: vi.fn(async (spec: { path: string; body?: string; headers: Record<string, string> }) => {
      sent.push({
        path: spec.path,
        headers: spec.headers,
        ...(spec.body === undefined ? {} : { body: spec.body }),
      });
      const next = replies.shift();
      if (!next) throw new Error(`no scripted reply for ${spec.path}`);
      return next();
    }),
  };
});

const { AgentClient } = await import('./client.ts');
const { Delivery } = await import('./delivery.ts');
const { ClientStateError, ProblemError } = await import('./errors.ts');
const { payloadText } = await import('./json.ts');
const { draftText } = await import('./draft.ts');

const exporter = new InMemorySpanExporter();
beforeAll(() => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }),
  );
});

const OPTIONS = {
  dataGatewayUrl: 'https://s3.test',
  eventIngestUrl: 'https://s4.test',
  agent: 'agent-a',
  instance: 'i-1',
  secret: async () => 'soorma_rs_secret',
};
const credential: Reply = {
  status: 200,
  headers: {},
  body: JSON.stringify({
    credential: 'soorma_ac_one',
    agent: 'agent-a',
    instance: 'i-1',
    environment: { organization: 'o1', project: 'p1', environment: 'e' },
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  }),
};
const accepted: Reply = { status: 202, headers: {}, body: '' };
const TP = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
const ENVELOPE_TEXT = `{ "eventId" : "e-1",  "traceContext": {"traceparent":"${TP}"}, "z": 1.50 }`;

async function started() {
  replies = [() => credential];
  const c = new AgentClient(OPTIONS);
  await c.start();
  sent.length = 0;
  exporter.reset();
  return c;
}
const delivery = (c: InstanceType<typeof AgentClient>) =>
  new Delivery(
    {
      envelope: JSON.parse(ENVELOPE_TEXT),
      envelopeText: ENVELOPE_TEXT,
      seal: 'seal-1',
      payload: { k: 'v' },
      payloadText: '{"k":"v"}',
      payloadParsed: true,
    },
    (payload, inbound, tc) => c.forward(payload, inbound, tc),
  );

beforeEach(() => {
  sent.length = 0;
  replies = [];
});
afterEach(() => exporter.reset());

describe('the payload check (TH-PUB-01; TC-TH-070)', () => {
  const refused = (v: unknown) => {
    try {
      payloadText(v);
      return 'sent';
    } catch (e) {
      return (e as Error).message;
    }
  };
  it('refuses what JSON cannot carry exactly, naming the path and the kind, never the value', () => {
    expect(refused({ a: [1, Number.NaN] })).toBe(
      'payload $.a[1] is a non-finite number, which JSON cannot carry exactly',
    );
    expect(refused({ a: undefined })).toContain('$.a is undefined');
    expect(refused({ 'b c': () => 1 })).toContain('$["b c"] is a function');
    expect(refused([Symbol('s')])).toContain('$[0] is a symbol');
    expect(refused({ n: 10n })).toContain('$.n is a bigint');
    expect(refused({ d: new Date(0) })).toContain('$.d is not a plain object or array');
    expect(refused(new Map())).toContain('$ is not a plain object or array');
    const cyc: Record<string, unknown> = { x: 1 };
    cyc.self = cyc;
    expect(refused(cyc)).toContain('$.self is a cycle');
    expect(refused({ secret: Number.POSITIVE_INFINITY })).not.toContain('Infinity');
  });
  it('sends any JSON value as given, shared references included, with no escaping', () => {
    const shared = { k: 1 };
    expect(payloadText({ a: shared, b: shared, s: '<&>é' })).toBe(
      '{"a":{"k":1},"b":{"k":1},"s":"<&>é"}',
    );
  });
  it('does not limit depth on any platform: serialized iteratively (Step 25b)', () => {
    for (const depth of [5_120, 100_000, 2_000_000]) {
      let deep: unknown = 1;
      for (let i = 0; i < depth; i++) deep = [deep];
      expect(payloadText(deep)).toBe(`${'['.repeat(depth)}1${']'.repeat(depth)}`);
    }
  });

  it('gives what JSON.stringify gives, for every value the check accepts', () => {
    const values: unknown[] = [
      null,
      true,
      0,
      -1.5e-7,
      1e21,
      'a"b\\c\n\u2028<&>é\ud800',
      [],
      {},
      [1, 'x', null, [true, {}]],
      { 2: 'b', 1: 'a', z: [{ y: null }], 'k"q': 1, __proto__: null },
    ];
    for (const v of values) expect(payloadText(v)).toBe(JSON.stringify(v));
  });
});

describe('drafts (DRF-01, DRF-02; FWD-02, FWD-03)', () => {
  it('carry exactly the version and trace context, and inbound only when forwarding', () => {
    expect(draftText({ traceparent: TP })).toBe(
      `{"clientContractVersion":"0.1.0","traceContext":{"traceparent":"${TP}"}}`,
    );
    expect(
      draftText(
        { traceparent: TP, tracestate: 'a=1' },
        { envelopeText: ENVELOPE_TEXT, seal: 's"1' },
      ),
    ).toBe(
      `{"clientContractVersion":"0.1.0","traceContext":{"traceparent":"${TP}","tracestate":"a=1"},"inbound":{"envelope":${ENVELOPE_TEXT},"seal":"s\\"1"}}`,
    );
  });
});

describe('the client (TH-API; ACQ-07)', () => {
  it('contacts nothing when created, and refuses an unknown option or a non-https URL (TC-TH-001, 074)', () => {
    new AgentClient(OPTIONS);
    expect(sent).toEqual([]);
    expect(() => new AgentClient({ ...OPTIONS, rejectUnauthorized: false } as never)).toThrow(
      'AgentClient has no option "rejectUnauthorized"',
    );
    expect(() => new AgentClient({ ...OPTIONS, environment: 'e' } as never)).toThrow(TypeError);
    expect(() => new AgentClient({ ...OPTIONS, dataGatewayUrl: 'http://s3.test' })).toThrow(
      'must be https',
    );
    expect(JSON.stringify(new AgentClient(OPTIONS))).not.toContain('secret');
  });

  it('refuses operations before start, and a second start', async () => {
    const c = new AgentClient(OPTIONS);
    await expect(c.publish({})).rejects.toBeInstanceOf(ClientStateError);
    expect(() => c.credential).toThrow(ClientStateError);
    replies = [() => credential];
    await c.start();
    await expect(c.start()).rejects.toBeInstanceOf(ClientStateError);
    expect(c.credential.environment).toEqual({
      organization: 'o1',
      project: 'p1',
      environment: 'e',
    });
    await c.close();
    await expect(c.publish({})).rejects.toBeInstanceOf(ClientStateError);
  });
});

describe('publish and forward (PUB; FWD)', () => {
  it('publishes compact JSON with the draft, and reports accepted with the draft’s trace context', async () => {
    const c = await started();
    replies = [() => accepted];
    const r = await c.publish({ a: '<&>é' });
    expect(sent[0]?.path).toBe('/events');
    expect(sent[0]?.headers.authorization).toBe('Bearer soorma_ac_one');
    expect(sent[0]?.body).toBe(
      `{"draft":{"clientContractVersion":"0.1.0","traceContext":{"traceparent":"${r.traceContext.traceparent}"}},"payload":{"a":"<&>é"}}`,
    );
    await c.close();
  });

  it('never retries a publish, and surfaces the Problem', async () => {
    const c = await started();
    replies = [
      () => ({
        status: 503,
        headers: { 'retry-after': '1' },
        body: '{"status":503,"code":"unavailable"}',
      }),
    ];
    const e = await c.publish({}).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ProblemError);
    expect(sent).toHaveLength(1);
    await c.close();
  });

  it('a Delivery’s publish forwards the envelope text byte for byte, and the seal', async () => {
    const c = await started();
    replies = [() => accepted];
    await delivery(c).publish({ n: 1 });
    expect(sent[0]?.body).toContain(`"inbound":{"envelope":${ENVELOPE_TEXT},"seal":"seal-1"}`);
    await c.close();
  });
});

describe('spans (SPN-02 to SPN-04, SPN-07; DEC-U1-01)', () => {
  const tracer = () => trace.getTracer('test');

  it('a client publish is a child of tenant code’s active span (SPN-04)', async () => {
    const c = await started();
    replies = [() => accepted];
    const tenant = tracer().startSpan('tenant');
    const r = await context.with(trace.setSpan(context.active(), tenant), () => c.publish({}));
    tenant.end();
    const send = exporter.getFinishedSpans().find((s) => s.name === 'send');
    expect(send?.parentSpanContext?.spanId).toBe(tenant.spanContext().spanId);
    expect(r.traceContext.traceparent).toBe(
      `00-${send?.spanContext().traceId}-${send?.spanContext().spanId}-01`,
    );
    expect(send?.attributes).toEqual({
      'messaging.operation.type': 'send',
      'messaging.operation.name': 'send',
      'messaging.system': 'soorma',
    });
    await c.close();
  });

  it('a forward is a child of the received context, links the tenant span, not the received one', async () => {
    const c = await started();
    replies = [() => accepted];
    const tenant = tracer().startSpan('handler');
    await context.with(trace.setSpan(context.active(), tenant), () => delivery(c).publish({}));
    tenant.end();
    const send = exporter.getFinishedSpans().find((s) => s.name === 'send');
    expect(send?.spanContext().traceId).toBe(TP.split('-')[1]);
    expect(send?.parentSpanContext?.spanId).toBe(TP.split('-')[2]);
    expect(send?.links.map((l) => l.context.spanId)).toEqual([tenant.spanContext().spanId]);
    await c.close();
  });

  it('a receive span is a child of the received context and links nothing, even inside a decoy span', async () => {
    const { recordReceive } = await import('./tracing.ts');
    const decoy = tracer().startSpan('decoy');
    context.with(trace.setSpan(context.active(), decoy), () => recordReceive({ traceparent: TP }));
    decoy.end();
    const receive = exporter.getFinishedSpans().find((s) => s.name === 'receive');
    expect(receive?.spanContext().traceId).toBe(TP.split('-')[1]);
    expect(receive?.parentSpanContext?.spanId).toBe(TP.split('-')[2]);
    expect(receive?.parentSpanContext?.spanId).not.toBe(decoy.spanContext().spanId);
    expect(receive?.links).toEqual([]);
  });

  it('a failed publish records the error status and the Problem code (SPN-07)', async () => {
    const c = await started();
    replies = [
      () => ({ status: 413, headers: {}, body: '{"status":413,"code":"payload_too_large"}' }),
    ];
    await c.publish({}).catch(() => undefined);
    const send = exporter.getFinishedSpans().find((s) => s.name === 'send');
    expect(send?.status.code).toBe(2);
    expect(send?.attributes['error.type']).toBe('payload_too_large');
    await c.close();
  });

  it('without an OpenTelemetry SDK the draft still carries a valid traceparent (TRC-03)', async () => {
    const c = await started();
    trace.disable();
    replies = [() => accepted];
    const r = await c.publish({});
    expect(r.traceContext.traceparent).toMatch(
      /^00-(?!0{32})[0-9a-f]{32}-(?!0{16})[0-9a-f]{16}-00$/,
    );
    trace.setGlobalTracerProvider(
      new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }),
    );
    await c.close();
  });
});
