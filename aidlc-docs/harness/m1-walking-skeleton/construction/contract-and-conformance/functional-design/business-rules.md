# Business Rules — U1 `contract-and-conformance`: the Harness Behaviour Specification

This document is the **design of `spec/behaviour.md`** (FR-02): every statement every language
implements, numbered, sourced, and linked to the conformance cases that check it. Code
Generation transcribes it into `spec/behaviour.md`; the statement ids and case ids do not
change. Case details are in [business-logic-model.md](business-logic-model.md) §6.

**Sources**: requirements FR-04 to FR-17 and NFR-01 to NFR-06; PF @
`prd-platform-foundations-v1.3` (§7b, FR-004 to FR-006, FR-009 to FR-011, FR-022, FR-023, §9,
§11, §14, §17); ID @ `prd-identity-v1.0` (§11 *Prohibitions*); the contract @
`contract-v0.1.0` (`conventions/envelope.md`, `credentials.md`, `errors.md`, `pre-release.md`,
`identifiers.md`; `data-gateway.openapi.yaml`; `event-ingest.openapi.yaml`); the U1
Functional Design answers (audit 2026-11-18T06:57:33Z); AD-01 to AD-15; CDI-01 to CDI-03.

**Words**: *must* is a rule a case checks. *The SDK* is any language package. *Tenant code* is
the code that calls the SDK. *The platform* is soorma-core's S3 and S4.

---

## 0. Values Named for NFR Requirements

These values are **named here and set at NFR Requirements** (U3 and U4, per language where
marked). No statement below fixes a number for them; every case reads them from the driver
(`describe` command) or scripts around them.

| Name | What it bounds | Set at |
|---|---|---|
| `H_renew` | Renewal headroom: how long before `expiresAt` renewal starts (NFR-02), including clock-skew allowance (T-7) | NFR Requirements |
| `R_max`, `W_max` | Retry bound: maximum attempts and maximum total wait for a retried operation (NFR-04) | NFR Requirements |
| `B_init`, `B_factor`, `B_cap` | Backoff when no `Retry-After` is given: initial delay, multiplier, ceiling | NFR Requirements |
| `L_ends` | Consecutive stream ends with no Delivery in between before a subscription becomes terminal (Q4) | NFR Requirements |
| `W_super` | How long after a replacement stream opens the SDK waits for the old stream's `end` (Q3) | NFR Requirements |
| `N_buf` | The subscription's bounded buffer, in items, held Deliveries included (Q6, Q3) | NFR Requirements |
| `D_lang` | The parse-depth bound, per language (NFR-03; D-07) | NFR Requirements, per language |
| `T_idle` | Silence on an open stream after which the SDK treats it as dropped; must exceed the platform's 15-second heartbeat | NFR Requirements |
| `T_req` | Timeout for a request's response head | NFR Requirements |

---

## 1. Configuration — `CFG`

| Id | Statement | Source | Cases |
|---|---|---|---|
| CFG-01 | Creating a client takes the S3 base URL, the S4 base URL, an optional CA file, the logical agent identifier, the instance identifier and a secret provider, and **contacts nothing**: no request, no provider call | FR-15; US-01 #1 | CC-CFG-01 |
| CFG-02 | The client accepts **no environment identifier** and asserts none; scope comes from the presented credential | FR-15; PF FR-022, §17 *Namespacing Rules*; I1, I3 | CC-CFG-02 |
| CFG-03 | Every call goes only to the configured S3 (acquire, renew) or S4 (publish, subscribe) base URL | FR-06, FR-15 | CC-CFG-03 |
| CFG-04 | TLS verification is **always on**. A supplied CA is trusted **in addition** to the system store. A server certificate from no trusted CA fails the call with `TransportError`, before any body is sent. There is no setting that disables verification | FR-15; SECURITY-09 | CC-CFG-04, CC-CFG-05 |
| CFG-05 | No identifier the SDK sends is derived from the host, process, container, cluster, environment variables or deployment metadata; the instance identifier is the one supplied | FR-04, FR-15; PF FR-009, §17; I3, I10 | CC-CFG-06 |
| CFG-06 | `newInstanceId()` returns a random UUID v4, valid as the contract's `InstanceIdentifier`, reading nothing about the host; two calls return different values | AD-06 (T-5) | CC-CFG-07 |
| CFG-07 | The SDK reads **no environment variable**, for any purpose | AD-07; FR-15 | CC-CFG-06 |

## 2. Secret Provider — `SEC`

