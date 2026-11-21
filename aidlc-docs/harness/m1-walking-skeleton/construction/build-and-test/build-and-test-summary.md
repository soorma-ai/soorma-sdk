# Build and Test Summary

soorma-sdk's M1, all four units: U1 `contract-and-conformance`, U2 `e2e-stack`, U3
`typescript-harness` (`@soorma/sdk`), U4 `python-harness` (`soorma`), against soorma-core's
`contract-v0.1.0` (`c1e3d7f`). Run on 2026-11-20 at `dev` `755ccf7` (code as merged in #23,
`73d88c3`) and, for the README, fresh clones at `755ccf7` and `2a64284`. Instructions: the other
files in this folder.

## Build Status

- **Build tools**: pnpm 12.18.0 on Node.js 24.22.3 (`tsc` for `@soorma/sdk`); uv 0.13.8 with
  `uv_build` 0.13.8 (`soorma`).
- **Build status**: Success.
- **Build artifacts**: `typescript/dist/`; `soorma-0.1.0-py3-none-any.whl` and
  `soorma-0.1.0.tar.gz` (built in `package-python`, run 23). Neither package is published.
- **Build time**: `tsc` 1 s (run 16); `uv build` under 1 s.

## Runs

Every run, in order, failed ones included. Logs: `construction/working/build-and-test-runs/`
(git-ignored), one file per run, `NNN-name.log`, never overwritten; `runs.tsv` indexes them.
Runs 1 to 12 and 31 to 44 ran in fresh clones; runs 13 to 30 in the working tree.

