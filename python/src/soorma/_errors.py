# SPDX-License-Identifier: Apache-2.0
#
# The errors (C-20) and the warning category (REN-07). No secret, credential,
# payload or response bytes in any message, str or repr (CRD-04; NFR-U4-18).
from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ._types import JsonValue


class SoormaError(Exception):
    """The base of every error the SDK raises."""

    def __reduce__(self) -> tuple[object, ...]:
        raise TypeError(f"{type(self).__name__} is not picklable")


class ProblemError(SoormaError):
    """The platform answered with a Problem (PRB-01 to PRB-03)."""

    def __init__(
        self,
        status: int,
        code: str | None,
        *,
        title: str | None = None,
        detail: str | None = None,
        retry_after: float | None = None,
        problem: Mapping[str, JsonValue] | None = None,
    ) -> None:
        super().__init__(f"problem: {status} {code or ''}".rstrip())
        self.status = status
        self.code = code
        self.title = title
        self.detail = detail
        self.retry_after = retry_after
        self.problem = problem


class TransportError(SoormaError):
    """No usable answer: tls, connection, timeout, unusable-response, ca-file, malformed-response,
    response-too-large, truncated-response (an open set)."""

    def __init__(self, reason: str, *, hint: str | None = None) -> None:
        super().__init__(f"transport: {reason}" + (f" ({hint})" if hint else ""))
        self.reason = reason


class SecretSourceError(SoormaError):
    """A secret provider refused or failed: the path and the reason, never the contents (SEC-08)."""

    def __init__(self, reason: str, path: str | None = None) -> None:
        super().__init__(f"secret source: {reason}" + ("" if path is None else f": {path}"))
        self.reason = reason
        self.path = path


class ClientStateError(SoormaError):
    """The client's state does not allow the call (ACQ-07, REN-05, SUB-04)."""

    def __init__(self, state: str, problem: ProblemError | None = None) -> None:
        super().__init__(f"client is {state}")
        self.state = state
        self.problem = problem


class PayloadNotParsed(AttributeError):
    """Raised by `Delivery.payload` when the payload was not parsed (RCV-06; PH-RD-06, -07):
    check `payload_parsed`, or use `payload_text`."""

    def __init__(self) -> None:
        super().__init__(
            "the payload was not parsed (too deep, or beyond a parse limit): "
            "check payload_parsed, or use payload_text"
        )


class SoormaWarning(UserWarning):
    """The SDK's warning category (REN-07): filter on it. `code` names the warning."""

    def __init__(self, message: str, code: str = "SOORMA_CLOCK_SKEW") -> None:
        super().__init__(message)
        self.code = code
