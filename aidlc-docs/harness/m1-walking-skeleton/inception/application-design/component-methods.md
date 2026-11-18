# Component Methods — soorma-sdk, M1

Signatures and purpose only. Business rules (renewal headroom, the retry bound, the depth
bound, span shapes, US-Q1, `fileSecret` on Windows) are Functional Design's and NFR
Requirements'. Every name below is a row of the name table (C-02, `spec/names.md`), which
Functional Design completes. TypeScript first, Python second, as the build order (D-01).

---

## 1. The Name Table (initial rows, Q3 A)

| Concept (specification) | TypeScript | Python | Source |
|---|---|---|---|
| package | `@soorma/sdk` | `soorma` | Q2 X |
| agent client | `AgentClient` | `AgentClient` | Q4 A |
| client options | `AgentClientOptions` | `AgentClientOptions` | FR-15 |
| S3 base URL | `dataGatewayUrl` | `data_gateway_url` | contract `data-gateway` |
| S4 base URL | `eventIngestUrl` | `event_ingest_url` | contract `event-ingest` |
| CA file | `caFile` | `ca_file` | FR-15 |
| logical agent identifier | `agent` | `agent` | contract `exchangeBootstrap` |
| instance identifier | `instance` | `instance` | contract `exchangeBootstrap` |
| secret provider | `SecretProvider`, option `secret` | `SecretProvider`, option `secret` | D-09 |
| file secret provider | `fileSecret` | `file_secret` | Q7 X |
| new instance identifier | `newInstanceId` | `new_instance_id` | Q6 A |
| start (bootstrap) | `start` | `start` | PF §11 *Acquire credential* |
| close | `close` | `close` | Q4 A |
| credential details | `credential` (`CredentialInfo`) | `credential` (`CredentialInfo`) | FR-06; US-02 #2 |
| expiry | `expiresAt` | `expires_at` | contract `AgentCredential` |
| environment reference | `environment` | `environment` | contract `AgentCredential` |
| publish | `publish` | `publish` | PF §8a |
| accepted (publish result) | `PublishAccepted` | `PublishAccepted` | FR-10 |
| subscribe | `subscribe` | `subscribe` | PF §8a |
| subscription | `Subscription` | `Subscription` | Q5 A |
| Delivery | `Delivery` | `Delivery` | contract `Delivery` |
| envelope (parsed) | `envelope` | `envelope` | contract |
| envelope text | `envelopeText` | `envelope_text` | FR-09, FR-12 |
| seal | `seal` | `seal` | contract |
| payload | `payload` | `payload` | contract |
| payload text | `payloadText` | `payload_text` | D-08 |
| payload parsed (flag) | `payloadParsed` | `payload_parsed` | D-07 |
| delivery error | `DeliveryError` | `DeliveryError` | FR-12 |
| stream started | `StreamStarted` | `StreamStarted` | FR-11; D-10 |
| stream ended | `StreamEnded` | `StreamEnded` | FR-11; D-10 |
| end code | `code` | `code` | contract `StreamEnd` |
| terminal (no further stream) | `terminal` | `terminal` | FR-13; PF FR-011 |
| trace context | `traceContext` (`traceparent`, `tracestate`) | `trace_context` (`traceparent`, `tracestate`) | contract `draft` |
| errors | `SoormaError`, `ProblemError`, `TransportError`, `SecretSourceError`, `ClientStateError` | same | FR-13 |
| Retry-After | `retryAfter` | `retry_after` | contract `errors.md` |

## 2. Public Interface

### 2.1 Module functions

| TypeScript | Python | Purpose |
|---|---|---|
| `newInstanceId(): string` | `new_instance_id() -> str` | A random UUID v4; reads nothing about the host (T-5) |
| `fileSecret(path: string): SecretProvider` | `file_secret(path: str \| os.PathLike) -> SecretProvider` | The one provider shipped (Q7 X); checks on each call, then reads |

### 2.2 Types the tenant supplies

```text
TypeScript
  type SecretProvider = () => Promise<string>
  interface AgentClientOptions {
    dataGatewayUrl: string;   // S3 base URL
    eventIngestUrl: string;   // S4 base URL
    caFile?: string;          // path to a PEM CA, trusted in addition to the system store
    agent: string;            // logical agent identifier
    instance: string;         // instance identifier, asserted
    secret: SecretProvider;
  }

Python
  SecretProvider = Callable[[], Awaitable[str]]
  @dataclass(frozen=True)
  class AgentClientOptions:
      data_gateway_url: str
      event_ingest_url: str
      agent: str
      instance: str
      secret: SecretProvider
      ca_file: str | None = None
```

No option names an environment, a human credential, a delegation credential, a stamped field,
or TLS verification (FR-15, FR-16).

### 2.3 `AgentClient`

| TypeScript | Python | Purpose | Story |
|---|---|---|---|
| `new AgentClient(options)` | `AgentClient(options)` | Creates the client; contacts nothing | US-01 #1 |
| `start(): Promise<void>` | `async start() -> None` | Bootstraps (one provider call) and starts renewal | US-02 |
| `close(): Promise<void>` | `async close() -> None` | Ends every stream and timer; idempotent | FR-13 |
| `credential: CredentialInfo \| undefined` | `credential: CredentialInfo \| None` (property) | `agent`, `instance`, `environment` (`organization`, `project`, `environment`), `expiresAt`; read only; never the credential string | US-02 #2 |
| `publish(payload: JsonValue): Promise<PublishAccepted>` | `async publish(payload: JsonValue) -> PublishAccepted` | Publishes **without** forwarding: the deliberate, separate call | US-04; US-08 #5 |
| `subscribe(): Subscription` | `subscribe() -> Subscription` | Opens the subscription; iterate to receive | US-05 |

