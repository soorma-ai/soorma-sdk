# AI-DLC State Tracking

## Project Information
- **Project Type**: Greenfield
- **Start Date**: 2026-11-17T07:29:06Z
- **Current Stage**: INCEPTION - PRD Intake (awaiting approval)
- **Milestone**: M1 — Walking skeleton (from the slice brief; matches `aiprd-docs/build-sequence.md`)

## Workspace State
- **Existing Code**: No (README, CONTRIBUTING, DCO, LICENSE, NOTICE, .github only)
- **Reverse Engineering Needed**: No
- **Workspace Root**: . (repo root: soorma-sdk)

## Code Location Rules
- **Application Code**: . (repo root — NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/harness/m1-walking-skeleton/ only
- **Structure patterns**: See code-generation.md Critical Rules
- **Path Convention**: All paths are relative to repo root — never use absolute/machine-specific paths

## PRD Intake

- **Entry point**: slice brief
- **Slice brief**: soorma-prd/backlog/m1-walking-skeleton.md @ `0aad84a27c94d8f6d7064c312aaaa2e553d162dd` (Status: Ready)
- **Scope**: `soorma-sdk` column of *Repositories and sessions*
- **Consumed contract**: soorma-core wire contract @ `contract-v0.1.0` (peels to `c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d`; pre-release)
- **Coverage map**: inception/prd-intake/prd-coverage-map.md
- **Specification gaps**: inception/prd-intake/specification-gaps.md
- **Stages satisfied**: none (Requirements Analysis, User Stories, Units Generation Partial; Application Design Not addressed)
- **Unit shapes**: harness only, trace emission included; no contract, plane face or ordinary unit (confirmed: intake Q1 A, audit 2026-11-18T02:07:55Z)
- **Intake approval**: pending

### PRD: PF — platform-foundations

- **PRD**: soorma-prd/aiprd-docs/platform-foundations/requirements/prd.md
- **Version**: 1.3
- **Built against**: `prd-platform-foundations-v1.3` (commit `80dd7c98e81702bb38dece9249372ea27b0555f9`)
- **Kind**: plane (declared)
- **Status verified**: Approved (header at the tag; PR #4, amended by #5, #19, #21)
- **Upstream check**: none declared
- **L1 sources**: PF §7b *Envelope Fields* and *Compatibility Policy*; PF FR-004, FR-005, FR-006; PF §11 *What the SDK may not populate*; PF §9 *Operations* and *Failure Modes*; PF §17 *Envelope*, *Namespacing Rules*, *Recognised Kinds*

### PRD: ID — identity

- **PRD**: soorma-prd/aiprd-docs/identity/requirements/prd.md
- **Version**: 1.0
- **Built against**: `prd-identity-v1.0` (commit `80dd7c98e81702bb38dece9249372ea27b0555f9`)
- **Kind**: plane (declared)
- **Status verified**: Approved (header at the tag; PR #21)
- **Upstream check**: declares PF @ `prd-platform-foundations-v1.3`: consistent
- **L1 sources**: none in this repository's scope. ID §11 *Prohibitions* and *The human side* bind the SDK as constraints (no human credential held)

### Intake History

| Run | Date | Trigger | PRDs @ tags | Brief @ |
|---|---|---|---|---|
| 1 | 2026-11-17 | Initiative start | PF @ `prd-platform-foundations-v1.3`, ID @ `prd-identity-v1.0` | `0aad84a` |

## PRD Specification Gaps

Gap IDs are qualified by repository whenever they leave this initiative (soorma-sdk GAP-INT-001).

| ID | Unit | Summary | Status | Raised Against | Resolved By | Issue |
|---|---|---|---|---|---|---|
| GAP-INT-001 | (pre-unit) | Event delivery guarantees, as the SDK's subscriber sees them | Awaiting PRD: Event; worked around (contract-v0.1.0 live-only) | PF @ `prd-platform-foundations-v1.3` | — | soorma-prd#13 (existing; soorma-core GAP-INT-003) |
| GAP-INT-002 | (pre-unit) | Span semantics for the trace the SDK emits (OB-8) | Awaiting PRD: Observability; worked around (OpenTelemetry API only; no SDK exporter; proof by a test-installed exporter) | PF @ `prd-platform-foundations-v1.3` | — | — |

## Deferred Questions

| ID | Question | Deferred To | Reason | Source | Status |
|---|---|---|---|---|---|

## Extension Configuration

*(Opt-ins presented at Requirements Analysis.)*

## Stage Progress

### INCEPTION PHASE
- [x] Workspace Detection — 2026-11-17T07:29:06Z (greenfield; entry point: slice brief)
- [ ] PRD Intake — artifacts written 2026-11-17T07:33:14Z; questions answered 2026-11-18T02:07:55Z (Q1 A, Q2 A, Q3 A); awaiting Step 7 approval
- [ ] Requirements Analysis
- [ ] User Stories
- [ ] Workflow Planning
- [ ] Application Design
- [ ] Units Generation

### CONSTRUCTION PHASE
- (planned at Workflow Planning)
