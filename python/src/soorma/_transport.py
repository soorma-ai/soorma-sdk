# SPDX-License-Identifier: Apache-2.0
#
# The transport (C-15; P-06, P-07): HTTPS to the configured S3 and S4 only,
# TLS always verified, the contract version on every call, Problems parsed.
# A TLS context is built once per client, at start(): Python's default context
# (the OS store, hostname checking, VERIFY_X509_STRICT on 3.13+, never cleared),
# TLS 1.2 at least, plus the CA file when given (CFG-04; NFR-U4-17).
from __future__ import annotations

import asyncio
import json
import math
import ssl
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from types import MappingProxyType
from typing import Any

from . import _clock
from ._connection import open_request, request_bytes
from ._errors import ProblemError, TransportError
from ._limits import Limits

CONTRACT_VERSION = "0.1.0"
CONTRACT_HEADER = "Soorma-Contract-Version"

INSTALL_CERTIFICATES_HINT = (
    "this Python found no CA certificates; if it came from python.org's macOS installer, "
    "run its Install Certificates command, or pass ca_file"
)


@dataclass(frozen=True, slots=True)
class Tls:
    """The client's TLS context, and whether the default store held no CA (P-06)."""

    context: ssl.SSLContext
    empty_store: bool

    def error(self, error: TransportError) -> TransportError:
        """A tls failure, with the Install Certificates hint when the store was empty."""
        if error.reason == "tls" and self.empty_store:
            return TransportError("tls", hint=INSTALL_CERTIFICATES_HINT, sent=error._sent)
        return error


def _load_tls(ca_file: str | None) -> Tls:
    ctx = ssl.create_default_context()
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    empty = ctx.cert_store_stats()["x509_ca"] == 0
    if ca_file is not None:
        try:
            ctx.load_verify_locations(cafile=ca_file)
        except (OSError, ssl.SSLError, ValueError):
            # The path, never the file's contents (TC-PH-084).
            raise TransportError("ca-file", hint=ca_file) from None
    return Tls(ctx, empty)


async def load_tls(ca_file: str | None) -> Tls:
    """Built off the loop (the CA file is read); a bad CA file sends nothing."""
    return await asyncio.to_thread(_load_tls, ca_file)


@dataclass(frozen=True, slots=True)
class Reply:
    status: int
    headers: dict[str, str]
    body: bytes


async def post(
    tls: Tls,
    url: str,
    path: str,
    *,
    headers: dict[str, str],
    body: bytes | None,
    limits: Limits,
) -> Reply:
    """One POST, read whole (at most B_body bytes): never retried here."""
    req = request_bytes(
        url, path, {CONTRACT_HEADER: CONTRACT_VERSION, **headers}, body, accept="application/json"
    )
    try:
        head, conn = await open_request(
            url,
            req,
            tls.context,
            t_req=limits.T_req / 1000,
            max_body=limits.B_body,
            max_event=limits.L_event,
        )
        try:
            data = await conn.body()
        finally:
            conn.abort()
    except TransportError as e:
        raise tls.error(e) from None
    return Reply(head.status, dict(head.headers), data)


def retry_after_seconds(headers: dict[str, str]) -> float | None:
    """Retry-After as delta-seconds or an HTTP-date (PRB-03)."""
    v = headers.get("retry-after")
    if v is None:
        return None
    v = v.strip()
    if v.isdigit():
        return float(int(v))
    try:
        at = parsedate_to_datetime(v).timestamp()
    except (TypeError, ValueError):
        return None
    return float(max(0, math.ceil(at - _clock.wall_now())))


def problem_from(reply: Reply) -> ProblemError:
    """A non-success response as ProblemError: every member kept; nothing if not a Problem."""
    p: dict[str, Any] | None = None
    try:
        v = json.loads(reply.body)
        if isinstance(v, dict):
            p = v
    except (ValueError, RecursionError):
        p = None
    is_problem = (
        p is not None
        and (p.get("code") is None or isinstance(p.get("code"), str))
        and (p.get("status") is None or isinstance(p.get("status"), int))
    )
    q = p if is_problem and p is not None else None
    return ProblemError(
        reply.status,
        q["code"] if q is not None and isinstance(q.get("code"), str) else None,
        title=q["title"] if q is not None and isinstance(q.get("title"), str) else None,
        detail=q["detail"] if q is not None and isinstance(q.get("detail"), str) else None,
        retry_after=retry_after_seconds(reply.headers),
        problem=MappingProxyType(dict(q)) if q is not None else None,
    )
