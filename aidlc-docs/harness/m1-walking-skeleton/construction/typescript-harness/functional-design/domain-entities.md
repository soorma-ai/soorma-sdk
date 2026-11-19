# Domain Entities — U3 `typescript-harness`

U3 is the TypeScript harness: the package `@soorma/sdk`, its conformance driver, and the
example with the end-to-end test. Its behaviour is U1's specification (`spec/behaviour.md`,
cited by statement id). Its public names are U1's name table (`spec/names.md`, TypeScript
column). This file gives their TypeScript shapes and the modules behind them. Answers:
U3-FD-Q1 to Q9 (audit 2026-11-19T04:23:22Z). Technology choices (module format, the C-10
generator, the OpenTelemetry API version, the named values) are NFR Requirements'.

## 1. Locations

| Entity | Path | Published |
|---|---|---|
| **The package** `@soorma/sdk` (C-10 to C-20) | `typescript/` (`typescript/src/`; generated types in `typescript/src/generated/`) | Yes, at a later milestone; built and packaged in M1. The packaging guard checks it (I8) |
| **The conformance driver** (C-21) | `typescript/conformance-driver/` | No: a private workspace package using `@soorma/sdk`'s public interface only |
| **The example** (C-22) | `typescript/examples/two-agents/` (`agent-a.ts`, `agent-b.ts`, `README.md`) | No: a private workspace package |
| **The end-to-end test** (C-22, FR-19) | `typescript/e2e/` | No: run by the `e2e-typescript` job (JOB-06) |

## 2. The Public Surface (the name table, TypeScript column)

Every exported name is a row of `spec/names.md` and nothing else (NAM-01). Members are
`readonly` wherever the specification says read only.

### 2.1 Functions

| Name | Shape | Statements |
|---|---|---|
| `newInstanceId` | `() => string`: a random UUID v4 (`crypto.randomUUID()`), reading nothing about the host | CFG-06 |
| `fileSecret` | `(path: string) => SecretProvider`: each call of the returned provider opens, checks and reads afresh; refused on Windows (U3-FD-Q2) | SEC-03 to SEC-09 |

### 2.2 Types

