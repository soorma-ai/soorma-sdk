// SPDX-License-Identifier: Apache-2.0
//
// The @opentelemetry/api floor run (NFR-U3-16; TS-U3-06): @soorma/sdk's peer
// range is ^1.9.0, and conformance runs once at 1.9.0. The floor is locked like
// every other dependency (NFR-U1-24): tools/'s development dependency
// `opentelemetry-api-floor` is `npm:@opentelemetry/api@1.9.0`, installed by the
// frozen install with its integrity checked. In CI's 1.9.0 matrix entry, after
// that install, this replaces the one installed copy of @opentelemetry/api
// with the floor's files, so the package, its tests' OpenTelemetry SDK and the
// driver all share one API at 1.9.0, as a tenant's install at the floor would.
// Nothing is resolved from the registry. It rewrites node_modules, so it runs
// only in CI, or locally with --local (restore with
// `pnpm install --frozen-lockfile --force`).
import { cpSync, existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { inCI } from '../lib/ci.ts';

export const FLOOR = '1.9.0';
const API = join('@opentelemetry', 'api');
/** The packages whose copy of the API must be the floor after the swap. */
export const CONSUMERS = ['@opentelemetry/sdk-trace-base', '@opentelemetry/context-async-hooks'];

const version = (dir: string): string =>
  (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string }).version;

/** Where Node would find `name` from `from`: the nearest node_modules/<name>, real path. */
export function findPackage(from: string, name: string): string | undefined {
  for (let d = resolve(from); ; d = dirname(d)) {
    const candidate = join(d, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    if (dirname(d) === d) return undefined;
  }
}

/** The API as seen from the package and from each consumer: real path and version. */
export function apiCopies(root: string): { from: string; dir: string; version: string }[] {
  const pkg = join(root, 'typescript');
  const out: { from: string; dir: string; version: string }[] = [];
  const api = findPackage(pkg, API);
  if (api) out.push({ from: '@soorma/sdk', dir: api, version: version(api) });
  for (const c of CONSUMERS) {
    const dir = findPackage(pkg, c);
    const seen = dir ? findPackage(dir, API) : undefined;
    if (seen) out.push({ from: c, dir: seen, version: version(seen) });
  }
  return out;
}

export function useFloor(root: string): { replaced: string; was: string } {
  const floor = findPackage(join(root, 'tools'), 'opentelemetry-api-floor');
  if (!floor) throw new Error('opentelemetry-api-floor is not installed: run the frozen install');
  if (version(floor) !== FLOOR)
    throw new Error(`opentelemetry-api-floor is ${version(floor)}, expected ${FLOOR}`);
  const target = findPackage(join(root, 'typescript'), API);
  if (!target) throw new Error('@opentelemetry/api is not installed for typescript/');
  const store = join(realpathSync(root), 'node_modules', '.pnpm') + sep;
  // Only ever a pnpm store copy of the API, never anything else.
  if (!target.startsWith(store) || !target.endsWith(`${sep}node_modules${sep}${API}`))
    throw new Error(`refusing to replace ${target}: not a store copy of @opentelemetry/api`);
  if (target === floor) throw new Error('the installed API is the floor copy itself');
  const was = version(target);
  rmSync(target, { recursive: true, force: true });
  cpSync(floor, target, { recursive: true, dereference: true });
  const copies = apiCopies(root);
  const wrong = copies.filter((c) => c.version !== FLOOR || c.dir !== target);
  if (copies.length !== CONSUMERS.length + 1 || wrong.length > 0)
    throw new Error(`after the swap: ${JSON.stringify(copies)}`);
  return { replaced: target, was };
}

if (import.meta.main) {
  if (!inCI() && !process.argv.includes('--local')) {
    console.error(
      'use-floor rewrites node_modules: it runs in CI, or locally with --local (then restore with pnpm install --frozen-lockfile --force)',
    );
    process.exit(2);
  }
  const root = resolve(import.meta.dirname, '..', '..');
  const { replaced, was } = useFloor(root);
  console.log(`@opentelemetry/api ${was} -> ${FLOOR} at ${replaced}`);
  for (const c of apiCopies(root)) console.log(`  ${c.from} sees @opentelemetry/api ${c.version}`);
}
