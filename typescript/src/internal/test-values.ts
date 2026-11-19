// SPDX-License-Identifier: Apache-2.0
//
// The conformance driver's timing hook (conformance/README.md, "Values and the
// timing hook"): a case's named values for the next client constructed. Not
// part of the public interface: not exported by index.ts, not reachable through
// the exports map, and left out of the packed tarball. This module imports
// limits.ts; nothing published imports this module (a source check enforces it).
import { setLimitsSlot, type Limits } from '../limits.ts';

export function setTestValues(values: Partial<Limits> | undefined): void {
  setLimitsSlot(values);
}
