// SPDX-License-Identifier: Apache-2.0
//
// The one retry policy (P-01; NFR-U3-07; PRB-05, PRB-06, PRB-08 to PRB-10).
// Bootstrap, renewal and subscribe only; a publish never comes here.
//   503                                   retry (renewal: while usable)
//   connection failure, request not sent  retry (renewal: while usable)
//   failure after the request was sent    retry (renewal: while usable)
//   TLS failure, 429, other 4xx, 500      never
// Retry-After first, else backoff; at most R_max attempts and W_max of waiting.
import { monoNow, sleep } from './clock.ts';
import { ProblemError } from './errors.ts';
import type { Limits } from './limits.ts';
import { TransportFailure } from './transport.ts';

export type RetryKind = 'bootstrap' | 'renewal' | 'subscribe';

export interface RetryContext {
  limits: Limits;
  signal?: AbortSignal;
  /** Renewal: the one validity check (P-02; CDI-06). */
  usable?: () => boolean;
}

export function retryable(kind: RetryKind, error: unknown, ctx: RetryContext): boolean {
  const stillUsable = kind !== 'renewal' || (ctx.usable?.() ?? true);
  if (error instanceof ProblemError) return error.status === 503 && stillUsable;
  if (error instanceof TransportFailure) return error.reason !== 'tls' && stillUsable;
  return false;
}

export async function retry<T>(
  kind: RetryKind,
  attempt: () => Promise<T>,
  ctx: RetryContext,
): Promise<T> {
  const { limits } = ctx;
  const started = monoNow();
  let backoff = limits.B_init;
  for (let n = 1; ; n++) {
    try {
      return await attempt();
    } catch (error) {
      if (ctx.signal?.aborted || !retryable(kind, error, ctx) || n >= limits.R_max) throw error;
      const ra = error instanceof ProblemError ? error.retryAfter : undefined;
      const wait = ra !== undefined ? ra * 1000 : backoff;
      if (monoNow() - started + wait > limits.W_max) throw error;
      await sleep(wait, ctx.signal);
      backoff = Math.min(backoff * limits.B_factor, limits.B_cap);
    }
  }
}
