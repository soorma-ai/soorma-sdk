# NFR Requirements — U2 `e2e-stack`

**Answers**: U2-NFR-Q1 to Q6, all A; Q6's reasons corrected by the user (audit
2026-11-18T20:01:38Z). **Shape**: ordinary, so no PRD NFR profile seeds this unit (Step 1.5).
Sources: the initiative's NFR-06, NFR-07, NFR-10; the security baseline (`local-only`); AD-13;
U2's Functional Design (rules cited by id); U1's repository rules (NFR-U1-24 to -28), inherited
unchanged.

## Performance and Time

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U2-01 | The `e2e` job has **`timeout-minutes: 20`**, a backstop only. **Every raw call in `setup` and `prove-stack`, and every child step of `core-up` and `core-down` that can hang, has its own time limit**, each well under 20 minutes (values: TS-U2-11), so a hung service fails its step, with its name, long before the job's timeout. A single hang in `core-up`, after its other steps' normal time, ends it in about 10 minutes at most | Q3 A; the user (2026-11-18T20:54:18Z) | TC-ES-022, TC-ES-023 |
| NFR-U2-02 | **The job's time is measured on U2's code PR**, with its run ID recorded (OBL-02). **Over 8 minutes**, NFR Requirements is reopened for U2 before U3 starts | AD-13; Q3 A | TC-ES-011; OBL-02 |
| NFR-U2-03 | **Nothing is cached** until that measurement: a fresh clone, a fresh install and fresh images every run, so the first measurement shows the cold cost and no cache feeds a job whose point is a fresh stack | Q3 A; AD-11 | The job's YAML (no cache step) |

