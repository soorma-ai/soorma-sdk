# SPDX-License-Identifier: Apache-2.0
#
# The transport (P-06, P-07): the TLS context (verification always on;
# VERIFY_X509_STRICT kept on 3.13 and later, never cleared; TLS 1.2 at least);
# a supplied CA trusted and an untrusted certificate refused before any body
# is sent (TC-PH-003); a bad CA file refused by path (TC-PH-084); the
# Install Certificates hint only when the store is empty (TC-PH-091); the
# contract version on every call; Problems and Retry-After; B_body.
from __future__ import annotations

import ast
import asyncio
import os
import ssl
import sys
from datetime import UTC, datetime
from email.utils import format_datetime
from pathlib import Path

import pytest

from soorma import TransportError
from soorma._limits import LIMITS
from soorma._transport import (
    CONTRACT_HEADER,
    CONTRACT_VERSION,
    INSTALL_CERTIFICATES_HINT,
    Reply,
    Tls,
    load_tls,
    post,
    problem_from,
    retry_after_seconds,
)

from .conftest import Certs, Server, client_context

SRC = Path(__file__).resolve().parents[1] / "src" / "soorma"


@pytest.mark.asyncio
async def test_the_context_verifies_and_keeps_python_strict_flags() -> None:
    ctx = (await load_tls(None)).context
    assert ctx.verify_mode == ssl.CERT_REQUIRED
    assert ctx.check_hostname is True
    assert ctx.minimum_version == ssl.TLSVersion.TLSv1_2
    if sys.version_info >= (3, 13):
        assert ctx.verify_flags & ssl.VERIFY_X509_STRICT
        assert ctx.verify_flags & ssl.VERIFY_X509_PARTIAL_CHAIN


def test_no_module_changes_verification() -> None:
    """The SDK never clears VERIFY_X509_STRICT, turns off hostname checking or
    verification, or builds an unverified context (P-06; NFR-U4-17)."""
    forbidden = {"verify_flags", "check_hostname", "verify_mode"}
    found: list[str] = []
    for path in sorted(SRC.rglob("*.py")):
        for node in ast.walk(ast.parse(path.read_text(), str(path))):
            targets: list[ast.expr] = []
            if isinstance(node, ast.Assign):
                targets = node.targets
            elif isinstance(node, ast.AugAssign | ast.AnnAssign):
                targets = [node.target]
            found.extend(
                f"{path.name}:{t.lineno}"
                for t in targets
                if isinstance(t, ast.Attribute) and t.attr in forbidden
            )
            if isinstance(node, ast.Attribute) and node.attr in {
                "_create_unverified_context",
                "CERT_NONE",
            }:
                found.append(f"{path.name}:{node.lineno}")
    assert found == []


@pytest.mark.asyncio
async def test_a_supplied_ca_is_trusted(certs: Certs, server: Server) -> None:
    async def ok(_req: bytes, w: asyncio.StreamWriter) -> None:
        w.write(b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\n{}")
        await w.drain()

    server.handler = ok
    tls = await load_tls(str(certs.ca))
    reply = await post(tls, server.url, "/agent-credentials", headers={}, body=b"{}", limits=LIMITS)
    assert (reply.status, reply.body) == (200, b"{}")
    head = server.requests[0].split(b"\r\n\r\n")[0].decode()
    assert f"{CONTRACT_HEADER}: {CONTRACT_VERSION}" in head.split("\r\n")


@pytest.mark.asyncio
async def test_an_untrusted_certificate_is_tls_and_no_body_reaches_the_server(
    certs: Certs, server: Server
) -> None:
    tls = await load_tls(str(certs.untrusted_ca))
    with pytest.raises(TransportError) as e:
        await post(tls, server.url, "/x", headers={}, body=b'{"secret":"x"}', limits=LIMITS)
    assert e.value.reason == "tls"
    assert server.requests == []


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["missing", "unreadable", "not-pem"])
async def test_a_bad_ca_file_is_ca_file_naming_the_path(tmp_path: Path, kind: str) -> None:
    p = tmp_path / "ca.pem"
    if kind == "unreadable" and os.geteuid() == 0:
        pytest.skip("root reads any file")
    if kind == "unreadable":
        p.write_text("-----BEGIN CERTIFICATE-----\n")
        p.chmod(0)
    elif kind == "not-pem":
        p.write_text("not a certificate\n")
    with pytest.raises(TransportError) as e:
        await load_tls(str(p))
    assert e.value.reason == "ca-file"
    assert str(p) in str(e.value)
    assert e.value.__cause__ is None