| Name | TypeScript shape | Statements |
|---|---|---|
| `SecretProvider` | `() => Promise<string>` | SEC-01 |
| `AgentClientOptions` | `{ readonly dataGatewayUrl: string; readonly eventIngestUrl: string; readonly caFile?: string; readonly agent: string; readonly instance: string; readonly secret: SecretProvider }`. No environment, no TLS switch, no logger, no human or delegation credential | CFG-01, CFG-02, CFG-04, CRD-05, NEV-01, NEV-03 |
| `AgentClient` | class: `constructor(options)` (contacts nothing); `start(): Promise<void>`; `close(): Promise<void>`; `[Symbol.asyncDispose](): Promise<void>`; `get credential(): CredentialInfo`; `publish(payload: JsonValue): Promise<PublishAccepted>`; `subscribe(): Subscription` | CFG-01, ACQ, CRD-03, PUB, SUB-01 |
| `CredentialInfo` | `{ readonly agent: string; readonly instance: string; readonly environment: EnvironmentRef; readonly expiresAt: string }`, exactly as returned; **no credential string** in any member or string form | CRD-03, CRD-04, CDI-01 |
| `EnvironmentRef` | `{ readonly organization: string; readonly project: string; readonly environment: string }` | CRD-03 |
| `PublishAccepted` | `{ readonly traceContext: TraceContext }` | PUB-02 |
| `TraceContext` | `{ readonly traceparent: string; readonly tracestate?: string }` | DRF-02 |
| `Subscription` | class implementing `AsyncIterable<SubscriptionItem>` (its iterator's `return()` closes it), `close(): Promise<void>`, `[Symbol.asyncDispose]()` | SUB-01, SUB-07, U3-FD-Q3 |
| `SubscriptionItem` | `Delivery \| DeliveryError \| StreamStarted \| StreamEnded`, told apart by `kind` | STR-01, STR-02, RCV-07 |
| `Delivery` | class: `kind: 'delivery'`; `envelope: Envelope`; `envelopeText: string`; `seal: string`; `payload?: JsonValue`; `payloadText: string`; `payloadParsed: boolean`; `publish(payload: JsonValue): Promise<PublishAccepted>` (forwards) | RCV-02, RCV-05, RCV-06, FWD-01 |
| `DeliveryError` | `{ kind: 'deliveryError'; reason: string; text: string }` | RCV-07 |
| `StreamStarted` | `{ kind: 'streamStarted' }` | STR-01 |
| `StreamEnded` | `{ kind: 'streamEnded'; code: string \| null; terminal: boolean }` | STR-02, STR-03, STR-07 |
| `Envelope` | **every member optional** (U3-FD-Q4; CDI-04): the contract's members, each `readonly` and optional with the contract's type, plus `readonly [member: string]: JsonValue \| undefined` for unknown members. Generated from `envelope.schema.json` with every member made optional (C-10). The documentation says the values are as the platform sent them, unchecked | RCV-03, RCV-08, DEC-U1-09 |
| `JsonValue` | `null \| boolean \| number \| string \| readonly JsonValue[] \| { readonly [k: string]: JsonValue }` | PUB-04, RCV-05 |
| `SoormaError` | base class of the four below; `name` set; **no secret, credential or payload in `message` or any string form** | CRD-04 |
| `ProblemError` | `status: number`; `code: string \| null`; `title?: string`; `detail?: string`; `retryAfter?: number` (seconds); `problem?: Readonly<Record<string, JsonValue>>` (the whole Problem, unknown members kept) | PRB-01 to PRB-03, DEC-U1-14 |
| `TransportError` | `reason`: `'tls' \| 'connection' \| 'unusable-response' \| …` (an open set); no response body | CFG-04, ACQ-08, PRB-08 to PRB-10 |
| `SecretSourceError` | `path?: string`; `reason: string` (`'not-regular-file'`, `'writable-by-group'`, `'writable-by-others'`, `'readable-by-others'`, `'owned-by-another-user'`, `'unsupported-platform'`, `'provider-failed'`, …) | SEC-05, SEC-08, SEC-09 |
| `ClientStateError` | the operation the client's state refused; when revoked, `problem` holds the Problem | ACQ-07, REN-05, SUB-04 |

**Not exported**: no `Symbol.asyncIterator` or `Symbol.asyncDispose` row (protocol members,
listed by the names check as idioms, `spec/names.md`). No S1 or S2 type, and no draft builder,
transport or keeper.

## 3. Internal Modules (C-10 to C-20 in TypeScript)

| Module | Component | Holds | Never |
|---|---|---|---|
| `generated/` | C-10 | Agent-side types from the vendored contract: S3, S4, components, envelope, delivery | An S1 or S2 type |
| `client.ts` | C-11 | `AgentClient`: the state (created → starting → started → revoked or closed), orchestration | An environment setting |
| `options.ts` | C-12 | Option checks (presence and type only); `newInstanceId` | Reading the host or the environment |
| `secrets.ts` | C-13 | `fileSecret`: a non-blocking open, the handle checks, the read, the strip | Keeping a value between calls |
| `keeper.ts` | C-14 | **The one security-critical module** (SECURITY-11): the credential, opaque, in memory; bootstrap; the renewal schedule (REN-01, REN-07: wall-clock target, monotonic floor); lineage; revocation; the clock-skew warning | The secret after the request is sent; the credential in any string form |
| `transport.ts` | C-15 | HTTPS to the configured S3 and S4 only; TLS always verified (system store plus the CA); the contract version header; compact JSON with the forwarded envelope spliced byte for byte; Problem parsing; the retry policy (PRB-05, PRB-08 to PRB-10); `T_req` | A retried publish; a body in an error |
| `draft.ts` | C-16 | The only maker of drafts: `clientContractVersion`, `traceContext` from the send span, `inbound` when forwarding | A platform-stamped field |
| `subscription.ts` | C-17 | `Subscription`: the pull-based buffer (`N_buf`), stream supervision, replacement, boundaries, ends, backoff, `L_ends`, `W_super`, `T_idle` | `Last-Event-ID`; any continuity claim |
| `reader.ts` | C-18 | The delivery-line scanner (U3-FD-Q1): member spans, exact texts, payload depth; `Delivery`, `DeliveryError` | Schema validation of the envelope |
| `tracing.ts` | C-19 | Send and receive spans through `@opentelemetry/api` only (SPN-01 to SPN-07; DEC-U1-01) | An exporter, sampler or provider |
| `errors.ts` | C-20 | The five error classes | A secret, credential or payload in a message |
| `json.ts` | (C-16, C-18) | The payload check before publish (U3-FD-Q5): plain JSON only, a path on refusal | Changing a value |
| `index.ts` | — | The exports: exactly the name table's rows | Any other export |

## 4. The Client's States

```text
created --start()--> starting --200--> started --renewal ok--> started
   |                    |                 |  \--credential_refused (renewal or stream end)--> revoked
   |                    +--failure--------+--> created (start() may be called again: ACQ-06)
   |                                      |
   +--close()--> closed <-----close()-----+
```

Text alternative: a new client is *created* and contacts nothing. `start()` moves it to
*starting*: a failure returns it to *created* (ACQ-06), success makes it *started*. Renewals
keep it *started*. `credential_refused`, on a renewal or as a stream's end, makes it *revoked*
(REN-05, STR-07): terminal, and every later operation raises `ClientStateError` with the
Problem. `close()` from any state makes it *closed*. Operations other than `start()` raise
`ClientStateError` unless the client is *started* (ACQ-07).

## 5. The Credential Lineage (REN-01 to REN-07)

| Field (in memory only, `keeper.ts`) | Meaning |
|---|---|
| credential | the opaque token, presented as `Authorization: Bearer` (CRD-01, CRD-02) |
| details | `agent`, `instance`, `environment`, `expiresAt`, as returned (CRD-03) |
| lineage | a counter, incremented by each bootstrap; the clock-skew warning is once per lineage (REN-07) |
| clock-skew warned | set when the lineage's warning fires; from then on, the lineage's expiry is judged by S3 (`401 credential_expired`), never by the wall clock (REN-07) |
| received at | the monotonic time (`performance.now()`) of the response that delivered the credential |
| renewal timer | the next renewal, at `max(received at + R_min, now + (expiresAt − H_renew − Date.now()))` (REN-01, REN-07); `unref`'d (U3-FD-Q3) |
| previous expiry | for REN-03's "no later expiry" test |

## 6. Example and End-to-End Test (C-22)

| Entity | Shape |
|---|---|
| **An agent file** (`agent-a.ts`, `agent-b.ts`) | One marked configuration block, holding the local stack's values as literals: `dataGatewayUrl: 'https://localhost:8444'`, `eventIngestUrl: 'https://localhost:8446'`, the CA path, `agent`, `secret: fileSecret('./.secrets/agent-a.secret')`, `instance: newInstanceId()`. It exports `run(config)`; run directly, it calls `run` with the block (U3-FD-Q6) |
| **The end-to-end test** | Reads `.e2e/stack.json` (U2's E-07); calls A's and B's `run` (or their parts) in one process with the stack's values; one test-installed in-memory OpenTelemetry exporter; a **decoy span** around B's subscription (U3-FD-Q7); a fast `Date` for the renewal (U3-FD-Q8) |

## 7. The Specification Change U3 Brings (U3-FD-Q8)

| Item | Kind | Where |
|---|---|---|
| **REN-07** | New statement: the monotonic renewal floor `R_min`; one clock-skew warning per lineage; after it, the lineage's expiry is S3's to judge | `spec/behaviour.md` §4; `R_min` added to §0's named values |
| **CC-REN-06** | New conformance case: the renewal floor and the warning | `conformance/cases/ren/CC-REN-06.json` |
| **CC-REN-07** | New conformance case: after the warning, S3 decides the expiry; one bootstrap on `credential_expired` | `conformance/cases/ren/CC-REN-07.json` |
| The reference driver | Implements REN-07 and declares CC-REN-06 and CC-REN-07 | `conformance/reference-driver/` |
| The driver protocol | How a driver reports a warning (business-logic-model §9) | `conformance/README.md`, the runner |

These are changes to an earlier unit's tests and specification (F42). They are recorded with
their class in U3's code summary and `audit.md` at Code Generation (business-rules TH-F42).
**This is a design gap in U1's specification** (the user, 2026-11-19T04:23:22Z), not a PRD
gap: PF §11 and §14 require renewal and leave the client's scheduling to the SDK.
