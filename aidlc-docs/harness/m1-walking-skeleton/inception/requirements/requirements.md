# Requirements — soorma-sdk, M1 Walking Skeleton (harness)

**Initiative**: `harness/m1-walking-skeleton` · **Repository**: `soorma-sdk` · **Milestone**: M1
**Built against**: PF @ `prd-platform-foundations-v1.3`, ID @ `prd-identity-v1.0`; slice brief @ `0aad84a`
**Consumes**: soorma-core wire contract @ `contract-v0.1.0` (pre-release; peels to `c1e3d7f3`)
**Depth**: Standard, with traceability to PRD requirements and *done when* items
**Sources**: [prd-coverage-map.md](../prd-intake/prd-coverage-map.md); answers logged in `audit.md` (2026-11-18T02:37:58Z)

> The PRDs state the target. These requirements add only what the PRDs leave to
> engineering: technology, delivery, and the client-side behaviour the contract permits.
> Nothing here may contradict PF or ID; a conflict is a specification gap, not a choice.

---

## 1. Intent Analysis

| | |
|---|---|
| **User request** | Build soorma-sdk's part of M1 from the slice brief: the PF §11 harness operations and trace emission, proving *done when* 2, 3 and 5 through the SDK against a running soorma-core |
| **Request type** | New project (greenfield client library) |
| **Scope estimate** | Multiple components: a language-neutral layer (contract copy, behaviour specification, conformance suite) and two language packages |
| **Complexity estimate** | Moderate to complex: two languages with one behaviour, streaming, credential lifecycle, exact-bytes forwarding, a deep-payload fallback |
| **Request clarity** | Clear; scope fixed by the brief and the contract |

**Outcome this initiative delivers.** An agent developer, in TypeScript or Python, bootstraps
an agent instance, keeps its credential renewed, publishes and subscribes, forwards inbound
context exactly, and sees a trace emitted, against a running soorma-core, with nothing in the
SDK acting as enforcement.

**Done criteria**:
- **M1's done when 2, 3 and 5 need one language.** They are proven by the TypeScript
  package (built first)
- **This initiative's Build and Test requires both languages** to pass the conformance suite
  and the end-to-end scenario

---

## 2. Decisions Recorded at Requirements Analysis

| ID | Decision | Source |
|---|---|---|
| D-01 | **Two languages, one behaviour.** TypeScript on **Node.js 22 LTS** first, needed for example apps; **Python 3.11+** second | RA Q1 X |
| D-02 | **Language-neutral, defined once**: the contract copy, the harness behaviour specification, and the conformance suite | RA Q1 X |
| D-03 | **Per language**: types generated from the copied contract; an idiomatic public interface with the same semantics and names under **one stated naming convention**; the same end-to-end scenario | RA Q1 X |
| D-04 | **Repository layout** leaves room for further languages, for example `contract/`, `conformance/`, `typescript/`, `python/`. Proposed at Application Design | RA Q1 X |
| D-05 | **Both packages buildable, neither published** in M1 | RA Q2 A |
| D-06 | **Contract vendored** from `contract-v0.1.0`, with a check that fails when the copy differs from the tag | RA Q3 A |
| D-07 | **Too-deep payload**: raw-text fallback, with envelope and seal intact and forwardable. Depth bound **sized per language at NFR Requirements**; the conformance suite tests the fallback, not the number | RA Q4 A |
| D-08 | **Payload numbers**: native parsing, with the payload's source text always available | RA Q5 A |
| D-09 | **Registration secret** from a tenant-supplied provider, called per bootstrap, kept only for that call | RA Q6 A |
| D-10 | **Subscriptions** re-subscribe across renewal and surface every stream end and every new stream | RA Q7 A |
| D-11 | **Retries**: bootstrap, renewal and subscribe retry on `503`, honouring `Retry-After`, within a bound; publish never retries | RA Q8 A |
| D-12 | **Proof** of *done when* 2, 3 and 5, per language, in CI and locally, against soorma-core at `contract-v0.1.0` | RA Q9 A |
| D-13 | **A runnable example per language** | RA Q10 A |
| D-14 | **Unit shapes, amending intake's "harness only"**: the conformance suite is an **ordinary** unit (F45's rule); every other unit is **harness**. The amended list is confirmed at Units Generation | RA Q1 X |

