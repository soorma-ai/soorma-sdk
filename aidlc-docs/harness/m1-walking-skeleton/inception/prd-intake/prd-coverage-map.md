# PRD Coverage Map

**Entry point**: slice brief
**Slice brief**: soorma-prd/backlog/m1-walking-skeleton.md @ `0aad84a27c94d8f6d7064c312aaaa2e553d162dd` (Status: Ready)
**Milestone**: M1 — Walking skeleton
**Scope**: `soorma-sdk` column of *Repositories and sessions*
**Intake run**: 1 — 2026-11-17T07:33:14Z

> The PRDs state the **target**. The slice brief decides only **delivery scope**.
> Where they appear to conflict, the PRD wins.

## PRDs

| Key | PRD | Version | Built against | Commit | Kind | Status verified | Review PR |
|---|---|---|---|---|---|---|---|
| PF | `platform-foundations` | 1.3 | `prd-platform-foundations-v1.3` | `80dd7c98e81702bb38dece9249372ea27b0555f9` | `plane` (declared) | Approved, header at the tag | #4 (v1.0), #5 (v1.1), #19 (v1.2), #21 (v1.3) |
| ID | `identity` | 1.0 | `prd-identity-v1.0` | `80dd7c98e81702bb38dece9249372ea27b0555f9` | `plane` (declared) | Approved, header at the tag | #21 |

Both tags exist; the `**Version**:` at each tag matches the tag name; the `**Kind**:` at
each tag matches the brief's *Draws on*. Both tags sit on the same merge commit (#21).

## Consumed Contract

| Contract | Owner | Pin | Peels to | Status |
|---|---|---|---|---|
| soorma wire contract, `contract/` | `soorma-core` M1 initiative | annotated tag **`contract-v0.1.0`** on soorma-core `main` | `c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d` | Published; **pre-release** (`conventions/pre-release.md`); Apache 2.0 |

- Handed over by soorma-sdk#2 and the handover file at soorma-core `0b19457`
  (`aidlc-docs/platform/m1-walking-skeleton/construction/build-and-test/soorma-sdk-handover.md`).
  **The handover is input, not scope**
- The npm package `@soorma/contract` is `private`. A client in any language takes the
  schemas at the tag and generates its own types (contract `README.md`, *Using it*)
- **The contract is not the PRD's.** If it proves insufficient, that is raised against the
  soorma-core initiative and changed there, never adapted here (brief, *Order and the shared
  contract*)
- **Intake sufficiency check**: each of the six PF §11 operations maps to the contract
  (table below). No insufficiency found at intake. Functional Design re-checks in detail

| PF §11 operation | Contract at `contract-v0.1.0` |
|---|---|
| Acquire credential | S3 `POST /agent-credentials` (`exchangeBootstrap`), `{ agent, secret, instance }`; no envelope |
| Renew credential | S3 `POST /agent-credentials/current/renewal` (`renewAgentCredential`); no envelope |
| Hold and present credential | `Authorization: Bearer soorma_ac_…`, one per request (`conventions/credentials.md`) |
| Draft envelope | `Draft`: `clientContractVersion`, `traceContext`, optional `inbound`; closed (`conventions/envelope.md`) |
| Populate trace context | `traceContext`: W3C `traceparent`, optional `tracestate`; form-checked only |
| Forward inbound context | `inbound: { envelope, seal }`, copied exactly from the `Delivery` |
| *(trace emission, from the brief)* | Not a wire operation: "the platform … emits no spans" (`conventions/envelope.md`) |

## Cross-PRD Checks

| Check | Result | Decision |
|---|---|---|
| Upstream consistency: ID declares `**Upstream PRD**: platform-foundations at prd-platform-foundations-v1.3` | **Consistent** — the brief draws on PF at the same tag | — |
| Newer approved tag than the brief cites | **None** — `prd-platform-foundations-v1.3` and `prd-identity-v1.0` are the newest of each | — |
| Milestone against `build-sequence.md` (at origin/main) | **Matches** — M1 exists, its *Slice brief* links this brief, and its tags are `prd-platform-foundations-v1.3` and `prd-identity-v1.0` | — |
| Consumed contract published at a pinnable version (1.3 step 5) | **Published** — `contract-v0.1.0`, on soorma-core `main` | — |

