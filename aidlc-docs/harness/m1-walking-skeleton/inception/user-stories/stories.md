# User Stories — soorma-sdk, M1

**Sources**: `requirements.md` (approved 2026-11-18T02:47:34Z); PF @
`prd-platform-foundations-v1.3`; ID @ `prd-identity-v1.0`; the contract @ `contract-v0.1.0`;
the slice brief @ `0aad84a`. Personas: [personas.md](personas.md).

**How to read these stories** (story plan, approved 2026-11-18T02:55:43Z):
- **Journey-based** (Q2 A): the stories follow an agent instance's life, and each names the
  PF §11 operation it delivers
- **Language-neutral** (Q3 A): one story set. Every criterion holds in TypeScript and Python
- **Given / When / Then** (Q4 A), each citing its requirement and source
- **Failure paths inside the story whose operation fails** (Q5 A)
- **How each criterion is checked**, in both languages:
  - **[C]** a conformance case: a language-neutral case file run by each language's runner
    against a scripted platform (FR-03)
  - **[E]** the end-to-end scenario against a running soorma-core (FR-19), run per language
  - **[A]** an API check per language: a property of the public interface that a case file
    cannot express (for example, that no parameter exists). Checked in both languages, but
    by each language's own test, not a shared case file. **Flagged**, since these are the
    criteria where drift between the languages is not caught mechanically by one shared file
  - **⚑ one language only**: flagged where it occurs. There is one: US-11's TypeScript starter
    criterion, which you asked for; its Python counterpart is a separate criterion

---

## Story Map

