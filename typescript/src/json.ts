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

type Frame =
  | { kind: 'value'; v: unknown; path: string }
  | { kind: 'raw'; text: string }
  | { kind: 'exit'; of: object };

/**
 * Checks the payload and returns its compact JSON text (PUB-03, PUB-04), in
 * one iterative walk: no depth can overflow the stack, so depth is not limited
 * on any platform (Step 25b). The text is what JSON.stringify gives for every
 * value the check accepts: strings and numbers through JSON.stringify, keys in
 * Object.entries order (the same order JSON.stringify uses).
 */
export function payloadText(payload: unknown): string {
  const out: string[] = [];
  const ancestors = new Set<object>();
  const stack: Frame[] = [{ kind: 'value', v: payload, path: '$' }];
  while (stack.length > 0) {
    const f = stack.pop() as Frame;
    if (f.kind === 'raw') {
      out.push(f.text);
      continue;
    }
    if (f.kind === 'exit') {
      ancestors.delete(f.of);
      continue;
    }
    const { v, path } = f;
    if (v === null) {
      out.push('null');
      continue;
    }
    const scalar = kindOf(v);
    if (scalar) refuse(path, scalar);
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out.push(JSON.stringify(v));
      continue;
    }
    const o = v as object;
    if (ancestors.has(o)) refuse(path, 'a cycle');
    if (Array.isArray(o)) {
      ancestors.add(o);
      stack.push({ kind: 'exit', of: o }, { kind: 'raw', text: ']' });
      for (let i = o.length - 1; i >= 0; i--) {
        if (!(i in o)) refuse(step(path, i), 'a missing array element');
        stack.push({ kind: 'value', v: o[i], path: step(path, i) });
        if (i > 0) stack.push({ kind: 'raw', text: ',' });
      }
      stack.push({ kind: 'raw', text: '[' });
      continue;
    }
    const proto = Object.getPrototypeOf(o) as unknown;
    if (proto !== Object.prototype && proto !== null) refuse(path, 'not a plain object or array');
    if (Object.getOwnPropertySymbols(o).length > 0) refuse(path, 'an object with symbol keys');
    ancestors.add(o);
    stack.push({ kind: 'exit', of: o }, { kind: 'raw', text: '}' });
    const entries = Object.entries(o as Record<string, unknown>);
    for (let i = entries.length - 1; i >= 0; i--) {
      const [k, x] = entries[i] as [string, unknown];
      stack.push({ kind: 'value', v: x, path: step(path, k) });
      stack.push({ kind: 'raw', text: `${i > 0 ? ',' : ''}${JSON.stringify(k)}:` });
    }
    stack.push({ kind: 'raw', text: '{' });
  }
  try {
    return out.join('');
  } catch (error) {
    // A guard only: joining cannot recurse. A RangeError carries no data.
    throw new TypeError('payload $ is too large to serialize', { cause: error });
  }
}
