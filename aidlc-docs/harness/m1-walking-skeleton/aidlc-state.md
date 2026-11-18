# AI-DLC State Tracking

## Project Information
- **Project Type**: Greenfield
- **Start Date**: 2026-11-17T07:29:06Z
- **Current Stage**: CONSTRUCTION - U1 contract-and-conformance, Code Generation (Part 2)
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
| GAP-CAC-001 | U1 (U3, U4 implement) | Whether a renewal leaves the previous agent token valid (decides whether `credential_refused` on a retried renewal is terminal) | Open; worked around (refused on a retried renewal treated as terminal, fail closed) | soorma-core wire contract @ `contract-v0.1.0` (PF §11, §14 context) | — | soorma-ai/soorma-core#34: https://github.com/soorma-ai/soorma-core/issues/34 |

## Deferred Questions

| ID | Question | Deferred To | Reason | Source | Status |
|---|---|---|---|---|---|
| US-Q1 | How a forwarding hop's span relates to the trace it received: child or link (US-08 #4) | **U1 `contract-and-conformance` Functional Design**, where the span rules are written (Units Generation Q2 A, at the user's direction; was: the unit holding C-19). U3 and U4 implement the rule in C-19 | GAP-INT-002's open choice; to be settled under the work-around, consistent with *done when* 5's trace-id check, and recorded as a decision (user, at User Stories approval) | stories.md US-08 #4; soorma-sdk GAP-INT-002 | **Discharged** 2026-11-18T07:05:50Z: DEC-U1-01, child of the received context; no link to it as parent; a link to tenant code's active span when that is not the received context; the deviation from ambient-context parenting documented in the unstable span shape (SPN-03, SPN-06; construction/contract-and-conformance/functional-design/business-rules.md) |

## Units

| Unit | Name | Shape | Depends on | Proves |
|---|---|---|---|---|
| U1 | `contract-and-conformance` | ordinary | — | Its own runner: a test-only reference driver passes; negative controls (secret retained; forwarded envelope text reordered; publish retried; boundary item skipped) fail on their named cases, in CI on its code PR |
| U2 | `e2e-stack` | ordinary | — | core-up, setup, one raw `POST /agent-credentials` per agent (expects `200`, per the contract; Q1a answered), core-down; no secret printed; CI time first measured, run ID recorded |
| U3 | `typescript-harness` | harness | U1, U2 | Every case on Node 24 and 26; *done when* 2, 3, 5: M1's proof |
| U4 | `python-harness` | harness | U1, U2 (after U3) | Every case on 3.11 and newest; *done when* 2, 3, 5 |

Detail: inception/application-design/unit-of-work.md

## Carried Design Inputs

Settled or directed by the user at the Application Design approval (audit 2026-11-18T05:51:30Z).
Each is an input to the named unit's Functional Design; the unit is set at Units Generation.

