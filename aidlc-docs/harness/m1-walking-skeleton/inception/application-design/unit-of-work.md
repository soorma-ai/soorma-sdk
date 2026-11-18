# Units of Work — soorma-sdk, M1

**Answers**: Q1 A, Q2 A, Q3 A, with the user's additions to U1's and U2's *done when* (audit
2026-11-18T06:05:15Z). Follow-up Q1a answered at approval (2026-11-18T06:14:40Z): U2 expects `200`, per the
contract.

**Build order**: U1 → U2 → U3 → U4. The language-neutral layer first, then TypeScript, then
Python (D-01). Each unit is designed and built in full (design stages, then code) before the
next starts.

| Unit | Name | Shape | Components | Stages |
|---|---|---|---|---|
| U1 | `contract-and-conformance` | ordinary | C-01, C-02, C-03, C-04; C-06 (checks, conformance job) | FD, NFR Req, NFR Design, QA enrichment, design PR, Code Gen and code PR |
| U2 | `e2e-stack` | ordinary | C-05; C-06 (end-to-end job skeleton) | FD, NFR Req, QA enrichment, design PR, Code Gen and code PR. **NFR Design skipped** (Q3 A), reinstated if NFR Requirements finds a pattern to design |
| U3 | `typescript-harness` | harness | C-10 to C-22, TypeScript; C-06 (TypeScript and its end-to-end job) | FD, NFR Req, NFR Design, QA enrichment, design PR, Code Gen and code PR |
| U4 | `python-harness` | harness | C-10 to C-22, Python; C-06 (Python and its end-to-end job) | FD, NFR Req, NFR Design, QA enrichment, design PR, Code Gen and code PR |

Infrastructure Design is skipped for every unit (Workflow Planning): nothing is deployed and
nothing is published. It comes back for a unit whose Functional Design finds infrastructure.

---

## Unit Shapes (Step 2.5)

