// SPDX-License-Identifier: Apache-2.0
//
// Every assertion is made here, once, for every language (AD-09): the drivers
// only report. Assertions arrive with their placeholders resolved. A failure
// message names the assertion and what was seen, never a secret's value.
import { isDeepStrictEqual } from 'node:util';
import type { Case } from './cases.ts';
import { expandFixtures, proveMatcher, schemaErrors, validates } from './contract.ts';
import { compactViolations, rangeAt, spanAt } from './json-span.ts';
import type {
  DeliverySent,
  Json,
  JsonObject,
  RecordedRequest,
  RequestMatch,
  StreamRecord,
} from './types.ts';
import type { ContractSchema } from '../../../contract/scripts/validator.ts';

export interface Observation {
  op: string;
  label?: string;
  ok: boolean;
  result?: JsonObject;
  error?: JsonObject;
  at: number;
}

export interface Evidence {
  observations: Observation[];
  items: JsonObject[];
  recording: RecordedRequest[];
  streams: StreamRecord[];
  deliveries: DeliverySent[];
  concurrentStreamsMax: number;
  stderr: string;
  /** Plain secrets the case made: checked for, never printed. */
  secrets: string[];
}

type Assertion = JsonObject & { kind: string };

const sel = (r: RecordedRequest, m: RequestMatch): boolean =>
  (m.listener === undefined || r.listener === m.listener) &&
  (m.method === undefined || r.method === m.method) &&
  (m.path === undefined || r.path === m.path) &&
  (m.label === undefined || r.label === m.label);

export function requestsMatching(rec: RecordedRequest[], m: RequestMatch): RecordedRequest[] {
  return rec.filter((r) => sel(r, m));
}

function oneRequest(rec: RecordedRequest[], m: RequestMatch): RecordedRequest | string {
  const all = requestsMatching(rec, m);
  const r = all[(m.nth ?? 1) - 1];
  return r ?? `no request matching ${JSON.stringify(m)} (saw ${all.length})`;
}

const describe = (a: Assertion): string => `${a.kind}${a.label ? ` ${String(a.label)}` : ''}`;

/** Literal (deep equal), or a matcher object ({exists}, {matches}, {includes}, {notEquals}, {oneOf}). */
export function matches(actual: unknown, expected: Json): boolean {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    const e = expected;
    if ('exists' in e) return (actual !== undefined && actual !== null) === e.exists;
    if ('matches' in e)
      return typeof actual === 'string' && new RegExp(String(e.matches)).test(actual);
    if ('includes' in e) return typeof actual === 'string' && actual.includes(String(e.includes));
    if ('notEquals' in e) return !isDeepStrictEqual(actual, e.notEquals);
    if ('oneOf' in e)
      return Array.isArray(e.oneOf) && e.oneOf.some((x) => isDeepStrictEqual(actual, x));
    if ('atLeast' in e) return typeof actual === 'number' && actual >= Number(e.atLeast);
    if ('atMost' in e) return typeof actual === 'number' && actual <= Number(e.atMost);
  }
  return isDeepStrictEqual(actual, expected);
}

export function at(value: unknown, pointer: string): unknown {
  if (pointer === '') return value;
  return pointer
    .slice(1)
    .split('/')
    .reduce<unknown>(
      (v, p) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined),
      value,
    );
}

function delivered(ev: Evidence, label: string): DeliverySent | undefined {
  return ev.deliveries.find((d) => d.label === label);
}

const parseTraceparent = (tp: string): { traceId: string; spanId: string } | undefined => {
  const m = /^[0-9a-f]{2}-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}/.exec(tp);
  return m ? { traceId: m[1] ?? '', spanId: m[2] ?? '' } : undefined;
};

function receivedContext(
  ev: Evidence,
  label: string,
): { traceId: string; spanId: string } | undefined {
  const d = delivered(ev, label);
  if (!d) return undefined;
  const env = JSON.parse(d.envelopeText) as { traceContext?: { traceparent?: string } };
  return parseTraceparent(env.traceContext?.traceparent ?? '');
}

function observation(ev: Evidence, label: string): Observation | undefined {
  return ev.observations.find((o) => o.label === label);
}

const time = (v: Json | undefined): number | undefined =>
  v === undefined ? undefined : typeof v === 'number' ? v : Date.parse(String(v));

