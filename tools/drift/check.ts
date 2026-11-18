// SPDX-License-Identifier: Apache-2.0
//
// The contract drift check (FR-01; US-12 #1; NFR-U1-10 to -13; P-09).
//   local:  every file under contract/ hashes to contract.pin.json; nothing
//           missing or extra
//   remote: by git, never the REST API and never a token: `git ls-remote`
//           reads the tag's peeled commit; a `--depth 1` fetch of that commit
//           gives the tree id of contract/. Both must equal the pin.
// Fails closed: an unreachable remote fails. `--offline` runs the local half
// only, says so, and is refused in CI.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inCI } from '../lib/ci.ts';
import { git as realGit, type Git } from '../lib/git.ts';
import { hashTree, type Pin } from './pin.ts';

export function compareLocal(
  pinned: Record<string, string>,
  actual: Record<string, string>,
): string[] {
  const failures: string[] = [];
  for (const [path, hash] of Object.entries(pinned)) {
    if (!(path in actual)) failures.push(`missing: ${path} (pinned, not present)`);
    else if (actual[path] !== hash)
      failures.push(`differs: ${path} (its SHA-256 is not the pinned one)`);
  }
  for (const path of Object.keys(actual)) {
    if (!(path in pinned)) failures.push(`extra: ${path} (present, not pinned)`);
  }
  return failures;
}

export function checkRemote(pin: Pin, url: string, git: Git = realGit): string[] {
  let peeled: string;
  try {
    const out = git(['ls-remote', url, `refs/tags/${pin.tag}^{}`]);
    peeled = out.split(/\s+/)[0] ?? '';
  } catch (error) {
    return [
      `remote unreachable: git ls-remote ${url} failed (${firstLine(error)}); failing closed`,
    ];
  }
  if (!peeled) return [`remote: the tag ${pin.tag} was not found at ${url}; failing closed`];
  if (peeled !== pin.commit) {
    return [`remote: ${pin.tag} peels to ${peeled}, but the pin records ${pin.commit}`];
  }
  const scratch = mkdtempSync(join(tmpdir(), 'soorma-drift-'));
  try {
    git(['init', '-q', '--bare'], scratch);
    git(['fetch', '-q', '--depth', '1', url, pin.commit], scratch);
    const tree = git(['rev-parse', `${pin.commit}:contract`], scratch);
    return tree === pin.tree
      ? []
      : [`remote: contract/ at ${pin.commit} is tree ${tree}, but the pin records ${pin.tree}`];
  } catch (error) {
    return [
      `remote: fetching ${pin.commit} from ${url} failed (${firstLine(error)}); failing closed`,
    ];
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const firstLine = (error: unknown): string =>
  String((error as { stderr?: unknown }).stderr || (error as Error).message)
    .trim()
    .split('\n')[0] ?? '';

export function offlineRefusal(
  offline: boolean,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return offline && inCI(env)
    ? '--offline is refused in CI: the remote half must run there'
    : undefined;
}

export function runDrift(
  root: string,
  opts: { offline: boolean; env?: NodeJS.ProcessEnv; git?: Git },
): {
  ok: boolean;
  lines: string[];
} {
  const refusal = offlineRefusal(opts.offline, opts.env);
  if (refusal) return { ok: false, lines: [`FAIL ${refusal}`] };
  const pin = JSON.parse(readFileSync(resolve(root, 'contract.pin.json'), 'utf8')) as Pin;
  const failures = compareLocal(pin.files, hashTree(root, resolve(root, 'contract')));
  const lines = [`local half: ${Object.keys(pin.files).length} pinned files checked`];
  if (opts.offline) lines.push('remote half not run (--offline)');
  else {
    failures.push(...checkRemote(pin, pin.repository, opts.git));
    lines.push(`remote half: ${pin.tag} -> ${pin.commit}, contract/ tree ${pin.tree}`);
  }
  return { ok: failures.length === 0, lines: [...lines, ...failures.map((f) => `FAIL ${f}`)] };
}

if (import.meta.main) {
  const root = resolve(import.meta.dirname, '..', '..');
  const r = runDrift(root, { offline: process.argv.includes('--offline') });
  for (const l of r.lines) (l.startsWith('FAIL') ? console.error : console.log)(l);
  if (!r.ok) process.exitCode = 1;
}
