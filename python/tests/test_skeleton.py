# SPDX-License-Identifier: Apache-2.0
#
# The skeleton (U4 G3): exactly the name table's Python column, the generated
# types importable, and a client that contacts nothing when created.
from __future__ import annotations

import re
from pathlib import Path

import soorma
from soorma import AgentClient, AgentClientOptions, new_instance_id
from soorma._generated import components, data_gateway, envelope, event_ingest

ROOT = Path(__file__).resolve().parents[2]


def python_column() -> set[str]:
    names: set[str] = set()
    for section in (ROOT / "spec" / "names.md").read_text().split("\n## ")[1:]:
        rows = [r for r in section.splitlines() if r.startswith("|")]
        if not rows:
            continue
        header = [c.strip() for c in rows[0].split("|")[1:-1]]
        if "Python" not in header or section.startswith("Members"):
            continue
        col = header.index("Python")
        for row in rows[2:]:
            cells = [c.strip() for c in row.split("|")[1:-1]]
            names.update(re.findall(r"`([^`]+)`", cells[col]))
    names.discard("soorma")
    return names


def test_exports_exactly_the_python_column() -> None:
    assert set(soorma.__all__) == python_column()
    for name in soorma.__all__:
        assert hasattr(soorma, name), name


def test_generated_types_are_importable() -> None:
    assert envelope.Envelope.__total__ is False
    assert "envelopeVersion" not in envelope.Draft.__annotations__
    for module in (components, data_gateway, event_ingest):
        assert module.__all__


def test_options_refuse_an_unknown_keyword_and_creating_contacts_nothing() -> None:
    calls: list[str] = []

    def provider() -> str:
        calls.append("called")
        return "s"

    options = AgentClientOptions(
        data_gateway_url="https://s3.invalid",
        event_ingest_url="https://s4.invalid",
        agent="agent-a",
        instance=new_instance_id(),
        secret=provider,
    )
    AgentClient(options)
    assert calls == []
    try:
        AgentClientOptions(  # type: ignore[call-arg]
            data_gateway_url="https://s3.invalid",
            event_ingest_url="https://s4.invalid",
            agent="a",
            instance="i",
            secret=provider,
            reject_unauthorized=False,
        )
    except TypeError:
        pass
    else:
        raise AssertionError("an unknown option was accepted")
