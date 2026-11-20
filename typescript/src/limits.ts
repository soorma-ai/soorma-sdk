// SPDX-License-Identifier: Apache-2.0
//
// The named values (spec/behaviour.md §0), as NFR Requirements sets them
// (NFR-U3-06; TS-U3-11), in milliseconds or items. A client captures them when
// it is constructed. The conformance driver may set them for the next client
// through internal/test-values.ts, which imports this module; nothing published
// imports that module, so an installed package never contains or loads it.

export interface Limits {
  readonly H_renew: number;
  readonly R_min: number;
  readonly R_max: number;
  readonly W_max: number;
  readonly B_init: number;
  readonly B_factor: number;
  readonly B_cap: number;
  readonly L_ends: number;
  readonly W_super: number;
  readonly N_buf: number;
  readonly T_idle: number;
  readonly T_req: number;
  /** RCV-09 (added at U4): bytes. */
  readonly L_event: number;
  readonly B_body: number;
}

/** NFR Requirements' values (U3-NFR-Q1 A). */
export const LIMITS: Limits = Object.freeze({
  H_renew: 120_000,
  R_min: 30_000,
  R_max: 5,
  W_max: 60_000,
  B_init: 500,
  B_factor: 2,
  B_cap: 10_000,
  L_ends: 5,
  W_super: 10_000,
  N_buf: 64,
  T_idle: 45_000,
  T_req: 10_000,
  // RCV-09 (added at U4; U4 NFR Requirements): 1 MiB each, in every language.
  L_event: 1_048_576,
  B_body: 1_048_576,
});

/** The parse-depth bound `D_lang` (NFR-03). Not one of the values a case may set. */
export const D_LANG = 512;

/** Set only by internal/test-values.ts, for the conformance driver. */
let slot: Partial<Limits> | undefined;

/** Called only by internal/test-values.ts. */
export function setLimitsSlot(values: Partial<Limits> | undefined): void {
  slot = values === undefined ? undefined : { ...values };
}

/** The values a client captures when it is constructed. */
export function captureLimits(): Limits {
  return Object.freeze(slot === undefined ? { ...LIMITS } : { ...LIMITS, ...slot });
}
