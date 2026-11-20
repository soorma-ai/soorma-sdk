# SPDX-License-Identifier: Apache-2.0
#
# The credential keeper (C-14; P-02, P-03, P-12), over a scripted S3:
# the skew path renews at most once per R_min and warns once per lineage
# (TC-PH-072's unit half); with warnings as errors it still renews at the floor
# (TC-PH-077); more than a lifetime ahead, the credential is used until S3
# says credential_expired, then one bootstrap (TC-PH-075's unit half); on a
# warned lineage a 503 renewal is retried without a bootstrap (TC-PH-080's
# renewal half); a retried bootstrap calls the provider once per attempt and
# holds no secret while it waits (TC-PH-083's unit half); refusal is terminal;
# a credential's unknown environment members are kept (CDI-04).
from __future__ import annotations

import asyncio
import json
import sys
import time
import warnings
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from itertools import pairwise
from typing import Any
from uuid import uuid4

import pytest

from soorma import (
    ClientStateError,
    ProblemError,
    SecretSourceError,
    SoormaWarning,
    TransportError,
    _keeper,
)
from soorma._keeper import CLOCK_SKEW_CODE, KeeperCore, parse_credential
from soorma._limits import LIMITS
from soorma._transport import Reply

RENEW = "/agent-credentials/current/renewal"
BOOT = "/agent-credentials"
LIMITS_FAST = replace(LIMITS, R_min=200, B_init=20, B_cap=50, W_max=5_000)


def cred(token: str, expires_in: float, **env_extra: Any) -> Reply:
    at = datetime.fromtimestamp(time.time() + expires_in, UTC).isoformat().replace("+00:00", "Z")
    env = {"organization": "o", "project": "p", "environment": "e", **env_extra}
    body = {"credential": token, "agent": "a", "instance": "i", "environment": env, "expiresAt": at}
    return Reply(200, {"content-type": "application/json"}, json.dumps(body).encode())


def problem(status: int, code: str) -> Reply:
    return Reply(status, {}, json.dumps({"status": status, "code": code}).encode())


@dataclass
class S3:
    """A scripted S3: replies per path, in order; every call recorded."""

    replies: dict[str, list[Reply | Exception]]
    calls: list[tuple[str, dict[str, str], float]] = field(default_factory=list)
    seen: asyncio.Event = field(default_factory=asyncio.Event)
    on_post: Callable[[str], None] | None = None

    async def post(
        self,
        _tls: object,
        _url: str,
        path: str,
        *,
        headers: dict[str, str],
        body: bytes | None,
        limits: object,
    ) -> Reply:
        del body, limits
        self.calls.append((path, headers, time.monotonic()))
        if self.on_post is not None:
            self.on_post(path)
        self.seen.set()
        r = self.replies[path].pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    def count(self, path: str) -> int:
        return sum(1 for c in self.calls if c[0] == path)

    async def wait_for(self, path: str, n: int, within: float = 5) -> None:
        async with asyncio.timeout(within):
            while self.count(path) < n:
                self.seen.clear()
                await self.seen.wait()


@dataclass
class Listener:
    events: list[tuple[str, object]] = field(default_factory=list)

    changed: asyncio.Event = field(default_factory=asyncio.Event)

    def credential(self, lineage_changed: bool) -> None:
        self.events.append(("credential", lineage_changed))
        self.changed.set()

    def revoked(self, problem: ProblemError) -> None:
        self.events.append(("revoked", problem.code))
        self.changed.set()

    async def until(self, done: Callable[[list[tuple[str, object]]], bool]) -> None:
        async with asyncio.timeout(5):
            while not done(self.events):
                self.changed.clear()
                await self.changed.wait()


def keeper(
    s3: S3, monkeypatch: pytest.MonkeyPatch, *, limits: Any = LIMITS_FAST, secret: Any = None
) -> tuple[KeeperCore, Listener]:
    monkeypatch.setattr(_keeper, "post", s3.post)
    k = KeeperCore(
        s3="https://s3.test",
        agent="a",
        instance="i",
        secret=secret or (lambda: "secret"),
        limits=limits,
        tls=lambda: None,  # type: ignore[arg-type, return-value]
    )
    listener = Listener()
    k.on_credential(listener)
    return k, listener


