<!-- SPDX-License-Identifier: Apache-2.0 -->

# Two agents

Agent B subscribes and prints each Delivery's envelope and trace id; agent A publishes one
payload, `{"hello": "B"}`, and prints the trace context the platform carries to B. Each file has
one marked **configuration block** and an `async def run(config)`; run directly, it calls
`asyncio.run(run(config))` with that block. They use only `soorma`'s public interface, so either
file can be copied into your own project: install `soorma` (it brings `opentelemetry-api`), then
edit the block.

## Against soorma-core's local stack

From this repository's root, with Docker, Node.js 26.13.0 for soorma-core's own steps (see the
[repository README](../../../README.md#the-end-to-end-stack)), `uv`, and **Python 3.11 or 3.12**
(below):

```sh
pnpm e2e:core-up --core-node "$(nvm which 26.13.0)"   # e2e/core-up: soorma-core at the contract tag
pnpm e2e:setup --agents agent-a,agent-b              # e2e/setup: registers both; writes .e2e/secrets/
uv sync --project python --python 3.11
uv run --project python python python/examples/two_agents/agent_b.py   # first, and leave it running
uv run --project python python python/examples/two_agents/agent_a.py   # in a second terminal
pnpm e2e:core-down                                   # when done (stop agent B first: Ctrl-C)
```

The configuration blocks hold that stack's values: S3 at `https://localhost:8444`, S4 at
`https://localhost:8446`, the stack's CA file, and each agent's secret file under
`.e2e/secrets/`, all relative to the repository root.

## What to know

- **Start B first.** Delivery is **live only**: a stream receives what is accepted after it
  opened, and nothing earlier. A Delivery published before B's stream started is not received.
- **`async with` closes.** `async with AgentClient(options) as client:` and
  `async with client.subscribe() as subscription:` close the client and the subscription however
  the block is left, Ctrl-C included. A bare `async for` left early keeps the stream open.
- **The span shape is unstable.** The SDK emits a `send` span for every publish and a `receive`
  span for every Delivery through the OpenTelemetry API, and installs no SDK or exporter: install
  your own to see them. The shape is outside the compatibility guarantee until the Observability
  PRD specifies it. One deviation from OpenTelemetry's usual parenting (DEC-U1-01): publishing
  through a received Delivery makes the send span a child of the received context, linking your
  active span instead, and a receive span is a child of the received context, so one trace
  follows the event across hops.
- **The secret file.** `file_secret(path)` reads the agent's registration secret when the client
  bootstraps. The file must be a regular file owned by the process's user (or by root), not
  readable by others and not writable by group or others. On Kubernetes, mount the Secret with
  `defaultMode: 0440` and an `fsGroup`; with Docker, use mode `0400` or `0440`. `e2e/setup`
  writes `0600` files. On Windows `file_secret` is refused: supply your own secret provider, a
  callable returning the secret.
- **Python 3.13 and later against the local stack.** Python 3.13 verifies certificates strictly,
  and the SDK keeps that on. The local stack's server certificate has no Authority Key
  Identifier, so strict verification refuses it: use Python 3.11 or 3.12 here until
  soorma-ai/soorma-core#36 is fixed.
- **No CA certificates on python.org's macOS Python.** Its installer leaves the default
  certificate store empty until you run its *Install Certificates* command. The SDK then names
  that step in the `TransportError`; the local stack's own CA file, set as `ca_file`, works
  either way.
- **Payloads Python cannot parse.** A received payload holding an integer longer than
  `sys.get_int_max_str_digits()` is left unparsed: `payload_parsed` is `False`, reading `payload`
  raises `PayloadNotParsed`, and `payload_text`, the envelope and the seal are intact. The SDK
  never changes the process's digit limit.
- **The clock-skew warning.** If a credential arrives already due for renewal, the SDK emits one
  `SoormaWarning` (code `SOORMA_CLOCK_SKEW`) per credential lineage: fix the machine's clock.
