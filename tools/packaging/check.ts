// SPDX-License-Identifier: Apache-2.0
//
// The packaging guard (NFR-U1-23; P-10; I8). Test-only code (the conformance
// runner, stub, reference driver and faults, the repository checks, and the
// end-to-end stack's raw calls, U2 GEN-03) never ships in an SDK package: no
// published file under conformance/, tools/ or e2e/, and no dependency on them.
// Inert until a package is listed in packages.json.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const FORBIDDEN_DEP = /^@soorma-sdk\/(tools|e2e|conformance-[\w-]+|reference-driver|runner|stub)$/;
const FORBIDDEN_PATH = /(^|\/)(conformance|tools|e2e|reference-driver|test-fixtures)(\/|$)/;

interface Manifest {
  name?: string;
  files?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.venv') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out;
}

const FORBIDDEN_PY =
  /^(soorma[-_]sdk[-_](tools|e2e|conformance|reference[-_]driver|runner|stub)|conformance|tools|e2e)\b/i;

/**
 * A Python package (added at U4): its `pyproject.toml` dependencies name no
 * test-only code, and nothing it would publish (the module under `src/`, less
 * what the build excludes) sits on a test-only path. The built wheel and sdist
 * are checked again by package-python (NFR-U4-29).
 */
export function checkPythonPackage(dir: string): string[] {
  const text = readFileSync(join(dir, 'pyproject.toml'), 'utf8');
  const name = /^name\s*=\s*"([^"]+)"/m.exec(text)?.[1] ?? dir;
  const failures: string[] = [];
  const deps = /^dependencies\s*=\s*\[([^\]]*)\]/m.exec(text)?.[1] ?? '';
  for (const m of deps.matchAll(/"([^"]+)"/g)) {
    const dep = (m[1] ?? '').trim();
    if (FORBIDDEN_PY.test(dep) || /(^|[\s@/])(conformance|tools|e2e)(\/|$)/.test(dep))
      failures.push(`${name}: dependencies names test-only ${dep}`);
  }
  const excluded = [
    ...(/^source-exclude\s*=\s*\[([^\]]*)\]/m.exec(text)?.[1] ?? '').matchAll(/"([^"]+)"/g),
  ].map((m) => (m[1] ?? '').replace(/\/$/, ''));
  const src = join(dir, 'src');
  if (existsSync(src)) {
    for (const f of listFiles(src).map((f) => `src/${f}`)) {
      if (/(^|\/)(__pycache__)(\/|$)/.test(f)) continue;
      if (excluded.some((e) => f === e || f.startsWith(`${e}/`))) continue;
      if (FORBIDDEN_PATH.test(f)) failures.push(`${name}: would publish ${f}`);
    }
  }
  return failures;
}

export function checkPackage(dir: string): string[] {
  if (!existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'pyproject.toml')))
    return checkPythonPackage(dir);
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest;
  const name = manifest.name ?? dir;
  const failures: string[] = [];
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const) {
    for (const [dep, spec] of Object.entries(manifest[field] ?? {})) {
      if (FORBIDDEN_DEP.test(dep) || /(^|[:/])(conformance|tools|e2e)(\/|$)/.test(spec)) {
        failures.push(`${name}: ${field} names test-only ${dep}@${spec}`);
      }
    }
  }
  for (const entry of manifest.files ?? []) {
    if (entry.startsWith('..') || FORBIDDEN_PATH.test(entry))
      failures.push(`${name}: files lists ${entry}`);
  }
  const published = manifest.files
    ? listFiles(dir).filter((f) =>
        (manifest.files ?? []).some((e) => f === e || f.startsWith(`${e.replace(/\/$/, '')}/`)),
      )
    : listFiles(dir);
  for (const f of published)
    if (FORBIDDEN_PATH.test(f)) failures.push(`${name}: would publish ${f}`);
  return failures;
}

export function runPackaging(root: string): { failures: string[]; checked: number } {
  const dirs = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'packages.json'), 'utf8'),
  ) as string[];
  return { failures: dirs.flatMap((d) => checkPackage(resolve(root, d))), checked: dirs.length };
}

if (import.meta.main) {
  const { failures, checked } = runPackaging(resolve(import.meta.dirname, '..', '..'));
  for (const f of failures) console.error(`FAIL ${f}`);
  if (failures.length > 0) process.exitCode = 1;
  else
    console.log(
      checked === 0
        ? 'packaging: no package yet (inert until U3)'
        : `packaging: ${checked} package(s) hold no test-only code`,
    );
}
