// SPDX-License-Identifier: Apache-2.0
//
// Secret providers (C-13; SEC-03 to SEC-09). Implemented in G3.
import { SecretSourceError } from './errors.ts';
import type { SecretProvider } from './types.ts';

/** The one provider shipped: reads a secret file, checked before it is read. */
export function fileSecret(path: string): SecretProvider {
  return () => Promise.reject(new SecretSourceError('not-implemented', path));
}
