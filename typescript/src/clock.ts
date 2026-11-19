// SPDX-License-Identifier: Apache-2.0
//
// Every time read and timer in the package goes through here (P-05; TS-U3-10):
// the wall clock only to compare with a credential's expiresAt, the monotonic
// clock for floors, waits and timeouts. Unit tests drive both with Vitest's
// fake timers. A lint rule refuses the globals anywhere else in src/.

/** The wall clock, in ms since the epoch. */
export const wallNow = (): number => Date.now();

/** The monotonic clock, in ms. */
export const monoNow = (): number => performance.now();

export type Timer = ReturnType<typeof setTimeout>;

/** A timer; `unref` lets the process exit while only this timer is pending. */
export function setTimer(fn: () => void, ms: number, options: { unref?: boolean } = {}): Timer {
  const t = setTimeout(fn, Math.max(0, ms));
  if (options.unref) t.unref();
  return t;
}

export function clearTimer(t: Timer | undefined): void {
  if (t !== undefined) clearTimeout(t);
}

/** A wait that `signal` cuts short (rejecting with its reason). */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const t = setTimer(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimer(t);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
