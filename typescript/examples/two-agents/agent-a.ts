// SPDX-License-Identifier: Apache-2.0
//
// Agent A of the two-agent example (FR-20; US-11; TH-E2E-01): it publishes one
// payload and prints the trace context the platform carries to the receiver.
// Start agent B first: delivery is live only. It uses only @soorma/sdk's public
// interface: copy it into your project and edit the configuration block.
import { AgentClient, fileSecret, newInstanceId, type AgentClientOptions } from '@soorma/sdk';

// ---- Configuration -------------------------------------------------------
// soorma-core's local stack, after `pnpm e2e:core-up` and
// `pnpm e2e:setup --agents agent-a,agent-b`, run from this repository's root.
export const config: AgentClientOptions = {
  dataGatewayUrl: 'https://localhost:8444',
  eventIngestUrl: 'https://localhost:8446',
  caFile: '.e2e/soorma-core/deploy/local/.secrets/stack-ca.pem',
  agent: 'agent-a',
  instance: newInstanceId(),
  secret: fileSecret('.e2e/secrets/agent-a.secret'),
};
// ---- End of configuration --------------------------------------------------

export async function run(options: AgentClientOptions): Promise<void> {
  const client = new AgentClient(options);
  try {
    await client.start();
    const accepted = await client.publish({ hello: 'B' });
    console.log(`agent-a: published; traceparent ${accepted.traceContext.traceparent}`);
  } finally {
    await client.close();
  }
}

if (import.meta.main) await run(config);
