# AI-DLC State Tracking

## Project Information
- **Project Type**: Greenfield
- **Start Date**: 2026-11-17T07:29:06Z
- **Current Stage**: INCEPTION - User Stories
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
- **Unit shapes**: **amended at Requirements Analysis** (RA Q1 X, audit 2026-11-18T02:37:58Z): the conformance suite is an **ordinary** unit (F45's rule); every other unit is **harness**. No contract or plane face. *To confirm at Units Generation.* Superseded: harness only, trace emission included (intake Q1 A, 2026-11-18T02:07:55Z)
- **Intake approval**: 2026-11-18T02:14:55Z (audit: PRD Intake — approval)

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
| GAP-INT-001 | (pre-unit) | Event delivery guarantees, as the SDK's subscriber sees them | Awaiting PRD: Event; worked around (contract-v0.1.0 live-only) | PF @ `prd-platform-foundations-v1.3` | — | soorma-prd#13 (existing; soorma-core GAP-INT-003); comment: https://github.com/soorma-ai/soorma-prd/issues/13#issuecomment-6966876924 |
| GAP-INT-002 | (pre-unit) | Span semantics for the trace the SDK emits (OB-8) | Awaiting PRD: Observability; worked around (OpenTelemetry API only; no SDK exporter; proof by a test-installed exporter) | PF @ `prd-platform-foundations-v1.3` | — | soorma-prd#37: https://github.com/soorma-ai/soorma-prd/issues/37 |

## Deferred Questions

| ID | Question | Deferred To | Reason | Source | Status |
|---|---|---|---|---|---|

## Extension Configuration

| Extension | Enabled | Decided At | Notes |
|---|---|---|---|
| security-baseline | Yes | Requirements Analysis (Q11) | Opted in — deployment: local-only. *(hosted)* clauses listed under `## Carried Security Obligations` |
| soorma-platform-invariants | Yes | Requirements Analysis (Q12) | Scope inherited from PF §15 and ID §15: I1 to I11 all Addressed in both, none N/A. Invariants read at `prd-platform-foundations-v1.3` and `prd-identity-v1.0`; text identical at both tags (SHA-256 c66c0170…) |
| pr-checkpoint | Yes | Requirements Analysis (Q13) | Gates on `dev` → `main` PRs (the user's git instruction) |
| qa-test-cases | Yes | Requirements Analysis (Q14) | Opted in — scope: comprehensive |
| tickets | Yes | Requirements Analysis (Q15) | Opted in — target: GitHub issues: soorma-ai/soorma-sdk; initiative ticket → tracking issue; unit ticket → sub-issue |

Full rules loaded at opt-in: security-baseline.md, soorma-platform-invariants.md, pr-checkpoint.md, qa-test-cases.md, tickets.md.

## Carried Security Obligations

Deployment context `local-only`: each *(hosted)* clause is N/A for the milestone and owed by the
first hosted deployment. A client library deploys no infrastructure of its own; most rows are
expected to stay N/A for this repository, and SECURITY-10's SBOM is the one likely to apply, at
the first published release.

| Rule | Clause | Owed by |
|---|---|---|
| SECURITY-01 | Encryption at rest using a managed key service or customer-managed keys (and its three verification items: storage encryption-at-rest block, object storage, database instances) | The first hosted deployment |
| SECURITY-02 | Load balancer access logs to a persistent store; API gateway logs to a centralized log service | The first hosted deployment |
| SECURITY-03 | Log output directed to a centralized log service | The first hosted deployment |
| SECURITY-07 | Private subnets without direct internet gateway routes (through a NAT gateway); private endpoints for cloud service access | The first hosted deployment |
| SECURITY-10 | SBOM for production deployments | The first hosted deployment, or the first published release |
| SECURITY-14 | Security event alerting; log integrity (append-only, not deletable by the application); log retention (90 days minimum) | The first hosted deployment |

## Stage Progress

### INCEPTION PHASE
- [x] Workspace Detection — 2026-11-17T07:29:06Z (greenfield; entry point: slice brief)
- [x] PRD Intake — APPROVED 2026-11-18T02:14:55Z. Questions answered 2026-11-18T02:07:55Z (Q1 A harness only; Q2 A raised soorma-prd#37 and worked around; Q3 A commented on #13)
- [x] Requirements Analysis — APPROVED 2026-11-18T02:47:34Z, with the user's correction to Q1 (Node.js 24 or later; CI Node 24 and 26; Python 3.11+, CI 3.11 and newest). Questions answered 2026-11-18T02:37:58Z (Q1 X two languages, TypeScript first; Q2–Q10 A; Q11 A2; Q12 A; Q13 A; Q14 A3; Q15 B)
- [ ] User Stories
- [ ] Workflow Planning
- [ ] Application Design
- [ ] Units Generation

### CONSTRUCTION PHASE
- (planned at Workflow Planning)
