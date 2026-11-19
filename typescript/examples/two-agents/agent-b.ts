// SPDX-License-Identifier: Apache-2.0
//
// Agent B of the two-agent example (FR-20; US-11; TH-E2E-01): it subscribes and
// prints each Delivery's envelope and trace id until interrupted (Ctrl-C).
// Start it before agent A: delivery is live only. It uses only @soorma/sdk's
// public interface: copy it into your project and edit the configuration block.
import {
  AgentClient,
  fileSecret,
  newInstanceId,
  type AgentClientOptions,
  type Envelope,
} from '@soorma/sdk';

// ---- Configuration -------------------------------------------------------
// soorma-core's local stack, after `pnpm e2e:core-up` and
// `pnpm e2e:setup --agents agent-a,agent-b`, run from this repository's root.
export const config: AgentClientOptions = {
  dataGatewayUrl: 'https://localhost:8444',
  eventIngestUrl: 'https://localhost:8446',
  caFile: '.e2e/soorma-core/deploy/local/.secrets/stack-ca.pem',
  agent: 'agent-b',
  instance: newInstanceId(),
  secret: fileSecret('.e2e/secrets/agent-b.secret'),
};
// ---- End of configuration --------------------------------------------------

/** The trace id from the envelope's W3C traceparent (version-traceid-spanid-flags). */
const traceId = (envelope: Envelope): string =>
  envelope.traceContext?.traceparent?.split('-')[1] ?? '(none)';

export async function run(options: AgentClientOptions): Promise<void> {
  const client = new AgentClient(options);
  const stop = (): void => void client.close();
  process.once('SIGINT', stop);
  try {
    await client.start();
    // Live only: a Delivery accepted before the stream opened is not received.
    for await (const item of client.subscribe()) {
      switch (item.kind) {
        case 'streamStarted':
          console.log('agent-b: stream started');
          break;
        case 'streamEnded':
          console.log(`agent-b: stream ended (${item.code ?? 'no code'})`);
          break;
        case 'deliveryError':
          console.log(`agent-b: a line that is not a Delivery (${item.reason})`);
          break;
        case 'delivery':
          console.log(`agent-b: delivery; trace id ${traceId(item.envelope)}`);
          console.log(JSON.stringify(item.envelope, null, 2));
          break;
      }
    }
  } finally {
    process.off('SIGINT', stop);
    await client.close();
  }
}

if (import.meta.main) await run(config);