def skew_warnings(caught: list[warnings.WarningMessage]) -> list[SoormaWarning]:
    return [
        w.message
        for w in caught
        if isinstance(w.message, SoormaWarning) and w.message.code == CLOCK_SKEW_CODE
    ]


@pytest.mark.asyncio
async def test_a_fast_clock_renews_at_most_once_per_r_min_and_warns_once_per_lineage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Each credential arrives already inside H_renew: due at once on the client's clock.
    s3 = S3(
        {BOOT: [cred("A", 10), cred("C", 10)], RENEW: [cred(f"B{n}", 10 + n) for n in range(8)]}
    )
    k, listener = keeper(s3, monkeypatch)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("default")
        await k.bootstrap()
        await s3.wait_for(RENEW, 3)
        assert len(skew_warnings(caught)) == 1
        times = [t for p, _, t in s3.calls]
        gaps = [b - a for a, b in pairwise(times)]
        assert all(g >= 0.19 for g in gaps), gaps
        # A new lineage may warn again, once.
        await k.bootstrap()
    await k.stop()
    assert len(skew_warnings(caught)) == 2
    assert ("credential", False) in listener.events


@pytest.mark.asyncio
async def test_with_warnings_as_errors_the_skew_path_still_renews_at_the_floor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    s3 = S3({BOOT: [cred("A", 10)], RENEW: [cred("B", 20)]})
    k, listener = keeper(s3, monkeypatch)
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        started = time.monotonic()
        await k.bootstrap()
        await s3.wait_for(RENEW, 1)
        assert s3.calls[-1][2] - started >= 0.19
        renewals = list(k._tasks)
        await listener.until(lambda ev: ("credential", False) in ev)
    assert await k.token() == "B"
    assert listener.events == [("credential", True), ("credential", False)]
    assert s3.count(BOOT) == 1
    # No exception escaped the renewal task.
    assert [t.exception() for t in renewals] == [None]
    await k.stop()


