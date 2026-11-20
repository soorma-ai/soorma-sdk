# SPDX-License-Identifier: Apache-2.0
#
# Drafts (DRF-01 to DRF-03; FWD-02, FWD-03; PH-PUB-02): exactly
# clientContractVersion and traceContext, inbound only when forwarding, the
# envelope text spliced byte for byte and the seal as received.
from __future__ import annotations

import json

from soorma import TraceContext
from soorma._draft import Inbound, draft_text, publish_body

TP = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"


def test_a_publish_draft_has_exactly_the_version_and_the_trace_context() -> None:
    assert draft_text(TraceContext(TP)) == (
        f'{{"clientContractVersion":"0.1.0","traceContext":{{"traceparent":"{TP}"}}}}'
    )
    d = json.loads(draft_text(TraceContext(TP, "k=v")))
    assert d == {
        "clientContractVersion": "0.1.0",
        "traceContext": {"traceparent": TP, "tracestate": "k=v"},
    }


def test_a_forward_splices_the_envelope_text_byte_for_byte() -> None:
    envelope = '{ "b" : 1,"a":[1.0e0, "ü\\u00fc"] ,"z":{}}'
    text = draft_text(TraceContext(TP), Inbound(envelope, "seal-ü"))
    assert text.endswith(f',"inbound":{{"envelope":{envelope},"seal":"seal-ü"}}}}')
    assert json.loads(text)["inbound"]["seal"] == "seal-ü"


def test_the_publish_body_is_compact_utf8() -> None:
    body = publish_body(draft_text(TraceContext(TP)), '{"ü":1}')
    assert body.startswith(b'{"draft":{"clientContractVersion"')
    assert body.endswith('"payload":{"ü":1}}'.encode())
    assert json.loads(body)["payload"] == {"ü": 1}
