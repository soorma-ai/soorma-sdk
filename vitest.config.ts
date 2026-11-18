// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['conformance/**/*.test.ts', 'tools/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'contract/**', 'aidlc-docs/**'],
  },
});
