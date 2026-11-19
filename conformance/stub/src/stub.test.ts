// SPDX-License-Identifier: Apache-2.0
//
// The stub: loopback only, byte-exact recording, `refuse` before sending,
// `reset` after reading the whole request, SSE actions in order, unmatched
// requests failed, and the untrusted listener's certificate.
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeCerts, makeRunDir, removeRunDir, type Certs } from '../../runner/src/rundir.ts';
import type { StubControl } from '../../runner/src/types.ts';
import { atSend, deepPayload } from './delivery.ts';
import { startStub } from './stub.ts';

let dir = '';
let certs: Certs;
let stub: StubControl;
let ca: Buffer;

beforeAll(async () => {
  dir = makeRunDir();
  certs = makeCerts(dir);
  ca = readFileSync(certs.caFile);
  stub = await startStub(certs);
}, 30_000);
afterAll(async () => {
  await stub.stop();
  removeRunDir(dir);
});

interface Res {
  status?: number;
  text?: string;
  error?: string;
}
function send(base: string, path: string, body?: string, trust: Buffer = ca): Promise<Res> {
  return new Promise((done) => {
    const u = new URL(path, base);
    const req = request(
      {
        host: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        ca: trust,
        agent: false,
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (text += c));
        res.on('end', () => done({ status: res.statusCode ?? 0, text }));
        res.on('error', (e) => done({ error: e.message }));
      },
    );
    req.on('error', (e) => done({ error: (e as NodeJS.ErrnoException).code ?? e.message }));
    req.end(body);
  });
}

const blank = {
  urls: {} as never,
  caFile: '',
  secretBase64: '',
  secret: '',
  files: {},
  values: {},
  depthBound: 0,
  start: 0,
};

describe('the stub', () => {
  it('listens on loopback only', () => {
    for (const url of Object.values(stub.urls)) expect(new URL(url).hostname).toBe('127.0.0.1');
  });

  it('records request bodies byte for byte, and answers as scripted', async () => {
    stub.load(
      {
        exchanges: [
          {
            label: 'boot',
            match: { listener: 'S3', path: '/agent-credentials' },
            respond: { status: 200, json: { credential: 'c' } },
          },
        ],
      },
      blank,
    );
    const body = '{ "agent" : "a",\n "n": 1.0, "s": "\\u00e9" }';
    const r = await send(stub.urls.S3, '/agent-credentials', body);
    expect(r).toEqual({ status: 200, text: '{"credential":"c"}' });
    expect(stub.recording()[0]?.body.toString('utf8')).toBe(body);
    expect(stub.recording()[0]?.label).toBe('boot');
  });

  it('fails an unscripted request with 500, marked unmatched', async () => {
    stub.load({ exchanges: [] }, blank);
    expect((await send(stub.urls.S4, '/events', '{}')).status).toBe(500);
    expect(stub.recording()[0]?.unmatched).toBe(true);
  });

  it('refuses connections before anything is sent, then serves', async () => {
    stub.load(
      {
        listeners: { S3: { refuse: 2 } },
        exchanges: [{ match: { path: '/x' }, respond: { status: 204 } }],
      },
      blank,
    );
    expect((await send(stub.urls.S3, '/x', '{}')).error).toBeDefined();
    expect((await send(stub.urls.S3, '/x', '{}')).error).toBeDefined();
    expect(stub.recording()).toHaveLength(0);
    expect((await send(stub.urls.S3, '/x', '{}')).status).toBe(204);
    expect(stub.recording()).toHaveLength(1);
  });

  it('resets after reading the whole request: recorded, unanswered', async () => {
    stub.load(
      {
        exchanges: [
          { match: { path: '/agent-credentials/current/renewal' }, respond: { reset: true } },
        ],
      },
      blank,
    );
    const r = await send(stub.urls.S3, '/agent-credentials/current/renewal', '');
    expect(r.error).toBeDefined();
    expect(stub.recording()).toHaveLength(1);
    expect(stub.recording()[0]?.answered).toBe(false);
  });

  it('streams SSE actions in order, Deliveries as exact text', async () => {
    const env = '{ "b":1.0 ,"a":"x" }';
    stub.load(
      {
        exchanges: [
          {
            label: 'sub',
            match: { path: '/subscriptions' },
            respond: {
              stream: [
                {
                  delivery: {
                    label: 'd1',
                    envelope: { text: env },
                    seal: 's1',
                    payload: { deep: 3 },
                    order: ['payload', 'seal', 'envelope'],
                  },
                },
                { heartbeat: true },
                { end: 'superseded' },
              ],
            },
          },
        ],
      },
      blank,
    );
    const r = await send(stub.urls.S4, '/subscriptions', '{}');
    expect(r.status).toBe(200);
    expect(r.text).toBe(
      `event: delivery\ndata: {"payload":${deepPayload(3)},"seal":"s1","envelope":${env}}\n\n: heartbeat\n\nevent: end\ndata: {"code":"superseded"}\n\n`,
    );
    expect(stub.deliveries()).toEqual([
      { label: 'd1', line: expect.any(String), envelopeText: env, seal: 's1' },
    ]);
    expect(stub.streams()[0]?.label).toBe('sub');
  });

  it('holds a stream until another request arrives (waitFor)', async () => {
    stub.load(
      {
        exchanges: [
          {
            match: { path: '/subscriptions' },
            respond: {
              stream: [
                { waitFor: { match: { path: '/events' }, timeoutMs: 5000 } },
                { end: 'unavailable' },
              ],
            },
          },
          { match: { path: '/events' }, respond: { status: 202 } },
        ],
      },
      blank,
    );
    const pending = send(stub.urls.S4, '/subscriptions', '{}');
    await new Promise((r) => setTimeout(r, 200));
    expect((await send(stub.urls.S4, '/events', '{}')).status).toBe(202);
    expect((await pending).text).toBe('event: end\ndata: {"code":"unavailable"}\n\n');
  });

  it('serves the untrusted listener a certificate the run CA does not trust', async () => {
    stub.load({ exchanges: [{ match: { path: '/x' }, respond: { status: 204 } }] }, blank);
    const r = await send(stub.urls.UNTRUSTED, '/x', '{}');
    expect(r.error).toMatch(/SELF_SIGNED|UNABLE_TO_VERIFY|CERT/);
    expect(stub.recording()).toHaveLength(0);
    expect(
      (await send(stub.urls.UNTRUSTED, '/x', '{}', readFileSync(certs.untrustedCaFile))).status,
    ).toBe(204);
  });
});

// Added at U3 (CC-REN-06): a time relative to the moment the stub sends.
describe('$expiresIn', () => {
  it('becomes the ISO time that far after the send, and leaves everything else as it was', () => {
    const now = Date.parse('2026-11-19T07:00:00.000Z');
    expect(
      atSend({ credential: 'c', expiresAt: { $expiresIn: 1500 }, list: [{ $expiresIn: 0 }] }, now),
    ).toEqual({
      credential: 'c',
      expiresAt: '2026-11-19T07:00:01.500Z',
      list: ['2026-11-19T07:00:00.000Z'],
    });
    const plain = { a: 1, b: { c: [true, null, 'x'] }, d: { $expiresIn: 'not a number' } };
    expect(atSend(plain, now)).toEqual(plain);
  });
});
