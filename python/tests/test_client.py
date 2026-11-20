# SPDX-License-Identifier: Apache-2.0
#
# The client (C-11; PH-API, PH-PUB-03, PH-LIFE; P-10, P-12), over a scripted
# platform: creating contacts nothing (TC-PH-001); options are checked by
# presence and type, an unknown one refused (TC-PH-004, TC-PH-074); start,
# publish (never retried), credential_expired, revocation; close idempotent and
# concurrent, and during start; no credential in any string or pickled form
# (TC-PH-021); and the collection test (TC-PH-076, the user's): a forgotten
# started client is collected, released synchronously, and warns once.
from __future__ import annotations

import asyncio
import dataclasses
import gc
import json
import pickle
import warnings
import weakref
from dataclasses import dataclass, field, replace
from typing import Any

import pytest

from soorma import (
    AgentClient,
    AgentClientOptions,
    ClientStateError,
    ProblemError,
    PublishAccepted,
    TransportError,
    _client,
    _keeper,
    _limits,
)
from soorma._transport import Reply

from .test_keeper import BOOT, RENEW, cred, problem

EVENTS = "/events"
SECRET = "the-registration-secret"


@dataclass
class Platform:
    """S3 and S4, scripted per path; every call recorded. An asyncio.Event as a reply
    holds the request until it is set."""

    replies: dict[str, list[Any]]
    calls: list[tuple[str, dict[str, str], bytes | None]] = field(default_factory=list)
    posted: asyncio.Event = field(default_factory=asyncio.Event)

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
        del limits
        self.calls.append((path, headers, body))
        self.posted.set()
        r = self.replies[path].pop(0)
        if isinstance(r, asyncio.Event):
            await r.wait()
            raise TransportError("connection", sent=True)
        if isinstance(r, Exception):
            raise r
        assert isinstance(r, Reply)
        return r

    def count(self, path: str) -> int:
        return sum(1 for c in self.calls if c[0] == path)


def accepted() -> Reply:
    return Reply(202, {}, b'{"accepted":true}')


def options(**over: Any) -> AgentClientOptions:
    base: dict[str, Any] = {
        "data_gateway_url": "https://s3.test",
        "event_ingest_url": "https://s4.test",
        "agent": "agent-a",
        "instance": "i-1",
        "secret": lambda: SECRET,
    }
    return AgentClientOptions(**(base | over))


@pytest.fixture
def platform(monkeypatch: pytest.MonkeyPatch) -> Platform:
    p = Platform({BOOT: [], RENEW: [], EVENTS: []})
    monkeypatch.setattr(_keeper, "post", p.post)
    monkeypatch.setattr(_client, "post", p.post)
    return p


def test_creating_a_client_contacts_nothing_and_calls_no_provider(platform: Platform) -> None:
    calls = 0

    def provider() -> str:
        nonlocal calls
        calls += 1
        return SECRET

    client = AgentClient(options(secret=provider))
    assert calls == 0
    assert platform.calls == []
    del client


def test_the_options_have_no_tls_switch_and_refuse_an_unknown_one() -> None:
    names = {f.name for f in dataclasses.fields(AgentClientOptions)}
    assert names == {
        "data_gateway_url",
        "event_ingest_url",
        "agent",
        "instance",
        "secret",
        "ca_file",
    }
    with pytest.raises(TypeError):
        options(verify_tls=False)
    with pytest.raises(TypeError):
        options(insecure=True)
    with pytest.raises(dataclasses.FrozenInstanceError):
        options().ca_file = "x"  # type: ignore[misc]


