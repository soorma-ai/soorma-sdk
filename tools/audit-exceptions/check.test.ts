// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  cooldownFromWorkspace,
  evaluate,
  ignoredFromWorkspace,
  installedFromLock,
  publishedFromDocument,
  type AuditException,
  type Facts,
} from './check.ts';

// Recorded advisory data: GHSA-fc5q-39xc-vjpf, published 2026-10-19, picomatch
// <= 4.0.7, no first patched version.
const picomatch: AuditException = {
  ghsa: 'GHSA-fc5q-39xc-vjpf',
  package: 'picomatch',
  severity: 'high',
  affectedRange: '<=4.0.7',
  fixedIn: null,
  paths: ['vitest', 'typescript-eslint'],
  scope: 'development only',
  removeWhen:
    'a fix older than the release cooldown is published, or the package is no longer installed',
};
// Recorded registry data: picomatch's releases (with publish times) as of 2026-11-18.
const published: Record<string, string> = {
  '2.3.1': '2022-01-02T00:00:00.000Z',
  '3.0.1': '2023-06-01T00:00:00.000Z',
  '4.0.0': '2024-02-01T00:00:00.000Z',
  '4.0.2': '2024-03-01T00:00:00.000Z',
  '4.0.3': '2025-07-01T00:00:00.000Z',
  '4.0.7': '2026-09-01T00:00:00.000Z',
};
const NOW = new Date('2026-11-18T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number): string => new Date(NOW.getTime() - n * DAY).toISOString();

// The cooldown is read from the workspace file, never copied.
const COOLDOWN = 10080;
const facts = (over: Partial<Facts> = {}): Facts => ({
  ignored: ['GHSA-fc5q-39xc-vjpf'],
  installed: { picomatch: ['4.0.7'] },
  published: { picomatch: published },
  cooldownMinutes: COOLDOWN,
  now: NOW,
  ...over,
});

describe('audit exceptions', () => {
  it('passes while no fix is published and an affected version is installed', () => {
    expect(evaluate([picomatch], facts())).toEqual({ failures: [], notices: [] });
  });

  it('passes with a notice while a fix is younger than the cooldown (1 day old)', () => {
    const r = evaluate(
      [picomatch],
      facts({ published: { picomatch: { ...published, '4.0.8': daysAgo(1) } } }),
    );
    expect(r.failures).toEqual([]);
    expect(r.notices).toHaveLength(1);
    expect(r.notices[0]).toContain('picomatch 4.0.8');
    // Published one day ago, installable six days from now.
    expect(r.notices[0]).toContain(
      `becomes installable at ${new Date(NOW.getTime() + 6 * DAY).toISOString()}`,
    );
  });

  it('fails once a fix is older than the cooldown (8 days old; trigger 1)', () => {
    const r = evaluate(
      [picomatch],
      facts({ published: { picomatch: { ...published, '4.0.8': daysAgo(8) } } }),
    );
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain(
      '4.0.8 published outside <=4.0.7 and past the release cooldown',
    );
    expect(r.notices).toEqual([]);
  });

  it('fails closed when a fix has no publish time', () => {
    const r = evaluate(
      [picomatch],
      facts({ published: { picomatch: { ...published, '4.0.8': undefined } } }),
    );
    expect(r.failures).toEqual([
      'GHSA-fc5q-39xc-vjpf: picomatch 4.0.8 is outside <=4.0.7 but has no publish time (failing closed)',
    ]);
  });

  it('fails closed when the publish time does not parse', () => {
    const r = evaluate(
      [picomatch],
      facts({ published: { picomatch: { ...published, '4.0.8': 'not a time' } } }),
    );
    expect(r.failures[0]).toContain('has no publish time (failing closed)');
  });

  it('fails closed when the cooldown is not set', () => {
    const r = evaluate([picomatch], facts({ cooldownMinutes: null }));
    expect(r.failures).toEqual([
      'minimumReleaseAge is not set in pnpm-workspace.yaml (failing closed)',
    ]);
  });

  it('does not treat a pre-release as a fix', () => {
    expect(
      evaluate(
        [picomatch],
        facts({ published: { picomatch: { ...published, '4.0.8-beta.1': daysAgo(30) } } }),
      ).failures,
    ).toEqual([]);
  });

  it('fails once no installed version matches the range (trigger 2)', () => {
    expect(evaluate([picomatch], facts({ installed: { picomatch: [] } })).failures).toEqual([
      'GHSA-fc5q-39xc-vjpf: no installed picomatch matches <=4.0.7; remove the exception',
    ]);
  });

  it('fails closed without registry data', () => {
    expect(evaluate([picomatch], facts({ published: {} })).failures[0]).toContain('failing closed');
  });

  it('fails on an ignored advisory that is not registered, and on a stale register entry', () => {
    expect(
      evaluate([], facts({ ignored: ['GHSA-xxxx-xxxx-xxxx'], installed: {}, published: {} }))
        .failures,
    ).toEqual(['GHSA-xxxx-xxxx-xxxx is ignored in pnpm-workspace.yaml but not registered']);
    expect(evaluate([picomatch], facts({ ignored: [] })).failures[0]).toContain(
      'registered but not ignored',
    );
  });

  it('reads the ignore list, the cooldown, the installed versions and the publish times', () => {
    const yaml =
      'minimumReleaseAge: 10080\nauditConfig:\n  ignoreGhsas:\n    - GHSA-fc5q-39xc-vjpf\n    - GHSA-aaaa-bbbb-cccc\n';
    expect(ignoredFromWorkspace(yaml)).toEqual(['GHSA-fc5q-39xc-vjpf', 'GHSA-aaaa-bbbb-cccc']);
    expect(cooldownFromWorkspace(yaml)).toBe(10080);
    expect(cooldownFromWorkspace('saveExact: true\n')).toBeNull();
    const lock = 'packages:\n\n  picomatch@4.0.7:\n    resolution: {}\n\n  picomatch@2.3.1:\n';
    expect(installedFromLock(lock, 'picomatch').sort()).toEqual(['2.3.1', '4.0.7']);
    expect(
      publishedFromDocument({
        versions: { '4.0.7': {}, '4.0.8': {} },
        time: { created: '2014-01-01T00:00:00.000Z', '4.0.7': '2026-09-01T00:00:00.000Z' },
      }),
    ).toEqual({ '4.0.7': '2026-09-01T00:00:00.000Z', '4.0.8': undefined });
  });
});
