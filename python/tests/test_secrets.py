# SPDX-License-Identifier: Apache-2.0
#
# file_secret (SEC-03 to SEC-09; PH-SEC-01 to 03): an owner-only file read on
# every call, one trailing line ending removed (TC-PH-012); unsafe files refused
# by path and reason, never contents (TC-PH-013); group read and a link chain
# allowed (TC-PH-014); a named pipe or device refused without blocking
# (TC-PH-015); Windows refused without opening the path (TC-PH-067).
from __future__ import annotations

import asyncio
import os
import stat
import sys
from pathlib import Path

import pytest

from soorma import SecretSourceError, file_secret
from soorma._secrets import refusal
from soorma._types import SecretProvider

SECRET = "s3cr3t-value"


async def read(path: str) -> str:
    """Calls a file_secret provider: it always returns an awaitable."""
    value = file_secret(path)()
    assert not isinstance(value, str)
    return await value


def secret_file(tmp_path: Path, mode: int, text: str = SECRET + "\n") -> Path:
    p = tmp_path / f"secret-{mode:o}"
    p.write_text(text)
    p.chmod(mode)
    return p


@pytest.mark.asyncio
async def test_an_owner_only_file_is_read_on_each_call(tmp_path: Path) -> None:
    p = secret_file(tmp_path, 0o600)
    provider: SecretProvider = file_secret(str(p))
    first = provider()
    assert not isinstance(first, str)
    assert await first == SECRET
    p.write_text("rotated\r\n")
    second = provider()
    assert not isinstance(second, str)
    assert await second == "rotated"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("text", "expected"),
    [("a\n\n", "a\n"), ("a\r\n\r\n", "a\r\n"), ("a", "a"), ("a\r", "a\r"), ("", "")],
)
async def test_exactly_one_trailing_line_ending_is_removed(
    tmp_path: Path, text: str, expected: str
) -> None:
    assert await read(str(secret_file(tmp_path, 0o600, text))) == expected


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("mode", "reason"),
    [
        (0o604, "readable-by-others"),
        (0o620, "writable-by-group"),
        (0o602, "writable-by-others"),
    ],
)
async def test_an_unsafe_file_is_refused_by_path_and_reason(
    tmp_path: Path, mode: int, reason: str
) -> None:
    p = secret_file(tmp_path, mode)
    with pytest.raises(SecretSourceError) as e:
        await read(str(p))
    assert e.value.reason == reason
    assert e.value.path == str(p)
    for text in (str(e.value), repr(e.value)):
        assert SECRET not in text
        assert str(p) in str(e.value)
    assert e.value.__cause__ is None


def _stat(mode: int, uid: int) -> os.stat_result:
    return os.stat_result((mode, 0, 0, 1, uid, 0, 0, 0, 0, 0))


def test_a_file_owned_by_another_user_is_refused_and_root_is_allowed() -> None:
    me = 1000
    assert refusal(_stat(stat.S_IFREG | 0o600, 4242), me) == "owned-by-another-user"
    assert refusal(_stat(stat.S_IFREG | 0o600, me), me) is None
    assert refusal(_stat(stat.S_IFREG | 0o440, 0), me) is None
    assert refusal(_stat(stat.S_IFIFO | 0o600, me), me) == "not-regular-file"


@pytest.mark.asyncio
async def test_group_read_through_a_link_chain_is_allowed(tmp_path: Path) -> None:
    # Kubernetes' layout: name -> ..data/name, ..data -> ..2026_11_19/ (TC-PH-014).
    real = tmp_path / "..2026_11_19"
    real.mkdir()
    secret_file(real, 0o440).rename(real / "secret")
    (tmp_path / "..data").symlink_to(real.name)
    (tmp_path / "secret").symlink_to("..data/secret")
    assert await read(str(tmp_path / "secret")) == SECRET


@pytest.mark.asyncio
async def test_a_link_to_an_unsafe_file_is_judged_by_the_final_file(tmp_path: Path) -> None:
    target = secret_file(tmp_path, 0o644)
    link = tmp_path / "link"
    link.symlink_to(target)
    with pytest.raises(SecretSourceError) as e:
        await read(str(link))
    assert e.value.reason == "readable-by-others"


@pytest.mark.asyncio
@pytest.mark.skipif(sys.platform == "win32", reason="POSIX special files")
async def test_a_named_pipe_with_no_writer_is_refused_without_blocking(tmp_path: Path) -> None:
    fifo = tmp_path / "fifo"
    os.mkfifo(fifo, 0o600)
    with pytest.raises(SecretSourceError) as e:
        await asyncio.wait_for(read(str(fifo)), 1)
    assert e.value.reason == "not-regular-file"


@pytest.mark.asyncio
@pytest.mark.skipif(sys.platform == "win32", reason="POSIX special files")
async def test_a_device_is_refused_without_reading(tmp_path: Path) -> None:
    with pytest.raises(SecretSourceError) as e:
        await asyncio.wait_for(read("/dev/zero"), 1)
    assert e.value.reason == "not-regular-file"


@pytest.mark.asyncio
async def test_a_missing_file_is_unreadable_naming_the_path(tmp_path: Path) -> None:
    p = tmp_path / "absent"
    with pytest.raises(SecretSourceError) as e:
        await read(str(p))
    assert (e.value.reason, e.value.path) == ("unreadable", str(p))
    assert e.value.__cause__ is None


@pytest.mark.asyncio
async def test_windows_is_refused_without_opening_the_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    p = secret_file(tmp_path, 0o600)
    opened: list[object] = []
    monkeypatch.setattr(sys, "platform", "win32")
    monkeypatch.setattr(os, "open", lambda *a, **k: opened.append(a))
    with pytest.raises(SecretSourceError) as e:
        await read(str(p))
    assert (e.value.reason, e.value.path) == ("unsupported-platform", str(p))
    assert opened == []


@pytest.mark.asyncio
async def test_the_file_is_read_off_the_event_loop(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    p = secret_file(tmp_path, 0o600)
    calls: list[object] = []
    real = asyncio.to_thread

    async def spy(fn, /, *args, **kwargs):  # type: ignore[no-untyped-def]
        calls.append(fn)
        return await real(fn, *args, **kwargs)

    monkeypatch.setattr(asyncio, "to_thread", spy)
    assert await read(str(p)) == SECRET
    assert len(calls) == 1
