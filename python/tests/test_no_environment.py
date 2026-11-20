# SPDX-License-Identifier: Apache-2.0
#
# PH-API-05 (CFG-05, CFG-07; TC-PH-006): the SDK reads no environment variable
# and nothing about the host. A static check over every module of the package.
from __future__ import annotations

import ast
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "soorma"
FORBIDDEN = {
    ("os", "environ"),
    ("os", "environb"),
    ("os", "getenv"),
    ("os", "getenvb"),
    ("os", "putenv"),
    ("os", "uname"),
    ("socket", "gethostname"),
    ("socket", "getfqdn"),
    ("platform", "node"),
    ("platform", "uname"),
}


def problems(source: str, name: str) -> list[str]:
    found: list[str] = []
    for node in ast.walk(ast.parse(source, name)):
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and (node.value.id, node.attr) in FORBIDDEN
        ):
            found.append(f"{name}:{node.lineno}")
        if isinstance(node, ast.ImportFrom) and node.module in {"os", "socket", "platform"}:
            found.extend(
                f"{name}:{node.lineno}"
                for alias in node.names
                if (node.module, alias.name) in FORBIDDEN
            )
    return found


def test_no_module_reads_the_environment_or_the_host() -> None:
    found: list[str] = []
    for path in sorted(SRC.rglob("*.py")):
        found += problems(path.read_text(), str(path.relative_to(SRC)))
    assert found == []


def test_the_check_finds_each_form() -> None:
    for src in (
        "import os\nx = os.environ['A']\n",
        "import os\nos.getenv('A')\n",
        "from os import environ\n",
        "import socket\nsocket.gethostname()\n",
        "from platform import node\n",
    ):
        assert problems(src, "m.py") != [], src
