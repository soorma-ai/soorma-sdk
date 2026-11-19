# NFR Requirements — U3 `typescript-harness`

**Answers**: U3-NFR-Q1 to Q8, all A; Q4 with the user's detail (audit 2026-11-19T04:55:32Z).
**Shape**: harness, seeded from PF §11 *Harness Surface* and §14 *Harness Surface Register* @
`prd-platform-foundations-v1.3` (Step 1.5).

**Sources**:
- the initiative's NFR-01 to NFR-11 (requirements.md §4);
- U3's Functional Design (rules cited by id; approved as revised in `8c65ed1`);
- CDI-06;
- the security baseline (`local-only`);
- U1's repository rules (NFR-U1-24 to -28) and U2's (NFR-U2-13).

## The Harness Profile, Carried (PF §11, §14)

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U3-01 | **Advisory only.** No SDK check is one the platform relies on. A tenant bypassing the SDK reaches identical enforcement. The SDK adds **no server-side property**: no enforcement, durability or availability of a face | PF §11 *Advisory-only assertion*; NEV-04; Step 1.5 | CC-RCV-08; U2's raw `prove-stack` on the same stack; the I2 review |
| NFR-U3-02 | **Additive compatibility, as a consumer**: `clientContractVersion` `0.1.0` exactly. Unknown fields, enumerated values, Problem codes and `end` codes are tolerated. Unknown envelope fields are preserved and forwarded byte for byte | PF §14; NFR-05; I7 | CC-RCV-03, CC-FWD-02, CC-PRB-01, CC-STR-03 |
| NFR-U3-03 | **The renewal precondition** (a still-valid credential) is the contract's. The SDK renews before expiry by `H_renew`, never from a hard-coded lifetime. On a skewed lineage, S3 decides validity (REN-07, CDI-06) | PF §14; NFR-02 | CC-REN-01 to 07 |

## Performance on the Request Path

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U3-04 | **No round trip beyond the operation's own.** A publish makes exactly one request. Renewal runs on its own timer, never on a publish's or subscribe's path. A bootstrap precedes an operation only when REN-06 says so, never on a skewed lineage (REN-07) | NFR-01; U3-NFR-Q8 | The cases' request counts (CC-PUB-01, CC-REN-01, CC-REN-07); TC-TH-007, 032 |
| NFR-U3-05 | **No blocking work beyond the request's own**: the payload check, serialization and the delivery-line scan are linear in their input, with no recursion in the scanner or the payload check. **No timing benchmark in M1** | NFR-01; U3-NFR-Q8 | Code review at Code Generation; unit tests over large and deep inputs |

## The Named Values (spec §0; U3-NFR-Q1 A)

| Name | Value | Reason |
|---|---|---|
| `H_renew` | **120 s** | Room for the retry bound (`W_max` + `T_req` = 70 s) and for the replacement stream before expiry (STR-04). At least 1 minute, as the end-to-end offset needs (business-logic-model §3) |
| `R_min` | **30 s** | REN-07's floor: well under the 15-minute lifetime. The end-to-end test's renewal wait is about 1 minute |
| `R_max` | **5 attempts** | Bootstrap, renewal, subscribe (PRB-05, PRB-08, PRB-09) |
| `W_max` | **60 s** | Total wait of a retried operation, `Retry-After` included |
| `B_init`, `B_factor`, `B_cap` | **0.5 s, 2, 10 s** | Backoff without `Retry-After`; no jitter, as the specification states none |
| `L_ends` | **5** | Consecutive stream ends with no Delivery before the subscription is terminal |
| `W_super` | **10 s** | The wait for the old stream's `superseded` |
| `N_buf` | **64 items** | The pull buffer, held Deliveries included |
| `D_lang` | **512 levels** | The payload parse-depth bound: `JSON.parse` stays far from Node's stack limit |
| `T_idle` | **45 s** | Three of the platform's 15-second heartbeats |
| `T_req` | **10 s** | The wait for a response head |

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U3-06 | The values above are **constants in one module** (`limits.ts`), read by every component. The driver's `describe` reports them all, `R_min` included, and the cases read them from there | Spec §0; U3-NFR-Q1 | CC-* via `describe`; a unit test pinning the table |