Technology classifications from intake, now confirmed: **T-1** by D-01 to D-05; **T-2** by
D-07 with FR-12; **T-3** by D-08; **T-4** by D-09 with FR-06.

---

## 3. Functional Requirements

Each requirement holds for **every language package**, as stated once in the harness
behaviour specification (FR-02) and checked by the conformance suite (FR-03), unless it says
otherwise. *Done when* items refer to the M1 slice brief.

### 3.1 Language-neutral layer

**FR-01 — The contract, copied once.** `contract/` from soorma-core at `contract-v0.1.0` is
vendored into this repository: the envelope and Delivery schemas, the OpenAPI documents, the
conventions, and the fixtures. A check fails when any vendored file differs from the tag. The
copy is never edited by hand; a needed change is raised against the soorma-core initiative
(brief, *Order and the shared contract*). Each language generates its types from this copy.
*Traces*: brief *Consumes*; contract README *Using it*; PF FR-003, I7.

**FR-02 — The harness behaviour specification.** One language-neutral document states, for
every language:
- what each PF §11 operation does (FR-04 to FR-11), and trace emission (FR-14)
- which Problem codes surface, and how (FR-13)
- the retry rules (FR-13)
- how stream ends and new streams appear to tenant code (FR-11)
- the deep-payload fallback (FR-12)
- forwarding the exact JSON (FR-09, FR-12)
- the span rules (FR-14)
- the naming convention shared by every language (FR-17)

*Traces*: RA Q1 X.

**FR-03 — The conformance suite.** Language-neutral case files, which every language package
must pass, covering FR-04 to FR-14. The suite draws on the contract's fixtures
(`contract/fixtures/0.1.0/`) for valid and invalid shapes. It tests the deep-payload
**fallback behaviour**, never a specific depth number (D-07). A language is not complete until
it passes every case. *Traces*: RA Q1 X, Q3 A.

### 3.2 The PF §11 harness operations

**FR-04 — Acquire credential.** Calls S3 `exchangeBootstrap` with
`{ agent, secret, instance }`:
- `agent` and `instance` are supplied by tenant code. **The instance identifier is asserted,
  never derived** from hostname, process, cluster, or any deployment attribute (PF FR-009,
  FR-022, O11; I3, I10)
- the secret is obtained from the tenant's **secret provider** for this call and not retained
  after it (D-09). It is never parsed, logged, or stored beside the credential (handover;
  OB-9)
- the call carries **no envelope** (contract `pre-release.md` statement 3) and sends
  `Soorma-Contract-Version: 0.1.0`, as every call without a draft must

*Proves*: *done when* 2. *Traces*: PF FR-009, §11 *Acquire credential*, §14; OB-9.

**FR-05 — Renew credential.** Calls S3 `renewAgentCredential`, presenting the current
credential, with no envelope:
- renewal is **scheduled from the response's `expiresAt`**, never from a hard-coded lifetime
- when renewal answers `credential_expired` at the end of the lineage, the SDK **bootstraps
  again** through the secret provider (FR-04)
- a renewed credential replaces the old one for every later call, including the next stream
  (FR-11)

*Proves*: *done when* 2 (renewal). *Traces*: PF FR-010, §9, §11 *Renew credential*, §14;
contract `credentials.md` *Revocation and Lifetimes*.

**FR-06 — Hold and present credential.**
- The credential is held **in memory only**: never written to disk, a cache file, or any
  durable store (OB-9)
- it is presented only as `Authorization: Bearer {credential}`, one per request, and only to
  the S3 and S4 endpoints the tenant configured for that environment (FR-15)
- it is treated as opaque: never parsed, decoded, or logged
- **no API accepts, holds, or presents a human's sign-in or environment credential** (OB-19;
  ID §11 *Prohibitions*)

*Traces*: PF §11 *Hold and present credential*, O1 to O4; OB-9, OB-19.

