// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { evaluate, ignoredFromWorkspace, installedFromLock, type AuditException } from './check.ts';

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
  removeWhen: 'a fix is published or the package is no longer installed',
};
// Recorded registry data: picomatch's releases as of 2026-11-18.
const published = ['2.3.1', '3.0.1', '4.0.0', '4.0.2', '4.0.3', '4.0.7'];

describe('audit exceptions', () => {
  it('passes while no fix is published and an affected version is installed', () => {
    expect(
      evaluate([picomatch], {
        ignored: ['GHSA-fc5q-39xc-vjpf'],
        installed: { picomatch: ['4.0.7'] },
        published: { picomatch: published },
      }),
    ).toEqual([]);
  });

  it('fails once a release outside the affected range is published (trigger 1)', () => {
    const failures = evaluate([picomatch], {
      ignored: ['GHSA-fc5q-39xc-vjpf'],
      installed: { picomatch: ['4.0.7'] },
      published: { picomatch: [...published, '4.0.8'] },
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('4.0.8 published outside <=4.0.7');
  });

  it('does not treat a pre-release as a fix', () => {
    expect(
      evaluate([picomatch], {
        ignored: ['GHSA-fc5q-39xc-vjpf'],
        installed: { picomatch: ['4.0.7'] },
        published: { picomatch: [...published, '4.0.8-beta.1'] },
      }),
    ).toEqual([]);
  });

  it('fails once no installed version matches the range (trigger 2)', () => {
    const failures = evaluate([picomatch], {
      ignored: ['GHSA-fc5q-39xc-vjpf'],
      installed: { picomatch: [] },
      published: { picomatch: published },
    });
    expect(failures).toEqual([
      'GHSA-fc5q-39xc-vjpf: no installed picomatch matches <=4.0.7; remove the exception',
    ]);
  });

  it('fails closed without registry data', () => {
    const failures = evaluate([picomatch], {
      ignored: ['GHSA-fc5q-39xc-vjpf'],
      installed: { picomatch: ['4.0.7'] },
      published: {},
    });
    expect(failures[0]).toContain('failing closed');
  });

  it('fails on an ignored advisory that is not registered, and on a stale register entry', () => {
    expect(
      evaluate([], { ignored: ['GHSA-xxxx-xxxx-xxxx'], installed: {}, published: {} }),
    ).toEqual(['GHSA-xxxx-xxxx-xxxx is ignored in pnpm-workspace.yaml but not registered']);
    expect(
      evaluate([picomatch], {
        ignored: [],
        installed: { picomatch: ['4.0.7'] },
        published: { picomatch: published },
      })[0],
    ).toContain('registered but not ignored');
  });

  it('reads the ignore list and the installed versions', () => {
    const yaml =
      'auditConfig:\n  ignoreGhsas:\n    - GHSA-fc5q-39xc-vjpf\n    - GHSA-aaaa-bbbb-cccc\n';
    expect(ignoredFromWorkspace(yaml)).toEqual(['GHSA-fc5q-39xc-vjpf', 'GHSA-aaaa-bbbb-cccc']);
    const lock = 'packages:\n\n  picomatch@4.0.7:\n    resolution: {}\n\n  picomatch@2.3.1:\n';
    expect(installedFromLock(lock, 'picomatch').sort()).toEqual(['2.3.1', '4.0.7']);
  });
});
