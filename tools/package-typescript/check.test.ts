// SPDX-License-Identifier: Apache-2.0
//
// The guard over the packed tarball's file list (NFR-U3-21; plan 1.1): no
// test-only path, no values hook, no test, and the files a tenant needs.
import { describe, expect, it } from 'vitest';
import { REQUIRED, tarballFailures } from './check.ts';

const good = REQUIRED.map((f) => `package/${f}`).concat(['package/dist/client.js', 'package/']);

describe('the tarball guard (package-typescript)', () => {
  it('passes the files a tenant needs, and nothing else', () => {
    expect(tarballFailures(good)).toEqual([]);
  });

  it('refuses the values hook, test-only code and tests, naming each', () => {
    expect(
      tarballFailures([
        ...good,
        'package/dist/internal/test-values.js',
        'package/conformance/runner/run.js',
        'package/dist/g5.test.js',
      ]),
    ).toEqual([
      'the tarball holds the values hook: dist/internal/test-values.js',
      'the tarball holds test-only conformance/runner/run.js',
      'the tarball holds a test: dist/g5.test.js',
    ]);
  });

  it('names a missing required file', () => {
    expect(tarballFailures(good.filter((f) => f !== 'package/LICENSE'))).toEqual([
      'the tarball lacks LICENSE',
    ]);
  });
});
