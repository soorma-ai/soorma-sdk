// SPDX-License-Identifier: Apache-2.0
//
// TC-TH-071 (TH-LIFE-02, -03): a child process starts a client against U1's
// stub, leaves a `for await` over its subscription, and ends its script
// without closing the client. Leaving the loop closes the stream, and the
// renewal timer is unref'd, so the process exits at once.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  makeCerts,
  makeRunDir,
  removeRunDir,
  type Certs,
} from '../../conformance/runner/src/rundir.ts';
import type { StubControl } from '../../conformance/runner/src/types.ts';
import { startStub } from '../../conformance/stub/src/stub.ts';

let dir = '';
let certs: Certs;
let stub: StubControl;

beforeAll(async () => {
  dir = makeRunDir();
  certs = makeCerts(dir);
  stub = await startStub(certs);
}, 30_000);
afterAll(async () => {
  await stub.stop();
  removeRunDir(dir);
});

const CHILD = `
const { AgentClient } = await import(process.env.SDK_INDEX);
const client = new AgentClient({
  dataGatewayUrl: process.env.S3_URL,
  eventIngestUrl: process.env.S4_URL,
  caFile: process.env.CA_FILE,
  agent: 'agent-a',
  instance: 'instance-1',
  secret: async () => 'soorma_rs_exit-test',
});
await client.start();
for await (const item of client.subscribe()) {
  if (item.kind === 'delivery') break;
}
process.stdout.write('left ' + performance.now() + '\\n');
process.on('exit', () => process.stdout.write('exit ' + performance.now() + '\\n'));
`;

it('leaving the loop, without closing the client, lets the process exit (TC-TH-071)', async () => {
  stub.load(
    {
      exchanges: [
        {
          match: { listener: 'S3', method: 'POST', path: '/agent-credentials' },
          respond: {
            status: 200,
            json: {
              credential: 'soorma_ac_token.one',
              agent: 'agent-a',
              environment: { organization: 'o1', project: 'p1', environment: 'e1' },
              instance: 'instance-1',
              expiresAt: new Date(Date.now() + 600_000).toISOString(),
            },
          },
        },
        {
          match: { listener: 'S4', method: 'POST', path: '/subscriptions' },
          respond: {
            stream: [{ delivery: { fixture: 'delivery/valid/sample.json' } }, { hold: true }],
          },
        },
      ],
    },
    {
      urls: stub.urls,
      caFile: certs.caFile,
      secretBase64: '',
      secret: '',
      files: {},
      values: {},
      depthBound: 512,
      start: Date.now(),
    },
  );
  const child = spawn(process.execPath, ['--input-type=module', '-e', CHILD], {
    env: {
      ...process.env,
      SDK_INDEX: pathToFileURL(join(import.meta.dirname, 'index.ts')).href,
      S3_URL: stub.urls.S3,
      S4_URL: stub.urls.S4,
      CA_FILE: certs.caFile,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stdout.on('data', (c: Buffer) => (out += c.toString()));
  child.stderr.on('data', (c: Buffer) => (err += c.toString()));
  const code = await new Promise<number | null>((resolve) => {
    const kill = setTimeout(() => child.kill('SIGKILL'), 10_000);
    child.on('exit', (c) => {
      clearTimeout(kill);
      resolve(c);
    });
  });
  expect({ code, err }).toEqual({ code: 0, err: '' });
  const left = Number(/left ([\d.]+)/.exec(out)?.[1]);
  const exited = Number(/exit ([\d.]+)/.exec(out)?.[1]);
  expect(exited - left).toBeLessThan(1000);
  const streams = stub.streams();
  expect(streams).toHaveLength(1);
  expect(streams[0]?.closedBy).toBe('client');
}, 30_000);
