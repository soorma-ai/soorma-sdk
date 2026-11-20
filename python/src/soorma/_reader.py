# SPDX-License-Identifier: Apache-2.0
#
# The delivery reader (C-18; RCV-01 to RCV-08; PH-RD-01 to 07; P-09). One
# iterative, strict scan over a `delivery` event's data records each outer
# member's name, the exact text span of its value and its nesting depth,
# building no value, so no line can reach RecursionError. NaN and Infinity,
# which Python's json accepts, are refused. The envelope is parsed from its own
# span only within D_lang, never schema-validated (DEC-U1-09), and deeply read
# only; one that still fails to parse is `envelope-unparsed`. The payload is
# parsed within D_lang as plain JSON types; deeper, or failing to parse (the
# digit limit, RecursionError), it is left unparsed and `payload` raises
# PayloadNotParsed (PH-RD-06, -07). The process's digit limit is never changed.
# A line that is not a usable Delivery is a DeliveryError; the stream continues.
from __future__ import annotations

import json
import re
from collections.abc import Awaitable, Callable, Mapping
from types import MappingProxyType
from typing import Any, NoReturn, cast

from ._errors import ClientStateError, PayloadNotParsed
from ._limits import D_LANG
from ._types import DeliveryError, Envelope, JsonValue, PublishAccepted

Forwarder = Callable[[JsonValue, str, str, object], Awaitable[PublishAccepted]]
"""How a Delivery forwards: (payload, envelope_text, seal, received trace context)."""

_WS = re.compile(r"[ \t\n\r]*")
_STRING = re.compile(r'"(?:[^"\\\x00-\x1f]+|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"')
_NUMBER = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?")


class _Invalid(Exception):
    pass


def _ws(s: str, i: int) -> int:
    m = _WS.match(s, i)
    return i if m is None else m.end()


def _string(s: str, i: int) -> int:
    m = _STRING.match(s, i)
    if m is None:
        raise _Invalid
    return m.end()


def _value(s: str, i: int) -> tuple[int, int]:
    """Scans one JSON value at `i`, iteratively: its end and its nesting depth."""
    # Each open container: [closer, expecting a key, members so far].
    stack: list[list[Any]] = []
    depth = 0
    while True:
        i = _ws(s, i)
        top = stack[-1] if stack else None
        if top is not None and top[0] == "}" and top[1]:
            if top[2] == 0 and s.startswith("}", i):
                stack.pop()
                i += 1
            else:
                if not s.startswith('"', i):
                    raise _Invalid
                i = _ws(s, _string(s, i))
                if not s.startswith(":", i):
                    raise _Invalid
                i += 1
                top[1] = False
                continue
        elif top is not None and top[0] == "]" and top[2] == 0 and s.startswith("]", i):
            stack.pop()
            i += 1
        else:
            c = s[i : i + 1]
            if c in ("{", "["):
                stack.append(["}" if c == "{" else "]", c == "{", 0])
                depth = max(depth, len(stack))
                i += 1
                continue
            if c == '"':
                i = _string(s, i)
            elif s.startswith("true", i):
                i += 4
            elif s.startswith("false", i):
                i += 5
            elif s.startswith("null", i):
                i += 4
            else:
                m = _NUMBER.match(s, i)
                if m is None:
                    raise _Invalid
                i = m.end()
        # A value, or a container, just ended: a separator, a close, or the end.
        while True:
            if not stack:
                return i, depth
            cur = stack[-1]
            i = _ws(s, i)
            cur[2] += 1
            if s.startswith(",", i):
                i += 1
                if cur[0] == "}":
                    cur[1] = True
                break
            if s.startswith(cur[0], i):
                stack.pop()
                i += 1
                continue
            raise _Invalid


class _Member:
    __slots__ = ("depth", "end", "first", "name", "start")

    def __init__(self, name: str, start: int, end: int, depth: int, first: str) -> None:
        self.name = name
        self.start = start
        self.end = end
        self.depth = depth
        self.first = first


def _members(s: str) -> list[_Member] | str:
    """The outer object's members with their exact spans and depths (PH-RD-01)."""
    try:
        i = _ws(s, 0)
        if not s.startswith("{", i):
            end, _ = _value(s, i)
            return "not-an-object" if _ws(s, end) == len(s) else "not-json"
        i = _ws(s, i + 1)
        out: list[_Member] = []
        if s.startswith("}", i):
            return out if _ws(s, i + 1) == len(s) else "not-json"
        while True:
            if not s.startswith('"', i):
                return "not-json"
            key_end = _string(s, i)
            name = json.loads(s[i:key_end])
            i = _ws(s, key_end)
            if not s.startswith(":", i):
                return "not-json"
            start = _ws(s, i + 1)
            end, depth = _value(s, start)
            out.append(_Member(name, start, end, depth, s[start : start + 1]))
            i = _ws(s, end)
            if s.startswith(",", i):
                i = _ws(s, i + 1)
                continue
            if s.startswith("}", i):
                return out if _ws(s, i + 1) == len(s) else "not-json"
            return "not-json"
    except (_Invalid, ValueError):
        return "not-json"


