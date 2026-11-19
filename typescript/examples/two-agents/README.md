<!-- SPDX-License-Identifier: Apache-2.0 -->

# Two agents

Agent B subscribes and prints each Delivery's envelope and trace id; agent A publishes one
payload, `{ "hello": "B" }`, and prints the trace context the platform carries to B. Each file
has one marked **configuration block** and exports `run(config)`; run directly, it calls `run`
with that block. They use only `@soorma/sdk`'s public interface, so either file can be copied
into your own project: install `@soorma/sdk` and `@opentelemetry/api`, then edit the block.

## Against soorma-core's local stack

From this repository's root, with Docker and Node.js 26.13.0 for soorma-core's own steps (see
the [repository README](../../../README.md#the-end-to-end-stack)):

```sh
pnpm e2e:core-up --core-node "$(nvm which 26.13.0)"   # e2e/core-up: soorma-core at the contract tag
pnpm e2e:setup --agents agent-a,agent-b              # e2e/setup: registers both; writes .e2e/secrets/
pnpm --filter @soorma/sdk build
node typescript/examples/two-agents/agent-b.ts       # first, and leave it running
node typescript/examples/two-agents/agent-a.ts       # in a second terminal
pnpm e2e:core-down                                   # when done (stop agent B first: Ctrl-C)
```

The configuration blocks hold that stack's values: S3 at `https://localhost:8444`, S4 at
`https://localhost:8446`, the stack's CA file, and each agent's secret file under
`.e2e/secrets/`, all relative to the repository root.

## What to know

- **Start B first.** Delivery is **live only**: a stream receives what is accepted after it
  opened, and nothing earlier. A Delivery published before B's stream started is not received.
- **The span shape is unstable.** The SDK emits a `send` span for every publish and a `receive`
  span for every Delivery through the OpenTelemetry API, and installs no SDK or exporter: install
  your own to see them. The shape is outside the compatibility guarantee until the Observability
  PRD specifies it. One deviation from OpenTelemetry's usual parenting (DEC-U1-01): publishing
  through a received Delivery makes the send span a child of the received context, linking your
  active span instead, and a receive span is a child of the received context, so one trace
  follows the event across hops.
- **The secret file.** `fileSecret(path)` reads the agent's registration secret when the client
  bootstraps. The file must be a regular file owned by the process's user (or by root), not
  readable by others and not writable by group or others. On Kubernetes, mount the Secret with `defaultMode: 0440` and an `fsGroup`;
  with Docker, use mode `0400` or `0440`. `e2e/setup` writes `0600` files. On Windows
  `fileSecret` is refused: supply your own secret provider, a function returning the secret.