| ID | Input | Owning component | Unit | Kind | Status |
|---|---|---|---|---|---|
| CDI-01 | **Decision**: `credential.environment` (`organization`, `project`, `environment`) is exposed **read only**. Settles T-6 (User Stories gap pass). Traces to FR-15: the client accepts no environment and only reports what the credential says | C-11, C-14 | U1 (specification); U3, U4 | Decision (recorded) | Settled; stated as CRD-03 in U1's specification |
| CDI-02 | **US-02 #3 is checked by the runtime, not reported by the driver**: the driver's `inspect` checks the runtime itself, never lists its own fields. TypeScript: force garbage collection, take a heap snapshot, find no occurrence of the secret's value. Python: `sys.getrefcount` on the string the test provider returned is back to its value before bootstrap (Python's gc does not track strings). The conformance unit's Functional Design defines both | C-03, C-21 | U1 (defines); U3, U4 (drivers implement) | Design input | **Defined** 2026-11-18T07:05:50Z in U1's Functional Design (business-logic-model.md §4; case CC-SEC-01) |
| CDI-03 | **`fileSecret` never blocks on a special file**: open the path without blocking (`O_NONBLOCK`, or the language's equivalent), check the opened handle (regular file, mode, owner), and only then read. A named pipe or device at the path is refused, never waited on | C-13 | U1 (specification); U3, U4 (Windows behaviour in their Functional Design) | Design input | **Stated** 2026-11-18T07:05:50Z as SEC-04, SEC-05 (cases CC-SEC-03, CC-SEC-07); Windows open to U3 and U4 Functional Design (SEC-09) |
| CDI-04 | **The typed envelope claims no field is present that the SDK did not check** (DEC-U1-09 follow-on): optional types, or documented, per language | C-18 | U3, U4 (each language's Functional Design); stated in U1 as RCV-08 | Design input | Open: to U3 and U4 Functional Design |

## Tickets
- **Status**: Complete
- **Target**: GitHub issues: soorma-ai/soorma-sdk
- **Kinds**: initiative ticket → tracking issue; unit ticket → sub-issue
- **Initiative ticket**: soorma-ai/soorma-sdk#3

| Unit | Ticket |
|---|---|
| contract-and-conformance | soorma-ai/soorma-sdk#4 |
| e2e-stack | soorma-ai/soorma-sdk#5 |
| typescript-harness | soorma-ai/soorma-sdk#6 |
| python-harness | soorma-ai/soorma-sdk#7 |

## PR Checkpoint State

### Inception PR Gate
- **Status**: APPROVED (merged)
- **Branch**: dev (confirmed by the user's standing instruction: work on dev, PR dev to main)
- **Instructions**: aidlc-docs/harness/m1-walking-skeleton/inception/working/pr-checkpoint-instructions.md
- **PR**: soorma-ai/soorma-sdk#8 (dev → main), opened 2026-11-18T06:20:40Z; checks green 2026-11-18T06:21:08Z (Check sign-off: pass). Merged 2026-11-18T06:34:29Z, merge commit `c8bffb3020e9474043608e703eb0b77fc549cb54` (confirmed on GitHub 2026-11-18T06:47:24Z)
- **Created**: 2026-11-18T06:20:15Z
- **Approved**: 2026-11-18T06:47:24Z

### Construction Design PR Gate — contract-and-conformance
- **Status**: APPROVED (merged)
- **Branch**: dev (the user's standing instruction)
- **Instructions**: aidlc-docs/harness/m1-walking-skeleton/construction/working/contract-and-conformance-design-pr-checkpoint-instructions.md
- **PR**: soorma-ai/soorma-sdk#9 (dev → main), opened 2026-11-18T08:28:30Z; checks green 2026-11-18T08:28:55Z (Check sign-off: pass). Merged 2026-11-18T08:38:48Z, merge commit `c8ebb7a708911e6a75a2bff3d2a3b2ab356c5ac6` (confirmed on GitHub 2026-11-18T08:40:41Z)
- **Created**: 2026-11-18T08:28:18Z
- **Approved**: 2026-11-18T08:40:41Z

### Code PR — contract-and-conformance
- **Status**: OPEN (one check red: a repository setting, not the change)
- **PR**: soorma-ai/soorma-sdk#10 (dev → main), opened 2026-11-18T15:44Z, head `7ca7c57`
- **Checks**: CI run 44339401082 (pull request): unit, checks, conformance self-test green; **dependency review failed: the repository's Dependency graph is disabled** ("Dependency review is not supported on this repository"); DCO run 44339401604 green
- **dco.yml checking its own PR**: run 44339401604 (all ten commits signed off; none needed the exemption)
- **Merged**: —

## Extension Configuration

| Extension | Enabled | Decided At | Notes |
|---|---|---|---|
| security-baseline | Yes | Requirements Analysis (Q11) | Opted in — deployment: local-only. *(hosted)* clauses listed under `## Carried Security Obligations` |
| soorma-platform-invariants | Yes | Requirements Analysis (Q12) | Scope inherited from PF §15 and ID §15: I1 to I11 all Addressed in both, none N/A. Invariants read at `prd-platform-foundations-v1.3` and `prd-identity-v1.0`; text identical at both tags (SHA-256 c66c0170…) |
| pr-checkpoint | Yes | Requirements Analysis (Q13) | Gates on `dev` → `main` PRs (the user's git instruction) |
| qa-test-cases | Yes | Requirements Analysis (Q14) | Opted in — scope: comprehensive |
| tickets | Yes | Requirements Analysis (Q15) | Opted in — target: GitHub issues: soorma-ai/soorma-sdk; initiative ticket → tracking issue; unit ticket → sub-issue |

Full rules loaded at opt-in: security-baseline.md, soorma-platform-invariants.md, pr-checkpoint.md, qa-test-cases.md, tickets.md.

## Open Obligations

| ID | Obligation | Source | Status |
|---|---|---|---|
| OBL-01 | **Live confirmation of the DCO exemption**: the first real Dependabot PR into `dev`, and the `dev` → `main` PR after it; record both CI run IDs here | U1 NFR-U1-32 (the user, 2026-11-18T08:05:52Z) | Open: awaiting the first Dependabot PR |
| OBL-02 | **AD-13's CI time**, first measured on U2's code PR, with the run ID recorded | Units Generation (U2 *done when*) | Open: at U2 Code Generation |
| OBL-03 | **DCO check runs the base branch's code, not the PR's**: `.github/workflows/dco.yml` checks out the PR's merge commit and imports `tools/dco/action.ts` from it, so a pull request from a fork could change the code that judges it. Once #10 is merged and `main` has `tools/dco`, check out the base commit (`github.event.pull_request.base.sha`) for the tools and read the PR's commits separately (the API or a fetch of the head), never executing the PR's own `tools/`. Observation, to settle then: under `pull_request` the workflow file itself also comes from the PR, so the fix closes the `tools/` path; the workflow file's own path needs a separate answer (for example review required on `.github/`) | The user, on PR #10 (2026-11-18T17:20:44Z); recorded only, not done in #10 | Open: after #10 merges, in a later PR |

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
- [x] Units Generation — APPROVED 2026-11-18T06:14:40Z. Answers 2026-11-18T06:05:15Z (Q1 A with U1 and U2 done-when additions; Q2 A; Q3 A); Q1a answered: 200, per the contract
- [x] Tickets (extension) — Complete: tracking issue #3; sub-issues #4 to #7
- [x] QA test specs, inception pass (extension) — 2026-11-18T06:20:15Z: comprehensive; contract-and-conformance 24 (CAC), e2e-stack 12 (ES), typescript-harness 66 (TH), python-harness 66 (PH); inception/test-cases/
- [x] Inception PR gate (extension) — APPROVED: PR #8 merged 2026-11-18T06:34:29Z (`c8bffb3`); dev fast-forwarded to main

### CONSTRUCTION PHASE
- [x] Construction Phase Initialization — 2026-11-18T06:49:05Z: rules loaded for the five enabled extensions; prd-gap-classification.md active
- Per unit, in order U1 → U2 → U3 → U4; each: Unit Initialization and L1 gate; Infrastructure Design SKIP
- [ ] U1 `contract-and-conformance` (ordinary): Unit Initialization and L1 gate done 2026-11-18T06:49:05Z; Functional Design APPROVED 2026-11-18T07:25:27Z (corrections 2026-11-18T07:17:08Z; GAP-CAC-001 raised, soorma-core#34). NFR Requirements APPROVED 2026-11-18T08:05:52Z. NFR Design APPROVED 2026-11-18T08:26:29Z. QA enrichment done 2026-11-18T08:28:18Z (13 modified, 21 added; 45 cases). Design PR #9 merged 2026-11-18T08:38:48Z (`c8ebb7a`). Code Generation plan APPROVED 2026-11-18T08:46:28Z (1.1 changed: declared-set rule). Part 2 in progress: G1 `34d6f76` (CI 44271040027 green); G2 `cbd0a4a` (CI 44271420822 green); G3 `266347d` (CI 44272174556 green); G4 `95700f1` (CI 44272417353 green); G5 `98dc659` (CI 44333400503 green); G6 `018341a` (CI 44334002163 green); G7 `f63ec4e` (CI 44335889222 green); G8 `f63e652` (CI 44337861952 green, self-test job included); G9 `7ca7c57` (CI 44338826146 green); code PR #10 open 2026-11-18T15:48:45Z: dependency review red until the Dependency graph is enabled (user decision). Stages: Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE
- [ ] U2 `e2e-stack` (ordinary): Functional Design, NFR Requirements, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE; NFR Design SKIP (Q3 A; reinstated if NFR Requirements finds a pattern)
- [ ] U3 `typescript-harness` (harness): Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE
- [ ] U4 `python-harness` (harness): Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE
- [ ] Build and Test — EXECUTE
