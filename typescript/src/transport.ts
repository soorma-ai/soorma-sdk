// SPDX-License-Identifier: Apache-2.0
//
// Every request (C-15; P-06; NFR-U3-11). HTTPS through node:https to the
// configured S3 and S4 only; TLS always verified against the system store,
// Node's bundled store and the supplied CA, fixed when the client starts. A
// failed request knows whether it was sent (PRB-08 versus PRB-09). Problems
// are parsed with every member kept (PRB-01 to PRB-03, DEC-U1-14). Nothing here
// logs, and no error carries a body.
import type { IncomingMessage } from 'node:http';
import { request } from 'node:https';
import { readFile } from 'node:fs/promises';
import { getCACertificates } from 'node:tls';
import { clearTimer, setTimer, wallNow } from './clock.ts';
import { ProblemError, TransportError } from './errors.ts';
import type { JsonValue } from './types.ts';

export const CONTRACT_VERSION = '0.1.0';

/** A request that failed without an answer. Internal: surfaced as TransportError. */
export type FailureReason = 'tls' | 'connection' | 'timeout' | 'response-too-large';

export class TransportFailure extends Error {
  readonly reason: FailureReason;
  readonly sent: boolean;
  constructor(reason: FailureReason, sent: boolean) {
    super(`transport: ${reason}`);
    this.reason = reason;
    this.sent = sent;
  }
}

export const asTransportError = (f: TransportFailure): TransportError =>
  new TransportError(f.reason);

const TLS_CODES = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS|HOSTNAME|DEPTH_ZERO/;
const PEM = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

/**
 * The trust store (P-06): system ∪ bundled ∪ the CA file. Built at start();
 * a missing, unreadable or non-PEM CA file is TransportError('ca-file'), and
 * nothing is sent.
 */
export async function buildTrustStore(caFile: string | undefined): Promise<string[]> {
  const store = [...getCACertificates('system'), ...getCACertificates('bundled')];
  if (caFile === undefined) return store;
  let text: string;
  try {
    text = await readFile(caFile, 'utf8');
  } catch {
    throw new TransportError('ca-file');
  }
  const certs = text.match(PEM);
  if (!certs || certs.length === 0) throw new TransportError('ca-file');
  return [...store, ...certs];
}