**FR-07 — Draft envelope.** The SDK builds drafts with exactly `clientContractVersion`
(`"0.1.0"`), `traceContext`, and, when forwarding, `inbound`. The draft API **offers no way to
set a platform-stamped field**: `envelopeVersion`, `scope`, `originMode`,
`delegatingPrincipal`, `actorChain`, `reBroadening`. Nothing in the SDK checks a draft as
enforcement; the platform rejects a draft that sets one (`stamped_field_set`), and that is
soorma-core's to prove (*done when* 7). *Traces*: PF FR-002, §7b, §11 *Draft envelope* and
*What the SDK may not populate*; FR-023.

**FR-08 — Populate trace context.**
- every draft carries a **valid W3C `traceparent`**, with `tracestate` when there is one
- when an OpenTelemetry span is active, its context is used; when none is (including when the
  tenant has configured no OpenTelemetry SDK), the SDK still produces a valid `traceparent`,
  never an all-zero trace or parent id (contract `envelope.md` *Rules checked in code*)
- on a forwarded call, the draft's own `traceparent` is this hop's assertion; the forwarded
  envelope's trace context is never copied into the draft (contract `envelope.md`, *The
  stamped `traceContext` on a forwarded call*)

*Proves*: *done when* 5 (trace context travels). *Traces*: PF FR-001, §7b, §11 *Populate
trace context*, §14.

**FR-09 — Forward inbound context.** When a call is triggered by a received Delivery, the
draft carries `inbound: { envelope, seal }` from that Delivery:
- **the envelope is sent as the exact JSON text received**, never re-serialized from the
  parsed object. Its unknown fields, member order and number spellings are therefore
  preserved byte for byte (PF FR-005; FR-12)
- the seal is sent unchanged, and never treated as proof the SDK can check
- forwarding is the default path in the API that handles a Delivery, so that dropping context
  takes a deliberate act (PF R-4; ID §17 guidance)

*Traces*: PF FR-005, FR-015, §11 *Forward inbound context*, §14 *Inbound context forwarding*.

**FR-10 — Publish.** `POST /events` with `{ draft, payload }`:
- `202` with no body is reported as **accepted**, never as delivered
- bodies are serialized as **compact JSON with no HTML-safe or other ASCII escaping**, and
  never with duplicate member names (contract `envelope.md`, *The request body limits*)
- the payload is any JSON value supplied by tenant code; the SDK does not interpret it
- publish is **never retried automatically** (D-11)

*Proves*: *done when* 3 (A publishes). *Traces*: PF §8a *Publish*; contract
`event-ingest.openapi.yaml`.

**FR-11 — Subscribe.** `POST /subscriptions` with `{ draft }`, reading the
`text/event-stream`:
- each `delivery` event becomes a received Delivery (FR-12); heartbeat comments are consumed
  silently
- the stream's final `end` event is surfaced to tenant code with its `code`. **The codes are an
  open set**: an unknown code is surfaced, never fatal to the SDK
- **across credential renewal**, the SDK opens the next stream with the renewed credential
  before the old one expires, and **surfaces each stream end and each new stream to tenant
  code as explicit items**, with **no promise of continuity** between them (D-10;
  GAP-INT-001)
- at most one stream per credential lineage: the SDK never opens a second stream on the same
  lineage except to replace the first, and treats `superseded` on the replaced stream as
  expected
- **no resumption** is attempted or implied: no `Last-Event-ID`, no replay
- the SDK offers no topic or discovery parameter (A-1, A-2): a stream receives everything
  published in its environment after it opened

*Proves*: *done when* 3 (B receives), with B's stream open before A publishes (GAP-INT-001's
work-around). *Traces*: PF §8a *Subscribe*, §6; contract `envelope.md` *The stream*.

### 3.3 Receiving, errors, tracing, configuration

**FR-12 — Receiving a Delivery.**
- **Order-independent extraction**: the code that extracts `envelope` and `seal` from a
  Delivery line **does not depend on the order of its members**; the contract promises none
