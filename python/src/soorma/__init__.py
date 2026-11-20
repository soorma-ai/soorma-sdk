# SPDX-License-Identifier: Apache-2.0
#
# soorma: exactly the name table's Python column (spec/names.md; NAM-01).
"""The soorma agent SDK for Python. Advisory only: the platform enforces everything."""

from ._client import AgentClient
from ._errors import (
    ClientStateError,
    PayloadNotParsed,
    ProblemError,
    SecretSourceError,
    SoormaError,
    SoormaWarning,
    TransportError,
)
from ._options import AgentClientOptions, new_instance_id
from ._reader import Delivery
from ._secrets import file_secret
from ._subscription import Subscription, SubscriptionItem
from ._types import (
    CredentialInfo,
    DeliveryError,
    Envelope,
    EnvironmentRef,
    JsonValue,
    PublishAccepted,
    SecretProvider,
    StreamEnded,
    StreamStarted,
    TraceContext,
)

__all__ = [
    "AgentClient",
    "AgentClientOptions",
    "ClientStateError",
    "CredentialInfo",
    "Delivery",
    "DeliveryError",
    "Envelope",
    "EnvironmentRef",
    "JsonValue",
    "PayloadNotParsed",
    "ProblemError",
    "PublishAccepted",
    "SecretProvider",
    "SecretSourceError",
    "SoormaError",
    "SoormaWarning",
    "StreamEnded",
    "StreamStarted",
    "Subscription",
    "SubscriptionItem",
    "TraceContext",
    "TransportError",
    "file_secret",
    "new_instance_id",
]
