// SPDX-License-Identifier: Apache-2.0
//
// The payload check (TH-PUB-01; P-09; U3-FD-Q5 and the user's ruling): a value
// JSON cannot carry exactly is refused before any request, by a TypeError
// naming the path and the kind, never the value. Depth is not limited (PUB-04);
// a payload too deep for JSON.stringify's stack is refused the same way.
// Iterative: the check itself cannot overflow the stack.

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const step = (path: string, key: string | number): string =>
  typeof key === 'number'
    ? `${path}[${key}]`
    : IDENT.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`;

function kindOf(v: unknown): string | undefined {
  switch (typeof v) {
    case 'string':
    case 'boolean':
      return undefined;
    case 'number':
      if (!Number.isFinite(v)) return 'a non-finite number';
      return Object.is(v, -0) ? 'negative zero' : undefined;
    case 'undefined':
      return 'undefined';
    case 'function':
      return 'a function';
    case 'symbol':
      return 'a symbol';
    case 'bigint':
      return 'a bigint';
    default:
      return undefined;
  }
}

function refuse(path: string, kind: string): never {
  throw new TypeError(`payload ${path} is ${kind}, which JSON cannot carry exactly`);
}

/** Checks the payload and returns its compact JSON text (PUB-03, PUB-04). */
export function payloadText(payload: unknown): string {
  const ancestors = new Set<object>();
  const stack: { v: unknown; path: string; exit?: object }[] = [{ v: payload, path: '$' }];
  while (stack.length > 0) {
    const top = stack.pop() as { v: unknown; path: string; exit?: object };
    if (top.exit) {
      ancestors.delete(top.exit);
      continue;
    }
    const { v, path } = top;
    if (v === null) continue;
    const scalar = kindOf(v);
    if (scalar) refuse(path, scalar);
    if (typeof v !== 'object') continue;
    if (ancestors.has(v)) refuse(path, 'a cycle');
    if (Array.isArray(v)) {
      ancestors.add(v);
      stack.push({ v: null, path, exit: v });
      for (let i = v.length - 1; i >= 0; i--) {
        if (!(i in v)) refuse(step(path, i), 'a missing array element');
        stack.push({ v: v[i], path: step(path, i) });
      }
      continue;
    }
    const proto = Object.getPrototypeOf(v) as unknown;
    if (proto !== Object.prototype && proto !== null) refuse(path, 'not a plain object or array');
    if (Object.getOwnPropertySymbols(v).length > 0) refuse(path, 'an object with symbol keys');
    ancestors.add(v);
    stack.push({ v: null, path, exit: v });
    const entries = Object.entries(v as Record<string, unknown>);
    for (let i = entries.length - 1; i >= 0; i--) {
      const [k, x] = entries[i] as [string, unknown];
      stack.push({ v: x, path: step(path, k) });
    }
  }
  try {
    return JSON.stringify(payload);
  } catch (error) {
    if (error instanceof RangeError) {
      // A stack-overflow RangeError carries no data, so it is safe to keep as the cause.
      throw new TypeError('payload $ is too deeply nested to serialize', { cause: error });
    }
    throw error;
  }
}
