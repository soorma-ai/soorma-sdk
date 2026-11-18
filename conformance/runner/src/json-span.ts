// SPDX-License-Identifier: Apache-2.0
//
// Locating a value inside JSON text without parsing it into objects, so the
// runner can compare the exact bytes an SDK sent (FWD-02: the forwarded
// envelope must be the received text, byte for byte) and check compactness
// (PUB-03). A minimal scanner over RFC 8259 text.

interface Scan {
  text: string;
  i: number;
}

const ws = (s: Scan): void => {
  while (s.i < s.text.length && ' \t\n\r'.includes(s.text[s.i] ?? '')) s.i++;
};

function skipString(s: Scan): string {
  const start = s.i;
  if (s.text[s.i] !== '"') throw new Error(`expected a string at ${s.i}`);
  s.i++;
  while (s.i < s.text.length) {
    const c = s.text[s.i];
    if (c === '\\') s.i += 2;
    else if (c === '"') {
      s.i++;
      return JSON.parse(s.text.slice(start, s.i)) as string;
    } else s.i++;
  }
  throw new Error('unterminated string');
}

function skipValue(s: Scan): void {
  ws(s);
  const c = s.text[s.i];
  if (c === '"') skipString(s);
  else if (c === '{' || c === '[') {
    const close = c === '{' ? '}' : ']';
    s.i++;
    ws(s);
    if (s.text[s.i] === close) {
      s.i++;
      return;
    }
    for (;;) {
      if (c === '{') {
        ws(s);
        skipString(s);
        ws(s);
        if (s.text[s.i] !== ':') throw new Error(`expected : at ${s.i}`);
        s.i++;
      }
      skipValue(s);
      ws(s);
      if (s.text[s.i] === ',') s.i++;
      else if (s.text[s.i] === close) {
        s.i++;
        return;
      } else throw new Error(`expected , or ${close} at ${s.i}`);
    }
  } else {
    const m = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(s.text.slice(s.i));
    if (!m) throw new Error(`unexpected character at ${s.i}`);
    s.i += m[0].length;
  }
}

/** The exact source text of the value at a JSON pointer (`/draft/inbound/envelope`). */
export function spanAt(text: string, pointer: string): string {
  const r = rangeAt(text, pointer);
  return text.slice(r.start, r.end);
}

/** Where the value at a JSON pointer lies in the text. */
export function rangeAt(text: string, pointer: string): { start: number; end: number } {
  const parts =
    pointer === ''
      ? []
      : pointer
          .slice(1)
          .split('/')
          .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  const s: Scan = { text, i: 0 };
  for (const part of parts) {
    ws(s);
    const c = s.text[s.i];
    if (c === '{') {
      s.i++;
      let found = false;
      for (;;) {
        ws(s);
        if (s.text[s.i] === '}') break;
        const key = skipString(s);
        ws(s);
        s.i++; // ':'
        ws(s);
        if (key === part) {
          found = true;
          break;
        }
        skipValue(s);
        ws(s);
        if (s.text[s.i] === ',') s.i++;
      }
      if (!found) throw new Error(`no member ${part}`);
    } else if (c === '[') {
      s.i++;
      const idx = Number(part);
      for (let k = 0; k < idx; k++) {
        skipValue(s);
        ws(s);
        s.i++; // ','
      }
      ws(s);
    } else throw new Error(`cannot descend into a scalar at ${part}`);
  }
  ws(s);
  const start = s.i;
  skipValue(s);
  return { start, end: s.i };
}

/** Member names of an object, in source order, with duplicates kept. */
export function memberNames(text: string): string[] {
  const s: Scan = { text, i: 0 };
  ws(s);
  if (s.text[s.i] !== '{') throw new Error('not an object');
  s.i++;
  const names: string[] = [];
  for (;;) {
    ws(s);
    if (s.text[s.i] === '}') return names;
    names.push(skipString(s));
    ws(s);
    s.i++;
    skipValue(s);
    ws(s);
    if (s.text[s.i] === ',') s.i++;
  }
}

/**
 * Compact JSON as PUB-03 requires: no whitespace outside strings, except
 * inside an exempt span (the spliced forwarded envelope); no \u escape for a
 * character that needs none; no duplicate member names at any level.
 */
export function compactViolations(text: string, exempt?: { start: number; end: number }): string[] {
  const out: string[] = [];
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    if (exempt && i >= exempt.start && i < exempt.end) continue;
    const c = text[i] ?? '';
    if (inString) {
      if (c === '\\') {
        const next = text[i + 1];
        if (next === 'u') {
          const code = parseInt(text.slice(i + 2, i + 6), 16);
          if (
            code >= 0x20 &&
            code !== 0x22 &&
            code !== 0x5c &&
            !(code >= 0xd800 && code <= 0xdfff)
          ) {
            out.push(`unnecessary escape \\u${text.slice(i + 2, i + 6)} at ${i}`);
          }
          i += 5;
        } else i += 1;
      } else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (' \t\n\r'.includes(c)) out.push(`whitespace at ${i}`);
  }
  checkDuplicates(text, '', out);
  return out;
}

function checkDuplicates(text: string, at: string, out: string[]): void {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const names = memberNames(trimmed);
    const seen = new Set<string>();
    for (const n of names) {
      if (seen.has(n)) out.push(`duplicate member ${at}/${n}`);
      seen.add(n);
      checkDuplicates(
        spanAt(trimmed, `/${n.replace(/~/g, '~0').replace(/\//g, '~1')}`),
        `${at}/${n}`,
        out,
      );
    }
  } else if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed) as unknown[];
    arr.forEach((_, k) => checkDuplicates(spanAt(trimmed, `/${k}`), `${at}/${k}`, out));
  }
}
