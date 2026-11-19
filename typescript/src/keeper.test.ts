// SPDX-License-Identifier: Apache-2.0
//
// The keeper with the transport's post mocked and fake timers (P-02, P-03, P-05,
// P-08): bootstrap and the provider per attempt (SEC-01 as reworded; TC-TH-079),
// REN-07's floor and warning (TC-TH-072, 075), CDI-06's renewal retry on a
// skewed lineage (TC-TH-076), REN-03 to REN-06, revocation and GAP-CAC-001.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientStateError, ProblemError } from './errors.ts';
import { LIMITS, type Limits } from './limits.ts';

type Reply = { status: number; headers: Record<string, string>; body: string };
const calls: { path: string; body?: string; auth?: string }[] = [];
let replies: ((path: string) => Reply | Promise<Reply>)[] = [];

vi.mock('./transport.ts', async (orig) => {
  const real = await orig<typeof import('./transport.ts')>();
  return {
    ...real,
    post: vi.fn(async (spec: { path: string; body?: string; headers: Record<string, string> }) => {
      calls.push({
        path: spec.path,
        ...(spec.body === undefined ? {} : { body: spec.body }),
        ...(spec.headers.authorization ? { auth: spec.headers.authorization } : {}),
      });
      const next = replies.shift();
      if (!next) throw new Error(`no scripted reply for ${spec.path}`);
      return next(spec.path);
    }),
  };
});

const { Keeper, CLOCK_SKEW_CODE, parseCredential } = await import('./keeper.ts');

const iso = (ms: number) => new Date(ms).toISOString();
const cred = (token: string, expiresAt: number): Reply => ({
  status: 200,
  headers: {},
  body: JSON.stringify({
    credential: token,
    agent: 'agent-a',
    instance: 'i-1',
    environment: { organization: 'o1', project: 'p1', environment: 'e' },
    expiresAt: iso(expiresAt),
  }),
});
const problem = (status: number, code: string, retryAfter?: string): Reply => ({
  status,
  headers: retryAfter ? { 'retry-after': retryAfter } : {},
  body: JSON.stringify({ type: `urn:soorma:problem:${code}`, title: code, status, code }),
});

let providerCalls = 0;
let warnings: string[] = [];
const onWarning = (w: Error & { code?: string | undefined }) => warnings.push(w.code ?? '');

