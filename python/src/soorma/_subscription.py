# SPDX-License-Identifier: Apache-2.0
#
# The subscription supervisor (C-17; SUB-01 to SUB-07, STR-01 to STR-09; P-04,
# carried from U3). A state machine over at most two streams, the current one
# and a replacement, feeding one queue of at most N_buf items:
#
#   opening --opened--> open --new credential--> replacement opening --opened--> replacing
#      ^                 |                                                         |
#      |           non-terminal end               old ends, W_super, or a new lineage
#      |                 v                                                         |
#      +--backoff-- backingOff                             open <-- promote -------+
#
#   any state --terminal end, L_ends, revoked, failure, close()--> done
#
# Backpressure (SUB-06): a stream's events are taken only while the queue has
# room; a full queue pauses its socket (transport.pause_reading()), so the SDK
# reads only as tenant code pulls. T_idle and W_super count only while a socket
# is read (STR-02, STR-05); a resume restarts T_idle. A replacement's socket is
# held paused from its opening until the old stream ends, so its *stream
# started* follows the old *stream ended*. Every open goes through
# keeper.token(), which bootstraps only when the credential is not usable (CDI-06).
#
# The stream opens when subscribe() is called (SUB-01: subscribe() sends the
# request; CC-STR-13 waits for it before the first pull), as U3's does.
#
# P-10: `Subscription` is a thin handle over `SubscriptionCore`; every task,
# timer and callback references only the core. A forgotten, unfinished handle's
# finalizer releases the core synchronously and emits one ResourceWarning.
from __future__ import annotations

import asyncio
import json
import warnings
import weakref
from collections import deque
from collections.abc import Coroutine
from types import TracebackType
from typing import TYPE_CHECKING, Any, Literal, NoReturn, TypeAlias

from . import _clock
from ._connection import Connection, open_request, request_bytes
from ._draft import draft_text
from ._errors import ProblemError, TransportError
from ._http import EventTooLarge, Head, SseEvent, StreamEnd
from ._reader import Delivery, read_delivery
from ._retry import retry
from ._tracing import record_receive, subscribe_trace_context
from ._transport import CONTRACT_HEADER, CONTRACT_VERSION, Reply, problem_from, retry_after_seconds
from ._types import DeliveryError, StreamEnded, StreamStarted

if TYPE_CHECKING:
    from ._client import ClientCore

SubscriptionItem: TypeAlias = Delivery | DeliveryError | StreamStarted | StreamEnded

STARTED = StreamStarted()
EVENT_TOO_LARGE = DeliveryError("event-too-large", "")


class _Raise:
    """An error the iterator raises in its turn (SUB-05)."""

    __slots__ = ("error",)

    def __init__(self, error: BaseException) -> None:
        self.error = error


class _NotRetried(Exception):
    """A failure that is not the subscribe request's own: never retried here."""

    def __init__(self, error: BaseException) -> None:
        super().__init__("not retried")
        self.error = error


class _Stream:
    """One stream: its connection, its waiting events, and its reading state."""

    __slots__ = (
        "active",
        "blocks",
        "conn",
        "epoch",
        "finished",
        "flowing",
        "head",
        "idle",
        "upstream_done",
    )

    def __init__(self, conn: Connection, head: Head, epoch: int) -> None:
        self.conn = conn
        self.head = head
        self.epoch = epoch  # the credential epoch the stream was opened with
        self.blocks: deque[SseEvent | EventTooLarge] = deque()
        self.active = False  # the SDK consumes it (current, not a held replacement)
        self.flowing = False  # its socket is reading
        self.upstream_done = False
        self.finished = False
        self.idle: asyncio.TimerHandle | None = None


class _Next:
    """A replacement in progress: opening (no stream yet) or open and held."""

    __slots__ = ("stream",)

    def __init__(self) -> None:
        self.stream: _Stream | None = None


class _Wsuper:
    __slots__ = ("remaining", "since", "timer")

    def __init__(self, remaining: float) -> None:
        self.remaining = remaining
        self.since = 0.0
        self.timer: asyncio.TimerHandle | None = None