## Slice Scope for This Repository

| | |
|---|---|
| **Builds** | "The harness operations in PF §11 *Harness Surface*: acquire, renew, hold-and-present, draft envelope, populate trace context, forward inbound context; trace emission" |
| **Requirements** | PF FR-023; PF §11 *Harness Surface* and *What the SDK may not populate*; PF FR-005 ("since the SDK too must preserve unknown envelope fields") |
| **Owns** | "Nothing the platform depends on. Under PF FR-023 it enforces nothing" |
| **Consumes** | soorma-core's wire contract @ **`contract-v0.1.0`** |
| **Proves** | *done when* **2, 3 and 5**, "through the SDK, against a running `soorma-core`. This is the developer-visible outcome, and M1 is done when it passes" |
| **Unit shapes** | **harness**: from *Builds*, "The harness operations in PF §11 *Harness Surface*: acquire, renew, hold-and-present, draft envelope, populate trace context, forward inbound context". **harness**: from *Builds*, "trace emission", a client-side operation that calls no face and enforces nothing. **No contract unit**: *Owns* is "Nothing the platform depends on". **No plane face**: *Builds* names no server-side operation. **Confirmed by the user: harness only** (intake Q1 A, 2026-11-18T02:07:55Z) |

| In scope for this repository | Out of scope (absent, not simplified) |
|---|---|
| PF FR-023: the six operations, advisory only | Everything server-side — the brief's `soorma-core` column |
| PF §11 *What the SDK may not populate*: no API populates a platform-stamped field | ID FR-028 — presenting a delegation credential. Delegation (ID FR-019 to FR-021) is out of M1; the contract reserves `Soorma-Delegation` and `soorma_dc_` |
| PF FR-005: unknown envelope fields preserved and forwarded; unknown enumerated values non-fatal | Any human-side operation. ID §11: "The human side: no client library" |
| PF §14 *Harness Surface Register*: the compatibility guarantees, as consumer obligations | Every *decide at intake* item — all four belong to the `soorma-core` session (brief) |
| Trace emission (*done when* 5) | *done when* 1, 4, 6, 7 — soorma-core proves them with raw calls |

| Decide at intake | Decided in |
|---|---|
| None assigned to `soorma-sdk`. The brief: "Every *decide at intake* item — PF FR-011 and FR-026, ID FR-006 and FR-011 — belongs to the `soorma-core` session" | — |

## Stage Coverage

| Inception Stage | Coverage | Source | Still Needed |
|---|---|---|---|
| Requirements Analysis | **Partial** | PF FR-005, FR-023; PF §7b *Envelope Fields*; PF §11; PF §14; PF §17 *SDK Surface and Compatibility Guarantee*; OB-9, OB-19; the contract at `contract-v0.1.0` | Technology choices (language, runtime, packaging); the handover's known risk — payload nesting depth versus client parsers; trace emission's work-around under GAP-INT-002; how the SDK surfaces errors, stream ends, and renewal; extension opt-ins |
| User Stories | **Partial** | Brief *done when* 2, 3, 5; PF §11 per-operation table | One persona (the agent developer, PF FR-023 *Principal*). Stories trace the three *Proves* items; whether the stage runs is decided at Workflow Planning |
| Application Design | **Not addressed** | — | Component and API design of the SDK. The PRDs specify operations and prohibitions, never an API |
| Units Generation | **Partial** | Brief *Builds*; PF §11 operation table seeds the inventory (units-generation 2.5.4 rule 1) | Unit boundaries within the harness shape; dependency order |

## L1 Domain Sources

Registered for the per-unit L1 Domain Coverage Gate. A harness owns no record; its L1
content is the envelope's field set and the constraints it must preserve, and the
credential's client-visible lifecycle.

