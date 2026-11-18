// SPDX-License-Identifier: Apache-2.0
//
// The audit-exceptions check (U1 Step 1a; the user's direction, 2026-11-18).
// An audit exception is ignored by advisory id only (pnpm-workspace.yaml,
// auditConfig.ignoreGhsas) and recorded in register.json and DEPENDENCIES.md.
// It expires by itself: this check fails once
//   1. a release of the package outside the affected range is installable:
//      published longer ago than the release cooldown (minimumReleaseAge in
//      pnpm-workspace.yaml, read from there), by the registry's `time` field, or
//   2. no installed version of the package matches the range any more,
// and when the ignore list and the register disagree. The exception is then
// removed in a recorded change. A fix still inside the cooldown cannot be
// installed yet, so it passes with a notice naming the version and the time it
// becomes installable (the user's direction on PR #10). A fix without a publish
// time, a missing cooldown and network failures fail the check (fail closed).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRelease, satisfies } from '../lib/semver.ts';

export interface AuditException {
  ghsa: string;
  package: string;
  severity: string;
  affectedRange: string;
  fixedIn: string | null;
  paths: string[];
  scope: string;
  removeWhen: string;
}

export interface Facts {
  /** Advisory ids pnpm-workspace.yaml ignores. */
  ignored: string[];
  /** Installed versions per package, from pnpm-lock.yaml. */
  installed: Record<string, string[]>;
  /** Published versions per package with their publish times (ISO 8601), from the npm registry's `time` field. */
  published: Record<string, Record<string, string | undefined>>;
  /** The release cooldown in minutes (minimumReleaseAge), or null when it is not set. */
  cooldownMinutes: number | null;
  /** The time the check runs. */
  now: Date;
}

export interface Outcome {
  failures: string[];
  notices: string[];
}

export function evaluate(register: AuditException[], facts: Facts): Outcome {
  const failures: string[] = [];
  const notices: string[] = [];
  if (facts.cooldownMinutes === null && register.length > 0) {
    failures.push('minimumReleaseAge is not set in pnpm-workspace.yaml (failing closed)');
  }
  const registered = new Set(register.map((e) => e.ghsa));
  for (const id of facts.ignored) {
    if (!registered.has(id))
      failures.push(`${id} is ignored in pnpm-workspace.yaml but not registered`);
  }
  for (const e of register) {
    if (!facts.ignored.includes(e.ghsa)) {
      failures.push(
        `${e.ghsa} is registered but not ignored in pnpm-workspace.yaml: remove the stale entry`,
      );
    }
    const published = facts.published[e.package];
    if (!published) {
      failures.push(`${e.ghsa}: no registry data for ${e.package} (failing closed)`);
    } else if (facts.cooldownMinutes !== null) {
      const cooldownMs = facts.cooldownMinutes * 60_000;
      const candidates = Object.keys(published).filter(
        (v) => parseRelease(v) && !satisfies(v, e.affectedRange),
      );
      const installable: string[] = [];
      for (const v of candidates) {
        const raw = published[v];
        const at = raw === undefined ? NaN : Date.parse(raw);
        if (Number.isNaN(at)) {
          failures.push(
            `${e.ghsa}: ${e.package} ${v} is outside ${e.affectedRange} but has no publish time (failing closed)`,
          );
        } else if (facts.now.getTime() - at >= cooldownMs) {
          installable.push(v);
        } else {
          notices.push(
            `${e.ghsa}: ${e.package} ${v} is outside ${e.affectedRange} but inside the release cooldown (minimumReleaseAge ${facts.cooldownMinutes} minutes); it becomes installable at ${new Date(at + cooldownMs).toISOString()}`,
          );
        }
      }
      if (installable.length > 0) {
        failures.push(
          `${e.ghsa}: ${e.package} ${installable.join(', ')} published outside ${e.affectedRange} and past the release cooldown; upgrade and remove the exception`,
        );
      }
    }
    const installed = (facts.installed[e.package] ?? []).filter((v) =>
      satisfies(v, e.affectedRange),
    );
    if (installed.length === 0) {
      failures.push(
        `${e.ghsa}: no installed ${e.package} matches ${e.affectedRange}; remove the exception`,
      );
    }
  }
  return { failures, notices };
}

/** minimumReleaseAge from pnpm-workspace.yaml, in minutes; null when absent. */
export function cooldownFromWorkspace(yaml: string): number | null {
  const m = /^minimumReleaseAge:\s*(\d+)\s*(?:#.*)?$/m.exec(yaml);
  return m ? Number(m[1]) : null;
}

export function ignoredFromWorkspace(yaml: string): string[] {
  const lines = yaml.split('\n');
  const start = lines.findIndex((l) => /^\s*ignoreGhsas:\s*$/.test(l));
  if (start === -1) return [];
  const ids: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const m = /^\s+-\s+(\S+)\s*$/.exec(line);
    if (!m) break;
    ids.push(m[1] ?? '');
  }
  return ids;
}

export function installedFromLock(lock: string, pkg: string): string[] {
  const re = new RegExp(
    `^  '?${pkg.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}@(\\d+\\.\\d+\\.\\d+)'?:`,
    'gm',
  );
  return [...new Set([...lock.matchAll(re)].map((m) => m[1] ?? ''))];
}

/** Every published version with its publish time. The full document carries `time`; the abbreviated one does not. */
export function publishedFromDocument(body: {
  versions?: Record<string, unknown>;
  time?: Record<string, string>;
}): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const v of Object.keys(body.versions ?? {})) out[v] = body.time?.[v];
  return out;
}

async function publishedFromRegistry(pkg: string): Promise<Record<string, string | undefined>> {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`registry answered ${res.status} for ${pkg}`);
  return publishedFromDocument(
    (await res.json()) as { versions?: Record<string, unknown>; time?: Record<string, string> },
  );
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, '..', '..');
  const register = (
    JSON.parse(readFileSync(resolve(import.meta.dirname, 'register.json'), 'utf8')) as {
      exceptions: AuditException[];
    }
  ).exceptions;
  const workspace = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8');
  const lock = readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8');
  const facts: Facts = {
    ignored: ignoredFromWorkspace(workspace),
    installed: {},
    published: {},
    cooldownMinutes: cooldownFromWorkspace(workspace),
    now: new Date(),
  };
  for (const e of register) {
    facts.installed[e.package] = installedFromLock(lock, e.package);
    try {
      facts.published[e.package] = await publishedFromRegistry(e.package);
    } catch (error) {
      console.error(`registry read failed for ${e.package}: ${(error as Error).message}`);
    }
  }
  const { failures, notices } = evaluate(register, facts);
  for (const n of notices) console.log(`NOTICE ${n}`);
  for (const e of register) {
    console.log(
      `${e.ghsa} ${e.package} ${e.affectedRange}: installed ${(facts.installed[e.package] ?? []).join(', ') || 'none'}`,
    );
  }
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL ${f}`);
    process.exitCode = 1;
  } else {
    console.log('audit exceptions: every exception is still needed and registered');
  }
}

if (import.meta.main) await main();
