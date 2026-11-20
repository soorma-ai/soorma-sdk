# SPDX-License-Identifier: Apache-2.0
#
# The values hook the driver protocol requires (conformance/README.md, "Values
# and the timing hook"; PH-API-06): not exported, not in the name table, and
# excluded from the built distribution. No published module imports it; it
# imports _limits and sets its slot.
from __future__ import annotations

from collections.abc import Mapping

from soorma import _limits


def set_test_values(values: Mapping[str, int] | None) -> None:
    """Named values for the next client constructed; None clears them."""
    _limits._set_slot(values)
