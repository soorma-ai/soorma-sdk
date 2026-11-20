# SPDX-License-Identifier: Apache-2.0
#
# The one retry policy (P-01; PRB-05, PRB-06, PRB-08 to PRB-10): the table,
# R_max attempts, Retry-After before backoff, W_max, and renewal retrying only
# while the credential is usable (CDI-06).
from __future__ import annotations

import asyncio
from dataclasses import replace

import pytest

from soorma import ProblemError, TransportError, _clock
from soorma._limits import LIMITS
from soorma._retry import retry, retryable

FAST = replace(LIMITS, B_init=1, B_cap=4, W_max=2_000, R_max=5)


def fake_sleep(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    """asyncio.sleep recorded, and the monotonic clock advanced by it."""
    slept: list[float] = []
    now = [1000.0]

    async def sleep(s: float) -> None:
        slept.append(s)
        now[0] += s

    monkeypatch.setattr(asyncio, "sleep", sleep)
    monkeypatch.setattr(_clock, "mono_now", lambda: now[0])
    return slept


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (ProblemError(503, "unavailable"), True),
        (ProblemError(429, "too_many_requests"), False),
        (ProblemError(500, None), False),
        (ProblemError(400, "bad"), False),
        (ProblemError(401, "credential_expired"), False),
        (TransportError("connection", sent=False), True),
        (TransportError("connection", sent=True), True),
        (TransportError("timeout", sent=True), True),
        (TransportError("tls"), False),
        (TransportError("response-too-large"), False),
        (TransportError("unusable-response"), False),
        (TransportError("ca-file"), False),
        (ValueError("x"), False),
    ],
)
@pytest.mark.parametrize("kind", ["bootstrap", "renewal", "subscribe"])
def test_the_table(kind: str, error: BaseException, expected: bool) -> None:
    assert retryable(kind, error, None) is expected  # type: ignore[arg-type]


def test_renewal_retries_only_while_usable() -> None:
    e = ProblemError(503, None)
    assert retryable("renewal", e, lambda: True) is True
    assert retryable("renewal", e, lambda: False) is False
    assert retryable("bootstrap", e, lambda: False) is True


@pytest.mark.asyncio
async def test_at_most_r_max_attempts() -> None:
    calls = 0

    async def attempt() -> int:
        nonlocal calls
        calls += 1
        raise ProblemError(503, None)

    with pytest.raises(ProblemError):
        await retry("bootstrap", attempt, FAST)
    assert calls == FAST.R_max


@pytest.mark.asyncio
async def test_a_success_after_failures_is_returned() -> None:
    answers: list[Exception | int] = [TransportError("connection"), ProblemError(503, None), 7]

    async def attempt() -> int:
        a = answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return a

    assert await retry("subscribe", attempt, FAST) == 7


@pytest.mark.asyncio
async def test_a_never_retried_error_is_raised_at_once() -> None:
    calls = 0

    async def attempt() -> int:
        nonlocal calls
        calls += 1
        raise ProblemError(429, None, retry_after=0)

    with pytest.raises(ProblemError):
        await retry("bootstrap", attempt, FAST)
    assert calls == 1


@pytest.mark.asyncio
async def test_retry_after_is_used_and_w_max_bounds_the_waiting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    slept = fake_sleep(monkeypatch)

    async def attempt() -> int:
        raise ProblemError(503, None, retry_after=0.9)

    with pytest.raises(ProblemError):
        await retry("bootstrap", attempt, replace(FAST, W_max=1_000))
    # The first wait fits in W_max; a second 0.9 s does not, so it stops rather than wait.
    assert slept == [0.9]


@pytest.mark.asyncio
async def test_backoff_grows_by_the_factor_up_to_the_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    slept = fake_sleep(monkeypatch)

    async def attempt() -> int:
        raise TransportError("connection")

    limits = replace(LIMITS, B_init=500, B_factor=2, B_cap=1_500, R_max=5, W_max=60_000)
    with pytest.raises(TransportError):
        await retry("bootstrap", attempt, limits)
    assert slept == [0.5, 1.0, 1.5, 1.5]
