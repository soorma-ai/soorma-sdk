// SPDX-License-Identifier: Apache-2.0
//
// The run report. A secret appears only as its length; a heap-snapshot finding
// only as a count; the driver's stderr is never copied into it.

export type CaseStatus = 'pass' | 'fail' | 'not-run';

export interface CaseResult {
  id: string;
  statements: string[];
  status: CaseStatus;
  failures: string[];
  durationMs: number;
  reason?: string;
}

export interface Report {
  mode: string;
  fault?: string;
  language?: string;
  ok: boolean;
  problems: string[];
  results: CaseResult[];
  failed: string[];
  durationMs: number;
  budgetMs: number;
  overBudget: boolean;
  slowest: { id: string; durationMs: number }[];
}

export function summarise(r: Report): string {
  const lines: string[] = [];
  const pass = r.results.filter((x) => x.status === 'pass').length;
  const fail = r.results.filter((x) => x.status === 'fail').length;
  const notRun = r.results.filter((x) => x.status === 'not-run');
  lines.push(
    `conformance ${r.mode}${r.fault ? ` --fault ${r.fault}` : ''}${r.language ? ` (${r.language})` : ''}: ${pass} passed, ${fail} failed, ${notRun.length} not run, ${Math.round(r.durationMs / 1000)} s`,
  );
  for (const p of r.problems) lines.push(`PROBLEM ${p}`);
  for (const x of r.results.filter((y) => y.status === 'fail')) {
    lines.push(`FAIL ${x.id} [${x.statements.join(', ')}]`);
    for (const f of x.failures) lines.push(`     ${f}`);
  }
  for (const x of notRun.filter((y) => y.reason)) lines.push(`NOT RUN ${x.id}: ${x.reason ?? ''}`);
  if (r.overBudget) {
    lines.push(
      `OVER BUDGET: ${Math.round(r.durationMs / 1000)} s > ${Math.round(r.budgetMs / 1000)} s; slowest:`,
    );
    for (const s of r.slowest) lines.push(`     ${s.id} ${Math.round(s.durationMs)} ms`);
  }
  lines.push(r.ok ? 'RESULT: pass' : 'RESULT: fail');
  return lines.join('\n');
}