@pytest.mark.asyncio
async def test_more_than_a_lifetime_ahead_the_credential_is_used_until_s3_says_expired(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    s3 = S3({BOOT: [cred("A", -1000), cred("B", -1000)], RENEW: []})
    k, _ = keeper(s3, monkeypatch, limits=replace(LIMITS_FAST, R_min=60_000))
    with warnings.catch_warnings(record=True):
        warnings.simplefilter("ignore")
        await k.bootstrap()
        assert k.is_usable()
        assert await k.token() == "A"
        assert await k.token() == "A"
        assert s3.count(BOOT) == 1
        k.note_expired()
        assert not k.is_usable()
        assert await k.token() == "B"
    assert s3.count(BOOT) == 2
    await k.stop()


@pytest.mark.asyncio
async def test_on_a_warned_lineage_a_503_renewal_is_retried_without_a_bootstrap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    s3 = S3({BOOT: [cred("A", -1000)], RENEW: [problem(503, "unavailable"), cred("B", 10)]})
    k, listener = keeper(s3, monkeypatch)
    with warnings.catch_warnings(record=True):
        warnings.simplefilter("ignore")
        await k.bootstrap()
        await s3.wait_for(RENEW, 2)
        await listener.until(lambda ev: ("credential", False) in ev)
    assert s3.count(BOOT) == 1
    assert await k.token() == "B"
    await k.stop()


@pytest.mark.asyncio
async def test_a_retried_bootstrap_calls_the_provider_per_attempt_and_holds_no_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    secret = "per-attempt-" + uuid4().hex
    provided = 0

    def provider() -> str:
        nonlocal provided
        provided += 1
        return secret

    baseline = sys.getrefcount(secret)
    counts: list[int] = []
    s3 = S3({BOOT: [problem(503, "unavailable"), cred("A", 3600)]})
    s3.on_post = lambda _p: counts.append(sys.getrefcount(secret))
    k, _ = keeper(s3, monkeypatch, secret=provider, limits=replace(LIMITS_FAST, B_init=200))
    task = asyncio.create_task(k.bootstrap())
    await s3.wait_for(BOOT, 1)
    await asyncio.sleep(0.05)  # inside the backoff wait
    during_wait = sys.getrefcount(secret)
    await task
    assert provided == 2
    assert s3.count(BOOT) == 2
    assert counts == [baseline, baseline]
    assert during_wait == baseline
    await k.stop()


@pytest.mark.asyncio
async def test_a_provider_failure_is_secret_source_and_nothing_is_sent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def broken() -> str:
        raise RuntimeError("the vault said: hunter2")

    s3 = S3({BOOT: []})
    k, _ = keeper(s3, monkeypatch, secret=broken)
    with pytest.raises(SecretSourceError) as e:
        await k.bootstrap()
    assert e.value.reason == "provider-failed"
    assert e.value.__cause__ is None
    assert e.value.__suppress_context__ is True
    assert "hunter2" not in str(e.value)
    assert s3.calls == []


@pytest.mark.asyncio
async def test_an_async_provider_is_awaited(monkeypatch: pytest.MonkeyPatch) -> None:
    async def provider() -> str:
        return "secret"

    s3 = S3({BOOT: [cred("A", 3600)]})
    k, _ = keeper(s3, monkeypatch, secret=provider)
    await k.bootstrap()
    assert await k.token() == "A"
    await k.stop()


@pytest.mark.asyncio
async def test_a_refused_renewal_is_terminal(monkeypatch: pytest.MonkeyPatch) -> None:
    s3 = S3({BOOT: [cred("A", 0.1)], RENEW: [problem(401, "credential_refused")]})
    k, listener = keeper(s3, monkeypatch, limits=replace(LIMITS_FAST, H_renew=0))
    await k.bootstrap()
    await s3.wait_for(RENEW, 1)
    await listener.until(lambda ev: ("revoked", "credential_refused") in ev)
    assert not k.is_usable()
    assert k.details is None
    with pytest.raises(ClientStateError) as e:
        await k.token()
    assert e.value.state == "revoked"
    assert e.value.problem is not None
    assert e.value.problem.code == "credential_refused"
    assert s3.count(BOOT) == 1
    await k.stop()


@pytest.mark.asyncio
async def test_a_renewal_without_a_later_expiry_starts_a_new_lineage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    s3 = S3({BOOT: [cred("A", 0.5), cred("C", 3600)], RENEW: [cred("B", 0.4)]})
    k, listener = keeper(s3, monkeypatch, limits=replace(LIMITS_FAST, H_renew=300))
    await k.bootstrap()
    await s3.wait_for(BOOT, 2)
    await listener.until(lambda ev: len(ev) >= 2)
    assert listener.events == [("credential", True), ("credential", True)]
    assert await k.token() == "C"
    await k.stop()


@pytest.mark.asyncio
async def test_stop_cancels_the_timer_and_drops_the_credential(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    s3 = S3({BOOT: [cred("A", 3600)]})
    k, _ = keeper(s3, monkeypatch)
    await k.bootstrap()
    assert k._timer is not None
    await k.stop()
    assert k._timer is None
    assert k.details is None
    assert not k.is_usable()
    with pytest.raises(ClientStateError):
        await k.token()


def test_a_credential_keeps_unknown_environment_members() -> None:
    held = parse_credential(cred("A", 60, region="eu", tier={"n": 1}).body)
    env = held.details.environment
    assert (env.organization, env.project, env.environment) == ("o", "p", "e")
    assert env["region"] == "eu"
    assert env["tier"] == {"n": 1}
    assert list(env) == ["organization", "project", "environment", "region", "tier"]
    assert len(env) == 5
    with pytest.raises(KeyError):
        env["absent"]
    assert "region" not in repr(env)
    assert "A" not in repr(held.details).replace("CredentialInfo", "")


@pytest.mark.parametrize(
    "body",
    [
        b"",
        b"[]",
        b'{"credential":"A"}',
        b'{"credential":1,"agent":"a","instance":"i","environment":{"organization":"o",'
        b'"project":"p","environment":"e"},"expiresAt":"2026-11-19T00:00:00Z"}',
        b'{"credential":"A","agent":"a","instance":"i","environment":"e",'
        b'"expiresAt":"2026-11-19T00:00:00Z"}',
        b'{"credential":"A","agent":"a","instance":"i","environment":{"organization":"o",'
        b'"project":"p","environment":"e"},"expiresAt":"tomorrow"}',
        b"[" * 100_000,
    ],
)
def test_an_unusable_credential_is_unusable_response(body: bytes) -> None:
    with pytest.raises(TransportError) as e:
        parse_credential(body)
    assert e.value.reason == "unusable-response"
    assert e.value.__cause__ is None
