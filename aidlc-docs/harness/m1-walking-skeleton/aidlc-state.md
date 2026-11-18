# AI-DLC State Tracking

## Project Information
- **Project Type**: Greenfield
- **Start Date**: 2026-11-17T07:29:06Z
- **Current Stage**: INCEPTION - Units Generation
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
- **Unit shapes**: **confirmed at Units Generation** (Q1 A, audit 2026-11-18T06:05:15Z): U1 `contract-and-conformance` **ordinary**; U2 `e2e-stack` **ordinary** (changed from harness at the user's direction: test infrastructure making raw control-face calls, linked by no agent code); U3 `typescript-harness` and U4 `python-harness` **harness** (face: none; call the data face, S3 and S4). Superseded: amended at Requirements Analysis (RA Q1 X, audit 2026-11-18T02:37:58Z): the conformance suite is an **ordinary** unit (F45's rule); every other unit is **harness**. No contract or plane face. *To confirm at Units Generation.* Superseded: harness only, trace emission included (intake Q1 A, 2026-11-18T02:07:55Z)
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
| GAP-INT-001 | U1, U3, U4 | Event delivery guarantees, as the SDK's subscriber sees them | Awaiting PRD: Event; worked around (contract-v0.1.0 live-only) | PF @ `prd-platform-foundations-v1.3` | — | soorma-prd#13 (existing; soorma-core GAP-INT-003); comment: https://github.com/soorma-ai/soorma-prd/issues/13#issuecomment-6966876924 |
| GAP-INT-002 | U1, U3, U4 | Span semantics for the trace the SDK emits (OB-8) | Awaiting PRD: Observability; worked around (OpenTelemetry API only; no SDK exporter; proof by a test-installed exporter) | PF @ `prd-platform-foundations-v1.3` | — | soorma-prd#37: https://github.com/soorma-ai/soorma-prd/issues/37 |

## Deferred Questions

| ID | Question | Deferred To | Reason | Source | Status |
|---|---|---|---|---|---|
| US-Q1 | How a forwarding hop's span relates to the trace it received: child or link (US-08 #4) | **U1 `contract-and-conformance` Functional Design**, where the span rules are written (Units Generation Q2 A, at the user's direction; was: the unit holding C-19). U3 and U4 implement the rule in C-19 | GAP-INT-002's open choice; to be settled under the work-around, consistent with *done when* 5's trace-id check, and recorded as a decision (user, at User Stories approval) | stories.md US-08 #4; soorma-sdk GAP-INT-002 | Open |

## Units

| Unit | Name | Shape | Depends on | Proves |
|---|---|---|---|---|
| U1 | `contract-and-conformance` | ordinary | — | Its own runner: a test-only reference driver passes; negative controls (secret retained; forwarded envelope text reordered; publish retried; boundary item skipped) fail on their named cases, in CI on its code PR |
| U2 | `e2e-stack` | ordinary | — | core-up, setup, one raw `POST /agent-credentials` per agent (expects `200`, Q1a), core-down; no secret printed; CI time first measured, run ID recorded |
| U3 | `typescript-harness` | harness | U1, U2 | Every case on Node 24 and 26; *done when* 2, 3, 5: M1's proof |
| U4 | `python-harness` | harness | U1, U2 (after U3) | Every case on 3.11 and newest; *done when* 2, 3, 5 |

Detail: inception/application-design/unit-of-work.md

## Carried Design Inputs

Settled or directed by the user at the Application Design approval (audit 2026-11-18T05:51:30Z).
Each is an input to the named unit's Functional Design; the unit is set at Units Generation.

