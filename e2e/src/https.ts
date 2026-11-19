// SPDX-License-Identifier: Apache-2.0
//
// One raw call to the stack (TS-U2-03; GEN-04; GEN-07). node:https, the
// stack's CA as the only trust anchor, no connection reuse, the contract
// version header, a body built by the caller's code, and a time limit from the
// connection through the whole response. Nothing here prints: a failure is
// reduced to the step, the status, the Problem's code and the request id
// (ST-12; GEN-06), never a body.
import { request } from 'node:https';
import { CONTRACT_VERSION, formatLimit } from './stack.ts';

export interface CallSpec {
  /** The step's name, as a failure line shows it: "registerAgent agent-b". */
  step: string;
  /** "https://localhost:8442" */
  base: string;
  path: string;
  /** The CA certificate (PEM): the only one trusted. */
  ca: string;
  /** A bearer credential, when the operation names a security scheme. */
  credential?: string;
  /** A JSON body; absent for operations that take none. */
  body?: unknown;
  limitMs: number;
}

export interface CallResult {
  status: number;
  requestId: string | undefined;
  /** The parsed JSON body, or undefined when there is none. */
  body: unknown;
}

/** A call that ran out of its limit. */
export class CallTimeout extends Error {
  readonly step: string;
  readonly limitMs: number;
  constructor(step: string, limitMs: number) {
    super(`${step} timed out after ${formatLimit(limitMs)}`);
    this.step = step;
    this.limitMs = limitMs;
  }
}

/** A call that got no HTTP response: refused, reset, TLS. Its code only, never data. */
export class CallError extends Error {
  readonly step: string;
  readonly code: string;
  constructor(step: string, code: string) {
    super(`${step} failed: no response (${code})`);
    this.step = step;
    this.code = code;
  }
}

export function call(spec: CallSpec): Promise<CallResult> {
  return new Promise((resolvePromise, reject) => {
    const url = new URL(spec.path, spec.base);
    const payload = spec.body === undefined ? undefined : Buffer.from(JSON.stringify(spec.body));
    const headers: Record<string, string> = {
      'Soorma-Contract-Version': CONTRACT_VERSION,
      accept: 'application/json, application/problem+json',
    };
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(payload.length);
    }
    if (spec.credential !== undefined) headers.authorization = `Bearer ${spec.credential}`;
    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const req = request(
      url,
      { method: 'POST', ca: spec.ca, agent: false, headers, rejectUnauthorized: true },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (b: Buffer) => chunks.push(b));
        res.on('error', (e: NodeJS.ErrnoException) =>
          settle(() => reject(new CallError(spec.step, e.code ?? 'response error'))),
        );
        res.on('end', () =>
          settle(() => {
            const text = Buffer.concat(chunks).toString('utf8');
            let body: unknown;
            if (text.length > 0) {
              try {
                body = JSON.parse(text);
              } catch {
                body = undefined;
              }
            }
            const rid = res.headers['soorma-request-id'];
            resolvePromise({
              status: res.statusCode ?? 0,
              requestId: typeof rid === 'string' ? rid : undefined,
              body,
            });
          }),
        );
      },
    );
    const timer = setTimeout(() => {
      settle(() => reject(new CallTimeout(spec.step, spec.limitMs)));
      req.destroy();
    }, spec.limitMs);
    req.on('error', (e: NodeJS.ErrnoException) =>
      settle(() => reject(new CallError(spec.step, e.code ?? 'request error'))),
    );
    if (payload) req.write(payload);
    req.end();
  });
}

/** A Problem's code, if the body is a Problem with one. */
export function problemCode(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'code' in body) {
    const code = (body as { code: unknown }).code;
    if (typeof code === 'string' && /^[a-z0-9_]{1,64}$/.test(code)) return code;
  }
  return undefined;
}

/** "setup: registerAgent agent-b failed: 503 unavailable (request 01J…)" (ST-12). */
export function failureLine(command: string, step: string, result: CallResult): string {
  return `${command}: ${step} failed: ${result.status} ${problemCode(result.body) ?? '-'} (request ${safeRequestId(result.requestId)})`;
}

/** The request id is the stack's, but printed only if it looks like one. */
function safeRequestId(id: string | undefined): string {
  return id !== undefined && /^[A-Za-z0-9._:-]{1,128}$/.test(id) ? id : '-';
}

/** The line for any failure of a call: a status, a timeout or no response. */
export function errorLine(command: string, error: unknown): string {
  if (error instanceof CallTimeout || error instanceof CallError)
    return `${command}: ${error.message}`;
  return `${command}: unexpected error`;
}
