// SPDX-License-Identifier: Apache-2.0
//
// The generated-types check (FR-01; US-12 #2). For each language package
// listed in packages.json: run its generator from the vendored contract into a
// scratch directory and compare with the committed types, file by file. Inert
// until a package is listed (U3 lists TypeScript; U4 Python).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { hashTree } from '../drift/pin.ts';

export interface GeneratedPackage {
  name: string;
  /** The generator command; `{out}` is replaced by the scratch directory. */
  generate: string[];
  /** The committed generated types, relative to the repository root. */
  committed: string;
}

export function compareGenerated(
  committed: Record<string, string>,
  fresh: Record<string, string>,
  label: string,
): string[] {
  const failures: string[] = [];
  for (const [p, h] of Object.entries(fresh)) {
    if (!(p in committed)) failures.push(`${label}: ${p} is generated but not committed`);
    else if (committed[p] !== h)
      failures.push(`${label}: ${p} differs from what the contract generates`);
  }
  for (const p of Object.keys(committed)) {
    if (!(p in fresh)) failures.push(`${label}: ${p} is committed but no longer generated`);
  }
  return failures;
}

/** Interpreter caches (Python's `__pycache__`, added at U4) are never committed or generated. */
export function withoutCaches(tree: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(tree).filter(([p]) => !/(^|\/)__pycache__\//.test(p)));
}

export function checkPackage(root: string, pkg: GeneratedPackage): string[] {
  const committedDir = resolve(root, pkg.committed);
  if (!existsSync(committedDir)) return [`${pkg.name}: ${pkg.committed} does not exist`];
  const out = mkdtempSync(join(tmpdir(), 'soorma-generated-'));
  try {
    const [cmd = '', ...args] = pkg.generate.map((a) => a.replace('{out}', out));
    execFileSync(cmd, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
    return compareGenerated(
      withoutCaches(hashTree(committedDir, committedDir)),
      withoutCaches(hashTree(out, out)),
      pkg.name,
    );
  } catch (error) {
    return [`${pkg.name}: the generator failed (${(error as Error).message.split('\n')[0]})`];
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

export function runGeneratedTypes(
  root: string,
  list = resolve(import.meta.dirname, 'packages.json'),
): {
  failures: string[];
  checked: number;
} {
  const packages = JSON.parse(readFileSync(list, 'utf8')) as GeneratedPackage[];
  return { failures: packages.flatMap((p) => checkPackage(root, p)), checked: packages.length };
}

if (import.meta.main) {
  const { failures, checked } = runGeneratedTypes(resolve(import.meta.dirname, '..', '..'));
  for (const f of failures) console.error(`FAIL ${f}`);
  if (failures.length > 0) process.exitCode = 1;
  else
    console.log(
      checked === 0
        ? 'generated types: no package yet (inert until U3)'
        : `generated types: ${checked} package(s) match the contract`,
    );
}
