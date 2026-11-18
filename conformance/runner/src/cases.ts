// SPDX-License-Identifier: Apache-2.0
//
// The case loader (P-02, P-03): reads conformance/cases/**/CC-*.json, checks
// each against case.schema.json, then the rules a schema cannot state:
//   - the file name is the case id
//   - every timing assertion bounded on both sides is at least twice the named
//     value it concerns wide (NFR-U1-06)
//   - the case timeout covers its latest scripted time plus a margin
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { sumTerms } from './template.ts';
import type { CaseScript, JsonObject, NamedValue, Values } from './types.ts';

export const CASES_DIR = resolve(import.meta.dirname, '..', '..', 'cases');
export const TIMEOUT_MARGIN_MS = 2000;

export interface Command {
  op: string;
  args?: JsonObject;
  label?: string;
}

export interface Case {
  id: string;
  title: string;
  statements: string[];
  fixtures?: string[];
  negativeFixtures?: string[];
  timeoutMs: number;
  values?: Values;
  requires?: { otelSdk?: boolean; noOtelSdk?: boolean; foreignOwner?: boolean; posix?: boolean };
  setup?: { files?: JsonObject[]; env?: Record<string, string> };
  script: CaseScript;
  commands: Command[];
  expect: JsonObject[];
  file: string;
}

const schema = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', 'case.schema.json'), 'utf8'),
) as object;
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);

function listCaseFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/^CC-[A-Z]{3}-\d{2}\.json$/.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

const TIME_EXPR = /\$\{(?:TIME|EPOCH):\+([^}]+)\}/g;

/** The latest time a case scripts or waits for, in ms after its start. */
export function latestScriptedMs(c: Case, values: Values): number {
  let latest = 0;
  // Times in responses (a credential expiring in ten minutes) are not waited
  // for; only the times a case asserts on, or waits for, must fit its timeout.
  const text = JSON.stringify([c.commands, c.expect.filter((a) => a.kind === 'request-timing')]);
  for (const m of text.matchAll(TIME_EXPR))
    latest = Math.max(latest, sumTerms(m[1] ?? '', { values }));
  let waits = 0;
  for (const cmd of c.commands) {
    // Only explicit waits are spent for sure; a `next` or `waitForRequest`
    // timeout is an upper bound, and a case past its own timeout fails anyway.
    if (cmd.op === 'wait') waits += Number(cmd.args?.ms ?? 0);
  }
  return Math.max(latest, waits);
}

export function ruleViolations(c: Case, defaults: Values): string[] {
  const values = { ...defaults, ...c.values };
  const out: string[] = [];
  if (basename(c.file) !== `${c.id}.json`)
    out.push(`${c.file}: file name differs from its id ${c.id}`);
  for (const a of c.expect) {
    if (
      a.kind !== 'request-timing' ||
      typeof a.notBefore !== 'string' ||
      typeof a.notAfter !== 'string'
    )
      continue;
    const name = a.value as NamedValue;
    const v = values[name];
    const from = /\+([^}]+)\}/.exec(a.notBefore)?.[1];
    const to = /\+([^}]+)\}/.exec(a.notAfter)?.[1];
    if (v === undefined || from === undefined || to === undefined) {
      out.push(`${c.id}: a two-sided timing window needs a named value and two time expressions`);
      continue;
    }
    const width = sumTerms(to, { values }) - sumTerms(from, { values });
    if (width < 2 * v)
      out.push(`${c.id}: timing window ${width} ms is narrower than twice ${name} (${2 * v} ms)`);
  }
  const latest = latestScriptedMs(c, values);
  if (c.timeoutMs < latest + TIMEOUT_MARGIN_MS) {
    out.push(
      `${c.id}: timeout ${c.timeoutMs} ms does not cover its latest scripted time ${latest} ms plus ${TIMEOUT_MARGIN_MS} ms`,
    );
  }
  return out;
}

export function loadCases(
  dir = CASES_DIR,
  defaults: Values = {},
): { cases: Case[]; errors: string[] } {
  const cases: Case[] = [];
  const errors: string[] = [];
  for (const file of listCaseFiles(dir)) {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(`${file}: not JSON (${(error as Error).message})`);
      continue;
    }
    if (!validate(data)) {
      errors.push(
        `${file}: ${(validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ')}`,
      );
      continue;
    }
    const c = { ...(data as Omit<Case, 'file'>), file };
    errors.push(...ruleViolations(c, defaults));
    cases.push(c);
  }
  return { cases, errors };
}
