// SPDX-License-Identifier: Apache-2.0
//
// G5: the reader (P-09; TH-RD-01 to 05; TC-TH-068, 073) and the subscription
// supervisor (P-04) with the transport mocked and fake timers: events fed to
// the state machine, a paused stream outliving T_idle (TC-TH-077), a
// replacement with a full queue (TC-TH-078), W_super and a lineage change
// (STR-05), L_ends (STR-06), credential_refused (STR-07), failures before the
// stream opens (SUB-05), close() in every state leaving no timer and no stream
// (TH-LIFE-01, PRB-07), leaving a loop (TC-TH-071), and CDI-06's resubscribe on
// a skewed lineage without a bootstrap (completes TC-TH-076).
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Delivery } from './delivery.ts';
import { ClientStateError, ProblemError } from './errors.ts';
import { D_LANG, LIMITS, type Limits } from './limits.ts';
import type { DeliveryError } from './types.ts';

// ---- the transport, mocked ----

class FakeRes extends PassThrough {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  constructor(status = 200, headers: Record<string, string> = {}) {
    super();
    this.statusCode = status;
    this.headers = headers;
  }
}

type Spec = { path: string; body?: string; headers: Record<string, string>; signal?: AbortSignal };
const posts: { path: string; body?: string; auth?: string }[] = [];
let postReplies: (() => { status: number; headers: Record<string, string>; body: string })[] = [];
const opens: { auth?: string; body?: string }[] = [];
let streams: ((spec: Spec) => FakeRes | Promise<FakeRes>)[] = [];

vi.mock('./transport.ts', async (orig) => {
  const real = await orig<typeof import('./transport.ts')>();
  return {
    ...real,
    post: vi.fn(async (spec: Spec) => {
      posts.push({
        path: spec.path,
        ...(spec.body === undefined ? {} : { body: spec.body }),
        ...(spec.headers.authorization ? { auth: spec.headers.authorization } : {}),
      });
      const next = postReplies.shift();
      if (!next) throw new Error(`no scripted reply for ${spec.path}`);
      return next();
    }),
    openStream: vi.fn(async (spec: Spec) => {
      opens.push({
        ...(spec.headers.authorization ? { auth: spec.headers.authorization } : {}),
        ...(spec.body === undefined ? {} : { body: spec.body }),
      });
      const next = streams.shift();
      if (!next) throw new Error('no scripted stream');
      return next(spec);
    }),
  };
});

const { readDelivery } = await import('./reader.ts');
const { Subscription } = await import('./subscription.ts');
const { Keeper } = await import('./keeper.ts');
const { AgentClient } = await import('./client.ts');
type Sub = InstanceType<typeof Subscription>;
type Item = Awaited<ReturnType<AsyncIterator<unknown>['next']>>['value'];

// ---- helpers ----

const TP = `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`;
const line = (n: number | string, payload = `{"n":${JSON.stringify(n)}}`) =>
  `{"envelope":{"id":"e${n}","traceContext":{"traceparent":"${TP}"}},"seal":"s${n}","payload":${payload}}`;
const delivery = (n: number | string) => `event: delivery\ndata: ${line(n)}\n\n`;
const end = (code: string) => `event: end\ndata: {"code":"${code}"}\n\n`;
const problem = (status: number, code: string) =>
  JSON.stringify({ type: `urn:soorma:problem:${code}`, title: code, status, code });

/** A stream that answers 200 with these events written at once. */
function stream(...events: string[]): { res: FakeRes; reply: () => FakeRes } {
  const res = new FakeRes();
  for (const e of events) res.write(e);
  return { res, reply: () => res };
}
function refused(status: number, code: string): () => FakeRes {
  return () => {
    const r = new FakeRes(status);
    r.end(problem(status, code));
    return r;
  };
}
/** A subscribe that waits until it is aborted. */
const pending = (spec: Spec): Promise<FakeRes> =>
  new Promise((_, reject) =>
    spec.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
  );