def _end_code(data: str) -> str | None:
    """The `end` event's code, or None when its data carries no string `code` (STR-02)."""
    try:
        o = json.loads(data)
    except (ValueError, RecursionError):
        return None
    code = o.get("code") if isinstance(o, dict) else None
    return code if isinstance(code, str) else None


class SubscriptionCore:
    """Everything a subscription owns; references nothing of its handle (P-10)."""

    def __init__(self, client: ClientCore) -> None:
        self._client = client
        self._keeper = client.keeper
        self._limits = client.limits
        self._loop = asyncio.get_running_loop()
        self._queue: deque[SubscriptionItem | _Raise] = deque()
        self._waiters: list[asyncio.Future[None]] = []
        self._state: Literal["opening", "open", "backingOff", "done"] = "opening"
        self._current: _Stream | None = None
        self._next: _Next | None = None
        self._wsuper: _Wsuper | None = None
        self._epoch = 0  # credential events seen
        self._lineage_epoch = 0  # the last one that changed the lineage
        self._ends = 0
        self._delay = self._limits.B_init / 1000
        self.finished = False
        self._returned = False
        self._closing: asyncio.Task[None] | None = None
        self._work: set[asyncio.Task[None]] = set()
        self._off = self._keeper.on_credential(self)
        self._run(self._open())

    # ---- the keeper's listener ----

    def credential(self, lineage_changed: bool) -> None:
        self._epoch += 1
        if lineage_changed:
            self._lineage_epoch = self._epoch
        self._check_credential()

    def revoked(self, problem: ProblemError) -> None:
        # A refusal while a stream is open ends it (REN-05, STR-07). Before a stream
        # opens, the subscribe's own failure is raised instead (SUB-05).
        if self._state != "opening":
            self._terminal(problem.code)

    # ---- the iterator (SUB-01, SUB-06, SUB-07) ----

    async def pull(self) -> SubscriptionItem:
        while True:
            if self._returned:
                raise StopAsyncIteration
            if self._queue:
                entry = self._queue.popleft()
                self._drained()
                if isinstance(entry, _Raise):
                    self._returned = True
                    raise entry.error
                if isinstance(entry, Delivery):
                    record_receive(entry.envelope.get("traceContext"))
                return entry
            if self.finished:
                raise StopAsyncIteration
            waiter: asyncio.Future[None] = self._loop.create_future()
            self._waiters.append(waiter)
            try:
                await waiter
            finally:
                if waiter in self._waiters:
                    self._waiters.remove(waiter)

    async def close(self) -> None:
        """Closes the stream; the iterator yields a terminal *stream ended*, then stops."""
        if self._closing is None:
            self._terminal(None)
            self._closing = self._loop.create_task(self._settle())
        await asyncio.shield(self._closing)

    async def _settle(self) -> None:
        work = list(self._work)
        if work:
            await asyncio.gather(*work, return_exceptions=True)

    def abort(self) -> None:
        """Synchronous release (P-10): streams aborted, timers and tasks cancelled."""
        self._finish()

    # ---- the queue ----

    def _push(self, entry: SubscriptionItem | _Raise) -> None:
        self._queue.append(entry)
        self._wake()

    def _wake(self) -> None:
        waiters, self._waiters = self._waiters, []
        for w in waiters:
            if not w.done():
                w.set_result(None)

    def _full(self) -> bool:
        return len(self._queue) >= self._limits.N_buf

    def _drained(self) -> None:
        """Tenant code pulled an item: the current stream may read again."""
        s = self._current
        if s is not None and s.active and not self._full():
            self._pump(s)

    # ---- opening ----

    def _run(self, coro: Coroutine[Any, Any, None]) -> None:
        task = self._loop.create_task(coro)
        self._work.add(task)
        task.add_done_callback(self._done)

    def _done(self, task: asyncio.Task[None]) -> None:
        self._work.discard(task)
        if task.cancelled():
            return
        error = task.exception()  # always retrieved (P-11)
        if error is not None:
            self._fail(error)

    async def _open(self) -> None:
        """Opens the first stream, or the next one after a non-terminal end."""
        self._state = "opening"
        s = await self._connect()
        if self.finished:
            s.conn.abort()
            return
        self._state = "open"
        self._make_current(s)

    async def _connect(self) -> _Stream:
        """POST /subscriptions with retries (SUB-01, SUB-05; PRB-05, PRB-08, PRB-09)."""
        rebootstrapped = False
        while True:
            try:
                return await retry("subscribe", self._attempt, self._limits)
            except _NotRetried as e:
                raise e.error from None
            except ProblemError as e:
                if e.status == 401:
                    if e.code == "credential_expired" and not rebootstrapped:
                        # REN-06: bootstrap and subscribe again, once.
                        rebootstrapped = True
                        self._keeper.note_expired()
                        continue
                    if e.code == "credential_refused":
                        self._keeper.revoke(e)
                raise

    async def _attempt(self) -> _Stream:
        try:
            token = await self._keeper.token()
            tls = self._client.tls_context()
        except Exception as e:
            raise _NotRetried(e) from None
        epoch = self._epoch
        url = self._client.options.event_ingest_url
        body = f'{{"draft":{draft_text(subscribe_trace_context())}}}'.encode()
        headers = {CONTRACT_HEADER: CONTRACT_VERSION, "Authorization": f"Bearer {token}"}
        request = request_bytes(url, "/subscriptions", headers, body, accept="text/event-stream")
        del token, headers
        try:
            head, conn = await open_request(
                url,
                request,
                tls.context,
                t_req=self._limits.T_req / 1000,
                max_body=self._limits.B_body,
                max_event=self._limits.L_event,
                stream=True,
            )
        except TransportError as e:
            raise tls.error(e) from None
        if head.status == 200:
            media = (head.get("content-type") or "").split(";")[0].strip().lower()
            if media != "text/event-stream":
                conn.abort()
                raise TransportError("unusable-response")
            return _Stream(conn, head, epoch)
        try:
            data = await conn.body()
        finally:
            conn.abort()
        raise problem_from(Reply(head.status, dict(head.headers), data))

    def _make_current(self, s: _Stream) -> None:
        self._current = s
        self._attach(s)
        self._push(STARTED)
        s.active = True
        self._pump(s)
        self._check_credential()

    def _fail(self, error: BaseException) -> None:
        """A failure with no stream to end: the iterator raises it (SUB-05)."""
        if self.finished:
            return
        self._push(_Raise(error))
        self._finish()

    # ---- replacement (STR-04, STR-05, STR-09) ----

    def _check_credential(self) -> None:
        """A new credential since the current stream opened: open its replacement."""
        cur = self._current
        if self._state != "open" or cur is None or self._next is not None:
            return
        if self._epoch <= cur.epoch:
            return
        self._next = _Next()
        self._run(self._replace())

    async def _replace(self) -> None:
        try:
            s = await self._connect()
        except Exception:
            if self.finished:
                return
            self._next = None
            if self._current is not None:
                return  # the old stream, still open, runs until it ends on its own
            raise
        nxt = self._next
        if self.finished or nxt is None:
            s.conn.abort()
            return
        nxt.stream = s
        self._attach(s)  # held paused until promoted
        old = self._current
        if old is None:
            self._promote()
        elif self._lineage_epoch > old.epoch:
            self._force_switch()  # no superseded will come
        else:
            self._start_wsuper()

    def _promote(self) -> None:
        """The replacement becomes current: *stream started*, then its Deliveries."""
        s = self._next.stream if self._next is not None else None
        if s is None:
            return
        self._next = None
        self._clear_wsuper()
        self._state = "open"
        self._current = s
        self._push(STARTED)
        s.active = True
        self._pump(s)
        self._check_credential()

    def _force_switch(self) -> None:
        """The SDK closes the old stream itself: *stream ended* with no code (STR-05)."""
        old = self._current
        if old is not None:
            self._release(old)
            self._current = None
            self._push(StreamEnded(None, False))
        self._promote()

    def _start_wsuper(self) -> None:
        """W_super counts only while the old stream is being read (STR-05)."""
        self._wsuper = _Wsuper(self._limits.W_super / 1000)
        if self._current is not None and self._current.flowing:
            self._run_wsuper()

    def _run_wsuper(self) -> None:
        w = self._wsuper
        if w is None or w.timer is not None:
            return
        w.since = _clock.mono_now()
        w.timer = self._loop.call_later(w.remaining, self._force_switch)

    def _suspend_wsuper(self) -> None:
        w = self._wsuper
        if w is None or w.timer is None:
            return
        w.timer.cancel()
        w.timer = None
        w.remaining = max(0.0, w.remaining - (_clock.mono_now() - w.since))

    def _clear_wsuper(self) -> None:
        if self._wsuper is not None and self._wsuper.timer is not None:
            self._wsuper.timer.cancel()
        self._wsuper = None

    # ---- reading a stream (SUB-02, SUB-06; STR-01, STR-02) ----

    def _attach(self, s: _Stream) -> None:
        s.conn.pause_reading()  # before listening, so the socket stays paused
        s.conn.on_bytes = lambda: self._on_bytes(s)
        s.conn.listen(lambda e: self._on_event(s, e))

    def _on_bytes(self, s: _Stream) -> None:
        if s.flowing:
            self._restart_idle(s)

    def _on_event(self, s: _Stream, e: object) -> None:
        if isinstance(e, StreamEnd):
            self._on_upstream_done(s)
            return
        if isinstance(e, SseEvent | EventTooLarge):
            s.blocks.append(e)
            self._pump(s)

    def _on_upstream_done(self, s: _Stream) -> None:
        if s.upstream_done:
            return
        s.upstream_done = True
        s.flowing = False
        self._cancel_idle(s)
        if self._current is s:
            self._suspend_wsuper()
        self._pump(s)

    def _pump(self, s: _Stream) -> None:
        """Takes whole events while the queue has room; pauses the socket when it has none."""
        if not s.active or s.finished or self.finished:
            return
        while True:
            if self._full():
                self._pause_read(s)
                return
            if not s.blocks:
                break
            e = s.blocks.popleft()
            if isinstance(e, EventTooLarge):
                self._push(EVENT_TOO_LARGE)  # RCV-09
            else:
                self._dispatch(s, e)
            if s.finished or self.finished:
                return
        if s.upstream_done:
            self._stream_ended(s, None)
        else:
            self._resume_read(s)

    def _pause_read(self, s: _Stream) -> None:
        if not s.flowing:
            return
        s.flowing = False
        s.conn.pause_reading()
        self._cancel_idle(s)
        if self._current is s:
            self._suspend_wsuper()

    def _resume_read(self, s: _Stream) -> None:
        if s.flowing or s.upstream_done:
            return
        s.flowing = True
        self._restart_idle(s)  # a resume restarts T_idle (STR-02)
        if self._current is s:
            self._run_wsuper()
        s.conn.resume_reading()

    def _restart_idle(self, s: _Stream) -> None:
        self._cancel_idle(s)
        s.idle = self._loop.call_later(self._limits.T_idle / 1000, self._stream_ended, s, None)

    @staticmethod
    def _cancel_idle(s: _Stream) -> None:
        if s.idle is not None:
            s.idle.cancel()
            s.idle = None

    def _dispatch(self, s: _Stream, e: SseEvent) -> None:
        """One event: a Delivery, an end, or nothing (heartbeats are comments)."""
        if e.name == "end":
            self._stream_ended(s, _end_code(e.data))
        elif e.name == "delivery":
            item = read_delivery(e.data, self._client.forward)
            if isinstance(item, Delivery):
                self._ends = 0
            self._push(item)

    # ---- ends (STR-02, STR-03, STR-05 to STR-07) ----

    def _stream_ended(self, s: _Stream, code: str | None) -> None:
        if s.finished:
            return
        self._release(s)
        if self.finished or s is not self._current:
            return
        self._current = None
        self._clear_wsuper()
        if self._next is not None:
            # The old stream ended while its replacement opens or waits: switch (STR-05).
            self._push(StreamEnded(code, False))
            self._promote()
            return
        if code == "credential_refused":
            # STR-07: terminal; the client is revoked (REN-05).
            self._terminal(code)
            self._keeper.revoke(ProblemError(401, code))
            return
        self._ends += 1
        if self._ends >= self._limits.L_ends:
            self._terminal(code)
            return
        self._push(StreamEnded(code, False))
        self._state = "backingOff"
        retry_after = retry_after_seconds(dict(s.head.headers))
        wait = self._delay if retry_after is None else retry_after
        self._delay = min(self._delay * self._limits.B_factor, self._limits.B_cap / 1000)
        self._run(self._resubscribe(wait))

    async def _resubscribe(self, wait: float) -> None:
        await asyncio.sleep(wait)
        if not self.finished:
            await self._open()

    def _terminal(self, code: str | None) -> None:
        """A terminal *stream ended*, then nothing more (STR-06, STR-07, SUB-07)."""
        if self.finished:
            return
        self._push(StreamEnded(code, True))
        self._finish()

    def _finish(self) -> None:
        """Releases every stream, timer and task (PRB-07)."""
        if self._state == "done" and self.finished:
            return
        self.finished = True
        self._state = "done"
        self._off()
        self._clear_wsuper()
        for s in (self._current, self._next.stream if self._next is not None else None):
            if s is not None:
                self._release(s)
        self._current = None
        self._next = None
        me = asyncio.current_task(self._loop) if self._loop.is_running() else None
        for task in list(self._work):
            if task is not me:
                task.cancel()
        self._wake()

    def _release(self, s: _Stream) -> None:
        s.finished = True
        s.flowing = False
        s.active = False
        self._cancel_idle(s)
        s.conn.abort()