## Reliability

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U3-07 | **One retry policy** for bootstrap, renewal and subscribe (PRB-05, PRB-08, PRB-09): `Retry-After` first, else backoff; at most `R_max` attempts and `W_max` total wait; the last error surfaced. **A publish is never retried**, and neither are `429`, any other `4xx`, `500`, or a TLS failure | D-11; NFR-04 | CC-PRB-04 to 06, CC-PRB-08, CC-PUB-03 |
| NFR-U3-08 | **One validity check** (CDI-06), used by REN-06's bootstrap, the `503` retry on renewal, PRB-09's renewal retry and the stream resubscribe. On a warned lineage it answers valid until S3 says `credential_expired`; otherwise it uses the wall clock. **Nowhere else compares `expiresAt` with `Date.now()` to decide validity** | CDI-06; REN-07 | Unit test (a skewed lineage: a `503` on renewal retried, a dropped stream resubscribed, no bootstrap); a lint or search check at Code Generation |
| NFR-U3-09 | **Every error path releases its resources**: requests aborted, streams closed, timers cleared. `close()` is idempotent and complete. The renewal timer is `unref`'d | PRB-07; SECURITY-15; TH-LIFE | CC-PRB-07; TC-TH-054, 071 |
| NFR-U3-10 | **No unhandled rejection**: every promise the SDK creates is awaited or has a handler. A failure in the background (renewal, stream) surfaces on the next operation or as an item (DEC-U1-05) | SECURITY-15 | Unit tests run with `--unhandled-rejections=strict`; the driver fails on one |

## Security

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U3-11 | **TLS always verified**, trusting the **OS store, plus Node's bundled store, plus the supplied CA**: `tls.getCACertificates('system')` ∪ `tls.getCACertificates('bundled')` ∪ the CA file. On this machine (macOS), Node reads 0 system certificates and 118 bundled ones, so the bundled store keeps public TLS working where the OS store is not read. No option turns verification off | CFG-04; U3-NFR-Q3 A; SECURITY-01 (in transit) | CC-CFG-04; TC-TH-003, 004 |
| NFR-U3-12 | **No secret, credential or payload** in any log, error message, exception text or string form (`toString`, `toJSON`, `util.inspect`). The SDK writes no log. Its one diagnostic is REN-07's warning, which holds no credential | NFR-06; SECURITY-03; CRD-04 | CC-CRD-02; TC-TH-021; a unit test inspecting every error and the client |
| NFR-U3-13 | **The secret is not retained**: no reference after the bootstrap request is written, shown by U1's heap check | SEC-02; CDI-02 | CC-SEC-01 |
| NFR-U3-14 | **REN-07 bounds both floods**: renewals at most one per `R_min`, and on a warned lineage no bootstrap before an operation. A skewed client then costs S3 at most one renewal per 30 s, and one bootstrap per lineage | REN-07 (the user); SECURITY-11 | CC-REN-06, CC-REN-07 |
| NFR-U3-15 | **The CI conformance job runs CC-SEC-05**, a secret file owned by another user. CI creates the second local user with `sudo useradd` and passes `--foreign-user`; `--local-skip` stays refused in CI | OBL-04; NFR-U1-14, -16 | The `conformance-typescript` job's report: CC-SEC-05 passed, not skipped |

## Supply Chain

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U3-16 | **One runtime dependency**: `@opentelemetry/api` as a **peer dependency** `^1.9.0` (the tenant's copy, one global). It is tested at exactly **1.10.0** (a development dependency, as locked) and at **1.9.0**, the range's floor. Nothing else at run time: `node:https`, `node:tls`, `node:crypto` and `node:fs` are built in | U3-NFR-Q2 A, Q6 A; NFR-07; SECURITY-10 | The package manifest; the lock file; the 1.9.0 conformance run |
| NFR-U3-17 | **Messaging conventions pinned at OpenTelemetry semantic conventions 1.45.0** (released 2026-11-06, past the cooldown), their attribute names as constants in `tracing.ts`, with no dependency on `@opentelemetry/semantic-conventions` | SPN-01; U3-NFR-Q6 A | CC-SPN-01 |
| NFR-U3-18 | U1's dependency rules apply unchanged (NFR-U1-24 to -27): exact versions, the 7-day cooldown, no install scripts, `pnpm audit`, Dependabot, dependency review. A peer range is a compatibility declaration, not an install | NFR-U1-24 to -27 | CI |

## The Package (TC-TH-058, TC-TH-065)

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U3-19 | **ESM only, built with `tsc`**: `typescript/` with `src/` and `dist/` (JavaScript and `.d.ts`), `"type": "module"`, `engines.node` `>=24`, and the files `dist/`, the README and the licence files. **The `exports` map has `"types"` first, then a `"default"` entry**, never an `"import"` entry alone. Node 24's `require()` of ESM resolves with the `"require"` condition, so `require('@soorma/sdk')` must find `"default"` (the user, U3-NFR-Q4) | U3-NFR-Q4 A | `package-typescript` (NFR-U3-22) |
| NFR-U3-20 | **The generated types (C-10)** come from a script reusing the vendored generator (`contract/scripts/generate-types.ts`). They are the agent side only (`components`, `data-gateway`, `event-ingest`), with the envelope and delivery types having **every envelope member optional**. No S1 or S2 type. Committed, and checked by U1's generated-types check, with `typescript/` added to `tools/generated-types/packages.json` | U3-NFR-Q5 A; CDI-04; NEV-01 | `pnpm checks`; TC-TH-057, 069 |
| NFR-U3-21 | **The packaging guard** lists `typescript/`: no `conformance/`, `tools/` or `e2e/` in its files or dependencies. It also runs over the packed tarball's file list | I8; NFR-U2-21 | `pnpm checks`; `package-typescript` |
| NFR-U3-22 | **`package-typescript` proves the package outside the workspace**. It packs the tarball (`pnpm pack`) and installs it into a fresh project. In that project:<br>- **one ESM file `import`s `@soorma/sdk` and one CommonJS file `require()`s it**, each constructing an `AgentClient`, which contacts nothing;<br>- the example's agent file is copied in, type-checked and imported (US-11 #2) | U3-NFR-Q4 (the user's detail), Q7 A; TC-TH-058, 065 | The job |