@pytest.mark.asyncio
async def test_an_empty_default_store_is_detected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        ssl, "create_default_context", lambda: ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    )
    assert (await load_tls(None)).empty_store is True


@pytest.mark.asyncio
@pytest.mark.parametrize("empty", [True, False])
async def test_only_an_empty_store_hints_at_install_certificates(
    certs: Certs, server: Server, empty: bool
) -> None:
    tls = Tls(client_context(certs.untrusted_ca), empty_store=empty)
    with pytest.raises(TransportError) as e:
        await post(tls, server.url, "/x", headers={}, body=None, limits=LIMITS)
    assert e.value.reason == "tls"
    message = str(e.value)
    assert (INSTALL_CERTIFICATES_HINT in message) is empty
    for detail in ("localhost", "CN=", "certificate verify", "self-signed", "issuer"):
        assert detail not in message


def test_the_hint_is_only_for_tls() -> None:
    tls = Tls(ssl.create_default_context(), empty_store=True)
    error = TransportError("timeout", sent=True)
    assert tls.error(error) is error


@pytest.mark.asyncio
async def test_a_body_over_b_body_is_response_too_large(certs: Certs, server: Server) -> None:
    async def big(_req: bytes, w: asyncio.StreamWriter) -> None:
        w.write(b"HTTP/1.1 503 Busy\r\ncontent-length: 2048\r\n\r\n" + b"x" * 2048)
        await w.drain()

    server.handler = big
    limits = type(LIMITS)(B_body=1024)
    with pytest.raises(TransportError) as e:
        await post(
            Tls(client_context(certs.ca), False),
            server.url,
            "/x",
            headers={},
            body=None,
            limits=limits,
        )
    assert e.value.reason == "response-too-large"


def test_a_problem_keeps_every_member() -> None:
    body = b'{"type":"about:blank","status":409,"code":"conflict","title":"T","detail":"D","x":[1]}'
    p = problem_from(Reply(409, {"retry-after": "7"}, body))
    assert (p.status, p.code, p.title, p.detail, p.retry_after) == (409, "conflict", "T", "D", 7.0)
    assert p.problem is not None
    assert p.problem["x"] == [1]
    with pytest.raises(TypeError):
        p.problem["x"] = 2  # type: ignore[index]


@pytest.mark.parametrize(
    "body", [b"<html>busy</html>", b"[1]", b'{"code":5}', b'{"status":"x"}', b"", b"[" * 100_000]
)
def test_a_non_problem_answer_keeps_only_the_status(body: bytes) -> None:
    p = problem_from(Reply(502, {}, body))
    assert (p.status, p.code, p.problem) == (502, None, None)
    assert "busy" not in str(p)


def test_retry_after_as_seconds_or_an_http_date(monkeypatch: pytest.MonkeyPatch) -> None:
    from soorma import _clock

    now = datetime(2026, 11, 19, 12, 0, 0, tzinfo=UTC)
    monkeypatch.setattr(_clock, "wall_now", now.timestamp)
    assert retry_after_seconds({"retry-after": " 3 "}) == 3.0
    later = format_datetime(now.replace(second=30), usegmt=True)
    assert retry_after_seconds({"retry-after": later}) == 30.0
    earlier = format_datetime(now.replace(hour=11), usegmt=True)
    assert retry_after_seconds({"retry-after": earlier}) == 0.0
    assert retry_after_seconds({"retry-after": "soon"}) is None
    assert retry_after_seconds({"retry-after": "-1"}) is None
    assert retry_after_seconds({}) is None
