# Test Specifications — e2e-stack

Inception pass, scope **comprehensive** (`aidlc-state.md`, *Extension Configuration*). Sources: `inception/application-design/unit-of-work.md` and `inception/requirements/requirements.md` only. Unit abbreviation: ES = e2e-stack. Scope tags: happy-path, negative, edge/boundary.

**Construction enrichment** (U2): enriched in place from `construction/e2e-stack/functional-design/` and `construction/e2e-stack/nfr-requirements/` (NFR Design skipped; no infrastructure design). TC-ES-001 to 012 modified; TC-ES-013 to 023 added. Rule ids (GEN, CU, ST, PS, CD, LS, JOB) are in `business-rules.md`; NFR ids in `nfr-requirements.md`. **Where each runs** (NFR-U2-19): in the `e2e` job on a real stack: TC-ES-001, 004 to 008; in `unit` (Vitest, no stack): TC-ES-002, 003, 013 to 023, and TC-ES-008's workflow-condition check; on CI's own events: TC-ES-009 to 011; locally: TC-ES-012.

---

### TC-ES-001 — core-up brings up soorma-core at the tag

**Context**: Every end-to-end proof runs on soorma-core exactly as tagged. Covers FR-19. Rules CU-01 to CU-13; NFR-U2-06, -14 to -16.

**Preconditions**:
- Docker Engine 26 and Compose 2.26 or later; `git`; a Node 26.13.0 executable
- No `soorma-local` Compose project or volumes present; no `.e2e/owner.json`
- Loopback ports 8441 to 8447 free

**Scenario**: the `e2e` job (or a tester locally) brings up a fresh stack.

**Steps**:
1. Run `pnpm e2e:core-up --core-node <path to Node 26.13.0>`.
2. Inspect `.e2e/` and the clone.

**Expected outcome**: Before anything is created it checks the prerequisites (CU-11), then writes `.e2e/owner.json` (`0600`). It clones `contract.pin.json`'s repository at `contract-v0.1.0` into `.e2e/soorma-core/`, confirms `HEAD` is `c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d` (CU-05), confirms the clone's `pnpm-workspace.yaml` has `strictDepBuilds: true` and `allowBuilds: {}` (CU-12) and that `--core-node`'s version and pnpm match the clone's `.node-version` and `packageManager` (CU-13), installs, builds the four images, runs `stack:init` and `stack:up`, and exits `0`. S1 on 8441, E's S2 on 8442, S3 on 8444 and S4 on 8446 answer over TLS with the clone's CA. It writes `.e2e/fresh-stack` last. Each child step stays within its time limit (TS-U2-11).

**Scope**: happy-path · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-002 — core-up fails when the checkout is not the pinned commit

**Context**: A moved tag must stop the run, not quietly test something else. Covers FR-19. Rule CU-05; NFR-U2-14. `core-up` takes the expected commit only from `contract.pin.json` and has no override, so the test changes what `git` reports, not what `core-up` expects.

**Preconditions**:
- Vitest in `unit`, with a fake `git` first on `PATH` whose `rev-parse HEAD` answers a commit other than the pin's; a fake `docker` reporting no `soorma-local` project

**Scenario**: `core-up` runs against a clone whose commit is not the pinned one.

**Steps**:
1. Run `core-up` under the fakes.
2. Read its output and exit status; list the fake `docker`'s recorded calls.

**Expected outcome**: It exits non-zero before installing or building anything, naming the expected commit (from `contract.pin.json`) and the actual one. No `docker build`, `stack:init` or `stack:up` was called. The ownership record stays, so `core-down` removes the clone (CU-10). No fresh-stack marker.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-003 — core-up refuses an existing soorma-local stack

**Context**: A developer's own stack must never be torn down or reused by the end-to-end run. Covers FR-19. Rules CU-01, CU-02.

**Preconditions**:
- Vitest in `unit`, with a fake `docker` first on `PATH`. Three runs: (a) `docker compose ls --all` lists `soorma-local`; (b) only a volume labelled `com.docker.compose.project=soorma-local` exists; (c) `.e2e/owner.json` exists from an earlier run

**Scenario**: `core-up` finds a stack, or an earlier run, it must not touch.

**Steps**:
1. Run `core-up` in each of (a), (b), (c).
2. Read its output and exit status; list `.e2e/` and the fake `docker`'s recorded calls.

