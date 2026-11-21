// SPDX-License-Identifier: Apache-2.0
//
// The shared pieces: soorma-core's stack values and the limits (GEN-05;
// TS-U2-11), child commands under a time limit (GEN-07; TC-ES-023's runner
// part), one raw call (GEN-04; NFR-U2-11; TC-ES-022's call part), and the
// contract's response schemas (PS-02; NFR-U2-20).
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  makeCerts,
  makeRunDir,
  removeRunDir,
  type Certs,
} from '../../conformance/runner/src/rundir.ts';
import { mustRun, runChild, StepFailure } from './child.ts';
import { checkResponse, responseSchema } from './contract-ops.ts';
import { call, CallError, CallTimeout, failureLine } from './https.ts';
import { ENDPOINTS, formatLimit, LIMITS, readPin, REPOSITORY_ROOT, STACK } from './stack.ts';

const FIXTURES = join(REPOSITORY_ROOT, 'contract', 'fixtures', '0.1.0');
const fixture = (p: string): unknown => JSON.parse(readFileSync(join(FIXTURES, p), 'utf8'));
const PATH = process.env.PATH ?? '';
const node = process.execPath;

describe('the stack values and the limits', () => {
  it('are soorma-core local stack values at the tag (GEN-05)', () => {
    expect(STACK).toEqual({
      organization: 'o1',
      project: 'p1',
      environment: 'e',
      principal: 'h@example.com',
      composeProject: 'soorma-local',
      ports: { s1: 8441, s2: 8442, s3: 8444, s4: 8446 },
    });
    expect(ENDPOINTS).toEqual({
      s1: 'https://localhost:8441',
      s2: 'https://localhost:8442',
      s3: 'https://localhost:8444',
      s4: 'https://localhost:8446',
    });
  });

  it('are exactly TS-U2-11', () => {
    expect(LIMITS).toEqual({
      call: 30_000,
      clone: 180_000,
      install: 360_000,
      build: 300_000,
      stackInit: 120_000,
      stackUp: 300_000,
      logs: 60_000,
      down: 180_000,
      other: 30_000,
      killGrace: 10_000,
    });
    expect([formatLimit(30_000), formatLimit(180_000), formatLimit(250)]).toEqual([
      '30 s',
      '3 min',
      '250 ms',
    ]);
  });

  it('reads the tag and commit from contract.pin.json only', () => {
    expect(readPin(REPOSITORY_ROOT)).toEqual({
      repository: 'https://github.com/soorma-ai/soorma-core',
      tag: 'contract-v0.1.0+core.2',
      commit: '0405e2a96a9389cab45e67312de903fd42f5d01e',
    });
  });
});