const label = (i: Item): string => {
  const x = i as { kind: string; code?: string | null; terminal?: boolean; reason?: string };
  if (x.kind === 'streamStarted') return 'S';
  if (x.kind === 'streamEnded') return `E:${x.code ?? 'null'}${x.terminal ? ':T' : ''}`;
  if (x.kind === 'deliveryError') return `X:${x.reason ?? ''}`;
  return `D:${String((i as Delivery).envelope.id)}`;
};

async function take(it: AsyncIterator<unknown>, n: number): Promise<string[]> {
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const r = await it.next();
    out.push(r.done ? 'done' : label(r.value));
  }
  return out;
}

const flush = async (): Promise<void> => {
  for (let k = 0; k < 10; k++) await new Promise((r) => setImmediate(r));
};

interface FakeKeeper {
  tokens: number;
  noted: number;
  revoked: ProblemError | undefined;
  renew(lineageChanged: boolean): void;
}
function fakeKeeper(): FakeKeeper & Record<string, unknown> {
  const listeners: {
    credential(l: boolean): void;
    revoked(p: ProblemError): void;
  }[] = [];
  let n = 1;
  const k = {
    tokens: 0,
    noted: 0,
    revoked: undefined as ProblemError | undefined,
    token: async () => {
      k.tokens++;
      return `soorma_ac_${n}`;
    },
    onCredential(l: (typeof listeners)[number]) {
      listeners.push(l);
      return () => listeners.splice(listeners.indexOf(l), 1);
    },
    noteExpired: () => void k.noted++,
    revoke(p: ProblemError) {
      k.revoked = p;
      for (const l of [...listeners]) l.revoked(p);
    },
    renew(lineageChanged: boolean) {
      n++;
      for (const l of [...listeners]) l.credential(lineageChanged);
    },
    listenerCount: () => listeners.length,
  };
  return k;
}

const SMALL: Limits = {
  ...LIMITS,
  N_buf: 2,
  T_idle: 1000,
  W_super: 1000,
  B_init: 100,
  B_factor: 2,
  B_cap: 400,
  L_ends: 3,
  R_max: 3,
};

