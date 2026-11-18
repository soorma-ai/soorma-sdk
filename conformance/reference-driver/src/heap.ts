// SPDX-License-Identifier: Apache-2.0
//
// CDI-02, TypeScript: after forced garbage collection, a heap snapshot is
// searched, as a stream in memory (never written to disk), for the secret's
// value and for each half of it. The value is searched as bytes, so the search
// itself creates no string holding it. Only a count leaves this function.
import { getHeapSnapshot } from 'node:v8';

const turn = (): Promise<void> => new Promise((r) => setImmediate(r));

export async function secretRetained(value: Buffer): Promise<{ found: boolean; count: number }> {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) throw new Error('the reference driver must run with --expose-gc');
  for (let i = 0; i < 3; i++) {
    await turn();
    await new Promise((r) => setTimeout(r, 0));
    gc();
  }
  const half = Math.floor(value.length / 2);
  const needles = [value, value.subarray(0, half), value.subarray(half)];
  let tail = Buffer.alloc(0);
  let count = 0;
  for await (const chunk of getHeapSnapshot()) {
    const buf = Buffer.concat([tail, chunk as Buffer]);
    for (const n of needles) {
      let at = buf.indexOf(n);
      while (at !== -1) {
        if (at + n.length > tail.length) count++;
        at = buf.indexOf(n, at + 1);
      }
    }
    tail = buf.subarray(Math.max(0, buf.length - value.length));
  }
  return { found: count > 0, count };
}