def _freeze(value: object) -> object:
    """Deeply read only, iteratively: objects as MappingProxyType, arrays as tuples."""
    results: list[object] = []
    stack: list[tuple[object, bool]] = [(value, False)]
    while stack:
        x, built = stack.pop()
        if isinstance(x, dict | list):
            if not built:
                stack.append((x, True))
                children = list(x.values()) if isinstance(x, dict) else x
                stack.extend((c, False) for c in reversed(children))
                continue
            n = len(x)
            parts = results[len(results) - n :] if n else []
            del results[len(results) - n :]
            if isinstance(x, dict):
                results.append(MappingProxyType(dict(zip(x.keys(), parts, strict=True))))
            else:
                results.append(tuple(parts))
        else:
            results.append(x)
    return results[0]


_UNSET: Any = object()


class Delivery:
    """One received Delivery (RCV-02). Read only; `publish` forwards (FWD-01)."""

    __slots__ = ("_envelope", "_envelope_text", "_forward", "_payload", "_payload_text", "_seal")

    _envelope: Envelope
    _envelope_text: str
    _seal: str
    _payload: JsonValue
    _payload_text: str
    _forward: Forwarder | None

    def __init__(self) -> None:
        raise TypeError("Deliveries are made by the SDK only")

    @classmethod
    def _make(
        cls,
        *,
        envelope: Envelope,
        envelope_text: str,
        seal: str,
        payload: JsonValue,
        payload_text: str,
        forward: Forwarder | None,
    ) -> Delivery:
        d = object.__new__(cls)
        for name, value in (
            ("_envelope", envelope),
            ("_envelope_text", envelope_text),
            ("_seal", seal),
            ("_payload", payload),
            ("_payload_text", payload_text),
            ("_forward", forward),
        ):
            object.__setattr__(d, name, value)
        return d

    def __setattr__(self, name: str, value: object) -> NoReturn:
        raise AttributeError(f"Delivery is read only: {name}")

    def __delattr__(self, name: str) -> NoReturn:
        raise AttributeError(f"Delivery is read only: {name}")

    @property
    def envelope(self) -> Envelope:
        """The envelope as sent, read only, never schema-checked (RCV-02; PH-RD-05)."""
        return self._envelope

    @property
    def envelope_text(self) -> str:
        """The envelope's exact text, as received (RCV-03)."""
        return self._envelope_text

    @property
    def seal(self) -> str:
        return self._seal

    @property
    def payload(self) -> JsonValue:
        """The payload as plain JSON types. Raises PayloadNotParsed when it was not parsed
        (beyond D_lang, or a parse limit): check `payload_parsed`, or use `payload_text`."""
        if self._payload is _UNSET:
            raise PayloadNotParsed()
        return self._payload

    @property
    def payload_text(self) -> str:
        """The payload's exact text, as received (RCV-05)."""
        return self._payload_text

    @property
    def payload_parsed(self) -> bool:
        return self._payload is not _UNSET

    async def publish(self, payload: JsonValue) -> PublishAccepted:
        """Publishes, forwarding this Delivery's context: the default path (FWD-01, FWD-06)."""
        if self._forward is None:
            raise ClientStateError("closed")
        trace_context = cast(Mapping[str, object], self._envelope).get("traceContext")
        return await self._forward(payload, self._envelope_text, self._seal, trace_context)

    def __repr__(self) -> str:
        return f"<Delivery payload_parsed={self.payload_parsed}>"

    def __reduce__(self) -> NoReturn:
        raise TypeError("Delivery is not picklable")


def _error(reason: str, line: str) -> DeliveryError:
    return DeliveryError(reason, line)


def read_delivery(line: str, forward: Forwarder | None = None) -> Delivery | DeliveryError:
    """One `delivery` event's data, as a Delivery or a DeliveryError (RCV-01 to RCV-07)."""
    found = _members(line)
    if isinstance(found, str):
        return _error(found, line)
    picked: dict[str, _Member] = {}
    for m in found:
        if m.name in ("envelope", "seal", "payload"):
            if m.name in picked:
                return _error("duplicate-member", line)
            picked[m.name] = m
    env, seal, payload = picked.get("envelope"), picked.get("seal"), picked.get("payload")
    if env is None or env.first != "{":
        return _error("missing-envelope", line)
    if seal is None or seal.first != '"':
        return _error("missing-seal", line)
    if payload is None:
        return _error("missing-payload", line)
    if env.depth > D_LANG:
        return _error("envelope-too-deep", line)
    envelope_text = line[env.start : env.end]
    try:
        envelope = _freeze(json.loads(envelope_text))
    except (ValueError, RecursionError):
        return _error("envelope-unparsed", line)
    payload_text = line[payload.start : payload.end]
    value: JsonValue = _UNSET
    if payload.depth <= D_LANG:
        try:
            value = json.loads(payload_text)
        except (ValueError, RecursionError):
            value = _UNSET  # PH-RD-06: left unparsed; the Delivery is intact
    return Delivery._make(
        envelope=cast(Envelope, envelope),
        envelope_text=envelope_text,
        seal=json.loads(line[seal.start : seal.end]),
        payload=value,
        payload_text=payload_text,
        forward=forward,
    )
