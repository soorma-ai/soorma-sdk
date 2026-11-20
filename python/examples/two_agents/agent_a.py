# SPDX-License-Identifier: Apache-2.0
#
# Agent A of the two-agent example (FR-20; PH-E2E): it publishes one payload and
# prints the trace context the platform carries to the receiver. Start agent B
# first: delivery is live only. It uses only soorma's public interface: copy it
# into your project and edit the configuration block.
from __future__ import annotations

import asyncio

from soorma import AgentClient, AgentClientOptions, file_secret, new_instance_id

# ---- Configuration -------------------------------------------------------
# soorma-core's local stack, after `pnpm e2e:core-up` and
# `pnpm e2e:setup --agents agent-a,agent-b`, run from this repository's root.
config = AgentClientOptions(
    data_gateway_url="https://localhost:8444",
    event_ingest_url="https://localhost:8446",
    ca_file=".e2e/soorma-core/deploy/local/.secrets/stack-ca.pem",
    agent="agent-a",
    instance=new_instance_id(),
    secret=file_secret(".e2e/secrets/agent-a.secret"),
)
# ---- End of configuration --------------------------------------------------


async def run(options: AgentClientOptions) -> None:
    async with AgentClient(options) as client:
        await client.start()
        accepted = await client.publish({"hello": "B"})
        print(f"agent-a: published; traceparent {accepted.trace_context.traceparent}")


if __name__ == "__main__":
    asyncio.run(run(config))
