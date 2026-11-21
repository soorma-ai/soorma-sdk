// SPDX-License-Identifier: Apache-2.0
//
// The TypeScript end-to-end scenario (business-logic-model §10), against the
// built package: `@soorma/sdk` is typescript/dist/, as a tenant imports it
// (build it first); and the contract's renewal rule, by raw calls
// (renewal-rule.test.ts). One file at a time, so neither disturbs the
// scenario's timing. The root configuration excludes this directory.
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = resolve(import.meta.dirname, '..', '..');

export default defineConfig({
  root,
  tsconfig: resolve(root, 'tsconfig.json'),
  resolve: { alias: { '@soorma/sdk': resolve(root, 'typescript', 'dist', 'index.js') } },
  test: {
    include: ['typescript/e2e/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
