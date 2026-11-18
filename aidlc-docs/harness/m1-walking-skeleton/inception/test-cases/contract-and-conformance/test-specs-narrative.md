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
1. Run the contract drift check.
2. Read `contract/PIN`.

**Expected outcome**: The check passes. `PIN` names the tag `contract-v0.1.0`, the peeled commit `c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d`, the git tree id of `contract/` at that commit, and a SHA-256 for every vendored file; the files under `contract/` hash to those values.

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / FR-01

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

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
2. Run the contract drift check.

**Expected outcome**: The check fails, reporting that the tag `contract-v0.1.0` does not peel to the commit `PIN` records.

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

**Expected outcome**: The check fails and names the generated file that differs from what the copy generates.

**Scope**: negative · **Priority**: High

**Source**: contract-and-conformance / FR-01

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

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

**Expected outcome**: Every valid and invalid fixture for draft, envelope, delivery, inbound, problem, data-gateway and event-ingest shapes is referenced by at least one case; the report lists none unused. Fixtures for human-side operations (S1, S2) are not required.

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

**Expected outcome**: Each case builds a payload nested beyond the depth the driver reports, and asserts the fallback (envelope and seal intact and forwardable, payload as raw text flagged as not parsed); no case contains a hard-coded depth number as its threshold.

**Scope**: edge/boundary · **Priority**: High

**Source**: contract-and-conformance / FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-014 — Stub replays scripted responses and records requests byte for byte

**Context**: Every assertion about what the SDK sends rests on the stub's recording being exact. Covers FR-03.

**Preconditions**:
- The stub and a case that scripts a bootstrap, an SSE stream with a heartbeat and an `end` event, a dropped connection, and a `503` with `Retry-After`

**Scenario**: a tester, under the preconditions above, exercises “Stub replays scripted responses and records requests byte for byte” and observes the outcome below.

**Steps**:
1. Run that case with the reference driver.
2. Compare the stub's recorded request bodies with the bytes the driver sent.

**Expected outcome**: The stub served each scripted response in order over TLS with the run's CA, and its recorded request bodies are identical, byte for byte, to what the driver sent.

**Scope**: happy-path · **Priority**: High

**Source**: contract-and-conformance / FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/contract-and-conformance/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/contract-and-conformance/functional-design/`

---

### TC-CAC-015 — Reference driver passes every case it covers

**Context**: U1 must prove its own runner before any language relies on it. Covers FR-03.

**Preconditions**:
- The test-only reference driver

**Scenario**: a tester, under the preconditions above, exercises “Reference driver passes every case it covers” and observes the outcome below.

**Steps**:
1. Run the runner with the reference driver.

**Expected outcome**: Every case the reference driver declares it covers passes; the runner exits successfully; CI on U1's code PR shows this run.

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
1. Run the runner with that driver.

**Expected outcome**: The runner fails and names the case that checks the secret is not retained.

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
1. Run the runner with that driver.

**Expected outcome**: The runner fails and names the exact-forwarding case.

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
1. Run the runner with that driver.

**Expected outcome**: The runner fails and names the no-retry-on-publish case.

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
1. Run the runner with that driver.

**Expected outcome**: The runner fails and names the stream-boundary case.

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

**Expected outcome**: The runner fails and names the skipped case.

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

**Expected outcome**: The drivers live under `conformance/` only; neither package's file list includes them.

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
