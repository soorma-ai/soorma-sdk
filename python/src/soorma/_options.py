# SPDX-License-Identifier: Apache-2.0
#
# The client's options (C-12): presence and type only, reading nothing about
# the host or the environment (CFG-01, CFG-02, CFG-05 to CFG-07).
from __future__ import annotations

import uuid
from dataclasses import dataclass

from ._types import SecretProvider


@dataclass(frozen=True, slots=True, kw_only=True)
class AgentClientOptions:
    """An unknown keyword is a TypeError, so no misspelt switch passes (PH-API-03)."""

    data_gateway_url: str
    event_ingest_url: str
    agent: str
    instance: str
    secret: SecretProvider
    ca_file: str | None = None


def new_instance_id() -> str:
    """A random UUID v4, reading nothing about the host (CFG-06)."""
    return str(uuid.uuid4())
