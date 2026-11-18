// SPDX-License-Identifier: Apache-2.0
//
// The link check (FR-02, FR-03; US-13 #2): every statement names its cases and
// every case names its statements, both ways; a statement naming no case
// states why. The fixture check (US-14 #3): every agent-side contract fixture
// is referenced by some case.
import type { Case } from './cases.ts';
import { allFixtures, expandFixtures, isAgentSide } from './contract.ts';
import type { Statement } from './spec.ts';

export function linkFailures(statements: Statement[], cases: Case[]): string[] {
  const out: string[] = [];
  const byStatement = new Map(statements.map((s) => [s.id, s]));
  const byCase = new Map(cases.map((c) => [c.id, c]));
  for (const s of statements) {
    if (s.cases.length === 0 && !s.exemption)
      out.push(`${s.id} names no case and states no exemption`);
    for (const id of s.cases) {
      const c = byCase.get(id);
      if (!c) out.push(`${s.id} names ${id}, which does not exist`);
      else if (!c.statements.includes(s.id))
        out.push(`${s.id} names ${id}, but ${id} does not name ${s.id}`);
    }
  }
  for (const c of cases) {
    for (const id of c.statements) {
      const s = byStatement.get(id);
      if (!s) out.push(`${c.id} names ${id}, which is not a statement`);
      else if (!s.cases.includes(c.id))
        out.push(`${c.id} names ${id}, but ${id} does not name ${c.id}`);
    }
  }
  return out;
}

export function unreferencedFixtures(cases: Case[], all = allFixtures()): string[] {
  const referenced = new Set(
    cases.flatMap((c) =>
      expandFixtures([...(c.fixtures ?? []), ...(c.negativeFixtures ?? [])], all),
    ),
  );
  return all.filter((f) => isAgentSide(f) && !referenced.has(f));
}

export function unknownFixtures(cases: Case[], all = allFixtures()): string[] {
  const known = new Set(all);
  return cases.flatMap((c) =>
    expandFixtures([...(c.fixtures ?? []), ...(c.negativeFixtures ?? [])], all)
      .filter((f) => !known.has(f))
      .map((f) => `${c.id} references ${f}, which is not a contract fixture`),
  );
}
