# SPDX-License-Identifier: Apache-2.0
#
# The payload walk (PH-PUB-01; P-09; U4-FD-Q6): a value JSON cannot carry
# exactly is refused before any request, by a TypeError naming the path and the
# kind, never the value. Exact types only: dict with str keys, list, str, int,
# finite float, bool, None (subclasses refused, bool aside). An int longer than
# the process's sys.get_int_max_str_digits() is refused the same way; the limit
# is read, never changed. Depth is not limited (PUB-04): the walk is iterative.
# For every accepted value the text equals json.dumps(value, ensure_ascii=False,
# separators=(",", ":"), allow_nan=False), except that a lone surrogate is
# written as its \uXXXX escape, so the body is always valid UTF-8.
from __future__ import annotations

import json
import math
import re

_IDENT = re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*")
_SURROGATE = re.compile("[\ud800-\udfff]")
_encode_str = json.encoder.encode_basestring  # ensure_ascii=False's string encoder


class _Path:
    """A path built only when a value is refused: each step is O(1), so a deep payload
    costs linear time (a string per level would be quadratic)."""

    __slots__ = ("key", "parent")

    def __init__(self, parent: _Path | None, key: str | int | None) -> None:
        self.parent = parent
        self.key = key

    def __str__(self) -> str:
        keys: list[str | int] = []
        node: _Path | None = self
        while node is not None and node.key is not None:
            keys.append(node.key)
            node = node.parent
        out = ["$"]
        for key in reversed(keys):
            if isinstance(key, int):
                out.append(f"[{key}]")
            elif _IDENT.fullmatch(key):
                out.append(f".{key}")
            else:
                out.append(f"[{_string(key)}]")
        return "".join(out)


def _string(s: str) -> str:
    text = _encode_str(s)
    if _SURROGATE.search(text) is None:
        return text
    return _SURROGATE.sub(lambda m: f"\\u{ord(m.group()):04x}", text)


def _refuse(path: _Path, kind: str) -> TypeError:
    return TypeError(f"payload {path} is {kind}, which JSON cannot carry exactly")


class _Raw:
    __slots__ = ("text",)

    def __init__(self, text: str) -> None:
        self.text = text


class _Exit:
    __slots__ = ("of",)

    def __init__(self, of: int) -> None:
        self.of = of


def payload_text(payload: object) -> str:
    """Checks the payload and returns its compact JSON text, in one iterative walk."""
    out: list[str] = []
    ancestors: set[int] = set()
    stack: list[tuple[object, _Path] | _Raw | _Exit] = [(payload, _Path(None, None))]
    while stack:
        f = stack.pop()
        if isinstance(f, _Raw):
            out.append(f.text)
            continue
        if isinstance(f, _Exit):
            ancestors.discard(f.of)
            continue
        v, path = f
        t = type(v)
        if v is None:
            out.append("null")
        elif t is bool:
            out.append("true" if v else "false")
        elif t is str:
            out.append(_string(v))  # type: ignore[arg-type]
        elif t is int:
            try:
                out.append(int.__repr__(v))
            except ValueError:
                raise _refuse(path, "an int longer than the process's digit limit") from None
        elif t is float:
            if not math.isfinite(v):  # type: ignore[arg-type]
                raise _refuse(path, "a non-finite number")
            out.append(float.__repr__(v))
        elif t is list or t is dict:
            if id(v) in ancestors:
                raise _refuse(path, "a cycle")
            ancestors.add(id(v))
            stack.append(_Exit(id(v)))
            if t is list:
                items: list[object] = v  # type: ignore[assignment]
                stack.append(_Raw("]"))
                for i in range(len(items) - 1, -1, -1):
                    stack.append((items[i], _Path(path, i)))
                    if i > 0:
                        stack.append(_Raw(","))
                stack.append(_Raw("["))
            else:
                members: dict[object, object] = v  # type: ignore[assignment]
                pairs = list(members.items())
                for k, _ in pairs:
                    if type(k) is not str:
                        raise _refuse(path, "an object with a key that is not a str")
                stack.append(_Raw("}"))
                for i in range(len(pairs) - 1, -1, -1):
                    k, x = pairs[i]
                    key: str = k  # type: ignore[assignment]
                    stack.append((x, _Path(path, key)))
                    stack.append(_Raw(("," if i > 0 else "") + _string(key) + ":"))
                stack.append(_Raw("{"))
        else:
            raise _refuse(path, f"of type {t.__name__}")
    return "".join(out)
