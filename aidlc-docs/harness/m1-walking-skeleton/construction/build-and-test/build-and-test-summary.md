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

**44 runs, 3 failed, each with its established cause** (two README defects); each failed step
passed when the README, fixed, was followed again in a new clone.

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
    retried renewal is terminal in both SDKs (REN-05).
- **PRD specification gaps, Awaiting PRD**: **2**:
  - GAP-INT-001, Awaiting the **Event** PRD (soorma-prd#13): delivery guarantees. **Worked
    around**: delivery is live only, as `contract-v0.1.0` provides; both READMEs say so, with
    the duplicate-around-a-boundary warning (CC-SPN-08 checks the text).
  - GAP-INT-002, Awaiting the **Observability** PRD (soorma-prd#37): span semantics.
    **Worked around**: the OpenTelemetry API only, no exporter; the span shape documented as
    unstable, with DEC-U1-01's deviation; proved by a test-installed exporter.
- **Other open obligations**:
  - **OBL-03, open**: the DCO check still imports `tools/dco` from the pull request's own
    checkout, so a pull request from a fork could change the code that judges it. Owed "after
    #10 merges, in a later PR"; not yet done.
  - **OBL-05, open**: soorma-core's local stack certificates lack key identifiers
    (soorma-ai/soorma-core#36); Python 3.13+ refuses them, so `e2e-python` and the Python example
    run on 3.11 or 3.12. It closes with a contract tag carrying the fix.
  - OBL-01, OBL-02 and OBL-04 (both languages) are discharged.
- **Carried security obligations** (`local-only`): 6, owed by the first hosted deployment or the
  first published release: SECURITY-01 (encryption at rest), SECURITY-02 (load balancer and
  gateway logs), SECURITY-03 (centralized logs), SECURITY-07 (private subnets and endpoints),
  SECURITY-10 (an SBOM, likely the first to apply here, at the first published release),
  SECURITY-14 (alerting, log integrity and retention). Not blocking.
- **Status**: **Pass** for the stage's rule (0 deferred questions open; the one open gap and the
  two awaiting a PRD each record what was built). OBL-03 and OBL-05 are owed, and reported here.

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
- **Ready for Operations**: Yes. Nothing is deployed or published in M1; OBL-03 and OBL-05 stay
  owed (above).

## Next Steps

Operations is a placeholder in AI-DLC. For this repository, the next steps are the owed items:
OBL-03 (the DCO check reading the base branch's code), OBL-05 (with soorma-core's next contract
tag), soorma-core#34 (GAP-CAC-001), and the PRD gaps as their PRDs land. Dependabot #24 is held
(`aidlc-state.md`, *Dependency Updates*).
