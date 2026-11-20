# SPDX-License-Identifier: Apache-2.0
#
# PH-CLK-02 (TC-PH-078; the user's addition to U4-FD-Q8): nothing under the
# package binds a wall-clock function at import, so a patched time.time always
# reaches the SDK. An ast walk, since a name ban cannot tell a call from a
# stored reference.
from __future__ import annotations

import ast
import time
from pathlib import Path

import pytest

from soorma import _clock

PACKAGE = Path(__file__).resolve().parents[1] / "src" / "soorma"
TIME_FNS = {"time", "time_ns"}
DT_FNS = {"now", "utcnow", "today"}


def _wall_refs(tree: ast.AST) -> tuple[list[ast.AST], list[str]]:
    """Every reach to a wall-clock function, through any name its module or class is
    imported as; and every import that binds one directly."""
    time_mods: set[str] = set()
    dt_mods: set[str] = set()
    dt_classes: set[str] = set()
    bound: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                if a.name == "time":
                    time_mods.add(a.asname or "time")
                if a.name == "datetime":
                    dt_mods.add(a.asname or "datetime")
        if isinstance(node, ast.ImportFrom) and node.module in ("time", "datetime"):
            for a in node.names:
                if node.module == "time" and a.name in TIME_FNS:
                    bound.append(f"{node.lineno}: from time import {a.name}")
                if node.module == "datetime" and a.name in ("datetime", "date"):
                    dt_classes.add(a.asname or a.name)
    refs: list[ast.AST] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Attribute):
            continue
        v = node.value
        if isinstance(v, ast.Name) and (
            (v.id in time_mods and node.attr in TIME_FNS)
            or (v.id in dt_classes and node.attr in DT_FNS)
        ):
            refs.append(node)
        if (
            isinstance(v, ast.Attribute)
            and isinstance(v.value, ast.Name)
            and v.value.id in dt_mods
            and v.attr in ("datetime", "date")
            and node.attr in DT_FNS
        ):
            refs.append(node)
    return refs, bound


def problems(source: str, name: str) -> list[str]:
    tree = ast.parse(source)
    refs, bound = _wall_refs(tree)
    out = [f"{name}:{b}" for b in bound]
    if not name.endswith("_clock.py"):
        out += [f"{name}:{r.lineno}: a wall clock read outside _clock.py" for r in refs]  # type: ignore[attr-defined]
        return out
    # In _clock.py: only time.time() called inside a function body, never stored.
    callees = {id(n.func) for n in ast.walk(tree) if isinstance(n, ast.Call)}
    in_functions = {
        id(n) for fn in tree.body if isinstance(fn, ast.FunctionDef) for n in ast.walk(fn)
    }
    defaults = {
        id(n)
        for fn in tree.body
        if isinstance(fn, ast.FunctionDef)
        for d in [*fn.args.defaults, *[k for k in fn.args.kw_defaults if k is not None]]
        for n in ast.walk(d)
    }
    for r in refs:
        if id(r) not in callees or id(r) not in in_functions or id(r) in defaults:
            out.append(f"{name}:{r.lineno}: a wall clock bound, not called in a function")  # type: ignore[attr-defined]
    return out


def test_the_package_binds_no_wall_clock_at_import() -> None:
    found: list[str] = []
    for path in sorted(PACKAGE.rglob("*.py")):
        found += problems(path.read_text(), str(path.relative_to(PACKAGE)))
    assert found == []


@pytest.mark.parametrize(
    ("name", "source"),
    [
        ("_a.py", "from time import time\n"),
        ("_a.py", "from time import time_ns\n"),
        ("_a.py", "from datetime import datetime\nx = datetime.now()\n"),
        ("_a.py", "import time\nnow = time.time\n"),
        ("_a.py", "import time\ndef f():\n    return time.time()\n"),
        ("_a.py", "import datetime\ndef f():\n    return datetime.datetime.now()\n"),
        ("_a.py", "import time as t\ndef f():\n    return t.time()\n"),
        ("_a.py", "from datetime import datetime as dt\ndef f():\n    return dt.now()\n"),
        ("_a.py", "import datetime as d\nNOW = d.datetime.utcnow\n"),
        ("_clock.py", "import time\nnow = time.time\n"),
        ("_clock.py", "import time\ndef f(now=time.time):\n    return now()\n"),
        ("_clock.py", "import time\nT = time.time()\n"),
    ],
)
def test_each_forbidden_form_fails_naming_its_file_and_line(name: str, source: str) -> None:
    found = problems(source, name)
    assert found
    assert all(f.startswith(f"{name}:") for f in found)


def test_a_patched_time_time_reaches_the_sdk(monkeypatch: pytest.MonkeyPatch) -> None:
    mono = _clock.mono_now()
    monkeypatch.setattr(time, "time", lambda: 1_000.0)
    assert _clock.wall_now() == 1_000.0
    assert _clock.mono_now() >= mono


def test_no_published_module_imports_the_values_hook() -> None:
    for path in sorted(PACKAGE.rglob("*.py")):
        if "_internal" in path.parts:
            continue
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                assert "_internal" not in (node.module or ""), path
            if isinstance(node, ast.Import):
                assert all("_internal" not in a.name for a in node.names), path
