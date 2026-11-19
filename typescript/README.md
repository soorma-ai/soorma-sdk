# @soorma/sdk

The soorma agent SDK for TypeScript. It acquires, renews and presents an agent credential; drafts,
publishes, forwards and subscribes on the data face; and emits spans through the OpenTelemetry API.
It is advisory only: the platform enforces everything.


```ts
import { AgentClient, fileSecret, newInstanceId } from '@soorma/sdk';

const client = new AgentClient({
  dataGatewayUrl: 'https://s3.example.com',
  eventIngestUrl: 'https://s4.example.com',
  agent: 'agent-a',
  instance: newInstanceId(),
  secret: fileSecret('/var/run/secrets/soorma/agent-a.secret'),
});
await client.start();
await client.publish({ hello: 'B' });
for await (const item of client.subscribe()) {
  if (item.kind === 'delivery') console.log(item.envelope, item.payload);
}
await client.close();
```

A runnable two-agent example against soorma-core's local stack is in
[`examples/two-agents/`](examples/two-agents/README.md).

## Requirements

- **Node.js 24 or later.**
- **ESM**, built with `tsc`. `import` it, or `require()` it: Node 24 loads ES modules through
  `require()`, and the package's `exports` map has a `default` entry for that.
- **`@opentelemetry/api` `^1.9.0`**, a peer dependency: your application's copy, so the SDK's
  spans join your traces. The SDK has no other runtime dependency.

## The client

`new AgentClient(options)` checks its options and contacts nothing. Options:

| Option | Meaning |
|---|---|
| `dataGatewayUrl` | The data gateway (S3), `https:` only: credentials |
| `eventIngestUrl` | Event ingest (S4), `https:` only: publish and subscribe |
| `caFile` | Optional: a PEM file of extra CA certificates. TLS is always verified, against the OS store, Node's bundled store and this file; nothing turns verification off |
| `agent` | The agent's identifier, as registered |
| `instance` | This running instance's identifier: `newInstanceId()` makes one |
| `secret` | A secret provider: a function returning the agent's registration secret. `fileSecret(path)` is the one shipped |

An unknown option, a non-string, or a URL that is not `https:` is refused with a `TypeError`. The
SDK reads no environment variable and derives nothing from the host.

- `start()` reads the CA file, bootstraps a credential from the secret, and keeps it renewed
  before it expires. A failed start can be retried.
- `credential`: the credential's details (`agent`, `instance`, `environment`, `expiresAt`),
  never the credential itself.
- `publish(payload)`: sends one event and resolves with its `traceContext`. Never retried: a
  publish that fails may or may not have been accepted. A payload JSON cannot carry exactly
  (`NaN`, `undefined`, a function, a cycle, a class instance) is refused with a `TypeError`
  naming its path, before anything is sent.
- `subscribe()`: an async iterable of items (below). One active subscription per client.
- `close()`: closes the subscription and stops renewal; idempotent. `await using` works too.

The secret is read once per bootstrap and not kept. No secret, credential or payload appears in
any error, log or string form of the client; the SDK writes no log.

### The secret file

`fileSecret(path)` opens the file, checks it, then reads it, one trailing line ending removed. It
must be a regular file owned by the process's user (or by root), not readable by others and not
writable by group or others; otherwise `SecretSourceError` names the path and the reason, never
the contents. On Kubernetes, mount the Secret with `defaultMode: 0440` and an `fsGroup` the
process runs in; with Docker, use mode `0400` or `0440`. **On Windows `fileSecret` is refused**
(`unsupported-platform`): supply your own provider.

### Errors

Every error is a `SoormaError`:

| Error | When | Carries |
|---|---|---|
| `ProblemError` | The platform answered with a Problem | `status`, `code`, `title`, `detail`, `retryAfter`, `problem` |
| `TransportError` | No usable answer | `reason`: `tls`, `connection`, `timeout`, `unusable-response`, `ca-file` |
| `SecretSourceError` | The secret provider refused or failed | `reason`, `path` |
| `ClientStateError` | The client's state does not allow the call | `state`: `created` (not started), `starting`, `closed`, `revoked` (with the `problem`), `subscribed` |

Bootstrap, renewal and subscribe are retried with backoff after a transient failure; a publish
never is. A credential
the platform refuses (`credential_refused`) revokes the client: every later call raises
`ClientStateError` with `state: 'revoked'`.

## Subscribing

Each item is one of:
- a **`Delivery`** (`kind: 'delivery'`): `envelope` (frozen; every member optional), its exact
  `envelopeText`, `seal`, `payload` (absent when nested deeper than the SDK parses, then
  `payloadParsed` is `false`) and its exact `payloadText`. `delivery.publish(payload)` forwards
  a new event in the received trace;
- a **delivery error** (`kind: 'deliveryError'`): a line that is not a usable Delivery, with its
  `reason` and `text`; the stream continues;
- **stream started** and **stream ended** (`code`, `terminal`): the SDK reopens a stream that
  ends, unless the end is terminal.

Leaving a `for await` loop closes the subscription. A failure before any stream opens is raised
from the iterator.

## Delivery

Delivery is **live only**: a stream receives every Delivery accepted in its environment after it
opened, the subscriber's own publishes included, and nothing earlier. No durability, ordering,
redelivery, acknowledgement, resumption or duplicate suppression is promised (soorma-sdk
GAP-INT-001).

When a stream ends, the SDK opens another and yields *stream ended*, then *stream started*; events
accepted between two streams may be missed. Across a renewal both streams are open for a moment,
and a Delivery may be read on both: a Delivery may be delivered twice around a stream boundary; nothing identifies a duplicate (GAP-INT-001).

## Spans

The SDK emits spans only through the OpenTelemetry API and installs no exporter, sampler or
provider. It follows OpenTelemetry's messaging semantic conventions 1.45.0: a `send` span (kind
producer) for every publish, and a `receive` span (kind consumer) for every Delivery.

The span shape is **unstable**: it is outside the SDK's compatibility guarantee until the
Observability PRD specifies span semantics (soorma-sdk GAP-INT-002, soorma-prd#37).

**A deviation from OpenTelemetry's usual parenting**: when you publish through a Delivery, the send
span is a child of the received context, not of your active span (which it links instead), and a
receive span is a child of the received context, so that one trace follows the event across hops.

## The clock-skew warning

If a credential arrives already due for renewal, the client's clock is ahead of the platform's.
The SDK then emits one process warning per credential lineage (`SoormaWarning`, code
`SOORMA_CLOCK_SKEW`), holds renewals at least 30 seconds apart, and uses the credential until
the platform reports it expired. **Fix the clock** (NTP); the warning holds no credential.
