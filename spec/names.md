# Name Table

The one naming convention every language follows (FR-17). The names check (`pnpm checks`) compares each
language's exported names and settable members with its column: an export not listed, or a listed
name not exported, fails.

TypeScript: camelCase members and functions, PascalCase types. Python: snake_case members and
functions, PascalCase classes (PEP 8). Wire names (`clientContractVersion`, `traceparent`, end
codes, Problem codes) are data, not exported names, and are not translated.

## Package and functions

| Concept | TypeScript | Python |
|---|---|---|
| package | `@soorma/sdk` | `soorma` |
| new instance identifier | `newInstanceId` | `new_instance_id` |
| file secret provider | `fileSecret` | `file_secret` |

## Types and classes

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

## Members

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
| client state | client state error | `state` | `state` |

Language idioms that map to `close` (TypeScript `Symbol.asyncDispose`; Python `__aenter__` and
`__aexit__`) and to iteration (`Symbol.asyncIterator`; `__aiter__`, `__anext__`) are protocol
members, listed by the names check as idioms, not table rows. So is TypeScript's `toJSON`, which
`JSON.stringify` calls for an object's JSON form: every error has one, and it is not a table row.
