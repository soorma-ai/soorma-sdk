// SPDX-License-Identifier: Apache-2.0
//
// Reads spec/behaviour.md: every numbered statement (`| CFG-01 | ... |`) with
// its text, its sources and the conformance cases it names. A statement that
// names no case states why (checked elsewhere, by construction, or per
// language); those are the exemptions the link check accepts.
import { readFileSync } from 'node:fs';

export interface Statement {
  id: string;
  area: string;
  text: string;
  sources: string;
  cases: string[];
  /** Why a statement names no case, when it names none. */
  exemption?: string;
}

const ROW = /^\| ([A-Z]{3}-\d{2}) \| (.*) \| (.*) \| (.*) \|$/;
const CASE = /\bCC-[A-Z]{3}-\d{2}\b/g;

export function parseStatements(markdown: string): Statement[] {
  const out: Statement[] = [];
  const seen = new Set<string>();
  for (const line of markdown.split('\n')) {
    const m = ROW.exec(line);
    if (!m) continue;
    const [, id = '', text = '', sources = '', casesCell = ''] = m;
    if (seen.has(id)) throw new Error(`statement ${id} is defined twice`);
    seen.add(id);
    const cases = [...new Set(casesCell.match(CASE) ?? [])];
    const s: Statement = { id, area: id.slice(0, 3), text, sources, cases };
    if (cases.length === 0) s.exemption = casesCell.replace(/^\(|\)$/g, '').trim();
    out.push(s);
  }
  return out;
}

export function loadStatements(path: string): Statement[] {
  return parseStatements(readFileSync(path, 'utf8'));
}
