# SPDX-License-Identifier: Apache-2.0
#
# The delivery reader (C-18): filled in G7.
from __future__ import annotations

from ._errors import ClientStateError, PayloadNotParsed
from ._types import Envelope, JsonValue, PublishAccepted


class Delivery:
    """One received Delivery (RCV-02); `publish` forwards (FWD-01)."""

    envelope: Envelope
    envelope_text: str
    seal: str
    payload_text: str
    payload_parsed: bool

    @property
    def payload(self) -> JsonValue:
        raise PayloadNotParsed()

    async def publish(self, payload: JsonValue) -> PublishAccepted:
        raise ClientStateError("not implemented")
