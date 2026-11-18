// SPDX-License-Identifier: Apache-2.0
//
// HTTPS for the reference driver: TLS always verified against the given CA;
// a request knows whether it was sent (PRB-08 versus PRB-09).
import { request, type RequestOptions } from 'node:https';
import type { IncomingMessage } from 'node:http';

export interface HttpReply {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export class TransportFailure extends Error {
  readonly reason: 'tls' | 'connection' | 'timeout';
  readonly sent: boolean;
  constructor(reason: 'tls' | 'connection' | 'timeout', sent: boolean, message: string) {
    super(message);
    this.reason = reason;
    this.sent = sent;
  }
}

const TLS_CODES = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS|HOSTNAME|DEPTH_ZERO/;

export interface Target {
  base: string;
  ca: Buffer | undefined;
}

function options(t: Target, path: string, headers: Record<string, string>): RequestOptions {
  const u = new URL(path, t.base);
  return {
    host: u.hostname,
    port: u.port,
    path: u.pathname,
    method: 'POST',
    agent: false,
    headers,
    ...(t.ca ? { ca: t.ca } : {}),
  };
}

/** One POST; the body is sent as given (already compact JSON text). */
export function post(
  t: Target,
  path: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
): Promise<HttpReply> {
  return new Promise((done, fail) => {
    let sent = false;
    const req = request(options(t, path, headers), (res: IncomingMessage) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (text += c));
      res.on('end', () => {
        const h: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers))
          h[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
        done({ status: res.statusCode ?? 0, headers: h, body: text });
      });
      res.on('error', (e) => fail(new TransportFailure('connection', true, e.message)));
    });
    req.setTimeout(timeoutMs, () =>
      req.destroy(new TransportFailure('timeout', sent, 'timed out')),
    );
    req.on('error', (e: NodeJS.ErrnoException) => {
      if (e instanceof TransportFailure) return fail(e);
      const tls = TLS_CODES.test(String(e.code ?? '')) || TLS_CODES.test(e.message);
      fail(new TransportFailure(tls ? 'tls' : 'connection', sent, e.message));
    });
    req.on('finish', () => (sent = true));
    req.end(body);
  });
}

/** Opens an event stream: resolves with the response once its head arrives. */
export function openStream(
  t: Target,
  path: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
): Promise<{ res: IncomingMessage; destroy: () => void }> {
  return new Promise((done, fail) => {
    let sent = false;
    const req = request(options(t, path, headers), (res) => {
      req.setTimeout(0);
      done({ res, destroy: () => req.destroy() });
    });
    req.setTimeout(timeoutMs, () =>
      req.destroy(new TransportFailure('timeout', sent, 'timed out')),
    );
    req.on('error', (e: NodeJS.ErrnoException) => {
      if (e instanceof TransportFailure) return fail(e);
      const tls = TLS_CODES.test(String(e.code ?? '')) || TLS_CODES.test(e.message);
      fail(new TransportFailure(tls ? 'tls' : 'connection', sent, e.message));
    });
    req.on('finish', () => (sent = true));
    req.end(body);
  });
}

export function retryAfterSeconds(h: Record<string, string>): number | undefined {
  const v = h['retry-after'];
  if (v === undefined) return undefined;
  if (/^\d+$/.test(v.trim())) return Number(v.trim());
  const at = Date.parse(v);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - Date.now()) / 1000));
}