function evalOne(a: Assertion, c: Case, ev: Evidence): string[] {
  const f = (msg: string): string[] => [`${describe(a)}: ${msg}`];
  switch (a.kind) {
    case 'request-shape': {
      const r = oneRequest(ev.recording, a.request as RequestMatch);
      if (typeof r === 'string') return f(r);
      const out: string[] = [];
      const h = (a.headers ?? {}) as {
        present?: string[];
        absent?: string[];
        equals?: Record<string, string>;
      };
      for (const n of h.present ?? [])
        if (!(n.toLowerCase() in r.headers)) out.push(`header ${n} is absent`);
      for (const n of h.absent ?? [])
        if (n.toLowerCase() in r.headers) out.push(`header ${n} is present`);
      for (const [n, v] of Object.entries(h.equals ?? {})) {
        if (r.headers[n.toLowerCase()] !== v) out.push(`header ${n} is not the expected value`);
      }
      if (a.noBody === true && r.body.length > 0) out.push('the request has a body');
      if (a.members || a.schema || a.bodyAt !== undefined) {
        let body: unknown;
        try {
          body = JSON.parse(r.body.toString('utf8'));
        } catch {
          return [...out.map((m) => `${describe(a)}: ${m}`), ...f('the body is not JSON')];
        }
        if (a.members) {
          const m = a.members as { at?: string; exactly?: string[]; absent?: string[] };
          const obj = at(body, m.at ?? '');
          const keys = obj && typeof obj === 'object' ? Object.keys(obj).sort() : [];
          if (m.exactly && !isDeepStrictEqual(keys, [...m.exactly].sort())) {
            out.push(
              `members at ${m.at ?? '/'} are [${keys.join(', ')}], expected [${[...m.exactly].sort().join(', ')}]`,
            );
          }
          for (const k of m.absent ?? [])
            if (keys.includes(k)) out.push(`member ${k} is present at ${m.at ?? '/'}`);
        }
        if (a.schema) {
          const value = at(body, String(a.schemaAt ?? ''));
          const s = a.schema as ContractSchema;
          if (!validates(s, value)) out.push(`does not match ${s}: ${schemaErrors(s, value)}`);
          const negatives = expandFixtures(c.negativeFixtures ?? []).filter((x) =>
            x.startsWith(String(a.negativesFrom ?? '\0')),
          );
          const positives = expandFixtures((a.positives as string[] | undefined) ?? []);
          out.push(...proveMatcher(positives, negatives));
        }
        for (const [p, exp] of Object.entries((a.bodyAt ?? {}) as JsonObject)) {
          if (!matches(at(body, p), exp)) out.push(`body at ${p} is not as expected`);
        }
      }
      return out.map((m) => `${describe(a)}: ${m}`);
    }
    case 'request-exact': {
      const r = oneRequest(ev.recording, a.request as RequestMatch);
      if (typeof r === 'string') return f(r);
      const text = r.body.toString('utf8');
      const out: string[] = [];
      if (a.compact === true) {
        let exempt: { start: number; end: number } | undefined;
        try {
          exempt = rangeAt(text, '/draft/inbound/envelope');
        } catch {
          exempt = undefined;
        }
        out.push(...compactViolations(text, exempt).map((v) => `not compact JSON: ${v}`));
      }
      if (a.at !== undefined) {
        let span: string;
        try {
          span = spanAt(text, String(a.at));
        } catch (error) {
          return f(`no value at ${String(a.at)} (${(error as Error).message})`);
        }
        let expected: string | undefined;
        if (a.equalsEnvelopeOf) expected = delivered(ev, String(a.equalsEnvelopeOf))?.envelopeText;
        else if (a.equalsSealOf) {
          const d = delivered(ev, String(a.equalsSealOf));
          expected = d ? JSON.stringify(d.seal) : undefined;
        } else if (typeof a.equalsText === 'string') expected = a.equalsText;
        if (expected === undefined) out.push('nothing to compare with (unknown delivery label)');
        else if (span !== expected) {
          out.push(
            `the bytes at ${String(a.at)} differ from the expected text (${span.length} vs ${expected.length} bytes)`,
          );
        }
      }
      return out.map((m) => `${describe(a)}: ${m}`);
    }
    case 'request-count': {
      const n = requestsMatching(ev.recording, a.match as RequestMatch).length;
      if (typeof a.count === 'number' && n !== a.count)
        return f(`${n} requests, expected ${a.count}`);
      if (typeof a.min === 'number' && n < a.min)
        return f(`${n} requests, expected at least ${a.min}`);
      if (typeof a.max === 'number' && n > a.max)
        return f(`${n} requests, expected at most ${a.max}`);
      return [];
    }
    case 'request-timing': {
      if (a.minGapMs !== undefined) {
        const all = requestsMatching(ev.recording, a.requests as RequestMatch);
        for (let i = 1; i < all.length; i++) {
          const gap = (all[i]?.at ?? 0) - (all[i - 1]?.at ?? 0);
          if (gap < Number(a.minGapMs))
            return f(
              `requests ${i} and ${i + 1} are ${gap} ms apart, under ${String(a.minGapMs)} ms`,
            );
        }
        return [];
      }
      const r = oneRequest(ev.recording, a.request as RequestMatch);
      if (typeof r === 'string') return f(r);
      const out: string[] = [];
      const nb = time(a.notBefore);
      const na = time(a.notAfter);
      if (nb !== undefined && r.at < nb)
        out.push(`arrived ${nb - r.at} ms before its window opened`);
      if (na !== undefined && r.at > na)
        out.push(`arrived ${r.at - na} ms after its window closed`);
      if (a.afterRequest) {
        const o = oneRequest(ev.recording, a.afterRequest as RequestMatch);
        if (typeof o === 'string') out.push(o);
        else if (r.at < o.at) out.push('arrived before the request it must follow');
        else if (typeof a.minAfterMs === 'number' && r.at - o.at < a.minAfterMs) {
          out.push(
            `arrived ${r.at - o.at} ms after the request it follows, under ${a.minAfterMs} ms`,
          );
        }
      }
      if (a.beforeStreamClose) {
        const s = ev.streams.find((x) => x.label === a.beforeStreamClose);
        if (s?.closedAt !== undefined && r.at > s.closedAt)
          out.push(`arrived after stream ${String(a.beforeStreamClose)} closed`);
      }
      return out.map((m) => `${describe(a)}: ${m}`);
    }
    case 'observation': {
      const o = observation(ev, String(a.command));
      if (!o) return f(`no command labelled ${String(a.command)}`);
      const out: string[] = [];
      if (typeof a.ok === 'boolean' && o.ok !== a.ok) {
        out.push(
          o.ok ? 'succeeded, expected an error' : `failed: ${JSON.stringify(o.error ?? {})}`,
        );
      }
      for (const [p, exp] of Object.entries((a.error ?? {}) as JsonObject)) {
        // A key starting with '/' is a pointer into the error (`/problem/x-future`).
        const actual = p.startsWith('/') ? at(o.error, p) : o.error?.[p];
        if (!matches(actual, exp)) out.push(`error.${p} is ${JSON.stringify(actual ?? null)}`);
      }
      for (const [p, exp] of Object.entries((a.result ?? {}) as JsonObject)) {
        if (
          exp &&
          typeof exp === 'object' &&
          !Array.isArray(exp) &&
          typeof exp.differsFrom === 'string'
        ) {
          const other = observation(ev, exp.differsFrom);
          if (isDeepStrictEqual(at(o.result, p), at(other?.result, p))) {
            out.push(`result at ${p} equals that of ${exp.differsFrom}`);
          }
          continue;
        }
        if (!matches(at(o.result, p), exp))
          out.push(`result at ${p} is ${JSON.stringify(at(o.result, p) ?? null)}`);
      }
      return out.map((m) => `${describe(a)}: ${m}`);
    }
    case 'item-sequence': {
      const expected = (a.items ?? []) as JsonObject[];
      const got = ev.items;
      const out: string[] = [];
      if (a.exact !== false && got.length !== expected.length) {
        out.push(
          `saw ${got.length} items [${got.map((i) => String(i.kind)).join(', ')}], expected ${expected.length} [${expected.map((i) => String(i.kind)).join(', ')}]`,
        );
      }
      expected.forEach((e, k) => {
        const g = got[k];
        if (!g) return;
        for (const [p, exp] of Object.entries(e)) {
          if (p === 'envelopeTextOf') {
            if (g.envelopeText !== delivered(ev, String(exp))?.envelopeText)
              out.push(`item ${k + 1}: envelope text is not the delivered text of ${String(exp)}`);
          } else if (p === 'sealOf') {
            if (g.seal !== delivered(ev, String(exp))?.seal)
              out.push(`item ${k + 1}: seal is not that of ${String(exp)}`);
          } else if (!matches(at(g, `/${p}`), exp)) {
            out.push(
              `item ${k + 1}: ${p} is ${JSON.stringify(at(g, `/${p}`) ?? null)}, expected ${JSON.stringify(exp)}`,
            );
          }
        }
      });
      return out.map((m) => `${describe(a)}: ${m}`);
    }
    case 'runtime-check': {
      const o = observation(ev, String(a.command));
      if (!o?.result) return f(`no inspect result labelled ${String(a.command)}`);
      const out: string[] = [];
      for (const [p, exp] of Object.entries((a.expect ?? {}) as JsonObject)) {
        if (!matches(at(o.result, p), exp)) {
          const count = at(o.result, `${p.replace(/\/found$/, '')}/count`);
          out.push(
            `${p} is ${JSON.stringify(at(o.result, p) ?? null)}${count !== undefined ? ` (${String(count)} matches)` : ''}`,
          );
        }
      }
      return out.map((m) => `${describe(a)}: ${m}`);
    }
    case 'span': {
      const o = observation(ev, String(a.command));
      const spans = ((o?.result?.spans ?? []) as JsonObject[]).filter(
        (s) => !a.kindIs || s.kind === a.kindIs,
      );
      const out: string[] = [];
      if (typeof a.count === 'number' && spans.length !== a.count)
        out.push(`${spans.length} spans, expected ${a.count}`);
      for (const want of (a.spans ?? []) as JsonObject[]) {
        const candidates = spans.filter(
          (s) =>
            (want.kind === undefined || s.kind === want.kind) &&
            (want.name === undefined || matches(s.name, want.name)),
        );
        const ok = candidates.some((s) => spanMatches(s, want, ev).length === 0);
        if (!ok) {
          const why =
            candidates.length === 0
              ? 'no span of that kind and name'
              : spanMatches(candidates[0] ?? {}, want, ev).join('; ');
          out.push(
            `no span matches ${JSON.stringify({ kind: want.kind, name: want.name })}: ${why}`,
          );
        }
      }
      return out.map((m) => `${describe(a)}: ${m}`);
    }
    case 'surface': {
      const o = observation(ev, String(a.command));
      const listed = new Set([
        ...((o?.result?.names ?? []) as string[]),
        ...((o?.result?.members ?? []) as string[]),
      ]);
      const out: string[] = [];
      for (const n of (a.includes ?? []) as string[])
        if (!listed.has(n)) out.push(`${n} is not exposed`);
      for (const n of (a.excludes ?? []) as string[])
        if (listed.has(n)) out.push(`${n} is exposed`);
      if (a.excludesMatching) {
        const re = new RegExp(String(a.excludesMatching), 'i');
        for (const n of listed)
          if (re.test(n)) out.push(`${n} is exposed (matches ${String(a.excludesMatching)})`);
      }
      if (a.docIncludes) {
        const text = String(o?.result?.text ?? '');
        for (const s of a.docIncludes as string[])
          if (!text.includes(s)) out.push(`the documentation does not state "${s}"`);
      }
      return out.map((m) => `${describe(a)}: ${m}`);
    }
    case 'absence': {
      const out: string[] = [];
      if (a.noRequests === true && ev.recording.length > 0)
        out.push(`${ev.recording.length} requests were made`);
      if (typeof a.noRequestsTo === 'string') {
        const n = ev.recording.filter((r) => r.listener === a.noRequestsTo).length;
        if (n > 0) out.push(`${n} requests reached ${a.noRequestsTo}`);
      }
      if (typeof a.headerNeverSent === 'string') {
        const h = a.headerNeverSent.toLowerCase();
        if (ev.recording.some((r) => h in r.headers))
          out.push(`the header ${a.headerNeverSent} was sent`);
      }
      if (a.noSecretAnywhere === true) {
        for (const s of ev.secrets) {
          if (ev.stderr.includes(s)) out.push('the secret appears in the driver output');
          if (JSON.stringify(ev.observations).includes(s))
            out.push('the secret appears in an observation');
        }
      }
      if (typeof a.noCredentialIn === 'string') {
        const cred = String(a.noCredentialIn);
        if (ev.stderr.includes(cred) || JSON.stringify(ev.observations).includes(cred))
          out.push('the credential appears in the driver output or an observation');
      }
      if (typeof a.noBodyContains === 'string') {
        const needle = a.noBodyContains;
        if (ev.recording.some((r) => r.body.toString('utf8').includes(needle))) {
          out.push('a request body contains the forbidden value');
        }
      }
      if (
        typeof a.maxConcurrentStreams === 'number' &&
        ev.concurrentStreamsMax > a.maxConcurrentStreams
      ) {
        out.push(`${ev.concurrentStreamsMax} streams were open at once`);
      }
      return out.map((m) => `${describe(a)}: ${m}`);
    }
    default:
      return f('unknown assertion kind');
  }
}

