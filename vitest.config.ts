// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // One TypeScript configuration for every file: the vendored contract/ carries
  // soorma-core's tsconfig.json, which extends a file only soorma-core has.
  tsconfig: './tsconfig.json',
  test: {
    include: ['conformance/**/*.test.ts', 'tools/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'contract/**', 'aidlc-docs/**'],
  },
});