@pytest.mark.parametrize(
    "over",
    [
        {"data_gateway_url": "http://s3.test"},
        {"event_ingest_url": "s4.test"},
        {"agent": 7},
        {"instance": None},
        {"secret": SECRET},
        {"ca_file": b"/ca.pem"},
    ],
)
def test_options_are_checked_by_presence_and_type(over: dict[str, Any]) -> None:
    with pytest.raises(TypeError):
        AgentClient(options(**over))
    with pytest.raises(TypeError):
        AgentClient({"agent": "a"})  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_start_publish_and_credential(platform: Platform) -> None:
    platform.replies[BOOT] = [cred("A", 3600, region="eu")]
    platform.replies[EVENTS] = [accepted()]
    async with AgentClient(options()) as client:
        with pytest.raises(ClientStateError) as e:
            _ = client.credential
        assert e.value.state == "created"
        await client.start()
        details = client.credential
        assert (details.agent, details.instance) == ("a", "i")
        assert details.environment["region"] == "eu"
        with pytest.raises(ClientStateError):
            await client.start()
        result = await client.publish({"hello": "B", "n": [1, 2.5, None]})
        assert isinstance(result, PublishAccepted)
        path, headers, body = platform.calls[-1]
        assert path == EVENTS
        assert headers == {"Authorization": "Bearer A"}
        assert body is not None
        sent = json.loads(body)
        assert sent["payload"] == {"hello": "B", "n": [1, 2.5, None]}
        assert sent["draft"] == {
            "clientContractVersion": "0.1.0",
            "traceContext": {"traceparent": result.trace_context.traceparent},
        }
        assert b'"inbound"' not in body
    assert repr(client).endswith("state=closed>")


@pytest.mark.asyncio
async def test_a_refused_payload_sends_nothing(platform: Platform) -> None:
    platform.replies[BOOT] = [cred("A", 3600)]
    async with AgentClient(options()) as client:
        await client.start()
        with pytest.raises(TypeError, match=r"payload \$\.t is of type tuple"):
            await client.publish({"t": (1, 2)})  # type: ignore[dict-item]
        with pytest.raises(TypeError, match="digit limit"):
            await client.publish({"n": 10**5000})
    assert platform.count(EVENTS) == 0


@pytest.mark.asyncio
async def test_a_publish_problem_is_raised_and_never_retried(platform: Platform) -> None:
    platform.replies[BOOT] = [cred("A", 3600)]
    platform.replies[EVENTS] = [
        Reply(503, {"retry-after": "0"}, b'{"status":503,"code":"unavailable"}'),
        TransportError("connection", sent=False),
    ]
    async with AgentClient(options()) as client:
        await client.start()
        with pytest.raises(ProblemError) as e:
            await client.publish(1)
        assert (e.value.status, e.value.code) == (503, "unavailable")
        with pytest.raises(TransportError):
            await client.publish(2)
    assert platform.count(EVENTS) == 2


@pytest.mark.asyncio
async def test_credential_expired_makes_the_next_operation_bootstrap(platform: Platform) -> None:
    platform.replies[BOOT] = [cred("A", 3600), cred("B", 3600)]
    platform.replies[EVENTS] = [problem(401, "credential_expired"), accepted()]
    async with AgentClient(options()) as client:
        await client.start()
        with pytest.raises(ProblemError):
            await client.publish(1)
        await client.publish(2)
    assert platform.count(BOOT) == 2
    assert platform.calls[-1][1] == {"Authorization": "Bearer B"}


@pytest.mark.asyncio
async def test_a_failed_start_leaves_the_client_created_and_startable(platform: Platform) -> None:
    platform.replies[BOOT] = [problem(400, "invalid_request"), cred("A", 3600)]
    async with AgentClient(options()) as client:
        with pytest.raises(ProblemError):
            await client.start()
        await client.start()
        assert client.credential.agent == "a"


@pytest.mark.asyncio
async def test_a_refused_renewal_revokes_the_client(
    platform: Platform, monkeypatch: pytest.MonkeyPatch
) -> None:
    platform.replies[BOOT] = [cred("A", 0.3)]
    platform.replies[RENEW] = [problem(401, "credential_refused")]
    fast = replace(_limits.capture(), H_renew=0, R_min=100)
    monkeypatch.setattr(_limits, "capture", lambda: fast)
    async with AgentClient(options()) as client:
        revoked = asyncio.Event()
        client._core.keeper.on_credential(Listener(revoked))
        await client.start()
        await asyncio.wait_for(revoked.wait(), 5)
        assert "state=revoked" in repr(client)
        with pytest.raises(ClientStateError) as e:
            await client.publish(1)
        assert e.value.state == "revoked"
        assert e.value.problem is not None
        assert e.value.problem.code == "credential_refused"


