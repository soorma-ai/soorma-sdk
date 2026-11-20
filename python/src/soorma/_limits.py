# SPDX-License-Identifier: Apache-2.0
#
# The named values (spec §0; NFR-U4-06): NFR Requirements' values for Python,
# in one module. The values hook (soorma/_internal/, never shipped) may set a
# slot that a client captures once, at construction (PH-API-06).
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, replace

D_LANG = 256
"""The parse-depth bound (NFR-03; U4-NFR-Q1 A). Not one of the values a case may set."""


@dataclass(frozen=True, slots=True)
class Limits:
    """Milliseconds, items or bytes, as spec §0 names them."""

    H_renew: int = 120_000
    R_min: int = 30_000
    R_max: int = 5
    W_max: int = 60_000
    B_init: int = 500
    B_factor: int = 2
    B_cap: int = 10_000
    L_ends: int = 5
    W_super: int = 10_000
    N_buf: int = 64
    T_idle: int = 45_000
    T_req: int = 10_000
    L_event: int = 1_048_576
    B_body: int = 1_048_576


LIMITS = Limits()

_slot: Mapping[str, int] | None = None


def _set_slot(values: Mapping[str, int] | None) -> None:
    """Called only by soorma/_internal/test_values.py."""
    global _slot  # noqa: PLW0603 - the one module-level slot, by design
    _slot = None if values is None else dict(values)


def capture() -> Limits:
    """The values in force, captured when a client is constructed."""
    if _slot is None:
        return LIMITS
    known = {k: int(v) for k, v in _slot.items() if k in Limits.__dataclass_fields__}
    return replace(LIMITS, **known)