## Reliability and Cleanup

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U2-04 | **`core-down` always runs** (`if: always()`), and gets **`--logs` when `failure() \|\| cancelled()`**: GitHub reports a job stopped by its timeout, or cancelled, as cancelled rather than failed, and those are the runs whose logs matter most. Without an ownership record it does nothing and exits `0` | CD-01; JOB-03; the user (2026-11-18T20:54:18Z) | TC-ES-008 (the workflow's condition read by a unit test), TC-ES-018 |
| NFR-U2-05 | **No retry** inside any command (ST-12, PS-06); a red job is fixed, never rerun until green, except one recorded rerun for a CI-infrastructure cause (code-generation.md Step 12a) | U2-FD-Q8; U1 policy | TC-ES-020 |
| NFR-U2-06 | **`core-up` checks its prerequisites before writing the ownership record** (Docker Engine 26 or later, Docker Compose 2.26.0 or later, `git`, the `--core-node` executable), so a missing one leaves nothing to tear down (CU-11) | Q5 A | TC-ES-021 (unit, fake `docker`) |
| NFR-U2-07 | Every failure exits non-zero with one line saying what failed; no stack trace that could carry a request or response body. **A time limit running out is a failure**: one line naming the step and saying it timed out (`setup: registerAgent agent-b timed out after 30 s`), then the command's usual failure path. **Never retried.** `setup` still ends its sign-in and environment credential and checks them refused (ST-09), each of those calls under its own limit | GEN-06, GEN-07; SECURITY-15; the user (2026-11-18T20:54:18Z) | TC-ES-020, TC-ES-022, TC-ES-023 |

## Security and Secret Handling

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U2-08 | **No secret or credential** in a log line, an argument, an environment variable, an error message, a CI artifact, or a file other than its own secret file. Child processes (`docker`, `git`, soorma-core's scripts) receive no secret on their command line or environment | GEN-02; NFR-06; the user's rule | TC-ES-006, TC-ES-007 |
| NFR-U2-09 | Secret files `0600`, created exclusively; the secrets directory `0700`, owned by the user, refused otherwise | ST-02, ST-08 | TC-ES-004, TC-ES-019 |
| NFR-U2-10 | **The log search fails closed** (LS-02, LS-10): no readable prefix, an unreadable value source or an unreadable log prints no log | U2-FD-Q7 | TC-ES-016, TC-ES-017 |
| NFR-U2-11 | **TLS on every raw call**, with the clone's `stack-ca.pem` as the only trust anchor; certificate verification is never turned off anywhere in `e2e/` | GEN-04; SECURITY-01 (in transit) | Review at Code Generation; a test that a call to a server with another CA fails |
| NFR-U2-12 | **One sign-in and one environment credential per `setup`**, each ended and checked refused, also after a failure (ST-06, ST-09) | The user (2026-11-18T19:20:00Z) | TC-ES-006, TC-ES-020 |
| NFR-U2-13 | The `e2e` and `changes` jobs: `permissions: contents: read`; **no repository secret referenced**; nothing under `.e2e/` uploaded as an artifact | JOB-05; NFR-U1-28 | U1's workflow check |

## Supply Chain

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U2-14 | **The clone is pinned by commit**: `contract.pin.json`'s `tag` and `commit`, the one source for the contract copy and the stack (CU-05) | AD-10; SECURITY-13 | TC-ES-002 |
| NFR-U2-15 | **Installing the clone runs no dependency install scripts.** `core-up` refuses unless the clone's `pnpm-workspace.yaml` has **`strictDepBuilds: true` and `allowBuilds: {}`** (both true at `contract-v0.1.0`). CU-05's commit check already makes this true for this tag; the explicit check states the trust and survives a new tag (CU-12) | Q6 (the user) | TC-ES-021 |
| NFR-U2-16 | **soorma-core's toolchain, exactly**: `core-up` refuses unless `--core-node`'s `--version` equals the clone's `.node-version` (`26.13.0`), and this repository's pnpm equals the clone's `packageManager` (`12.18.0`) (CU-13) | Q2 A | TC-ES-021 (unit, fake executables) |
| NFR-U2-17 | **The clone's dependencies are not audited here**, for the reasons recorded in `DEPENDENCIES.md` (text below, added at Code Generation), with `picomatch@4.0.7` named as a known instance | Q6 (the user) | `DEPENDENCIES.md`; review |
| NFR-U2-18 | `e2e/` adds **no new npm dependency**: it uses Node built-ins and U1's `ajv` and `yaml`. Any dependency added later follows U1's policy (NFR-U1-24 to -27) | Q1 A; NFR-07 | The lock file diff on U2's code PR |

### The text `DEPENDENCIES.md` gains (Code Generation)

> **soorma-core's dependencies, in the end-to-end stack.** `e2e/core-up` installs soorma-core at
> `contract-v0.1.0` with its own frozen lock file. This repository does not audit those packages,
> for these reasons:
>
> - **No install scripts run.** soorma-core's `pnpm-workspace.yaml` at the tag sets
>   `strictDepBuilds: true` and `allowBuilds: {}`. `core-up` checks both and refuses a clone
>   without them.
> - **Short-lived and unprivileged.** The clone runs only as a stack inside a job with
>   `contents: read` and no repository secrets, and `e2e/core-down` takes it down.
> - **Kept apart.** Its packages never enter this repository's packages, lock file or audit.
> - **Frozen at the tag.** soorma-core's own CI audits soorma-core's latest code, not the lock
>   file at the tag, so it is no check for the tag. An advisory against the tag is soorma-core's to
>   fix and reaches this repository only through a new contract tag. It is not chased here.
>
> **Known instance**: the tag's lock file holds `picomatch@4.0.7`, affected by
> GHSA-fc5q-39xc-vjpf (soorma-core#35). It also fails soorma-core's own audit today.

## Maintainability and Testing

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U2-19 | **Vitest in `unit`, on every PR, for everything that needs no stack**: TC-ES-002, 003, 013 to 023 (and TC-ES-008's workflow-condition test), with recorded log text, the vendored contract, a local HTTPS fake of S1 and S2, and fake `docker` and `git` executables first on `PATH`. **The `e2e` job** for TC-ES-001, 004 to 008. **Locally** TC-ES-012 | Q4 A; NFR-10 | The `unit` and `e2e` jobs |
| NFR-U2-20 | **TC-ES-020's fake validates every response it sends** against the vendored contract's schema for that operation and status, in the fake or the test, so it cannot drift from the contract | The user (2026-11-18T19:25:25Z) | TC-ES-020 |
| NFR-U2-21 | `e2e/` is a **private workspace package**, never published; U1's packaging guard forbids `e2e/` in either package (GEN-03) | Q1 A; I6, I8 | The packaging guard's test |

## Usability, Locally

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U2-22 | **Linux and macOS**, with Docker Engine 26+, Docker Compose 2.26.0+ (soorma-core's floor, which its `stack:up` also checks), `git`, and Node 26.13.0 for `--core-node`. **Windows is not supported** in M1, as for U1 | Q5 A | TC-ES-012; the README |
| NFR-U2-23 | **The README** lists the prerequisites, the four commands, and the local side effects: the `soorma/*:local` images are rebuilt (replacing a developer's own), the `soorma-local` project and loopback ports 8441 to 8447 are used, and `core-up` refuses rather than stop a stack it did not start | S-6; Q5 A | Review at Code Generation |
| NFR-U2-24 | The commands run as `pnpm` scripts (`pnpm e2e:core-up`, `pnpm e2e:setup`, `pnpm e2e:prove-stack`, `pnpm e2e:core-down`), identical in CI and locally | GEN-01; Q1 A | TC-ES-012 |

## NFR Design: Not Reinstated

Units Generation (Q3 A) skipped NFR Design for U2 unless NFR Requirements found a pattern to
design. **It stays skipped.** Each pattern U2 needs is already specified to the level code is
written from: the fail-closed log search (LS-01 to LS-11), the ownership and marker lifecycle
(CU-01 to CU-13, ST-03, CD-01 to CD-06), the refusal check (ST-09), and the validating fake
(NFR-U2-20). The tech-stack decisions settle the mechanisms. Nothing is left between requirement
and code that a design stage would decide. The decision can be revisited by NFR-U2-02 if the
measured time calls for caching.
