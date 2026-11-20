# SPDX-License-Identifier: Apache-2.0
#
# The subscription (C-17): filled in G7.
from __future__ import annotations

from types import TracebackType
from typing import TypeAlias

from ._errors import ClientStateError
from ._reader import Delivery
from ._types import DeliveryError, StreamEnded, StreamStarted

SubscriptionItem: TypeAlias = Delivery | DeliveryError | StreamStarted | StreamEnded


class Subscription:
    """An async iterator of items; `async with` closes it (PH-LIFE-02)."""

    def __aiter__(self) -> Subscription:
        return self

    async def __anext__(self) -> SubscriptionItem:
        raise ClientStateError("not implemented")

    async def close(self) -> None:
        return None

    async def __aenter__(self) -> Subscription:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.close()
