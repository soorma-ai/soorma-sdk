// SPDX-License-Identifier: Apache-2.0
//
// The SPDX check (NFR-09; NFR-U1-36): every source file carries
// `SPDX-License-Identifier: Apache-2.0` in its first five lines. JSON has no
// comments and is exempt; contract/ is vendored as is and exempt.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { git } from '../lib/git.ts';

export const SOURCE = /\.(ts|mts|cts|js|mjs|cjs|py|sh|ya?ml)$/;
export const EXEMPT = [
  /^contract\//,
  /^aidlc-docs\//,
  /(^|\/)node_modules\//,
  /^pnpm-lock\.yaml$/,
  /^\.e2e\//,
];
export const HEADER = 'SPDX-License-Identifier: Apache-2.0';

export function needsHeader(path: string): boolean {
  return SOURCE.test(path) && !EXEMPT.some((r) => r.test(path));
}

export function missingHeader(path: string, text: string): string | undefined {
  return text
    .split('\n')
    .slice(0, 5)
    .some((l) => l.includes(HEADER))
    ? undefined
    : `${path}: no "${HEADER}" in its first five lines`;
}

export function runSpdx(root: string): string[] {
  const files = git(['ls-files', '-co', '--exclude-standard'], root)
    .split('\n')
    .filter(needsHeader);
  return files.flatMap((f) => missingHeader(f, readFileSync(resolve(root, f), 'utf8')) ?? []);
}

if (import.meta.main) {
  const failures = runSpdx(resolve(import.meta.dirname, '..', '..'));
  for (const f of failures) console.error(`FAIL ${f}`);
  if (failures.length > 0) process.exitCode = 1;
  else console.log('spdx: every source file carries the licence header');
}