| Source | Content | Applies To |
|---|---|---|
| PF §7b *Envelope Fields* | Seven fields; six platform-stamped, `traceContext` agent-asserted; the draft's client contract version | Draft construction; forwarding; receiving a Delivery |
| PF §7b *Compatibility Policy*; PF FR-004, FR-005 | Unknown fields preserved and forwarded; unknown enumerated values non-fatal | Every envelope the SDK receives or forwards |
| PF FR-006 | Actor chain ordered, most recent last, minimum length 1, bounded (contract: 32) | Received envelopes, read-only |
| PF §11 *What the SDK may not populate* | Scope, origin mode, delegating principal, actor chain, re-broadening record, envelope version: never populated | Draft construction |
| PF §9 *Operations* and *Failure Modes*; FR-009, FR-010 | Credential lifecycle as the client sees it: bootstrap once per instance, renew on a TTL cycle from a valid credential, re-bootstrap when lapsed, revocation terminal | Credential acquisition, renewal, holding |
| PF §17 *Envelope*, *Namespacing Rules*, *Recognised Kinds* | Instance and logical agent identifiers are environment-scoped; received identifiers are opaque | All received identifiers |

## Decisions Inherited (DO NOT re-derive)

| Decision | Source | Why it must not be re-derived |
|---|---|---|
| Nothing in the SDK is enforcement; a tenant who never links it reaches identical enforcement | PF FR-023; PF §11 *Advisory-only assertion*; I2 | The SDK may not hold a check the platform relies on. A local check is convenience only, never the boundary |
| The SDK never populates a platform-stamped field; a draft that does is rejected by the platform, never overwritten | PF FR-002, §11 *What the SDK may not populate* | A silently overwritten field would leave a tenant believing their value took effect |
| Unknown envelope fields are preserved and forwarded; unknown enumerated values are not fatal | PF FR-005; §7b; §14 *Envelope draft construction* | A deployed SDK cannot be force-upgraded (I7); stripping fields silently destroys attribution downstream |
| A draft declares the client contract version it was built against, distinct from the envelope version | PF §7b; §11 | It is what makes the I7 compatibility guarantee implementable |
| Credentials are short-lived and renewable; renewal needs a still-valid credential; a lapsed instance re-bootstraps | PF FR-009, FR-010; §9; §14 *Credential renewal* | The renewal precondition is part of the contract |
| The instance identifier is asserted, not verified | PF FR-009; §11 *Acquire credential* | Nothing in the SDK may read hostname, cluster or instance metadata to derive identity (I3, I10; PF FR-022, O11) |
| Acquire and renew without holding durable material beyond what the tenant provisioned | OB-9 (`plane-obligations.md` at `prd-identity-v1.0`) | An obligation on the Harness, owed to PF |
| Offer no way to hold a human's sign-in or environment credential | OB-19; ID §11 *Prohibitions*; ID §11 *The human side* | An agent holding a human's credential could act as the human (ID R-2, accepted only because it is unenforceable) |
| The SDK is Apache 2.0, shipped separately from the substrate, and contains no commercial code | PF §22 *Edition and licence*; PF §11 *Commercial client check*; FR-023 | I8 |
| Envelope-bearing calls carry an envelope; a direct human operation carries none | PF FR-001 (v1.3) | — |
| Wire format: the contract at `contract-v0.1.0`, not re-derived | Brief, *Order and the shared contract* | Exactly one session decides the wire format, and it is soorma-core's |

## Handed to AI-DLC

| Item | Source | Constraint the answer must satisfy | Decided in |
|---|---|---|---|
| Technology selection: language, runtime, libraries, packaging | — (I11) | Excluded from PRDs by design. Apache 2.0; no commercial code (PF §22) | Requirements Analysis (handover note: raise the language as a question) |
| Trace context standard | PF §7b "an open standard" | Already decided by the contract: W3C Trace Context (soorma-core T-3, M1-TECH-05) | Inherited from the contract |
| Receiving-side parse-depth bound, and what the SDK surfaces past it | Handover, *A known risk* | PF FR-005: a Delivery's envelope and seal must remain forwardable; PF §1: the payload is the tenant's, never governed | Requirements Analysis, then NFR Requirements (T-2) |
| Renewal timing | PF §9 *Renew credential* (periodic, on a TTL cycle); PF §14 | Scheduled from the response's `expiresAt`; lifetimes never hard-coded (contract `credentials.md`) | Functional Design |

## Deferred Questions Imported