| # | Suite or sequence | Result | Cause, if it failed | Log |
|---|---|---|---|---|
| 1 | README, fresh clone at `755ccf7`: `pnpm install --frozen-lockfile` | Pass | | `001-readme-install.log` |
| 2 | README: `pnpm typecheck && pnpm lint && pnpm format:check` | Pass | | `002-readme-static.log` |
| 3 | README: `pnpm test` | Pass: 302 tests | | `003-readme-test.log` |
| 4 | README: `pnpm checks` | **Fail** | **The README never built `@soorma/sdk`**: the names check's TypeScript driver loads `typescript/dist/index.js` (`ERR_MODULE_NOT_FOUND` in the log), so it timed out. CI's `checks` job builds first. Fixed in the README (`2a64284`); run 35 passes | `004-readme-checks.log` |
| 5 | README: `pnpm checks --offline` | **Fail** | The same cause as run 4; run 36 passes | `005-readme-checks-offline.log` |
| 6 | README: `pnpm conformance:self-test` | Pass: reference 27 passed; the four faults as declared | | `006-readme-self-test.log` |
| 7 | README: `pnpm audit --audit-level moderate && pnpm check:audit-exceptions` | Pass | | `007-readme-audit.log` |
| 8 | README, `python/`: `uv sync --locked` | Pass | | `008-readme-py-sync.log` |
| 9 | README: `ruff check`, `ruff format --check` | Pass | | `009-readme-py-lint.log` |
| 10 | README: `mypy`, `pytest -q` | Pass: 395 tests | | `010-readme-py-types-tests.log` |
| 11 | README: `scripts/audit.sh` | Pass: both resolutions clean | | `011-readme-py-audit.log` |
| 12 | README: `pnpm conformance run` with the Python driver | **Fail**: 96 passed, CC-SEC-05 failed | **The README's command lacked `--local-skip CC-SEC-05`**: CC-SEC-05 needs a second local user, which CI creates and a laptop has not (`conformance/README.md` documents the local skip). Fixed in the README (`2a64284`); run 44 passes | `012-readme-py-conformance.log` |
| 13 | pytest, Python 3.11.18 | Pass: 395 | | `013-unit-python-3.11.log` |
| 14 | pytest, Python 3.15.2 | Pass: 395 | | `014-unit-python-3.15.log` |
| 15 | Vitest | Pass: 302 in 30 files | | `015-unit-node.log` |
| 16 | `pnpm --filter @soorma/sdk build` | Pass | | `016-build-typescript.log` |
| 17 | `pnpm checks` (drift, SPDX, workflows, generated types, names: 2 languages, packaging) | Pass | | `017-checks.log` |
| 18 | Conformance, TypeScript, Node 24.22.3 | Pass: 96, 1 not run (CC-SEC-05, local), 121 s | | `018-conformance-ts-node24.log` |
| 19 | Conformance, TypeScript, Node 26.13.0 | Pass: 96, 1 not run, 120 s | | `019-conformance-ts-node26.log` |
| 20 | Conformance, Python 3.11.18 | Pass: 96, 1 not run, 85 s | | `020-conformance-py-3.11.log` |
| 21 | Conformance, Python 3.15.2 | Pass: 96, 1 not run, 87 s | | `021-conformance-py-3.15.log` |
| 22 | `pnpm package:typescript` | Pass | | `022-package-typescript.log` |
| 23 | `package-python`, 3.11.18 and 3.15.2 | Pass | | `023-package-python.log` |
| 24 | No `soorma-local` project or volume before `core-up` | Pass: 0 and 0 | | `024-e2e-precheck.log` |
| 25 | `e2e:core-up` (Node 26.13.0) | Pass, 41 s | | `025-e2e-core-up.log` |
| 26 | `e2e:setup --agents agent-a,agent-b` | Pass | | `026-e2e-setup.log` |
| 27 | `e2e:prove-stack` | Pass: agent-a 200, agent-b 200 | | `027-e2e-prove-stack.log` |
| 28 | The TypeScript scenario | Pass, 60 s | | `028-e2e-scenario-typescript.log` |
| 29 | The Python scenario (3.11.18) | Pass, 60 s: every step held | | `029-e2e-scenario-python.log` |
| 30 | `e2e:core-down` | Pass: 16 logs searched clean; the stack, its volumes and `.e2e/` removed | | `030-e2e-core-down.log` |
| 31–44 | README as fixed, fresh clone at `2a64284`: install; static checks; `pnpm test` (302); build; `pnpm checks`; `pnpm checks --offline`; self-test (four faults as declared); TypeScript conformance (96, 1 not run, 120 s); audits; `uv sync --locked`; ruff; mypy (49 files) and pytest (395); `scripts/audit.sh`; Python conformance (96, 1 not run, 87 s) | Pass, all 14 | | `031-` to `044-…log` |
| 45 | OBL-03's fix (`ae6dba9`, DCO on `pull_request_target`): the Node gate (typecheck, lint, format, build, `pnpm checks`, Vitest 310, audits) | Pass | | Terminal; recorded in `audit.md` (*OBL-03: the fix cannot run as specified*) |
| 46 | The new DCO job simulated locally: a clone at `main`'s tip `73d88c3`, `dev`'s head `d68520a` fetched as data, the base's `tools/dco` over the range | Pass: 6 commits judged, 5 signed off, 1 Dependabot commit exempt as verified | | Terminal; `audit.md`, the same entry |
| 47 | The new DCO workflow on a pull request into `dev`: #25, a draft with one empty signed-off commit | **Fail**: no DCO run occurred | **Since 2025-12-08 GitHub takes a `pull_request_target` workflow from the default branch** (`main`, whose `dco.yml` triggered on `pull_request` only), whatever the pull request's base; under `pull_request` the pull request's own `dco.yml` (`pull_request_target` only) did not trigger. With the fix on `dev`, no pull request into `dev` got a DCO run, and the closing pull request into `main` could never get the required `Check sign-off`. Not rerun: `ae6dba9` reverted whole (`23759e0`); OBL-03 closed as an accepted risk (the user). #25 closed unmerged, its branch deleted | GitHub, soorma-ai/soorma-sdk#25; `audit.md` |
| 48 | After the revert (`23759e0`): the full gate (Node: typecheck, lint, format, build, `pnpm checks` all ok, Vitest 302, audits; Python: ruff, mypy 49 files, pytest 395); `dco.yml`, `tools/workflows/check.ts` and `check.test.ts` diff-empty against `73d88c3`; `dev`'s CI on the revert, run 44678425492 | Pass | | Terminal; `audit.md`; CI 44678425492 |

