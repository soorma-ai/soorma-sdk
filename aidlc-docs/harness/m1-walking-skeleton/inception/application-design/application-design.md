# Application Design — soorma-sdk, M1

**Scope**: the soorma-sdk column of the M1 slice brief (`0aad84a`): the harness, against
soorma-core's contract at `contract-v0.1.0`. **Inputs**: requirements (approved
2026-11-18T02:47:34Z), stories (approved 2026-11-18T03:05:37Z), the plan's answers (audit
2026-11-18T05:32:10Z).

This document consolidates four others, which hold the detail:

| Document | Holds |
|---|---|
| [components.md](components.md) | Layout, package names, every component's purpose, responsibilities, interface |
| [component-methods.md](component-methods.md) | The name table's first rows, the public interface in both languages, the conformance driver protocol, the end-to-end commands |
| [services.md](services.md) | Orchestration: client lifecycle, credentials, streams across renewal, publish and forward, conformance, end-to-end, CI and its time |
| [component-dependency.md](component-dependency.md) | Dependency matrix, communication patterns, diagrams, the data flow of *done when* 2, 3, 5 |

---

## 1. Design Decisions

| ID | Decision | Answer | Traces to |
|---|---|---|---|
| AD-01 | **Layout**: `contract/`, `spec/`, `conformance/`, `tools/`, `e2e/` language-neutral at the top; `typescript/` and `python/` each hold a package, its conformance driver, its examples and its end-to-end test | Q1 A | D-04 |
| AD-02 | **Package names**: TypeScript `@soorma/sdk` (the user's npm organisation `soorma`, empty); Python distribution `soorma`, imported as `soorma`. **PyPI `soorma-sdk` is a redirect to `soorma`, not this package's name.** Nothing published in M1 | Q2 X | D-05, FR-18 |
| AD-03 | **Naming convention**: the PRD and contract vocabulary in each language's idiomatic casing, listed in a name table (`spec/names.md`); a check fails on any exported name not in the table, or missing from it | Q3 A | FR-17; US-13 #3 |
| AD-04 | **Interface shape**: one `AgentClient` per agent instance; creating it contacts nothing; `start()` bootstraps; `close()` releases. `Delivery.publish()` forwards (the default path); `client.publish()` does not (the deliberate call) | Q4 A | FR-09; US-01 #1, US-08 #1, #5 |
| AD-05 | **Subscription**: one async iterator of `Delivery`, `DeliveryError`, `StreamStarted`, `StreamEnded` items, in order; finishes after a terminal end or `close()` | Q5 A | FR-11, FR-12; US-06 |
| AD-06 | **Instance identifier (T-5)**: required; `newInstanceId()` returns a random UUID v4 and reads nothing about the host; the developer calls it deliberately | Q6 A | PF FR-009, FR-022; I3, I10 |
| AD-07 | **Secret provider**: a tenant-supplied function, called once per bootstrap, no reference kept. The SDK ships **one** provider, `fileSecret(path)`, and **none that reads an environment variable**. `fileSecret` follows symlinks and checks the final file on the opened handle; refuses, without reading, a file that is not regular, is writable by group or others, is readable by others, or is owned by anyone other than the process's user or root; allows a group read. A refusal names the path and the reason, never the contents. README: Kubernetes `defaultMode: 0440` with `fsGroup`, and the Docker equivalent. Windows: Functional Design | Q7 X; the user's item 1 | D-09; OB-9; SECURITY-12 |
| AD-08 | **The examples' secret source**: the configuration block names a path through `fileSecret` (for example `./.secrets/agent-a.secret`, git-ignored), never the secret. CI and local runs fill that path the same way, through `e2e/setup` | Q7 X; the user's item 1 | FR-20; US-11 #2 |
| AD-09 | **Conformance**: one runner and one scripted S3 and S4 stub, written once in TypeScript; a thin driver per language over JSON lines; every assertion in the runner | Q8 A | FR-03; US-14 |
| AD-10 | **How CI runs soorma-core**: `e2e/core-up` clones soorma-core at `contract-v0.1.0`, fails unless the commit is `c1e3d7f3…`, builds S1 to S4 as soorma-core's CI does, `pnpm stack:init`, `pnpm stack:up`. `e2e/setup` registers A and B in environment `e` by raw calls and writes each secret to a `0600` file. `e2e/core-down` runs `down -v` | Q9 X; the user's item 2 | FR-19; D-12; US-11 #1, #4 |
| AD-11 | **Fresh stack, every run**: a clean clone and `stack:init` each time, `down -v` at the end; a single-use marker makes `e2e/setup` refuse to run except right after a fresh `core-up` (the handover's first authentication works once). `core-up` refuses to touch a `soorma-local` stack it did not start | Q9 X | FR-19 |
| AD-12 | **End-to-end jobs**: one per language, each with its own stack, in parallel; on pull requests and pushes to `dev`, **not pushes to `main`**; skipped by a job-level condition only when every changed file is provably under `aidlc-docs/` (soorma-core #26's pattern) | Q9 X | D-12; NFR-10 |
| AD-13 | **Expected CI time added**: about 3 to 5 minutes per end-to-end job for soorma-core's bring-up, under a minute for set-up and scenario; wall time about 4 to 6 minutes with the two jobs in parallel. Measured at the first code PR; past 8 minutes, NFR Design revisits | the user's item 2 | — |
| AD-14 | **Tracing depends on the OpenTelemetry API only**; no exporter, no sampler; the end-to-end test installs an in-memory exporter in the test process holding both agents | FR-14 (as stated) | soorma-sdk GAP-INT-002 |
| AD-15 | **Carried at approval** (aidlc-state.md *Carried Design Inputs*): CDI-01 `credential.environment` exposed read only, settling T-6, traced to FR-15; CDI-02 US-02 #3 checked by the runtime (TypeScript heap snapshot after forced GC; Python `sys.getrefcount`), defined by the conformance unit's Functional Design; CDI-03 `fileSecret` opens without blocking and refuses a named pipe or device | the user, at approval | FR-15; US-02 #2, #3; D-09 |

**Carried, unsettled**: **US-Q1** (a forwarding hop's span: child of, or linked to, the trace it
received) to the Functional Design of the unit holding C-19, under GAP-INT-002's work-around and
consistent with *done when* 5's trace-id check.

**Left to later stages**: library choices (HTTP client, SSE reader, JSON with source text and a
depth bound, the type generators, the OpenTelemetry packages), renewal headroom, the retry
bound and the parse-depth bound are NFR Requirements'. Business rules per operation, the full
name table, the full driver command set, and `fileSecret` on Windows are Functional Design's.

## 2. Components at a Glance

| ID | Component | Lang | Serves |
|---|---|---|---|
| C-01 | Contract copy and `PIN` | N | FR-01; US-12 |
| C-02 | Behaviour specification and name table | N | FR-02, FR-17; US-13 |
| C-03 | Conformance suite: cases, stub, runner | N | FR-03; US-13 #2, US-14 |
| C-04 | Repository checks: drift, generated types, names, SPDX | N | FR-01, FR-17; NFR-09; US-12, US-13 #3 |
| C-05 | End-to-end harness: `core-up`, `setup`, `core-down` | N | FR-19; D-12; US-11 #1, US-14 #4 |
| C-06 | CI workflows | N | NFR-07, NFR-10, NFR-11 |
| C-10 | Generated contract types (agent side only) | T, P | FR-01, FR-18 |
| C-11 | Agent client | T, P | FR-04 to FR-11, FR-15, FR-16 |
| C-12 | Client configuration | T, P | FR-15; US-01 |
| C-13 | Secret providers (`fileSecret`) | T, P | D-09; US-02 #3 |
| C-14 | Credential keeper | T, P | FR-04, FR-05, FR-06; US-02, US-03 |
| C-15 | Transport | T, P | FR-06, FR-10, FR-13, FR-15 |
| C-16 | Draft builder | T, P | FR-07, FR-08, FR-09; US-04, US-08 |
| C-17 | Subscription and stream supervisor | T, P | FR-11; US-05, US-06 |
| C-18 | Delivery reader and `Delivery.publish` | T, P | FR-09, FR-12; US-07, US-08 |
| C-19 | Tracing | T, P | FR-08, FR-14; US-09 |
| C-20 | Errors | T, P | FR-13; NFR-06; US-10 |
| C-21 | Conformance driver | T, P | FR-03; US-14 #2 |
| C-22 | Example and end-to-end test | T, P | FR-19, FR-20; US-11 |

## 3. Traceability

### Requirements to components

| FR | Components | FR | Components |
|---|---|---|---|
| FR-01 | C-01, C-04, C-10 | FR-11 | C-17, C-15 |
| FR-02 | C-02 | FR-12 | C-18 |
| FR-03 | C-03, C-21 | FR-13 | C-15, C-14, C-20 |
| FR-04 | C-14, C-13, C-15 | FR-14 | C-19, C-22 |
| FR-05 | C-14 | FR-15 | C-12, C-15 |
| FR-06 | C-14, C-15 | FR-16 | C-11, C-12, C-10 (what is absent) |
| FR-07 | C-16 | FR-17 | C-02, C-04 |
| FR-08 | C-16, C-19 | FR-18 | C-10 to C-20 |
| FR-09 | C-16, C-18, C-15 | FR-19 | C-05, C-22, C-06 |
| FR-10 | C-11, C-15 | FR-20 | C-22 |

NFR-01 to NFR-11 land on C-14 (NFR-02), C-15 (NFR-01, NFR-04, NFR-06), C-18 (NFR-03), C-20
(NFR-06), C-01 and C-18 (NFR-05), C-06 (NFR-07, NFR-08, NFR-10, NFR-11), C-04 (NFR-09).

### Stories to components

| Story | Components | Story | Components |
|---|---|---|---|
| US-01 | C-11, C-12, C-15 | US-08 | C-18, C-16, C-15 |
| US-02 | C-14, C-13, C-15, C-20 | US-09 | C-19, C-22 |
| US-03 | C-14 | US-10 | C-20, C-15 |
| US-04 | C-11, C-16, C-15, C-19 | US-11 | C-22, C-05, C-13 |
| US-05 | C-17, C-15 | US-12 | C-01, C-04 |
| US-06 | C-17, C-14 | US-13 | C-02, C-03, C-04 |
| US-07 | C-18 | US-14 | C-03, C-21, C-05, C-06 |

Every FR and every story has a component; every component serves at least one.

## 4. What the Design Leaves Out, Deliberately (FR-16)

Checked across every component and the public interface in `component-methods.md`:
- no option or method takes an **environment identifier**; scope comes from the credential
- no type, option or method holds a **human credential**; no S1 or S2 types are generated;
  the human steps exist only in `e2e/setup`, outside both packages
- no **delegation**; the `Soorma-Delegation` header is never sent
- no way to set a **platform-stamped field**
- no **TLS-verification switch**; no topic or discovery parameter
- no **secret source that reads an environment variable**, in the package, the examples, or
  CI
- no **enforcement**: nothing the SDK checks is a check the platform relies on

## 5. Misuse Considered (SECURITY-11)

| Misuse | Design response |
|---|---|
| A secret file left world-readable, or replaced by a link to someone else's file | `fileSecret` refuses before reading: others' read, group or others' write, a foreign owner; checks the final file on the opened handle, so a swap between check and read is not possible |
| A developer puts the secret in the example's configuration or an environment variable | The configuration block takes a provider; the only one shipped reads a file; the README says why |
| A secret or credential leaking through logs, errors or string forms | Held only by C-13 and C-14; C-20's types carry neither; NFR-06 is a conformance case (US-02 #4) |
| Retrying past the bootstrap abuse bound | `429` is never retried (FR-13); publish is never retried (D-11) |
| Re-bootstrapping around a revocation | `credential_refused` is terminal (S-1, S-2) |
| Running `e2e/setup` against an old stack, or tearing down a developer's own stack | The single-use fresh-stack marker; `core-up` refuses an existing `soorma-local` project |
| A moved `contract-v0.1.0` tag | `core-up` and the drift check both fail unless the commit is `c1e3d7f3…` |

## 6. Extension Compliance

### security-baseline (deployment `local-only`)

| Rule | Status | Rationale |
|---|---|---|
| SECURITY-01 | Compliant (in transit) / N/A for the milestone, carried (at rest) | TLS always on, no switch (C-15); at rest: the SDK stores nothing (credential in memory only) |
| SECURITY-02 | N/A for the milestone, carried | No network intermediary |
| SECURITY-03 | Compliant | No secret, credential or payload in logs (C-14, C-15, C-20) |
| SECURITY-04 | N/A | No web application |
| SECURITY-05 | Compliant | Inputs to the SDK are typed; the platform validates every request (FR-16: the SDK enforces nothing) |
| SECURITY-06 | N/A | No access policy deployed; CI permissions read-only by default (C-06) |
| SECURITY-07 | N/A for the milestone, carried | No network deployed |
| SECURITY-08 | N/A | No server-side access control in a client; enforcement is the platform's (PF FR-023) |
| SECURITY-09 | Compliant | No verification switch; the stack's CA added, never replacing verification |
| SECURITY-10 | Compliant at design; SBOM carried | Pinned actions and lock files (C-06, NFR-07); SBOM owed by the first published release |
| SECURITY-11 | Compliant | Security-critical logic isolated in C-13 and C-14; misuse cases in §5; rate limiting N/A (no public endpoint) |
| SECURITY-12 | Compliant | No hardcoded secret; secrets from a provider, never an environment variable; no password, session or login in the SDK |
| SECURITY-13 | Compliant at design | The contract copy and the soorma-core checkout are verified by commit (`PIN`, AD-10) |
| SECURITY-14 | N/A for the milestone, carried | No deployed service to alert on |
| SECURITY-15 | Compliant at design | Every error surfaced as a typed error; every error path releases its resources (FR-13); fail closed on secret checks |

### soorma-platform-invariants (inherited from PF §15 and ID §15: I1 to I11 Addressed)

| Invariant | Status | Rationale |
|---|---|---|
| I1 Isolation | Compliant | No environment configured or inferred; the credential carries scope (C-12) |
| I2 Perimeter enforcement | Compliant | The SDK enforces nothing; every check is the platform's (§4) |
| I3 Portable credential | Compliant | Credential presented as given; no identifier derived from the host (AD-06) |
| I4 Attribution recoverable | Compliant | Forwarded envelope byte for byte (C-16, C-18); trace context on every draft |
| I5 Monotonic authority | Compliant | No delegation; no stamped field; forwarding passes the platform's sealed envelope only |
| I6 Two faces | Compliant | No control-face or human operation in the packages; checked again at Units Generation through the unit shapes |
| I7 Contract compatibility | Compliant | Types from the pinned copy; unknown fields, values and codes tolerated and preserved |
| I8 Packaging rule | Compliant | Apache 2.0 client; no commercial code; no capability unassigned by the PRD |
| I9 Mechanism, not instance | Compliant | No soorma-defined span names; no tenant-specific behaviour |
| I10 Runtime-later | Compliant | Nothing read from deployment metadata; runs on the tenant's own compute |
| I11 No technology selection | N/A for this stage | Library choices are NFR Requirements' and are this repository's to make (PF contains none) |

### Other extensions

- **pr-checkpoint**: no gate at this stage; the Inception PR gate follows Tickets
- **qa-test-cases**: the inception pass follows Units Generation
- **tickets**: issues are generated at the end of Inception

## 7. Specification-Gap Pass

No new specification gap. Every question this stage met was a technology or design choice that
no PRD makes and the contract leaves to the client:

| Question | Class | Settled by |
|---|---|---|
| Package and import names | Technology | AD-02 (the user) |
| The secret provider shipped and its checks | Technology | AD-07 (the user) |
| The default instance identifier (T-5) | Technology | AD-06 |
| How CI runs soorma-core | Technology | AD-10 to AD-13 (the user) |
| Forwarding hop's span relation (US-Q1) | Inside soorma-sdk GAP-INT-002's work-around | Functional Design, deferred |

soorma-sdk GAP-INT-001 and GAP-INT-002 are unchanged; C-17 and C-19 carry their work-arounds.
