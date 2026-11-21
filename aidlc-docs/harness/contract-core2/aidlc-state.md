# AI-DLC State Tracking

## Project Information
- **Project Type**: Brownfield follow-up to `harness/m1-walking-skeleton` (complete, soorma-ai/soorma-sdk#26 merged as `638a3af`)
- **Start Date**: 2026-11-20 (UTC); first recorded 2026-11-21T00:27:34Z
- **Current Stage**: **COMPLETE** (2026-11-21T00:50:32Z): soorma-ai/soorma-sdk#28 merged as `3f09adf`; `dev` fast-forwarded to it; soorma-ai/soorma-sdk#27 closed by hand
- **Tracking issue**: soorma-ai/soorma-sdk#27 (closed by hand after the merge, with a comment linking the PR and its merge commit)
- **Record shape**: the user's choice (CC2-Q2, *New small initiative*): this file and `audit.md` only. No AI-DLC stage runs here; each step is a decision in `audit.md`. What m1 records (OBL-05, GAP-CAC-001) is updated where m1 records it

## Code Location Rules
- **Application Code**: . (repo root — NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/harness/contract-core2/ only, plus the m1 records named below
- **Path Convention**: All paths are relative to repo root

## Scope

| Item | What | Where recorded |
|---|---|---|
| Pin | `contract/` re-vendored byte for byte at soorma-core `contract-v0.1.0+core.2` (commit `0405e2a96a9389cab45e67312de903fd42f5d01e`, `contract/` tree `8d375fd66899184b4d7871e188d02268a992325e`); wire contract 0.1.0, `CONTRACT_VERSION` stays `0.1.0` | `contract.pin.json`, `contract.md` |
| OBL-05 | `e2e-python` on Python 3.11.18 and 3.15.2 (soorma-ai/soorma-core#36's fix, since `+core.1`) | m1 `aidlc-state.md` *Open Obligations*; m1 `build-and-test-summary.md` |
| GAP-CAC-001 | Resolved — contract amended (CC2-Q1): `contract-v0.1.0+core.2`, `conventions/credentials.md`, *Revocation and Lifetimes* | m1 `construction/contract-and-conformance/prd-gaps/specification-gaps.md`; m1 `aidlc-state.md` register; m1 `build-and-test-summary.md` |

## Extension Configuration

None evaluated: no AI-DLC stage runs in this initiative. The artifacts it amends were produced
under m1-walking-skeleton's extension configuration, and no amendment changes a security control
(the renewal rule changes no code path; the CI change adds a runtime to an existing job, with the
matrix value passed through `env`, never interpolated into a script).

## Questions

| ID | Question | Answer | Status |
|---|---|---|---|
| CC2-Q1 | GAP-CAC-001's status, the gap rule's set having no exact fit for a contract | Resolved — contract amended | Answered |
| CC2-Q2 | The record for this work | New small initiative (this one) | Answered |

## Changes

| Commit | What |
|---|---|
| `754fefb` | The contract re-vendored, the pin written, the TypeScript types regenerated |
| `23a2501` | Names of the tag and commit in docs, `e2e/src/stack.ts` and two tests |
| `90b58a4` | `e2e-python` on 3.11.18 and 3.15.2; the Python README's note (OBL-05) |
| `7d58b29` | GAP-CAC-001's citations become the contract rule; the keeper tests; the real-stack test |
| `528ef4e` | The records: this initiative; m1's OBL-05, GAP-CAC-001 and the Build and Test addendum |

## Stage Progress
- [x] Request and decisions recorded (`audit.md`)
- [x] PR soorma-ai/soorma-sdk#28 opened 2026-11-21T00:31Z; on head `7d58b29` every check green: CI (pull_request) 44844441207, DCO 44844441252, CI (push) 44843922365; OBL-05 discharged with the 3.15.2 entry (job 136660621071)
- [x] Every check green on the final head `528ef4e`: CI (pull_request) 44844931427, all three end-to-end entries included; DCO 44844931504; CI (push) 44844925789 (end-to-end skipped: a docs-only commit)
- [x] **Merged** by the user as `3f09adf` (merge commit) at 2026-11-21T00:50:32Z; `dev` fast-forwarded to it and pushed
- [x] soorma-ai/soorma-sdk#27 closed by hand, with a comment linking #28 and `3f09adf`

## Initiative Complete

- **Completed**: 2026-11-21T00:50:32Z, when soorma-ai/soorma-sdk#28 merged as `3f09adf`
- **Delivered**: the pin at `contract-v0.1.0+core.2`; OBL-05 discharged; GAP-CAC-001 Resolved — contract amended
- **This record** rides with the next soorma-sdk PR (`dev` → `main`)