| ID | Question | Deferred To |
|---|---|---|
| — | None. PF §19: "All fourteen questions are Answered. None deferred, none awaiting." ID §19: "All seventeen questions are Answered. None deferred, none awaiting." | — |

## Open Risks (owned elsewhere — context, not AI-DLC's to resolve)

| ID | Risk | Class | Owner | If the build touches it |
|---|---|---|---|---|
| PF R-3 | Registry & Schema may not express the envelope's compatibility policy | Substantive | Registry & Schema PRD | The SDK follows PF §7b's policy as stated; it does not depend on how R-3 resolves |
| PF R-4 | An agent that declares autonomy and serves requests can widen by forwarding nothing | Accepted | — | The SDK's *forward inbound context* makes forwarding the default path (ID §17 guidance); it cannot prevent omission |
| ID R-2 | A system holding a human's credential can present it alone | Accepted | — | The SDK offers no way to hold one (OB-19) |
| PF R-1, ID R-8 to R-11 | Access Policy, Memory, Eval | — | Their PRDs | Not touched by a harness |

## Gaps Inherited Through the Contract (soorma-core's; context)

The SDK builds against the work-arounds, which are the contract at `0.1.0`. Not raised by
this initiative. GAP-INT-003 also bears on a *Proves* item here, so it is recorded here as
GAP-INT-001 (below).

| soorma-core gap | Issue | What the SDK sees at `contract-v0.1.0` |
|---|---|---|
| GAP-INT-003 | soorma-prd#13, open | Live delivery only; no durability, ordering, redelivery, acknowledgement or resumption |
| GAP-INT-007 | soorma-prd#25, closed with no new PF tag | A draft never carries origin mode |
| GAP-INT-008 | soorma-prd#27, open | Bootstrap and renewal carry no envelope (PF FR-001 reads otherwise) |
| GAP-AE-001 | soorma-prd#30, open | A non-autonomous agent forwarding an autonomous envelope is refused `forbidden` |
| GAP-ET-001 | soorma-prd#31, open | During a store outage, new publishes and subscribes are refused `unavailable`; open streams continue |

## From PR Review (not in the PRD body)

| PR | PRDs | Point | Effect |
|---|---|---|---|
| #4 | PF v1.0 | One review, "looks good"; no line comments | None |
| #5, #19, #21 | PF v1.1–v1.3, ID v1.0 | No comments or reviews. The PR bodies restate the amendments. #19 records the §19 exceptions, including "Observability span semantics (OB-8)" (Q8 A) | Confirms OB-8 is an exception to PF's success claim, not an oversight (GAP-INT-002) |

## Build-Time Questions Classified at Intake

Inputs: the brief's *questions to watch*; the handover's known risk; and a walk of
*done when* 2, 3 and 5 through the in-scope requirements.

### Summary

