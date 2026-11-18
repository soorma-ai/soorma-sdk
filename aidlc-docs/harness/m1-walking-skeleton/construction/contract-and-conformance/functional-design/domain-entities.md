# Domain Entities — U1 `contract-and-conformance`

Two families: the **conformance domain** U1 builds (§1), and the **SDK concepts** the
specification defines and every language implements (§2). §3 is the complete name table
(`spec/names.md`). Technology-agnostic: file formats are stated as data shapes; libraries are
NFR Requirements'.

---

## 1. The Conformance Domain

| Entity | Attributes | Relationships and constraints |
|---|---|---|
| **Statement** | `id` (area + number, e.g. `STR-05`), text, sources, `cases` (ids) | In `spec/behaviour.md`. Every statement has ≥ 1 case, or an explicit reason it is checked elsewhere (NEV-04, NEV-05, SEC-09). Ids are permanent once published |
| **Case** | `id` (`CC-{AREA}-{nn}`), title, `statements` (ids), `category` (the area), `fixtures` (paths), `values` (named NFR values it reads), `script`, `commands`, `expectations`, `faultTarget` (the negative control that must fail it, if any) | One JSON file per case in `conformance/cases/{area}/`. Every case names ≥ 1 statement; every named statement exists. Language-neutral data: no code |
| **Fixture reference** | path under `contract/fixtures/0.1.0/`, `valid` or `invalid`, shape | Read from the vendored copy, never copied. Every agent-side fixture is referenced by ≥ 1 case |
| **Script** | an ordered list of **exchanges** for the stub | Belongs to one case |
| **Exchange** | `match` (method, path, which occurrence), `respond` (status, headers, body, or a `stream`), `delayMs`, `record` (default true) | A request with no matching exchange is answered `500` and fails the case |
| **Stream script** | ordered SSE actions: `delivery` (data: inline JSON text, a fixture, or a generated deep payload), `heartbeat`, `end` (code), `drop` (close without `end`), `silence` (ms), `waitFor` (another exchange to happen, e.g. the replacement subscribe) | Data is sent **as text**, so member order and number spellings are exactly the case's |
| **Command** | `op`, `args`, `id` | Sent by the runner to the driver; the protocol (business-logic-model §3) |
| **Observation** | `id`, `ok`, `result` or `error` | Sent by the driver; one per command |
| **Expectation** | kind (§1.1), target, matcher | Evaluated by the runner only |
| **Driver** | command line, `describe` (language, runtime, named values, depth bound, coverage) | Language drivers (U3, U4), the reference driver and its faults (U1, test only) |
| **Run** | mode (`full` or `reference`), driver, CA, results per case | Full: every case must pass. Reference: the declared cases must pass; the rest are listed as not run |
| **Fault** | `retain-secret`, `reorder-forwarded-envelope`, `retry-publish`, `skip-boundary` | A reference driver switch; each names the case(s) it must fail |

### 1.1 Assertion kinds

| Kind | Checks |
|---|---|
| `request-exact` | The recorded request body equals given bytes (or a given span of it equals the delivered envelope bytes) |
| `request-shape` | Method, path, headers present or absent, body members exactly a set |
| `request-count` | How many requests matched, in total or in a time window |
| `request-timing` | A request happened before or after a scripted moment (e.g. before `expiresAt`) |
| `observation` | A command's result or error: type, code, status, fields |
| `item-sequence` | The subscription items, in order, by kind and fields |
| `runtime-check` | The driver's `inspect` answer (CDI-02) |
| `span` | The spans the driver's test exporter holds: kind, parent, links, trace id |
| `surface` | The package's exported names and option fields (`names`, `surface` commands) |
| `absence` | Nothing happened: no request, no provider call, no export |

---

## 2. SDK Concepts (defined by the specification, implemented per language)

| Concept | Attributes | Rules |
|---|---|---|
| **Agent client** | options; state (`created`, `started`, `revoked`, `closed`); credential details; one active subscription at most | CFG, ACQ, REN, SUB-04 |
| **Client options** | S3 base URL, S4 base URL, CA file (optional), agent, instance, secret provider | CFG-01, CFG-02 |
| **Secret provider** | a function returning the secret | SEC |
| **Credential** | the bearer string (held, never exposed); its details | CRD |
| **Credential details** | `agent`, `instance`, `environment` {`organization`, `project`, `environment`}, `expiresAt` | CRD-03 (CDI-01): read only |
| **Lineage** | the chain of credentials from one bootstrap through its renewals | REN-03, STR-04, STR-09 |
| **Draft** | `clientContractVersion`, `traceContext` {`traceparent`, `tracestate`?}, `inbound`? {`envelope` (text), `seal`} | DRF, TRC, FWD |
| **Publish accepted** | the draft's `traceContext` | PUB-02 |
| **Subscription** | an async iterator; its current stream; held Deliveries; consecutive-end count | SUB, STR |
| **Stream** | open or ended; its credential's lineage | STR |
| **Item** | one of: **Delivery**, **Delivery error** {`reason`, `text`}, **Stream started**, **Stream ended** {`code` or null, `terminal`} | SUB, STR, RCV |
| **Delivery** | `envelope` (parsed, read only), `envelopeText`, `seal`, `payload`?, `payloadText`, `payloadParsed`; `publish(payload)` (forwarding) | RCV, FWD |
| **Problem** | `status`, `code` (open string or null), `title`, `detail`, `retryAfter`, all members | PRB |
| **Errors** | `SoormaError` ⊃ `ProblemError`, `TransportError`, `SecretSourceError`, `ClientStateError` | PRB, SEC-08, ACQ-07 |
| **Send span**, **receive span** | OpenTelemetry API spans | SPN |

