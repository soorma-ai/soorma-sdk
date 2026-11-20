# SPDX-License-Identifier: Apache-2.0
#
# Agent B of the two-agent example (FR-20; PH-E2E): it subscribes and prints each
# Delivery's envelope and trace id until interrupted (Ctrl-C). Start it before
# agent A: delivery is live only. It uses only soorma's public interface: copy it
# into your project and edit the configuration block.
from __future__ import annotations

import asyncio
import contextlib
import json

from soorma import (
    AgentClient,
    AgentClientOptions,
    Delivery,
    DeliveryError,
    Envelope,
    StreamEnded,
    StreamStarted,
    file_secret,
    new_instance_id,
)

# ---- Configuration -------------------------------------------------------
# soorma-core's local stack, after `pnpm e2e:core-up` and
# `pnpm e2e:setup --agents agent-a,agent-b`, run from this repository's root.
config = AgentClientOptions(
    data_gateway_url="https://localhost:8444",
    event_ingest_url="https://localhost:8446",
    ca_file=".e2e/soorma-core/deploy/local/.secrets/stack-ca.pem",
    agent="agent-b",
    instance=new_instance_id(),
    secret=file_secret(".e2e/secrets/agent-b.secret"),
)
# ---- End of configuration --------------------------------------------------


def trace_id(envelope: Envelope) -> str:
    """The trace id from the envelope's W3C traceparent (version-traceid-spanid-flags)."""
    traceparent = (envelope.get("traceContext") or {}).get("traceparent")
    parts = traceparent.split("-") if isinstance(traceparent, str) else []
    return parts[1] if len(parts) == 4 else "(none)"


async def run(options: AgentClientOptions) -> None:
    async with AgentClient(options) as client:
        await client.start()
        # Live only: a Delivery accepted before the stream opened is not received.
        # Leaving the `async with` block, Ctrl-C included, closes the subscription.
        async with client.subscribe() as subscription:
            async for item in subscription:
                if isinstance(item, StreamStarted):
                    print("agent-b: stream started")
                elif isinstance(item, StreamEnded):
                    print(f"agent-b: stream ended ({item.code or 'no code'})")
                elif isinstance(item, DeliveryError):
                    print(f"agent-b: a line that is not a Delivery ({item.reason})")
                elif isinstance(item, Delivery):
                    print(f"agent-b: delivery; trace id {trace_id(item.envelope)}")
                    # The envelope is read only: its objects are mappings, its arrays tuples.
                    print(json.dumps(item.envelope, default=dict, indent=2))


if __name__ == "__main__":
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(run(config))