| Ref | Question | Brief's watch item | Outcome | Owner | Blocks (*done when*) | Routing |
|---|---|---|---|---|---|---|
| A-1 | Who creates topics; what does B subscribe to? | Q2 (Event) | **Answered by a PRD**: the namespace is the environment's (PF §8a, §6). The contract has no topics; a stream receives everything in its environment | — | — | — |
| GAP-INT-001 | What delivery guarantees does a subscriber get? | Q2 (Event) | **Specification** — the same gap as soorma-core's GAP-INT-003 | Event | 3 (worked around by the contract) | Existing soorma-prd#13; comment as soorma-sdk GAP-INT-001 (intake Q3 A) |
| GAP-INT-002 | What does an emitted trace's span mean: which spans, their names, attributes and links, sampling, and where they go? | Q3 (Observability) | **Specification** | Observability | 5 (worked around) | Raised on soorma-prd as soorma-sdk GAP-INT-002, and worked around (intake Q2 A) |
| A-2 | Does B need discovery, or only a subscription? | Q4 (Registry & Schema) | **Answered by a PRD**: only a subscription (PF §8a); the contract has no discovery operation | — | — | — |
| A-3 | How are the human steps that precede an SDK run performed? | Not on the list | **Answered by a PRD**: not by the SDK (ID §11 *The human side*; OB-19). Test set-up performs them as raw calls, outside the shipped package | — | — | — |
| A-4 | Does the SDK check a draft locally? | Not on the list | **Answered by a PRD**: it simply offers no way to populate a stamped field (PF §11); any local check is convenience, never relied on (FR-023) | — | — | — |
| T-1 | Language, runtime and packaging | Not on the list | **Technology** | AI-DLC | — | Requirements Analysis |
| T-2 | How the receiving side bounds parse depth, and what it surfaces past it | Not on the list (handover's known risk) | **Technology, constrained** | AI-DLC | — | Requirements Analysis, then NFR Requirements |
| T-3 | Payload numbers beyond double precision | Not on the list (handover) | **Technology, constrained** | AI-DLC | — | Requirements Analysis |
| T-4 | How the SDK holds credentials and schedules renewal | Not on the list | **Technology, constrained** | AI-DLC | — | Functional Design |

Totals: 4 answered by a PRD, 4 technology, 2 specification, 0 errata.

### A-1, A-2: topics and discovery

PF §8a: "Publish to an event namespace: `event:publish` in that environment's namespace";
PF §6 keys the namespace on environment. soorma-core's intake classified both the same way
(its A-2, A-3). At `contract-v0.1.0`, subscribe takes only `{ draft }` and "every subscriber
in an environment receives everything published in it". The SDK therefore offers no topic or
discovery parameter. Adding one later is additive.

### A-3: the human steps

*Done when* 2, 3 and 5 presuppose two registered agents with a secret each, which takes a
human: authentication, sign-in, an environment credential, a self-grant, two registrations,
two secrets. ID §11: "The human side: **no client library**." OB-19: "offer no way to hold a
human credential". The SDK therefore exposes no human operation. The end-to-end proof
performs those steps as raw HTTP calls in test set-up, as soorma-core's
`e2e/agent-registration.test.ts` (TC-AR-008) does, and hands the SDK only the agent
identifier and secret, as a tenant would.

### A-4: local draft checks

PF §11: a draft setting a stamped field is "Rejected — never silently overwritten" **by the
perimeter**. FR-023: "Nothing in it is enforcement." The SDK's draft API has no way to set a
stamped field, so there is nothing to check. *Done when* 7 is soorma-core's to prove with raw
calls.

### T-1: language, runtime, packaging

Neither PRD, the brief, nor the handover fixes it (the handover: "raise it as a Requirements
Analysis question"). Constraints: Apache 2.0, no commercial code (PF §22); generated types from
the schemas at the tag. Whether a package is published to a registry in M1 is a delivery
question for the same stage; no *Proves* item needs it.

### T-2: payload nesting depth (the handover's known risk)

S4 accepts a payload within 64 KiB that nests about 32,000 levels; Python's `json` fails near
1,000 and a TypeScript `JSON.parse` reviver near 3,000. soorma-core does not bound nesting
below the byte bound. **The payload is the tenant's** (PF §1, *Platform / Tenant Boundary*), so
how deep the SDK parses it is not specified anywhere, and two engineers could differ. The
constraint: a Delivery is one line of JSON holding `envelope`, `seal` and `payload`, so a
parser failing on the payload must not lose the envelope and seal, which PF FR-005 requires
be forwardable. The answer is decided at Requirements Analysis and sized at NFR Requirements.

### T-3: payload numbers

The contract delivers each number as its source text and does not require I-JSON. How the SDK
represents such numbers to tenant code is technology; the constraint is that it never alters
what it forwards or publishes.

### T-4: holding credentials and renewing

OB-9: "acquire and renew credentials without holding durable material beyond what the tenant
provisioned". So credentials are held in memory, never written to disk. The contract: schedule
renewal from `expiresAt`, re-bootstrap on `credential_expired`, never hard-code lifetimes; at
most one stream per credential lineage. Mechanism is Functional Design's.

### GAP-INT-001, GAP-INT-002

Full entries: [specification-gaps.md](specification-gaps.md).

**Bottom line for PF §19's success claim.** For this repository's *Proves* items, the claim
holds except at PF §19 step 8 (Event, GAP-INT-001) and step 10 (Observability, GAP-INT-002),
the two exceptions PF states.