function spanMatches(s: JsonObject, want: JsonObject, ev: Evidence): string[] {
  const out: string[] = [];
  const ctxOf = (ref: Json | undefined): { traceId: string; spanId: string } | undefined => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return undefined;
    if (typeof ref.receivedOf === 'string') return receivedContext(ev, ref.receivedOf);
    if (typeof ref.tenantSpanOf === 'string') {
      const t = observation(ev, ref.tenantSpanOf)?.result?.tenantSpan as JsonObject | undefined;
      return t ? { traceId: String(t.traceId), spanId: String(t.spanId) } : undefined;
    }
    if (typeof ref.draftOf === 'string') {
      const tc = observation(ev, ref.draftOf)?.result?.traceContext as JsonObject | undefined;
      return parseTraceparent(String(tc?.traceparent ?? ''));
    }
    return undefined;
  };
  if (want.parent === 'root') {
    if (s.parentSpanId) out.push('has a parent; expected a root span');
  } else if (want.parent) {
    const p = ctxOf(want.parent);
    if (!p) out.push('the expected parent is unknown');
    else if (s.traceId !== p.traceId || s.parentSpanId !== p.spanId)
      out.push('its parent is not the expected context');
  }
  if (want.sameAs) {
    const p = ctxOf(want.sameAs);
    if (!p || s.traceId !== p.traceId || s.spanId !== p.spanId)
      out.push('it is not the expected span');
  }
  if (want.traceIdOf) {
    const p = ctxOf(want.traceIdOf);
    if (!p || s.traceId !== p.traceId) out.push('its trace id is not the expected one');
  }
  const links = (s.links ?? []) as JsonObject[];
  if (want.links === 'none' && links.length > 0)
    out.push(`has ${links.length} links; expected none`);
  if (want.linksTo) {
    const p = ctxOf(want.linksTo);
    if (!p || !links.some((l) => l.traceId === p.traceId && l.spanId === p.spanId))
      out.push('does not link to the expected span');
  }
  if (want.notLinkedTo) {
    const p = ctxOf(want.notLinkedTo);
    if (p && links.some((l) => l.traceId === p.traceId && l.spanId === p.spanId))
      out.push('links to its own parent');
  }
  for (const [k, v] of Object.entries((want.attributes ?? {}) as JsonObject)) {
    if (!matches((s.attributes as JsonObject | undefined)?.[k], v))
      out.push(
        `attribute ${k} is ${JSON.stringify((s.attributes as JsonObject | undefined)?.[k] ?? null)}`,
      );
  }
  if (typeof want.noAttributePrefix === 'string') {
    for (const k of Object.keys((s.attributes ?? {}) as JsonObject)) {
      if (k.startsWith(want.noAttributePrefix)) out.push(`has attribute ${k}`);
    }
  }
  if (want.status && s.status !== want.status)
    out.push(`status is ${JSON.stringify(s.status ?? null)}`);
  return out;
}

export function evaluate(c: Case, assertions: Assertion[], ev: Evidence): string[] {
  const failures: string[] = [];
  for (const r of ev.recording) {
    if (r.unmatched)
      failures.push(`unscripted request: ${r.method} ${r.path} on ${r.listener} (answered 500)`);
  }
  for (const a of assertions) failures.push(...evalOne(a, c, ev));
  return failures;
}