**Expected outcome**: Each run refuses with a non-zero exit, naming what it found (the project, the volume, or the earlier run with "run core-down"). In (a) and (b) **no ownership record is written**, nothing is cloned, and no `docker` command other than the read-only listings ran. In (c) the existing record is left as it was.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-004 — setup registers agents A and B and writes owner-only secret files

**Context**: The SDK receives only what a tenant's code would: an agent identifier and a secret source. Covers FR-19. Rules ST-01 to ST-11; E-07.

**Preconditions**:
- A stack just brought up by `core-up` (the marker present)
- No `.e2e/secrets/`

**Scenario**: the `e2e` job does the human set-up.

**Steps**:
1. Run `pnpm e2e:setup --agents agent-a,agent-b`.
2. List `.e2e/secrets/` and `.e2e/stack.json` with permissions; read `.e2e/stack.json`.

**Expected outcome**: The marker is gone. `setup` made, in order: `firstAuthenticate` (`200`, with a sign-in), `issueEnvironmentCredential` at E's S2 presenting that sign-in (`200`), `grantToHuman` of `agent:register`, `event:publish`, `event:subscribe` to itself (`200`), then per agent `registerAgent` with standing permissions `event:publish`, `event:subscribe` and `autonomyDeclared: true` (`200`) and `issueRegistrationSecret` (`200`), then the ends and refusal checks of TC-ES-006. `.e2e/secrets/` is mode `0700`; `agent-a.secret` and `agent-b.secret` are mode `0600`, each holding only its secret. `.e2e/stack.json` (`0600`) holds exactly the environment `{o1, p1, e}`, S3 `https://localhost:8444`, S4 `https://localhost:8446`, the CA path, and each agent with its secret file's **path**; no secret value. The output lists the same values and no secret.

**Scope**: happy-path · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-005 — setup refuses without a fresh stack

**Context**: The first authentication from the handover file works once; a second set-up on the same stack must not be attempted. Covers FR-19. Rule ST-03 (the marker is consumed before the first call, U2-FD-Q1).

**Preconditions**:
- A stack on which `setup` has already run once (the marker consumed)

**Scenario**: `setup` is run a second time on the same stack.

**Steps**:
1. Run `pnpm e2e:setup --agents agent-c` (an agent not yet registered).

**Expected outcome**: It refuses before any call, stating that there is no fresh stack and to run `core-down`, then `core-up`. Nothing is written: no `agent-c.secret`, no change to `.e2e/stack.json`.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-006 — setup writes and prints no human secret or credential

**Context**: The SDK never holds a human credential; the set-up that does must leave none behind, written or live. Covers FR-19, FR-16. Rules GEN-02, ST-05, ST-06, ST-09; NFR-U2-08, -12. Enriched with the user's requirement (2026-11-18T19:20:00Z): no sign-in or environment credential `setup` opened is left live, shown by refusal.

**Preconditions**:
- A fresh stack, in the `e2e` job

**Scenario**: `setup` runs to success; its output, its files and the credentials it opened are examined.

**Steps**:
1. Run `pnpm e2e:setup --agents agent-a,agent-b`, capturing its output.
2. Search the output, `.e2e/` and the working tree for every typed prefix the contract names other than `soorma_rs_` (the registration secrets, expected only in their own files).
3. Read `setup`'s record of its own calls 6 to 9.

