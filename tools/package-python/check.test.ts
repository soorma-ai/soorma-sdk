// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { distributionFailures, pythonsFrom } from './check.ts';

const WHEEL = [
  'soorma/',
  'soorma/__init__.py',
  'soorma/_client.py',
  'soorma/py.typed',
  'soorma-0.1.0.dist-info/licenses/LICENSE',
  'soorma-0.1.0.dist-info/licenses/NOTICE',
  'soorma-0.1.0.dist-info/METADATA',
];
const SDIST = [
  'soorma-0.1.0',
  'soorma-0.1.0/PKG-INFO',
  'soorma-0.1.0/pyproject.toml',
  'soorma-0.1.0/README.md',
  'soorma-0.1.0/LICENSE',
  'soorma-0.1.0/NOTICE',
  'soorma-0.1.0/src/soorma/__init__.py',
];

describe('the package-python guard', () => {
  it('passes a clean wheel and sdist', () => {
    expect(distributionFailures('wheel', WHEEL)).toEqual([]);
    expect(distributionFailures('sdist', SDIST)).toEqual([]);
  });

  it('fails on the values hook, test-only paths, and missing files', () => {
    expect(
      distributionFailures('wheel', [
        ...WHEEL,
        'soorma/_internal/__init__.py',
        'soorma/_internal/test_values.py',
      ]),
    ).toEqual([
      'the wheel holds test-only soorma/_internal/__init__.py',
      'the wheel holds test-only soorma/_internal/test_values.py',
      'the wheel holds the values hook: soorma/_internal/test_values.py',
    ]);
    expect(distributionFailures('sdist', [...SDIST, 'soorma-0.1.0/tests/test_http.py'])).toEqual([
      'the sdist holds test-only tests/test_http.py',
    ]);
    expect(distributionFailures('wheel', ['soorma/__init__.py'])).toEqual([
      'the wheel lacks soorma/py.typed',
      'the wheel lacks LICENSE',
      'the wheel lacks NOTICE',
    ]);
  });

  it('reads the Pythons asked for', () => {
    expect(pythonsFrom(['--python', '3.11.18', '--python', '3.15.2'])).toEqual([
      '3.11.18',
      '3.15.2',
    ]);
    expect(pythonsFrom([])).toEqual(['3.11']);
  });
});
