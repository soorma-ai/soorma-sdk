// SPDX-License-Identifier: Apache-2.0
//
// G2: the named values and the values hook (plan 1.1), the errors' safe forms
// (NFR-U3-12; TC-TH-021), the every-member-optional Envelope (CDI-04;
// TC-TH-069), the generated types (NFR-U3-20), and the source check that
// nothing published imports the values hook.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ClientStateError,
  ProblemError,
  SecretSourceError,
  SoormaError,
  TransportError,
  type Envelope,
} from './index.ts';
import { setTestValues } from './internal/test-values.ts';
import { captureLimits, D_LANG, LIMITS } from './limits.ts';

const SRC = import.meta.dirname;
const ROOT = resolve(SRC, '..', '..');

/** An import or dynamic import of the hook; comments that name it do not count. */
const IMPORTS_HOOK = /(?:from|import\s*\()\s*['"][^'"]*internal\/test-values(?:\.ts|\.js)?['"]/;

function sources(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === 'generated'
        ? []
        : sources(join(dir, e.name))
      : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')
        ? [join(dir, e.name)]
        : [],
  );
}

describe('the named values (NFR-U3-06)', () => {
  afterEach(() => setTestValues(undefined));

  it('are NFR Requirements’ values', () => {
    expect(LIMITS).toEqual({
      H_renew: 120_000,
      R_min: 30_000,
      R_max: 5,
      W_max: 60_000,
      B_init: 500,
      B_factor: 2,
      B_cap: 10_000,
      L_ends: 5,
      W_super: 10_000,
      N_buf: 64,
      T_idle: 45_000,
      T_req: 10_000,
      // Added at U4 (RCV-09; class 1: items added to this exact check).
      L_event: 1_048_576,
      B_body: 1_048_576,
    });
    expect(D_LANG).toBe(512);
  });

  it('take the hook’s values only once set, captured at construction (plan 1.1)', () => {
    expect(captureLimits()).toEqual(LIMITS);
    setTestValues({ T_idle: 1500, R_min: 1 });
    const captured = captureLimits();
    setTestValues(undefined);
    expect(captured).toEqual({ ...LIMITS, T_idle: 1500, R_min: 1 });
    expect(captureLimits()).toEqual(LIMITS);
  });
});

describe('the source checks', () => {
  it('nothing in src/ but the hook itself imports internal/test-values (plan 1.1)', () => {
    const importers = sources()
      .filter((f) => !f.endsWith(join('internal', 'test-values.ts')))
      .filter((f) => IMPORTS_HOOK.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f));
    expect(importers).toEqual([]);
  });

  it('the generated types are the vendored generator’s, byte for byte (NFR-U3-20)', () => {
    for (const f of ['components.ts', 'data-gateway.ts', 'event-ingest.ts']) {
      expect(readFileSync(join(SRC, 'generated', f), 'utf8'), f).toBe(
        readFileSync(join(ROOT, 'contract', 'generated', f), 'utf8'),
      );
    }
    // No S1 or S2 type (NEV-01; I6).
    expect(readdirSync(join(SRC, 'generated')).sort()).toEqual([
      'components.ts',
      'data-gateway.ts',
      'event-ingest.ts',
    ]);
  });
});

describe('the errors (NFR-U3-12)', () => {
  const secret = 'soorma_rs_SECRET_VALUE_never_shown';
  const all: SoormaError[] = [
    new ProblemError({
      status: 503,
      code: 'unavailable',
      title: 't',
      detail: 'd',
      retryAfter: 2,
      problem: { code: 'unavailable', status: 503 },
    }),
    new TransportError('tls'),
    new SecretSourceError('readable-by-others', '/run/secret'),
    new ClientStateError('revoked', new ProblemError({ status: 401, code: 'credential_refused' })),
  ];

  it('name only status, code, reason, path and state', () => {
    expect(all.map((e) => e.message)).toEqual([
      '503 unavailable',
      'transport: tls',
      'secret source: readable-by-others: /run/secret',
      'client is revoked',
    ]);
    expect(all.map((e) => e.name)).toEqual([
      'ProblemError',
      'TransportError',
      'SecretSourceError',
      'ClientStateError',
    ]);
    for (const e of all) expect(e).toBeInstanceOf(SoormaError);
  });

  it('hold no secret in their message, JSON or inspect forms', () => {
    for (const e of all) {
      for (const text of [e.message, String(e), JSON.stringify(e), inspect(e)]) {
        expect(text).not.toContain(secret);
      }
    }
  });
});

describe('the Envelope type (CDI-04; RCV-08; TC-TH-069)', () => {
  it('makes every member optional, so tenant code must check before use', () => {
    const e: Envelope = {};
    // Never called: the typecheck is the assertion.
    const unchecked = (env: Envelope): number =>
      // @ts-expect-error: eventId may be absent; the SDK checks no member.
      env.eventId.length;
    expect(typeof unchecked).toBe('function');
    const checked = typeof e.eventId === 'string' ? e.eventId.length : 0;
    expect(checked).toBe(0);
  });
});
