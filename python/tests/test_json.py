# SPDX-License-Identifier: Apache-2.0
#
# The payload walk (PH-PUB-01; TC-PH-070, TC-PH-079's publish half): exact JSON
# types only, refused by path and kind and never the value; an int past the
# digit limit refused with the limit unchanged; text equal to json.dumps
# (compact, no ASCII escaping), lone surrogates escaped; no depth limit.
from __future__ import annotations

import datetime
import decimal
import enum
import json
import sys
from collections import OrderedDict
from typing import Any

import pytest

from soorma._json import payload_text


def dumps(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


@pytest.mark.parametrize(
    "value",
    [
        None,
        True,
        False,
        0,
        -1,
        10**40,
        1.5,
        -0.0,
        1e300,
        5e-324,
        "",
        "plain",
        'quote " backslash \\ controls \x00\x1f\x7f',
        "ünïcödé ✓ 𝄞 \u2028\u2029",
        "</script>&<>",
        [],
        {},
        [1, "a", None, [True, {"k": [2.5]}]],
        {"a": 1, "b": {"c": [1, 2, {"d": None}]}, "": "empty key", "ü": "é"},
        {"z": 1, "a": 2},
    ],
)
def test_the_text_equals_compact_json_dumps(value: Any) -> None:
    assert payload_text(value) == dumps(value)


def test_a_lone_surrogate_is_written_as_its_escape() -> None:
    text = payload_text({"k\ud800": "a\udfffb"})
    assert text == '{"k\\ud800":"a\\udfffb"}'
    text.encode("utf-8")
    assert json.loads(text) == {"k\ud800": "a\udfffb"}


class Colour(enum.IntEnum):
    RED = 1


class MyStr(str):
    pass


class MyDict(dict[str, Any]):
    pass


class MyFloat(float):
    pass


@pytest.mark.parametrize(
    ("payload", "path", "kind"),
    [
        ({"a": (1, 2)}, "$.a", "of type tuple"),
        ({"a": {1, 2}}, "$.a", "of type set"),
        ([b"secret-bytes"], "$[0]", "of type bytes"),
        ({"price": decimal.Decimal("1.10")}, "$.price", "of type Decimal"),
        ({"at": datetime.datetime(2026, 1, 1)}, "$.at", "of type datetime"),
        ({"c": Colour.RED}, "$.c", "of type Colour"),
        ({"s": MyStr("x")}, "$.s", "of type MyStr"),
        ({"d": MyDict()}, "$.d", "of type MyDict"),
        ({"f": MyFloat(1.0)}, "$.f", "of type MyFloat"),
        ({"o": OrderedDict()}, "$.o", "of type OrderedDict"),
        ({"n": float("nan")}, "$.n", "a non-finite number"),
        ({"n": [float("inf")]}, "$.n[0]", "a non-finite number"),
        ({"n": -float("inf")}, "$.n", "a non-finite number"),
        ({"x": {1: "a"}}, "$.x", "an object with a key that is not a str"),
        ({"x": {None: "a"}}, "$.x", "an object with a key that is not a str"),
        ({"a b": [None, {"q-r": object()}]}, '$["a b"][1]["q-r"]', "of type object"),
    ],
)
def test_a_value_json_cannot_carry_is_refused_by_path_and_kind(
    payload: Any, path: str, kind: str
) -> None:
    with pytest.raises(TypeError) as e:
        payload_text(payload)
    assert str(e.value) == f"payload {path} is {kind}, which JSON cannot carry exactly"
    assert "secret-bytes" not in str(e.value)
    assert "1.10" not in str(e.value)


def test_a_cycle_is_refused() -> None:
    a: list[Any] = [1]
    a.append({"back": a})
    with pytest.raises(TypeError, match=r"payload \$\[1\]\.back is a cycle"):
        payload_text(a)


def test_a_shared_but_acyclic_value_is_allowed() -> None:
    shared = {"x": 1}
    assert payload_text([shared, shared]) == '[{"x":1},{"x":1}]'


def test_an_int_past_the_digit_limit_is_refused_by_path_and_the_limit_unchanged() -> None:
    limit = sys.get_int_max_str_digits()
    assert limit > 0
    at_limit = 10 ** (limit - 1)
    assert payload_text({"n": at_limit}) == dumps({"n": at_limit})
    big = 7 * 10**5000  # 5001 digits
    with pytest.raises(TypeError) as e:
        payload_text({"a": [0, big]})
    assert str(e.value) == (
        "payload $.a[1] is an int longer than the process's digit limit, "
        "which JSON cannot carry exactly"
    )
    assert "7000" not in str(e.value)
    assert e.value.__cause__ is None
    assert e.value.__suppress_context__
    assert sys.get_int_max_str_digits() == limit


@pytest.mark.parametrize("depth", [10_000, 1_000_000])
def test_depth_is_not_limited(depth: int) -> None:
    v: Any = 1
    for _ in range(depth):
        v = [v] if depth % 2 else {"a": v}
    text = payload_text(v)
    assert len(text) > 2 * depth
    assert text.endswith("1" + "}" * depth)