def _collect(core: SubscriptionCore) -> None:
    """The finalizer of a forgotten Subscription: given the core, never the handle."""
    if core.finished:
        return
    if core._loop.is_closed():
        core.finished = True
    else:
        core.abort()
    warnings.warn("unclosed Subscription", ResourceWarning, stacklevel=1, source=None)


class Subscription:
    """An async iterator of items (`Delivery`, `DeliveryError`, `StreamStarted`,
    `StreamEnded`). `async with client.subscribe() as subscription:` closes it on leaving
    the block (PH-LIFE-02); a bare `async for` left early keeps the stream open until
    `close()`. Delivery is live only (SUB-03): nothing is durable, ordered, redelivered,
    acknowledged, resumed or de-duplicated; a Delivery may be delivered twice around a
    stream boundary, and nothing identifies a duplicate (GAP-INT-001)."""

    __slots__ = ("__weakref__", "_core", "_finalizer")

    _core: SubscriptionCore
    _finalizer: weakref.finalize[Any, Any]

    def __init__(self) -> None:
        raise TypeError("Subscriptions are made by AgentClient.subscribe()")

    @classmethod
    def _make(cls, core: SubscriptionCore) -> Subscription:
        handle = object.__new__(cls)
        handle._core = core
        handle._finalizer = weakref.finalize(handle, _collect, core)
        return handle

    def __aiter__(self) -> Subscription:
        return self

    async def __anext__(self) -> SubscriptionItem:
        return await self._core.pull()

    async def close(self) -> None:
        """Closes the stream; idempotent. A pending or next item is a terminal *stream
        ended*, then iteration stops (SUB-07)."""
        self._finalizer.detach()
        await self._core.close()

    async def __aenter__(self) -> Subscription:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.close()

    def __repr__(self) -> str:
        return f"<Subscription finished={self._core.finished}>"

    def __reduce__(self) -> NoReturn:
        raise TypeError("Subscription is not picklable")
