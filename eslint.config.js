// SPDX-License-Identifier: Apache-2.0
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['contract/**', 'aidlc-docs/**', '**/node_modules/**', '.e2e/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