| Journey step | Story | PF §11 operation | *Done when* |
|---|---|---|---|
| Configure | US-01 Configure a client for one environment | — (hold and present: where) | — |
| Bootstrap | US-02 Bootstrap an agent instance | Acquire credential | 2 |
| Stay alive | US-03 Keep the credential alive | Renew credential; hold and present | 2 |
| Publish | US-04 Publish an event | Draft envelope; populate trace context | 3, 5 |
| Subscribe | US-05 Subscribe and receive events | Hold and present | 3 |
| Subscribe | US-06 See every stream boundary | Hold and present | 3 |
| Receive | US-07 Read what arrived, whatever it holds | — (consumer obligations, PF FR-005) | 3 |
| Act | US-08 Forward the context of the event I act on | Forward inbound context | — (4 is soorma-core's) |
| Observe | US-09 See my agent's operations in my own tracing | Populate trace context; trace emission | 5 |
| Cross-cutting | US-10 Act on what the platform reports | — (all operations) | — |
| Start | US-11 Start a new agent from the example | — | 2, 3, 5 shown |
| Maintain | US-12 Keep the contract copy pinned | — | — |
| Maintain | US-13 One behaviour, stated once | — | — |
| Maintain | US-14 Bring a language to conformance | — | — |

---

## P1 — Agent developer

### US-01 — Configure a client for one environment

**As** an agent developer, **I want** to point a client at one environment's S3 and S4
addresses with my agent's identity, **so that** every call goes to that environment and nowhere
else, without the SDK guessing anything from where my code runs.

**Requirements**: FR-15, FR-06, FR-16 · **Sources**: PF FR-022, O11; OB-19; I3, I10

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** S3 and S4 base URLs, a logical agent identifier, an instance identifier and a secret provider, **when** I create a client, **then** it is created without contacting the platform, and no environment identifier is asked for or accepted (FR-15) | [C] [A] |
| 2 | **Given** a client, **when** it makes any call, **then** the call goes only to the configured S3 or S4 address, over TLS with verification on; there is no setting that turns verification off (FR-15; SECURITY-09) | [C] [A] |
| 3 | **Given** a CA certificate (the local stack's `stack-ca.pem`), **when** I supply it, **then** calls to a server presenting a certificate from that CA succeed, and calls to one presenting an untrusted certificate fail with a TLS error (FR-15) | [C] |
| 4 | **Given** any host, hostname, process or container, **when** the client is created, **then** no identifier it uses (agent, instance, environment) is derived from them; the instance identifier is the one I supplied (PF FR-009, FR-022; I3, I10). *Whether the SDK offers a default instance identifier, and how it is made if so, is decided at Application Design; it is never host-derived (T-5)* | [C] [A] |
| 5 | **Given** the client's public interface, **when** I look for a way to supply a human's sign-in or environment credential, or a delegation credential, **then** there is none (OB-19; ID §11; FR-16) | [A] |

### US-02 — Bootstrap an agent instance

**As** an agent developer, **I want** my instance to exchange its registration secret for a
short-lived credential, **so that** it can act on the platform as its registered agent.

**Requirements**: FR-04, FR-06, FR-13 · **Sources**: PF FR-009, §11 *Acquire credential*; OB-9;
contract `data-gateway.openapi.yaml` `exchangeBootstrap`, `credentials.md` · ***Done when* 2**

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** a registered agent and an active secret from my provider, **when** I bootstrap, **then** the SDK sends `POST /agent-credentials` with exactly `{ agent, secret, instance }`, the header `Soorma-Contract-Version: 0.1.0`, no `Authorization` header and no envelope, and holds the returned credential (FR-04) | [C] [E] |
| 2 | **Given** a successful bootstrap, **when** I read the client's state, **then** I can see the credential's `agent`, `instance`, `environment` reference and `expiresAt`, read-only, and never the credential string itself (FR-06; PF FR-022: scope comes from the credential) | [C] [A] |
| 3 | **Given** a secret provider, **when** the SDK bootstraps, **then** it calls the provider once for that bootstrap, and after the call completes no reference to the secret remains in the client (FR-04; D-09; OB-9) | [C] |
| 4 | **Given** any outcome, **when** the SDK logs, raises an error, or renders the client or credential as a string, **then** neither the secret nor the credential appears (NFR-06; SECURITY-03) | [C] |
| 5 | **Given** a wrong secret, an unknown agent, or a revoked agent, **when** I bootstrap, **then** I receive `403 authentication_failed` as a Problem, and the SDK does not retry (FR-13; contract `errors.md`) | [C] [E] |
| 6 | **Given** the abuse bound is reached, **when** I bootstrap, **then** I receive `429 too_many_attempts` with its `Retry-After`, and the SDK does not retry (FR-13) | [C] |
| 7 | **Given** the platform answers `503 unavailable` with `Retry-After`, **when** I bootstrap, **then** the SDK retries after that interval, within the retry bound, and surfaces the last Problem if the bound is exhausted (FR-13; D-11) | [C] |
| 8 | **Given** the response carries fields the SDK does not know, **when** I bootstrap, **then** it succeeds and the unknown fields do not cause an error (NFR-05; contract fixture `AgentCredential/valid/unknown-field.json`) | [C] |

### US-03 — Keep the credential alive

**As** an agent developer, **I want** the SDK to keep my instance's credential valid for as
long as my agent runs, **so that** a running demo, or a running agent, outlives any one
credential without my code managing lifetimes.

**Requirements**: FR-05, FR-06, FR-13 · **Sources**: PF FR-010, FR-011, §9, §11 *Renew
credential*, §14; contract `credentials.md` *Revocation and Lifetimes* · ***Done when* 2**

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** a credential with an `expiresAt`, **when** time passes, **then** the SDK renews before that time, with headroom computed from `expiresAt`, never from a hard-coded lifetime; varying `expiresAt` in the case varies when renewal happens (FR-05; NFR-02) | [C] [E] |
| 2 | **Given** a renewal, **when** the SDK sends it, **then** it is `POST /agent-credentials/current/renewal` with the current credential as `Authorization: Bearer`, no body, no envelope, and `Soorma-Contract-Version: 0.1.0`; the renewed credential is used for every later call (FR-05, FR-06) | [C] [E] |
| 3 | **Given** renewal answers `401 credential_expired` at the end of the lineage, **when** the SDK sees it, **then** it bootstraps again through the secret provider, and the new lineage's credential replaces the old (FR-05) | [C] |
| 4 | **Given** renewal answers `401 credential_refused` (the credential or its agent was revoked), **when** the SDK sees it, **then** it surfaces the Problem and does **not** bootstrap again, since revocation is terminal (FR-13; PF FR-011) | [C] |
| 5 | **Given** renewal answers `503` with `Retry-After`, **when** the SDK sees it, **then** it retries within the retry bound and before `expiresAt`, and surfaces the Problem if it cannot (FR-13) | [C] |
| 6 | **Given** the client is running, **when** I inspect the process's files and the SDK's storage, **then** the credential was never written to disk or any durable store (FR-06; OB-9) | [C] |
| 7 | **Given** I close the client, **when** closing completes, **then** no renewal timer, connection or stream remains open (FR-13; SECURITY-15) | [C] |

### US-04 — Publish an event

**As** an agent developer, **I want** to publish a JSON payload in my environment, **so that**
other agents subscribed there can act on it.

**Requirements**: FR-07, FR-08, FR-10, FR-13 · **Sources**: PF FR-002, §7b, §8a *Publish*, §11
*Draft envelope*, *Populate trace context*, *What the SDK may not populate*; contract
`event-ingest.openapi.yaml`, `envelope.md` · ***Done when* 3, 5**

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** a bootstrapped client and any JSON value as payload, **when** I publish, **then** the SDK sends `POST /events` with `{ draft, payload }`, presenting the credential, and reports `202` as *accepted*, never as *delivered* (FR-10) | [C] [E] |
| 2 | **Given** a publish, **when** the SDK builds the draft, **then** the draft holds exactly `clientContractVersion: "0.1.0"`, `traceContext`, and, only when forwarding, `inbound`; no other member (FR-07) | [C] [E] |
| 3 | **Given** the public draft and publish interface, **when** I look for a way to set `envelopeVersion`, `scope`, `originMode`, `delegatingPrincipal`, `actorChain` or `reBroadening`, **then** there is none (FR-07; PF §11 *What the SDK may not populate*) | [A] |
| 4 | **Given** any publish, **when** the draft is built, **then** it carries a valid W3C `traceparent` (never an all-zero trace or parent id), from the active OpenTelemetry span if there is one and freshly made if not, including when no OpenTelemetry SDK is configured (FR-08) | [C] [E] |
| 5 | **Given** a payload containing `<`, `>`, `&`, `/` and non-ASCII text, **when** the SDK serializes the body, **then** it is compact JSON with none of them escaped, and with no duplicate member names (FR-10) | [C] |
| 6 | **Given** a payload whose numbers are spelled `1.0` and `1e2`, **when** I publish, **then** the body carries those spellings as given; the SDK does not reformat the payload it sends (FR-10; T-3) | [C] |
| 7 | **Given** publish fails with any Problem, `503` included, **when** the SDK sees it, **then** it surfaces the Problem, with `Retry-After` when present, and **never retries** the publish (FR-13; D-11) | [C] |
| 8 | **Given** a payload over 64 KiB, **when** I publish, **then** the platform's `413 payload_too_large` is surfaced as given; the SDK applies no size check of its own that the platform relies on (FR-13, FR-16) | [C] [E] |

### US-05 — Subscribe and receive events

**As** an agent developer, **I want** to subscribe once and receive every event published in my
environment while I am subscribed, **so that** my agent can react to other agents.

**Requirements**: FR-11, FR-12 · **Sources**: PF §8a *Subscribe*, §6; contract
`event-ingest.openapi.yaml`, `envelope.md` *The stream*; soorma-sdk GAP-INT-001 · ***Done
when* 3**

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** a bootstrapped client, **when** I subscribe, **then** the SDK sends `POST /subscriptions` with `{ draft }`, presenting the credential, and opens the event stream; no topic, filter or discovery parameter exists (FR-11; A-1, A-2) | [C] [E] [A] |
| 2 | **Given** an open subscription, **when** another agent in my environment publishes, **then** I receive a Delivery with its envelope, seal and payload (FR-11, FR-12) | [C] [E] |
| 3 | **Given** an open subscription, **when** I publish myself, **then** I receive my own event too (contract `envelope.md` *The stream*) | [C] [E] |
| 4 | **Given** heartbeat comment lines on the stream, **when** they arrive, **then** nothing is surfaced to my code (FR-11) | [C] |
| 5 | **Given** an event published before I subscribed, or while no stream of mine was open, **when** I subscribe, **then** I do not receive it, and the SDK's documentation says delivery is live only, with no durability, ordering, redelivery, acknowledgement or resumption promised (FR-11; GAP-INT-001; contract `pre-release.md` statement 2) | [C] |
| 6 | **Given** a subscribe that fails before the stream opens (`401`, `403`, `503`), **when** the SDK sees it, **then** it surfaces the Problem; on `503` it retries within the bound, honouring `Retry-After` (FR-13; D-11) | [C] |

### US-06 — See every stream boundary

**As** an agent developer, **I want** to see each time a stream ends and a new one begins,
**so that** I know exactly when my agent could have missed events, rather than believing it
never could.

**Requirements**: FR-11, FR-13 · **Sources**: contract `envelope.md` *The stream*;
soorma-sdk GAP-INT-001 (soorma-prd#13) · ***Done when* 3**

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** a subscription whose credential approaches `expiresAt`, **when** the SDK renews, **then** it opens the next stream with the renewed credential before the old one expires, and my code receives an explicit *stream ended* item (with the old stream's `end` code, `superseded`) and an explicit *stream started* item (FR-11; D-10) | [C] |
| 2 | **Given** a stream that ends with `end` `credential_refused`, `unavailable` or `overflow`, **when** it ends, **then** my code receives a *stream ended* item with that code (FR-11) | [C] |
| 3 | **Given** an `end` event with a code the SDK does not know, **when** it arrives, **then** my code receives a *stream ended* item with that code, and the SDK does not fail (FR-11; NFR-05; contract fixture `StreamEnd/valid/unknown-code.json`) | [C] |
| 4 | **Given** a stream that ends without an `end` event (the connection drops), **when** the SDK notices, **then** my code receives a *stream ended* item that says no code was received (FR-11) | [C] |
| 5 | **Given** any boundary, **when** the SDK starts a new stream, **then** it never claims continuity: nothing in the items or the documentation says no event was missed, and no `Last-Event-ID` is sent (FR-11; GAP-INT-001) | [C] |
| 6 | **Given** a stream ended with `credential_refused`, **when** the SDK sees it, **then** it does not open a new stream on a new bootstrap: revocation is terminal (FR-13; PF FR-011) | [C] |
| 7 | **Given** one client, **when** it subscribes, **then** at most one stream per credential lineage is open, except for the moment a replacement supersedes it (FR-11) | [C] |

### US-07 — Read what arrived, whatever it holds

**As** an agent developer, **I want** every Delivery to reach my code with its envelope and
seal intact, whatever the publisher put in it, **so that** a strange payload never costs me the
context I need to act on and forward.

**Requirements**: FR-12 · **Sources**: PF FR-005, §7b, §17 *Compatibility Rules*; contract
`envelope.md` *The Delivery*, `identifiers.md` *Received identifiers are opaque*; handover *A
known risk* · ***Done when* 3**

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** Delivery lines whose members `envelope`, `seal` and `payload` arrive in every order, **when** the SDK reads them, **then** each is extracted correctly, whatever the order (FR-12) | [C] |
| 2 | **Given** a Delivery, **when** I read it, **then** I get the envelope parsed read-only **and** the envelope's exact received text, the seal, and the payload (FR-12) | [C] [E] |
| 3 | **Given** an envelope with unknown fields at every level and an unknown `originMode` value, **when** I read it, **then** no error is raised and the unknown fields are present in what I read (FR-12; PF FR-005; contract fixtures `envelope/valid/unknown-fields-at-every-level.json`, `unknown-origin-mode.json`) | [C] |
| 4 | **Given** received identifiers that the request-side patterns would reject, **when** I read them, **then** they are delivered as given, never syntax-checked (FR-12; fixture `received-identifiers-opaque.json`) | [C] |
| 5 | **Given** a payload, **when** I read it, **then** it is parsed with the language's native numbers, and its exact source text is also available to me (FR-12; D-08) | [C] |
| 6 | **Given** a payload nested deeper than the language's parse-depth bound, **when** it arrives, **then** I still receive the Delivery, with its envelope and seal intact and forwardable, and the payload as raw JSON text, flagged as not parsed. The case tests this at a depth beyond each language's bound, never at a fixed number (FR-12; D-07; NFR-03) | [C] |
| 7 | **Given** a Delivery line that is not JSON, or lacks `envelope` or `seal`, **when** it arrives, **then** my code receives an error item for that Delivery and the stream continues (FR-12; contract fixtures `delivery/invalid/`) | [C] |

### US-08 — Forward the context of the event I act on

**As** an agent developer, **I want** a call I make because of an event to carry that event's
context exactly as I received it, **so that** origin and the actor chain continue across my
hop, and attribution downstream stays whole.

**Requirements**: FR-09, FR-08 · **Sources**: PF FR-005, FR-015, §11 *Forward inbound context*,
§14 *Inbound context forwarding*; contract `envelope.md` *Forwarded context and the seal*

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** a received Delivery, **when** I publish in response through the Delivery-handling interface, **then** the draft carries `inbound: { envelope, seal }` without my code assembling it (FR-09) | [C] [A] |
| 2 | **Given** a received envelope with unknown fields, unusual member order, and numbers spelled `1.0`, **when** the SDK forwards it, **then** `inbound.envelope` in the body sent is **byte-for-byte the envelope text received**, never re-serialized (FR-09, FR-12; PF FR-005) | [C] |
| 3 | **Given** a forwarded call, **when** the SDK forwards, **then** the seal is sent exactly as received (FR-09) | [C] |
| 4 | **Given** a forwarded call, **when** the draft is built, **then** its `traceContext` is this hop's own `traceparent` (and `tracestate` only if this hop has one); the forwarded envelope's `traceparent` is not copied into the draft (FR-08; contract `envelope.md`) | [C] |
| 5 | **Given** the Delivery-handling interface, **when** I want to act without forwarding, **then** I must make a separate, explicit call to do so; forwarding is the default path (FR-09; PF R-4; ID §17 guidance) | [A] |
| 6 | **Given** the platform refuses a forwarded call (`400 invalid_inbound_context`, `400 chain_too_deep`, `403 forbidden`), **when** the SDK sees it, **then** it surfaces the Problem as given and infers nothing about its cause (FR-13) | [C] |

### US-09 — See my agent's operations in my own tracing

**As** an agent developer, **I want** my agent's publishes and receipts to appear as spans in
whatever OpenTelemetry setup my service already has, **so that** I can follow an event from one
agent to another.

**Requirements**: FR-14, FR-08 · **Sources**: PF §7b, §19 step 10; OB-8; soorma-sdk
GAP-INT-002 (soorma-prd#37), worked around as stated · ***Done when* 5**

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** my service has configured OpenTelemetry, **when** my agent publishes and receives, **then** spans are emitted through the OpenTelemetry API, following OpenTelemetry's messaging semantic conventions, with **no soorma-defined span name or attribute** (FR-14) | [C] |
| 2 | **Given** the SDK package, **when** I inspect what it installs or configures, **then** it installs **no exporter and no sampler**; where spans go and whether they are sampled is my configuration (FR-14) | [A] |
| 3 | **Given** I have configured no OpenTelemetry SDK, **when** my agent runs, **then** it works normally, and every draft still carries a valid `traceparent` (FR-08, FR-14) | [C] |
| 4 | **Given** the SDK's documentation, **when** I read about spans, **then** it states the span shape is **unstable** and outside the compatibility guarantee, pending the Observability PRD (FR-14; GAP-INT-002) | [A] |
| 5 | **Given** the end-to-end scenario, **when** A publishes and B receives, **then** the exporter **the test installs** (never one the SDK ships) holds a span whose trace id matches the `traceparent` on the envelope B receives (FR-14 item 4; FR-19) | [E] |

### US-10 — Act on what the platform reports

**As** an agent developer, **I want** every failure the platform reports to reach my code in
one predictable shape, including ones the SDK has never seen, **so that** I can handle them
without the SDK hiding or misreading them.

**Requirements**: FR-13 · **Sources**: contract `errors.md`; PF §9 *Failure Modes*;
SECURITY-15

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** any non-success response, **when** the SDK surfaces it, **then** I get a Problem with its HTTP status, `code`, `Soorma-Request-Id` when present, and its members, including ones the SDK does not know (FR-13; fixtures `problem/valid/`) | [C] |
| 2 | **Given** a Problem with an unknown `code`, **when** it arrives, **then** it is surfaced as given, never mapped to a different code (FR-13; fixture `problem/valid/unknown-code.json`) | [C] |
| 3 | **Given** a response with `Retry-After`, **when** the SDK surfaces it, **then** the value is available on the Problem (FR-13) | [C] |
| 4 | **Given** the retry rules, **when** any operation fails, **then** only bootstrap, renewal and subscribe retry, only on `503`, honouring `Retry-After`, within the bound; publish and every other status are never retried (FR-13; D-11) | [C] |
| 5 | **Given** a network failure (connection refused, reset, timeout), **when** the SDK sees it, **then** it surfaces an error distinguishable from a Problem, with no secret or credential in it, and releases the connection (FR-13; NFR-06; SECURITY-15) | [C] |
| 6 | **Given** a response that is not a Problem where one was expected (for example, an HTML page from a proxy), **when** the SDK sees it, **then** it surfaces an error carrying the status, and does not fail open (FR-13; SECURITY-15) | [C] |

### US-11 — Start a new agent from the example

**As** an agent developer, **I want** a working example of two agents that I can run and then
copy as the start of my own agent, **so that** my first agent works before I have read the
whole interface. I will build example apps on the TypeScript SDK first.

**Requirements**: FR-20, FR-19 · **Sources**: the brief, *Developer-visible outcome*; D-13 ·
**Shows *done when* 2, 3, 5**

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** a running soorma-core and the set-up its README names (two agents registered in one environment, a secret each, done as raw calls outside the package), **when** I run the example, **then** agent B, subscribed, receives what agent A publishes, and the example prints the envelope B received and the trace id (FR-20) | [E] |
| 2 | ⚑ **TypeScript only, by design** (your note): **Given** the TypeScript example, **when** I copy its agent file into a new project and install the SDK package from this repository, **then** it builds and runs as a single agent, with every value I must change (S3 and S4 addresses, CA, agent identifier, secret source, instance identifier) in one clearly marked configuration block, and nothing else to edit (FR-20) | [E] ⚑ |
| 3 | **Given** the Python example, **when** I do the same, **then** the same holds in Python (FR-20). *The counterpart of criterion 2, so the property is checked in both languages, but by two criteria, not one* | [E] |
| 4 | **Given** the example's code, **when** I read it, **then** it uses only the SDK's public interface; the human set-up steps live in a separate script, not in the agent file, and the agent file holds no human credential (FR-20; OB-19) | [A] |
| 5 | **Given** the example's README, **when** I follow it, **then** it states that delivery is live only (start B before A publishes) and that the span shape is unstable (GAP-INT-001, GAP-INT-002) | [A] |

---

## P2 — SDK maintainer

### US-12 — Keep the contract copy pinned

**As** an SDK maintainer, **I want** the vendored contract to be provably the one at its tag,
**so that** both languages build against exactly what soorma-core published, and a change can
only come from the contract's owner.

**Requirements**: FR-01, FR-18 · **Sources**: the brief, *Consumes*, *Order and the shared
contract*; contract README *Using it*; I7

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** the vendored `contract/`, **when** CI runs, **then** a check compares every vendored file with soorma-core at `contract-v0.1.0` and fails on any difference, addition or removal (FR-01) | [C] |
| 2 | **Given** the vendored contract, **when** each language builds, **then** its types are generated from the copy, and a check fails if the committed generated types differ from what the copy generates (FR-01, FR-18) | [C] |
| 3 | **Given** the repository's documentation for maintainers, **when** the contract is insufficient, **then** it says to raise it against the soorma-core initiative and never to edit the copy (FR-01) | [A] |

*Note*: criterion 1 is one check for the repository, not per language; criterion 2 runs per
language. Both are mechanical, so neither is flagged.

### US-13 — One behaviour, stated once

**As** an SDK maintainer, **I want** one language-neutral behaviour specification, **so that**
a question about what the SDK does has one answer, whatever the language.

**Requirements**: FR-02, FR-17 · **Sources**: RA Q1 X

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** the behaviour specification, **when** I read it, **then** it states each PF §11 operation and trace emission, the Problem codes surfaced, the retry rules, stream boundaries, the deep-payload fallback, exact forwarding, the span rules, and the naming convention (FR-02) | [A] |
| 2 | **Given** each statement in the specification, **when** I look for its check, **then** it names the conformance cases that check it, and every case names the statement it checks (FR-02, FR-03) | [C] |
| 3 | **Given** the naming convention, **when** I compare the two public interfaces, **then** every operation and concept has the same name under the convention, differing only in each language's casing (FR-17) | [A] |

### US-14 — Bring a language to conformance

**As** an SDK maintainer, **I want** a language-neutral conformance suite and a runner per
language, **so that** a language is complete exactly when it passes every case, and a third
language can be added against the same files.

**Requirements**: FR-03, FR-18 · **Sources**: RA Q1 X, Q3 A

| # | Criterion | Check |
|---|---|---|
| 1 | **Given** the conformance suite, **when** I read a case file, **then** it is language-neutral data (scripted platform responses, inputs, expected observable outputs) with no code in any one language (FR-03) | [C] |
| 2 | **Given** each language's runner, **when** CI runs, **then** every case runs in TypeScript and in Python, and CI fails if either language skips or fails any case (FR-03; NFR-10) | [C] |
| 3 | **Given** the contract's fixtures, **when** the suite is built, **then** every valid and invalid fixture relevant to an agent operation (draft, envelope, delivery, inbound, problem, data-gateway, event-ingest) is used by at least one case (FR-03) | [C] |
| 4 | **Given** the end-to-end scenario, **when** CI runs, **then** it runs in both languages against soorma-core built at `contract-v0.1.0`, and fails if either language fails (FR-19; D-12) | [E] |

---

## *Done When* Proofs

The end-to-end scenario (FR-19) is the acceptance of the journey stories (Q6 A), run in both
languages. M1 needs one language (TypeScript); this initiative's Build and Test needs both.

| *Done when* | Made up of | E2E step |
|---|---|---|
| 2 — each instance bootstraps and receives a short-lived credential | US-02 #1, #5; US-03 #1, #2 | 2 |
| 3 — A publishes; B, subscribed, receives it | US-04 #1, #2, #8; US-05 #1 to #3; US-07 #2 | 3 |
| 5 — trace context travels; a trace is emitted | US-04 #2, #4; US-09 #5 | 4 |
| 1, 4, 6, 7 | soorma-core's, proven with raw calls (brief) | — |

---

## Traceability: Requirements to Stories

| Requirement | Stories |
|---|---|
| FR-01 | US-12 |
| FR-02 | US-13 |
| FR-03 | US-13, US-14 |
| FR-04 | US-02 |
| FR-05 | US-03 |
| FR-06 | US-01, US-02, US-03 |
| FR-07 | US-04 |
| FR-08 | US-04, US-08, US-09 |
| FR-09 | US-08 |
| FR-10 | US-04 |
| FR-11 | US-05, US-06 |
| FR-12 | US-05, US-07, US-08 |
| FR-13 | US-02 to US-08, US-10 |
| FR-14 | US-09 |
| FR-15 | US-01 |
| FR-16 | US-01, US-04, US-11 (as criteria) |
| FR-17 | US-13 |
| FR-18 | US-12, US-14 |
| FR-19 | US-09, US-11, US-14 (and the *done when* table) |
| FR-20 | US-11 |
| NFR-02 | US-03 |
| NFR-03 | US-07 |
| NFR-05 | US-02, US-06, US-07 |
| NFR-06 | US-02, US-10 |

Every FR maps to at least one story. NFR-01, NFR-04, NFR-07 to NFR-11 are sized or checked at
later stages and carry no story of their own.

---

## Checks Flagged

**[A], per-language API checks** (16 criteria): US-01 #1, #2, #4, #5; US-02 #2; US-04 #3;
US-05 #1; US-08 #1, #5; US-09 #2, #4; US-11 #4, #5; US-12 #3; US-13 #1, #3. Each is checked
in **both** languages, but by each language's own test or review, not a shared case file,
because it is a property of the interface or the documentation, not of behaviour. These are
where drift is not caught by one shared file. US-13 #3 (one naming convention, checked by
comparing the two interfaces) is the guard for them.

**⚑ one language only** (1 criterion): US-11 #2, the TypeScript starter, as you asked. Its
Python counterpart is US-11 #3.

---

## Specification-Gap Pass (plan step 9)

Writing the criteria raised these questions. Each was classified per
`prd-gap-classification.md`. **No new specification gap.**

| Ref | Question | Outcome | Reasoning |
|---|---|---|---|
| T-5 | Does the SDK offer a default instance identifier when the developer gives none? | **Technology** | PF FR-009: the identifier is asserted, not verified; the contract records it and never enforces it unique (`identifiers.md`). Any value matching `InstanceIdentifier` is valid. The constraint is that it is never host-derived (PF FR-022, I3, I10). Decided at Application Design (US-01 #4) |
| T-6 | Should the SDK expose the credential's `environment` reference? | **Technology** | The contract returns it on `AgentCredential`; PF FR-022 says scope comes from the credential, which exposing it read-only respects. Configuring or sending one is what is forbidden (US-02 #2) |
| A-5 | Is a forwarded call's span a child of, or linked to, the received envelope's trace? | **Inside soorma-sdk GAP-INT-002** | Its *What the build needs* already lists it. The work-around follows OpenTelemetry's messaging conventions, which answer it. No new gap |
| A-6 | Does PF FR-001 require an envelope on bootstrap and renewal, which the contract omits? | **Inherited**: soorma-core GAP-INT-008, soorma-prd#27, open | The SDK follows the contract at `0.1.0` (coverage map, *Gaps Inherited Through the Contract*). Not re-raised |
| A-7 | Does a subscriber receive its own publishes? | **Answered by the contract** (`envelope.md` *The stream*); PF §8a does not exclude it | US-05 #3 |
| T-7 | How does renewal account for clock skew between client and platform? | **Technology** | `expiresAt` is the authority (contract). Headroom is sized at NFR Requirements (NFR-02) |