export interface Reply {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface RequestSpec {
  base: string;
  path: string;
  headers: Record<string, string>;
  /** Compact JSON text, built by the caller; absent for no body. */
  body?: string;
  ca: readonly string[];
  /** T_req: the wait for the response head. */
  timeoutMs: number;
  signal?: AbortSignal;
  /** B_body: the most bytes a non-stream body may hold (RCV-09). */
  maxBody: number;
}

export function flatten(h: IncomingMessage['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h))
    out[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
  return out;
}

function send(
  spec: RequestSpec,
  onHead: (res: IncomingMessage, settle: (v: unknown, err?: unknown) => void) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const u = new URL(spec.path, spec.base);
    let sent = false;
    let done = false;
    const settle = (v: unknown, err?: unknown): void => {
      if (done) return;
      done = true;
      clearTimer(timer);
      spec.signal?.removeEventListener('abort', onAbort);
      if (err !== undefined) reject(err);
      else resolve(v);
    };
    const req = request(
      {
        host: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        agent: false,
        ca: [...spec.ca],
        rejectUnauthorized: true,
        headers: {
          ...spec.headers,
          ...(spec.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
      },
      (res) => {
        clearTimer(timer);
        onHead(res, settle);
      },
    );
    const timer = setTimer(
      () => req.destroy(new TransportFailure('timeout', sent)),
      spec.timeoutMs,
    );
    const onAbort = (): void => {
      req.destroy();
      settle(undefined, spec.signal?.reason ?? new TransportFailure('connection', sent));
    };
    if (spec.signal?.aborted) {
      onAbort();
      return;
    }
    spec.signal?.addEventListener('abort', onAbort, { once: true });
    req.on('error', (e: NodeJS.ErrnoException) => {
      if (e instanceof TransportFailure) return settle(undefined, e);
      const tls = TLS_CODES.test(String(e.code ?? '')) || TLS_CODES.test(e.message);
      settle(undefined, new TransportFailure(tls ? 'tls' : 'connection', sent));
    });
    req.on('finish', () => (sent = true));
    req.end(spec.body);
  });
}

/** One POST, read whole, at most `maxBody` bytes (RCV-09: never the bytes past it). */
export function post(spec: RequestSpec): Promise<Reply> {
  return send(spec, (res, settle) => {
    const chunks: Buffer[] = [];
    let size = 0;
    res.on('data', (c: Buffer) => {
      size += c.length;
      if (size > spec.maxBody) {
        chunks.length = 0;
        res.destroy();
        settle(undefined, new TransportFailure('response-too-large', true));
        return;
      }
      chunks.push(c);
    });
    res.on('end', () =>
      settle({
        status: res.statusCode ?? 0,
        headers: flatten(res.headers),
        body: Buffer.concat(chunks).toString('utf8'),
      }),
    );
    res.on('error', () => settle(undefined, new TransportFailure('connection', true)));
  }) as Promise<Reply>;
}

/** Opens an event stream: resolves with the response once its head arrives (P-04). */
export function openStream(spec: RequestSpec): Promise<IncomingMessage> {
  return send(spec, (res, settle) => settle(res)) as Promise<IncomingMessage>;
}

/** Retry-After in seconds, from delta-seconds or an HTTP-date (PRB-03). */
export function retryAfterSeconds(h: Record<string, string>): number | undefined {
  const v = h['retry-after'];
  if (v === undefined) return undefined;
  if (/^\d+$/.test(v.trim())) return Number(v.trim());
  const at = Date.parse(v);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - wallNow()) / 1000));
}

/** A non-success response as ProblemError: every member kept; no body if not a Problem. */
export function problemFrom(reply: Reply): ProblemError {
  let p: Record<string, JsonValue> | undefined;
  try {
    const v = JSON.parse(reply.body) as unknown;
    if (v !== null && typeof v === 'object' && !Array.isArray(v))
      p = v as Record<string, JsonValue>;
  } catch {
    p = undefined;
  }
  const isProblem =
    p !== undefined &&
    (p.code === undefined || typeof p.code === 'string') &&
    (p.status === undefined || typeof p.status === 'number');
  const retryAfter = retryAfterSeconds(reply.headers);
  return new ProblemError({
    status: reply.status,
    code: isProblem && typeof p?.code === 'string' ? p.code : null,
    ...(isProblem && typeof p?.title === 'string' ? { title: p.title } : {}),
    ...(isProblem && typeof p?.detail === 'string' ? { detail: p.detail } : {}),
    ...(retryAfter === undefined ? {} : { retryAfter }),
    ...(isProblem && p !== undefined ? { problem: Object.freeze({ ...p }) } : {}),
  });
}

/**
 * A non-200 stream response read whole, as a Reply, at most `maxBody` bytes
 * (RCV-09); `signal` destroys it (PRB-07).
 */
export function readReply(
  res: IncomingMessage,
  maxBody: number,
  signal?: AbortSignal,
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;
    const onAbort = (): void => {
      res.destroy();
      reject(signal?.reason);
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    res.on('data', (c: Buffer) => {
      if (over) return;
      size += c.length;
      if (size > maxBody) {
        over = true;
        chunks.length = 0;
        signal?.removeEventListener('abort', onAbort);
        res.destroy();
        reject(new TransportFailure('response-too-large', true));
        return;
      }
      chunks.push(c);
    });
    res.on('end', () => {
      if (over) return;
      signal?.removeEventListener('abort', onAbort);
      resolve({
        status: res.statusCode ?? 0,
        headers: flatten(res.headers),
        body: Buffer.concat(chunks).toString('utf8'),
      });
    });
    res.on('error', () => {
      if (over) return;
      signal?.removeEventListener('abort', onAbort);
      reject(new TransportFailure('connection', true));
    });
  });
}
