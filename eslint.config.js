// SPDX-License-Identifier: Apache-2.0
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const sdk = 'typescript/src/**/*.ts';

export default tseslint.config(
  {
    ignores: [
      'contract/**',
      'aidlc-docs/**',
      '**/node_modules/**',
      '.e2e/**',
      '**/.venv/**',
      'python/dist/**',
      'typescript/dist/**',
      'typescript/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // The package @soorma/sdk (U3; TS-U3-13, P-05, the values hook 1.1).
  {
    files: [sdk],
    ignores: ['typescript/src/**/*.test.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'CFG-07: the SDK reads no environment variable',
        },
        { object: 'os', property: 'hostname', message: 'CFG-05: nothing is derived from the host' },
        {
          object: 'os',
          property: 'networkInterfaces',
          message: 'CFG-05: nothing is derived from the host',
        },
        { object: 'Date', property: 'now', message: 'P-05: read the wall clock through clock.ts' },
        {
          object: 'performance',
          property: 'now',
          message: 'P-05: read the monotonic clock through clock.ts',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'setTimeout', message: 'P-05: timers go through clock.ts' },
        { name: 'clearTimeout', message: 'P-05: timers go through clock.ts' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:os',
              importNames: ['hostname', 'networkInterfaces'],
              message: 'CFG-05: nothing is derived from the host',
            },
          ],
          patterns: [
            {
              group: ['**/internal/test-values', '**/internal/test-values.*'],
              message: 'Plan 1.1: nothing published imports the values hook',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['typescript/src/clock.ts'],
    rules: { 'no-restricted-properties': 'off', 'no-restricted-globals': 'off' },
  },
);