### Lifecycle (from Application Design S-1, refined)

```text
created --start() ok--> started --close()--> closed
   |                      |
   | start() fails        | renewal or end: credential_refused
   v                      v
created (again)         revoked (terminal)
```

`started` covers renewing, re-bootstrapping after an unrenewed expiry (REN-06) and a new
lineage (REN-03); none is visible as a state (DEC-U1-05).

---

## 3. The Name Table (`spec/names.md`)

TypeScript: camelCase members and functions, PascalCase types. Python: snake_case members and
functions, PascalCase classes (PEP 8). Wire names (`clientContractVersion`, `traceparent`, end
codes, Problem codes) are data, not exported names, and are not translated.

### 3.1 Package and functions

| Concept | TypeScript | Python |
|---|---|---|
| package | `@soorma/sdk` | `soorma` |
| new instance identifier | `newInstanceId` | `new_instance_id` |
| file secret provider | `fileSecret` | `file_secret` |

### 3.2 Types and classes

| Concept | TypeScript | Python |
|---|---|---|
| agent client | `AgentClient` | `AgentClient` |
| client options | `AgentClientOptions` | `AgentClientOptions` |
| secret provider | `SecretProvider` | `SecretProvider` |
| credential details | `CredentialInfo` | `CredentialInfo` |
| environment reference | `EnvironmentRef` | `EnvironmentRef` |
| publish accepted | `PublishAccepted` | `PublishAccepted` |
| trace context | `TraceContext` | `TraceContext` |
| subscription | `Subscription` | `Subscription` |
| subscription item | `SubscriptionItem` | `SubscriptionItem` |
| Delivery | `Delivery` | `Delivery` |
| delivery error | `DeliveryError` | `DeliveryError` |
| stream started | `StreamStarted` | `StreamStarted` |
| stream ended | `StreamEnded` | `StreamEnded` |
| envelope (read only) | `Envelope` | `Envelope` |
| JSON value | `JsonValue` | `JsonValue` |
| base error | `SoormaError` | `SoormaError` |
| Problem error | `ProblemError` | `ProblemError` |
| transport error | `TransportError` | `TransportError` |
| secret source error | `SecretSourceError` | `SecretSourceError` |
| client state error | `ClientStateError` | `ClientStateError` |

### 3.3 Members

| Concept | On | TypeScript | Python |
|---|---|---|---|
| S3 base URL | options | `dataGatewayUrl` | `data_gateway_url` |
| S4 base URL | options | `eventIngestUrl` | `event_ingest_url` |
| CA file | options | `caFile` | `ca_file` |
| agent | options, credential details | `agent` | `agent` |
| instance | options, credential details | `instance` | `instance` |
| secret provider | options | `secret` | `secret` |
| start | client | `start` | `start` |
| close | client, subscription | `close` | `close` |
| credential details | client | `credential` | `credential` |
| environment | credential details | `environment` | `environment` |
| organization, project, environment | environment reference | `organization`, `project`, `environment` | `organization`, `project`, `environment` |
| expiry | credential details | `expiresAt` | `expires_at` |
| publish | client, Delivery | `publish` | `publish` |
| subscribe | client | `subscribe` | `subscribe` |
| trace context | publish accepted | `traceContext` | `trace_context` |
| traceparent, tracestate | trace context | `traceparent`, `tracestate` | `traceparent`, `tracestate` |
| item kind | every item | `kind` (`"delivery"`, `"deliveryError"`, `"streamStarted"`, `"streamEnded"`) | the class |
| envelope | Delivery | `envelope` | `envelope` |
| envelope text | Delivery | `envelopeText` | `envelope_text` |
| seal | Delivery | `seal` | `seal` |
| payload | Delivery | `payload` | `payload` |
| payload text | Delivery | `payloadText` | `payload_text` |
| payload parsed | Delivery | `payloadParsed` | `payload_parsed` |
| reason, text | delivery error | `reason`, `text` | `reason`, `text` |
| end code | stream ended | `code` | `code` |
| terminal | stream ended | `terminal` | `terminal` |
| status, code, title, detail | Problem error | `status`, `code`, `title`, `detail` | `status`, `code`, `title`, `detail` |
| Retry-After | Problem error | `retryAfter` | `retry_after` |
| whole Problem | Problem error | `problem` | `problem` |
| path, reason | secret source error | `path`, `reason` | `path`, `reason` |

Language idioms that map to `close` (TypeScript `Symbol.asyncDispose`; Python `__aenter__` and
`__aexit__`) and to iteration (`Symbol.asyncIterator`; `__aiter__`, `__anext__`) are protocol
members, listed by the names check as idioms, not table rows.
