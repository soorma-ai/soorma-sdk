// SPDX-License-Identifier: Apache-2.0
//
// G3: fileSecret (TH-SEC; TC-TH-012 to 015, 067), the trust store (P-06;
// TC-TH-080), the retry table (P-01), and CDI-06's source check (P-02).
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProblemError, SecretSourceError, TransportError } from './errors.ts';
import { LIMITS } from './limits.ts';
import { retryable } from './retry.ts';
import { fileSecret, refusal } from './secrets.ts';
import { buildTrustStore, problemFrom, retryAfterSeconds, TransportFailure } from './transport.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'soorma-sdk-test-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const file = (name: string, text: string, mode: number): string => {
  const p = join(dir, name);
  writeFileSync(p, text);
  chmodSync(p, mode);
  return p;
};
const reason = (p: Promise<unknown>) =>
  p.then(
    () => 'read',
    (e: unknown) => (e instanceof SecretSourceError ? e.reason : 'other'),
  );

describe('fileSecret (TH-SEC-01 to 03)', () => {
  it('reads an owner-only file, removing one trailing line ending (TC-TH-012)', async () => {
    expect(await fileSecret(file('a', 'soorma_rs_x\n', 0o600))()).toBe('soorma_rs_x');
    expect(await fileSecret(file('b', 'soorma_rs_y\r\n\n', 0o400))()).toBe('soorma_rs_y\r\n');
  });

  it('allows a group read and follows a link chain to the final file (TC-TH-014)', async () => {
    const real = file('real', 's\n', 0o440);
    symlinkSync(real, join(dir, 'l1'));
    symlinkSync(join(dir, 'l1'), join(dir, 'l2'));
    expect(await fileSecret(join(dir, 'l2'))()).toBe('s');
  });

  it('refuses unsafe modes without reading (TC-TH-013)', async () => {
    expect(await reason(fileSecret(file('o', 's', 0o604))())).toBe('readable-by-others');
    expect(await reason(fileSecret(file('g', 's', 0o620))())).toBe('writable-by-group');
    expect(await reason(fileSecret(file('w', 's', 0o602))())).toBe('writable-by-others');
    expect(await reason(fileSecret(join(dir, 'missing'))())).toBe('unreadable');
  });

  it('refuses a named pipe without blocking (TC-TH-015)', async () => {
    const fifo = join(dir, 'fifo');
    execFileSync('mkfifo', ['-m', '600', fifo]);
    const started = performance.now();
    expect(await reason(fileSecret(fifo)())).toBe('not-regular-file');
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('refuses a file owned by another user (a pure check: no second user here)', () => {
    const st = { isFile: () => true, mode: 0o100600, uid: 4242 };
    expect(refusal(st, 501)).toBe('owned-by-another-user');
    expect(refusal({ ...st, uid: 0 }, 501)).toBeUndefined();
    expect(refusal({ ...st, uid: 501 }, 501)).toBeUndefined();
  });

  it('is refused on Windows without opening the path (TC-TH-067)', async () => {
    const real = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const e = await fileSecret(join(dir, 'never-opened'))().catch((x: unknown) => x);
      expect(e).toBeInstanceOf(SecretSourceError);
      expect((e as SecretSourceError).reason).toBe('unsupported-platform');
      expect((e as SecretSourceError).path).toBe(join(dir, 'never-opened'));
    } finally {
      Object.defineProperty(process, 'platform', { value: real });
    }
  });

  it('never puts the contents in the error', async () => {
    const e = (await fileSecret(file('x', 'soorma_rs_TOPSECRET', 0o644))().catch(
      (x: unknown) => x,
    )) as Error;
    expect(`${e.message} ${JSON.stringify(e)}`).not.toContain('TOPSECRET');
  });
});

describe('the trust store (P-06; TC-TH-080)', () => {
  it('holds the bundled certificates, with or without the system store', async () => {
    expect((await buildTrustStore(undefined)).length).toBeGreaterThan(100);
  });

  it('adds the CA file’s certificates', async () => {
    const ca = file(
      'ca.pem',
      '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n',
      0o644,
    );
    const base = await buildTrustStore(undefined);
    expect((await buildTrustStore(ca)).length).toBe(base.length + 1);
  });

  it('fails on a missing or non-PEM CA file, as TransportError ca-file', async () => {
    for (const p of [join(dir, 'missing.pem'), file('bad.pem', 'not a certificate', 0o644)]) {
      const e = await buildTrustStore(p).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(TransportError);
      expect((e as TransportError).reason).toBe('ca-file');
    }
  });
});

describe('Problems (PRB-01 to PRB-03; DEC-U1-14)', () => {
  it('keeps every member, and reads Retry-After', () => {
    const e = problemFrom({
      status: 503,
      headers: { 'retry-after': '2' },
      body: '{"type":"t","title":"x","status":503,"code":"unavailable","extra":1}',
    });
    expect([e.status, e.code, e.title, e.retryAfter, e.problem?.extra]).toEqual([
      503,
      'unavailable',
      'x',
      2,
      1,
    ]);
  });

  it('keeps no body that is not a Problem', () => {
    const e = problemFrom({ status: 500, headers: {}, body: '<html>secret?</html>' });
    expect([e.code, e.problem]).toEqual([null, undefined]);
    expect(retryAfterSeconds({})).toBeUndefined();
  });
});

describe('the retry table (P-01)', () => {
  const ctx = { limits: LIMITS };
  const p = (status: number) => new ProblemError({ status, code: null });
  it('retries 503 and connection failures; never TLS, 429, 4xx or 500', () => {
    for (const k of ['bootstrap', 'renewal', 'subscribe'] as const) {
      expect(retryable(k, p(503), ctx)).toBe(true);
      expect(retryable(k, new TransportFailure('connection', false), ctx)).toBe(true);
      expect(retryable(k, new TransportFailure('timeout', true), ctx)).toBe(true);
      expect(retryable(k, new TransportFailure('tls', false), ctx)).toBe(false);
      for (const s of [400, 401, 403, 429, 500]) expect(retryable(k, p(s), ctx)).toBe(false);
    }
  });
  it('retries a renewal only while the credential is usable (CDI-06)', () => {
    const unusable = { limits: LIMITS, usable: () => false };
    expect(retryable('renewal', p(503), unusable)).toBe(false);
    expect(retryable('renewal', new TransportFailure('timeout', true), unusable)).toBe(false);
    expect(retryable('bootstrap', p(503), unusable)).toBe(true);
  });
});

// CDI-06's source check: nothing but keeper.isUsable compares expiresAt with a
// clock read to decide validity.
const COMPARE =
  /(?:expiresAt[^;]*?[<>]=?[^;]*?(?:wallNow|Date\.now)\(\))|(?:(?:wallNow|Date\.now)\(\)[^;]*?[<>]=?[^;]*?expiresAt)/;

export function validityComparisons(text: string, file: string): string[] {
  const allowed = file.endsWith('keeper.ts') ? isUsableRange(text) : undefined;
  const out: string[] = [];
  text.split('\n').forEach((line, i) => {
    const code = line.replace(/=>/g, '').replace(/\/\/.*$/, '');
    if (!COMPARE.test(code)) return;
    if (allowed && i >= allowed[0] && i <= allowed[1]) return;
    out.push(`${file}:${i + 1}`);
  });
  return out;
}

function isUsableRange(text: string): [number, number] | undefined {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^\s+isUsable\(\): boolean \{/.test(l));
  if (start < 0) return undefined;
  const end = lines.findIndex((l, i) => i > start && /^ {2}\}$/.test(l));
  return [start, end];
}

describe('CDI-06: one validity check', () => {
  it('nothing but keeper.isUsable compares expiresAt with a clock read', () => {
    const src = import.meta.dirname;
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.startsWith('generated'))
      .map((f) => join(src, f));
    const found = files.flatMap((f) => validityComparisons(readFileSync(f, 'utf8'), f));
    expect(found).toEqual([]);
  });

  it('the check catches a comparison elsewhere', () => {
    expect(validityComparisons('if (wallNow() > held.expiresAt) bootstrap();', 'x.ts')).toEqual([
      'x.ts:1',
    ]);
    expect(validityComparisons('const ok = held.expiresAt >= Date.now();', 'y.ts')).toEqual([
      'y.ts:1',
    ]);
    expect(
      validityComparisons('const t = held.expiresAt - H - wallNow(); // schedule', 'z.ts'),
    ).toEqual([]);
  });
});
