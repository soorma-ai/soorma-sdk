// SPDX-License-Identifier: Apache-2.0
//
// setup and prove-stack against a fake S1, S2 and S3 that follows the
// contract's end semantics and checks every request and response against the
// contract (NFR-U2-20): TC-ES-004, 006 and 007's unit parts, TC-ES-005's unit
// part, TC-ES-019, TC-ES-020, TC-ES-022, NFR-U2-11 (another CA), and the
// command-line entries' fixed values (plan 1.1).
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startFakeStack, type FakeStack } from '../test-fixtures/fake-stack.ts';
import { print, proveStackOptions, setupOptions, UsageError } from './cli/options.ts';
import { call } from './https.ts';
import { proveStack } from './prove-stack.ts';
import { checkAgents, checkSecretsDir, setup, type SetupOptions } from './setup.ts';
import { CLONE, ENDPOINTS, layout, LIMITS, readPin, REPOSITORY_ROOT } from './stack.ts';

const PIN = readPin(REPOSITORY_ROOT);
const SLOW = { timeout: 30_000 };

let fake: FakeStack;
let root: string;
let lines: string[];
const l = () => layout(root);
const limits = { ...LIMITS, call: 2_000 };

function options(over: Partial<SetupOptions> = {}): SetupOptions {
  return {
    repositoryRoot: REPOSITORY_ROOT,
    root,
    agents: ['agent-a', 'agent-b'],
    endpoints: { s1: fake.base, s2: fake.base, s3: fake.base, s4: 'https://localhost:8446' },
    caFile: fake.caFile,
    handoverFile: join(root, 'handover.txt'),
    limits,
    print: (line) => lines.push(line),
    ...over,
  };
}
const prove = () => proveStack({ root, limits, print: (line) => lines.push(line) });

/** A fresh stack: the marker core-up writes last. */
function freshStack(): void {
  mkdirSync(l().dir, { recursive: true, mode: 0o700 });
  writeFileSync(l().marker, 'now\n', { mode: 0o600 });
}

const ops = (): string[] =>
  fake.calls.map((c) => `${c.operation}${c.agent ? ` ${c.agent}` : ''} ${c.status}`);

/** Every file under the working root, with its content. */
function allFiles(dir = root): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...allFiles(p));
    else out.push({ path: p, text: readFileSync(p, 'utf8') });
  }
  return out;
}

/**
 * GEN-02: no secret or credential the fake issued or received (K, the
 * enrollment material, the sign-in, the environment credential, each
 * registration secret and agent credential) appears in the output, or in any
 * file except an agent's own secret file holding exactly its own secret.
 */
function expectNoSecretLeaked(): void {
  const secrets = fake.secrets();
  expect(secrets.length).toBeGreaterThan(0);
  const out = lines.join('\n');
  for (const s of secrets) expect(out).not.toContain(s);
  for (const f of allFiles()) {
    if (f.path === join(root, 'handover.txt')) continue; // soorma-core's file, the test's copy
    const own = f.path.endsWith('.secret') ? f.text : undefined;
    for (const s of secrets) if (s !== own) expect(f.text).not.toContain(s);
  }
}

beforeEach(async () => {
  fake = await startFakeStack();
  root = mkdtempSync(join(tmpdir(), 'soorma-e2e-setup-'));
  writeFileSync(
    join(root, 'handover.txt'),
    `principal: h@example.com\nenrollmentMaterial: ${fake.enrollmentMaterial}\n`,
  );
  lines = [];
});
afterEach(async () => {
  await fake.close();
  rmSync(root, { recursive: true, force: true });
});

