# SPDX-License-Identifier: Apache-2.0
#
# The Python driver's `names` and `surface` (conformance/README.md; the names
# check, FR-17), read from the package by introspection, never from a hand-kept
# list. `names`: every name in `soorma.__all__`, and every public member of every
# exported class: its attributes, methods and properties, its dataclass fields,
# and what its __init__ assigns to `self`, from the classes soorma defines only
# (what Exception or AttributeError declare is not the SDK's). A TypedDict's
# keys are wire data, not members (as TypeScript's driver leaves type aliases).
# `surface`: the settable members, which are the client options' fields.
from __future__ import annotations

import ast
import dataclasses
import inspect
import textwrap
from typing import is_typeddict

import soorma

IDIOMS = {"__aiter__", "__anext__", "__aenter__", "__aexit__"}


def _assigned_in_init(cls: type) -> set[str]:
    init = vars(cls).get("__init__")
    if init is None:
        return set()
    try:
        source = textwrap.dedent(inspect.getsource(init))
    except (OSError, TypeError):
        return set()
    out: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        targets: list[ast.expr] = []
        if isinstance(node, ast.Assign):
            targets = node.targets
        elif isinstance(node, ast.AnnAssign):
            targets = [node.target]
        for t in targets:
            if (
                isinstance(t, ast.Attribute)
                and isinstance(t.value, ast.Name)
                and t.value.id == "self"
            ):
                out.add(t.attr)
    return out


def _members(cls: type) -> set[str]:
    out: set[str] = set()
    for c in cls.__mro__:
        if not c.__module__.startswith("soorma"):
            continue
        out.update(vars(c))
        out.update(_assigned_in_init(c))
        if dataclasses.is_dataclass(c):
            out.update(f.name for f in dataclasses.fields(c))
    return {n for n in out if not n.startswith("_") or n in IDIOMS}


def exported_names() -> list[str]:
    names: set[str] = set(soorma.__all__)
    for name in soorma.__all__:
        obj = getattr(soorma, name)
        if isinstance(obj, type) and not is_typeddict(obj):
            names |= _members(obj)
    return sorted(names)


def settable_members() -> list[str]:
    return sorted(f.name for f in dataclasses.fields(soorma.AgentClientOptions))
