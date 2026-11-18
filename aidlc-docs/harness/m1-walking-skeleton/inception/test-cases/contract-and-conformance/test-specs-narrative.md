# Test Specifications — contract-and-conformance

Inception pass, scope **comprehensive** (`aidlc-state.md`, *Extension Configuration*). Sources: `inception/application-design/unit-of-work.md` and `inception/requirements/requirements.md` only. Unit abbreviation: CAC = contract-and-conformance. Scope tags: happy-path, negative, edge/boundary.

---

### TC-CAC-001 — Vendored contract matches the tag

**Context**: The SDK is built against one copy of soorma-core's contract; if it is not exactly the tag, every generated type and case rests on the wrong contract. Covers FR-01.

**Preconditions**:
- The repository at the commit under test
- Network access to soorma-ai/soorma-core

**Scenario**: a tester, under the preconditions above, exercises “Vendored contract matches the tag” and observes the outcome below.

**Steps**:
1. Run the contract drift check without `--offline`.
2. Read `contract/PIN`.

**Expected outcome**: The check passes. The local half finds every file under `contract/` hashing to `PIN` with none missing or extra; the remote half reads the tag's peeled commit with `git ls-remote` and, from a `--depth 1` fetch of that commit, the tree id of `contract/`, and both equal `PIN` (`c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d` and the recorded tree). No token is used and no REST API is called.

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / FR-01

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `construction/contract-and-conformance/functional-design/business-logic-model.md`, `construction/contract-and-conformance/nfr-requirements/nfr-requirements.md`, `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-002 — Drift check fails on a modified vendored file

**Context**: The copy is never edited by hand; an edit must be caught by a check, not a review. Covers FR-01.

**Preconditions**:
- A working copy of the repository

**Scenario**: a tester, under the preconditions above, exercises “Drift check fails on a modified vendored file” and observes the outcome below.

**Steps**:
1. Change one byte in `contract/envelope.schema.json`.
2. Run the contract drift check.

**Expected outcome**: The check fails and names `contract/envelope.schema.json` as differing from the tag.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-01

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-003 — Drift check fails on an added file

**Context**: An added file under `contract/` is drift as much as an edit. Covers FR-01.

**Preconditions**:
- A working copy of the repository

**Scenario**: a tester, under the preconditions above, exercises “Drift check fails on an added file” and observes the outcome below.

**Steps**:
1. Add a file `contract/extra.md`.
2. Run the contract drift check.

**Expected outcome**: The check fails and names `contract/extra.md` as not present at the tag.

**Scope**: edge/boundary · **Priority**: High

**Source**: contract-and-conformance / FR-01

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-004 — Drift check fails on a removed file

**Context**: A missing fixture silently removes the cases built on it. Covers FR-01.

**Preconditions**:
- A working copy of the repository

**Scenario**: a tester, under the preconditions above, exercises “Drift check fails on a removed file” and observes the outcome below.

**Steps**:
1. Delete one file under `contract/fixtures/0.1.0/`.
2. Run the contract drift check.

**Expected outcome**: The check fails and names the removed file as present at the tag and missing here.

**Scope**: edge/boundary · **Priority**: High

**Source**: contract-and-conformance / FR-01

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-005 — Drift check fails when the tag no longer peels to the pinned commit

**Context**: A moved tag would make the copy and the tag disagree without any file here changing. Covers FR-01.

**Preconditions**:
- A working copy of the repository

**Scenario**: a tester, under the preconditions above, exercises “Drift check fails when the tag no longer peels to the pinned commit” and observes the outcome below.

**Steps**:
1. Change the peeled commit recorded in `contract/PIN` to any other commit id.
2. Run the contract drift check without `--offline`.
3. Separately, point the remote at an unreachable URL (test override) and run it again.

**Expected outcome**: The first run fails, naming the tag and the two commit values. The second fails closed, naming what it could not read; it never passes or warns.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: contract-and-conformance / FR-01

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-006 — Maintainer documentation routes an insufficient contract to soorma-core

**Context**: The copy is never adapted locally; a maintainer needs the route written down. Covers FR-01.

**Preconditions**:
- The repository's maintainer documentation

**Scenario**: a tester, under the preconditions above, exercises “Maintainer documentation routes an insufficient contract to soorma-core” and observes the outcome below.

**Steps**:
1. Open the documentation for `contract/`.
2. Look for what to do when the contract is insufficient.

**Expected outcome**: It says to raise the need against the soorma-core initiative and never to edit the copy.

**Scope**: happy-path · **Priority**: Medium

**Source**: contract-and-conformance / FR-01

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-007 — Generated-types check fails on a stale or edited generated file

**Context**: Each language's types come from the copy; a hand edit or a stale generation must fail. Covers FR-01.

**Preconditions**:
- A language package that has committed generated types (from U3 onward)

**Scenario**: a tester, under the preconditions above, exercises “Generated-types check fails on a stale or edited generated file” and observes the outcome below.

**Steps**:
1. Edit one committed generated type file.
2. Run the generated-types check.

**Expected outcome**: It holds 103 numbered statements in 16 areas (CFG, SEC, ACQ, REN, CRD, DRF, TRC, FWD, PUB, SUB, STR, RCV, PRB, SPN, NEV, NAM), each with its sources and cases, including: each PF §11 operation; the span rules and the US-Q1 decision (a forwarding hop's spans are children of the received context, with no link to it, and link tenant code's active span when it differs; the deviation from ambient parenting documented); Problems and the retry rules split by whether a request was sent; stream boundaries in order with the bounded wait and the reconnect-loop limit; duplicates around a stream boundary yielded, not suppressed; the deep-payload fallback; exact forwarding; `fileSecret`'s non-blocking open and checks; live-only delivery; the read-only credential details; the name table. The nine values named for NFR Requirements are listed by name with no numbers.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-01

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `construction/contract-and-conformance/functional-design/business-rules.md`

---

### TC-CAC-008 — Specification covers every required topic

**Context**: One document states the behaviour every language implements. Covers FR-02.

**Preconditions**:
- `spec/behaviour.md`

**Scenario**: a tester, under the preconditions above, exercises “Specification covers every required topic” and observes the outcome below.

**Steps**:
1. Read the specification's table of contents and statements.

**Expected outcome**: It states each PF §11 operation (acquire, renew, hold and present, draft envelope, populate trace context, forward inbound context), trace emission and its span rules (including how a forwarding hop's span relates to the trace it received), the Problem codes surfaced and how, the retry rules, stream ends and new streams, the deep-payload fallback, exact forwarding, `fileSecret`'s rules (non-blocking open, the checks on the opened handle), live-only delivery, the read-only credential details, and the naming convention.

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / FR-02

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-009 — Every statement names its cases and every case names its statement

**Context**: Two-way links are what make the specification checkable rather than descriptive. Covers FR-02, FR-03.

**Preconditions**:
- The specification and the case files

**Scenario**: a tester, under the preconditions above, exercises “Every statement names its cases and every case names its statement” and observes the outcome below.

**Steps**:
1. Run the runner's link check (or the full runner with any driver).

**Expected outcome**: Every numbered statement lists at least one case id, every case lists at least one statement id, and every listed id exists.

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / FR-02, FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-010 — Runner fails on a statement with no case

**Context**: A statement without a case is behaviour nobody checks. Covers FR-02, FR-03.

**Preconditions**:
- A working copy of the repository

**Scenario**: a tester, under the preconditions above, exercises “Runner fails on a statement with no case” and observes the outcome below.

**Steps**:
1. Add a new numbered statement to `spec/behaviour.md` without a case.
2. Run the runner.

**Expected outcome**: The runner fails and names the statement that has no case.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-02, FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-011 — Case files are language-neutral data

**Context**: A case written in one language's code cannot judge another language. Covers FR-03.

**Preconditions**:
- The directory `conformance/cases/`

**Scenario**: a tester, under the preconditions above, exercises “Case files are language-neutral data” and observes the outcome below.

**Steps**:
1. List every file in `conformance/cases/`.
2. Open several, including a stream case and a forwarding case.

**Expected outcome**: Every case file is JSON data (scripted platform responses, commands to the client, expected observations and requests) and contains no code in any language.

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-012 — Every agent-side contract fixture is used by a case

**Context**: The contract's valid and invalid fixtures are the cheapest source of edge cases. Covers FR-03.

**Preconditions**:
- `contract/fixtures/0.1.0/` and the case files

**Scenario**: a tester, under the preconditions above, exercises “Every agent-side contract fixture is used by a case” and observes the outcome below.

**Steps**:
1. Run the fixture-coverage report of the runner.

**Expected outcome**: All 103 agent-side fixtures (data-gateway, delivery, draft, envelope, event-ingest, inbound, problem) are referenced by at least one case, directly or as a request case's negative fixtures; the report lists none unused. Human-side fixtures (org-gateway, control-gateway) are not required.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: contract-and-conformance / FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-013 — Deep-payload cases test the fallback, never a fixed depth

**Context**: The depth bound is sized per language; a case fixing a number would judge one language by another's limit. Covers FR-03.

**Preconditions**:
- The deep-payload cases

**Scenario**: a tester, under the preconditions above, exercises “Deep-payload cases test the fallback, never a fixed depth” and observes the outcome below.

**Steps**:
1. Read each deep-payload case.
2. Run them with a driver that reports its own depth bound.

**Expected outcome**: Each deep-payload case asks for `D_lang + 8` from the depth the driver reports in `describe`, and asserts the fallback (envelope and seal intact and forwardable, `payloadParsed` false, `payloadText` present); no case holds a hard-coded threshold.

**Scope**: edge/boundary · **Priority**: High

**Source**: contract-and-conformance / FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-014 — Stub replays scripted responses and records requests byte for byte

**Context**: Every assertion about what the SDK sends rests on the stub's recording being exact. Covers FR-03.

**Preconditions**:
- The stub and a case scripting a bootstrap, an SSE stream with a heartbeat and an `end` event, a dropped connection, a `503` with `Retry-After`, a `refuse 2`, and a `reset`

**Scenario**: a tester, under the preconditions above, exercises “Stub replays scripted responses and records requests byte for byte” and observes the outcome below.

**Steps**:
1. Run that case with the reference driver.
2. Compare the stub's recorded request bodies with the bytes the driver sent.

**Expected outcome**: The stub served each scripted response in order over TLS with the run's CA, on loopback only; it refused the first two connections with nothing sent; for the `reset` it recorded the whole request and marked it *answered: none*; its recorded bodies are identical, byte for byte, to what the driver sent.

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `construction/contract-and-conformance/functional-design/business-logic-model.md`, `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-015 — Reference driver passes every case it covers

