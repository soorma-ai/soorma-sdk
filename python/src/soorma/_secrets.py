# SPDX-License-Identifier: Apache-2.0
#
# file_secret (C-13): filled in G5.
from __future__ import annotations

from ._errors import SecretSourceError
from ._types import SecretProvider


def file_secret(path: str) -> SecretProvider:
    """A provider reading the agent's secret file, checked first (SEC-03 to SEC-09)."""

    async def provider() -> str:
        raise SecretSourceError("unreadable", path)

    return provider
