// SPDX-License-Identifier: Apache-2.0
//
// The log search (business-rules LS-01 to LS-12), pure: no I/O here. Every
// core-down with a stack runs it before down -v (LS-11, CD-02); --logs only
// decides whether clean logs are printed. The typed prefixes are read from the
// vendored contract, never listed here (LS-01); a prefix followed by token
// characters is a hit (LS-03), and so is an exact secret value (LS-04). A hit
// records the service and the kind only, never the matched text (LS-08). Any
// source that cannot be read fails closed: no log is printed (LS-10).

/** A typed prefix and the contract's name for its kind. */
export interface Prefix {
  prefix: string;
  kind: string;
}

export interface ExactValue {
  value: string;
  kind: string;
}

export interface ServiceLog {
  service: string;
  /** The log: searched, and printed when clean and asked for. */
  text: string;
  /** What the log command wrote to stderr: searched, never printed. */
  stderr?: string;
}

export interface Hit {
  service: string;
  kind: string;
}

/** The contract's credential syntax (credentials.md *Syntax*: RFC 6750 b64token). */
export const TOKEN_CHARACTERS = 'A-Za-z0-9._~+/-';

/** The prefix's text, in backticks, as credentials.md writes it. */
const PREFIX_IN_TEXT = /`(soorma_[a-z0-9]+_)`/g;

export class SearchSetupError extends Error {}

/**
 * Every typed prefix credentials.md names, with its kind (LS-01; TS-U2-05).
 * In the table, the kind is the row's first cell; in a sentence, the bold
 * phrase just before the prefix. A prefix without a readable kind, or no
 * prefix at all, is an error: the search fails closed (LS-02).
 */
export function prefixesFrom(markdown: string): Prefix[] {
  const found = new Map<string, string>();
  for (const line of markdown.split('\n')) {
    for (const m of line.matchAll(PREFIX_IN_TEXT)) {
      const prefix = m[1] ?? '';
      let kind: string | undefined;
      if (line.trimStart().startsWith('|')) {
        kind = line.split('|')[1]?.trim();
      } else {
        const before = line.slice(0, m.index);
        const bold = [...before.matchAll(/\*\*([^*]+)\*\*/g)].pop();
        kind = bold?.[1]?.trim();
      }
      if (!kind) throw new SearchSetupError(`no kind readable for ${prefix} in credentials.md`);
      if (!found.has(prefix)) found.set(prefix, kind);
    }
  }
  if (found.size === 0) throw new SearchSetupError('no typed prefix readable in credentials.md');
  return [...found].map(([prefix, kind]) => ({ prefix, kind }));
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A prefix, then at least one token character (LS-03). */
export function patternFor(prefix: string): RegExp {
  return new RegExp(`${escape(prefix)}[${TOKEN_CHARACTERS}]`);
}

/** Every (service, kind) found, once each. Never the matched text (LS-06, LS-08). */
export function search(logs: ServiceLog[], prefixes: Prefix[], exact: ExactValue[]): Hit[] {
  const hits: Hit[] = [];
  const seen = new Set<string>();
  const add = (service: string, kind: string): void => {
    const key = `${service}\u0000${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ service, kind });
  };
  const patterns = prefixes.map((p) => ({ re: patternFor(p.prefix), kind: p.kind }));
  for (const log of logs) {
    const text = log.stderr ? `${log.text}\n${log.stderr}` : log.text;
    for (const p of patterns) if (p.re.test(text)) add(log.service, p.kind);
    for (const v of exact)
      if (v.value.length > 0 && text.includes(v.value)) add(log.service, v.kind);
  }
  return hits;
}

export type Outcome =
  | { kind: 'no-container' }
  | { kind: 'unreadable'; what: string[] }
  | { kind: 'hit'; hits: Hit[] }
  | { kind: 'clean'; logs: ServiceLog[] };

/** Decides the outcome: unreadable first (nothing is trusted), then hits, then clean. */
export function decide(
  unreadable: string[],
  logs: ServiceLog[],
  prefixes: Prefix[],
  exact: ExactValue[],
): Outcome {
  if (unreadable.length > 0) return { kind: 'unreadable', what: unreadable };
  const hits = search(logs, prefixes, exact);
  if (hits.length > 0) return { kind: 'hit', hits };
  return { kind: 'clean', logs };
}

export const K_NOT_SEARCHABLE =
  'core-down: the human secret K is not searchable: it is never on disk and has no prefix; it was generated for this run only and is worthless once the stack is down (LS-05)';

/**
 * The lines core-down prints for an outcome (LS-07 to LS-12). Only a clean
 * outcome with printLogs prints any log text. `tag` names the soorma-core tag a
 * hit is to be raised against (LS-09).
 */
export function report(outcome: Outcome, printLogs: boolean, tag: string): string[] {
  switch (outcome.kind) {
    case 'no-container':
      return ['core-down: no container in soorma-local: no log to search (LS-12)'];
    case 'unreadable':
      return [
        ...outcome.what.map(
          (w) => `core-down: could not read ${w}: not printing any log (the search fails closed)`,
        ),
        K_NOT_SEARCHABLE,
      ];
    case 'hit':
      return [
        ...outcome.hits.map(
          (h) =>
            `core-down: ${h.service}'s log holds a secret value (kind: ${h.kind}): a soorma-core logging defect. Not printing any log. Raise it as a soorma-core issue naming ${h.service} and ${tag}, without the value.`,
        ),
        K_NOT_SEARCHABLE,
      ];
    case 'clean': {
      const lines: string[] = [];
      for (const log of outcome.logs) {
        if (printLogs) {
          lines.push(`----- ${log.service} (searched, clean) -----`);
          lines.push(log.text.replace(/\n$/, ''));
        } else {
          lines.push(`core-down: ${log.service}: log searched, clean`);
        }
      }
      lines.push(K_NOT_SEARCHABLE);
      return lines;
    }
  }
}

/** Whether the outcome fails core-down (CD-06). */
export const fails = (outcome: Outcome): boolean =>
  outcome.kind === 'unreadable' || outcome.kind === 'hit';