**Context**: U1 must prove its own runner before any language relies on it. Covers FR-03.

**Preconditions**:
- The test-only reference driver

**Scenario**: a tester, under the preconditions above, exercises “Reference driver passes every case it covers” and observes the outcome below.

**Steps**:
1. Run the runner in `reference` mode with the reference driver.

**Expected outcome**: Every one of the 23 declared cases passes (they span all 16 areas and all ten assertion kinds and include every fault's target); undeclared cases are listed as not run; the run exits successfully within the self-test job's 8 minutes; CI on U1's code PR shows this run.

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-016 — Negative control: a driver that retains the secret fails

**Context**: The rule that no secret reference survives a bootstrap must be one the runner can actually catch. Covers FR-03 (FR-04).

**Preconditions**:
- The negative-control driver that keeps the secret after bootstrap

**Scenario**: a tester, under the preconditions above, exercises “Negative control: a driver that retains the secret fails” and observes the outcome below.

**Steps**:
1. Run the runner with the reference driver and `--fault retain-secret`.

**Expected outcome**: The runner exits non-zero and its report lists **CC-SEC-01** as failed: the heap-snapshot check finds the value; the report gives the number of matches, never the content, and no snapshot is kept or uploaded. The self-test job treats this run as passing only because it failed on its named target.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-03 (FR-04)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-017 — Negative control: a driver that reorders the forwarded envelope's text fails

**Context**: Byte-for-byte forwarding is the easiest rule to break by re-serializing. Covers FR-03 (FR-09).

**Preconditions**:
- The negative-control driver that re-serializes the received envelope

**Scenario**: a tester, under the preconditions above, exercises “Negative control: a driver that reorders the forwarded envelope's text fails” and observes the outcome below.

**Steps**:
1. Run the runner with the reference driver and `--fault reorder-forwarded-envelope`.

**Expected outcome**: The runner exits non-zero and its report lists **CC-FWD-02** as failed: the forwarded bytes differ from the delivered envelope's. The self-test job treats this run as passing only because it failed on its named target.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-03 (FR-09)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-018 — Negative control: a driver that retries a publish fails

**Context**: Publish is never retried; a retry could duplicate an event. Covers FR-03 (FR-10).

**Preconditions**:
- The negative-control driver that retries publish on `503`

**Scenario**: a tester, under the preconditions above, exercises “Negative control: a driver that retries a publish fails” and observes the outcome below.

**Steps**:
1. Run the runner with the reference driver and `--fault retry-publish`.

**Expected outcome**: The runner exits non-zero and its report lists **CC-PUB-03** as failed: two `POST /events` were recorded where one is required. The self-test job treats this run as passing only because it failed on its named target.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-03 (FR-10)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-019 — Negative control: a driver that skips a stream boundary item fails

**Context**: Every stream end and new stream must reach tenant code; a skipped boundary hides a possible gap in delivery. Covers FR-03 (FR-11).

**Preconditions**:
- The negative-control driver that drops a stream-ended item

**Scenario**: a tester, under the preconditions above, exercises “Negative control: a driver that skips a stream boundary item fails” and observes the outcome below.

**Steps**:
1. Run the runner with the reference driver and `--fault skip-boundary`.

**Expected outcome**: The runner exits non-zero and its report lists **CC-STR-04 (and CC-STR-05)** as failed: the *stream ended (old)* item is missing from the sequence. The self-test job treats this run as passing only because it failed on its named target.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-03 (FR-11)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-020 — Runner fails when a driver skips a case

**Context**: A language is not complete until it passes every case; a skip must count as a failure. Covers FR-03.

**Preconditions**:
- A driver configured to report one case as unsupported

**Scenario**: a tester, under the preconditions above, exercises “Runner fails when a driver skips a case” and observes the outcome below.

**Steps**:
1. Run the runner with that driver in full mode (as CI runs it).

**Expected outcome**: In `full` mode the runner fails and names the skipped (or unsupported) case. The only permitted skip anywhere is `--local-skip CC-SEC-05`, and only outside CI.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-021 — Reference and negative-control drivers are in neither package

**Context**: Test-only code must not ship to agent developers. Covers FR-18.

**Preconditions**:
- The built TypeScript and Python packages (once they exist) and the repository tree

**Scenario**: a tester, under the preconditions above, exercises “Reference and negative-control drivers are in neither package” and observes the outcome below.

**Steps**:
1. Locate the reference and negative-control drivers.
2. List the files each package would install.

**Expected outcome**: The drivers live under `conformance/` only; the packaging guard passes, and fails when a test file is added to a package's file list or a package depends on `conformance/` or `tools/`.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: contract-and-conformance / FR-18

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-022 — Name table lists every operation and concept in both spellings

**Context**: One naming convention keeps two interfaces recognisably the same. Covers FR-17.

**Preconditions**:
- `spec/names.md`

**Scenario**: a tester, under the preconditions above, exercises “Name table lists every operation and concept in both spellings” and observes the outcome below.

**Steps**:
1. Read the name table.

**Expected outcome**: Every operation and concept the specification names has one row with its TypeScript spelling (camelCase members, PascalCase types) and its Python spelling (snake_case members, PascalCase classes).

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / FR-17

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-023 — Names check fails on an export not in the table, or a table name not exported

**Context**: A name added in one language only is a divergence the check must catch. Covers FR-17.

**Preconditions**:
- A language package with a driver that reports its exported names

**Scenario**: a tester, under the preconditions above, exercises “Names check fails on an export not in the table, or a table name not exported” and observes the outcome below.

**Steps**:
1. Add an exported name absent from the table and run the names check.
2. Restore it, remove a name the table lists from the exports, and run the check again.

**Expected outcome**: The first run fails naming the extra export; the second fails naming the missing one.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-17

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-024 — SPDX check fails on a source file without the licence header

**Context**: Every source file is Apache 2.0, stated in the file. Covers FR-18.

**Preconditions**:
- A working copy of the repository

**Scenario**: a tester, under the preconditions above, exercises “SPDX check fails on a source file without the licence header” and observes the outcome below.

**Steps**:
1. Add a source file without `SPDX-License-Identifier: Apache-2.0`.
2. Run the SPDX check.

**Expected outcome**: The check fails and names the file.

**Scope**: negative · **Priority**: Medium

**Source**: contract-and-conformance / FR-18

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-025 — --offline is local only and says so

**Context**: The remote half must never be silently skipped in CI. Covers FR-01 (NFR-U1-13).

**Preconditions**:
- A working copy
- A way to run the check with the CI indicators set and unset

**Scenario**: a tester, under the preconditions above, exercises “--offline is local only and says so” and observes the outcome below.

**Steps**:
1. Run the drift check with `--offline` outside CI.
2. Run it with `--offline` with the CI indicators set.

**Expected outcome**: Outside CI it runs only the local half and prints "remote half not run". With CI detected it refuses `--offline` and fails.

**Scope**: negative · **Priority**: Medium

**Source**: contract-and-conformance / FR-01 (NFR-U1-13)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-requirements/nfr-requirements.md`

---

### TC-CAC-026 — --local-skip accepts only CC-SEC-05, only outside CI

**Context**: The foreign-owner case must always run where it can: in CI. Covers FR-03 (NFR-U1-15, -16).

**Preconditions**:
- The runner and a driver

**Scenario**: a tester, under the preconditions above, exercises “--local-skip accepts only CC-SEC-05, only outside CI” and observes the outcome below.

**Steps**:
1. Run with `--local-skip CC-SEC-05` outside CI.
2. Run with `--local-skip CC-SEC-01`.
3. Run with `--local-skip CC-SEC-05` with the CI indicators set.
4. Run without the flag on a machine where the second user cannot be created.

**Expected outcome**: The first skips CC-SEC-05, prints that it did not run and why, and repeats it in the summary. The second and third are refused. The fourth runs CC-SEC-05 and fails it, saying it could not create the foreign-owned file.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-03 (NFR-U1-15, -16)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-requirements/nfr-requirements.md`

---

### TC-CAC-027 — Over budget: the run finishes, then fails, naming the slowest cases

**Context**: A breach must be visible with every failure, and attributable. Covers FR-03 (NFR-U1-01, -04).

**Preconditions**:
- A test configuration of the runner with a tiny budget

**Scenario**: a tester, under the preconditions above, exercises “Over budget: the run finishes, then fails, naming the slowest cases” and observes the outcome below.

**Steps**:
1. Run a set of cases whose total exceeds the budget but not twice it.

**Expected outcome**: Every case runs and reports; the run then fails, with the slowest cases listed first with their durations.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: contract-and-conformance / FR-03 (NFR-U1-01, -04)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-028 — A hung run is stopped by the watchdog

**Context**: A hang must not reach the CI platform's own timeout. Covers FR-03 (NFR-U1-09).

**Preconditions**:
- A driver that stops answering, and a case timeout longer than twice the test budget

**Scenario**: a tester, under the preconditions above, exercises “A hung run is stopped by the watchdog” and observes the outcome below.

**Steps**:
1. Run with the hanging driver.

**Expected outcome**: The watchdog stops the run at twice the budget; cases not reached are reported not run; the run fails.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: contract-and-conformance / FR-03 (NFR-U1-09)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-029 — A case timeout fails that case only

**Context**: One slow case must not take the run down. Covers FR-03 (NFR-U1-09).

**Preconditions**:
- A case whose expected request never arrives

**Scenario**: a tester, under the preconditions above, exercises “A case timeout fails that case only” and observes the outcome below.

**Steps**:
1. Run that case and the next.

**Expected outcome**: The first fails by name, naming the expectation it was waiting on; its driver is killed; the next case runs in a new driver process and passes.

**Scope**: negative · **Priority**: Medium

**Source**: contract-and-conformance / FR-03 (NFR-U1-09)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-030 — A new driver process per case; a crash fails one case

**Context**: CDI-02's checks need a clean heap and clean reference counts. Covers FR-03 (NFR-U1-07, -09).

**Preconditions**:
- A driver that crashes on one command

**Scenario**: a tester, under the preconditions above, exercises “A new driver process per case; a crash fails one case” and observes the outcome below.

**Steps**:
1. Run a case that triggers the crash, then a normal case.
2. Compare the driver process ids recorded per case.

**Expected outcome**: The crashing case fails by name; the next case passes; each case ran in a different process.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-03 (NFR-U1-07, -09)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-031 — The runner has no retry

**Context**: A flaky case is fixed, never rerun to green. Covers FR-03 (NFR-U1-05).

**Preconditions**:
- The runner's command-line help and options

**Scenario**: a tester, under the preconditions above, exercises “The runner has no retry” and observes the outcome below.

**Steps**:
1. Look for any option that retries a failed case.
2. Run a case that fails once.

**Expected outcome**: No such option exists; the case is reported failed, once.

**Scope**: negative · **Priority**: Medium

**Source**: contract-and-conformance / FR-03 (NFR-U1-05)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-requirements/nfr-requirements.md`

---

### TC-CAC-032 — A case with too narrow a timing window is rejected

**Context**: Windows narrower than twice the value invite false passes and flakes. Covers FR-03 (NFR-U1-06).

**Preconditions**:
- A case file whose timing window margin is under twice the value in force

**Scenario**: a tester, under the preconditions above, exercises “A case with too narrow a timing window is rejected” and observes the outcome below.

**Steps**:
1. Load it.

**Expected outcome**: The loader rejects the case, naming the window and the rule.

**Scope**: negative · **Priority**: Medium

**Source**: contract-and-conformance / FR-03 (NFR-U1-06)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-033 — Secrets and heap snapshots never leave the run

**Context**: A failing CDI-02 check holds the secret; it must not leak through a report or an artifact. Covers FR-03 (NFR-U1-19; P-04).

**Preconditions**:
- The reference driver with `--fault retain-secret`
- A CI run of the self-test job

**Scenario**: a tester, under the preconditions above, exercises “Secrets and heap snapshots never leave the run” and observes the outcome below.

**Steps**:
1. Run the fault.
2. Search the report, stdout, stderr and the job's uploaded artifacts for the secret's value.
3. List the run directory after the case and after the run.

**Expected outcome**: The report names CC-SEC-01 and the number of matches only; the value appears nowhere; no snapshot exists outside the run's `0700` directory during the case, none remains after it, and the job uploads no artifact containing one.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-03 (NFR-U1-19; P-04)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-034 — The run directory and CAs are removed, also on failure

**Context**: Private keys and secret files must not outlive the run. Covers FR-03 (NFR-U1-21).

**Preconditions**:
- A run that fails part-way

**Scenario**: a tester, under the preconditions above, exercises “The run directory and CAs are removed, also on failure” and observes the outcome below.

**Steps**:
1. Run it.
2. Look for the run's temporary directory afterwards.

**Expected outcome**: The directory, its CA keys and secret files are gone; it had mode `0700` while it existed.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: contract-and-conformance / FR-03 (NFR-U1-21)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-035 — The stub listens on loopback only

**Context**: Test listeners must not be reachable from the network. Covers FR-03 (NFR-U1-20).

**Preconditions**:
- A running stub

**Scenario**: a tester, under the preconditions above, exercises “The stub listens on loopback only” and observes the outcome below.

**Steps**:
1. List its listening sockets.
2. Try to connect on a non-loopback address of the machine.

**Expected outcome**: Every listener is bound to `127.0.0.1` or `::1`; the connection fails.

**Scope**: negative · **Priority**: Medium

**Source**: contract-and-conformance / FR-03 (NFR-U1-20)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-036 — DCO: another author's commit without a sign-off fails

**Context**: The exemption must not reach an ordinary contributor. Covers NFR-11 (NFR-U1-32).

**Preconditions**:
- A local test git repository with a human author's commit lacking `Signed-off-by`
- The commit API stub answering: human, not Dependabot

**Scenario**: a tester, under the preconditions above, exercises “DCO: another author's commit without a sign-off fails” and observes the outcome below.

**Steps**:
1. Run the DCO module on the range.

**Expected outcome**: It fails, naming the commit and the expected `Signed-off-by` line.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / NFR-11 (NFR-U1-32)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-037 — DCO: an unverified commit with a `[bot]` email fails

**Context**: An email is free text; the old `*[bot]*` exemption is gone. Covers NFR-11 (NFR-U1-29, -32).

**Preconditions**:
- A commit authored as `someone[bot]@example.com` without a sign-off
- The API stub answering: verified false (or a login other than `dependabot[bot]`)

**Scenario**: a tester, under the preconditions above, exercises “DCO: an unverified commit with a `[bot]` email fails” and observes the outcome below.

**Steps**:
1. Run the DCO module.

**Expected outcome**: It fails, naming the commit.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / NFR-11 (NFR-U1-29, -32)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-038 — DCO: a human commit pushed into a Dependabot PR fails

**Context**: Being in a Dependabot PR exempts nothing; only GitHub's signature on Dependabot's own commit does. Covers NFR-11 (NFR-U1-32).

**Preconditions**:
- A range holding a verified Dependabot commit and a human commit without a sign-off

**Scenario**: a tester, under the preconditions above, exercises “DCO: a human commit pushed into a Dependabot PR fails” and observes the outcome below.

**Steps**:
1. Run the DCO module on the range.

**Expected outcome**: The Dependabot commit is exempt; the human commit fails, by name; the check fails.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / NFR-11 (NFR-U1-32)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-039 — DCO: a lookup error fails closed

**Context**: An API outage must not open the exemption. Covers NFR-11 (NFR-U1-31).

**Preconditions**:
- An unsigned commit
- The API stub returning an error (and, separately, a response missing `verification`)

**Scenario**: a tester, under the preconditions above, exercises “DCO: a lookup error fails closed” and observes the outcome below.

**Steps**:
1. Run the DCO module.

**Expected outcome**: It fails, naming the commit and the lookup error; the commit is not exempt.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / NFR-11 (NFR-U1-31)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-040 — DCO: a verified Dependabot commit passes on its own PR

**Context**: Dependabot cannot sign off; GitHub signs its commits. Covers NFR-11 (NFR-U1-32).

**Preconditions**:
- A Dependabot-authored commit without a sign-off
- The API stub answering `author.login` `dependabot[bot]`, `verification.verified` true

**Scenario**: a tester, under the preconditions above, exercises “DCO: a verified Dependabot commit passes on its own PR” and observes the outcome below.

**Steps**:
1. Run the DCO module on the Dependabot PR's range.

**Expected outcome**: It passes, reporting the commit as exempt (verified Dependabot).

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / NFR-11 (NFR-U1-32)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-041 — DCO: the same commit passes on the dev → main PR

**Context**: Updates take the dev → main path; the exemption must hold there too. Covers NFR-11 (NFR-U1-32).

**Preconditions**:
- A range from `main` to `dev` holding that Dependabot commit, a merge commit, and signed-off human commits

**Scenario**: a tester, under the preconditions above, exercises “DCO: the same commit passes on the dev → main PR” and observes the outcome below.

**Steps**:
1. Run the DCO module on the range.

**Expected outcome**: It passes: the merge commit is skipped, the human commits are signed off, the Dependabot commit is exempt by the same API answer. The live confirmation is OBL-01.

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / NFR-11 (NFR-U1-32)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-042 — DCO: the token comes from an action input; permissions read-only

**Context**: Secrets never go in environment variables. Covers NFR-11 (NFR-U1-30).

**Preconditions**:
- The rewritten `dco.yml`

**Scenario**: a tester, under the preconditions above, exercises “DCO: the token comes from an action input; permissions read-only” and observes the outcome below.

**Steps**:
1. Read the workflow.
2. Run the workflow check on it.

**Expected outcome**: The token is `actions/github-script`'s `github-token` input (its default); no step sets a token in `env`; permissions are `contents: read`; `actions/checkout` and `actions/github-script` are pinned by SHA with tag comments; `runs-on` is `ubuntu-24.04`.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / NFR-11 (NFR-U1-30)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-requirements/nfr-requirements.md`

---

### TC-CAC-043 — The workflow check catches unpinned or over-privileged workflows

**Context**: Pinning by SHA and least privilege must not erode by review alone. Covers NFR-07 (NFR-U1-28).

**Preconditions**:
- Copies of a workflow with: an action pinned to a tag; a SHA without a tag comment; `ubuntu-latest`; `permissions: write-all`; an upload step naming the run directory

**Scenario**: a tester, under the preconditions above, exercises “The workflow check catches unpinned or over-privileged workflows” and observes the outcome below.

**Steps**:
1. Run the workflow check on each.

**Expected outcome**: Each fails, naming the file, the line and the rule.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / NFR-07 (NFR-U1-28)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-design/nfr-design-patterns.md`

---

### TC-CAC-044 — Dependabot targets dev with a 7-day cooldown

**Context**: Updates must take the dev → main path and wait out fresh releases. Covers NFR-07 (NFR-U1-27).

**Preconditions**:
- `.github/dependabot.yml`

**Scenario**: a tester, under the preconditions above, exercises “Dependabot targets dev with a 7-day cooldown” and observes the outcome below.

**Steps**:
1. Read it.

**Expected outcome**: Two entries, `npm` and `github-actions`, each weekly with `cooldown.default-days: 7` and `target-branch: dev`.

**Scope**: happy-path · **Priority**: Medium

**Source**: contract-and-conformance / NFR-07 (NFR-U1-27)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-requirements/nfr-requirements.md`

---

### TC-CAC-045 — Frozen install and audit gate CI

**Context**: The lock file is the source of truth; known vulnerabilities fail the build. Covers NFR-07 (NFR-U1-24, -26).

**Preconditions**:
- A branch where `package.json` changes without the lock file
- A dependency with a known moderate advisory (or a recorded audit response)

**Scenario**: a tester, under the preconditions above, exercises “Frozen install and audit gate CI” and observes the outcome below.

**Steps**:
1. Run CI's install and audit steps on each.

**Expected outcome**: The install fails with the frozen-lockfile error; the audit fails at moderate.

**Scope**: negative · **Priority**: Medium

**Source**: contract-and-conformance / NFR-07 (NFR-U1-24, -26)

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/code/`

**Technical references**: `construction/contract-and-conformance/nfr-requirements/nfr-requirements.md`