function subscription(keeper = fakeKeeper(), limits: Partial<Limits> = {}) {
  const forward = vi.fn();
  const sub = new Subscription({
    s4: 'https://s4.test',
    keeper: keeper as never,
    limits: { ...SMALL, ...limits },
    ca: () => [],
    forward,
  });
  return { sub, it: sub[Symbol.asyncIterator](), keeper, forward };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(Date.parse('2026-11-19T08:00:00Z'));
  posts.length = 0;
  opens.length = 0;
  postReplies = [];
  streams = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---- the reader ----

describe('the reader (TH-RD-01 to 05; P-09)', () => {
  const read = (l: string) => readDelivery(l);
  const reason = (l: string) => (read(l) as DeliveryError).reason;

  it('keeps the exact spans, parses the envelope from its own, and freezes it (RCV-02 to RCV-04)', () => {
    const l = '{ "seal" : "s1" , "envelope" : {"b": 1.50, "a" :[ 1e2 ]}, "payload": {"x":-0.0} }';
    const d = read(l) as Delivery;
    expect(d).toBeInstanceOf(Delivery);
    expect(d.envelopeText).toBe('{"b": 1.50, "a" :[ 1e2 ]}');
    expect(d.payloadText).toBe('{"x":-0.0}');
    expect(d.seal).toBe('s1');
    expect(d.envelope).toEqual({ b: 1.5, a: [100] });
    expect(Object.isFrozen(d.envelope) && Object.isFrozen(d.envelope.a)).toBe(true);
    expect([d.payloadParsed, d.payload]).toEqual([true, { x: -0 }]);
  });

  it('respects strings and escapes that look like structure', () => {
    const l = `{"envelope":{"k":"}],\\"\\\\\\u00e9{"},"seal":"a\\"b","payload":"[{"}`;
    const d = read(l) as Delivery;
    expect(d.envelope).toEqual({ k: '}],"\\é{' });
    expect([d.seal, d.payload]).toEqual(['a"b', '[{']);
  });

  it('a duplicate envelope, seal or payload is a delivery error; another duplicate is not (TC-TH-068)', () => {
    expect(reason('{"envelope":{},"envelope":{},"seal":"s","payload":1}')).toBe('duplicate-member');
    expect(reason('{"envelope":{},"seal":"s","seal":"t","payload":1}')).toBe('duplicate-member');
    expect(reason('{"envelope":{},"seal":"s","payload":1,"payload":2}')).toBe('duplicate-member');
    expect(read('{"x":1,"envelope":{},"x":2,"seal":"s","payload":1}')).toBeInstanceOf(Delivery);
  });

  it('an envelope deeper than D_lang is a delivery error (TC-TH-073)', () => {
    const deep = '['.repeat(D_LANG) + ']'.repeat(D_LANG);
    expect(read(`{"envelope":{"x":${deep}},"seal":"s","payload":1}`)).toMatchObject({
      kind: 'deliveryError',
      reason: 'envelope-too-deep',
    });
    expect(read(`{"envelope":{"x":${deep.slice(1, -1)}},"seal":"s","payload":1}`)).toBeInstanceOf(
      Delivery,
    );
  });

  it('a payload deeper than D_lang keeps the envelope, the seal and the text (RCV-06)', () => {
    const deep = '['.repeat(D_LANG + 1) + ']'.repeat(D_LANG + 1);
    const d = read(line(1, deep)) as Delivery;
    expect(d).toBeInstanceOf(Delivery);
    expect([d.payloadParsed, 'payload' in d, d.payloadText === deep, d.seal]).toEqual([
      false,
      false,
      true,
      's1',
    ]);
    const atBound = '['.repeat(D_LANG) + ']'.repeat(D_LANG);
    expect((read(line(2, atBound)) as Delivery).payloadParsed).toBe(true);
  });

  it('a hostile depth never exhausts the stack', () => {
    const huge = '['.repeat(200_000) + ']'.repeat(200_000);
    expect(
      reason(
        `{"envelope":${'{"a":'.repeat(100_000)}1${'}'.repeat(100_000)},"seal":"s","payload":1}`,
      ),
    ).toBe('envelope-too-deep');
    expect((read(line(3, huge)) as Delivery).payloadParsed).toBe(false);
    expect(reason(`{"envelope":{},"seal":"s","payload":${'['.repeat(200_000)}}`)).toBe('not-json');
  });

  it('refuses what is not a usable Delivery, with its reason and the line (RCV-07)', () => {
    const cases: [string, string][] = [
      ['not json', 'not-json'],
      ['{"envelope":{},"seal":"s","payload":1} x', 'not-json'],
      ['{"envelope":{},"seal":"s","payload":01}', 'not-json'],
      ['{"envelope":{},"seal":"s","payload":[1,]}', 'not-json'],
      ['{"envelope":{,},"seal":"s","payload":1}', 'not-json'],
      ['{"envelope":{},"seal":"s\u0001","payload":1}', 'not-json'],
      ['[1,2]', 'not-an-object'],
      ['{"seal":"s","payload":1}', 'missing-envelope'],
      ['{"envelope":[],"seal":"s","payload":1}', 'missing-envelope'],
      ['{"envelope":{},"seal":1,"payload":1}', 'missing-seal'],
      ['{"envelope":{},"seal":"s"}', 'missing-payload'],
    ];
    for (const [l, why] of cases)
      expect([l, read(l)]).toEqual([l, { kind: 'deliveryError', reason: why, text: l }]);
  });

  it('accepts every JSON value as a payload, and unknown envelope members', () => {
    for (const p of ['null', 'true', 'false', '-1.5e-3', '"x"', '[]', '{}', '[{"a":[null]}]']) {
      expect((read(line(1, p)) as Delivery).payloadText).toBe(p);
    }
    const d = read('{"envelope":{"futureMember":{"z":[1]}},"seal":"s","payload":1}') as Delivery;
    expect(d.envelope.futureMember).toEqual({ z: [1] });
  });
});

// ---- the subscription ----

describe('the subscription: items in order (SUB-01, SUB-02; STR-01 to STR-03, STR-06)', () => {
  it('stream started, Deliveries, heartbeats consumed, an end, then a new stream after backoff', async () => {
    const a = stream(
      ': heartbeat\n\n',
      delivery(1),
      ': hb\n\n',
      delivery(2),
      'event: delivery\ndata: nope\n\n',
      end('unavailable'),
    );
    const b = stream(delivery(3));
    streams = [a.reply, b.reply];
    const { sub, it } = subscription();
    expect(await take(it, 3)).toEqual(['S', 'D:e1', 'D:e2']);
    expect(await take(it, 2)).toEqual(['X:not-json', 'E:unavailable']);
    expect(opens).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(opens).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await take(it, 2)).toEqual(['S', 'D:e3']);
    expect(opens[1]?.auth).toBe('Bearer soorma_ac_1');
    expect(JSON.parse(opens[0]?.body ?? '')).toEqual({
      draft: {
        clientContractVersion: '0.1.0',
        traceContext: {
          traceparent: expect.stringMatching(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/),
        },
      },
    });
    await sub.close();
  });

  it('reads events split across chunks and CRLF line ends', async () => {
    const a = stream();
    streams = [a.reply];
    const { sub, it } = subscription();
    expect(await take(it, 1)).toEqual(['S']);
    const text = delivery(1).replace(/\n/g, '\r\n');
    for (const ch of text) a.res.write(ch);
    expect(await take(it, 1)).toEqual(['D:e1']);
    a.res.write('event: end\r\ndata: {"code":7}\r\n\r\n');
    expect(await take(it, 1)).toEqual(['E:null']);
    await sub.close();
  });

  it('a dropped connection, and an end with no data, end with no code', async () => {
    const a = stream(delivery(1));
    const b = stream('event: end\n\n');
    streams = [a.reply, b.reply];
    const { sub, it } = subscription();
    expect(await take(it, 2)).toEqual(['S', 'D:e1']);
    a.res.end();
    expect(await take(it, 1)).toEqual(['E:null']);
    await vi.advanceTimersByTimeAsync(100);
    expect(await take(it, 2)).toEqual(['S', 'E:null']);
    await sub.close();
  });

  it('consecutive ends with no Delivery reach L_ends: a terminal end with the last code (STR-06)', async () => {
    streams = [
      stream(end('unavailable')).reply,
      stream(end('overflow')).reply,
      stream(end('x-new')).reply,
    ];
    const { sub, it } = subscription();
    const p = take(it, 7);
    await vi.advanceTimersByTimeAsync(100 + 200);
    expect(await p).toEqual(['S', 'E:unavailable', 'S', 'E:overflow', 'S', 'E:x-new:T', 'done']);
    expect(opens).toHaveLength(3);
    expect(sub.active).toBe(false);
  });

  it('a Delivery resets the count of consecutive ends', async () => {
    streams = [
      stream(end('unavailable')).reply,
      stream(delivery(1), end('unavailable')).reply,
      stream(end('unavailable')).reply,
      stream(end('unavailable')).reply,
    ];
    const { it } = subscription();
    const p = take(it, 10);
    await vi.advanceTimersByTimeAsync(100 + 200 + 400 + 400);
    expect(await p).toEqual([
      'S',
      'E:unavailable',
      'S',
      'D:e1',
      'E:unavailable',
      'S',
      'E:unavailable',
      'S',
      'E:unavailable:T',
      'done',
    ]);
  });

  it('credential_refused as an end is terminal and revokes the client (STR-07)', async () => {
    streams = [stream(delivery(1), end('credential_refused')).reply];
    const { it, keeper } = subscription();
    expect(await take(it, 4)).toEqual(['S', 'D:e1', 'E:credential_refused:T', 'done']);
    expect(keeper.revoked?.code).toBe('credential_refused');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(opens).toHaveLength(1);
  });

  it('a revocation from a renewal ends an open stream terminally (REN-05)', async () => {
    const a = stream();
    streams = [a.reply];
    const { it, keeper } = subscription();
    expect(await take(it, 1)).toEqual(['S']);
    (keeper as unknown as { revoke(p: ProblemError): void }).revoke(
      new ProblemError({ status: 401, code: 'credential_refused' }),
    );
    expect(await take(it, 2)).toEqual(['E:credential_refused:T', 'done']);
    expect(a.res.destroyed).toBe(true);
  });
});

