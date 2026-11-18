# Test Specifications — e2e-stack

Inception pass, scope **comprehensive** (`aidlc-state.md`, *Extension Configuration*). Sources: `inception/application-design/unit-of-work.md` and `inception/requirements/requirements.md` only. Unit abbreviation: ES = e2e-stack. Scope tags: happy-path, negative, edge/boundary.

---

### TC-ES-001 — core-up brings up soorma-core at the tag

**Context**: Every end-to-end proof runs on soorma-core exactly as tagged. Covers FR-19.

**Preconditions**:
- Docker Engine 26 and Compose 2.26 or later
- No `soorma-local` Compose project or volumes present
- Loopback ports 8441 to 8447 free

**Scenario**: a tester, under the preconditions above, exercises “core-up brings up soorma-core at the tag” and observes the outcome below.

**Steps**:
1. Run `e2e/core-up`.

**Expected outcome**: It clones soorma-ai/soorma-core at `contract-v0.1.0` into `.e2e/soorma-core/`, confirms the commit is `c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d`, builds the S1 to S4 images, runs `stack:init` and `stack:up`, and exits successfully with S1 on 8441, E's S2 on 8442, S3 on 8444 and S4 on 8446 answering over TLS with the stack's CA. It leaves the single-use fresh-stack marker.

**Scope**: happy-path · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-002 — core-up fails when the checkout is not the pinned commit

**Context**: A moved tag must stop the run, not quietly test something else. Covers FR-19.

**Preconditions**:
- A way to point `core-up` at a different commit (for example a test override of the expected commit)

**Scenario**: a tester, under the preconditions above, exercises “core-up fails when the checkout is not the pinned commit” and observes the outcome below.

**Steps**:
1. Run `e2e/core-up` with the expected commit set to a value that does not match the tag.

**Expected outcome**: It fails before building anything, naming the expected and the actual commit.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-003 — core-up refuses an existing soorma-local stack

**Context**: A developer's own stack must never be torn down or reused by the end-to-end run. Covers FR-19.

**Preconditions**:
- A `soorma-local` Compose project already running (or its volumes present)

**Scenario**: a tester, under the preconditions above, exercises “core-up refuses an existing soorma-local stack” and observes the outcome below.

**Steps**:
1. Run `e2e/core-up`.

**Expected outcome**: It refuses, naming the existing project, and changes nothing: the running stack and its volumes are untouched.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-004 — setup registers agents A and B and writes owner-only secret files

**Context**: The SDK receives only what a tenant's code would: an agent identifier and a secret source. Covers FR-19.

**Preconditions**:
- A stack just brought up by `e2e/core-up`
- An empty secrets directory path

**Scenario**: a tester, under the preconditions above, exercises “setup registers agents A and B and writes owner-only secret files” and observes the outcome below.

**Steps**:
1. Run `e2e/setup --agents a,b --secrets-dir <dir>`.
2. List `<dir>` with permissions.

**Expected outcome**: It completes the human steps by raw HTTPS calls, registers A and B in environment `e` with `event:publish` and `event:subscribe` and autonomy declared, and writes `<dir>/a.secret` and `<dir>/b.secret` with mode 0600 in a directory of mode 0700. It prints the agent identifiers and the S3, S4 and CA locations, and no secret.

**Scope**: happy-path · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-005 — setup refuses without a fresh stack

**Context**: The first authentication from the handover file works once; a second set-up on the same stack must not be attempted. Covers FR-19.

**Preconditions**:
- A stack on which `e2e/setup` has already run once

**Scenario**: a tester, under the preconditions above, exercises “setup refuses without a fresh stack” and observes the outcome below.

**Steps**:
1. Run `e2e/setup` again.

**Expected outcome**: It refuses before any call, stating that the fresh-stack marker is absent, and writes nothing.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-006 — setup writes and prints no human secret or credential

**Context**: The SDK never holds a human credential; the set-up that does must leave none behind. Covers FR-19, FR-16.

**Preconditions**:
- A fresh stack

**Scenario**: a tester, under the preconditions above, exercises “setup writes and prints no human secret or credential” and observes the outcome below.

**Steps**:
1. Run `e2e/setup` capturing its output.
2. Search the output, the secrets directory, and the working tree for the human secret, the sign-in token and the environment credential.

**Expected outcome**: None is found anywhere. Only the two agent secret files were written.

