// SPDX-License-Identifier: Apache-2.0
//
// `pnpm checks`: every repository check (US-12, US-13; NFR-U1-10 to -13, -23,
// -28, -36). `--offline` passes to the drift check (local half only; refused
// in CI). Each check reports on its own; any failure fails the run.
import { resolve } from 'node:path';
import { runDrift } from './drift/check.ts';
import { runGeneratedTypes } from './generated-types/check.ts';
import { runNames } from './names/check.ts';
import { runPackaging } from './packaging/check.ts';
import { runSpdx } from './spdx/check.ts';
import { runWorkflows } from './workflows/check.ts';

const root = resolve(import.meta.dirname, '..');
let failed = false;
const report = (name: string, failures: string[], ok: string): void => {
  if (failures.length === 0) console.log(`ok    ${name}: ${ok}`);
  else {
    failed = true;
    for (const f of failures) console.error(`FAIL  ${name}: ${f.replace(/^FAIL /, '')}`);
  }
};

const drift = runDrift(root, { offline: process.argv.includes('--offline') });
report(
  'contract drift',
  drift.ok ? [] : drift.lines.filter((l) => l.startsWith('FAIL')),
  drift.lines.join('; '),
);
report('spdx', runSpdx(root), 'every source file carries the licence header');
report(
  'workflows',
  runWorkflows(root),
  'pinned by SHA, ubuntu-24.04, contents: read, no run-directory upload',
);
const gen = runGeneratedTypes(root);
report(
  'generated types',
  gen.failures,
  gen.checked === 0 ? 'no package yet (inert until U3)' : `${gen.checked} package(s)`,
);
const names = await runNames(root);
report(
  'names',
  names.failures,
  names.checked === 0 ? 'no driver yet (inert until U3)' : `${names.checked} language(s)`,
);
const pack = runPackaging(root);
report(
  'packaging',
  pack.failures,
  pack.checked === 0 ? 'no package yet (inert until U3)' : `${pack.checked} package(s)`,
);
if (failed) process.exitCode = 1;
