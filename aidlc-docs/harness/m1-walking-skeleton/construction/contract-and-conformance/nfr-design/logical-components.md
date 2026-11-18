# Logical Components — U1 `contract-and-conformance`

U1 deploys nothing. Its components are tooling modules in the pnpm workspace, the vendored
contract, the specification documents, and CI jobs. Each lists the patterns
([nfr-design-patterns.md](nfr-design-patterns.md)) and NFRs it carries. Paths follow AD-01;
exact file names are Code Generation's.

---

## 1. Data, Not Code

| Component | Location | Carries |
|---|---|---|
| Vendored contract | `contract/` (byte-identical to the tag) | FR-01; NFR-U1-10 |
| `PIN` | `contract/PIN` (tag, peeled commit, tree id, SHA-256 per file) | NFR-U1-10, -11 |
| Contract note | `contract.md` at the root: never edit `contract/`; raise against soorma-core | FR-01; US-12 #3 |
| Behaviour specification | `spec/behaviour.md` (statements from business-rules.md, ids unchanged) | FR-02; NFR-U1-33 |
| Name table | `spec/names.md` | FR-17 |
| Case files | `conformance/cases/{area}/CC-*.json` | FR-03; NFR-U1-33, -34 |
| Reference coverage | the reference driver's declared case list | DEC-U1-08 |

## 2. The Conformance Runner (`conformance/runner/`)

| Module | Responsibility | Carries |
|---|---|---|
| **Loader** | reads statements and cases; validates case files (shape, timeouts, window margins) | P-02, P-03 |
| **Link and fixture checks** | every statement has a case (or an exemption); every case's statements exist; every agent-side fixture referenced | FR-02, FR-03 |
| **Scheduler** | one case at a time; a new driver process per case; per-case timeout; run watchdog at twice the budget | P-01, P-02 |
| **Driver host** | spawns the driver, speaks the JSON-lines protocol, captures stderr, kills on timeout or protocol error | P-01; NFR-U1-09 |
| **Evaluator** | every assertion kind (request-exact, -shape, -count, -timing, observation, item-sequence, runtime-check, span, surface, absence); request matchers on `ajv` 2020-12 with negative fixtures | FR-03; business-logic-model §2.3 |
| **Reporter** | per case pass, fail (expectation, detail) or not run; durations; slowest cases on a budget breach; secrets as lengths only | P-02, P-04; NFR-U1-04 |
| **Mode and flag guard** | `full`, `reference`, `reference --fault X`; `--local-skip CC-SEC-05` locally only, refused in CI | P-07; NFR-U1-15, -16 |
| **Run directory** | per-run `0700` temporary directory; secrets, files, CAs; removed at the end | P-04 |
| **CA maker** | two CAs and server certificates through the `openssl` CLI (P-256) | P-04; TS-U1-07 |
| **CI user helper** | in CI only: creates the second local user (`sudo`) and hands the runner its uid for CC-SEC-05; absent locally (no `sudo` in local set-up) | NFR-U1-14, -17 |

## 3. The Stub (`conformance/stub/`)

| Module | Responsibility | Carries |
|---|---|---|
| **Listeners** | S3, S4, untrusted, stray; loopback only; TLS from the run's CAs | P-05; NFR-U1-20, -21 |
| **Script engine** | matches each request to the next exchange; unmatched requests answered `500` and fail the case | business-logic-model §2.1 |
| **SSE writer** | `delivery` (text exactly as scripted), heartbeats, `end`, `drop`, `silence`, `waitFor` | FR-11 cases |
| **Fault injector** | `refuse N`, `reset` (read the whole request, then destroy the socket) | P-05; PRB-08, PRB-09 |
| **Recorder** | method, path, headers, raw body bytes, time, connection, *answered: none* for resets, stream closes | FR-03 |
| **Payload generator** | `deepPayload(depth)` from the driver's reported bound | D-07; RCV-06 |

## 4. The Reference Driver (`conformance/reference-driver/`)

| Module | Responsibility | Carries |
|---|---|---|
| **Protocol handler** | the commands of business-logic-model §3, against the stub, over HTTPS and SSE | DEC-U1-08 |
| **Declared coverage** | the 23 R cases | U1 *done when* |
| **Fault switches** | `retain-secret`, `reorder-forwarded-envelope`, `retry-publish`, `skip-boundary`: one per run | business-logic-model §5.2 |
| **Test spans** | `@opentelemetry/sdk-trace-base` with an in-memory exporter; reference driver only | TS-U1-08 |
| **Runtime check** | heap snapshot after forced GC (`--expose-gc`), searching every string for the value and its halves | CDI-02; NFR-U1-22 |

Private package; never a dependency of either SDK package (P-10's packaging guard).

## 5. Repository Checks (`tools/`)

| Check | Responsibility | Carries |
|---|---|---|
| **Contract drift** | local half; remote half by `git ls-remote` and a `--depth 1` fetch; `--offline` locally only, refused in CI | P-09, P-07; NFR-U1-10 to -13 |
| **Generated types** | regenerate each package's types from `contract/` and compare (inert until U3) | FR-01; US-12 #2 |
| **Names** | each driver's `names` and `surface` against the name table (inert until U3) | FR-17; US-13 #3 |
| **SPDX** | `SPDX-License-Identifier: Apache-2.0` in every source file; `contract/` exempt | NFR-09; NFR-U1-36 |
| **Workflow check** | SHA pins with tag comments, `ubuntu-24.04`, `contents: read` | P-10; NFR-U1-28 |
| **Packaging guard** | no test-only code in a package's file list or dependencies (inert until U3) | P-10; NFR-U1-23 |
| **DCO module** | `check()` with injected readers; its Vitest suite with a local git repository and recorded API responses | P-08; NFR-U1-29 to -32 |

## 6. CI (`.github/`)

| Component | Contents | Carries |
|---|---|---|
| `workflows/ci.yml` | jobs `checks`, `unit`, `conformance-self-test`, `dependency-review` (tech-stack-decisions.md); triggers: pull requests and pushes to `dev` | NFR-U1-01, -02, -24 to -28 |
| `workflows/dco.yml` (rewritten) | `actions/checkout` and `actions/github-script` pinned by SHA; `ubuntu-24.04`; `contents: read`; calls the DCO module | P-08; NFR-U1-29 to -31 |
| `dependabot.yml` | npm and github-actions; weekly; 7-day cooldown; `target-branch: dev` | NFR-U1-27 |
| Toolchain pins | `.node-version` (Node 24, exact patch); `packageManager` (pnpm, exact) | NFR-U1-24 |

## 7. Requirements Coverage

Every NFR-U1 requirement is carried by at least one component above:

| NFRs | Components |
|---|---|
| 01 to 04 | Scheduler, Reporter, `ci.yml` |
| 05 to 09 | Loader, Scheduler, Driver host, Reporter, Run directory |
| 10 to 13 | Contract drift check, `PIN`, Mode and flag guard pattern (P-07) |
| 14 to 18 | CI user helper, Mode and flag guard; Windows unsupported (no component) |
| 19 to 23 | Run directory, CA maker, Listeners, Reference driver runtime check, Packaging guard |
| 24 to 28 | Toolchain pins, `ci.yml`, `dependabot.yml`, Workflow check |
| 29 to 32 | DCO module, `dco.yml` |
| 33 to 36 | Specification, case files, Evaluator, Vitest suites, SPDX check |
