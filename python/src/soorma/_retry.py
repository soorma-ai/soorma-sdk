# SPDX-License-Identifier: Apache-2.0
#
# The one retry policy (P-01; NFR-U4-12; PRB-05, PRB-06, PRB-08 to PRB-10).
# Bootstrap, renewal and subscribe only; a publish never comes here.
#   503                                        retry (renewal: while usable)
#   connection failure, before or after sent   retry (renewal: while usable)
#   TLS failure, 429, other 4xx, 500           never
#   a body over B_body, an unusable response   never
# Retry-After first, else backoff; at most R_max attempts and W_max of waiting.
from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Literal, TypeVar

from . import _clock
from ._errors import ProblemError, TransportError
from ._limits import Limits

T = TypeVar("T")
RetryKind = Literal["bootstrap", "renewal", "subscribe"]

NEVER = frozenset({"tls", "response-too-large", "unusable-response", "ca-file"})


def retryable(kind: RetryKind, error: BaseException, usable: Callable[[], bool] | None) -> bool:
    still = kind != "renewal" or usable is None or usable()
    if isinstance(error, ProblemError):
        return error.status == 503 and still
    if isinstance(error, TransportError):
        return error.reason not in NEVER and still
    return False


async def retry(
    kind: RetryKind,
    attempt: Callable[[], Awaitable[T]],
    limits: Limits,
    usable: Callable[[], bool] | None = None,
) -> T:
    started = _clock.mono_now()
    backoff = limits.B_init / 1000
    n = 1
    while True:
        try:
            return await attempt()
        except (ProblemError, TransportError) as error:
            if not retryable(kind, error, usable) or n >= limits.R_max:
                raise
            ra = error.retry_after if isinstance(error, ProblemError) else None
            wait = ra if ra is not None else backoff
            if _clock.mono_now() - started + wait > limits.W_max / 1000:
                raise
            await asyncio.sleep(wait)
            backoff = min(backoff * limits.B_factor, limits.B_cap / 1000)
            n += 1