describe('a child command under a time limit (GEN-07)', () => {
  const quick = { limitMs: 300, killGraceMs: 300, path: PATH };

  it('passes no shell and only the listed environment', async () => {
    process.env.E2E_TEST_SHOULD_NOT_PASS = 'x';
    const r = await runChild(
      node,
      ['-e', 'process.stdout.write(JSON.stringify(Object.keys(process.env).sort()))'],
      { step: 'env', limitMs: 5_000, killGraceMs: 300, path: PATH, prependPath: '/opt/core-node' },
    );
    delete process.env.E2E_TEST_SHOULD_NOT_PASS;
    const keys = JSON.parse(r.stdout) as string[];
    expect(keys).not.toContain('E2E_TEST_SHOULD_NOT_PASS');
    expect(keys).toContain('PATH');
    const path = await runChild(node, ['-e', 'process.stdout.write(process.env.PATH)'], {
      step: 'path',
      limitMs: 5_000,
      killGraceMs: 300,
      path: '/usr/bin',
      prependPath: '/opt/core-node',
    });
    expect(path.stdout).toBe('/opt/core-node:/usr/bin');
  });

  it('stops a command that never ends, naming the step', async () => {
    const started = Date.now();
    await expect(
      mustRun('core-up', node, ['-e', 'setInterval(() => {}, 1000)'], {
        step: 'docker build org-gateway',
        ...quick,
      }),
    ).rejects.toThrow(new StepFailure('core-up: docker build org-gateway timed out after 300 ms'));
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it('kills one that ignores SIGTERM after the grace period', async () => {
    const r = await runChild(
      node,
      ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
      { step: 'hang', ...quick },
    );
    expect(r.timedOut).toBe(true);
    expect(r.signal).toBe('SIGKILL');
  });

  it('fails a non-zero exit with one line, and output only when asked', async () => {
    const args = ['-e', "console.log('out'); process.exit(3)"];
    await expect(
      mustRun('core-up', node, args, { step: 'git clone', ...quick, limitMs: 5_000 }),
    ).rejects.toThrow(new StepFailure('core-up: git clone failed (exit 3)'));
    await expect(
      mustRun('core-up', node, args, {
        step: 'git clone',
        ...quick,
        limitMs: 5_000,
        showOutput: true,
      }),
    ).rejects.toThrow(new StepFailure('core-up: git clone failed (exit 3)\nout'));
  });
});

describe('one raw call (GEN-04; GEN-07)', () => {
  let dir: string;
  let certs: Certs;
  let ca: string;
  const servers: Server[] = [];

  const serve = async (
    keyFile: string,
    certFile: string,
    handler: Parameters<typeof createServer>[1],
  ): Promise<string> => {
    const server = createServer(
      { key: readFileSync(keyFile), cert: readFileSync(certFile) },
      handler,
    );
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    return `https://localhost:${(server.address() as AddressInfo).port}`;
  };

  beforeAll(() => {
    dir = makeRunDir();
    certs = makeCerts(dir);
    ca = readFileSync(certs.caFile, 'utf8');
  });
  afterAll(() => {
    for (const s of servers) {
      s.closeAllConnections();
      s.close();
    }
    removeRunDir(dir);
  });

  it('sends the contract version and the bearer credential, and reads status, request id and body', async () => {
    let seen: Record<string, string | string[] | undefined> = {};
    let sent = '';
    const base = await serve(certs.serverKey, certs.serverCert, (req, res) => {
      seen = req.headers;
      req.on('data', (b: Buffer) => (sent += b.toString()));
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json', 'soorma-request-id': 'req-1' });
        res.end('{"ok":true}');
      });
    });
    const r = await call({
      step: 's',
      base,
      path: '/x',
      ca,
      credential: 'tok',
      body: { a: 1 },
      limitMs: 5_000,
    });
    expect(r).toEqual({ status: 200, requestId: 'req-1', body: { ok: true } });
    expect(seen['soorma-contract-version']).toBe('0.1.0');
    expect(seen.authorization).toBe('Bearer tok');
    expect(JSON.parse(sent)).toEqual({ a: 1 });
  });

  it('times out a server that accepts and never answers, naming the step', async () => {
    const base = await serve(certs.serverKey, certs.serverCert, () => {
      // Never answers.
    });
    const started = Date.now();
    const error = await call({
      step: 'registerAgent agent-b',
      base,
      path: '/registrations',
      ca,
      body: {},
      limitMs: 300,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CallTimeout);
    expect((error as Error).message).toBe('registerAgent agent-b timed out after 300 ms');
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it('refuses a server whose certificate is from another CA (NFR-U2-11)', async () => {
    const base = await serve(certs.untrustedKey, certs.untrustedCert, (_req, res) => res.end());
    const error = await call({ step: 's', base, path: '/', ca, limitMs: 5_000 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(CallError);
  });

  it('reduces a failure to step, status, Problem code and request id (ST-12)', () => {
    expect(
      failureLine('setup', 'registerAgent agent-b', {
        status: 503,
        requestId: 'r-9',
        body: { code: 'unavailable', detail: 'never printed' },
      }),
    ).toBe('setup: registerAgent agent-b failed: 503 unavailable (request r-9)');
    expect(failureLine('setup', 's', { status: 500, requestId: 'bad id\n', body: 'x' })).toBe(
      'setup: s failed: 500 - (request -)',
    );
  });
});

describe("the contract's response schemas (PS-02; NFR-U2-20)", () => {
  it("resolves each operation's success response and the refusals", () => {
    expect(
      [
        ['firstAuthenticate', 200],
        ['issueEnvironmentCredential', 200],
        ['grantToHuman', 200],
        ['registerAgent', 200],
        ['issueRegistrationSecret', 200],
        ['endEnvironmentCredential', 204],
        ['endEnvironmentCredential', 401],
        ['endSignIn', 204],
        ['endSignIn', 401],
        ['exchangeBootstrap', 200],
        ['registerAgent', 503],
      ].map(([op, status]) => responseSchema(op as string, status as number)),
    ).toEqual([
      'org-gateway#FirstAuthenticateResponse',
      'control-gateway#EnvironmentCredentialResponse',
      'control-gateway#Grant',
      'control-gateway#Registration',
      'control-gateway#RegistrationSecret',
      null,
      'Problem',
      null,
      'Problem',
      'data-gateway#AgentCredential',
      'Problem',
    ]);
  });

  it("accepts the contract's own samples and refuses a wrong body", () => {
    expect(
      checkResponse(
        'firstAuthenticate',
        200,
        fixture('org-gateway/FirstAuthenticateResponse/valid/with-sign-in.json'),
      ),
    ).toEqual([]);
    expect(
      checkResponse(
        'exchangeBootstrap',
        200,
        fixture('data-gateway/AgentCredential/valid/sample.json'),
      ),
    ).toEqual([]);
    expect(checkResponse('exchangeBootstrap', 200, { token: 1 })).not.toEqual([]);
    expect(checkResponse('endSignIn', 204, undefined)).toEqual([]);
    expect(checkResponse('endSignIn', 204, {})).toEqual([
      'endSignIn 204: the contract declares no body',
    ]);
    expect(checkResponse('endSignIn', 401, undefined)).toEqual([
      'endSignIn 401: body missing (Problem)',
    ]);
  });

  it('refuses a status or an operation the contract does not declare', () => {
    expect(() => responseSchema('endSignIn', 200)).toThrow(
      'contract: endSignIn declares no 200 response',
    );
    expect(() => responseSchema('noSuchOperation', 200)).toThrow(
      'contract: no operation noSuchOperation',
    );
  });
});
