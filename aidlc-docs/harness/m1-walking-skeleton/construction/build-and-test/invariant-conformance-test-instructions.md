# Invariant Conformance Test Instructions

Every applicable row of every unit's `invariant-coverage-matrix.md` (the soorma platform
invariants, soorma-prd `references/platform/invariants.md` @ `prd-platform-foundations-v1.3` and
@ `prd-identity-v1.0`, text identical), generated from the matrices at Build and Test, with the
check that proves each and its evidence (the runs of `build-and-test-summary.md` and CI run
44670863814). I11 constrains the PRD, not the code: N/A in every unit, by design.

## U1 `contract-and-conformance`: 10 applicable

**Evidence**: the cases through both drivers: TypeScript runs 18 (Node 24), 19 (Node 26); Python runs 20 (3.11), 21 (3.15); the reference run in the self-test, run 6; CI 44670863814 (97 of 97 on all six entries, CC-SEC-05 included). Not applicable here: I11 No technology selection (N/A: Construction is where technology is selected; this invariant constrains the PRD).

| Invariant | The check (the matrix's verification target) | Result |
|---|---|---|
| I1 Isolation | CC-CFG-02, CC-CFG-06, CC-CRD-01 | Pass |
| I2 Perimeter enforcement | CC-RCV-08, CC-ACQ-07, CC-NEV-02. **Cumulative check**: no case in the catalogue expects the SDK to refuse a request or a Delivery the platform would judge; reviewed across all 88 | Pass |
| I3 Portable credential | CC-CFG-06, CC-CFG-07, CC-CRD-03 | Pass |
| I4 Attribution recoverable | CC-FWD-02 (negative control `reorder-forwarded-envelope` must fail it), CC-FWD-03, CC-FWD-04, CC-RCV-03 | Pass |
| I5 Monotonic authority | CC-NEV-02, CC-NEV-03, CC-FWD-01, CC-FWD-06 | Pass |
| I6 Two faces | CC-NEV-01, CC-CFG-03. Units Generation checked the shapes: U1 is ordinary, no face | Pass |
| I7 Contract compatibility | Contract drift check (local and remote), generated-types check, CC-RCV-03, CC-RCV-08, CC-STR-03, CC-PRB-01 | Pass |
| I8 Packaging rule | Packaging table at Code Generation: every U1 capability → PF §12 assignment (the harness surface: core) → `soorma-sdk`; the check that neither package's file list contains `conformance/` | Pass |
| I9 Mechanism, not instance | CC-SPN-01; cases hold tenant-like data only as labelled fixtures or generated payloads | Pass |
| I10 Runtime-later | CC-CFG-06, CC-RCV-08 | Pass |

## U2 `e2e-stack`: 9 applicable

**Evidence**: the stack: runs 25 (core-up), 26 (setup), 27 (prove-stack: both agents 200), 30 (core-down: every log searched clean); U2's unit tests in run 15; both scenarios on the stack, runs 28 and 29; CI `e2e-typescript`, `e2e-python` on 44670863814. Not applicable here: I4 Attribution recoverable (N/A for this unit: U2 writes no governed record; registrations and grants are written by s); I11 No technology selection (N/A: Construction is where technology is selected; this invariant constrains the PRD).

| Invariant | The check (the matrix's verification target) | Result |
|---|---|---|
| I1 Isolation | TC-ES-007: agents registered at E's S2 bootstrap at E's S3; a mismatch fails it | Pass |
| I2 Perimeter enforcement | U1's packaging guard extended to `e2e/` (business-logic-model §6); the cumulative check: no package imports `e2e/` | Pass |
| I3 Portable credential | TC-ES-007 | Pass |
| I5 Monotonic authority | TC-ES-004 (registration `200` means S2 found the set within the sponsor's ceiling) | Pass |
| I6 Two faces | Packaging guard; U3's and U4's example checks (US-11 #4) | Pass |
| I7 Contract compatibility | TC-ES-002; TC-ES-007 | Pass |
| I8 Packaging rule | The packaging guard with `e2e/` (business-logic-model §6) | Pass |
| I9 Mechanism, not instance | Review at Code Generation: the constants sit in `e2e/` only, labelled as the local stack's | Pass |
| I10 Runtime-later | Statement; Code Generation confirms | Pass |

## U3 `typescript-harness`: 9 applicable

**Evidence**: the cases through the TypeScript driver: runs 18, 19; CI 44670863814 (Node 24.22.3 with API 1.9.0 and 1.10.0, Node 26.13.0); the TypeScript scenario, run 28 and CI `e2e-typescript`; U3's unit tests in run 15. Not applicable here: I4 Attribution recoverable (N/A for this unit: the SDK writes no governed record. Scope, actor, chain and origin are t); I11 No technology selection (N/A: Construction is where technology is selected; this invariant constrains the PRD).

| Invariant | The check (the matrix's verification target) | Result |
|---|---|---|
| I1 Isolation | CC-CFG-02, CC-CRD-01; the end-to-end test (two clients, one environment, each its own credential); the absence of any environment-keyed state, reviewed at Code Generation | Pass |
| I2 Perimeter enforcement | CC-RCV-08, CC-NEV-02; U2's `prove-stack` (raw, outside the SDK) against the same stack; reviewed against U1 and U2 at Code Generation | Pass |
| I3 Portable credential | CC-CFG-06, CC-CFG-07; TC-TH-006 | Pass |
| I5 Monotonic authority | CC-FWD-01, CC-FWD-02, CC-FWD-06, CC-NEV-02 | Pass |
| I6 Two faces | CC-CFG-03, CC-NEV-01; the generated types' file list; TC-TH-057 | Pass |
| I7 Contract compatibility | CC-DRF-01, CC-RCV-03, CC-RCV-08; `pnpm checks` (generated types) | Pass |
| I8 Packaging rule | The packaging guard's run on `typescript/`; TC-TH-058 | Pass |
| I9 Mechanism, not instance | Review at Code Generation (a search of `typescript/src/`) | Pass |
| I10 Runtime-later | Statement at Code Generation; CC-CFG-06 | Pass |

## U4 `python-harness`: 9 applicable

**Evidence**: the cases through the Python driver: runs 20, 21; CI 44670863814 (3.11.18 and 3.15.2 with otel-latest, 3.11.18 with otel-floor); the Python scenario, run 29 and CI `e2e-python`; the unit tests, runs 13, 14. Not applicable here: I4 Attribution recoverable (N/A for this unit: the SDK writes no governed record. Scope, actor, chain and origin are t); I11 No technology selection (N/A: Construction is where technology is selected; this invariant constrains the PRD).

| Invariant | The check (the matrix's verification target) | Result |
|---|---|---|
| I1 Isolation | CC-CFG-02, CC-CRD-01; `e2e-python` (two clients, one environment, each its own credential); the absence of any environment-keyed state, reviewed at Code Generation | Pass |
| I2 Perimeter enforcement | CC-RCV-08, CC-NEV-02; U2's `prove-stack` (raw, outside the SDK) against the same stack; reviewed against U1 to U3 at Code Generation | Pass |
| I3 Portable credential | CC-CFG-06, CC-CFG-07; TC-PH-006 | Pass |
| I5 Monotonic authority | CC-FWD-01, CC-FWD-02, CC-FWD-06, CC-NEV-02 | Pass |
| I6 Two faces | CC-CFG-03, CC-NEV-01; the generated types' file list; TC-PH-057 | Pass |
| I7 Contract compatibility | CC-DRF-01, CC-RCV-03, CC-RCV-08; `pnpm checks` (generated types) | Pass |
| I8 Packaging rule | The packaging guard's run on `python/`; the packed-distribution check; TC-PH-058 | Pass |
| I9 Mechanism, not instance | Review at Code Generation (a search of `python/src/soorma/`) | Pass |
| I10 Runtime-later | Statement at Code Generation; CC-CFG-06 | Pass |

## I8 Across All Units, Checked as a Set

| Capability | Unit | Edition (PRD) | Where it lands | Checked by |
|---|---|---|---|---|
| The harness behaviour specification and name table | U1 | core (PF §12) | soorma-sdk, Apache 2.0 | `pnpm checks` (names) |
| The conformance suite (runner, stub, cases) | U1 | core: part of the harness surface's conformance | soorma-sdk, private workspace packages, never published | `tools/packaging` guard |
| The reference driver and its faults | U1 | Not a product capability | soorma-sdk, in no package | `tools/packaging` guard; `package-typescript` |
| The end-to-end stack commands and log search | U2 | Not a product capability | soorma-sdk, in no package | `tools/packaging` guard (`e2e/` forbidden) |
| Acquire, renew, hold and present a credential; draft, trace, forward; publish and subscribe; trace emission (PF §11) | U3 | core | soorma-sdk, `@soorma/sdk` (Apache 2.0) | `package-typescript` (run 22; CI) |
| The same four capabilities, in Python | U4 | core | soorma-sdk, `soorma` (Apache 2.0) | `package-python` (run 23; CI) |
| Each language's driver, example, end-to-end test and values hook | U3, U4 | Not a product capability | soorma-sdk, outside each distribution | `package-typescript`: no `dist/internal` in the tarball; `package-python`: no `soorma/_internal` in the wheel or sdist, the hook not importable |
| Repository tooling (checks, DCO, audit exceptions) | U1 to U4 | Not a product capability | soorma-sdk, private | — |

**As a set**: every product capability is core and lands in soorma-sdk under Apache 2.0, once per
language; no commercial capability exists in any unit in any form; nothing lands in soorma-core;
no test infrastructure ships in either distribution. **Pass.**

## Result

**37 applicable rows across the four units: 37 Pass, 0 Fail, 0 Unverified; I8 as a set: Pass.**
