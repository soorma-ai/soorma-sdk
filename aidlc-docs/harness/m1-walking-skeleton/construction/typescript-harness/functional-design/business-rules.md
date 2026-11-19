# Business Rules — U3 `typescript-harness`

U3 implements U1's specification (`spec/behaviour.md`) in TypeScript and changes none of its
statements, except by adding REN-07 (§6, the user's design change). The rules below are what is
**TypeScript's**: how each statement is met in the language, and the four choices the
specification left to each language unit:
- SEC-09 (Windows);
- RCV-08 (the typed envelope);
- the depth bound's mechanism;
- the resource idiom.

Each rule cites the statements it implements. Answers: U3-FD-Q1 to Q9 (audit
2026-11-19T04:23:22Z).

**Verification column**:
- The cases (`CC-…`) run under the TypeScript driver (C-21), on Node 24 and 26.
- The `TC-TH-…` cases are U3's test specifications: 001 to 066 are from inception; 067 on are
  **planned here** for QA enrichment (business-logic-model §11).
- Unit tests are the package's own Vitest suite.

## 1. The Surface — `TH-API`

| # | Rule | Implements | Verification |
|---|---|---|---|
| TH-API-01 | `@soorma/sdk` exports **exactly** the name table's TypeScript column (domain-entities §2) and nothing else; `index.ts` is the only entry point | NAM-01 | CC-NAM-01; the names check (`pnpm checks`); TC-TH-060 |
| TH-API-02 | `new AgentClient(options)` checks only that each option is present and of its type (`TypeError` otherwise), **contacts nothing**, and calls no provider. Values are not syntax-checked | CFG-01, ACQ-09 | CC-CFG-01; TC-TH-001 |
| TH-API-03 | `AgentClientOptions` has no environment, TLS switch, logger, human or delegation credential, or platform-stamped field, so none can be supplied. An unknown option member is a `TypeError`, so a misspelt `rejectUnauthorized` cannot pass silently | CFG-02, CFG-04, CRD-05, NEV-01 to NEV-03 | CC-CFG-02, CC-NEV-01; TC-TH-002, 004 |
| TH-API-04 | `client.credential` returns `CredentialInfo` while *started*, a frozen copy of the returned details. Otherwise it raises `ClientStateError`, carrying the Problem when revoked. No property, `toString`, `toJSON` or `util.inspect` form of the client, its details or any error holds the credential | CRD-03, CRD-04, ACQ-07, CDI-01 | CC-CRD-01, CC-CRD-02; TC-TH-020, 021 |
| TH-API-05 | The SDK reads **no environment variable** and nothing about the host: no `process.env`, `os.hostname()` or `os.networkInterfaces()` anywhere in the package (a lint rule enforces it) | CFG-05, CFG-07; I3, I10 | CC-CFG-06; TC-TH-006 |

## 2. The Secret Provider — `TH-SEC`

| # | Rule | Implements | Verification |
|---|---|---|---|
| TH-SEC-01 | `fileSecret(path)` returns a provider. **Each call** does the following:<br>1. opens the path with `O_RDONLY \| O_NONBLOCK` (following symbolic links to the final file);<br>2. calls `stat()` **on the opened handle**;<br>3. refuses, without reading, a handle that is not a regular file, has mode bits `0o020`, `0o002` or `0o004`, or is owned by anyone but `process.getuid()` or `0`;<br>4. reads, removes **one** trailing `\n` or `\r\n`, and closes the handle in `finally`;<br>5. keeps nothing between calls | SEC-04 to SEC-07; CDI-03 | CC-SEC-03 to CC-SEC-07; TC-TH-012 to 015 |
| TH-SEC-02 | **On Windows** (`process.platform === 'win32'`), the provider raises `SecretSourceError` with reason `unsupported-platform` and the path, **without opening it**. POSIX modes and owners cannot be checked there, and SEC-09 forbids reading a file that cannot be checked. The README says that Windows tenants supply their own provider. The rest of the package is not refused on Windows; M1 tests it on Linux and macOS only | SEC-09 (defined here for TypeScript); U3-FD-Q2 | Unit test with the platform stubbed; TC-TH-067 |
| TH-SEC-03 | A refusal is `SecretSourceError` with `path` and `reason`, **never the contents**. A tenant provider that throws, rejects or returns a non-string raises `SecretSourceError` (reason `provider-failed`, no path) **without the provider's error attached**, because it may hold anything. No request is sent | SEC-08; NFR-06 | CC-SEC-04, CC-SEC-08; TC-TH-013 |
| TH-SEC-04 | The provider is called **once per bootstrap**, in `keeper.ts` only. The secret string goes straight into the request body. Every SDK reference to the secret and to the body is dropped once the request is written, so the heap snapshot (CDI-02) finds no occurrence after a forced collection | SEC-01, SEC-02; CDI-02 | CC-SEC-01, CC-ACQ-01; TC-TH-008 |

## 3. Reading a Delivery — `TH-RD` (U3-FD-Q1)

| # | Rule | Implements | Verification |
|---|---|---|---|
| TH-RD-01 | **A scanner reads each `delivery` event's data once.** It walks the outer object, respecting strings and escapes, and records for each member its name and the raw text span of its value, plus the maximum nesting depth of each value. It builds no value. If the data is not an object, does not end where its last value ends, or lacks `envelope` (an object), `seal` (a string) or the `payload` member, the result is a `DeliveryError` with its reason and the line's text, and the stream continues | RCV-01, RCV-07 | CC-RCV-01, CC-RCV-07; TC-TH-046, 051; unit tests over the contract's delivery fixtures |
| TH-RD-02 | **A duplicate `envelope`, `seal` or `payload` member** makes the line ambiguous: a `DeliveryError` (reason `duplicate-member`). Other duplicate members of the outer object are ignored. *A TypeScript choice*: `JSON.parse` would silently take the last one | RCV-07 | Unit test; TC-TH-068 |
| TH-RD-03 | `envelopeText` and `payloadText` are the **exact spans**, never re-serialized. `envelope` is `JSON.parse(envelopeText)`, deep-frozen, with unknown members kept. **An envelope nested deeper than `D_lang`** is a `DeliveryError` (reason `envelope-too-deep`), so the platform's envelope can never exhaust the stack | RCV-02, RCV-03, RCV-04 | CC-RCV-02, CC-RCV-03, CC-RCV-04; TC-TH-045, 047, 048 |
| TH-RD-04 | **The payload is parsed only when its depth is within `D_lang`**, with `JSON.parse` and native numbers. Deeper, the Delivery is yielded with the envelope and seal intact and forwardable, `payload` absent, `payloadText` kept, and `payloadParsed: false` | RCV-05, RCV-06, FWD-06; D-07; NFR-03 | CC-RCV-05, CC-RCV-06; TC-TH-049, 050 |
| TH-RD-05 | **The envelope is never schema-validated** (DEC-U1-09). **Every member of the `Envelope` type is optional** (U3-FD-Q4), and its documentation says the values are as sent, unchecked | RCV-08; CDI-04 | CC-RCV-08; the type's declaration; TC-TH-069 |

## 4. Publishing and Forwarding — `TH-PUB`

| # | Rule | Implements | Verification |
|---|---|---|---|
| TH-PUB-01 | **A payload JSON cannot carry faithfully is refused before any request** (U3-FD-Q5), by a `TypeError` naming the path to the offending value (`$.a[2].b`) and its kind, **never the value**. Refused:<br>- non-finite numbers;<br>- `undefined`, functions, symbols, `bigint`;<br>- cycles;<br>- objects that are not plain objects or arrays (so no `toJSON` call);<br>- **nesting deeper than `D_lang`**.<br>**The depth refusal narrows PUB-04** ("any JSON value, sent as given") for TypeScript; the completion message asks the user to confirm it | PUB-04 (narrowed); FR-10 | Unit tests; TC-TH-070 |
| TH-PUB-02 | The body is assembled as text: `{"draft":…,"payload":…}`. The draft and payload come from `JSON.stringify`, which escapes no HTML or non-ASCII. When forwarding, the received `envelopeText` is **spliced byte for byte** as `inbound.envelope`. No member can repeat by construction | PUB-01, PUB-03, FWD-02 | CC-PUB-01, CC-FWD-02; TC-TH-029, 033 |
| TH-PUB-03 | `delivery.publish(payload)` forwards (`inbound: { envelope, seal }`); `client.publish(payload)` never does. A publish is **never retried** | FWD-01, FWD-04, PUB-05, PRB-10 | CC-FWD-01, CC-FWD-06, CC-PUB-03; TC-TH-028, 030, 034 |

## 5. Closing and Process Lifetime — `TH-LIFE` (U3-FD-Q3)

| # | Rule | Implements | Verification |
|---|---|---|---|
| TH-LIFE-01 | `close()` on the client and on a subscription is **idempotent**. It resolves once every stream, in-flight request (aborted through an `AbortController`) and timer is released. `[Symbol.asyncDispose]` calls `close()`, so `await using` works | SUB-07, PRB-07 | CC-SUB-07, CC-PRB-07; TC-TH-054 |
| TH-LIFE-02 | **Leaving a `for await` early** (`break`, `return`, a throw) calls the iterator's `return()`, which closes the subscription | SUB-07 | Unit test; TC-TH-071 |
| TH-LIFE-03 | **The renewal timer does not keep Node alive** (`unref`). An open stream or request does, as any socket does | PRB-07 | Unit test (a child process exits after `close()` and after dropping a closed client); TC-TH-071 |
| TH-LIFE-04 | After `close()`, every operation raises `ClientStateError`. `close()` during `start()` aborts the bootstrap request and leaves the client *closed* | ACQ-07 | CC-ACQ-05; unit test |

## 6. Renewal — `TH-REN`, and the Specification Change REN-07 (U3-FD-Q8)

| # | Rule | Implements | Verification |
|---|---|---|---|
| TH-REN-01 | **REN-07 (new, added to `spec/behaviour.md` §4 at Code Generation)**: after a successful renewal or bootstrap, the next renewal is scheduled **no sooner than `R_min`**, measured on a **monotonic clock**, not the wall clock. If `expiresAt − H_renew` is already past on the wall clock for a credential just received, the SDK emits **one clock-skew warning per lineage**, without the credential, and keeps renewing at the floor. `R_min` joins §0's named values, set at NFR Requirements. **A design gap in U1's specification, not a PRD gap** (the user, 2026-11-19T04:23:22Z) | REN-01 (bounded by), REN-07 | CC-REN-06 (new); TC-TH-072, TC-TH-061 |
| TH-REN-02 | **In TypeScript**, the next renewal is at `max(receivedAt + R_min, now + (expiresAt − H_renew − Date.now()))`:<br>- `receivedAt` and `now` are `performance.now()` (monotonic);<br>- `expiresAt` is compared with `Date.now()` (the wall clock), only to compute the target;<br>- the timer is a `setTimeout`, `unref`'d | REN-01, REN-07 | Unit tests with a fake clock |
| TH-REN-03 | **The warning** is `process.emitWarning(message, { type: 'SoormaWarning', code: 'SOORMA_CLOCK_SKEW' })`. The message says the client's clock appears ahead of the platform's and renewal is held to the floor. It holds no credential, secret or token detail. Emitted once per lineage (a bootstrap starts a new lineage) | REN-07; NFR-06 | CC-REN-06 (the driver reports it); TC-TH-072 |
| TH-REN-04 | **GAP-CAC-001's work-around** (soorma-ai/soorma-core#34): `credential_refused` on a **retried** renewal (PRB-09) is treated as **terminal**, like any `credential_refused`: fail closed | REN-05, PRB-09 | CC-REN-04, CC-PRB-08 |
| TH-REN-05 | REN-02 to REN-06 as stated. Lineage end means a renewal with no later expiry than the previous one. An unrenewed expiry makes the next operation bootstrap. No status API (DEC-U1-05) | REN-02 to REN-06 | CC-REN-01 to 05; TC-TH-017 to 019 |

## 7. Spans — `TH-SPN` (DEC-U1-01; soorma-sdk GAP-INT-002's work-around)

| # | Rule | Implements | Verification |
|---|---|---|---|
| TH-SPN-01 | `@opentelemetry/api` is the **only** OpenTelemetry dependency, with no exporter, sampler or provider. The tracer's scope is the package's name and version. Span names and attributes are OpenTelemetry's messaging conventions only; `messaging.system` is `soorma` (DEC-U1-11) | SPN-01, SPN-05 | CC-SPN-01, CC-SPN-07; TC-TH-055, 056 |
| TH-SPN-02 | **The received context is parsed by the SDK itself**, not through the global propagator, which may be unset. The envelope's `traceparent` is checked for form and becomes a remote `SpanContext` (`trace.setSpanContext(ROOT_CONTEXT, …)`), with `tracestate` through `createTraceState`. Unparseable, it is no context | SPN-03; TRC-03 | CC-SPN-05; TC-TH-027 |
| TH-SPN-03 | **A receive span's parent is set explicitly to the received context, never taken from the active context**, so an ambient span (a decoy) cannot become its parent. The send span of `delivery.publish()` likewise has the received context as parent. Neither links the received context | SPN-03 (DEC-U1-01) | CC-SPN-03; TC-TH-063 (with the decoy) |
| TH-SPN-04 | **Links to tenant code's active span**: the send span of `delivery.publish()` links the active span when it is valid and is not the received context (SPN-03, CC-SPN-04). **The receive span links nothing** while its received context parses, which is SPN-03's text. *Open point*: DEC-U1-01's summary can be read as linking the active span from the receive span too, so the completion message asks the user which governs | SPN-03 | CC-SPN-03, CC-SPN-04; TC-TH-063 |
| TH-SPN-05 | A client `publish` (not forwarding) parents its send span on the active context (ambient) | SPN-04 | CC-SPN-06 |
| TH-SPN-06 | The draft's `traceparent` is the send span's context when valid. Otherwise the SDK generates it: a random span id (`crypto.randomBytes`); the trace id and flags from the received context when forwarding, else a random trace id and flags `00` | TRC-01 to TRC-04; DEC-U1-13 | CC-TRC-01, CC-TRC-02, CC-FWD-04, CC-FWD-05; TC-TH-025 to 027 |

## 8. The Conformance Driver — `TH-DRV` (C-21)

| # | Rule | Implements | Verification |
|---|---|---|---|
| TH-DRV-01 | `typescript/conformance-driver/` speaks the driver protocol (`conformance/README.md`) and uses **only `@soorma/sdk`'s public interface** | FR-03; US-14 #2 | The suite; the names check |
| TH-DRV-02 | The `inspect` heap check **imports U1's `conformance/reference-driver/src/heap.ts`** (U3-FD-Q9): one implementation of the CDI-02 check, U1's file unchanged | CDI-02; SEC-02 | CC-SEC-01 |
| TH-DRV-03 | **Every case is declared**: all 90, plus CC-REN-06, run on Node 24 and 26. A case that fails is judged first (SDK or case) under CDI-05. A case fix is a change to an earlier unit's tests (F42), recorded with its reason | FR-03; CDI-05 | TC-TH-059 |
| TH-DRV-04 | The driver reports each `process.emitWarning` with code `SOORMA_CLOCK_SKEW` through the protocol's warning report (business-logic-model §9) | REN-07 | CC-REN-06 |

## 9. The Example and the End-to-End Test — `TH-E2E` (C-22; FR-19, FR-20; JOB-06)

| # | Rule | Implements | Verification |
|---|---|---|---|
| TH-E2E-01 | **Each agent file has one marked configuration block** with the local stack's values as literals, and exports `run(config)`. Run directly, it calls `run` with the block. Only the public interface is used, and nothing human-side (U3-FD-Q6) | FR-20; US-11 #2 | TC-TH-064, 065 |
| TH-E2E-02 | **The end-to-end test runs both agents in its one process** (U3-FD-Q7): two `AgentClient`s with their own instance identifiers and their own secret files, read through `fileSecret` from the files U2's `setup` wrote (`.e2e/stack.json`), and one test-installed in-memory exporter | FR-19 steps 1 to 4 | TC-TH-061 to 063 |
| TH-E2E-03 | **The decoy span** (the user's addition to U3-FD-Q7): B's `subscribe()` and its consuming loop run inside a separate active span the test creates. The test asserts all of the following:<br>- B's receive span's parent is A's send span, and both equal the envelope's `traceparent` (trace id and parent id);<br>- the parent is **not** the decoy;<br>- the decoy is linked only as the specification says (TH-SPN-04: not, pending the user's ruling).<br>A test that could pass on the ambient context would not prove SPN-03 | SPN-03; DEC-U1-01 | TC-TH-063 (extended at QA enrichment) |
| TH-E2E-04 | **One real renewal** (the user's answer to U3-FD-Q8):<br>1. Before `start()`, the test fakes **only `Date`**, 14 minutes ahead (Vitest, `toFake: ['Date']`).<br>2. It asserts **one renewal from the real S3**: `client.credential.expiresAt` moves.<br>3. It asserts **no second renewal before `R_min`** has passed on the monotonic clock.<br>4. It asserts **the clock-skew warning once**.<br>5. It **restores the real `Date` before closing**.<br>The job's added time is about `2 × R_min`, weighed against AD-13 at NFR Requirements | FR-19 step 2; REN-07 | TC-TH-061 (extended) |
| TH-E2E-05 | **JOB-06**: U2's `e2e` job becomes `e2e-typescript`: `core-up`, `setup`, `prove-stack` (kept), the scenario, then `core-down` (`if: always()`, with the log search on every run). The job's name keeps U1's workflow check (`e2e-*`: no secrets) | JOB-06; NFR-U2-13 | The job; U1's workflow check |

## 10. Changes to Earlier Units — `TH-F42`

| # | Rule |
|---|---|
| TH-F42-01 | Every change U3 makes to U1's specification, cases, runner, reference driver or driver protocol is a **change to an earlier unit's tests (F42)**. Each is listed with its class in the Code Generation plan (code-generation.md *Changes to an Earlier Unit's Tests*) and recorded with its reason in U3's code summary and `audit.md` |
| TH-F42-02 | **Foreseen** (the user's design change):<br>- REN-07 and `R_min` in `spec/behaviour.md`;<br>- CC-REN-06;<br>- the reference driver implementing REN-07 and declaring CC-REN-06;<br>- the driver protocol's warning report;<br>- if needed, a stub time relative to each response (business-logic-model §9).<br>**The self-test's declared fault sets stay unchanged.** The class of each, and the refusal sweep, are Code Generation's |
| TH-F42-03 | **Not foreseen**: a case found wrong when it first runs (CDI-05). It is judged first, never edited quietly; a class 3 change stops for the user |

## Misuse Considered (SECURITY-11)

| Misuse | Rule that stops it |
|---|---|
| A tenant misspells a TLS option to turn verification off | TH-API-03 (an unknown option is a `TypeError`); CFG-04 |
| The secret lingers in the process for a heap dump | TH-SEC-04; CC-SEC-01 |
| A world-readable or swapped-in secret file (a FIFO that blocks) | TH-SEC-01 |
| A Windows path whose permissions cannot be checked | TH-SEC-02 |
| A hostile or broken delivery line exhausting the stack | TH-RD-01, TH-RD-03, TH-RD-04 |
| `NaN` or a `Date` silently changed on the wire | TH-PUB-01 |
| A client with a fast clock flooding S3 with renewals | TH-REN-01, TH-REN-02 (REN-07) |
| An ambient span hijacking the trace a forwarding hop belongs to | TH-SPN-03 |
| The credential printed by `console.log(client)` | TH-API-04 |