The brief's soorma-sdk column (`0aad84a`) *Builds* "the harness operations in PF §11 *Harness
Surface*: acquire, renew, hold-and-present, draft envelope, populate trace context, forward
inbound context" and "trace emission"; *Owns* "nothing the platform depends on". So: **no
plane face** (no server-side operation is built here) and **no contract unit** (the contract is
soorma-core's; this repository consumes it at `contract-v0.1.0`).

| Unit | Shape | Why |
|---|---|---|
| U1 | **ordinary** | The conformance suite and what it judges against (the contract copy, the specification, the checks): built and owned here, called by no agent, calling no face. D-14 (RA Q1 X) |
| U2 | **ordinary** | **Changed from harness at the user's direction** (Units Generation Q1 A, audit 2026-11-18T06:05:15Z): test infrastructure that makes raw control-face calls and that no agent code links. D-14 otherwise holds |
| U3 | **harness** | The PF §11 operations and trace emission, in TypeScript: client side, enforcing nothing (PF FR-023) |
| U4 | **harness** | The same operations, in Python |

**Superseded**: intake's "harness only" (intake Q1 A) by D-14 at Requirements Analysis, and
D-14's "every other unit is harness" by this stage's Q1 A for U2.

---

## U1 — `contract-and-conformance` (ordinary)

**Purpose**: the language-neutral layer every language is built and judged against: written
once.

**Components**: C-01 contract copy and `PIN`; C-02 behaviour specification and name table;
C-03 conformance cases, scripted platform stub, runner; C-04 repository checks (contract drift,
generated types, names, SPDX); the CI jobs for the checks and for conformance.

**Responsibilities**:
- vendor `contract/` from soorma-core at `contract-v0.1.0` (`c1e3d7f3…`), with `PIN` and the
  drift check (FR-01)
- **write the whole behaviour specification** (Q2 A): every PF §11 operation, trace emission
  and **its span rules**, the Problems surfaced, retries, stream boundaries, the deep-payload
  fallback, exact forwarding, `fileSecret`'s rules, live-only delivery, and the complete name
  table (FR-02, FR-17)
- write the cases that check each statement, from the contract's fixtures; build the stub and
  the runner; define the driver protocol in full (FR-03)
- **decide US-Q1** in its Functional Design, as a span rule of the specification (Q2 A)

**Done when** (the user's addition, Q1 A):
- the runner, the stub and every case exist, and each specification statement names its cases
- **U1 proves its own runner**: a **test-only reference driver**, written against the stub,
  passes every case it covers. It is part of neither package
- **negative controls**: a driver that breaks a rule makes the runner fail, **naming the case**.
  At least these broken rules are covered:
  1. it retains the secret
  2. it reorders the forwarded envelope's text
  3. it retries a publish
  4. it skips a stream boundary item
- **U1's code PR shows all of them in CI**: the reference driver passing, and each negative
  control failing on its named case
- the drift, generated-types (once a language commits types), names and SPDX checks run in CI

**Carried items**: US-Q1 (decided here); CDI-01 (the specification states `credential.environment`
read only; FR-15); CDI-02 (**defined here**: the driver's `inspect` checks the runtime: TypeScript
heap snapshot after forced GC, Python `sys.getrefcount`); CDI-03 (the specification states
`fileSecret`'s non-blocking open and refusal of special files).

**Inherited gaps**: soorma-sdk GAP-INT-001 (the specification states live-only delivery, no
continuity across boundaries; the cases check it); soorma-sdk GAP-INT-002 (the span rules under
the work-around: OpenTelemetry API only, messaging semantic conventions, no soorma-defined
name or attribute, no exporter, unstable shape; US-Q1).

**Stories**: US-12, US-13, US-14 #1 to #3; the specification statement and case behind every
`[C]` criterion of US-01 to US-10.

**Requirements**: FR-01, FR-02, FR-03, FR-17; NFR-05 (cases), NFR-07, NFR-09, NFR-10, NFR-11.

---

## U2 — `e2e-stack` (ordinary)

**Purpose**: a fresh soorma-core at `contract-v0.1.0` with agents A and B registered, in CI and
locally, proven before any language uses it.

**Components**: C-05 (`e2e/core-up`, `e2e/setup`, `e2e/core-down`); the CI end-to-end job
skeleton: triggers on pull requests and pushes to `dev`, not `main`; the `changes` job and the
job-level `aidlc-docs/` skip; a fresh stack per job.

**Responsibilities**: AD-10, AD-11, AD-12: clone at the tag and check the commit; build S1 to S4;
`stack:init`, `stack:up`; the single-use fresh-stack marker; the human steps as raw calls;
A and B registered in environment `e`; each secret in a `0600` file in a `0700` directory; no
human secret or credential written; `down -v` at the end, always.

**Done when** (the user's addition, Q1 A):
- **U2 proves the stack before U3 uses it.** U2's CI job runs `core-up`, then `setup`, then
  **one raw `POST /agent-credentials` per agent** using the secret file `setup` wrote,
  expecting **the contract's success response, `200`** (Q1a, answered), then `core-down`
- the raw calls stay **outside both packages**; the job **prints no secret or credential**
- **AD-13's CI time is first measured on U2's code PR**, with the **run ID recorded** in this
  initiative

**Q1a, answered**: `200`, per the contract (`exchangeBootstrap` at `contract-v0.1.0`,
`data-gateway.openapi.yaml`). The user confirmed that "201" in their addition was their error.

**Carried items**: none. **Inherited gaps**: none: the stack is soorma-core's, used as built.

**Stories**: US-11 #1 (the set-up its README names), US-14 #4 (with U3 and U4).

**Requirements**: FR-19 step 1; D-12; NFR-07 (pinned toolchains), NFR-06 (nothing printed).

---

## U3 — `typescript-harness` (harness)

| Field | Value |
|---|---|
| Capability | The PF §11 harness operations and trace emission, in TypeScript |
| Shape | harness |
| Face | **none**; calls the environment's **data** face only: S3 `data-gateway` (acquire, renew) and S4 `event-ingest` (publish, subscribe; drafts, trace context and forwarded context travel in S4 requests). Never S1 or S2 |
| NFR profile source | PF §11 *Harness Surface*; PF §14 *Harness Surface Register* @ `prd-platform-foundations-v1.3`. Values the PRD leaves open (renewal headroom, the retry bound, the depth bound, request-path overhead) are asked at NFR Requirements |
| Edition | `core` (Apache 2.0) |
| Target repository | `soorma-sdk` |
| Operations (from PRD) | Acquire credential; renew credential; hold and present credential; draft envelope; populate trace context; forward inbound context; and trace emission |

**Components**: C-10 to C-21 in TypeScript (`typescript/`: the package `@soorma/sdk`, its
conformance driver); C-22 (the TypeScript example and end-to-end test); CI: Node 24 and 26, and
the TypeScript end-to-end job on U2's skeleton.

**Responsibilities**: implement the specification (U1) in TypeScript, including **US-Q1's rule
in C-19** (Q2 A); its Functional Design maps the specification to TypeScript and settles only
what is TypeScript's: the depth bound's mechanism, `fileSecret` on Windows (CDI-03), the
resource-management idiom.

**Done when**: every conformance case passes through the TypeScript driver on Node 24 and 26;
the end-to-end scenario passes on U2's stack (*done when* 2, 3, 5): **M1's proof**; the example
runs, and its agent file copies into a new project (US-11 #2).

**Carried items**: US-Q1 (implements U1's rule); CDI-01 (`credential.environment` read only);
CDI-02 (its driver's `inspect`, as U1 defines it); CDI-03 (`fileSecret`).

**Inherited gaps**: soorma-sdk GAP-INT-001 (C-17: boundaries surfaced, no continuity; example
README: live only); soorma-sdk GAP-INT-002 (C-19 under the work-around; the end-to-end test's
in-memory exporter; example README: unstable span shape).

**Stories**: US-01 to US-11 (US-11 #2 is TypeScript only, by design).

**Requirements**: FR-04 to FR-16, FR-18, FR-19, FR-20; NFR-01 to NFR-08.

---

## U4 — `python-harness` (harness)

| Field | Value |
|---|---|
| Capability | The PF §11 harness operations and trace emission, in Python |
| Shape | harness |
| Face | **none**; calls the **data** face only (S3, S4), as U3 |
| NFR profile source | PF §11 *Harness Surface*; PF §14 *Harness Surface Register* @ `prd-platform-foundations-v1.3` |
| Edition | `core` (Apache 2.0) |
| Target repository | `soorma-sdk` |
| Operations (from PRD) | As U3 |

**Components**: C-10 to C-22 in Python (`python/`: the distribution `soorma`, its conformance
driver, example and end-to-end test); CI: Python 3.11 and the newest release, and the Python
end-to-end job.

**Responsibilities, done when, carried items, inherited gaps**: as U3, in Python; US-11 #3 in
place of #2. Its NFR Requirements sizes the Python depth bound (NFR-03).

**Stories**: US-01 to US-11 (US-11 #3 in place of #2).

**Requirements**: as U3.

---

## Code Organization (greenfield; AD-01)

```text
soorma-sdk/
├── contract/                 U1  vendored @ contract-v0.1.0, PIN
├── spec/                     U1  behaviour.md, names.md
├── conformance/              U1  cases/, stub/, runner/, reference-driver/ (test only)
├── tools/                    U1  checks
├── e2e/                      U2  core-up, setup, core-down
├── typescript/               U3  package @soorma/sdk; conformance-driver/; examples/; e2e test
├── python/                   U4  distribution soorma; conformance_driver/; examples/; e2e test
├── .github/workflows/        U1 (checks, conformance), U2 (e2e skeleton), U3, U4 (their jobs)
└── aidlc-docs/               documentation only
```

`.e2e/` (the soorma-core clone) and each example's `.secrets/` are git-ignored. Application
code never goes in `aidlc-docs/`.

---

## Checks at This Stage

**Invariant I6 (two faces), through the unit shapes**: no unit is a plane face. U3 and U4 call
the data face only (S3, S4) and offer no control-face or human operation. U2 calls S1 and S2,
the control faces, by raw calls in test infrastructure that no agent code links; that is why
it is ordinary, and nothing of it enters either package. **Compliant.**

**Boundaries**: each component sits in exactly one unit per language (C-01 to C-05 once; C-10
to C-22 once in U3 and once in U4; C-06's jobs split by owner). No dependency cycle.

**Specification-gap pass**: no new specification gap. Q1a is a conflict between an answer and
the contract, resolved by the contract (`200`), not a gap: the contract states the status.