- **The envelope's received text is kept** with each Delivery, in every language, and is what
  FR-09 forwards
- the envelope is also exposed parsed, read-only, with **unknown fields preserved** and
  **unknown enumerated values** (for example an unknown `originMode`) accepted, not fatal
  (PF FR-005)
- received identifiers are treated as **opaque strings**, never syntax-checked (contract
  `pre-release.md` statement 8)
- the payload is parsed with the language's native numbers, and its **source text is always
  available** to tenant code (D-08)
- **Deep-payload fallback (T-2's constraint, carried as a requirement)**: a payload whose
  nesting exceeds the language's parse-depth bound **never loses the envelope or the seal**.
  The Delivery is still delivered, with its envelope and seal intact and forwardable, and its
  payload as **raw JSON text**, flagged as not parsed (D-07)
- a Delivery line that is not valid JSON, or lacks `envelope` or `seal`, is surfaced as an
  error item for that Delivery; the stream continues

*Proves*: *done when* 3 (B receives the event and its envelope). *Traces*: PF FR-005, §7b,
§17 *Compatibility Rules*; handover *A known risk*.

**FR-13 — Problems and retries.**
- every non-success response is surfaced as an RFC 9457 Problem with its `code`. **Unknown
  codes and extra members are tolerated** and preserved
- `Retry-After` is read whenever present and surfaced with the Problem
- **bootstrap, renewal and subscribe** retry on `503 unavailable`, honouring `Retry-After`,
  up to a bound set at NFR Requirements. **Publish never retries** (D-11)
- **`429 too_many_attempts`** (the bootstrap abuse bound) is surfaced and not retried
  automatically: retrying would use up the attempts it bounds. This reads D-11 ("retry on
  `503`") as written
- `401 credential_expired` from renewal triggers FR-05's re-bootstrap. Any other
  `credential_refused` or `credential_expired` is surfaced; the SDK never re-bootstraps to get
  around a revocation (PF FR-011: revocation is terminal)
- `403 forbidden` is surfaced as given, with no inference about its cause (for example
  GAP-AE-001's case)
- every error path releases its resources (connections, streams, timers)

*Traces*: contract `errors.md`; PF §9 *Failure Modes*; SECURITY-15.

**FR-14 — Trace emission (GAP-INT-002's work-around, as stated).**
1. Spans are emitted **only through the OpenTelemetry API**, following **OpenTelemetry's own
   messaging semantic conventions**. **No soorma-defined span name or attribute**
2. **The SDK installs no exporter and no sampler.** The tenant's OpenTelemetry configuration
   decides where spans go and whether they are sampled; the SDK defines no ingest
3. The span shape is documented as **unstable**, outside the SDK's compatibility guarantee,
   until the Observability PRD specifies span semantics
4. **The proof of *done when* 5**: since the SDK ships no exporter, the end-to-end test
   installs one (for example an in-memory exporter), never one the SDK ships, and asserts that
   a span is emitted and that **its trace id matches the `traceparent` on the envelope B
   receives**

*Proves*: *done when* 5. *Traces*: PF §7b, §19 step 10; OB-8; soorma-sdk GAP-INT-002
(soorma-prd#37).

**FR-15 — Configuration.**
- the tenant supplies the **S3 and S4 base URLs** explicitly; nothing is discovered or
  inferred from the host
- **no environment identifier is configured, sent, or inferred.** Scope comes from the
  presented credential (PF FR-022, O11; I3, I10)
- TLS verification is **always on**; a trusted CA can be supplied (the local stack's CA at
  `deploy/local/.secrets/stack-ca.pem`). No option disables verification
- no configuration value is read from deployment metadata (hostname, cluster, pod)

*Traces*: PF FR-022; I3; SECURITY-01 (in transit), SECURITY-09.

### 3.4 Boundaries and deliverables

**FR-16 — What the SDK never does.**
- **enforces nothing**: no check in the SDK is one the platform relies on, and a tenant who
  never links it reaches identical enforcement (PF FR-023, I2)
- offers **no human-side operation** and no way to hold a human credential (ID §11 *The human
  side*; OB-19)
- offers **no delegation**: presenting a delegation credential (ID FR-028) is out of M1; the
  `Soorma-Delegation` header is reserved, and the SDK never sends it
- contains **no commercial code** (PF §11 *Commercial client check*; PF §22; I8)
- never reads or logs a secret, credential, or payload content

**FR-17 — One naming convention.** Operations and concepts carry the same names in every
language, under one convention stated in the behaviour specification (FR-02), with each
language's idiomatic casing. The convention is proposed at Application Design.

**FR-18 — The language packages.** A TypeScript package for **Node.js 22 LTS**, built first,
and a Python package for **Python 3.11+**, built second. Each has an idiomatic public interface
over FR-04 to FR-15, its types generated from the vendored contract (FR-01), and passes the
conformance suite (FR-03). Both are buildable and installable from this repository; **neither
is published** to a registry in M1 (D-05). Licensed Apache 2.0 (PF §22).

**FR-19 — The end-to-end scenario, per language.** The same scenario in each language, against
a running soorma-core **at `contract-v0.1.0`**, in CI and locally (D-12):
1. **Set-up as raw calls, outside the package** (A-3): the human steps of soorma-core's
   TC-AR-008 (first authentication, sign-in, environment credential, self-grant), two agents
   registered in one environment, a registration secret each. The SDK receives only the agent
   identifier and a secret provider, as a tenant's code would
2. **Done when 2**: each instance bootstraps through the SDK and holds a short-lived
   credential; one renewal succeeds through the SDK
3. **Done when 3**: B subscribes through the SDK; A publishes through the SDK; B receives the
   Delivery, with its envelope and seal
4. **Done when 5**: the draft carried a `traceparent`; the envelope B receives carries it; the
   test-installed exporter (FR-14) holds the span whose trace id matches

**FR-20 — A runnable example, per language.** Two agents, A publishing and B subscribed,
printing the envelope B receives and the trace id, with a README naming the set-up steps.
The tests remain the proof; the example is what a developer runs. *Traces*: brief
*Developer-visible outcome*; D-13.

---

## 4. Non-Functional Requirements

**NFR profile source** (harness shape, units-generation 2.5.4): PF §11 *Harness Surface* and
PF §14 *Harness Surface Register* @ `prd-platform-foundations-v1.3`. The harness runs on the
calling agent's request path. It carries no enforcement, durability or server-availability
property.

| ID | Requirement | Source | Sized at |
|---|---|---|---|
| NFR-01 | **Request-path overhead**: the SDK adds no network round trip beyond the operation's own, and no blocking work proportional to anything but the request | PF §9 *NFR Profile* (revocation read is hot path; the client must not add to it) | NFR Requirements |
| NFR-02 | **Renewal headroom**: renewal and the next stream start before expiry, with headroom derived from `expiresAt`, never from a hard-coded lifetime | Contract `credentials.md` | NFR Requirements |
| NFR-03 | **Parse-depth bound, per language**: chosen so the parser never fails on envelope and seal extraction, with the fallback (FR-12) beyond it | D-07; handover | NFR Requirements, per language |
| NFR-04 | **Retry bound**: maximum attempts and maximum total wait for FR-13's retries | D-11 | NFR Requirements |
| NFR-05 | **Compatibility, as a consumer**: declares `clientContractVersion` `0.1.0` exactly; tolerates unknown fields, enumerated values, Problem codes and `end` codes; preserves and forwards unknown envelope fields | PF FR-004, FR-005, §14; I7 | Functional Design |
| NFR-06 | **Secret and credential hygiene**: no secret, credential or payload content in logs, error messages, exception text, or string representations | OB-9; SECURITY-03, SECURITY-12 | Functional Design |
| NFR-07 | **Supply chain**: lock files committed; exact dependency versions; a vulnerability scan in CI; pinned CI tool and action versions; dependencies from official registries only | SECURITY-10 | NFR Requirements |
| NFR-08 | **Runtimes**: Node.js 22 LTS; Python 3.11+ | D-01 | — |
| NFR-09 | **Licence**: Apache 2.0, with SPDX headers in source files | PF §22 | Code Generation |
| NFR-10 | **Testability**: every FR has a conformance case or an end-to-end assertion; both run in CI | D-12; FR-03 | Build and Test |
| NFR-11 | **DCO**: every commit carries a `Signed-off-by` matching its author | `.github/workflows/dco.yml` | Every commit |

---

## 5. *Done When* Proofs

| *Done when* | Proven by | Requirement | Gap affecting it |
|---|---|---|---|
| 2 — each instance bootstraps and receives a short-lived credential | E2E step 2, per language | FR-04, FR-05, FR-06, FR-19 | — |
| 3 — A publishes; B, subscribed in the same environment, receives it | E2E step 3, per language | FR-07, FR-10, FR-11, FR-12, FR-19 | soorma-sdk GAP-INT-001 (soorma-prd#13): live-only, worked around |
| 5 — trace context travels on the envelope and a trace is emitted | E2E step 4, per language; the test-installed exporter | FR-08, FR-14, FR-19 | soorma-sdk GAP-INT-002 (soorma-prd#37): worked around |

*Done when* 1, 4, 6 and 7 are soorma-core's, proven with raw calls (brief).

---

## 6. Specification Gaps Carried

| Gap | Status | Effect on these requirements |
|---|---|---|
| soorma-sdk GAP-INT-001 (= soorma-core GAP-INT-003, soorma-prd#13) | Awaiting PRD: Event | FR-11 promises nothing about delivery and surfaces every stream boundary |
| soorma-sdk GAP-INT-002 (soorma-prd#37) | Awaiting PRD: Observability | FR-14 is the work-around, as stated |

Gaps inherited through the contract (soorma-core's GAP-INT-007, GAP-INT-008, GAP-AE-001,
GAP-ET-001) are context: the SDK follows the contract at `0.1.0` (coverage map).

---

## 7. Out of Scope

- everything server-side, and *done when* 1, 4, 6, 7 (soorma-core's)
- delegation-credential presentation (ID FR-028), and any human-side operation
- publishing either package to a registry (D-05)
- topics, discovery, durable delivery, resumption (GAP-INT-001; A-1, A-2)
- soorma-defined span semantics, an exporter, a sampler (GAP-INT-002)
- languages other than TypeScript and Python

---

## 8. Extension Configuration

| Extension | Enabled | Notes |
|---|---|---|
| security-baseline | Yes | Opted in — deployment: local-only. *(hosted)* clauses carried in `aidlc-state.md` |
| soorma-platform-invariants | Yes | Scope inherited from PF §15 and ID §15: I1 to I11 Addressed in both, none N/A. Invariants read at both tags; text identical |
| pr-checkpoint | Yes | Gates on `dev` → `main` PRs |
| qa-test-cases | Yes | Opted in — scope: comprehensive |
| tickets | Yes | Opted in — target: GitHub issues on soorma-ai/soorma-sdk; initiative ticket → tracking issue; unit ticket → sub-issue |

---

## 9. Traceability

| PRD / source | Requirements |
|---|---|
| PF FR-001, §7b | FR-07, FR-08 |
| PF FR-002, §11 *What the SDK may not populate* | FR-07 |
| PF FR-005 | FR-09, FR-12, NFR-05 |
| PF FR-009, FR-010, §9 | FR-04, FR-05 |
| PF FR-022, O11 | FR-04, FR-15 |
| PF FR-023 | FR-16, all |
| PF §11 *Harness Surface* (six operations) | FR-04 to FR-09 |
| PF §14 | FR-04, FR-05, FR-08, FR-09, NFR-05 |
| PF §22 | FR-16, FR-18, NFR-09 |
| OB-8 | FR-14 |
| OB-9 | FR-04, FR-06, NFR-06 |
| OB-19; ID §11 | FR-06, FR-16 |
| Contract `contract-v0.1.0` | FR-01, FR-10, FR-11, FR-13 |
| Handover *A known risk* | FR-12, NFR-03 |
| Brief *done when* 2, 3, 5 | FR-19, §5 |
