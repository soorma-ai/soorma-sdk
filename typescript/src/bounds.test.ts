// SPDX-License-Identifier: Apache-2.0
//
// RCV-09's body bound (added at U4; the U3 defect fix, NFR-U4-38; TC-PH-089):
// both non-stream body readers, `post` and `readReply`, against U1's stub,
// stop at B_body with TransportFailure 'response-too-large', never holding or
// reporting the bytes; a body within the bound is read whole; the failure is
// never retried.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  makeCerts,
  makeRunDir,
  removeRunDir,
  type Certs,
} from '../../conformance/runner/src/rundir.ts';
import type { StubControl } from '../../conformance/runner/src/types.ts';
import { startStub } from '../../conformance/stub/src/stub.ts';
import { LIMITS } from './limits.ts';
import { retryable } from './retry.ts';
import { openStream, post, readReply, TransportFailure } from './transport.ts';

let dir = '';
let certs: Certs;
let stub: StubControl;
let ca: string[] = [];

beforeAll(async () => {
  dir = makeRunDir();
  certs = makeCerts(dir);
  ca = [readFileSync(certs.caFile, 'utf8')];
  stub = await startStub(certs);
}, 30_000);
afterAll(async () => {
  await stub.stop();
  removeRunDir(dir);
});

const blank = {
  urls: { S3: '', S4: '', UNTRUSTED: '', STRAY: '' },
  caFile: '',
  secretBase64: '',
  secret: '',
  files: {},
  values: {},
  depthBound: 0,
  start: 0,
};
const BOUND = 64 * 1024;
const FILLER = 'secret-looking-filler';

function answer(path: string, bytes: number, status = 413): void {
  stub.load(
    {
      exchanges: [
        {
          match: { path },
          respond: {
            status,
            json: {
              type: 'urn:soorma:problem:payload_too_large',
              status,
              code: 'payload_too_large',
            },
            generate: { bytes, line: FILLER, member: 'detail' },
          },
        },
      ],
    },
    blank as never,
  );
}

const spec = (path: string) => ({
  base: stub.urls.S4,
  path,
  headers: {},
  body: '{}',
  ca,
  timeoutMs: 5000,
  maxBody: BOUND,
});

async function failure(p: Promise<unknown>): Promise<TransportFailure> {
  try {
    await p;
  } catch (e) {
    return e as TransportFailure;
  }
  throw new Error('expected a failure');
}

describe('B_body (RCV-09)', () => {
  it('is 1 MiB in NFR Requirements’ values', () => {
    expect(LIMITS.B_body).toBe(1_048_576);
    expect(LIMITS.L_event).toBe(1_048_576);
  });

  it('post: a body over the bound is response-too-large, holding none of it', async () => {
    answer('/events', BOUND * 4);
    const e = await failure(post(spec('/events')));
    expect(e).toBeInstanceOf(TransportFailure);
    expect(e.reason).toBe('response-too-large');
    expect(e.message).not.toContain(FILLER);
    expect(JSON.stringify(e)).not.toContain(FILLER);
  });

  it('post: a body within the bound is read whole', async () => {
    answer('/events', BOUND - 1024);
    const r = await post(spec('/events'));
    expect(r.status).toBe(413);
    expect(Buffer.byteLength(r.body)).toBeGreaterThanOrEqual(BOUND - 1024);
    expect(Buffer.byteLength(r.body)).toBeLessThanOrEqual(BOUND);
  });

  it('readReply: a refused subscribe whose body is over the bound is response-too-large', async () => {
    answer('/subscriptions', BOUND * 4, 403);
    const res = await openStream(spec('/subscriptions'));
    expect(res.statusCode).toBe(403);
    const e = await failure(readReply(res, BOUND));
    expect(e).toBeInstanceOf(TransportFailure);
    expect(e.reason).toBe('response-too-large');
    expect(e.message).not.toContain(FILLER);
  });

  it('readReply: a body within the bound is read whole', async () => {
    answer('/subscriptions', BOUND - 1024, 403);
    const res = await openStream(spec('/subscriptions'));
    const r = await readReply(res, BOUND);
    expect(r.status).toBe(403);
    expect(Buffer.byteLength(r.body)).toBeLessThanOrEqual(BOUND);
  });

  it('is never retried, whatever the operation', () => {
    const f = new TransportFailure('response-too-large', true);
    for (const kind of ['bootstrap', 'renewal', 'subscribe'] as const)
      expect(retryable(kind, f, { limits: LIMITS })).toBe(false);
  });
});
