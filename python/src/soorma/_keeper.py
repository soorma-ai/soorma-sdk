# SPDX-License-Identifier: Apache-2.0
#
# The credential keeper (C-14): the one security-critical module (SECURITY-11).
# It alone touches the secret and the credential. It bootstraps (ACQ), renews
# on a schedule (REN-01 to REN-07; P-03), holds the credential in memory only,
# opaque (CRD-01), and decides validity in one place, is_usable() (P-02;
# CDI-06): nowhere else compares expires_at with the clock.
from __future__ import annotations

import asyncio
import inspect
import json
import warnings
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from types import MappingProxyType
from typing import Any, Protocol

from . import _clock
from ._errors import (
    ClientStateError,
    ProblemError,
    SecretSourceError,
    SoormaWarning,
    TransportError,
)
from ._limits import Limits
from ._retry import retry
from ._transport import Tls, post, problem_from
from ._types import CredentialInfo, EnvironmentRef, SecretProvider

CLOCK_SKEW_CODE = "SOORMA_CLOCK_SKEW"
CLOCK_SKEW_MESSAGE = (
    "The client clock appears to be ahead of the platform clock: a credential arrived "
    "already due for renewal. Renewals are held at least R_min apart, and the credential "
    "is used until the platform reports it expired. Correct the clock."
)


class KeeperListener(Protocol):
    def credential(self, lineage_changed: bool) -> None: ...
    def revoked(self, problem: ProblemError) -> None: ...


@dataclass(frozen=True, slots=True)
class Held:
    token: str
    details: CredentialInfo
    expires_at: float


def _expiry(text: str) -> float:
    return datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()


def parse_credential(body: bytes) -> Held:
    """A 200 that is a usable AgentCredential, or TransportError unusable-response (ACQ-08)."""
    try:
        c = json.loads(body)
        env = c["environment"]
        fields = (c["credential"], c["agent"], c["instance"], c["expiresAt"])
        names = (env["organization"], env["project"], env["environment"])
        if not all(isinstance(x, str) for x in (*fields, *names)) or not isinstance(env, dict):
            raise ValueError("unusable")
        expires_at = _expiry(c["expiresAt"])
    except (ValueError, KeyError, TypeError, RecursionError):
        raise TransportError("unusable-response") from None
    return Held(
        token=c["credential"],
        expires_at=expires_at,
        details=CredentialInfo(
            agent=c["agent"],
            instance=c["instance"],
            # As sent, unknown members kept (CDI-04); the three it needs are checked above.
            environment=EnvironmentRef(
                env["organization"], env["project"], env["environment"], MappingProxyType(env)
            ),
            expires_at=c["expiresAt"],
        ),
    )


def _emit_skew_warning() -> None:
    """Once per lineage, through a fresh registry so the default filter shows each one
    (PH-REN-03). Guarded: under the error action it raises here, and renewal carries on
    unaffected; the warning is advisory, never control flow (PH-REN-04)."""
    try:
        warnings.warn_explicit(
            SoormaWarning(CLOCK_SKEW_MESSAGE, CLOCK_SKEW_CODE),
            SoormaWarning,
            __file__,
            0,
            module="soorma",
            registry={},
        )
    except Exception:  # noqa: S110 - advisory: a warning filter's error never stops renewal
        pass