## Testing and CI

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U3-23 | **`conformance-typescript`**: a matrix over Node **24 and 26** (and the `@opentelemetry/api` 1.9.0 run, NFR-U3-16). It builds the package and runs the TypeScript driver through every case: the 90, plus CC-REN-06 and CC-REN-07. The second user is created (NFR-U3-15). Within U1's 8-minute suite budget per run (NFR-U1-02). A failing case is judged first, SDK or case (CDI-05) | NFR-08; FR-03; U3-NFR-Q7 A | The job; TC-TH-059 |
| NFR-U3-24 | **`e2e-typescript`** (JOB-06): U2's `e2e` job renamed, with the scenario after `prove-stack` (kept), on **Node 24**. Its time is measured on U3's code PR. **Over 8 minutes reopens this stage** (AD-13). The expected added time is about 2 minutes: the renewal wait (about `2 × R_min`) and the scenario | JOB-06; AD-13; U3-NFR-Q7 A | The code PR's run, recorded |
| NFR-U3-25 | **The package's unit tests** (Vitest) run in the `unit` job: the scanner, the payload check, the renewal schedule with a fake clock, CDI-06's test, the span rules, TH-LIFE | NFR-10 | The `unit` job |
| NFR-U3-26 | Every job keeps U1's workflow rules (SHA pins, `ubuntu-24.04`, `contents: read`). The `e2e-*` jobs reference no secret and upload nothing from `.e2e/` (U1's workflow check, as U2 strengthened it) | NFR-U1-28; NFR-U2-13 | `pnpm checks` |

## Usability

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U3-27 | **The package README** documents:<br>- the client, configuration and errors;<br>- `fileSecret`'s file settings (Kubernetes `defaultMode: 0440` with `fsGroup`; Docker `0400` or `0440`), and that Windows tenants supply their own provider;<br>- delivery is live only;<br>- the span shape is unstable, with DEC-U1-01's deviation;<br>- REN-07's clock-skew warning and what to do about it (fix the clock);<br>- Node 24 or later, ESM, and `require()` support | FR-20; US-11; SPN-06; SUB-03 | Review at Code Generation; TC-TH-066 |

## Security Compliance, Per Clause (SECURITY-12)

SECURITY-12 is **not N/A as a whole** (the user, at this stage's approval). Its clauses:

| Clause | Outcome | Rationale |
|---|---|---|
| Password policy | N/A | Server-side: the SDK authenticates no user and holds no password |
| Credential storage (adaptive hashing) | N/A | Server-side: the SDK stores no password. The agent credential is held in memory only, opaque, and never written (CRD-01) |
| Multi-factor authentication | N/A | Server-side: no user login in a client library |
| Session management (expiry, invalidation, cookie attributes) | N/A | Server-side: no sessions or cookies. The credential's expiry is the platform's, and the SDK uses no cookie (contract *No cookies*) |
| Brute-force protection | N/A | Server-side: S3 bounds bootstrap attempts (`too_many_attempts`). The SDK never retries `429` or `403` (PRB-06), and REN-07 bounds its renewals and bootstraps |
| **No hardcoded credentials** | **Compliant** | Secrets come only through a provider (`fileSecret`, or the tenant's own function; SEC-01, SEC-03). The example's configuration block names a **secret file**, never a secret (TH-E2E-01). The lint rule refuses `process.env` in the package (TS-U3-13). Tests and fixtures use generated or clearly fake values (U1's `soorma_ac_token.one`-style fixtures; U2's and U3's per-run secrets) |

The other rules' outcomes are in the stage's completion message, and in NFR Design's compliance
summary.

## NFR Design: Runs for U3

**It runs**, as the execution plan has it. Unlike U2, U3 has patterns the requirements fix but do
not yet shape:
- **the single retry policy** (NFR-U3-07);
- **the single validity check** across four callers (NFR-U3-08, CDI-06);
- **the subscription supervisor's state machine**: replacement, held Deliveries, `W_super`, `L_ends`, backoff and `T_idle` (DEC-U1-03, -04, -12);
- **the clock seam that lets tests drive both clocks**, wall and monotonic, without a hook in the public API;
- **the trust-store composition** (NFR-U3-11);
- **the CI user helper** (OBL-04).

NFR Design decides how each is built, where it lives, and how it is tested.