**Expected outcome**: No `soorma_si_`, `soorma_ec_` or `soorma_em_` value appears in the output, in any file, or anywhere in the working tree; `soorma_rs_` appears only inside the two secret files; K appears nowhere (it was used once, as `firstAuthenticate`'s `newSecret`). `setup` made **no `authenticate` call**. The environment credential was ended (`204`) and, presented again, **refused** (`401`); then the sign-in was ended (`204`) and, presented again, **refused** (`401`). The refusals are the check: on the real stack, after success, neither is live.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19, FR-16

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-007 — A raw bootstrap per agent succeeds with the written secret

**Context**: U2 proves the stack before U3 uses it: each secret file must bootstrap its agent. Covers FR-19, FR-04. Rules PS-01 to PS-06 (`prove-stack`, U2-FD-Q6).

**Preconditions**:
- `setup` has written `.e2e/stack.json` and the secret files

**Scenario**: the `e2e` job runs the stack proof.

**Steps**:
1. Run `pnpm e2e:prove-stack`.
2. Read its output and exit status.
3. Re-read each secret file.

**Expected outcome**: For each agent, one `POST https://localhost:8444/agent-credentials` with `{ agent, secret, instance: "e2e-proof" }`, `Soorma-Contract-Version: 0.1.0`, trusting only the clone's CA, answers **`200`**, and the body validates against the contract's `exchangeBootstrap` `200` schema. The output is one line per agent (agent, status, pass) and holds no secret and no credential; exit `0`. The secret files are unchanged and still usable: the bootstrap needs only an active secret and consumes nothing (PS-04), and a success leaves no attempt behind in soorma-core's bound (PS-05), as U3's scenario will show by bootstrapping after the proof.

**Scope**: happy-path · **Priority**: High

**Source**: e2e-stack / FR-19, FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-008 — core-down removes the stack and its volumes, also after a failure

**Context**: Every run starts fresh only if every run ends clean. Covers FR-19. Rules CD-01 to CD-07, JOB-03; NFR-U2-04. Enriched with the workflow condition (the user, 2026-11-18T20:54:18Z): a job stopped by its timeout or cancelled is reported as cancelled, not failed, and must still get its logs.

**Preconditions**:
- (a) In the `e2e` job: a stack brought up by `core-up`
- (b) In `unit`: the workflow file

**Scenario**: (a) the teardown after a failed step; (b) the workflow's teardown condition.

**Steps**:
1. (a) Make a step after `core-up` fail on purpose; let the job's teardown run `core-down --logs`.
2. (a) List Compose projects and volumes, and `.e2e/`.
3. (b) Read the `e2e` job's `core-down` step from the workflow.

**Expected outcome**: (a) The logs were searched (TC-ES-013 to 016) and, clean, shown before teardown. The `soorma-local` project and its volumes are gone; `.e2e/stack.json`, the secret files, `.e2e/secrets/`, the marker and `.e2e/soorma-core/` are removed, and `.e2e/owner.json` last. (b) The step has `if: always()` and passes `--logs` exactly when `failure() || cancelled()`.

**Scope**: edge/boundary · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-009 — End-to-end jobs run on pull requests and pushes to dev, not on pushes to main

**Context**: A pull request's run already tests the merge result; a push to main must not repeat it. Covers FR-19. Rules JOB-01, JOB-05; NFR-U2-13.

**Preconditions**:
- The CI workflow

**Scenario**: the workflow's triggers and the `e2e` job's settings are exercised and read.

**Steps**:
1. Open a pull request that changes a file outside `aidlc-docs/`.
2. Push a commit to `dev`.
3. Merge to `main`.
4. Read the `changes` and `e2e` jobs' settings.

**Expected outcome**: The end-to-end job runs on the pull request and on the push to `dev`, and neither `changes` nor `e2e` runs on the push to `main`. Both jobs run on `ubuntu-24.04` with `permissions: contents: read`, reference no repository secret, upload nothing from `.e2e/`, and pin every action by SHA (U1's workflow check passes); `e2e` has `timeout-minutes: 20`.

**Scope**: happy-path · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-010 — aidlc-docs-only changes skip the end-to-end job; anything else runs it

**Context**: The skip must be fail-safe: it applies only when the diff provably touches documentation alone. Covers FR-19. Rule JOB-02; TS-U2-08 (soorma-core #26's pattern: `git diff --name-only --no-renames`).

**Preconditions**:
- The CI workflow's `changes` job

**Scenario**: the `changes` job decides on four kinds of change.

**Steps**:
1. Push a change touching only `aidlc-docs/`.
2. Push a change touching `aidlc-docs/` and one other file.
3. Push a change renaming a file from `aidlc-docs/` to outside it.
4. Push to a new branch, or force-push, so the base is missing or the zero SHA.

**Expected outcome**: The first sets `e2e=false` and the `e2e` job is skipped by its job-level condition; the second, third and fourth set `e2e=true` (a rename counts both its sides; a missing or zero base runs the job) and the `e2e` job runs. The job's log names the changed files or says the diff could not be computed.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-011 — The CI time the stack adds is measured and recorded

**Context**: AD-13's estimate (3 to 5 minutes per job) is checked against a real run. Covers FR-19. Rule JOB-07; NFR-U2-02, -03 (no cache until measured); OBL-02.

**Preconditions**:
- U2's code PR with its CI run

**Scenario**: the job's time on U2's code PR is read and recorded.

**Steps**:
1. Read the `e2e` job's total time and step durations from the code PR's run.
2. Read `aidlc-state.md` (OBL-02).

**Expected outcome**: The measured time and the run ID are recorded under OBL-02. Nothing was cached in that run. If the job took over 8 minutes, the record says NFR Requirements is reopened for U2 before U3 starts.

**Scope**: happy-path · **Priority**: Low

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-012 — The same commands work locally

**Context**: The proof runs in CI and locally by the same steps. Covers FR-19. Rule GEN-01; NFR-U2-22 to -24.

**Preconditions**:
- Linux or macOS with Docker Engine 26+, Compose 2.26.0+, `git`, Node 26.13.0, and no `soorma-local` stack

**Scenario**: a developer runs the whole sequence by hand.

**Steps**:
1. Run `pnpm e2e:core-up --core-node <path>`, `pnpm e2e:setup --agents agent-a,agent-b`, `pnpm e2e:prove-stack`, and `pnpm e2e:core-down`.

**Expected outcome**: Every step behaves as in CI, with the same outputs, and the machine is left without a `soorma-local` project, volumes or `.e2e/` contents. The README lists the prerequisites and the local side effects (the `soorma/*:local` images rebuilt, ports 8441 to 8447, the refusal to touch a stack `core-up` did not start).

**Scope**: happy-path · **Priority**: Medium

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-013 — The log search finds each typed prefix, naming the service and the kind

**Context**: soorma-core's logs are shown in public CI logs only after a search proves they hold no secret or credential. The prefixes are the contract's, so credentials that never touch disk are found too. Covers FR-19, FR-16. Rules LS-01, LS-03, LS-06, LS-08, LS-09; U2-FD-Q7.

**Preconditions**:
- Vitest in `unit`; the vendored `contract/conventions/credentials.md`; recorded log text for two services; no stack

**Scenario**: one run per prefix read from the contract, each with that prefix followed by token characters placed in one service's log; and one run with a bare prefix in a sentence.

**Steps**:
1. For each prefix the search reads from the contract (six at the tag), run the search over two service logs, one holding `<prefix>` followed by token characters.
2. Run the search over a log whose only mention is a bare prefix followed by a space.
3. Read the search's output and outcome.

**Expected outcome**: Each step 1 run is a **hit**: no log is printed (not even the clean service's); the output names the service and the kind (the contract's name for the prefix), never the value or the line, says it is a soorma-core logging defect to raise as a soorma-core issue naming the service and `contract-v0.1.0`, and the outcome is a failure. Step 2 is **not** a hit. Every outcome states that the human secret K cannot be searched for, and why.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19, FR-16

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/functional-design/business-rules.md` (LS)

---

### TC-ES-014 — The log search finds the exact enrollment material and an exact agent secret

**Context**: Exact values are searched for beside the prefixes. Covers FR-19, FR-16. Rules LS-04, LS-08; U2-FD-Q7 change 2.

**Preconditions**:
- Vitest in `unit`; a temporary handover directory with an `enrollmentMaterial:` line; a stack description listing one agent secret file; recorded log text

**Scenario**: two runs, one with the exact enrollment material in a log, one with an exact agent secret.

**Steps**:
1. Run the search with the enrollment material's exact value in one service's log.
2. Run the search with an agent secret's exact value in one service's log.

**Expected outcome**: Each is a hit, kind "enrollment material (exact value)" or "agent secret (exact value)", with the service named, no value printed, no log printed, and a failure outcome.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19, FR-16

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/functional-design/business-rules.md` (LS)

---

### TC-ES-015 — A clean log is printed; nothing is searched without --logs

**Context**: The search must not hide useful logs when there is nothing to hide, and runs only when logs are to be shown. Covers FR-19. Rules LS-07, LS-11.

**Preconditions**:
- Vitest in `unit`; recorded log text holding no prefix and no exact value

**Scenario**: `core-down --logs` over clean logs; then `core-down` without `--logs`.

**Steps**:
1. Run the search over the clean logs.
2. Run `core-down` without `--logs` (fake `docker`).

**Expected outcome**: Step 1 prints every service's log, service by service, and its outcome is clean. Step 2 reads no log and prints none.

**Scope**: happy-path · **Priority**: Medium

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/functional-design/business-rules.md` (LS)

---

### TC-ES-016 — An unreadable log: nothing printed, fail closed, still torn down

**Context**: A log the search cannot read may hold anything, so it is never printed. Covers FR-19. Rules LS-10, CD-05, CD-06, GEN-07.

**Preconditions**:
- Vitest in `unit`, with a fake `docker`: in turn, `compose logs` for one service exits non-zero; never exits (its 1-minute limit runs out, shortened in the test); an agent secret file listed in the stack description is unreadable; the handover directory is unreadable

**Scenario**: `core-down --logs` meets each unreadable source.

**Steps**:
1. Run `core-down --logs` in each case.
2. Read its output, exit status, and the fake `docker`'s recorded calls.

**Expected outcome**: In every case no log is printed; the output names what could not be read; `down -v` was still called and the files removed; the exit status is non-zero.

**Scope**: edge/boundary · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/functional-design/business-rules.md` (LS, CD)

---

### TC-ES-017 — The prefixes come from the vendored contract; none readable fails closed

**Context**: The search's patterns are the contract's, never a copy in code. Covers FR-19. Rules LS-01, LS-02; TS-U2-05.

**Preconditions**:
- Vitest in `unit`; the vendored `credentials.md`; a temporary file with no `soorma_…_` prefix

**Scenario**: the prefix reader over the real file and over a file without prefixes.

**Steps**:
1. Read the prefixes from the vendored `credentials.md`.
2. Run the search with a credentials file that names no prefix.

**Expected outcome**: Step 1 yields `soorma_ac_`, `soorma_ec_`, `soorma_si_`, `soorma_dc_`, `soorma_rs_`, `soorma_em_`, each with the contract's kind name. Step 2 fails closed: no log printed, a failure outcome naming the cause.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/functional-design/business-rules.md` (LS); `contract/conventions/credentials.md`

---

### TC-ES-018 — core-down without an ownership record removes nothing and exits 0

**Context**: `core-down` must never remove a stack `core-up` did not start, and must stay clean after a `core-up` that failed before creating anything. Covers FR-19. Rule CD-01.

**Preconditions**:
- Vitest in `unit`, with a fake `docker` reporting a running `soorma-local` project; no `.e2e/owner.json`

**Scenario**: `core-down` with and without `--logs`, no ownership record.

**Steps**:
1. Run `core-down`, then `core-down --logs`.
2. Read the output, exit status and the fake `docker`'s recorded calls.

**Expected outcome**: Each prints that no stack started by `core-up` is recorded and exits `0`. No `down`, `logs` or removal was called; the reported project is untouched.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/functional-design/business-rules.md` (CD)

---

### TC-ES-019 — setup refuses a bad agent identifier or secrets directory before consuming the marker

**Context**: A mistake in the arguments must not cost the one attempt a fresh stack allows. Covers FR-19. Rules ST-01, ST-02.

**Preconditions**:
- Vitest in `unit`; a marker file present; no S1 or S2 reachable (any call would fail the test)

**Scenario**: `setup` with each invalid input.

**Steps**:
1. Run `setup` with: an identifier starting with `-`; one of 65 characters; two equal identifiers; no identifier.
2. Run `setup` with a secrets directory that is: a file; a symbolic link; mode `0755`; owned by another user (simulated by the test's ownership check); holding `agent-a.secret` already.

**Expected outcome**: Each run refuses with a non-zero exit and a line naming the problem, makes no call, and leaves the marker in place. No file is created or changed.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/functional-design/business-rules.md` (ST)

---

### TC-ES-020 — setup stops at the first failed call and leaves nothing it opened live

**Context**: A failed set-up reports exactly where it failed, prints nothing sensitive, and ends what it opened. On the real stack nothing reachable from `setup`'s arguments fails after first authentication without a fault switch inside `setup`, which a tool holding secrets must not have (the user, 2026-11-18T19:25:25Z), so this runs against a local fake. Covers FR-19. Rules ST-06, ST-09, ST-12, GEN-06; NFR-U2-12, -20.

**Preconditions**:
- Vitest in `unit`; a local HTTPS fake of S1 and S2 with a per-test CA, stateful for the contract's end semantics (an ended sign-in or environment credential is refused with `401`), recording every call; `registerAgent` for `agent-b` answers `503` with a Problem
- **The fake validates every response it sends** against the vendored contract's schema for that operation and status (in the fake or in the test), so it cannot drift from the contract

**Scenario**: `setup --agents agent-a,agent-b` against the fake, failing at the second registration.

**Steps**:
1. Run `setup` against the fake.
2. Read its output, exit status, the fake's call record and the fake's live-credential state.
3. Read the fake's response-validation results.

**Expected outcome**: The output's failure line names the step (`registerAgent agent-b`), the status `503`, the Problem's `code` and the `Soorma-Request-Id`, and nothing else: no body, no request body, no secret. Exit is non-zero; nothing is retried. The fake recorded **no `authenticate` call**; after the failure it recorded `endEnvironmentCredential` (`204`), `endEnvironmentCredential` again (`401`), `endSignIn` (`204`), `endSignIn` again (`401`). At the end the fake holds **no live sign-in or environment credential**. `agent-a.secret` exists (`0600`); no `.e2e/stack.json` was written. Every response the fake sent validated against the contract.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/functional-design/business-logic-model.md` §3, §7

---

### TC-ES-021 — core-up refuses missing prerequisites, install scripts, and a mismatched toolchain

**Context**: `core-up` only builds soorma-core with its own toolchain and with dependency install scripts off, and finds a missing prerequisite before creating anything. Covers FR-19. Rules CU-11, CU-12, CU-13; NFR-U2-06, -15, -16.

**Preconditions**:
- Vitest in `unit`, with fake `docker`, `git` and Node executables first on `PATH`, and a fake clone tree

**Scenario**: one run per refusal.

**Steps**:
1. Run `core-up` with: Docker Engine 25; Compose 2.25; no `git`; a `--core-node` path that does not exist.
2. Run `core-up` with a clone whose `pnpm-workspace.yaml` lacks `strictDepBuilds: true`; then one that lacks `allowBuilds: {}`.
3. Run `core-up` with a `--core-node` reporting `v26.12.0`; then with a pnpm whose version differs from the clone's `packageManager`.

**Expected outcome**: Each run refuses with a non-zero exit and a line naming what is wrong. Step 1's runs write **no ownership record** and create nothing. Steps 2 and 3 refuse before `pnpm install` or any `docker build` runs, with the ownership record kept for `core-down`.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/nfr-requirements/nfr-requirements.md` (NFR-U2-06, -15, -16)

---

### TC-ES-022 — A raw call that never answers times out with its step's name, and setup still ends what it opened

**Context**: A hung service must fail its step by name well before the job's timeout, and `setup` must still end its sign-in and environment credential. Covers FR-19. Rules GEN-07, ST-09, ST-12, PS-06; NFR-U2-01, -07; the user (2026-11-18T20:54:18Z).

**Preconditions**:
- Vitest in `unit`; the local HTTPS fake of S1 and S2 (TC-ES-020's, validating its responses against the contract) where `registerAgent` **accepts the connection and never answers**; the 30 s limit shortened by the test
- A fake S3 whose `exchangeBootstrap` accepts the connection and never answers, and a stack description pointing at it

**Scenario**: `setup` meets a call that never answers; `prove-stack` meets the same at S3.

**Steps**:
1. Run `setup --agents agent-a` against the fake.
2. Read its output, exit status and the fake's call record and live-credential state.
3. Run `prove-stack` against the fake S3; read its output and exit status.

**Expected outcome**: `setup` prints one line naming the step and saying it timed out (`setup: registerAgent agent-a timed out after …`), then runs the end-and-refuse sequence: `endEnvironmentCredential` (`204`), again (`401`), `endSignIn` (`204`), again (`401`). It makes no retry, exits non-zero, and the fake holds no live credential. `prove-stack` prints its timed-out line for the agent and exits non-zero, with no retry.

**Scope**: edge/boundary · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/nfr-requirements/tech-stack-decisions.md` (TS-U2-11)

---

### TC-ES-023 — A child step that never ends times out with its step's name

**Context**: A hung build, log read or teardown fails its step by name; a failed teardown keeps the ownership record so it can be repeated. Covers FR-19. Rules GEN-07, CU-10, LS-10, CD-07; TS-U2-11.

**Preconditions**:
- Vitest in `unit`, with a fake `docker` whose `build`, then `compose logs`, then `compose down -v` never exits, in three runs; limits shortened by the test

**Scenario**: `core-up` with a hung `docker build`; `core-down --logs` with a hung log read; `core-down` with a hung `down -v`.

**Steps**:
1. Run each, reading output, exit status, `.e2e/` and the fake `docker`'s recorded signals.

**Expected outcome**: `core-up` prints `core-up: docker build <image> timed out after …`, exits non-zero, keeps the ownership record, and writes no marker; the hung child was sent `SIGTERM`, then `SIGKILL`. `core-down --logs` treats the hung log read as unreadable: no log printed, the cause named, `down -v` still called, non-zero exit. A hung `down -v` is named as timed out; the ownership record and the clone are kept (CD-07), and a later `core-up` refuses until `core-down` succeeds.

**Scope**: edge/boundary · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/code/`

**Technical references**: `construction/e2e-stack/nfr-requirements/tech-stack-decisions.md` (TS-U2-11); `construction/e2e-stack/functional-design/business-rules.md` (CD-07)