describe('setup and prove-stack on a fresh stack', SLOW, () => {
  it('TC-ES-004, 006, 007 (unit): registers both agents, ends both credentials, writes only secret files', async () => {
    freshStack();
    expect(await setup(options())).toBe(0);
    expect(ops()).toEqual([
      'firstAuthenticate 200',
      'issueEnvironmentCredential 200',
      'grantToHuman 200',
      'registerAgent agent-a 200',
      'issueRegistrationSecret agent-a 200',
      'registerAgent agent-b 200',
      'issueRegistrationSecret agent-b 200',
      'endEnvironmentCredential 204',
      'endEnvironmentCredential 401',
      'endSignIn 204',
      'endSignIn 401',
    ]);
    // One sign-in only, the one first authentication returned (ST-06).
    expect(fake.calls.some((c) => c.operation === 'authenticate')).toBe(false);
    expect(fake.calls.find((c) => c.operation === 'issueEnvironmentCredential')?.credential).toBe(
      'sign-in',
    );
    expect(fake.live()).toEqual({ signIns: 0, environmentCredentials: 0 });
    expect(fake.contractErrors).toEqual([]);
    expect(existsSync(l().marker)).toBe(false);

    expect(statSync(l().secrets).mode & 0o777).toBe(0o700);
    for (const a of ['agent-a', 'agent-b']) {
      const f = join(l().secrets, `${a}.secret`);
      expect(statSync(f).mode & 0o777).toBe(0o600);
      expect(readFileSync(f, 'utf8')).toMatch(/^soorma_rs_[A-Za-z0-9_-]+$/);
    }
    expect(statSync(l().stack).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(l().stack, 'utf8'))).toEqual({
      contractVersion: '0.1.0',
      soormaCore: { tag: PIN.tag, commit: PIN.commit },
      environment: { organization: 'o1', project: 'p1', environment: 'e' },
      s3: fake.base,
      s4: 'https://localhost:8446',
      ca: fake.caFile,
      agents: [
        { agent: 'agent-a', secretFile: join(l().secrets, 'agent-a.secret') },
        { agent: 'agent-b', secretFile: join(l().secrets, 'agent-b.secret') },
      ],
    });
    expect(lines.slice(-7)).toEqual([
      'setup: environment o1/p1/e',
      `setup: s3 ${fake.base}`,
      'setup: s4 https://localhost:8446',
      `setup: ca ${fake.caFile}`,
      `setup: agent agent-a ${join(l().secrets, 'agent-a.secret')}`,
      `setup: agent agent-b ${join(l().secrets, 'agent-b.secret')}`,
      `setup: stack description ${l().stack}`,
    ]);

    expect(await prove()).toBe(0);
    expect(lines.slice(-2)).toEqual([
      'prove-stack: agent-a: 200 pass',
      'prove-stack: agent-b: 200 pass',
    ]);
    expect(ops().slice(-2)).toEqual([
      'exchangeBootstrap agent-a 200',
      'exchangeBootstrap agent-b 200',
    ]);
    expect(fake.contractErrors).toEqual([]);
    expectNoSecretLeaked();
  });

  it('TC-ES-005 (unit): refuses without the marker, before any call; one setup per stack', async () => {
    expect(await setup(options())).toBe(1);
    expect(lines).toEqual(['setup: refused: no fresh stack: run core-down, then core-up']);
    expect(fake.calls).toEqual([]);
    freshStack();
    expect(await setup(options({ agents: ['agent-a'] }))).toBe(0);
    lines = [];
    expect(await setup(options({ agents: ['agent-b'] }))).toBe(1);
    expect(lines).toEqual(['setup: refused: no fresh stack: run core-down, then core-up']);
  });

  it('TC-ES-020: stops at the first failed call, prints only step, status, code and request id, and ends what it opened', async () => {
    freshStack();
    fake.fault({ operation: 'registerAgent', agent: 'agent-b', status: 503, code: 'unavailable' });
    expect(await setup(options())).toBe(1);
    expect(ops()).toEqual([
      'firstAuthenticate 200',
      'issueEnvironmentCredential 200',
      'grantToHuman 200',
      'registerAgent agent-a 200',
      'issueRegistrationSecret agent-a 200',
      'registerAgent agent-b 503',
      'endEnvironmentCredential 204',
      'endEnvironmentCredential 401',
      'endSignIn 204',
      'endSignIn 401',
    ]);
    const failure = lines.filter((x) => x.includes('failed'));
    expect(failure[0]).toMatch(
      /^setup: registerAgent agent-b failed: 503 unavailable \(request [0-9a-f]{12}\)$/,
    );
    expect(lines.at(-1)).toBe('setup: failed: no retry; run core-down, then core-up');
    expect(
      fake.calls.filter((c) => c.operation === 'registerAgent' && c.agent === 'agent-b'),
    ).toHaveLength(1);
    expect(fake.calls.some((c) => c.operation === 'authenticate')).toBe(false);
    expect(fake.live()).toEqual({ signIns: 0, environmentCredentials: 0 });
    expect(fake.contractErrors).toEqual([]);
    expect(existsSync(l().stack)).toBe(false);
    expectNoSecretLeaked();
  });

  it('TC-ES-022: a call that never answers times out with its name; the ends and refusal checks still run', async () => {
    freshStack();
    fake.fault({ operation: 'registerAgent', agent: 'agent-b', hang: true });
    expect(await setup(options({ limits: { ...limits, call: 300 } }))).toBe(1);
    expect(lines).toContain('setup: registerAgent agent-b timed out after 300 ms');
    expect(ops().slice(-5)).toEqual([
      'registerAgent agent-b no answer',
      'endEnvironmentCredential 204',
      'endEnvironmentCredential 401',
      'endSignIn 204',
      'endSignIn 401',
    ]);
    expect(fake.live()).toEqual({ signIns: 0, environmentCredentials: 0 });
    expect(fake.contractErrors).toEqual([]);
  });

  it('TC-ES-022: prove-stack against an S3 that never answers fails, naming the step', async () => {
    freshStack();
    expect(await setup(options({ agents: ['agent-a'] }))).toBe(0);
    lines = [];
    fake.fault({ operation: 'exchangeBootstrap', hang: true });
    expect(
      await proveStack({ root, limits: { ...limits, call: 300 }, print: (x) => lines.push(x) }),
    ).toBe(1);
    expect(lines).toEqual([
      'prove-stack: exchangeBootstrap agent-a timed out after 300 ms',
      'prove-stack: agent-a: - fail',
    ]);
  });

  it('NFR-U2-11: a server certificate from another CA is refused before anything is sent', async () => {
    freshStack();
    expect(await setup(options({ caFile: fake.otherCaFile }))).toBe(1);
    expect(lines[0]).toMatch(/^setup: firstAuthenticate failed: no response \(/);
    expect(fake.calls).toEqual([]);
  });
});