| ID | Input | Owning component | Unit | Kind | Status |
|---|---|---|---|---|---|
| CDI-01 | **Decision**: `credential.environment` (`organization`, `project`, `environment`) is exposed **read only**. Settles T-6 (User Stories gap pass). Traces to FR-15: the client accepts no environment and only reports what the credential says | C-11, C-14 | U1 (specification); U3, U4 | Decision (recorded) | Settled |
| CDI-02 | **US-02 #3 is checked by the runtime, not reported by the driver**: the driver's `inspect` checks the runtime itself, never lists its own fields. TypeScript: force garbage collection, take a heap snapshot, find no occurrence of the secret's value. Python: `sys.getrefcount` on the string the test provider returned is back to its value before bootstrap (Python's gc does not track strings). The conformance unit's Functional Design defines both | C-03, C-21 | U1 (defines); U3, U4 (drivers implement) | Design input | Open: to Functional Design |
| CDI-03 | **`fileSecret` never blocks on a special file**: open the path without blocking (`O_NONBLOCK`, or the language's equivalent), check the opened handle (regular file, mode, owner), and only then read. A named pipe or device at the path is refused, never waited on | C-13 | U1 (specification); U3, U4 (Windows behaviour in their Functional Design) | Design input | Open: to Functional Design |

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

## Execution Plan Summary
- **Plan**: inception/working/execution-plan.md (session artifact)
- **Stages to execute**: Application Design; Units Generation; tickets, QA test specs and the Inception PR gate (extensions); per unit: Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation with its Code PR; Build and Test
- **Stages skipped**: Reverse Engineering (greenfield); Infrastructure Design (expected for every unit: nothing deployed, packages unpublished; reinstated per unit if Functional Design shows infrastructure)
- **Order**: language-neutral layer first, then TypeScript, then Python (D-01)

## Stage Progress

### INCEPTION PHASE
- [x] Workspace Detection — 2026-11-17T07:29:06Z (greenfield; entry point: slice brief)
- [x] PRD Intake — APPROVED 2026-11-18T02:14:55Z. Questions answered 2026-11-18T02:07:55Z (Q1 A harness only; Q2 A raised soorma-prd#37 and worked around; Q3 A commented on #13)
- [x] Requirements Analysis — APPROVED 2026-11-18T02:47:34Z, with the user's correction to Q1 (Node.js 24 or later; CI Node 24 and 26; Python 3.11+, CI 3.11 and newest). Questions answered 2026-11-18T02:37:58Z (Q1 X two languages, TypeScript first; Q2–Q10 A; Q11 A2; Q12 A; Q13 A; Q14 A3; Q15 B)
- [x] User Stories — APPROVED 2026-11-18T03:05:37Z. Plan answered 2026-11-18T02:55:43Z (Q1–Q6 A); 2 personas, 14 stories, 80 criteria; gap pass: no new gap; US-Q1 carried to Functional Design
- [x] Workflow Planning — APPROVED 2026-11-18T05:13:20Z (with two items for Application Design: the examples' secret source; how CI runs soorma-core)
- [x] Application Design — APPROVED 2026-11-18T05:51:30Z. Answers 2026-11-18T05:32:10Z (Q1, Q3–Q6, Q8 A; Q2, Q7, Q9 X); AD-01 to AD-15; carried CDI-01 to CDI-03
- [ ] Units Generation — answers 2026-11-18T06:05:15Z (Q1 A with U1 and U2 done-when additions; Q2 A; Q3 A); units generated; follow-up Q1a (U2 expects 200, the contract's success) to confirm at the gate; awaiting approval
- [ ] Tickets (extension) — EXECUTE
- [ ] QA test specs, inception pass (extension) — EXECUTE
- [ ] Inception PR gate (extension) — EXECUTE

### CONSTRUCTION PHASE
- [ ] Construction Phase Initialization — EXECUTE
- Per unit, in order U1 → U2 → U3 → U4; each: Unit Initialization and L1 gate; Infrastructure Design SKIP
- [ ] U1 `contract-and-conformance` (ordinary): Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE
- [ ] U2 `e2e-stack` (ordinary): Functional Design, NFR Requirements, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE; NFR Design SKIP (Q3 A; reinstated if NFR Requirements finds a pattern)
- [ ] U3 `typescript-harness` (harness): Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE
- [ ] U4 `python-harness` (harness): Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE
- [ ] Build and Test — EXECUTE
