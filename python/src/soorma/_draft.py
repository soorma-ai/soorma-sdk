# SPDX-License-Identifier: Apache-2.0
#
# The only maker of drafts (C-16; DRF-01 to DRF-03): exactly
# clientContractVersion and traceContext, and inbound only when forwarding,
# with the received envelope text spliced byte for byte (FWD-02) and the seal
# as received (FWD-03). No platform-stamped field can be set (NEV-02).
from __future__ import annotations

from dataclasses import dataclass

from ._json import payload_text
from ._transport import CONTRACT_VERSION
from ._types import TraceContext


@dataclass(frozen=True, slots=True)
class Inbound:
    """A received Delivery's envelope text, exactly as received, and its seal."""

    envelope_text: str
    seal: str


def draft_text(trace: TraceContext, inbound: Inbound | None = None) -> str:
    tc: dict[str, object] = {"traceparent": trace.traceparent}
    if trace.tracestate is not None:
        tc["tracestate"] = trace.tracestate
    fwd = (
        ""
        if inbound is None
        else f',"inbound":{{"envelope":{inbound.envelope_text},'
        f'"seal":{payload_text(inbound.seal)}}}'
    )
    return (
        f'{{"clientContractVersion":"{CONTRACT_VERSION}","traceContext":{payload_text(tc)}{fwd}}}'
    )


def publish_body(draft: str, payload: str) -> bytes:
    """The publish body: the draft and the payload's checked text (PUB-01, PUB-03)."""
    return f'{{"draft":{draft},"payload":{payload}}}'.encode()
