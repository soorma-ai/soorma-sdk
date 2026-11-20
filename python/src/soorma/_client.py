# SPDX-License-Identifier: Apache-2.0
#
# The client (C-11): filled in G6.
from __future__ import annotations

from types import TracebackType

from ._errors import ClientStateError
from ._options import AgentClientOptions
from ._subscription import Subscription
from ._types import CredentialInfo, JsonValue, PublishAccepted


class AgentClient:
    """The agent's client: `start()`, `publish`, `subscribe`, `close()` (asyncio only)."""

    def __init__(self, options: AgentClientOptions) -> None:
        if not isinstance(options, AgentClientOptions):
            raise TypeError("AgentClient needs AgentClientOptions")
        self._options = options

    async def start(self) -> None:
        raise ClientStateError("not implemented")

    @property
    def credential(self) -> CredentialInfo:
        raise ClientStateError("not implemented")

    async def publish(self, payload: JsonValue) -> PublishAccepted:
        raise ClientStateError("not implemented")

    def subscribe(self) -> Subscription:
        raise ClientStateError("not implemented")

    async def close(self) -> None:
        return None

    async def __aenter__(self) -> AgentClient:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.close()
