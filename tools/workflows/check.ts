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
//   - the DCO workflow, and any workflow on pull_request_target, never checks
//     out, installs or runs anything from the pull request it judges (OBL-03):
//     it triggers on pull_request_target only (under pull_request the pull
//     request supplies the workflow file itself); every checkout is exactly the
//     base commit; no step changes the working tree to other commits or
//     installs dependencies; the pull request's commits are fetched as data
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

export const DCO_WORKFLOW = 'dco.yml';
export const BASE_SHA = '${{ github.event.pull_request.base.sha }}';
/** A git command that puts other commits in the working tree, or applies them. */
const TREE_CHANGING_GIT =
  /\bgit\s+(?:checkout|switch|worktree|reset|restore|merge|rebase|cherry-pick|am|apply|pull|stash|read-tree|checkout-index)\b/;
/** Installing dependencies, which runs the installed packages' code. */
const INSTALL =
  /\b(?:npm\s+(?:ci|install|i)\b|pnpm\s+(?:install|i|add)\b|yarn\b|npx\b|pip\s+install|uv\s+(?:sync|pip|run|tool)\b)/;

const triggers = (on: unknown): string[] =>
  typeof on === 'string'
    ? [on]
    : Array.isArray(on)
      ? on.map(String)
      : typeof on === 'object' && on !== null
        ? Object.keys(on)
        : [];

/**
 * OBL-03: a workflow that judges a pull request runs only the base branch's code.
 * Applies to dco.yml, and to any workflow triggered by pull_request_target.
 */
export function checkJudgingWorkflow(file: string, doc: Record<string, unknown>): string[] {
  const on = triggers(doc.on ?? doc[true as unknown as string]);
  const isDco = file.endsWith(`/${DCO_WORKFLOW}`) || file === DCO_WORKFLOW;
  if (!isDco && !on.includes('pull_request_target')) return [];
  const failures: string[] = [];
  if (isDco && (on.length !== 1 || on[0] !== 'pull_request_target')) {
    failures.push(
      `${file}: triggers on ${JSON.stringify(on)}: the DCO workflow runs on pull_request_target only (under pull_request the pull request supplies this file)`,
    );
  }
  for (const [name, job] of Object.entries(
    (doc.jobs ?? {}) as Record<string, Record<string, unknown>>,
  )) {
    for (const step of (job.steps ?? []) as Record<string, unknown>[]) {
      const uses = String(step.uses ?? '');
      const w = (step.with ?? {}) as Record<string, unknown>;
      if (uses.startsWith('actions/checkout@')) {
        if (w.ref !== BASE_SHA || 'repository' in w) {
          failures.push(
            `${file}: job ${name} checks out ${JSON.stringify(w.ref ?? '(the default ref)')}${'repository' in w ? ` from ${JSON.stringify(w.repository)}` : ''}: only ${BASE_SHA} may be checked out`,
          );
        }
      }
      const code = `${String(step.run ?? '')}\n${String(w.script ?? '')}`;
      if (TREE_CHANGING_GIT.test(code)) {
        failures.push(
          `${file}: job ${name} runs a git command that puts the pull request's commits in the working tree`,
        );
      }
      if (INSTALL.test(code)) {
        failures.push(
          `${file}: job ${name} installs or runs packages: nothing from the pull request runs`,
        );
      }
      for (const m of String(w.script ?? '').matchAll(/\b(?:import|require)\(\s*['"`]([^'"`]*)/g)) {
        if (!(m[1] ?? '').startsWith('${{ github.workspace }}/tools/')) {
          failures.push(
            `${file}: job ${name} loads ${JSON.stringify(m[1])}: only the base checkout's tools/ may run`,
          );
        }
      }
    }
  }
  return failures;
}

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
  failures.push(...checkJudgingWorkflow(file, doc));
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
