// SPDX-License-Identifier: Apache-2.0
//
// Client configuration (C-12): what a developer supplies, and nothing inferred
// (CFG-01, CFG-02, CFG-05, CFG-06).
import { randomUUID } from 'node:crypto';

/** A random UUID v4 for the instance identifier; reads nothing about the host (CFG-06). */
export function newInstanceId(): string {
  return randomUUID();
}