describe('the subscription: failures before the stream opens (SUB-05)', () => {
  it('a Problem is raised from the iterator, with no stream ended', async () => {
    streams = [refused(403, 'forbidden')];
    const { sub, it } = subscription();
    const e = await it.next().catch((x: unknown) => x);
    expect([e instanceof ProblemError, (e as ProblemError).status]).toEqual([true, 403]);
    expect(await it.next()).toEqual({ done: true, value: undefined });
    expect(sub.active).toBe(false);
  });

  it('credential_refused is raised and revokes; no further request', async () => {
    streams = [refused(401, 'credential_refused')];
    const { it, keeper } = subscription();
    const e = (await it.next().catch((x: unknown) => x)) as ProblemError;
    expect(e.code).toBe('credential_refused');
    expect(keeper.revoked).toBe(e);
    expect(opens).toHaveLength(1);
  });

  it('credential_expired: noted, then a new token and one more subscribe (REN-06)', async () => {
    streams = [refused(401, 'credential_expired'), stream().reply];
    const { sub, it, keeper } = subscription();
    expect(await take(it, 1)).toEqual(['S']);
    expect([keeper.noted, keeper.tokens, opens.length]).toEqual([1, 2, 2]);
    await sub.close();
  });

  it('503 is retried with Retry-After; a connection failure with backoff (PRB-05, PRB-08)', async () => {
    const { TransportFailure } = await import('./transport.ts');
    streams = [
      () => {
        const r = new FakeRes(503, { 'retry-after': '2' });
        r.end(problem(503, 'unavailable'));
        return r;
      },
      () => {
        throw new TransportFailure('connection', false);
      },
      stream().reply,
    ];
    const { sub, it } = subscription();
    const p = take(it, 1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(opens).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(opens).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(200);
    expect(await p).toEqual(['S']);
    expect(opens).toHaveLength(3);
    await sub.close();
  });
});

describe('the subscription: backpressure and T_idle (SUB-06; STR-02; TC-TH-077)', () => {
  it('a paused stream outlives T_idle; a resume restarts it', async () => {
    const a = stream(delivery(1), delivery(2), delivery(3), delivery(4), delivery(5));
    streams = [a.reply];
    const { sub, it } = subscription();
    await flush();
    await vi.advanceTimersByTimeAsync(5 * SMALL.T_idle);
    expect(opens).toHaveLength(1);
    expect(await take(it, 6)).toEqual(['S', 'D:e1', 'D:e2', 'D:e3', 'D:e4', 'D:e5']);
    await vi.advanceTimersByTimeAsync(SMALL.T_idle - 1);
    a.res.write(': heartbeat\n\n'); // reading: any bytes restart T_idle
    await flush();
    await vi.advanceTimersByTimeAsync(SMALL.T_idle - 1);
    a.res.write(delivery(6));
    expect(await take(it, 1)).toEqual(['D:e6']);
    await vi.advanceTimersByTimeAsync(SMALL.T_idle);
    expect(await take(it, 1)).toEqual(['E:null']);
    await sub.close();
  });

  it('reads no further than the queue allows', async () => {
    const a = stream(...Array.from({ length: 20 }, (_, k) => delivery(k)));
    streams = [a.reply];
    const { sub, it } = subscription();
    await flush();
    expect(a.res.isPaused()).toBe(true);
    expect(await take(it, 2)).toEqual(['S', 'D:e0']);
    await sub.close();
  });
});

describe('the subscription: replacement (STR-04, STR-05, STR-09)', () => {
  it('with a full queue: the old stream’s Deliveries, superseded, then the new stream’s (TC-TH-078)', async () => {
    const a = stream(delivery(1), delivery(2), delivery(3), delivery(4), end('superseded'));
    const b = stream(delivery(101), delivery(102));
    streams = [a.reply, b.reply];
    const { sub, it, keeper } = subscription();
    await flush();
    keeper.renew(false);
    await flush();
    expect(opens.map((o) => o.auth)).toEqual(['Bearer soorma_ac_1', 'Bearer soorma_ac_2']);
    expect(b.res.isPaused()).toBe(true);
    await vi.advanceTimersByTimeAsync(10 * SMALL.W_super); // the old stream is paused: W_super does not count
    expect(await take(it, 9)).toEqual([
      'S',
      'D:e1',
      'D:e2',
      'D:e3',
      'D:e4',
      'E:superseded',
      'S',
      'D:e101',
      'D:e102',
    ]);
    expect(a.res.destroyed).toBe(true);
    await sub.close();
  });

  it('the new stream is held until the old one ends; its Deliveries wait upstream', async () => {
    const a = stream(delivery(1));
    const b = stream(delivery(101));
    streams = [a.reply, b.reply];
    const { sub, it, keeper } = subscription({ ...fakeKeeper() } as never, { N_buf: 64 });
    expect(await take(it, 2)).toEqual(['S', 'D:e1']);
    (keeper as FakeKeeper).renew(false);
    await flush();
    expect(opens).toHaveLength(2);
    a.res.write(delivery(2));
    expect(await take(it, 1)).toEqual(['D:e2']);
    a.res.write(end('superseded'));
    expect(await take(it, 3)).toEqual(['E:superseded', 'S', 'D:e101']);
    await sub.close();
  });

  it('W_super, counted while the old stream is read: the SDK closes it itself', async () => {
    const a = stream();
    const b = stream(delivery(101));
    streams = [a.reply, b.reply];
    const { sub, it, keeper } = subscription();
    expect(await take(it, 1)).toEqual(['S']);
    keeper.renew(false);
    await flush();
    await vi.advanceTimersByTimeAsync(SMALL.W_super - 1);
    expect(a.res.destroyed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await take(it, 3)).toEqual(['E:null', 'S', 'D:e101']);
    expect(a.res.destroyed).toBe(true);
    await sub.close();
  });

  it('a lineage change closes the old stream as soon as the new one opens', async () => {
    const a = stream();
    const b = stream(delivery(101));
    streams = [a.reply, b.reply];
    const { sub, it, keeper } = subscription();
    expect(await take(it, 1)).toEqual(['S']);
    keeper.renew(true);
    expect(await take(it, 3)).toEqual(['E:null', 'S', 'D:e101']);
    expect(a.res.destroyed).toBe(true);
    await sub.close();
  });

  it('a credential during opening is used by a replacement once the stream opens', async () => {
    let release: (r: FakeRes) => void = () => undefined;
    const a = stream();
    const b = stream();
    streams = [() => new Promise<FakeRes>((r) => (release = r)), b.reply];
    const { sub, it, keeper } = subscription();
    await flush();
    keeper.renew(false);
    release(a.res);
    expect(await take(it, 1)).toEqual(['S']);
    await flush();
    expect(opens.map((o) => o.auth)).toEqual(['Bearer soorma_ac_1', 'Bearer soorma_ac_2']);
    await sub.close();
  });
});

describe('closing (SUB-07; TH-LIFE-01, -02; PRB-07)', () => {
  const states: [
    string,
    () => Promise<{ sub: Sub; it: AsyncIterator<unknown>; res: FakeRes[] }>,
  ][] = [
    [
      'opening',
      async () => {
        streams = [pending];
        const { sub, it } = subscription();
        await flush();
        return { sub, it, res: [] };
      },
    ],
    [
      'open',
      async () => {
        const a = stream();
        streams = [a.reply];
        const { sub, it } = subscription();
        await flush();
        return { sub, it, res: [a.res] };
      },
    ],
    [
      'backingOff',
      async () => {
        const a = stream(end('unavailable'));
        streams = [a.reply];
        const { sub, it } = subscription();
        await flush();
        return { sub, it, res: [a.res] };
      },
    ],
    [
      'replacing',
      async () => {
        const a = stream();
        const b = stream();
        streams = [a.reply, b.reply];
        const { sub, it, keeper } = subscription();
        await flush();
        keeper.renew(false);
        await flush();
        return { sub, it, res: [a.res, b.res] };
      },
    ],
  ];
  for (const [state, setUp] of states) {
    it(`close() while ${state}: a terminal end, then done, and nothing left`, async () => {
      const { sub, it, res } = await setUp();
      await Promise.all([sub.close(), sub.close()]);
      const items: string[] = [];
      for (;;) {
        const r = await it.next();
        if (r.done) break;
        items.push(label(r.value));
      }
      expect(items.at(-1)).toBe('E:null:T');
      expect(items.filter((i) => i.startsWith('E:'))).toHaveLength(state === 'backingOff' ? 2 : 1);
      expect(res.every((r) => r.destroyed)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      const before = opens.length;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(opens).toHaveLength(before);
      expect(sub.active).toBe(false);
    });
  }

  it('leaving a for await closes the subscription and its stream (TC-TH-071)', async () => {
    const a = stream(delivery(1), delivery(2));
    streams = [a.reply];
    const { sub, keeper } = subscription();
    for await (const item of sub) {
      if (item.kind === 'delivery') break;
    }
    expect([a.res.destroyed, sub.active, vi.getTimerCount()]).toEqual([true, false, 0]);
    expect((keeper as unknown as { listenerCount(): number }).listenerCount()).toBe(0);
  });

  it('await using closes it', async () => {
    const a = stream();
    streams = [a.reply];
    {
      await using sub = subscription().sub;
      await flush();
      expect(sub.active).toBe(true);
    }
    expect(a.res.destroyed).toBe(true);
  });
});

// ---- with the client and the real keeper ----

const cred = (token: string, expiresAt: number) => () => ({
  status: 200,
  headers: {},
  body: JSON.stringify({
    credential: token,
    agent: 'agent-a',
    instance: 'i-1',
    environment: { organization: 'o1', project: 'p1', environment: 'e' },
    expiresAt: new Date(expiresAt).toISOString(),
  }),
});

describe('with the keeper: CDI-06 (TC-TH-076)', () => {
  it('on a skewed lineage a dropped stream is resubscribed without a bootstrap', async () => {
    vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
    postReplies = [cred('soorma_ac_one', Date.now() - 60_000)];
    const keeper = new Keeper({
      s3: 'https://s3.test',
      agent: 'agent-a',
      instance: 'i-1',
      secret: async () => 'soorma_rs_x',
      limits: SMALL,
      ca: () => [],
      signal: new AbortController().signal,
    });
    await keeper.bootstrap();
    const a = stream();
    const b = stream(delivery(1));
    streams = [a.reply, b.reply];
    const sub = new Subscription({
      s4: 'https://s4.test',
      keeper,
      limits: SMALL,
      ca: () => [],
      forward: vi.fn(),
    });
    const it = sub[Symbol.asyncIterator]();
    expect(await take(it, 1)).toEqual(['S']);
    a.res.end(); // dropped
    expect(await take(it, 1)).toEqual(['E:null']);
    await vi.advanceTimersByTimeAsync(SMALL.B_init);
    expect(await take(it, 2)).toEqual(['S', 'D:e1']);
    expect(posts.map((p) => p.path)).toEqual(['/agent-credentials']);
    expect(opens.map((o) => o.auth)).toEqual(['Bearer soorma_ac_one', 'Bearer soorma_ac_one']);
    await sub.close();
    await keeper.stop();
  });
});

describe('with the client (SUB-04; FWD-01, FWD-02)', () => {
  async function started() {
    postReplies = [cred('soorma_ac_one', Date.now() + 15 * 60_000)];
    const c = new AgentClient({
      dataGatewayUrl: 'https://s3.test',
      eventIngestUrl: 'https://s4.test',
      agent: 'agent-a',
      instance: 'i-1',
      secret: async () => 'soorma_rs_x',
    });
    await c.start();
    return c;
  }

  it('one active subscription per client; another once it is closed', async () => {
    const c = await started();
    streams = [stream().reply, stream().reply];
    const s1 = c.subscribe();
    expect(() => c.subscribe()).toThrow(ClientStateError);
    await s1.close();
    const s2 = c.subscribe();
    await flush();
    expect(opens).toHaveLength(2);
    await c.close();
    expect(s2.active).toBe(false);
    expect(() => c.subscribe()).toThrow(ClientStateError);
  });

  it('a Delivery’s publish forwards: the envelope text spliced byte for byte', async () => {
    const c = await started();
    const env = '{ "id":"e1", "n": 1.50, "traceContext":{"traceparent":"' + TP + '"} }';
    streams = [
      stream(`event: delivery\ndata: {"envelope":${env},"seal":"sealed","payload":1}\n\n`).reply,
    ];
    const it = c.subscribe()[Symbol.asyncIterator]();
    const [, d] = [await it.next(), (await it.next()).value as Delivery];
    postReplies = [() => ({ status: 202, headers: {}, body: '' })];
    await d.publish({ ok: true });
    const body = posts.at(-1)?.body ?? '';
    expect(body).toContain(`"inbound":{"envelope":${env},"seal":"sealed"}`);
    expect(body).toContain('"payload":{"ok":true}');
    await c.close();
  });
});

// ---- RCV-09: the event bound (added at U4; the U3 defect fix, NFR-U4-38) ----

describe('an SSE event over L_event (RCV-09; TC-PH-089)', () => {
  const L = 4096;
  /** An event of many short data lines, at least `bytes`, without its blank line. */
  const bigEvent = (bytes: number): string[] => {
    const parts = ['event: delivery\n'];
    for (let n = 0; n * 100 < bytes; n++) parts.push(`data: ${'x'.repeat(93)}\n`);
    return parts;
  };
  /** A delivery event of exactly `bytes` bytes before its blank line. */
  const exactEvent = (bytes: number): string => {
    const head = (pad: string) => `event: delivery\ndata: ${line(7, JSON.stringify(pad))}`;
    const pad = 'p'.repeat(bytes - Buffer.byteLength(head('')));
    const event = head(pad);
    expect(Buffer.byteLength(event)).toBe(bytes);
    return `${event}\n\n`;
  };

  async function items(
    writes: string[],
    n: number,
  ): Promise<{ got: string[]; first?: DeliveryError }> {
    const res = new FakeRes();
    for (const w of writes) res.write(w);
    streams = [() => res];
    const { sub, it } = subscription(fakeKeeper(), { L_event: L });
    const got: string[] = [];
    let first: DeliveryError | undefined;
    for (let k = 0; k < n; k++) {
      const r = await it.next();
      const v = r.value as Item;
      if (!first && (v as { kind?: string }).kind === 'deliveryError') first = v as DeliveryError;
      got.push(r.done ? 'done' : label(v));
    }
    await sub.close();
    return { got, ...(first ? { first } : {}) };
  }

  it('arriving in many chunks of short lines, is one event-too-large, with no text; the next Delivery follows', async () => {
    const { got, first } = await items([...bigEvent(L * 4), '\n', delivery(1)], 3);
    expect(got).toEqual(['S', 'X:event-too-large', 'D:e1']);
    expect(first).toEqual({ kind: 'deliveryError', reason: 'event-too-large', text: '' });
  });

  it('arriving whole in one chunk, is the same', async () => {
    const { got } = await items([`${bigEvent(L * 2).join('')}\n${delivery(2)}`], 3);
    expect(got).toEqual(['S', 'X:event-too-large', 'D:e2']);
  });

  it('ends at its blank line even when that line is split across chunks', async () => {
    const { got } = await items([...bigEvent(L * 2), '\n', delivery(3)], 3);
    expect(got).toEqual(['S', 'X:event-too-large', 'D:e3']);
  });

  it('at exactly L_event is read; one byte more is not', async () => {
    const at = await items([exactEvent(L), delivery(4)], 3);
    expect(at.got).toEqual(['S', 'D:e7', 'D:e4']);
    const over = await items([exactEvent(L + 1), delivery(5)], 3);
    expect(over.got).toEqual(['S', 'X:event-too-large', 'D:e5']);
  });

  it('two oversized events in a row are two errors, and the stream continues', async () => {
    const big = [...bigEvent(L * 2), '\n'];
    const { got } = await items([...big, ...big, delivery(6)], 4);
    expect(got).toEqual(['S', 'X:event-too-large', 'X:event-too-large', 'D:e6']);
  });
});
