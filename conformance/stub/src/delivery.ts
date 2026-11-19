// SPDX-License-Identifier: Apache-2.0
//
// Builds a Delivery line as exact text, so member order, spacing and number
// spellings are the case's, not a serializer's (RCV-01, FWD-02, RCV-05).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const FIXTURES = resolve(import.meta.dirname, '..', '..', '..', 'contract', 'fixtures', '0.1.0');

type J = null | boolean | number | string | J[] | { [k: string]: J };

function setAt(obj: J, pointer: string, value: J): void {
  const parts = pointer.slice(1).split('/');
  let cur = obj as Record<string, J>;
  for (const p of parts.slice(0, -1)) cur = cur[p] as Record<string, J>;
  cur[parts[parts.length - 1] ?? ''] = value;
}

/** A JSON value's text: `text` as is, `json` compact, `fixture` (optionally edited) compact. */
export function valueText(src: Record<string, J>): string {
  if (typeof src.text === 'string') return src.text;
  if ('json' in src) return JSON.stringify(atSend(src.json as J));
  if (typeof src.fixture === 'string') {
    const v = JSON.parse(readFileSync(join(FIXTURES, src.fixture), 'utf8')) as J;
    for (const [p, val] of Object.entries((src.set ?? {}) as Record<string, J>)) setAt(v, p, val);
    return JSON.stringify(v);
  }
  if (typeof src.deep === 'number') return deepPayload(src.deep);
  throw new Error('a value needs text, json, fixture or deep');
}

/**
 * Values resolved when the stub sends, not at case start (added at U3 for
 * CC-REN-06): an object `{"$expiresIn": ms}` becomes the ISO time `ms` after
 * now, so each response's expiry is relative to that response. Everything else
 * is returned unchanged.
 */
export function atSend(v: J, now: number = Date.now()): J {
  if (Array.isArray(v)) return v.map((x) => atSend(x, now));
  if (v !== null && typeof v === 'object') {
    const keys = Object.keys(v);
    const ms = (v as Record<string, J>).$expiresIn;
    if (keys.length === 1 && typeof ms === 'number') return new Date(now + ms).toISOString();
    const out: Record<string, J> = {};
    for (const [k, x] of Object.entries(v)) out[k] = atSend(x, now);
    return out;
  }
  return v;
}

/** A payload nested `depth` levels: {"n":{"n":...{"n":1}}}. */
export function deepPayload(depth: number): string {
  return `${'{"n":'.repeat(depth)}1${'}'.repeat(depth)}`;
}

export interface BuiltDelivery {
  line: string;
  envelopeText: string;
  seal: string;
}

/**
 * Either `raw` (the whole line), `fixture` (+ `set`), or parts: `envelope`,
 * `seal`, `payload` (each a value source; `seal` may be a plain string) in
 * `order` (default envelope, seal, payload), joined with `sep` (default none).
 */
export function buildDelivery(spec: Record<string, J>): BuiltDelivery {
  if (typeof spec.raw === 'string') return { line: spec.raw, ...extract(spec.raw) };
  if (typeof spec.fixture === 'string') {
    const line = valueText(spec);
    return { line, ...extract(line) };
  }
  const envelopeText = valueText(spec.envelope as Record<string, J>);
  const sealValue = spec.seal;
  const sealText =
    typeof sealValue === 'string'
      ? JSON.stringify(sealValue)
      : valueText(sealValue as Record<string, J>);
  const payloadText = valueText(spec.payload as Record<string, J>);
  const parts: Record<string, string> = {
    envelope: envelopeText,
    seal: sealText,
    payload: payloadText,
  };
  const order = (spec.order as string[] | undefined) ?? ['envelope', 'seal', 'payload'];
  const sep = typeof spec.sep === 'string' ? spec.sep : '';
  const line = `{${order.map((k) => `"${k}":${sep}${parts[k] ?? 'null'}`).join(`,${sep}`)}}`;
  return {
    line,
    envelopeText,
    seal: typeof sealValue === 'string' ? sealValue : (JSON.parse(sealText) as string),
  };
}

function extract(line: string): { envelopeText: string; seal: string } {
  try {
    const o = JSON.parse(line) as { envelope?: unknown; seal?: unknown };
    // For raw lines the envelope text is recovered by position, not re-serialized.
    const m = /"envelope"\s*:\s*/.exec(line);
    let envelopeText = '';
    if (m && o.envelope && typeof o.envelope === 'object') {
      let depth = 0;
      let inStr = false;
      const start = m.index + m[0].length;
      for (let i = start; i < line.length; i++) {
        const c = line[i];
        if (inStr) {
          if (c === '\\') i++;
          else if (c === '"') inStr = false;
        } else if (c === '"') inStr = true;
        else if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') {
          depth--;
          if (depth === 0) {
            envelopeText = line.slice(start, i + 1);
            break;
          }
        }
      }
    }
    return { envelopeText, seal: typeof o.seal === 'string' ? o.seal : '' };
  } catch {
    return { envelopeText: '', seal: '' };
  }
}
