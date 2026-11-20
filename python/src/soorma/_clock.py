# SPDX-License-Identifier: Apache-2.0
#
# The clock seam (P-05; PH-CLK-01): every time read in the package goes through
# here. `time.time()` is looked up at each call, never bound at import, so a
# patched time.time reaches the SDK (the end-to-end test's skew); PH-CLK-02's
# check (tests/test_clock_binding.py) enforces it.
from __future__ import annotations

import time


def wall_now() -> float:
    """Seconds since the epoch, by the wall clock: compared with expiries only."""
    return time.time()


def mono_now() -> float:
    """Seconds by the monotonic clock: floors, timeouts and backoff."""
    return time.monotonic()