describe("NFR-U2-20: the fake's own contract check discriminates", () => {
  it('records a response it sent that the contract does not allow, and setup refuses it', async () => {
    freshStack();
    fake.fault({ operation: 'grantToHuman', status: 200, body: { permissions: 'all' } });
    expect(await setup(options())).toBe(1);
    expect(fake.contractErrors).toHaveLength(1);
    expect(fake.contractErrors[0]).toMatch(
      /^sent: grantToHuman 200: not a valid control-gateway#Grant/,
    );
    expect(lines).toContain(
      'setup: grantToHuman failed: the 200 response does not match the contract',
    );
    expect(fake.live()).toEqual({ signIns: 0, environmentCredentials: 0 });
  });

  it('records a request body the contract does not allow', async () => {
    await call({
      step: 'bad',
      base: fake.base,
      path: '/registrations',
      ca: readFileSync(fake.caFile, 'utf8'),
      body: { agent: 'not an id', standingPermissions: 'event:publish' },
      limitMs: 2_000,
    });
    expect(fake.contractErrors.some((e) => e.startsWith('received: registerAgent:'))).toBe(true);
  });
});

describe('TC-ES-019: setup refuses bad arguments before using the marker', () => {
  it.each([
    [[], 'at least one agent is required (--agents a,b)'],
    [['agent-a', ''], '"" is not a logical agent identifier'],
    [['-a'], '"-a" is not a logical agent identifier'],
    [['a b'], '"a b" is not a logical agent identifier'],
    [['x'.repeat(65)], `"${'x'.repeat(65)}" is not a logical agent identifier`],
    [['agent-a', 'agent-a'], 'the agent identifiers must be distinct'],
  ])('%j', async (agents, why) => {
    expect(checkAgents(agents)).toBe(why);
    freshStack();
    expect(await setup(options({ agents }))).toBe(1);
    expect(lines).toEqual([`setup: refused: ${why}`]);
    expect(existsSync(l().marker)).toBe(true);
    expect(fake.calls).toEqual([]);
  });

  it('accepts the contract’s identifier forms', () => {
    expect(checkAgents(['a', 'agent-a', 'a.1~x_y', 'x'.repeat(64)])).toBeUndefined();
  });

  const refusedDir = async (dir: string, why: string): Promise<void> => {
    freshStack();
    expect(await setup(options({ secretsDir: dir }))).toBe(1);
    expect(lines).toEqual([`setup: refused: the secrets directory ${dir} ${why}`]);
    expect(existsSync(l().marker)).toBe(true);
    expect(fake.calls).toEqual([]);
  };

  it('refuses a symbolic link, a file, a wrong mode, or an existing secret file', async () => {
    const real = join(root, 'real');
    mkdirSync(real, { mode: 0o700 });
    symlinkSync(real, join(root, 'link'));
    await refusedDir(join(root, 'link'), 'is a symbolic link');
    lines = [];
    writeFileSync(join(root, 'file'), '');
    await refusedDir(join(root, 'file'), 'is not a directory');
    lines = [];
    mkdirSync(join(root, 'open'));
    chmodSync(join(root, 'open'), 0o755);
    await refusedDir(join(root, 'open'), 'has mode 0755, not 0700');
    lines = [];
    writeFileSync(join(real, 'agent-a.secret'), 'old', { mode: 0o600 });
    await refusedDir(real, 'already holds agent-a.secret');
  });

  it('refuses a directory owned by another user (given another uid: no second local user exists)', () => {
    const stat = { isDirectory: () => true, isSymbolicLink: () => false, uid: 4242, mode: 0o40700 };
    expect(checkSecretsDir(stat, 501, [])).toBe('is owned by another user');
    expect(checkSecretsDir({ ...stat, uid: 501 }, 501, [])).toBeUndefined();
  });

  it('creates an absent secrets directory with mode 0700', async () => {
    freshStack();
    const dir = join(root, 'new-secrets');
    expect(await setup(options({ secretsDir: dir, agents: ['agent-a'] }))).toBe(0);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(JSON.parse(readFileSync(l().stack, 'utf8')).agents).toEqual([
      { agent: 'agent-a', secretFile: join(dir, 'agent-a.secret') },
    ]);
  });
});

