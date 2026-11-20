# SPDX-License-Identifier: Apache-2.0
#
# The public value types (domain-entities §2.2): frozen, holding no credential.
from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TypeAlias

from ._generated.envelope import Envelope

JsonValue: TypeAlias = "bool | int | float | str | list[JsonValue] | dict[str, JsonValue] | None"
"""A payload: plain JSON types (PUB-04; U4-FD-Q5)."""

SecretProvider: TypeAlias = Callable[[], "Awaitable[str] | str"]
"""Returns the agent's registration secret, or an awaitable of it (SEC-01)."""


@dataclass(frozen=True, slots=True)
class EnvironmentRef:
    organization: str
    project: str
    environment: str


@dataclass(frozen=True, slots=True)
class CredentialInfo:
    """The credential's details, read only; never the credential (CRD-03)."""

    agent: str
    instance: str
    environment: EnvironmentRef
    expires_at: str


@dataclass(frozen=True, slots=True)
class TraceContext:
    traceparent: str
    tracestate: str | None = None


@dataclass(frozen=True, slots=True)
class PublishAccepted:
    trace_context: TraceContext


@dataclass(frozen=True, slots=True)
class DeliveryError:
    """A line that is not a usable Delivery (RCV-07, RCV-09); the stream continues."""

    reason: str
    text: str


@dataclass(frozen=True, slots=True)
class StreamStarted:
    """A stream opened (STR-01)."""


@dataclass(frozen=True, slots=True)
class StreamEnded:
    """A stream ended (STR-02, STR-03, STR-07)."""

    code: str | None
    terminal: bool


__all__ = [
    "CredentialInfo",
    "DeliveryError",
    "Envelope",
    "EnvironmentRef",
    "JsonValue",
    "PublishAccepted",
    "SecretProvider",
    "StreamEnded",
    "StreamStarted",
    "TraceContext",
]
