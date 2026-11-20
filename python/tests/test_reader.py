# SPDX-License-Identifier: Apache-2.0
#
# The reader (PH-RD-01 to 07; RCV-01 to RCV-08): the exact spans, the envelope
# read only (TC-PH-069) and parsed only within D_lang (TC-PH-073), one failing
# to parse is envelope-unparsed; a duplicate member refused (TC-PH-068); strict
# JSON; the payload within D_lang, else unparsed, as is one past the digit limit
# (TC-PH-079's read half), with PayloadNotParsed; forwarding the exact text.
from __future__ import annotations

import json
import sys
from types import MappingProxyType
from typing import Any

import pytest

from soorma import Delivery, DeliveryError, PayloadNotParsed, PublishAccepted, TraceContext
from soorma._limits import D_LANG
from soorma._reader import read_delivery

ENV = (
    '{ "traceContext": {"traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"},'
    ' "n": 1.50, "list": [1, {"x": "ü\\u00fc"}], "unknown": null }'
)


def line(env: str = ENV, seal: str = '"seal-1"', payload: str = '{"k": "v"}') -> str:
    return f'{{"envelope":{env}, "seal" : {seal},"payload":  {payload}}}'


def deep(depth: int, inner: str = "1") -> str:
    return "[" * depth + inner + "]" * depth


def test_a_delivery_keeps_the_exact_spans() -> None:
    d = read_delivery(line())
    assert isinstance(d, Delivery)
    assert d.envelope_text == ENV
    assert d.seal == "seal-1"
    assert d.payload == {"k": "v"}
    assert d.payload_text == '{"k": "v"}'
    assert d.payload_parsed is True
    assert d.envelope["n"] == 1.5  # type: ignore[typeddict-item]
    assert d.envelope["unknown"] is None  # type: ignore[typeddict-item]


def test_the_envelope_is_deeply_read_only_and_the_delivery_too() -> None:
    d = read_delivery(line())
    assert isinstance(d, Delivery)
    env: Any = d.envelope
    assert isinstance(env, MappingProxyType)
    assert isinstance(env["list"], tuple)
    assert isinstance(env["list"][1], MappingProxyType)
    with pytest.raises(TypeError):
        env["n"] = 2  # type: ignore[index]
    with pytest.raises(TypeError):
        env["list"][1]["x"] = "y"  # type: ignore[index]
    with pytest.raises(AttributeError):
        d.seal = "other"  # type: ignore[misc]
    with pytest.raises(AttributeError):
        d.anything = 1
    with pytest.raises(TypeError):
        Delivery()


def test_the_payload_is_plain_and_fresh_per_delivery() -> None:
    a, b = read_delivery(line()), read_delivery(line())
    assert isinstance(a, Delivery)
    assert isinstance(b, Delivery)
    pa: Any = a.payload
    pa["k"] = "changed"
    assert b.payload == {"k": "v"}
    assert a.payload_text == '{"k": "v"}'


@pytest.mark.parametrize(
    ("text", "reason"),
    [
        ("", "not-json"),
        ("{", "not-json"),
        (line() + " x", "not-json"),
        (line(payload="NaN"), "not-json"),
        (line(payload="Infinity"), "not-json"),
        (line(payload="-Infinity"), "not-json"),
        (line(payload="01"), "not-json"),
        (line(payload="[1,]"), "not-json"),
        (line(payload='{"a":1,}'), "not-json"),
        (line(payload='"tab\there"'), "not-json"),
        (line(payload='"\\x"'), "not-json"),
        (line(payload="tru"), "not-json"),
        ("[1, 2]", "not-an-object"),
        ('"text"', "not-an-object"),
        ('{"seal":"s","payload":1}', "missing-envelope"),
        (line(env="[]"), "missing-envelope"),
        ('{"envelope":{},"payload":1}', "missing-seal"),
        (line(seal="7"), "missing-seal"),
        ('{"envelope":{},"seal":"s"}', "missing-payload"),
        (line()[:-1] + ',"envelope":{}}', "duplicate-member"),
        (line()[:-1] + ',"seal":"again"}', "duplicate-member"),
        (line()[:-1] + ',"payload":2}', "duplicate-member"),
        (line(env='{"a":' + deep(D_LANG) + "}"), "envelope-too-deep"),
        (line(env='{"n": ' + "9" * 5000 + "}"), "envelope-unparsed"),
    ],
)
def test_a_line_that_is_not_a_usable_delivery_is_a_delivery_error(text: str, reason: str) -> None:
    item = read_delivery(text)
    assert item == DeliveryError(reason, text)


def test_an_envelope_at_d_lang_is_parsed() -> None:
    env = '{"a":' + deep(D_LANG - 1) + "}"
    d = read_delivery(line(env=env))
    assert isinstance(d, Delivery)
    assert d.envelope_text == env


@pytest.mark.parametrize(
    "payload",
    [deep(D_LANG + 1), deep(200_000), '{"n": ' + "7" * 5000 + "}", "[" + "1" * 5000 + "]"],
)
def test_a_payload_not_parsed_leaves_the_delivery_intact(payload: str) -> None:
    limit = sys.get_int_max_str_digits()
    d = read_delivery(line(payload=payload))
    assert isinstance(d, Delivery)
    assert d.payload_parsed is False
    assert d.payload_text == payload
    assert d.envelope_text == ENV
    assert d.seal == "seal-1"
    assert not hasattr(d, "payload")
    with pytest.raises(PayloadNotParsed) as e:
        _ = d.payload
    assert isinstance(e.value, AttributeError)
    assert "payload_parsed" in str(e.value)
    assert "777" not in str(e.value)
    assert sys.get_int_max_str_digits() == limit


def test_a_payload_at_d_lang_is_parsed() -> None:
    d = read_delivery(line(payload=deep(D_LANG)))
    assert isinstance(d, Delivery)
    assert d.payload_parsed is True


def test_members_and_strings_with_escapes_and_whitespace() -> None:
    text = (
        ' \t{"\\u0065nvelope" : {} ,\r\n"seal":"a\\"b\\\\c\\/\\u00e9",'
        '"payload":[true,false,null,-0.5e+3]}\n'
    )
    d = read_delivery(text)
    assert isinstance(d, Delivery)
    assert d.seal == 'a"b\\c/é'
    assert d.payload == [True, False, None, -500.0]


@pytest.mark.asyncio
async def test_publish_forwards_the_exact_text_and_the_received_context() -> None:
    seen: list[tuple[object, ...]] = []

    async def forward(payload: Any, envelope_text: str, seal: str, tc: object) -> PublishAccepted:
        seen.append((payload, envelope_text, seal, tc))
        return PublishAccepted(TraceContext("00-" + "1" * 32 + "-" + "2" * 16 + "-01"))

    d = read_delivery(line(), forward)
    assert isinstance(d, Delivery)
    await d.publish({"seen": True})
    ((payload, text, seal, tc),) = seen
    assert (payload, text, seal) == ({"seen": True}, ENV, "seal-1")
    assert dict(tc) == json.loads(ENV)["traceContext"]  # type: ignore[call-overload]


def test_no_payload_in_a_delivery_repr_and_not_picklable() -> None:
    import pickle

    d = read_delivery(line(payload='"private-payload"'))
    assert "private-payload" not in repr(d)
    with pytest.raises(TypeError):
        pickle.dumps(d)