**48 runs, 4 failed, each with its established cause**: two README defects (runs 4, 5, 12; each
failed step passed when the README, fixed, was followed again in a new clone), and OBL-03's
`pull_request_target` fix, which GitHub's default-branch rule makes unable to run (run 47;
reverted, not rerun).

**CI evidence** for what a laptop cannot run (CC-SEC-05 needs a second user; the API floors), on
soorma-ai/soorma-sdk#23's pull-request run **44670863814** (head `fb3ae20`; final head
`0a9cd90` also green: CI 44671323748, DCO 44671323729): every conformance entry 97 passed, 0
failed, 0 not run (TypeScript: Node 24.22.3 with API 1.9.0, 123 s, and 1.10.0, 108 s; Node
26.13.0, 106 s. Python: 3.11.18 and 3.15.2 with `otel-latest`, 77 s and 79 s; 3.11.18 with
`otel-floor`, 79 s); the self-test (26 s reference run, job 153 s); `e2e-typescript` 175 s;
`e2e-python` 161 s; `package-typescript`, `package-python`, dependency review and the DCO check.

## README

- **Followed from a fresh clone at**: `755ccf7` (runs 1 to 12), then, fixed, at `2a64284` (runs
  31 to 44).
- **Result**: Fail at `755ccf7` (runs 4, 5, 12); **Pass** at `2a64284`, all 14 steps.
- **README updated**: Yes (`2a64284`). It now builds `@soorma/sdk` before `pnpm checks`; runs
  local conformance with `--local-skip CC-SEC-05` and says why; names uv 0.13.8 as a
  prerequisite (the checks run the Python driver); adds the TypeScript conformance run.
- **Links this stage's instructions**: Yes, to this summary.
- **Noted**: in a fresh clone, `pnpm checks` runs the Python driver through `uv run`, which
  creates `python/.venv` (uv chose Python 3.15.2, the newest installed); the README's
  `uv sync --locked` then had nothing to do.

## Test Execution Summary

### Unit Tests
- **Total**: 302 (Vitest) + 395 (pytest, on each of 3.11.18 and 3.15.2)
- **Passed**: all; **Failed**: 0
- **Coverage**: not measured as a percentage; the specification is covered by the conformance
  suite (every statement linked to a case), and the unit tests cover what cases cannot reach
- **Status**: **Pass**

### Integration Tests
- **Scenarios**: 6 (`integration-test-instructions.md`): each SDK through U1's suite; the names
  check over both drivers; U2's stack proof; both scenarios on the stack; each package installed
  fresh
- **Passed**: 6; **Failed**: 0
- **Status**: **Pass**

