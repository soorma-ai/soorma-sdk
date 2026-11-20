# SPDX-License-Identifier: Apache-2.0
#
# Test helpers: a run CA and a server certificate for localhost (generated with
# the openssl command, once per session), an untrusted CA, and a scripted
# local TLS server that records each request byte for byte.
from __future__ import annotations

import asyncio
import ssl
import subprocess
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path

import pytest
import pytest_asyncio

# Complete RFC 5280 extensions: Python 3.13 and later verify with
# VERIFY_X509_STRICT by default, which rejects certificates missing them.
EXT = """[req]
distinguished_name = dn
prompt = no
[dn]
CN = localhost
[ca]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
[ext]
subjectAltName = DNS:localhost, IP:127.0.0.1
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid, issuer
"""


@dataclass(frozen=True)
class Certs:
    ca: Path
    cert: Path
    key: Path
    untrusted_ca: Path


def _openssl(*args: str, cwd: Path) -> None:
    subprocess.run(["openssl", *args], cwd=cwd, check=True, capture_output=True)


def _make_ca(d: Path, name: str) -> None:
    _openssl(
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "2",
        "-subj",
        f"/CN={name}",
        "-config",
        "ext.cnf",
        "-extensions",
        "ca",
        "-keyout",
        f"{name}.key",
        "-out",
        f"{name}.pem",
        cwd=d,
    )


@pytest.fixture(scope="session")
def certs(tmp_path_factory: pytest.TempPathFactory) -> Certs:
    d = tmp_path_factory.mktemp("certs")
    (d / "ext.cnf").write_text(EXT)
    _make_ca(d, "ca")
    _make_ca(d, "other")
    _openssl(
        "req",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        "server.key",
        "-out",
        "server.csr",
        "-config",
        "ext.cnf",
        cwd=d,
    )
    _openssl(
        "x509",
        "-req",
        "-in",
        "server.csr",
        "-CA",
        "ca.pem",
        "-CAkey",
        "ca.key",
        "-CAcreateserial",
        "-days",
        "2",
        "-extfile",
        "ext.cnf",
        "-extensions",
        "ext",
        "-out",
        "server.pem",
        cwd=d,
    )
    return Certs(d / "ca.pem", d / "server.pem", d / "server.key", d / "other.pem")


Handler = Callable[[bytes, asyncio.StreamWriter], Awaitable[None]]


@dataclass
class Server:
    url: str
    requests: list[bytes] = field(default_factory=list)
    closed: asyncio.Event = field(default_factory=asyncio.Event)
    writers: list[asyncio.StreamWriter] = field(default_factory=list)
    handler: Handler | None = None


async def _read_request(reader: asyncio.StreamReader) -> bytes:
    head = await reader.readuntil(b"\r\n\r\n")
    length = 0
    for line in head.split(b"\r\n"):
        if line.lower().startswith(b"content-length:"):
            length = int(line.split(b":", 1)[1])
    return head + (await reader.readexactly(length) if length else b"")


@pytest_asyncio.fixture
async def server(certs: Certs) -> AsyncIterator[Server]:
    ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    ctx.load_cert_chain(certs.cert, certs.key)
    box = Server(url="")

    async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        box.writers.append(writer)
        try:
            req = await _read_request(reader)
            box.requests.append(req)
            if box.handler is not None:
                await box.handler(req, writer)
            # Wait for the client to close, so the test can see it did.
            await reader.read()
        except (ConnectionError, asyncio.IncompleteReadError, ssl.SSLError):
            pass
        finally:
            box.closed.set()
            writer.close()

    srv = await asyncio.start_server(handle, "127.0.0.1", 0, ssl=ctx)
    port = srv.sockets[0].getsockname()[1]
    box.url = f"https://localhost:{port}"
    try:
        yield box
    finally:
        # Since 3.12 wait_closed waits for every connection: drop them first.
        for w in box.writers:
            w.transport.abort()
        srv.close()
        await asyncio.wait_for(srv.wait_closed(), 5)


def client_context(ca: Path) -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.load_verify_locations(cafile=str(ca))
    return ctx
