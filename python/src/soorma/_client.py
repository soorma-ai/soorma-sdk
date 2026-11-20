# SPDX-License-Identifier: Apache-2.0
#
# The agent client (C-11): one per agent instance. Creating it contacts nothing
# (CFG-01; PH-API-03); start() builds the TLS context and bootstraps (P-06; ACQ);
# publish never retries (PUB-05); a Delivery's publish forwards its context
# (FWD-01); close() releases everything, is idempotent, and concurrent calls
# await the same close (PH-LIFE-01).
#
# P-10: `AgentClient` is a thin handle over a `ClientCore`. Every task, timer and
# callback references only the core, so a forgotten handle is collectable; its
# finalizer (`_collect`, module-level, given the core and a name, never the
# handle) releases the core synchronously and emits one ResourceWarning
# (PH-LIFE-03). close() detaches the finalizer first, so a closed handle never warns.
from __future__ import annotations

import asyncio
import warnings
import weakref
from collections.abc import Coroutine
from types import TracebackType
from typing import Any, Literal, NoReturn, TypeVar
from urllib.parse import urlsplit

from . import _limits
from ._draft import Inbound, draft_text, publish_body
from ._errors import ClientStateError, ProblemError, TransportError
from ._json import payload_text
from ._keeper import KeeperCore
from ._options import AgentClientOptions
from ._subscription import Subscription, SubscriptionCore
from ._tracing import start_send
from ._transport import Tls, load_tls, post, problem_from
from ._types import CredentialInfo, JsonValue, PublishAccepted

T = TypeVar("T")
State = Literal["created", "starting", "started", "revoked", "closed"]


def _check_options(options: object) -> AgentClientOptions:
    """Presence and type only (PH-API-03); nothing is contacted or called."""
    if not isinstance(options, AgentClientOptions):
        raise TypeError("AgentClient needs AgentClientOptions")
    for name in ("data_gateway_url", "event_ingest_url", "agent", "instance"):
        if not isinstance(getattr(options, name), str):
            raise TypeError(f"AgentClient option {name} must be a str")
    for name in ("data_gateway_url", "event_ingest_url"):
        u = urlsplit(getattr(options, name))
        if u.scheme != "https" or not u.hostname:
            raise TypeError(f"AgentClient option {name} must be an https URL")
    if options.ca_file is not None and not isinstance(options.ca_file, str):
        raise TypeError("AgentClient option ca_file must be a str")
    if not callable(options.secret):
        raise TypeError("AgentClient option secret must be a secret provider")
    return options


class ClientCore:
    """Everything the client owns; references nothing of the handle (P-10)."""

    def __init__(self, options: AgentClientOptions) -> None:
        self.options = options
        self.limits = _limits.capture()  # once, at construction (PH-API-06)
        self.state: State = "created"
        self.tls: Tls | None = None
        self.loop: asyncio.AbstractEventLoop | None = None
        self._ops: set[asyncio.Task[Any]] = set()
        self._closing: asyncio.Future[None] | None = None
        self.subscription: SubscriptionCore | None = None
        self.keeper = KeeperCore(
            s3=options.data_gateway_url,
            agent=options.agent,
            instance=options.instance,
            secret=options.secret,
            limits=self.limits,
            tls=self._tls,
        )
        self.keeper.on_credential(_Revoker(self))

    def _tls(self) -> Tls:
        if self.tls is None:
            raise ClientStateError(self.state)
        return self.tls

    def tls_context(self) -> Tls:
        """The client's TLS context, for its subscription's requests."""
        return self._tls()

    # ---- operations ----

    async def run(self, coro: Coroutine[Any, Any, T]) -> T:
        """Runs one operation as a task the core owns, so close() can abort it: the caller
        then gets ClientStateError('closed'); the caller's own cancellation passes through."""
        task = asyncio.get_running_loop().create_task(coro)
        self._ops.add(task)
        task.add_done_callback(self._ops.discard)
        try:
            return await task
        except asyncio.CancelledError:
            current = asyncio.current_task()
            if self.state == "closed" and (current is None or not current.cancelling()):
                raise ClientStateError("closed") from None
            raise

    def assert_started(self) -> None:
        if self.state != "started":
            raise ClientStateError(
                self.state, self.keeper.revoked_by if self.state == "revoked" else None
            )

    async def start(self) -> None:
        if self.state != "created":
            raise ClientStateError(self.state)
        self.state = "starting"
        self.loop = asyncio.get_running_loop()
        try:
            await self.run(self._start())
        except BaseException:
            if self.state == "starting":
                self.state = "created"
            raise
        if self.state != "starting":
            raise ClientStateError(self.state)
        self.state = "started"

    async def _start(self) -> None:
        self.tls = await load_tls(self.options.ca_file)
        await self.keeper.bootstrap()

    async def publish(
        self, payload: JsonValue, inbound: Inbound | None, received_trace: object
    ) -> PublishAccepted:
        self.assert_started()
        text = payload_text(payload)  # refused before any request (PH-PUB-01)
        return await self.run(self._publish(text, inbound, received_trace))

    async def forward(
        self, payload: JsonValue, envelope_text: str, seal: str, received_trace: object
    ) -> PublishAccepted:
        """A Delivery's publish: forwards its context (FWD-01)."""
        return await self.publish(payload, Inbound(envelope_text, seal), received_trace)

    def subscribe(self) -> SubscriptionCore:
        """One active subscription per client (SUB-04); the stream opens now (SUB-01)."""
        self.assert_started()
        if self.subscription is not None and not self.subscription.finished:
            raise ClientStateError("subscribed")
        self.subscription = SubscriptionCore(self)
        return self.subscription

    async def _publish(
        self, text: str, inbound: Inbound | None, received_trace: object
    ) -> PublishAccepted:
        token = await self.keeper.token()
        span = start_send(forwarding=inbound is not None, received_tc=received_trace)
        try:
            reply = await post(
                self._tls(),
                self.options.event_ingest_url,
                "/events",
                headers={"Authorization": f"Bearer {token}"},
                body=publish_body(draft_text(span.trace_context, inbound), text),
                limits=self.limits,
            )
        except TransportError as e:
            span.end(e.reason)
            raise
        except BaseException:
            span.end("aborted")
            raise
        if reply.status == 202:
            span.end()
            return PublishAccepted(span.trace_context)
        problem = problem_from(reply)
        if problem.status == 401 and problem.code == "credential_expired":
            self.keeper.note_expired()
        span.end(problem.code or str(problem.status))
        raise problem

    # ---- closing ----

    async def close(self) -> None:
        if self._closing is None:
            self._closing = asyncio.get_running_loop().create_task(self._close())
        await asyncio.shield(self._closing)

    async def _close(self) -> None:
        self.state = "closed"
        ops = list(self._ops)
        for task in ops:
            task.cancel()
        if self.subscription is not None:
            await self.subscription.close()
        await self.keeper.stop()
        if ops:
            await asyncio.gather(*ops, return_exceptions=True)

    def abort(self) -> None:
        """Synchronous release, for the collection finalizer: never awaits or schedules a
        coroutine (PH-LIFE-03). On a closed loop it only drops references."""
        self.state = "closed"
        loop = self.loop
        if loop is not None and not loop.is_closed():
            if self.subscription is not None:
                self.subscription.abort()
            self.keeper.abort()
            for task in list(self._ops):
                task.cancel()
        self._ops.clear()
        self.subscription = None
        self.tls = None

    @property
    def holds_resources(self) -> bool:
        return self.state not in ("created", "closed")


