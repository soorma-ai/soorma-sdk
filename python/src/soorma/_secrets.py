# SPDX-License-Identifier: Apache-2.0
#
# Secret providers (C-13; SEC-03 to SEC-09; PH-SEC-01 to 03). file_secret is
# the one provider shipped; none reads an environment variable (SEC-03). Each
# call, off the event loop, opens the path without blocking (following links
# to the final file), checks the opened descriptor, and only then reads. A
# refusal names the path and the reason, never the contents.
from __future__ import annotations

import asyncio
import os
import stat
import sys

from ._errors import SecretSourceError
from ._types import SecretProvider


def refusal(st: os.stat_result, uid: int) -> str | None:
    """The checks on the opened descriptor, in the order U1's reference driver makes them."""
    if not stat.S_ISREG(st.st_mode):
        return "not-regular-file"
    if st.st_uid not in (uid, 0):
        return "owned-by-another-user"
    if st.st_mode & 0o004:
        return "readable-by-others"
    if st.st_mode & 0o020:
        return "writable-by-group"
    if st.st_mode & 0o002:
        return "writable-by-others"
    return None


def _read(path: str) -> str:
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
    except OSError:
        raise SecretSourceError("unreadable", path) from None
    try:
        why = refusal(os.fstat(fd), os.getuid())
        if why:
            raise SecretSourceError(why, path)
        chunks: list[bytes] = []
        while chunk := os.read(fd, 65536):
            chunks.append(chunk)
        text = b"".join(chunks).decode("utf-8")
    except SecretSourceError:
        raise
    except (OSError, UnicodeDecodeError):
        raise SecretSourceError("unreadable", path) from None
    finally:
        os.close(fd)
    # SEC-07: one trailing line ending removed.
    if text.endswith("\r\n"):
        return text[:-2]
    if text.endswith("\n"):
        return text[:-1]
    return text


def file_secret(path: str) -> SecretProvider:
    """A provider reading the agent's secret file, checked first (SEC-03 to SEC-09).
    Refused on Windows, where the file's owner and mode cannot be checked (SEC-09)."""

    async def provider() -> str:
        if sys.platform == "win32":
            raise SecretSourceError("unsupported-platform", path)
        return await asyncio.to_thread(_read, path)

    return provider