### Performance Tests
- **Conformance, per driver per runtime**: 85–121 s locally, 77–123 s in CI (budget 5 minutes)
- **Self-test**: 149 s locally, 153 s in CI (budget 8 minutes)
- **End-to-end jobs**: `e2e-typescript` 175 s, `e2e-python` 161 s (AD-13: 8 minutes)
- **Bounds** (`L_event`, `B_body`, the parser's limits): CC-RCV-09, CC-RCV-10 through both
  drivers, and the unit tests
- **Status**: **Pass**

### L1 Domain Conformance
- **Total applicable L1 rows**: 80 (U1 25, U2 5, U3 25, U4 25)
- **Passed**: 80; **Failed**: 0; **Unverified**: 0
- **Status**: **Pass** (`l1-conformance-test-instructions.md`)

### Platform Invariants
- **Applicable rows**: 37 (U1 10, U2 9, U3 9, U4 9), all Pass; I8 checked as a set across the
  four units: Pass; I11 N/A by design in every unit
- **Status**: **Pass** (`invariant-conformance-test-instructions.md`)

### Open Obligations (from `aidlc-state.md`)
- **Deferred questions targeting this initiative, still open**: **0** (US-Q1 discharged at U1's
  Functional Design)
- **Deferred questions targeting other initiatives**: 0
- **PRD specification gaps, Open**: **1**, worked around, recorded as built:
  - GAP-CAC-001 (soorma-ai/soorma-core#34, the contract's question, not a PRD's): whether a
    renewal leaves the previous token valid. **Built fail-closed**: `credential_refused` on a
    retried renewal is terminal in both SDKs (REN-05). *Since resolved, contract amended, at
    `contract-v0.1.0+core.2`: see *After completion* below.*
- **PRD specification gaps, Awaiting PRD**: **2**:
  - GAP-INT-001, Awaiting the **Event** PRD (soorma-prd#13): delivery guarantees. **Worked
    around**: delivery is live only, as `contract-v0.1.0` provides; both READMEs say so, with
    the duplicate-around-a-boundary warning (CC-SPN-08 checks the text).
  - GAP-INT-002, Awaiting the **Observability** PRD (soorma-prd#37): span semantics.
    **Worked around**: the OpenTelemetry API only, no exporter; the span shape documented as
    unstable, with DEC-U1-01's deviation; proved by a test-installed exporter.
- **Other open obligations**:
  - **OBL-03, closed as an accepted risk** (the user's decision, 2026-11-20T05:01:44Z). The DCO
    check stays on `pull_request`, so a fork pull request can edit `dco.yml` or `tools/dco/` to
    pass its own check. The fix on `pull_request_target` (`ae6dba9`) was reverted whole
    (`23759e0`): since 2025-12-08 GitHub always takes a `pull_request_target` workflow from the
    default branch, and it blocks the event by default in public repositories from 2026-12-02
    unless an Actions event policy allows it (run 47; #25 closed unmerged). Mitigation: the user
    merges every pull request; GitHub asks for approval before running a first-time
    contributor's workflows; a maintainer checks whether a fork pull request touches `.github/`
    or `tools/dco/` before trusting its DCO result (`CONTRIBUTING.md`). Revisit when outside
    contributors start sending pull requests, or when GitHub offers a way to judge a pull
    request without `pull_request_target`. `main` is protected (ruleset 27701690, active since
    2026-11-20T04:50:36Z): `Check sign-off` is a required check with no bypass, so the job keeps
    that exact name.
  - **OBL-05, open**: soorma-core's local stack certificates lack key identifiers
    (soorma-ai/soorma-core#36); Python 3.13+ refuses them, so `e2e-python` and the Python example
    run on 3.11 or 3.12. It closes with a contract tag carrying the fix. *Since discharged at
    `contract-v0.1.0+core.2`: see *After completion* below.*
  - OBL-01, OBL-02 and OBL-04 (both languages) are discharged; OBL-03 is closed as an accepted
    risk. **One obligation stays open: OBL-05.**
- **Carried security obligations** (`local-only`): 6, owed by the first hosted deployment or the
  first published release: SECURITY-01 (encryption at rest), SECURITY-02 (load balancer and
  gateway logs), SECURITY-03 (centralized logs), SECURITY-07 (private subnets and endpoints),
  SECURITY-10 (an SBOM, likely the first to apply here, at the first published release),
  SECURITY-14 (alerting, log integrity and retention). Not blocking.
- **Status**: **Pass** for the stage's rule (0 deferred questions open; the one open gap and the
  two awaiting a PRD each record what was built). OBL-05 is owed, and reported here.

### Slice Brief: This Repository's *Proves* Items

The brief, `soorma-prd/backlog/m1-walking-skeleton.md` @ `0aad84a`, assigns soorma-sdk *done
when* 2, 3 and 5, "through the SDK, against a running soorma-core".

| *Done when* item | Proved by | Result | Evidence |
|---|---|---|---|
| 2 — Each agent instance bootstraps and receives a short-lived credential | Both scenarios' steps 2 and 3: two agents, each its own instance and secret file, bootstrap; B renews once from the real S3 no sooner than `R_min` | Pass | Runs 28, 29; CI `e2e-typescript` and `e2e-python` on 44670863814 |
| 3 — Agent A publishes an event; agent B, subscribed in the same environment, receives it | Steps 5 to 7: B subscribes first (live only), A publishes, B's Delivery holds A's payload, an envelope and a seal | Pass | Runs 28, 29; the same CI jobs; the Python example by hand (U4 plan Step 40), the TypeScript example (U3 plan Step 41) |
| 5 — A trace context travels on the envelope and a trace is emitted | Steps 7 and 8: B's envelope carries A's draft's `traceparent`; B's receive span has A's send span as parent, a decoy neither parent nor linked | Pass | Runs 28, 29; the same CI jobs |

AI-DLC never edits the brief. These three pass in both languages; the brief moves to `Done` once
soorma-core's session has reported its items too (soorma-core's M1 Build and Test, merged in
soorma-core#28).

### Additional Tests
- **Contract tests**: Pass (`contract-test-instructions.md`: drift, generated types, the
  conformance suite through both drivers, the self-test, the names check)
- **Security tests**: Pass (`security-test-instructions.md`: audits clean; the secret, credential
  and TLS cases; hostile input; `core-down`'s log search clean)
- **E2E tests**: Pass (`e2e-test-instructions.md`)

## Overall Status
- **Build**: Success
- **All tests**: Pass
- **Ready for Operations**: Yes. Nothing is deployed or published in M1; OBL-05 stays owed,
  and OBL-03 is an accepted risk (above).

## Next Steps

Operations is a placeholder in AI-DLC. For this repository, the next steps are the owed items:
OBL-05 (with soorma-core's next contract tag), soorma-core#34 (GAP-CAC-001), the PRD gaps as
their PRDs land, and OBL-03's revisit conditions. Dependabot #24
(`@opentelemetry/context-async-hooks` 3.1.1) was merged into `dev` as `d68520a`, all 16 checks
green; my earlier note that it repeated a "split" was wrong (`aidlc-state.md`, *Dependency
Updates*).

## After completion: contract-v0.1.0+core.2

Recorded by `aidlc-docs/harness/contract-core2/` (soorma-ai/soorma-sdk#27; PR soorma-ai/soorma-sdk#28).
The figures above stand as they were at the gate; this section reports what changed.

- **Pin**: `contract/` re-vendored at soorma-core `contract-v0.1.0+core.2` (`0405e2a96a9389cab45e67312de903fd42f5d01e`,
  `contract/` tree `8d375fd66899184b4d7871e188d02268a992325e`): the same wire contract 0.1.0, at soorma-core
  revision 2. The drift check passes with its remote half
- **GAP-CAC-001: Resolved — contract amended** (not in the gap rule's set, which names only PRDs;
  the user's choice, contract-core2 CC2-Q1). Resolved by `contract-v0.1.0+core.2`,
  `conventions/credentials.md`, *Revocation and Lifetimes*: a token issued before a renewal stays
  valid until its own `expiresAt` unless the credential or its agent is revoked, and renewing with
  it is accepted. No code path changed: `credential_refused` on a retried renewal stays terminal,
  as a real refusal. New proof: each keeper retries a renewal lost after sending with the earlier
  token and adopts the result (unit tests, TypeScript and Python); on the real stack,
  `typescript/e2e/renewal-rule.test.ts` passes in `e2e-typescript` (renew, then renew again with
  the first token: `200`, a later `expiresAt`)
- **OBL-05: discharged**. `e2e-python` runs on 3.11.18 and 3.15.2; both green on #28's run
  44844441207 and the push run 44843922365
- **Counts now**: PRD specification gaps Open **0**; Awaiting PRD **2** (GAP-INT-001, GAP-INT-002,
  unchanged); other open obligations **0** (OBL-03 stays an accepted risk); unit tests 303
  (TypeScript) and 396 per Python runtime