class KeeperCore:
    """Owned by a client core; references nothing of the public handle (P-10)."""

    def __init__(
        self,
        *,
        s3: str,
        agent: str,
        instance: str,
        secret: SecretProvider,
        limits: Limits,
        tls: Callable[[], Tls],
    ) -> None:
        self._s3 = s3
        self._agent = agent
        self._instance = instance
        self._secret = secret
        self._limits = limits
        self._tls = tls
        self._held: Held | None = None
        self._received_at = 0.0
        self._warned = False  # REN-07: this lineage's warning fired; S3 now judges its expiry
        self._expired_by_s3 = False
        self._revoked: ProblemError | None = None
        self._stopped = False
        self._timer: asyncio.TimerHandle | None = None
        self._tasks: set[asyncio.Task[None]] = set()
        self._listeners: list[KeeperListener] = []

    def on_credential(self, listener: KeeperListener) -> Callable[[], None]:
        self._listeners.append(listener)
        return lambda: self._listeners.remove(listener) if listener in self._listeners else None

    @property
    def details(self) -> CredentialInfo | None:
        return self._held.details if self._held else None

    @property
    def revoked_by(self) -> ProblemError | None:
        return self._revoked

    def is_usable(self) -> bool:
        """The one validity check (P-02; CDI-06). On a lineage with the clock-skew warning,
        valid until S3 says credential_expired; otherwise the wall clock."""
        if self._held is None or self._revoked is not None or self._stopped:
            return False
        if self._warned:
            return not self._expired_by_s3
        return not self._expired_by_s3 and _clock.wall_now() < self._held.expires_at

    async def token(self) -> str:
        """The credential for an operation; bootstraps first when it is not usable (REN-06)."""
        if self._revoked is not None:
            raise ClientStateError("revoked", self._revoked)
        if self._stopped:
            raise ClientStateError("closed")
        if not self.is_usable():
            await self.bootstrap()
        if self._held is None:
            raise ClientStateError("created")
        return self._held.token

    def note_expired(self) -> None:
        """A credential S3 or S4 answered credential_expired for: no longer usable."""
        self._expired_by_s3 = True

    async def bootstrap(self) -> None:
        """A new lineage (ACQ-01 to ACQ-09; SEC-01 per attempt; SEC-02)."""
        held = await retry("bootstrap", self._bootstrap_attempt, self._limits)
        self._adopt(held, new_lineage=True)

    async def _bootstrap_attempt(self) -> Held:
        reply = await self._send_bootstrap(await self._provide())
        if reply.status != 200:
            raise problem_from(reply)
        return parse_credential(reply.body)

    async def _provide(self) -> str:
        """One provider call (SEC-01, per attempt); SecretSourceError and nothing sent (SEC-08)."""
        try:
            value: Any = self._secret()
            if inspect.isawaitable(value):
                value = await value
        except SecretSourceError:
            raise
        except Exception:
            raise SecretSourceError("provider-failed") from None
        if not isinstance(value, str):
            raise SecretSourceError("provider-failed")
        return value

    async def _send_bootstrap(self, secret: str) -> Any:
        """The secret lives in this frame and the request bytes only; the str reference is
        dropped before the request is sent, so U1's refcount check passes (SEC-02; P-12)."""
        body = (
            b'{"agent":'
            + json.dumps(self._agent, ensure_ascii=False).encode()
            + b',"secret":'
            + json.dumps(secret, ensure_ascii=False).encode()
            + b',"instance":'
            + json.dumps(self._instance, ensure_ascii=False).encode()
            + b"}"
        )
        del secret
        return await post(
            self._tls(), self._s3, "/agent-credentials", headers={}, body=body, limits=self._limits
        )

    def _adopt(self, held: Held, *, new_lineage: bool) -> None:
        if self._stopped:
            return
        self._held = held
        self._received_at = _clock.mono_now()
        if new_lineage:
            self._warned = False
            self._expired_by_s3 = False
        self._schedule()
        for listener in list(self._listeners):
            listener.credential(new_lineage)

    def _schedule(self) -> None:
        """REN-01 with REN-07 (P-03): the wall-clock target, never sooner than R_min."""
        held = self._held
        if held is None:
            return
        if self._timer is not None:
            self._timer.cancel()
        target = held.expires_at - self._limits.H_renew / 1000 - _clock.wall_now()
        if target <= 0 and not self._warned:
            self._warned = True  # before the emit, so a raised warning changes nothing
            _emit_skew_warning()
        floor = self._received_at + self._limits.R_min / 1000 - _clock.mono_now()
        loop = asyncio.get_running_loop()
        self._timer = loop.call_later(max(floor, target, 0.0), self._start_renewal)

    def _start_renewal(self) -> None:
        self._timer = None
        task = asyncio.get_running_loop().create_task(self._renew())
        self._tasks.add(task)
        task.add_done_callback(self._task_done)

    def _task_done(self, task: asyncio.Task[None]) -> None:
        self._tasks.discard(task)
        if not task.cancelled():
            task.exception()  # retrieved: a background failure never goes unseen

    async def _renew(self) -> None:
        current = self._held
        if current is None or self._revoked is not None or self._stopped:
            return
        try:
            held = await retry(
                "renewal",
                lambda: self._renew_attempt(current.token),
                self._limits,
                usable=self.is_usable,
            )
            # REN-03: no later expiry means the lineage cannot extend: a new lineage now.
            if held.expires_at <= current.expires_at:
                await self.bootstrap()
            else:
                self._adopt(held, new_lineage=False)
        except ProblemError as e:
            if self._stopped:
                return
            if e.code == "credential_refused":
                # REN-05: terminal, also on a retried renewal. The earlier token stays valid
                # until its own expiresAt and renewing with it is accepted (contract-v0.1.0+core.2,
                # conventions/credentials.md, Revocation and Lifetimes): a refusal is a revocation.
                self.revoke(e)
            elif e.code == "credential_expired":
                # REN-04: bootstrap again (one provider call per attempt).
                self._expired_by_s3 = True
                try:
                    await self.bootstrap()
                except (ProblemError, TransportError, SecretSourceError):
                    pass  # the next operation bootstraps if not usable (REN-06)
        except (TransportError, SecretSourceError):
            pass  # REN-06: the next operation bootstraps if the credential is not usable

    async def _renew_attempt(self, token: str) -> Held:
        reply = await post(
            self._tls(),
            self._s3,
            "/agent-credentials/current/renewal",
            headers={"Authorization": f"Bearer {token}"},
            body=None,
            limits=self._limits,
        )
        if reply.status != 200:
            raise problem_from(reply)
        return parse_credential(reply.body)

    def revoke(self, problem: ProblemError) -> None:
        """credential_refused: terminal (REN-05, STR-07)."""
        if self._revoked is not None:
            return
        self._revoked = problem
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
        self._held = None
        for listener in list(self._listeners):
            listener.revoked(problem)

    def abort(self) -> None:
        """Synchronous: timers and tasks cancelled, the credential dropped (P-10, P-11)."""
        self._stopped = True
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
        for task in list(self._tasks):
            task.cancel()
        self._held = None

    async def stop(self) -> None:
        """Stops renewing and drops the credential."""
        self.abort()
        tasks = list(self._tasks)
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