class _Revoker:
    """The keeper's listener: credential_refused makes the client revoked (REN-05)."""

    def __init__(self, core: ClientCore) -> None:
        self._core = weakref.ref(core)

    def credential(self, lineage_changed: bool) -> None:
        del lineage_changed

    def revoked(self, problem: ProblemError) -> None:
        del problem
        core = self._core()
        if core is not None and core.state != "closed":
            core.state = "revoked"


def _collect(core: ClientCore, name: str) -> None:
    """The finalizer of a forgotten AgentClient: given the core, never the handle."""
    if not core.holds_resources:
        return
    core.abort()
    warnings.warn(f"unclosed {name}", ResourceWarning, stacklevel=1, source=None)


class AgentClient:
    """The agent's client (asyncio only): `await start()`, `await publish(payload)`,
    `subscribe()`, `await close()`; `async with` closes it, and returns it unstarted."""

    __slots__ = ("__weakref__", "_core", "_finalizer")

    def __init__(self, options: AgentClientOptions) -> None:
        core = ClientCore(_check_options(options))
        self._core = core
        self._finalizer = weakref.finalize(self, _collect, core, f"AgentClient {options.agent!r}")

    async def start(self) -> None:
        """Bootstraps (ACQ-01 to ACQ-09); after a failure the client may start again."""
        await self._core.start()

    @property
    def credential(self) -> CredentialInfo:
        """The credential's details, read only; never the credential (CRD-03)."""
        core = self._core
        details = core.keeper.details
        if core.state != "started" or details is None:
            raise ClientStateError(core.state, core.keeper.revoked_by)
        return details

    async def publish(self, payload: JsonValue) -> PublishAccepted:
        """Publishes without forwarding (FWD-04). Never retried (PUB-05)."""
        return await self._core.publish(payload, None, None)

    def subscribe(self) -> Subscription:
        """Subscribes (SUB-01): the stream opens now, and its items are read as tenant code
        pulls them (SUB-06). One active subscription per client; another is allowed once it
        is closed or finished (SUB-04). Use `async with client.subscribe() as s:`."""
        return Subscription._make(self._core.subscribe())

    async def close(self) -> None:
        """Releases every stream, request and timer; idempotent (PRB-07; PH-LIFE-01)."""
        self._finalizer.detach()
        await self._core.close()

    async def __aenter__(self) -> AgentClient:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.close()

    def __repr__(self) -> str:
        return f"<AgentClient agent={self._core.options.agent!r} state={self._core.state}>"

    def __reduce__(self) -> NoReturn:
        raise TypeError("AgentClient is not picklable")