`PublishAccepted` carries the `traceContext` the draft carried, so the example can print the
trace id. It says *accepted*, never *delivered* (FR-10).

Resource management in each language's idiom (TypeScript `Symbol.asyncDispose`, Python
`async with`) is Functional Design's to confirm; each maps to `close()`.

### 2.4 `Subscription` and its items (Q5 A)

| TypeScript | Python | Purpose |
|---|---|---|
| `[Symbol.asyncIterator](): AsyncIterator<SubscriptionItem>` | `__aiter__()` / `__anext__()` | Yields items in order; finishes after a terminal end or `close()` |
| `close(): Promise<void>` | `async close() -> None` | Ends this subscription's streams |

```text
SubscriptionItem =
  Delivery        kind "delivery"
  DeliveryError   kind "deliveryError"   (Python class DeliveryError)  a line that could not be read
  StreamStarted   kind "streamStarted"   a new stream is open; nothing promised about the gap
  StreamEnded     kind "streamEnded"     code: string | null (null: no end event received);
                                         terminal: boolean
```

TypeScript discriminates on `kind`; Python on the class (`match item: case Delivery(): …`).

### 2.5 `Delivery`

| TypeScript | Python | Purpose | Story |
|---|---|---|---|
| `envelope: ReadonlyEnvelope` | `envelope: Envelope` (read only mapping) | Parsed; unknown fields and values kept | US-07 #2, #3 |
| `envelopeText: string` | `envelope_text: str` | Exact received text, forwarded as is | US-07 #2; US-08 #2 |
| `seal: string` | `seal: str` | As received; never checked by the SDK | US-08 #3 |
| `payload: JsonValue \| undefined` | `payload: JsonValue \| None` | Native numbers; absent when not parsed | US-07 #5 |
| `payloadText: string` | `payload_text: str` | Exact source text, always present | US-07 #5, #6 |
| `payloadParsed: boolean` | `payload_parsed: bool` | `false` beyond the depth bound | US-07 #6 |
| `publish(payload: JsonValue): Promise<PublishAccepted>` | `async publish(payload) -> PublishAccepted` | Publishes **forwarding this Delivery's context**: the default path | US-08 #1 |

### 2.6 Errors

| Type | Carries | Raised by |
|---|---|---|
| `SoormaError` | base of all below | — |
| `ProblemError` | `status`, `code` (open set), `title`, `detail`, `retryAfter`, `problem` (every member) | any non-success response |
| `TransportError` | the cause (connection, TLS) | C-15 |
| `SecretSourceError` | `path` (for `fileSecret`) and `reason`; never the value | C-13, a tenant provider's failure |
| `ClientStateError` | the state, and the `ProblemError` that ended the client if any | an operation the state forbids |

## 3. Internal Methods (both languages, same names under the table)

| Component | Method | Purpose |
|---|---|---|
| C-14 Credential keeper | `bootstrap()`, `renew()`, `current()`, `onNewCredential(listener)`, `stop()` | Acquire, renew, hold, announce |
| C-15 Transport | `post(target, path, body, { credential?, retry? })`, `openStream(target, path, body, credential)` | Every request; the event stream |
| C-16 Draft builder | `draft({ span, inbound? })` | The only maker of drafts |
| C-17 Stream supervisor | `run()`, `replaceStream(credential)` | Streams across renewal; items in order |
| C-18 Delivery reader | `read(line): Delivery \| DeliveryError` | Order-independent extraction; fallback |
| C-19 Tracing | `publishSpan()`, `receiveSpan(delivery)` | OpenTelemetry API only |

## 4. The Conformance Driver Protocol (C-21, Q8 A)

JSON lines. The runner writes one command per line to the driver's stdin; the driver writes
one observation per line to stdout, each answering its command's `id`.

```text
command      {"id": n, "op": "<op>", "args": {...}}
observation  {"id": n, "ok": true, "result": {...}}
           | {"id": n, "ok": false, "error": {"type": "ProblemError", "code": "...", ...}}
```

| `op` | Public call made | `result` |
|---|---|---|
| `create` | `new AgentClient(options)`; the secret provider is the driver's, counting calls | `{}` |
| `start` | `start()` | `{credential}` (the public details) |
| `publish` | `publish(payload)` | `{traceContext}` |
| `subscribe` | `subscribe()` | `{}` |
| `next` | the next subscription item, within a timeout | the item, as data |
| `forward` | `delivery.publish(payload)` on a Delivery returned by `next` | `{traceContext}` |
| `close` | `close()` | `{}` |
| `inspect` | **checks the runtime itself**, never lists the driver's own fields (CDI-02): TypeScript forces garbage collection and searches a heap snapshot for the secret's value; Python compares `sys.getrefcount` on the provider's returned string with its value before bootstrap. Also the provider call count and open streams | the findings |
| `names` | the package's exported names | the list (also used by C-04) |

The full command set is the conformance unit's Functional Design. Every assertion is the
runner's.

## 5. End-to-End Commands (C-05)

| Command | Inputs | Effect |
|---|---|---|
| `e2e/core-up` | none | Fresh clone at `contract-v0.1.0`, commit checked, images built, `stack:init`, `stack:up`; writes the single-use fresh-stack marker |
| `e2e/setup --agents a,b --secrets-dir <dir>` | agent names, a directory | Consumes the marker; human steps by raw calls; agents registered in `e`; one `0600` secret file per agent in a `0700` directory; prints the agent identifiers and the S3, S4 and CA locations, never a secret |
| `e2e/core-down` | none | `down -v` on the clone; removes it |