**Scope**: negative · **Priority**: High

**Source**: e2e-stack / FR-19, FR-16

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-007 — A raw bootstrap per agent succeeds with the written secret

**Context**: U2 proves the stack before U3 uses it: each secret file must bootstrap its agent. Covers FR-19, FR-04.

**Preconditions**:
- `e2e/setup` has written the secret files

**Scenario**: a tester, under the preconditions above, exercises “A raw bootstrap per agent succeeds with the written secret” and observes the outcome below.

**Steps**:
1. For each agent, send a raw `POST https://localhost:8444/agent-credentials` with `{ agent, secret, instance }`, the secret read from its file, and `Soorma-Contract-Version: 0.1.0`, trusting the stack's CA.
2. Record each status.

**Expected outcome**: Each answers `200`, the contract's success response, with an agent credential naming the agent and environment `e`. The job's output shows the statuses and no secret or credential.

**Scope**: happy-path · **Priority**: High

**Source**: e2e-stack / FR-19, FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-008 — core-down removes the stack and its volumes, also after a failure

**Context**: Every run starts fresh only if every run ends clean. Covers FR-19.

**Preconditions**:
- A stack brought up by `e2e/core-up`

**Scenario**: a tester, under the preconditions above, exercises “core-down removes the stack and its volumes, also after a failure” and observes the outcome below.

**Steps**:
1. Make a later step fail on purpose.
2. Let the job's teardown run `e2e/core-down`.
3. List Compose projects and volumes.

**Expected outcome**: The `soorma-local` project and its volumes are gone and `.e2e/soorma-core/` is removed; the stack's logs were shown before teardown.

**Scope**: edge/boundary · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-009 — End-to-end jobs run on pull requests and pushes to dev, not on pushes to main

**Context**: A pull request's run already tests the merge result; a push to main must not repeat it. Covers FR-19.

**Preconditions**:
- The CI workflow

**Scenario**: a tester, under the preconditions above, exercises “End-to-end jobs run on pull requests and pushes to dev, not on pushes to main” and observes the outcome below.

**Steps**:
1. Open a pull request that changes a file outside `aidlc-docs/`.
2. Push a commit to `dev`.
3. Merge to `main`.

**Expected outcome**: The end-to-end job runs on the pull request and on the push to `dev`, and does not run on the push to `main`.

**Scope**: happy-path · **Priority**: High

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-010 — aidlc-docs-only changes skip the end-to-end job; anything else runs it

**Context**: The skip must be fail-safe: it applies only when the diff provably touches documentation alone. Covers FR-19.

**Preconditions**:
- The CI workflow's `changes` job

**Scenario**: a tester, under the preconditions above, exercises “aidlc-docs-only changes skip the end-to-end job; anything else runs it” and observes the outcome below.

**Steps**:
1. Push a change touching only `aidlc-docs/`.
2. Push a change touching `aidlc-docs/` and one other file.
3. Push to a new branch with no computable base (or force-push with a missing base).

**Expected outcome**: The first skips the end-to-end job by its job-level condition; the second and third run it.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-011 — The CI time the stack adds is measured and recorded

**Context**: AD-13's estimate (3 to 5 minutes per job) is checked against a real run. Covers FR-19.

**Preconditions**:
- U2's code PR with its CI run

**Scenario**: a tester, under the preconditions above, exercises “The CI time the stack adds is measured and recorded” and observes the outcome below.

**Steps**:
1. Read the end-to-end job's step durations.
2. Read the initiative's record of the measurement.

**Expected outcome**: The measured time and the run ID are recorded in the initiative; if over 8 minutes, the record says NFR Design revisits it.

**Scope**: happy-path · **Priority**: Low

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`

---

### TC-ES-012 — The same commands work locally

**Context**: The proof runs in CI and locally by the same steps. Covers FR-19.

**Preconditions**:
- A developer machine meeting the Docker prerequisites, with no `soorma-local` stack

**Scenario**: a tester, under the preconditions above, exercises “The same commands work locally” and observes the outcome below.

**Steps**:
1. Run `e2e/core-up`, `e2e/setup`, the raw bootstrap of TC-ES-007, and `e2e/core-down`.

**Expected outcome**: Every step behaves as in CI, with the same outputs.

**Scope**: happy-path · **Priority**: Medium

**Source**: e2e-stack / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/e2e-stack/functional-design/`
