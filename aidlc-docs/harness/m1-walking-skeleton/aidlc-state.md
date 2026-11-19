# AI-DLC State Tracking

## Project Information
- **Project Type**: Greenfield
- **Start Date**: 2026-11-17T07:29:06Z
- **Current Stage**: CONSTRUCTION - U3 typescript-harness, Code Generation Part 2: G1 `89aa962`, G2 `eb57cf0` pushed; G3 (secrets, transport, retry, keeper) gate green; next: G4
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
| CDI-05 | **67 of the 90 cases are first run at U3**: no U1 job runs them; U1 checked only their structure (the schema, links and fixtures). They first run under U3's TypeScript driver. When one fails there, decide first whether the SDK or the case is wrong. Fixing a case is a change to an earlier unit's tests (F42): record it as one, with the reason, in U3's code summary and `audit.md`. Never edit a case quietly | C-03 (the conformance suite's cases) | U3 (then U4) | Design input | Open: to U3 Code Generation (the user, 2026-11-18T17:43:12Z) |
| CDI-06 | **One validity check** (the user, at the U3 Functional Design approval): "while the credential is valid" is decided in one place in `keeper.ts`, used by REN-06's bootstrap, REN-06's retry of a `503` on renewal, PRB-09's renewal retry while unexpired, and the stream supervisor's resubscribe. On a lineage with the clock-skew warning (REN-07) it answers valid until S3 says `credential_expired`; otherwise it uses the wall clock. **Nowhere else compares `expiresAt` with `Date.now()` to decide validity.** Unit test: on a skewed lineage, a `503` on renewal is retried and a dropped stream is resubscribed, without a bootstrap | C-14, C-17 | U3 (then U4) | Design input | Open: to U3 Code Generation (noted in its plan) |

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
- **Status**: MERGED 2026-11-18T17:30:33Z (confirmed on GitHub 2026-11-18T17:32:21Z); CHECKS_GREEN was 2026-11-18T17:25:53Z
- **PR**: soorma-ai/soorma-sdk#10 (dev → main), opened 2026-11-18T15:44Z; head `2b8c135` at CHECKS_GREEN (the run IDs below are for that head; the commit recording this state is bookkeeping only)
- **Checks at `2b8c135`**: CI run 44358181296 (pull request): unit, repository checks, conformance self-test and **dependency review** green; DCO run 44358181249 green; CI run 44358169366 (push to dev) green (dependency review skipped on push by design)
- **Earlier head `7ca7c57`**: CI run 44339401082 had dependency review red because the Dependency graph was disabled; the user enabled it 2026-11-18T17:20:44Z (no rerun: the fixes' push gave a fresh run)
- **Fixes on the PR** (the user, 2026-11-18T17:20:44Z): `5314abe` audit exceptions honour the release cooldown; `cb84234` leftover fragment removed from aidlc-state.md; `2b8c135` OBL-03 recorded
- **dco.yml checking its own PR**: run 44339401604 (first; all ten commits then signed off, none needed the exemption); again in run 44358181249
- **Final head `a57f6d5`**: CI run 44358647204 (pull request) green, dependency review included; DCO run 44358647419 green; CI run 44358636704 (push) green
- **Merged**: merge commit `91d09106c9d5e323a6a47cd67d074a5b1adc9e88` on `main`, 2026-11-18T17:30:33Z, parents `c8ebb7a` (main) and `a57f6d5` (PR head); dev fast-forwarded to it

### Construction Design PR Gate — e2e-stack
- **Status**: APPROVED (merged)
- **Branch**: dev (the user's standing instruction; confirmed for this gate 2026-11-18T22:26:50Z: dev → main, as for #9)
- **Instructions**: aidlc-docs/harness/m1-walking-skeleton/construction/working/e2e-stack-design-pr-checkpoint-instructions.md
- **PR**: soorma-ai/soorma-sdk#16 (dev → main), opened 2026-11-18T22:27:57Z; checks green 2026-11-18T22:29:41Z at `17a2b21`. Merged 2026-11-19T01:27:13Z, merge commit `d3ab2344202cf981c292bdc2e2aff881c411d19d`, parents `91d0910` (main) and `9416420` (PR head) (confirmed on GitHub 2026-11-19T01:29:43Z); dev fast-forwarded to it
- **Checks at `17a2b21`**: CI run 44411836632 (pull request): unit, repository checks, conformance self-test and **dependency review** green; DCO run 44411836353 (Check sign-off) green; CI run 44411816416 (push to dev) green (dependency review skipped on push by design)
- **Final head `9416420`**: CI run 44412142865 (pull request) green, dependency review included; DCO run 44412141421 green; CI run 44412132883 (push) green
- **Created**: 2026-11-18T22:27:14Z
- **Approved**: 2026-11-19T01:29:43Z

### Code PR — e2e-stack
- **Status**: MERGED 2026-11-19T04:08:31Z (confirmed on GitHub 2026-11-19T04:12:24Z); CHECKS_GREEN was 2026-11-19T04:01:48Z
- **Branch**: dev (the user's standing instruction: dev → main)
- **PR**: soorma-ai/soorma-sdk#17 (dev → main), opened 2026-11-19T03:59:38Z; head `8892fcc` at CHECKS_GREEN (the run IDs below are for that head; the commit recording this state is bookkeeping only)
- **Checks at `8892fcc`**: CI run 44455207562 (pull request): unit, repository checks, conformance self-test, **changes, e2e (1 min 41 s)** and **dependency review** green; DCO run 44455207572 (Check sign-off) green; CI run 44454972332 (push to dev) green, with `e2e` **skipped** (`changes`: `e2e=false`, the push touched `aidlc-docs/` only: TC-ES-010's real case)
- **Final head `b5a000b`** (the bookkeeping commit): CI run 44455550563 (pull request) green, `e2e` and dependency review included; DCO run 44455550601 green; CI run 44455544010 (push) green, `e2e` skipped (`aidlc-docs/` only)
- **Merged**: merge commit `3f4883c2566c2bfbf5d1ddefb7724207bdc8b864` on `main`, 2026-11-19T04:08:31Z, parents `d3ab234` (main) and `b5a000b` (PR head); dev fast-forwarded to it

### Construction Design PR Gate — typescript-harness
- **Status**: APPROVED (merged)
- **Branch**: dev (the user's standing instruction; confirmed for this gate 2026-11-19T05:32:43Z: dev → main, as for #9 and #16)
- **Instructions**: aidlc-docs/harness/m1-walking-skeleton/construction/working/typescript-harness-design-pr-checkpoint-instructions.md
- **PR**: soorma-ai/soorma-sdk#18 (dev → main), opened 2026-11-19T05:33:14Z; checks green 2026-11-19T05:35:24Z at `1bc3c54`. Merged 2026-11-19T05:42:28Z, merge commit `06b9df85c117024f63904904fb0b9ebee7794910`, parents `3f4883c` (main) and `f846e85` (PR head) (confirmed on GitHub 2026-11-19T05:43:48Z); dev fast-forwarded to it
- **Checks at `1bc3c54`**: CI run 44465960245 (pull request): unit, repository checks, conformance self-test, changes, and **dependency review** green; `e2e` skipped (`aidlc-docs/` only); DCO run 44465960292 (Check sign-off) green; CI run 44465951245 (push to dev) green, `e2e` skipped
- **Final head `f846e85`**: CI run 44466251614 (pull request) green, dependency review included; DCO run 44466251601 green; CI run 44466245657 (push) green
- **Created**: 2026-11-19T05:33:09Z
- **Approved**: 2026-11-19T05:43:48Z

## Extension Configuration

| Extension | Enabled | Decided At | Notes |
|---|---|---|---|
| security-baseline | Yes | Requirements Analysis (Q11) | Opted in — deployment: local-only. *(hosted)* clauses listed under `## Carried Security Obligations` |
| soorma-platform-invariants | Yes | Requirements Analysis (Q12) | Scope inherited from PF §15 and ID §15: I1 to I11 all Addressed in both, none N/A. Invariants read at `prd-platform-foundations-v1.3` and `prd-identity-v1.0`; text identical at both tags (SHA-256 c66c0170…) |
| pr-checkpoint | Yes | Requirements Analysis (Q13) | Gates on `dev` → `main` PRs (the user's git instruction) |
| qa-test-cases | Yes | Requirements Analysis (Q14) | Opted in — scope: comprehensive |
| tickets | Yes | Requirements Analysis (Q15) | Opted in — target: GitHub issues: soorma-ai/soorma-sdk; initiative ticket → tracking issue; unit ticket → sub-issue |

Full rules loaded at opt-in: security-baseline.md, soorma-platform-invariants.md, pr-checkpoint.md, qa-test-cases.md, tickets.md.

## Dependency Updates

Dependabot PRs into `dev` (NFR-U1-27), merged by the user with the reviewer; confirmed on GitHub 2026-11-19T02:46:05Z. Each merge commit has no sign-off: the DCO check reads non-merge commits only (`git rev-list --no-merges`), and each Dependabot commit passes on the verified exemption (NFR-U1-29; OBL-01).

| PR | Update | Dependabot commit | Merge commit on `dev` | Merged |
|---|---|---|---|---|
| #11 | `pnpm/action-setup` 6.1.0 → 6.1.1 | `c31d834` | `7c39e314723ecd685823069eebb8ec559b4c7495` | 2026-11-19T01:52:44Z |
| #12 | `prettier` 3.9.10 → 3.10.0 | `3325ecc` | `b6825c4d43faf6cb8c3041677be731d6b6994824` | 2026-11-19T01:52:48Z |
| #13 | `@types/node` 24.19.2 → 26.6.6 | — | **Closed, not merged**, 2026-11-19T01:29:28Z: `engines.node` is `>=24.22.3 <25`; `f33145c` ignores `@types/node`'s semver-major updates (DEPENDENCIES.md, *Update rules*) | — |
| #14 | `typescript-eslint` 8.72.1 → 8.72.2 | `bb8946b` (rebased by Dependabot onto `b6825c4`; fresh runs green) | `2ce42fb6142b241e2330cc89ecf3ce7a0ea21395` | 2026-11-19T02:43:01Z |
| #15 | `@opentelemetry/api` 1.9.1 → 1.10.0 | `fce8ed4` (rebased likewise) | `85f639d5c39cd8034e415219e5df25131e102fc9` | 2026-11-19T02:43:08Z |

- `dev`'s push CI at `85f639d`, all four together: run 44446341525, green
- Local `dev` fast-forwarded `1570b86..85f639d`. On Node 24.22.3 and pnpm 12.18.0: `pnpm install --frozen-lockfile`, then the local gate (typecheck, lint, format check, 98 tests, `pnpm audit --audit-level moderate`, audit exceptions, repository checks, conformance self-test), all green, 2026-11-19T02:48:31Z. U2's Code Generation plan is written against this `dev`

## Open Obligations

| ID | Obligation | Source | Status |
|---|---|---|---|
| OBL-01 | **Live confirmation of the DCO exemption**: the first real Dependabot PR into `dev`, and the `dev` → `main` PR after it; record both CI run IDs here | U1 NFR-U1-32 (the user, 2026-11-18T08:05:52Z) | **Discharged** (the user, 2026-11-19T01:28:22Z): DCO run 44359586310 on the first Dependabot PR, soorma-ai/soorma-sdk#11 into `dev`, logs `skip  c31d834f  build(deps): bump pnpm/action-setup from 6.1.0 to 6.1.1  (dependabot[bot], verified by GitHub)` (confirmed in the run's log 2026-11-19T01:29:43Z). Merge commits are outside the check (`rev-list --no-merges`), so merging the Dependabot PRs into `dev` adds no unsigned commit to the next `dev` → `main` PR; the Dependabot commits themselves reach that PR and are exempted there by the same rule |
| OBL-02 | **AD-13's CI time**, first measured on U2's code PR, with the run ID recorded | Units Generation (U2 *done when*) | **Discharged** 2026-11-19T04:02:28Z: measured on U2's code PR #17, CI run 44455207562 (pull request, head `8892fcc`), `e2e` job **1 min 41 s** (03:59:55Z to 04:01:36Z), nothing cached: set-up steps about 25 s, `core-up` 69 s (clone, install, four image builds, `stack:init`, `stack:up`), `setup` 1 s, `prove-stack` under 1 s, `core-down` 2 s. **Under 8 minutes**: NFR Requirements is not reopened (NFR-U2-02). First run on a push: CI run 44454329278, 1 min 39 s |
| OBL-03 | **DCO check runs the base branch's code, not the PR's**: `.github/workflows/dco.yml` checks out the PR's merge commit and imports `tools/dco/action.ts` from it, so a pull request from a fork could change the code that judges it. Once #10 is merged and `main` has `tools/dco`, check out the base commit (`github.event.pull_request.base.sha`) for the tools and read the PR's commits separately (the API or a fetch of the head), never executing the PR's own `tools/`. Observation, to settle then: under `pull_request` the workflow file itself also comes from the PR, so the fix closes the `tools/` path; the workflow file's own path needs a separate answer (for example review required on `.github/`) | The user, on PR #10 (2026-11-18T17:20:44Z); recorded only, not done in #10 | Open: after #10 merges, in a later PR |
| OBL-04 | **CC-SEC-05 runs in CI: the CI user helper**. U3's TypeScript conformance job, and U4's Python job after it, must create the second local user (`sudo`) and pass it to the runner with `--foreign-user`. CC-SEC-05 must run in CI, and `--local-skip` stays refused there (NFR-U1-14, -16). U1 did not build the helper (no U1 job runs CC-SEC-05; the reference driver does not declare it); U2 runs no conformance, so nothing changes for U2 | U1 NFR Design *CI user helper* (`logical-components.md`); deferred at the U1 Code Generation approval (the user, 2026-11-18T17:43:12Z) | Open: at U3 Code Generation, then U4 |

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
- [x] U1 `contract-and-conformance` (ordinary): Unit Initialization and L1 gate done 2026-11-18T06:49:05Z; Functional Design APPROVED 2026-11-18T07:25:27Z (corrections 2026-11-18T07:17:08Z; GAP-CAC-001 raised, soorma-core#34). NFR Requirements APPROVED 2026-11-18T08:05:52Z. NFR Design APPROVED 2026-11-18T08:26:29Z. QA enrichment done 2026-11-18T08:28:18Z (13 modified, 21 added; 45 cases). Design PR #9 merged 2026-11-18T08:38:48Z (`c8ebb7a`). Code Generation plan APPROVED 2026-11-18T08:46:28Z (1.1 changed: declared-set rule). Part 2 in progress: G1 `34d6f76` (CI 44271040027 green); G2 `cbd0a4a` (CI 44271420822 green); G3 `266347d` (CI 44272174556 green); G4 `95700f1` (CI 44272417353 green); G5 `98dc659` (CI 44333400503 green); G6 `018341a` (CI 44334002163 green); G7 `f63ec4e` (CI 44335889222 green); G8 `f63e652` (CI 44337861952 green, self-test job included); G9 `7ca7c57` (CI 44338826146 green); code PR #10 open 2026-11-18T15:48:45Z; fixes `5314abe`, `cb84234`, `2b8c135`; CHECKS_GREEN 2026-11-18T17:25:53Z (final head `a57f6d5`: CI 44358647204, DCO 44358647419, push CI 44358636704); MERGED 2026-11-18T17:30:33Z (`91d0910`). **Code Generation COMPLETE** 2026-11-18T17:32:21Z; **APPROVED** 2026-11-18T17:43:12Z (records fixed first: OBL-04, CDI-05, code-summary.md). Stages: Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE
- [x] U2 `e2e-stack` (ordinary): Unit Initialization and L1 gate done 2026-11-18T17:49:55Z; Functional Design questions written 2026-11-18T17:49:55Z; answered 2026-11-18T18:51:06Z (U2-FD-Q1 to Q8; Q7 X); artifacts generated 2026-11-18T18:56:16Z (L1: 5 Covered, 0 Missing; invariants: 9 Covered, 2 N/A, 0 Missing); Request Changes 2026-11-18T19:20:00Z (one sign-in only, ended and checked refused) applied 2026-11-18T19:21:01Z, **Functional Design APPROVED** 2026-11-18T19:25:25Z (as revised in `58f58cc`; for QA enrichment: TC-ES-020's fake validates every response it sends against the vendored contract's schema for that operation and status). NFR Requirements questions written 2026-11-18T19:26:57Z; answered 2026-11-18T20:01:38Z (U2-NFR-Q1 to Q6, all A; Q6's reasons corrected); artifacts generated 2026-11-18T20:03:44Z (NFR-U2-01 to 24, TS-U2-01 to 10; CU-11 to CU-13 and TC-ES-021 added to the Functional Design); **NFR Design stays SKIPPED** (no pattern left to design). **NFR Requirements APPROVED** 2026-11-18T20:54:18Z with the time-limit addition applied 2026-11-18T20:55:10Z (GEN-07, CD-07, TS-U2-11; JOB-03 core-down if: always(), --logs on failure() || cancelled(); TC-ES-022, 023). QA enrichment done 2026-11-18T20:59:34Z (12 modified, 11 added; 23 cases). **Design PR gate APPROVED** 2026-11-19T01:29:43Z (#16 merged as `d3ab234`, 2026-11-19T01:27:13Z). Code Generation plan written 2026-11-19T02:54:59Z against `dev` at `d4b30d8` (28 steps, 6 commit groups; two class 2 changes to U1's checks). **Code Generation plan APPROVED** 2026-11-19T03:03:47Z with changes: Step 25 (b) on real traffic (core-up, setup, prove-stack, core-down --logs), the ST-01 refusal a separate check, the search outcome per service in the code summary; **design change against the approved Functional Design** (the user, 2026-11-19T03:03:47Z): the log search runs on every core-down, a hit or unreadable source fails it on a green run too, --logs only prints clean logs (LS-11, CD-02, CD-06, JOB-03, NFR-U2-04, TC-ES-015, TC-ES-008(b) changed; LS-12 added, TC-ES-018 extended); local run approved, stop if a soorma-local project or volume exists. Part 2: G0 (design records), then G1. Code Generation Part 2 done: G0 `5de6b7e`, G1 `0fd1dc0`, G2 `2a63a94`, G3 `f61254e`, G4 `75a6106`, G5 `c68065c`, G6 `8892fcc`, each push CI green; local run (a), (b), (c) green 2026-11-19T03:51Z; code PR #17 CHECKS_GREEN 2026-11-19T04:01:48Z (OBL-02: e2e 1 min 41 s). **Code PR #17 MERGED** 2026-11-19T04:08:31Z as `3f4883c`. **Code Generation APPROVED** 2026-11-19T04:11:52Z. **U2 COMPLETE.** Functional Design, NFR Requirements, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE; NFR Design SKIP (Q3 A; reinstated if NFR Requirements finds a pattern)
- [ ] U3 `typescript-harness` (harness): Unit Initialization and L1 gate done 2026-11-19T04:17:58Z (25 applicable, 5 N/A); Functional Design questions written 2026-11-19T04:17:58Z (U3-FD-Q1 to Q9); answered 2026-11-19T04:23:22Z (Q1 to Q6, Q9 A; Q7 A with a decoy span; Q8 X: REN-07, R_min, CC-REN-06, the fast-Date renewal); artifacts generated 2026-11-19T04:30:27Z (L1: 25 Covered, 5 N/A, 0 Missing; invariants: 9 Covered, 2 N/A, 0 Missing; TH-F42: REN-07, CC-REN-06 and the reference driver foreseen as changes to U1); Request Changes 2026-11-19T04:38:24Z (SPN-03 governs: receive span links nothing; no depth refusal at publish; REN-07: after the warning S3 judges the lineage's expiry; CC-REN-07) applied 2026-11-19T04:39:39Z, **Functional Design APPROVED** 2026-11-19T04:45:45Z (as revised in `8c65ed1`; CDI-06 for Code Generation). NFR Requirements questions written 2026-11-19T04:48:15Z (U3-NFR-Q1 to Q8); answered 2026-11-19T04:55:32Z (all A; Q4 with the exports-map detail); artifacts generated 2026-11-19T04:57:00Z (NFR-U3-01 to 27, TS-U3-01 to 13); **NFR Design runs** (patterns to design: retry policy, validity check, supervisor, clock seam, trust store, CI user helper); **NFR Requirements APPROVED** 2026-11-19T05:02:26Z (SECURITY-12 recorded per clause). NFR Design questions written 2026-11-19T05:03:24Z (U3-NFR-D-Q1 to Q3); answered 2026-11-19T05:13:36Z (Q1 A, Q3 A; Q2 A with three changes: timers count only while a stream is read, the new stream paused during a replacement, STR-02 and STR-05 sentences and CC-STR-12, CC-STR-13 as F42); artifacts generated 2026-11-19T05:16:00Z (P-01 to P-10); **NFR Design APPROVED** 2026-11-19T05:24:09Z (SEC-01 reworded and CC-ACQ-08 added to the F42 list). QA enrichment done 2026-11-19T05:26:56Z (29 modified, 14 added; 80 cases). **Design PR gate APPROVED** 2026-11-19T05:43:48Z (#18 merged as `06b9df8`, 2026-11-19T05:42:28Z). Code Generation plan written 2026-11-19T05:49:07Z against `dev` at `f18e25c` (44 steps, 9 groups; G1 the F42 changes; CDI-06 in G3; the first full suite run in G6; OBL-04 discharged at the code PR); **Code Generation plan APPROVED** 2026-11-19T06:55:43Z (1.1 clarified: the import direction of the values hook). Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE
- [ ] U4 `python-harness` (harness): Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation and Code PR — EXECUTE
- [ ] Build and Test — EXECUTE