@dataclass
class Listener:
    revoked_event: asyncio.Event

    def credential(self, lineage_changed: bool) -> None:
        del lineage_changed

    def revoked(self, problem: ProblemError) -> None:
        del problem
        self.revoked_event.set()


@pytest.mark.asyncio
async def test_close_is_idempotent_and_concurrent_calls_share_it(platform: Platform) -> None:
    platform.replies[BOOT] = [cred("A", 3600)]
    client = AgentClient(options())
    await client.start()
    await asyncio.gather(client.close(), client.close(), client.close())
    await client.close()
    for op in (client.start(), client.publish(1)):
        with pytest.raises(ClientStateError) as e:
            await op
        assert e.value.state == "closed"
    with pytest.raises(ClientStateError):
        _ = client.credential


@pytest.mark.asyncio
async def test_close_during_start_aborts_the_bootstrap(platform: Platform) -> None:
    held = asyncio.Event()
    platform.replies[BOOT] = [held]
    client = AgentClient(options())
    starting = asyncio.create_task(client.start())
    await asyncio.wait_for(platform.posted.wait(), 5)
    await client.close()
    with pytest.raises(ClientStateError) as e:
        await starting
    assert e.value.state == "closed"
    assert "state=closed" in repr(client)


@pytest.mark.asyncio
async def test_the_callers_own_cancellation_passes_through(platform: Platform) -> None:
    held = asyncio.Event()
    platform.replies[BOOT] = [held]
    client = AgentClient(options())
    starting = asyncio.create_task(client.start())
    await asyncio.wait_for(platform.posted.wait(), 5)
    starting.cancel()
    with pytest.raises(asyncio.CancelledError):
        await starting
    assert "state=created" in repr(client)
    await client.close()


@pytest.mark.asyncio
async def test_no_credential_or_secret_in_any_string_or_pickled_form(platform: Platform) -> None:
    token = "eyJ-the-bearer-credential"
    platform.replies[BOOT] = [cred(token, 3600)]
    platform.replies[EVENTS] = [problem(409, "conflict")]
    client = AgentClient(options())
    await client.start()
    details = client.credential
    with pytest.raises(ProblemError) as e:
        await client.publish(1)
    objects: list[object] = [client, details, details.environment, e.value, ClientStateError("x")]
    for o in objects:
        for text in (repr(o), str(o)):
            assert token not in text
            assert SECRET not in text
    for o in (client, details, e.value, TransportError("tls"), ClientStateError("closed")):
        with pytest.raises(TypeError):
            pickle.dumps(o)
    await client.close()


async def _started(platform: Platform) -> AgentClient:
    platform.replies[BOOT] = [cred("A", 3600)]
    client = AgentClient(options())
    await client.start()
    return client


@pytest.mark.asyncio
async def test_a_forgotten_started_client_is_collected_and_warns_once(platform: Platform) -> None:
    client = await _started(platform)
    core = client._core
    timer = core.keeper._timer
    assert timer is not None
    tasks_before = asyncio.all_tasks()
    ref = weakref.ref(client)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        del client
        gc.collect()
    assert ref() is None
    unclosed = [w for w in caught if issubclass(w.category, ResourceWarning)]
    assert [str(w.message) for w in unclosed] == ["unclosed AgentClient 'agent-a'"]
    assert timer.cancelled()
    assert core.keeper._timer is None
    assert core.keeper.details is None
    assert not core._ops
    assert not core.keeper._tasks
    assert asyncio.all_tasks() == tasks_before  # nothing scheduled
    assert core.state == "closed"


@pytest.mark.asyncio
async def test_a_closed_or_unstarted_client_collected_emits_nothing(platform: Platform) -> None:
    client = await _started(platform)
    await client.close()
    unstarted = AgentClient(options())
    refs = [weakref.ref(client), weakref.ref(unstarted)]
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        del client, unstarted
        gc.collect()
    assert [r() for r in refs] == [None, None]
    assert [w for w in caught if issubclass(w.category, ResourceWarning)] == []
