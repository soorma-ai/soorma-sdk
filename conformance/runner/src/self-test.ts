// SPDX-License-Identifier: Apache-2.0
//
// The conformance self-test (U1's done when; business-logic-model §5.3): the
// reference driver passes every declared case in reference mode; then each
// negative control (the reference driver with one fault) must fail its named
// case, and its failed set must equal the declared expected set. The report
// prints each fault's expected and actual sets. Within 8 minutes in all.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startStub } from '../../stub/src/stub.ts';
import { runConformance, summarise } from './run.ts';

export const SELF_TEST_BUDGET_MS = 8 * 60_000;
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
export const REFERENCE = [
  'node',
  '--expose-gc',
  resolve(ROOT, 'conformance', 'reference-driver', 'src', 'driver.ts'),
];

export interface FaultSpec {
  fault: string;
  named: string;
  expected: string[];
}

export function judgeFault(spec: FaultSpec, failed: string[]): string[] {
  const actual = [...new Set(failed)].sort();
  const expected = [...spec.expected].sort();
  const out: string[] = [];
  if (!actual.includes(spec.named))
    out.push(`${spec.fault}: its named case ${spec.named} did not fail`);
  const outside = actual.filter((id) => !expected.includes(id));
  const missing = expected.filter((id) => !actual.includes(id));
  if (outside.length > 0)
    out.push(`${spec.fault}: failures outside the declared set: ${outside.join(', ')}`);
  if (missing.length > 0)
    out.push(`${spec.fault}: declared failures that did not happen: ${missing.join(', ')}`);
  return out;
}

async function main(): Promise<void> {
  const started = Date.now();
  const problems: string[] = [];
  const reference = await runConformance({ driver: REFERENCE, mode: 'reference' }, startStub);
  console.log(summarise(reference));
  const declared = reference.results.filter((r) => r.status !== 'not-run').length;
  if (!reference.ok) problems.push('the reference driver does not pass its declared cases');
  else console.log(`reference driver: all ${declared} declared cases pass`);

  const specs = (
    JSON.parse(
      readFileSync(resolve(ROOT, 'conformance', 'reference-driver', 'faults.json'), 'utf8'),
    ) as { faults: FaultSpec[] }
  ).faults;
  for (const spec of specs) {
    const r = await runConformance(
      { driver: REFERENCE, mode: 'reference', fault: spec.fault },
      startStub,
    );
    const verdict =
      r.problems.length > 0
        ? r.problems.map((p) => `${spec.fault}: ${p}`)
        : judgeFault(spec, r.failed);
    console.log(
      `fault ${spec.fault}: named ${spec.named}; expected [${[...spec.expected].sort().join(', ')}]; actual [${[...r.failed].sort().join(', ')}] -> ${verdict.length === 0 ? 'as declared' : 'NOT as declared'}`,
    );
    problems.push(...verdict);
  }
  const elapsed = Date.now() - started;
  if (elapsed > SELF_TEST_BUDGET_MS)
    problems.push(
      `the self-test took ${Math.round(elapsed / 1000)} s, over its ${SELF_TEST_BUDGET_MS / 1000} s budget`,
    );
  for (const p of problems) console.error(`FAIL ${p}`);
  console.log(
    problems.length === 0 ? `SELF-TEST: pass (${Math.round(elapsed / 1000)} s)` : 'SELF-TEST: fail',
  );
  if (problems.length > 0) process.exitCode = 1;
}

if (import.meta.main) await main();