describe('the command-line entries (plan 1.1)', () => {
  it('fix every value: the stack’s endpoints, the clone’s CA and handover file, the limits', () => {
    const clone = layout(REPOSITORY_ROOT).clone;
    expect(setupOptions(['--agents', 'agent-a,agent-b'], { PATH: '/usr/bin' })).toEqual({
      repositoryRoot: REPOSITORY_ROOT,
      root: REPOSITORY_ROOT,
      agents: ['agent-a', 'agent-b'],
      endpoints: ENDPOINTS,
      caFile: join(clone, CLONE.ca),
      handoverFile: join(clone, CLONE.handover, 'first-admin-1.txt'),
      limits: LIMITS,
      print,
    });
    expect(setupOptions(['--agents', 'a', '--secrets-dir', '/tmp/s'], {}).secretsDir).toBe(
      '/tmp/s',
    );
    expect(proveStackOptions([], {})).toEqual({ root: REPOSITORY_ROOT, limits: LIMITS, print });
  });

  it('take no other argument', () => {
    expect(() => setupOptions([], {})).toThrow(UsageError);
    expect(() => setupOptions(['--agents'], {})).toThrow(UsageError);
    expect(() => setupOptions(['--agents', 'a', '--ca', '/x'], {})).toThrow(UsageError);
    expect(() => setupOptions(['--agents', 'a', '--agents', 'b'], {})).toThrow(UsageError);
    expect(() => proveStackOptions(['--s3', 'x'], {})).toThrow(UsageError);
  });
});