| Id | Statement | Source | Cases |
|---|---|---|---|
| SEC-01 | A secret provider is a function supplied by tenant code that returns the registration secret. The SDK calls it **exactly once per bootstrap**, and **never** at client creation, renewal, publish or subscribe | D-09; FR-04 | CC-ACQ-01, CC-REN-03 |
| SEC-02 | After a bootstrap's request has been sent, **no reference to the secret's value remains** in the SDK, as the runtime itself shows (CDI-02: business-logic-model §4) | D-09; OB-9; CDI-02 | CC-SEC-01 |
| SEC-03 | The SDK ships exactly one provider, `fileSecret(path)`, and **no provider that reads an environment variable** | AD-07 | CC-SEC-02 |
| SEC-04 | Each call of `fileSecret` **opens the path without blocking** (`O_NONBLOCK` or the language's equivalent), following symlinks to the final file; checks **the opened handle**; and only then reads (CDI-03) | AD-07; CDI-03 | CC-SEC-03, CC-SEC-07 |
| SEC-05 | `fileSecret` **refuses**, without reading the contents, a final file that is: not a regular file (a **named pipe or device is refused, never waited on**); writable by group; writable by others; readable by others; owned by anyone other than the process's user or root | AD-07; CDI-03 | CC-SEC-04, CC-SEC-05, CC-SEC-07 |
| SEC-06 | `fileSecret` **allows a group read** (mode `0440`, `0640`) and follows symlink chains (Kubernetes' `..data`) | AD-07 | CC-SEC-06 |
| SEC-07 | `fileSecret` returns the contents with **one** trailing line ending (`\n` or `\r\n`) removed, and keeps nothing between calls: each call re-checks and re-reads | AD-07 | CC-SEC-03 |
| SEC-08 | A refusal is a `SecretSourceError` naming the **path and the reason**, never the contents. A provider's own failure surfaces from `start()` (or the operation that bootstraps) as `SecretSourceError`, and no request is sent | AD-07; NFR-06 | CC-SEC-04, CC-SEC-08 |
| SEC-09 | On a platform without POSIX modes, `fileSecret`'s behaviour is defined by each language unit's Functional Design (CDI-03; Windows); it never reads a file it cannot check | AD-07 | (U3, U4) |

## 3. Acquire Credential — `ACQ`

| Id | Statement | Source | Cases |
|---|---|---|---|
| ACQ-01 | `start()` sends one `POST {S3}/agent-credentials` with the body exactly `{ "agent", "secret", "instance" }`, the header `Soorma-Contract-Version: 0.1.0`, **no `Authorization` header and no envelope** | FR-04; contract `exchangeBootstrap`, `pre-release.md` 3 | CC-ACQ-01 |
| ACQ-02 | On `200`, the SDK holds the returned credential and its details; `start()` completes | FR-04 | CC-ACQ-01 |
| ACQ-03 | `403 authentication_failed` (wrong secret, unknown or revoked agent: one code for all) ends `start()` with `ProblemError`, **not retried** | FR-13; contract `errors.md` | CC-ACQ-02 |
| ACQ-04 | `429 too_many_attempts` ends `start()` with `ProblemError` carrying `retryAfter`, **not retried** | FR-13 | CC-ACQ-03 |
| ACQ-05 | `503 unavailable` is retried per PRB-05 | D-11 | CC-PRB-04, CC-PRB-05 |
| ACQ-06 | After a failed `start()`, the client is not started; tenant code may call `start()` again, which calls the provider again | Q5 (DEC-U1-05) | CC-ACQ-04 |
| ACQ-07 | `start()` on a started client raises `ClientStateError`; any operation before a successful `start()` raises `ClientStateError` and sends nothing | AD-04 | CC-ACQ-05 |
| ACQ-08 | A `200` whose body is not a usable `AgentCredential` (for example no `expiresAt` or no `instance`) fails `start()` with `TransportError` (reason: unusable response), holds nothing, and is not retried | FR-04; contract `AgentCredential` | CC-ACQ-06 |
| ACQ-09 | `agent`, `instance` and the secret are sent **as given**: the SDK does not syntax-check them (the platform does, and its `400 malformed_request` or `403` surfaces) | FR-16 (enforces nothing); contract `BootstrapMaterial` | CC-ACQ-07 |

## 4. Renew Credential — `REN`

| Id | Statement | Source | Cases |
|---|---|---|---|
| REN-01 | Renewal is scheduled at `expiresAt − H_renew`, computed from **each** response's `expiresAt`, never from a hard-coded lifetime | FR-05; NFR-02; contract `credentials.md` | CC-REN-01 |
| REN-02 | Renewal sends `POST {S3}/agent-credentials/current/renewal` with `Authorization: Bearer {current}`, **no body** and no envelope; on `200`, the returned credential **replaces** the held one for every later call, including the next stream | FR-05 | CC-REN-01 |
| REN-03 | When a renewal's `expiresAt` leaves less than `H_renew` before the lineage can no longer be extended (renewal returned no later expiry than the previous one), the SDK **bootstraps a new lineage** before the current credential expires (one provider call) | FR-05; contract `credentials.md` (24-hour lineage) | CC-REN-02 |
| REN-04 | `401 credential_expired` on renewal: the SDK **bootstraps again** (one provider call) | FR-05 | CC-REN-03 |
| REN-05 | `401 credential_refused` on renewal: **terminal**. The client becomes revoked; no bootstrap follows; every later operation raises `ClientStateError` carrying the Problem; an open subscription ends terminally (STR-07) | FR-13; PF FR-011, §17 *Revocation Behaviour* | CC-REN-04 |
| REN-06 | `503` on renewal is retried per PRB-05 while the credential is valid. Any other failure is not retried. **If the credential expires unrenewed, the next operation bootstraps first** (one provider call; a new lineage), unless the client is revoked (DEC-U1-05) | D-11; Q5 | CC-REN-05 |

## 5. Hold and Present Credential — `CRD`

| Id | Statement | Source | Cases |
|---|---|---|---|
| CRD-01 | The credential is held **in memory only**, opaque: never parsed, decoded, written to disk, cached in a file, or logged | FR-06; OB-9 | CC-CRD-02 |
| CRD-02 | It is presented only as `Authorization: Bearer {credential}`, once per request, only to the configured S3 and S4 | FR-06 | CC-CRD-03, CC-CFG-03 |
| CRD-03 | **The credential's details are exposed read only** (CDI-01): `agent`, `instance`, `environment` (`organization`, `project`, `environment`) and `expiresAt`, exactly as the platform returned them. The client accepts no environment and **only reports what the credential says** (FR-15). No property, method or string form returns the credential string | CDI-01; FR-06, FR-15; PF FR-022 | CC-CRD-01 |
| CRD-04 | Neither the secret nor the credential appears in any log line, error message, exception text, or string form of the client, its details, or any error | NFR-06; SECURITY-03 | CC-CRD-02 |
| CRD-05 | No API accepts, holds or presents a human's sign-in, an environment credential, or a delegation credential | FR-06, FR-16; OB-19; ID §11 | CC-NEV-01 |

## 6. Draft Envelope — `DRF`

| Id | Statement | Source | Cases |
|---|---|---|---|
| DRF-01 | Every draft has exactly `clientContractVersion` `"0.1.0"` and `traceContext`, and `inbound` only when forwarding | FR-07; contract `envelope.md` *The draft* | CC-DRF-01 |
| DRF-02 | `traceContext` in a draft has exactly `traceparent` and, only when there is one, `tracestate` | FR-08; contract | CC-DRF-01, CC-TRC-01 |
| DRF-03 | **No API sets a platform-stamped field** (`envelopeVersion`, `scope`, `originMode`, `delegatingPrincipal`, `actorChain`, `reBroadening`). The SDK does not check drafts as enforcement; the platform rejects one that sets a stamped field | FR-07; PF FR-002, §11 *What the SDK may not populate*; FR-023 | CC-NEV-02 |
| DRF-04 | A `stamped_field_set`, `unknown_field` or `unsupported_contract_version` Problem from the platform is surfaced as given | FR-13 | CC-PRB-01 |

## 7. Populate Trace Context — `TRC`

| Id | Statement | Source | Cases |
|---|---|---|---|
| TRC-01 | Every draft carries a valid W3C `traceparent`, version `00`, lowercase hex, never an all-zero trace id or parent id | FR-08; contract `envelope.md` *Rules checked in code* | CC-TRC-01, CC-TRC-02 |
| TRC-02 | The draft's `traceparent` is **the send span's context** (SPN-02): its trace id and span id. Its `tracestate` is that span context's, when non-empty | FR-08; DEC-U1-01 | CC-TRC-01, CC-FWD-04 |
| TRC-03 | When the span context is not valid (no OpenTelemetry SDK installed), the SDK generates the identifiers itself: a random span id; the trace id is the received context's on a forwarded call (DEC-U1-01, child), otherwise random; trace flags are the received context's on a forwarded call, otherwise `00` (DEC-U1-13) | FR-08 | CC-TRC-02, CC-FWD-05 |
| TRC-04 | On a forwarded call, the draft's `traceparent` is **this hop's assertion**: the received `traceparent` is never copied as the draft's value (its parent id is this hop's span id) | FR-08; contract `envelope.md` *The stamped `traceContext` on a forwarded call* | CC-FWD-04 |

## 8. Forward Inbound Context — `FWD`

| Id | Statement | Source | Cases |
|---|---|---|---|
| FWD-01 | `delivery.publish(payload)` sends a draft with `inbound: { "envelope": …, "seal": … }` from that Delivery; tenant code does not assemble it. **This is the default path** when acting on an event | FR-09; PF R-4; ID §17 | CC-FWD-01 |
| FWD-02 | `inbound.envelope` is **the envelope's received text, byte for byte**, spliced into the body; never re-serialized from the parsed object. Unknown fields, member order, whitespace inside it, and number spellings are preserved | FR-09, FR-12; PF FR-005 | CC-FWD-02 |
| FWD-03 | `inbound.seal` is sent exactly as received; the SDK never checks or interprets it | FR-09; contract *The seal is opaque* | CC-FWD-03 |
| FWD-04 | `client.publish(payload)` **does not forward**: no `inbound`. Dropping context takes this separate call | FR-09; US-08 #5 | CC-FWD-06 |
| FWD-05 | A forwarded call refused with `400 invalid_inbound_context`, `400 chain_too_deep` or `403 forbidden` surfaces that Problem as given, with no inference about its cause, and is **not retried** | FR-13; contract `errors.md` | CC-FWD-07 |
| FWD-06 | A Delivery received with the payload not parsed (RCV-06) forwards exactly as any other | FR-12; D-07 | CC-RCV-06 |

## 9. Publish — `PUB`

| Id | Statement | Source | Cases |
|---|---|---|---|
| PUB-01 | `publish` sends `POST {S4}/events` with `{ "draft": …, "payload": … }` and the current credential | FR-10 | CC-PUB-01 |
| PUB-02 | `202` with no body resolves to `PublishAccepted`, carrying the draft's `traceContext`. It means **accepted**, never delivered | FR-10 | CC-PUB-01 |
| PUB-03 | Request bodies are **compact JSON**: no insignificant whitespace (except inside the spliced forwarded envelope text, FWD-02), **no HTML-safe or other ASCII escaping** (non-ASCII as UTF-8; `<`, `>`, `&` literal), no duplicate member names | FR-10; contract `envelope.md` *The request body limits* | CC-PUB-02 |
| PUB-04 | The payload is any JSON value, sent as given; the SDK does not interpret it | FR-10 | CC-PUB-01 |
| PUB-05 | **A publish is never retried automatically**, whatever the failure (`503` and transport failures included) | D-11 | CC-PUB-03 |
| PUB-06 | `413 payload_too_large` and every other Problem surface as `ProblemError` | FR-13 | CC-PUB-04 |

## 10. Subscribe — `SUB`

| Id | Statement | Source | Cases |
|---|---|---|---|
| SUB-01 | `subscribe()` returns a `Subscription`, an async iterator of items. It sends `POST {S4}/subscriptions` with `{ "draft": … }` and the current credential; there is **no topic, filter or discovery parameter** | FR-11; A-1, A-2 | CC-SUB-01 |
| SUB-02 | Each `delivery` event becomes a `Delivery` item (RCV); heartbeat comment lines are consumed and yield nothing | FR-11 | CC-SUB-01, CC-SUB-02 |
| SUB-03 | A stream receives every Delivery accepted in its environment **after it opened**, the subscriber's own publishes included; nothing earlier. The SDK's documentation states that delivery is **live only**: no durability, ordering, redelivery, acknowledgement, resumption or duplicate suppression is promised (soorma-sdk GAP-INT-001). It also states: **"a Delivery may be delivered twice around a stream boundary; nothing identifies a duplicate (GAP-INT-001)"** | FR-11; contract `pre-release.md` 2; GAP-INT-001 | CC-SUB-03, CC-SPN-08 |
| SUB-04 | **One active subscription per client**: `subscribe()` while one is active raises `ClientStateError`; after it is closed or finished, `subscribe()` works again (DEC-U1-07) | Q7 | CC-SUB-04 |
| SUB-05 | A subscribe that fails before the stream opens: `503` retried per PRB-05; `401 credential_expired` makes the SDK bootstrap and subscribe again (REN-06); `401 credential_refused` is terminal (REN-05); any other Problem ends the subscription: a terminal *stream ended* is **not** yielded for a stream that never opened; the iterator raises the `ProblemError` | FR-13; D-11 | CC-SUB-05 |
| SUB-06 | The SDK reads the stream **only as tenant code pulls items**, through a buffer of at most `N_buf` items (DEC-U1-06). A slow consumer lets the platform's buffer fill; the platform's `overflow` end is surfaced (STR-03) | Q6 | CC-SUB-06 |
| SUB-07 | `subscription.close()` and `client.close()` close the stream; the iterator yields a terminal *stream ended* (no code, `terminal: true`) and finishes | AD-05 | CC-SUB-07 |

## 11. Stream Boundaries — `STR`

| Id | Statement | Source | Cases |
|---|---|---|---|
| STR-01 | When a stream opens, the iterator yields **stream started** before any Delivery from that stream | FR-11; D-10 | CC-SUB-01 |
| STR-02 | When a stream ends, the iterator yields **stream ended** with the `end` event's `code`, or `code: null` when the connection ended without one (including after `T_idle` of silence) or the `end` data carries no string `code` | FR-11 | CC-STR-01, CC-STR-02 |
| STR-03 | **End codes are an open set.** `unavailable`, `overflow`, `superseded` not caused by this SDK's replacement, a dropped connection and **any unknown code** are **non-terminal**: the SDK opens a new stream (STR-06) | FR-11; NFR-05; Q4 (DEC-U1-04) | CC-STR-01, CC-STR-03 |
| STR-04 | **Replacement across renewal**: on a new credential of the same lineage, the SDK opens the next stream with it **before the current credential expires**; the platform ends the old one with `superseded` | FR-11; D-10; contract *The stream* | CC-STR-04 |
| STR-05 | **Boundary order on replacement** (Q3, DEC-U1-03): the iterator yields the old stream's Deliveries read before its end, then **stream ended (old)**, then **stream started (new)**, then the new stream's Deliveries. Deliveries read from the new stream before the old one's end are **held**, counting against `N_buf`. **If the old stream's end has not arrived within `W_super`** after the new stream opened, the SDK **closes the old stream itself**, yields its *stream ended* with `code: null`, then *stream started* and the held Deliveries. On a **lineage change** (REN-03, REN-04, REN-06), no `superseded` will come: the SDK closes the old stream as soon as the new one opens, and yields the same sequence. **At every replacement, renewal or lineage change, a Delivery accepted while both streams are open may be read on both**: the SDK yields it from the old stream (before *stream ended*) and again from the new one (after *stream started*), and **suppresses neither**; nothing identifies a duplicate (DEC-U1-12) | Q3; DEC-U1-03, DEC-U1-12 | CC-STR-04, CC-STR-05, CC-STR-06, CC-STR-11 |
| STR-06 | **Re-subscribing after a non-terminal end** uses backoff (`B_init`, `B_factor`, `B_cap`), **`Retry-After` taking precedence** when the end followed a response that carried one. **Consecutive ends with no Delivery received in between count against `L_ends`**; when it is reached, the iterator yields a **terminal** *stream ended* (the last code) and finishes (DEC-U1-04) | Q4 | CC-STR-07, CC-STR-08 |
| STR-07 | `credential_refused` as an `end` code is **terminal**: *stream ended* with `terminal: true`; the client becomes revoked (REN-05); no bootstrap or subscribe follows | FR-13; PF FR-011 | CC-STR-09 |
| STR-08 | **No continuity is claimed**: no `Last-Event-ID` is ever sent; no item or document says no event was missed between streams | FR-11; GAP-INT-001 | CC-STR-04 |
| STR-09 | At most one stream per credential lineage is open, except while a replacement supersedes the previous one (and, on a lineage change, until the SDK closes the old stream) | FR-11 | CC-STR-10 |

## 12. Receive a Delivery — `RCV`

| Id | Statement | Source | Cases |
|---|---|---|---|
| RCV-01 | A `delivery` event's data is read as one JSON object; `envelope`, `seal` and `payload` are extracted **independently of member order** | FR-12 | CC-RCV-01 |
| RCV-02 | The Delivery exposes the envelope **parsed, read only**, its **exact received text** (`envelopeText`), the **seal**, the **payload** and its **exact source text** (`payloadText`) | FR-12; D-08 | CC-RCV-02 |
| RCV-03 | Unknown fields at every level are kept in the parsed envelope and in its text; an unknown enumerated value (`originMode`) is not an error | FR-12; PF FR-005; §7b | CC-RCV-03 |
| RCV-04 | Received identifiers are **opaque**: never syntax-checked | FR-12; contract `pre-release.md` 8 | CC-RCV-04 |
| RCV-05 | Payload numbers are parsed as the language's native numbers; `payloadText` keeps their exact spelling | FR-12; D-08 | CC-RCV-05 |
| RCV-06 | A payload nested deeper than `D_lang` **never costs the envelope or the seal**: the Delivery is yielded with them intact and forwardable, `payload` absent, `payloadText` present, `payloadParsed: false` | FR-12; D-07; NFR-03 | CC-RCV-06 |
| RCV-07 | A line that is not JSON, not an object, or lacks `envelope` (an object), `seal` (a string) or the `payload` member yields a **delivery error** item (with the reason and the line's text) and **the stream continues** | FR-12 | CC-RCV-07 |
| RCV-08 | Beyond RCV-07, the SDK **does not validate** a received envelope against the schema: an envelope the platform sent is passed through as received (DEC-U1-09). **The typed envelope claims no field is present that the SDK did not check**: each language either types the envelope's members as optional or documents that their presence is unchecked, decided in U3's and U4's Functional Design (CDI-04) | FR-16 (enforces nothing); NFR-05; I7 | CC-RCV-08 |

## 13. Problems and Retries — `PRB`

| Id | Statement | Source | Cases |
|---|---|---|---|
| PRB-01 | Every non-success response raises `ProblemError` with `status`, `code`, `title`, `detail`, `retryAfter` and the whole Problem object. **Unknown codes and extra members are kept** | FR-13; NFR-05; contract `errors.md` | CC-PRB-01 |
| PRB-02 | A non-success response whose body is not a JSON Problem (not JSON, or a `code` or `status` of the wrong type) raises `ProblemError` with its `status`, `code: null`, and no body content (DEC-U1-14) | FR-13; NFR-06 | CC-PRB-02 |
| PRB-03 | `Retry-After` is read whenever present (delta-seconds or HTTP-date) and surfaced as `retryAfter` in seconds | FR-13 | CC-PRB-01, CC-ACQ-03 |
| PRB-04 | `403 forbidden` is surfaced as given; the SDK adds no cause | FR-13; GAP-AE-001 | CC-PRB-03 |
| PRB-05 | **Bootstrap, renewal and subscribe** retry on `503`, waiting `Retry-After` when given, else backoff. Retries stop at `R_max` attempts or `W_max` total wait; the last error is surfaced | D-11; NFR-04 | CC-PRB-04, CC-PRB-05 |
| PRB-08 | **A connection failure with the request not sent** (connection refused, DNS failure, a timeout before the connection opened) is retried with backoff, within the same bound, for **bootstrap, renewal and subscribe** (DEC-U1-10) | D-11; DEC-U1-10 | CC-PRB-06 |
| PRB-09 | **A connection failure after the request was written, with no answer** (reset, or `T_req` timeout after writing) is retried with backoff, within the same bound: **subscribe** always (a repeat is harmless: it supersedes on the same lineage); **renewal** only while the current credential is unexpired (after expiry, REN-06 applies); **bootstrap** always, a repeat possibly minting a credential the SDK never receives, which expires within the contract's 15-minute bound, and **each repeat counting toward the `too_many_attempts` abuse bound** (DEC-U1-10) | D-11; DEC-U1-10; contract `credentials.md`, `exchangeBootstrap` | CC-PRB-08 |
| PRB-10 | **TLS verification failures are never retried**, and **a publish is never retried**, whether or not its request was sent (PUB-05) | D-11; SECURITY-15 | CC-PRB-06, CC-PRB-08, CC-PUB-03 |
| PRB-06 | **Never retried**: any publish; `429`; any `4xx`; `500` | D-11; FR-13 | CC-PUB-03, CC-ACQ-03 |
| PRB-07 | Every error path releases its resources: connections, streams, timers. After `close()`, nothing remains open | FR-13; SECURITY-15 | CC-PRB-07 |

## 14. Tracing and Spans — `SPN` (soorma-sdk GAP-INT-002's work-around)

| Id | Statement | Source | Cases |
|---|---|---|---|
| SPN-01 | Spans are emitted **only through the OpenTelemetry API**, following **OpenTelemetry's messaging semantic conventions** (version pinned at NFR Requirements). **No soorma-defined span name or attribute** | FR-14 | CC-SPN-01 |
| SPN-02 | **Messaging spans only** (DEC-U1-02): a **send** span, kind producer, for every publish (client or forwarded), whose context is the draft's `traceparent` (TRC-02); a **receive** span, kind consumer, for every Delivery, started and ended as the SDK yields the item. No span for bootstrap, renewal or subscribe | FR-14; Q2 | CC-SPN-01, CC-SPN-02 |
| SPN-03 | **US-Q1 (DEC-U1-01)**. A Delivery's receive span, and the send span of a publish **through that Delivery** (forwarding), are **children of the received context** (the envelope's `traceContext`): one trace follows the event across hops. **No link to the received context** when it is the parent. When tenant code has an **active span that is not the received context**, the send span **links to that active span**. A receive or send span whose received `traceparent` cannot be parsed is a root span (and links the active span, if any) | FR-14; US-Q1; the user's answer Q1 | CC-SPN-03, CC-SPN-04, CC-SPN-05 |
| SPN-04 | A client `publish` (not forwarding) follows OpenTelemetry's ambient parenting: its send span is a child of tenant code's active span, if any | FR-14 | CC-SPN-06 |
| SPN-05 | The SDK installs **no exporter, no sampler, no provider**; it depends on the OpenTelemetry API only | FR-14 | CC-SPN-07 |
| SPN-06 | **The span shape is unstable**: outside the SDK's compatibility guarantee until the Observability PRD specifies span semantics (soorma-sdk GAP-INT-002, soorma-prd#37). The documentation of the span shape states this, and states **the deviation**: parenting a forwarding hop's spans on the received context rather than on tenant code's active span departs from OpenTelemetry's usual ambient-context parenting, **so that one trace follows the event across hops** | FR-14; the user's answer Q1 | CC-SPN-08 |
| SPN-07 | A span that ends in a failure records the error status and the Problem code (an OpenTelemetry-defined error attribute only); never a secret, credential or payload | FR-14; NFR-06 | CC-SPN-02 |

## 15. Never — `NEV`

| Id | Statement | Source | Cases |
|---|---|---|---|
| NEV-01 | No human-side operation and no way to hold a human credential; no S1 or S2 types in the package | FR-16; OB-19; ID §11 | CC-NEV-01 |
| NEV-02 | No way to set a platform-stamped field (DRF-03) | FR-07, FR-16 | CC-NEV-02 |
| NEV-03 | No delegation: the `Soorma-Delegation` header is never sent | FR-16; contract `pre-release.md` 6 | CC-NEV-03 |
| NEV-04 | **Enforces nothing**: no SDK check is one the platform relies on; a tenant bypassing the SDK reaches identical enforcement | FR-16; PF FR-023, §11 | (by construction: no case asserts SDK-side refusal of anything the platform checks; CC-RCV-08) |
| NEV-05 | No commercial code | FR-16; PF §11; I8 | (I8 packaging table, Code Generation) |

## 16. Names — `NAM`

| Id | Statement | Source | Cases |
|---|---|---|---|
| NAM-01 | Every exported name is a row of the name table (`spec/names.md`, designed in domain-entities.md §3), in the language's column; every row's name is exported | FR-17; US-13 #3 | CC-NAM-01 |

---

## Decisions

| Id | Decision | Basis | Status |
|---|---|---|---|
| **DEC-U1-01** | **US-Q1: child of the received context.** A forwarding hop's spans (the receive span, and the send span of `delivery.publish()`) are children of the received envelope's trace context; no link to it; a link to tenant code's active span when that span is not the received context. Documented as a deviation from ambient-context parenting in the unstable span shape, with its reason. *Done when* 5 (A → B, one hop) is checked unchanged: A's send span has trace id T, the `traceparent` on B's envelope; B's receive span also has trace id T. **Discharges US-Q1** | The user's answer Q1 (audit 2026-11-18T06:57:33Z); under soorma-sdk GAP-INT-002's work-around | **Decided** |
| DEC-U1-02 | Messaging spans only (send, receive) | Q2 A | Decided |
| DEC-U1-03 | Boundary order: ended (old) before started (new); held Deliveries count against `N_buf`; bounded wait `W_super`, after which the SDK closes the old stream, yields ended with no code, then started and the held Deliveries | Q3 A, with the user's addition | Decided |
| DEC-U1-04 | Non-terminal ends re-subscribe with backoff, `Retry-After` first; consecutive ends with no Delivery count against `L_ends`; terminal at the limit | Q4 A, with the user's addition | Decided |
| DEC-U1-05 | No status API: renewal failures surface on the next operation and as stream ends; an unrenewed expiry makes the next operation bootstrap | Q5 A | Decided |
| DEC-U1-06 | Pull-based subscription with a bounded buffer `N_buf` | Q6 A | Decided |
| DEC-U1-07 | One active subscription per client | Q7 A | Decided |
| DEC-U1-08 | The reference driver covers a declared subset; negative controls are the reference driver with one fault each | Q8 A (business-logic-model §5) | Decided |
| DEC-U1-09 | A received Delivery is checked only structurally (RCV-07); the envelope is never schema-validated by the SDK. The contract's `delivery/invalid/envelope-missing-actor-chain.json` is therefore **delivered as received**, not an error item | Technology/design: FR-16 (enforces nothing), NFR-05 and I7 (a deployed SDK must not reject what a later platform sends). **Follow-on (the user, at review)**: the typed envelope must not claim a field is present that the SDK did not check: optional types, or documented, decided in U3 and U4 (CDI-04; RCV-08) | **Accepted** (2026-11-18T07:15:17Z) |
| DEC-U1-10 | **Connection failures split by whether the request was sent** (the user's correction, 2026-11-18T07:15:17Z). **Not sent** (refused, DNS failure, a timeout before the connection opened): retried for bootstrap, renewal and subscribe; nothing reached the platform, so a retry is a first attempt (PRB-08). **Sent, no answer** (reset, or a timeout after the request was written): the platform may or may not have acted. **Subscribe**: retried; a repeat is harmless, since a later subscribe on the same lineage supersedes the earlier stream. **Renewal**: retried while the current credential is unexpired; the contract describes renewal as "a new token for the same credential" (`renewAgentCredential`). **Bootstrap**: retried; a repeat may mint a credential the SDK never receives, which expires within the contract's 15-minute bound (`credentials.md`), and every attempt counts toward the abuse bound ("Attempts per agent are bounded", `exchangeBootstrap`), so repeats are bounded by `R_max` and surface `429` if they reach it (PRB-09). **Publish**: never retried, sent or not. **TLS verification failures**: never retried (fail closed). **Classification of the contract's silence on repeats** (prd-gap-classification.md Step 1): *subscribe* and *bootstrap* repeats are **technology**: the contract states every consequence a client needs (supersession; a bounded unused credential; an attempt counted). *Renewal* repeats are **not** settled by the contract: it does not say whether a renewal leaves the previous token valid, and the answer decides what a retried renewal's `credential_refused` means (an invalidated token, or a revocation the SDK must treat as terminal). Two engineers cannot both be right about the platform's behaviour, so this is **specification**: **GAP-CAC-001**, routed at the gate. Until it is answered, `credential_refused` on a retried renewal is treated as REN-05 says (terminal; fail closed, never bootstrapping around a possible revocation) | D-11; the user's correction; contract | Decided; **GAP-CAC-001 raised for the renewal case** |
| DEC-U1-11 | `messaging.system`, which OpenTelemetry's messaging conventions require, is set to **`soorma`**. A value of a convention-defined attribute, not a soorma-defined attribute; unstable with the rest of the shape | Inside GAP-INT-002's work-around | Decided here; **flagged at the gate** |
| DEC-U1-12 | **Duplicates at every replacement** (the user's correction, 2026-11-18T07:15:17Z). On a **renewal** replacement, STR-04 opens the new stream before the platform ends the old one with `superseded`; on a **lineage change**, the SDK opens the new stream, then closes the old one itself. Either way a Delivery accepted while both are open can be read on both: the SDK yields both copies, in STR-05's order, and **suppresses neither**; no event id exists to tell them apart. Documented in SUB-03 ("a Delivery may be delivered twice around a stream boundary; nothing identifies a duplicate (GAP-INT-001)") | Design under soorma-sdk GAP-INT-001's work-around: open-then-close prefers a possible duplicate to a certain gap | Decided |
| DEC-U1-13 | Without an OpenTelemetry SDK: random identifiers; trace flags `00` unless continuing a received context | Technology (W3C trace context) | Decided |
| DEC-U1-14 | A non-Problem error body yields `ProblemError` with `code: null` and no body content | Technology; NFR-06 (the body is untrusted and may echo anything) | Decided |

## Specification-Gap Pass

**One new specification gap, GAP-CAC-001** (DEC-U1-10): whether a renewal leaves the previous
agent token valid. Recorded in `../prd-gaps/specification-gaps.md`; raised against soorma-core's wire contract as soorma-ai/soorma-core#34 (routing A, the user); worked around, fail closed.
Otherwise no new specification gap. Every decision above passes the Step 1 test as technology or design
inside an existing work-around: two competent engineers could choose differently and neither
would contradict PF, ID or the contract. DEC-U1-01 and DEC-U1-11 sit inside soorma-sdk
GAP-INT-002 (Awaiting PRD: Observability); DEC-U1-03, DEC-U1-04 and DEC-U1-12 inside soorma-sdk
GAP-INT-001 (Awaiting PRD: Event). Both gaps keep their status.
