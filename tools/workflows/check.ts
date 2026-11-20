// SPDX-License-Identifier: Apache-2.0
//
// The workflow check (NFR-U1-28; P-10; P-04). In every workflow:
//   - each action is pinned to a 40-character commit SHA, with its tag in a
//     comment on the same line (local `./` actions excepted)
//   - every job runs on ubuntu-24.04
//   - permissions are exactly `contents: read`, at workflow level, and no job
//     widens them
//   - no step uploads the conformance run directory (heap snapshots and test
//     secrets stay private)
//   - no step uploads .e2e/, the end-to-end stack's clone, secrets and stack
//     description (U2 NFR-U2-13)
//   - the end-to-end jobs (`changes`, `e2e`, `e2e-*`) reference no repository
//     secret: they run a stack from soorma-core's code (U2 NFR-U2-13)
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

export const RUNNER = 'ubuntu-24.04';
export const RUN_DIR_MARKERS = ['soorma-conformance-run', 'runner.temp', '/tmp'];
export const E2E_DIR = '.e2e';

/** The end-to-end jobs: the `changes` gate and every `e2e` or `e2e-*` job. */
export const isEndToEndJob = (name: string): boolean =>
  name === 'changes' || /^e2e(-|$)/.test(name);

type Json = Record<string, unknown>;

const isReadOnly = (p: unknown): boolean =>
  typeof p === 'object' &&
  p !== null &&
  Object.keys(p).length === 1 &&
  (p as Json).contents === 'read';

export function checkWorkflow(file: string, text: string): string[] {
  const failures: string[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const m = /^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*(#.*)?$/.exec(line);
    if (!m) return;
    const ref = m[1] ?? '';
    if (ref.startsWith('./')) return;
    if (!/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(ref)) {
      failures.push(`${file}:${i + 1}: ${ref} is not pinned to a commit SHA`);
    } else if (!/^#\s*v?\d[\w.-]*/.test((m[2] ?? '').trim())) {
      failures.push(`${file}:${i + 1}: ${ref} has no tag comment (# vX.Y.Z)`);
    }
  });
  let doc: Json;
  try {
    doc = (parse(text) ?? {}) as Json;
  } catch (error) {
    return [...failures, `${file}: not valid YAML (${(error as Error).message})`];
  }
  if (!isReadOnly(doc.permissions))
    failures.push(`${file}: workflow permissions must be exactly contents: read`);
  for (const [name, job] of Object.entries((doc.jobs ?? {}) as Record<string, Json>)) {
    if (job['runs-on'] !== RUNNER) {
      failures.push(
        `${file}: job ${name} runs on ${JSON.stringify(job['runs-on'])}, not ${RUNNER}`,
      );
    }
    if ('permissions' in job && !isReadOnly(job.permissions)) {
      failures.push(`${file}: job ${name} widens permissions beyond contents: read`);
    }
    if (isEndToEndJob(name) && /\bsecrets\./.test(JSON.stringify(job))) {
      failures.push(`${file}: end-to-end job ${name} references a repository secret`);
    }
    for (const step of (job.steps ?? []) as Json[]) {
      const uses = String(step.uses ?? '');
      const path = String(((step.with ?? {}) as Json).path ?? '');
      if (
        uses.startsWith('actions/upload-artifact@') &&
        RUN_DIR_MARKERS.some((m) => path.includes(m))
      ) {
        failures.push(
          `${file}: job ${name} uploads ${path}: the conformance run directory never leaves the run`,
        );
      }
      if (uses.startsWith('actions/upload-artifact@') && path.includes(E2E_DIR)) {
        failures.push(
          `${file}: job ${name} uploads ${path}: .e2e/ (the stack's clone and secrets) never leaves the run`,
        );
      }
    }
  }
  return failures;
}

export function runWorkflows(root: string): string[] {
  const dir = resolve(root, '.github', 'workflows');
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) => checkWorkflow(`.github/workflows/${f}`, readFileSync(join(dir, f), 'utf8')));
}

if (import.meta.main) {
  const failures = runWorkflows(resolve(import.meta.dirname, '..', '..'));
  for (const f of failures) console.error(`FAIL ${f}`);
  if (failures.length > 0) process.exitCode = 1;
  else
    console.log(
      'workflows: pinned, ubuntu-24.04, read-only, no run-directory or .e2e upload, no secret in the end-to-end jobs',
    );
}