function keeper(limits: Partial<Limits> = {}) {
  return new Keeper({
    s3: 'https://s3.test',
    agent: 'agent-a',
    instance: 'i-1',
    secret: async () => {
      providerCalls++;
      return `soorma_rs_secret-${providerCalls}`;
    },
    limits: { ...LIMITS, ...limits },
    ca: () => [],
    signal: new AbortController().signal,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(Date.parse('2026-11-19T08:00:00Z'));
  calls.length = 0;
  replies = [];
  providerCalls = 0;
  warnings = [];
  vi.spyOn(process, 'emitWarning').mockImplementation(((w: string, o: { code?: string }) =>
    onWarning(Object.assign(new Error(w), { code: o?.code }))) as typeof process.emitWarning);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const now = () => Date.now();
const MIN = 60_000;

describe('bootstrap (ACQ; SEC-01; P-08)', () => {
  it('sends exactly agent, secret and instance, and holds the credential', async () => {
    replies = [() => cred('soorma_ac_one', now() + 15 * MIN)];
    const k = keeper();
    await k.bootstrap();
    expect(calls).toEqual([
      {
        path: '/agent-credentials',
        body: '{"agent":"agent-a","secret":"soorma_rs_secret-1","instance":"i-1"}',
      },
    ]);
    expect(k.details?.environment.environment).toBe('e');
    expect(k.isUsable()).toBe(true);
    await k.stop();
  });

  it('calls the provider once per attempt on a retried bootstrap (TC-TH-079)', async () => {
    replies = [
      () => problem(503, 'unavailable', '1'),
      () => cred('soorma_ac_one', now() + 15 * MIN),
    ];
    const k = keeper();
    const p = k.bootstrap();
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect([providerCalls, calls.length]).toEqual([2, 2]);
    expect(calls[1]?.body).toContain('soorma_rs_secret-2');
    await k.stop();
  });

  it('does not retry authentication_failed', async () => {
    replies = [() => problem(403, 'authentication_failed')];
    const e = await keeper()
      .bootstrap()
      .catch((x: unknown) => x);
    expect((e as ProblemError).code).toBe('authentication_failed');
    expect(providerCalls).toBe(1);
  });
});

describe('the credential response (ACQ-08; CDI-04)', () => {
  it('keeps the environment as sent, unknown members included (CC-CRD-01)', () => {
    const c = parseCredential(
      JSON.stringify({
        credential: 'soorma_ac_x',
        agent: 'a',
        instance: 'a-1',
        environment: { organization: 'o', project: 'p', environment: 'e', region: 'r' },
        expiresAt: '2026-11-19T08:15:00Z',
      }),
    );
    expect(c.details.environment).toEqual({
      organization: 'o',
      project: 'p',
      environment: 'e',
      region: 'r',
    });
    expect(Object.isFrozen(c.details.environment)).toBe(true);
  });
});

describe('renewal (REN-01 to REN-07; P-03)', () => {
  it('renews H_renew before expiry, never sooner than R_min, with the bearer and no body', async () => {
    replies = [
      () => cred('soorma_ac_one', now() + 15 * MIN),
      () => cred('soorma_ac_two', now() + 15 * MIN),
    ];
    const k = keeper();
    await k.bootstrap();
    await vi.advanceTimersByTimeAsync(13 * MIN - 1);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2);
    expect(calls[1]).toEqual({
      path: '/agent-credentials/current/renewal',
      auth: 'Bearer soorma_ac_one',
    });
    expect(warnings).toEqual([]);
    await k.stop();
  });

  it('a credential already due: renewals at least R_min apart, one warning (TC-TH-072)', async () => {
    const due = () => cred('soorma_ac_x', now() + 60_000); // inside H_renew (120 s)
    replies = [due, due, due, due];
    const k = keeper();
    await k.bootstrap();
    expect(warnings).toEqual([CLOCK_SKEW_CODE]);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls).toHaveLength(3);
    expect(warnings).toEqual([CLOCK_SKEW_CODE]);
    await k.stop();
  });

  it('after the warning, S3 judges expiry: no bootstrap before an operation; credential_expired bootstraps once (TC-TH-075)', async () => {
    replies = [() => cred('soorma_ac_one', now() - MIN)]; // already past on this clock
    const k = keeper();
    await k.bootstrap();
    expect(k.isUsable()).toBe(true);
    expect(await k.token()).toBe('soorma_ac_one');
    expect(await k.token()).toBe('soorma_ac_one');
    expect(providerCalls).toBe(1);
    replies = [
      () => problem(401, 'credential_expired'),
      () => cred('soorma_ac_two', now() + 15 * MIN),
    ];
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls.map((c) => c.path)).toEqual([
      '/agent-credentials',
      '/agent-credentials/current/renewal',
      '/agent-credentials',
    ]);
    expect(await k.token()).toBe('soorma_ac_two');
    expect(providerCalls).toBe(2);
    expect(warnings).toEqual([CLOCK_SKEW_CODE]);
    await k.stop();
  });

  it('CDI-06: on a skewed lineage a 503 on renewal is retried, without a bootstrap (TC-TH-076)', async () => {
    replies = [() => cred('soorma_ac_one', now() - MIN)];
    const k = keeper();
    await k.bootstrap();
    replies = [
      () => problem(503, 'unavailable', '1'),
      () => cred('soorma_ac_two', now() + 15 * MIN),
    ];
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.map((c) => c.path)).toEqual([
      '/agent-credentials',
      '/agent-credentials/current/renewal',
      '/agent-credentials/current/renewal',
    ]);
    expect(providerCalls).toBe(1);
    expect(await k.token()).toBe('soorma_ac_two');
    await k.stop();
  });

  it('without a warning, an unrenewed expiry makes the next operation bootstrap (REN-06)', async () => {
    replies = [() => cred('soorma_ac_one', now() + 15 * MIN)];
    const k = keeper();
    await k.bootstrap();
    vi.setSystemTime(now() + 16 * MIN); // the wall clock moves past expiry; no timer fired
    expect(k.isUsable()).toBe(false);
    replies = [() => cred('soorma_ac_two', now() + 15 * MIN)];
    expect(await k.token()).toBe('soorma_ac_two');
    expect(providerCalls).toBe(2);
    await k.stop();
  });

  it('a renewal with no later expiry starts a new lineage (REN-03)', async () => {
    const exp = now() + 15 * MIN;
    replies = [
      () => cred('soorma_ac_one', exp),
      () => cred('soorma_ac_two', exp),
      () => cred('soorma_ac_three', now() + 15 * MIN),
    ];
    const k = keeper();
    await k.bootstrap();
    await vi.advanceTimersByTimeAsync(13 * MIN);
    expect(calls.map((c) => c.path)).toEqual([
      '/agent-credentials',
      '/agent-credentials/current/renewal',
      '/agent-credentials',
    ]);
    expect(await k.token()).toBe('soorma_ac_three');
    await k.stop();
  });

  it('credential_refused is terminal, also on a retried renewal (REN-05; GAP-CAC-001)', async () => {
    replies = [() => cred('soorma_ac_one', now() + 15 * MIN)];
    const k = keeper();
    let revoked = '';
    k.onCredential({ credential: () => undefined, revoked: (p) => (revoked = p.code ?? '') });
    await k.bootstrap();
    replies = [() => problem(503, 'unavailable', '1'), () => problem(401, 'credential_refused')];
    await vi.advanceTimersByTimeAsync(13 * MIN + 1000);
    expect(revoked).toBe('credential_refused');
    const e = await k.token().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ClientStateError);
    expect((e as ClientStateError).problem?.code).toBe('credential_refused');
    expect(providerCalls).toBe(1);
  });
});
