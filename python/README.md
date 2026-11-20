# soorma

The soorma agent SDK for Python. It acquires, renews and presents an agent credential; drafts,
publishes, forwards and subscribes on the data face; and emits spans through the OpenTelemetry API.
It is advisory only: the platform enforces everything.

```python
import asyncio

from soorma import AgentClient, AgentClientOptions, Delivery, file_secret, new_instance_id


async def main() -> None:
    options = AgentClientOptions(
        data_gateway_url="https://s3.example.com",
        event_ingest_url="https://s4.example.com",
        agent="agent-a",
        instance=new_instance_id(),
        secret=file_secret("/var/run/secrets/soorma/agent-a.secret"),
    )
    async with AgentClient(options) as client:
        await client.start()
        await client.publish({"hello": "B"})
        async with client.subscribe() as subscription:
            async for item in subscription:
                if isinstance(item, Delivery):
                    print(item.envelope, item.payload_text)


asyncio.run(main())
```

## Requirements

- **Python 3.11 or later**, `asyncio` only. A client belongs to the event loop `start()` ran on;
  using it from another loop is unsupported.
- **`opentelemetry-api` `>=1.45.2,<2`**, the one runtime dependency: your application's copy, so
  the SDK's spans join your traces.
- **Python 3.13 and later verify certificates strictly** (`VERIFY_X509_STRICT`), and the SDK
  keeps that on. soorma-core's local stack issues server certificates without an Authority Key
  Identifier, which strict verification refuses, so against the local stack use Python 3.11 or
  3.12 until soorma-ai/soorma-core#36 is fixed.

## The client

`AgentClient(options)` checks its options and contacts nothing. `AgentClientOptions` is a frozen,
keyword-only dataclass:

| Option | Meaning |
|---|---|
| `data_gateway_url` | The data gateway (S3), `https` only: credentials |
| `event_ingest_url` | Event ingest (S4), `https` only: publish and subscribe |
| `ca_file` | Optional: a PEM file of extra CA certificates. TLS is always verified, against the OS store and this file; nothing turns verification off |
| `agent` | The agent's identifier, as registered |
| `instance` | This running instance's identifier: `new_instance_id()` makes one |
| `secret` | A secret provider: a callable returning the agent's registration secret, or an awaitable of it. `file_secret(path)` is the one shipped |

An unknown option (a misspelt TLS switch, say), a value of the wrong type, or a URL that is not
`https` is refused with a `TypeError`. The SDK reads no environment variable and derives nothing
from the host.

- `await client.start()` reads the CA file, bootstraps a credential from the secret, and keeps
  it renewed before it expires. A failed start can be retried.
- `client.credential`: the credential's details (`agent`, `instance`, `environment`,
  `expires_at`), never the credential itself.
- `await client.publish(payload)`: sends one event and returns its `trace_context`. Never
  retried: a publish that fails may or may not have been accepted. A payload JSON cannot carry
  exactly is refused with a `TypeError` naming its path (`$.a[2].b`), never its value, before
  anything is sent: only `dict` with `str` keys, `list`, `str`, `int`, finite `float`, `bool`
  and `None` are accepted, exactly (no tuples, sets, `bytes`, `Decimal`, datetimes or
  subclasses), and no `int` longer than the process's `sys.get_int_max_str_digits()`.
- `client.subscribe()`: a `Subscription`, an async iterator of items (below). One active
  subscription per client.
- `await client.close()`: closes the subscription and stops renewal; idempotent.
  `async with AgentClient(options) as client:` closes it on leaving the block.

The secret is read once per bootstrap attempt and not kept. No secret, credential or payload
appears in any error, warning, `repr` or `str` of the client; the client cannot be pickled. The
SDK writes no log.

A client or subscription you forget to close is released when it is garbage-collected, with a
`ResourceWarning` naming it, as `asyncio`'s own transports do. Close them instead.

### The secret file

`file_secret(path)` opens the file, checks it, then reads it, off the event loop, with one
trailing line ending removed. It must be a regular file owned by the process's user (or by root),
not readable by others and not writable by group or others; otherwise `SecretSourceError` names
the path and the reason, never the contents. On Kubernetes, mount the Secret with
`defaultMode: 0440` and an `fsGroup` the process runs in; with Docker, use mode `0400` or `0440`.
**On Windows `file_secret` is refused** (`unsupported-platform`): supply your own provider.

### Errors

Every error is a `SoormaError`:

| Error | When | Carries |
|---|---|---|
| `ProblemError` | The platform answered with a Problem | `status`, `code`, `title`, `detail`, `retry_after`, `problem` |
| `TransportError` | No usable answer | `reason`: `tls`, `connection`, `timeout`, `unusable-response`, `ca-file`, `response-too-large`, and others |
| `SecretSourceError` | The secret provider refused or failed | `reason`, `path` |
| `ClientStateError` | The client's state does not allow the call | `state`: `created` (not started), `starting`, `closed`, `revoked` (with the `problem`), `subscribed` |

Bootstrap, renewal and subscribe are retried with backoff after a transient failure; a publish
never is. A credential the platform refuses (`credential_refused`) revokes the client: every
later call raises `ClientStateError` with `state` `revoked`.

If a TLS failure happens on a Python whose default certificate store is empty (python.org's
macOS installer leaves it so until you run its *Install Certificates* command), the
`TransportError` says so.

## Subscribing

```python
async with client.subscribe() as subscription:
    async for item in subscription:
        ...
```

Leaving the `async with` block, however you leave it, closes the subscription. A bare
`async for` that you leave early keeps the stream open until you call `close()`. Each item is one
of these classes:

- **`Delivery`**: `envelope` (read only; every member optional), its exact `envelope_text`,
  `seal`, `payload` (plain JSON types), its exact `payload_text`, and `payload_parsed`.
  `await delivery.publish(payload)` forwards a new event in the received trace. When the payload
  is nested deeper than the SDK parses, or holds a number Python refuses to parse (an integer
  longer than `sys.get_int_max_str_digits()`), `payload_parsed` is `False` and reading `payload`
  raises `PayloadNotParsed`; `payload_text`, the envelope and the seal are intact, and the
  Delivery can still be forwarded. The SDK never changes the process's digit limit;
- **`DeliveryError`**: a line that is not a usable Delivery, with its `reason` and `text`; the
  stream continues;
- **`StreamStarted`** and **`StreamEnded`** (`code`, `terminal`): the SDK reopens a stream that
  ends, unless the end is terminal.

The SDK reads the stream only as you pull items, through a small buffer. A failure before any
stream opens is raised from the iterator.

## Delivery

Delivery is **live only**: a stream receives every Delivery accepted in its environment after it
opened, the subscriber's own publishes included, and nothing earlier. No durability, ordering,
redelivery, acknowledgement, resumption or duplicate suppression is promised (soorma-sdk
GAP-INT-001).

When a stream ends, the SDK opens another and yields *stream ended*, then *stream started*;
events accepted between two streams may be missed. Across a renewal both streams are open for a
moment, and a Delivery may be read on both: a Delivery may be delivered twice around a stream boundary; nothing identifies a duplicate (GAP-INT-001).

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
The SDK then emits one `SoormaWarning` per credential lineage (`code` `SOORMA_CLOCK_SKEW`), holds
renewals at least 30 seconds apart, and uses the credential until the platform reports it
expired. **Fix the clock** (NTP); the warning holds no credential. A warning filter set to
`error` does not change what the SDK does.
