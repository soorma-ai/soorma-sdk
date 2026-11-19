// SPDX-License-Identifier: Apache-2.0
//
// The delivery reader (C-18; RCV-01 to RCV-08; TH-RD-01 to 05; P-09). One
// iterative, validating scan over a `delivery` event's data: the outer object's
// members, the exact text span of each value, and each value's nesting depth.
// No recursion, so no line can overflow the stack. The envelope is parsed from
// its own span (never schema-validated: DEC-U1-09) and frozen; the payload is
// parsed only within D_lang, else kept as text (RCV-06). A line that is not a
// usable Delivery is a DeliveryError, and the stream continues (RCV-07).
import { Delivery, type Forwarder } from './delivery.ts';
import { D_LANG } from './limits.ts';
import type { DeliveryError, Envelope, JsonValue } from './types.ts';

class Invalid extends Error {}

const WS = new Set([' ', '\t', '\n', '\r']);
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const HEX4 = /[0-9a-fA-F]{4}/y;

interface Member {
  name: string;
  start: number;
  end: number;
  depth: number;
  first: string;
}

/** Scans one JSON string starting at `i` (a quote); returns the index after it. */
function scanString(s: string, i: number): number {
  let j = i + 1;
  for (;;) {
    if (j >= s.length) throw new Invalid();
    const c = s.charCodeAt(j);
    if (c === 0x22) return j + 1;
    if (c < 0x20) throw new Invalid();
    if (c === 0x5c) {
      const e = s[j + 1];
      if (e === 'u') {
        HEX4.lastIndex = j + 2;
        if (!HEX4.test(s)) throw new Invalid();
        j += 6;
      } else if (e !== undefined && '"\\/bfnrt'.includes(e)) {
        j += 2;
      } else {
        throw new Invalid();
      }
    } else {
      j++;
    }
  }
}

function skipWs(s: string, i: number): number {
  while (i < s.length && WS.has(s[i] as string)) i++;
  return i;
}

/** Scans one JSON value at `i`, iteratively; returns its end and its nesting depth. */
function scanValue(s: string, start: number): { end: number; depth: number } {
  type Ctx = { close: '}' | ']'; expectKey: boolean; count: number };
  const stack: Ctx[] = [];
  let maxDepth = 0;
  let i = start;
  for (;;) {
    i = skipWs(s, i);
    const top = stack[stack.length - 1];
    // In an object, a value is preceded by a key and a colon.
    if (top && top.close === '}' && top.expectKey) {
      if (s[i] === '}' && top.count === 0) {
        // An empty object closed: on to the separator handling below.
        stack.pop();
        i++;
      } else {
        if (s[i] !== '"') throw new Invalid();
        i = skipWs(s, scanString(s, i));
        if (s[i] !== ':') throw new Invalid();
        i = skipWs(s, i + 1);
        top.expectKey = false;
        continue;
      }
    } else if (top && top.close === ']' && top.count === 0 && s[i] === ']') {
      stack.pop();
      i++;
    } else {
      const c = s[i];
      if (c === '{' || c === '[') {
        stack.push({ close: c === '{' ? '}' : ']', expectKey: c === '{', count: 0 });
        maxDepth = Math.max(maxDepth, stack.length);
        i++;
        continue;
      }
      if (c === '"') i = scanString(s, i);
      else if (s.startsWith('true', i)) i += 4;
      else if (s.startsWith('false', i)) i += 5;
      else if (s.startsWith('null', i)) i += 4;
      else {
        NUMBER.lastIndex = i;
        const m = NUMBER.exec(s);
        if (!m || m[0].length === 0) throw new Invalid();
        i += m[0].length;
      }
    }
    // A value (or a container) just ended: a separator, a close, or the end.
    for (;;) {
      const cur = stack[stack.length - 1];
      if (!cur) return { end: i, depth: maxDepth };
      i = skipWs(s, i);
      cur.count++;
      if (s[i] === ',') {
        i++;
        if (cur.close === '}') cur.expectKey = true;
        break;
      }
      if (s[i] === cur.close) {
        stack.pop();
        i++;
        continue;
      }
      throw new Invalid();
    }
  }
}

/** The outer object's members, each with its exact span and depth (TH-RD-01). */
function members(s: string): Member[] | 'not-json' | 'not-an-object' {
  try {
    let i = skipWs(s, 0);
    if (s[i] !== '{') {
      scanValue(s, i);
      return 'not-an-object';
    }
    i = skipWs(s, i + 1);
    const out: Member[] = [];
    if (s[i] === '}') {
      if (skipWs(s, i + 1) !== s.length) return 'not-json';
      return out;
    }
    for (;;) {
      if (s[i] !== '"') return 'not-json';
      const keyEnd = scanString(s, i);
      const name = JSON.parse(s.slice(i, keyEnd)) as string;
      i = skipWs(s, keyEnd);
      if (s[i] !== ':') return 'not-json';
      const start = skipWs(s, i + 1);
      const v = scanValue(s, start);
      out.push({ name, start, end: v.end, depth: v.depth, first: s[start] ?? '' });
      i = skipWs(s, v.end);
      if (s[i] === ',') {
        i = skipWs(s, i + 1);
        continue;
      }
      if (s[i] === '}') {
        if (skipWs(s, i + 1) !== s.length) return 'not-json';
        return out;
      }
      return 'not-json';
    }
  } catch {
    return 'not-json';
  }
}

function deepFreeze<T>(v: T): T {
  const stack: unknown[] = [v];
  while (stack.length > 0) {
    const x = stack.pop();
    if (x !== null && typeof x === 'object' && !Object.isFrozen(x)) {
      Object.freeze(x);
      for (const y of Object.values(x)) stack.push(y);
    }
  }
  return v;
}

const error = (reason: string, text: string): DeliveryError =>
  Object.freeze({ kind: 'deliveryError', reason, text });

/** One `delivery` event's data, as a Delivery or a DeliveryError (RCV-01 to RCV-07). */
export function readDelivery(line: string, forward?: Forwarder): Delivery | DeliveryError {
  const m = members(line);
  if (m === 'not-json' || m === 'not-an-object') return error(m, line);
  const pick = (name: string): Member | 'duplicate' | undefined => {
    const found = m.filter((x) => x.name === name);
    return found.length > 1 ? 'duplicate' : found[0];
  };
  const env = pick('envelope');
  const seal = pick('seal');
  const payload = pick('payload');
  if (env === 'duplicate' || seal === 'duplicate' || payload === 'duplicate') {
    return error('duplicate-member', line);
  }
  if (!env || env.first !== '{') return error('missing-envelope', line);
  if (!seal || seal.first !== '"') return error('missing-seal', line);
  if (!payload) return error('missing-payload', line);
  if (env.depth > D_LANG) return error('envelope-too-deep', line);
  const envelopeText = line.slice(env.start, env.end);
  const payloadText = line.slice(payload.start, payload.end);
  const parsed = payload.depth <= D_LANG;
  return new Delivery(
    {
      envelope: deepFreeze(JSON.parse(envelopeText) as Envelope),
      envelopeText,
      seal: JSON.parse(line.slice(seal.start, seal.end)) as string,
      ...(parsed ? { payload: deepFreeze(JSON.parse(payloadText) as JsonValue) } : {}),
      payloadText,
      payloadParsed: parsed,
    },
    forward,
  );
}
