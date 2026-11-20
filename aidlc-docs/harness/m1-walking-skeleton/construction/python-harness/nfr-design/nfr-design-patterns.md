# NFR Design Patterns — U4 `python-harness`

How each NFR-U4 requirement is built: the mechanism, where it lives, what it guarantees, and how
it is tested. Answers: U4-NFR-D-Q1 A, Q2 A; the five decisions in the plan accepted; the
collection test added (the user, audit). Modules are `logical-components.md`'s. Where a pattern
is U3's, carried, only the Python form is given.

## P-01 The Retry Policy (NFR-U4-12; carried from U3's P-01)

**Mechanism**: one coroutine, `retry(kind, attempt)`, in `_retry.py`; `kind` is `bootstrap`,
`renewal` or `subscribe`; a publish never calls it. U3's table holds unchanged: `503`, or a
connection failure (before or after writing), is retried, a renewal only while `is_usable()`;
a TLS failure, `429`, any other `4xx` and `500` never are. `Retry-After` first, else
`min(B_cap, B_init × B_factor^(n−1))`, no jitter; stop at `R_max` attempts or when the next wait
would pass `W_max`, raising the last error. Waits are `asyncio.sleep` on the loop; cancellation
from `close()` ends them at once.

**Tested**: unit tests over the table with a patched clock and sleep; CC-PRB-04 to 06, CC-PRB-08.

## P-02 The Validity Check (NFR-U4-13; CDI-06; carried)

**Mechanism**: `KeeperCore.is_usable()` in `_keeper.py`:
`not self.expired_by_s3 and (self.warned or _clock.wall_now() < self.expires_at)`. Its four callers
are REN-06's bootstrap-first, the `503` renewal retry, PRB-09's renewal retry and the supervisor's
resubscribe. **Nothing else compares `expires_at` with the wall clock**: the clock check (P-05)
fails on any wall-clock read outside `_clock.py`, and `_keeper.py` reads it only through
`is_usable()` and the schedule.

**Tested**: on a skewed lineage, a `503` on renewal is retried and a dropped stream resubscribed,
with no bootstrap.

## P-03 Renewal Scheduling and the Guarded Warning (NFR-U4-16; PH-REN; carried, plus Python's guard)

**Mechanism** (`_keeper.py`): on each credential, `due = max(received_at + R_min, now + (expires_at
− H_renew − wall_now()))` on the monotonic clock; a loop timer (`loop.call_later`) on the core
starts the renewal as a task whose exception is retrieved. A credential already due on arrival,
in a lineage not yet warned, sets `warned` and emits:

```python
def _emit_skew_warning() -> None:
    try:
        warnings.warn_explicit(
            SoormaWarning(MESSAGE),          # code = "SOORMA_CLOCK_SKEW"; no credential in MESSAGE
            SoormaWarning, __file__, _LINE,
            module="soorma", registry={},    # fresh registry: once per lineage under "default"
        )
    except Exception:                        # e.g. SoormaWarning under -W error; never CancelledError
        pass                                 # advisory, never control flow
```

`warned` is set before the emit, so a raised warning cannot repeat it or skip the schedule.

**Tested**: the floor and the target with patched clocks; one warning per lineage; **TC-PH-077**:
the skew path under `warnings.simplefilter("error")` renews at the floor; CC-REN-06, CC-REN-07.

## P-04 The Subscription Supervisor in `asyncio` (C-17; SUB, STR; carried from U3's P-04)

**Structure**: U3's explicit state machine (`opening`, `open`, `replacing`, `backingOff`,
`terminal`, `closed`) in `SubscriptionCore` (`_subscription.py`), driven by U3's events, with:
- **the queue**: an `asyncio` condition over a deque of at most `N_buf` items; `__anext__` awaits it;
- **backpressure**: when the queue is full, the stream's protocol calls `transport.pause_reading()` (P-07); when tenant code pulls it below the mark, `resume_reading()`;
- **`T_idle` and `W_super` count only while a stream is read**: a loop timer armed on resume and on each chunk, cancelled on pause; `W_super`'s elapsed time kept across pauses;
- **a replacement**: the new stream is paused from its opening, its *stream started* held, until the old stream ends or `W_super` expires; then *ended* (old), *started* (new), and the new stream's Deliveries; a lineage change closes the old stream at once;
- **resubscribe** through `is_usable()` (P-02), with P-01's backoff and `L_ends`;
- **ends**: `credential_refused` is terminal and revokes the client (STR-07).

**Tested**: unit tests feeding the core events (a paused stream outliving `T_idle`; a replacement
with a full queue; `close()` in every state); CC-SUB-*, CC-STR-01 to 13.

## P-05 The Clock Seam and Its Check (PH-CLK-01, 02; TS-U4-13)

**Mechanism**: `_clock.py`:

```python
import time

def wall_now() -> float:
    return time.time()          # looked up at each call: a patched time.time is seen

def mono_now() -> float:
    return time.monotonic()
```

Timers are the running loop's (`loop.call_later`, `loop.time()` for monotonic deltas).

**The check** (decided, accepted): `tests/test_clock_binding.py` walks the `ast` of every module
under `python/src/soorma/` and fails on:
- `from time import time` or `time_ns`; `from datetime import datetime` (or `date`) when `now`, `utcnow` or `today` is used through it;
- any attribute reference to `time.time`, `time.time_ns`, `datetime.now`, `datetime.utcnow` or `datetime.today` outside `_clock.py`;
- in `_clock.py`, `time.time` or `time.time_ns` anywhere but as the callee of a call inside a function body (never assigned, aliased, passed, stored, or used as a default argument).

**Tested**: the check runs over the package in the unit job; **TC-PH-078** feeds it each forbidden
form in a scratch module and expects a failure naming the file and line; a runtime test patches
`time.time` and sees `wall_now()` and the keeper's target move, `mono_now()` unmoved.

## P-06 The Trust Store and the TLS Hint (NFR-U4-17; TS-U4-07)

**Mechanism** (`_transport.py`), at `start()`, before any request:
1. `ctx = ssl.create_default_context()`; `ctx.minimum_version = TLSVersion.TLSv1_2`; `check_hostname` and `CERT_REQUIRED` as created.
2. **`empty_store = ctx.cert_store_stats()["x509_ca"] == 0`**, recorded (decided, accepted).
3. If `ca_file` is given: `ctx.load_verify_locations(cafile=ca_file)`; a missing, unreadable or non-PEM file is `TransportError` (`ca-file`, the path), nothing sent.

The context is fixed for the client's life. An `ssl.SSLCertVerificationError` on any request is
`TransportError` (`tls`), never retried; when `empty_store`, its message adds: "this Python found
no CA certificates; if it came from python.org's macOS installer, run its Install Certificates
command, or pass ca_file". The message names no certificate, subject or verify code detail.

**Tested**: a context forced to an empty store gives the hint; a normal one does not; CC-CFG-04;
TC-PH-003, 004.

## P-07 The HTTP Layer: a Protocol over a Sans-IO Parser (NFR-U4-07 to -11; U4-NFR-D-Q1 A)

**The parser** (`_http.py`): `ResponseParser`, a state machine fed bytes, emitting events, with no
I/O and no waiting, so it cannot hang (NFR-U4-11).

| State | Accepts | Bounds and refusals (`TransportError` reasons) |
|---|---|---|
| `status` | `HTTP/1.1 SP 3DIGIT SP reason CRLF` | ≤ 1 KiB; anything else `malformed-response` |
| `headers` | `token ":" OWS value OWS CRLF`, until an empty CRLF line | each line ≤ 8 KiB, ≤ 100 lines, ≤ 64 KiB in all (`response-too-large`); bare LF, obs-fold, a bad name (`malformed-response`) |
| framing decision | exactly one of: `Content-Length` (one decimal value, duplicates equal), `Transfer-Encoding: chunked`, or a `text/event-stream` stream | both, differing lengths, any other coding, a negative or non-decimal length: `malformed-response` |
| `body-length` | bytes up to `Content-Length` | more than `B_body`: `response-too-large`; early end: `truncated-response` |
| `chunk-size` | `HEX [; extensions] CRLF` | line ≤ 1 KiB; extensions ignored; body total ≤ `B_body` |
| `chunk-data` | the chunk's bytes, then CRLF | missing CRLF: `malformed-response` |
| `trailers` | header lines until an empty line | ≤ 16 KiB, ≤ 32 lines; discarded |
| `stream` | SSE lines (LF, CRLF or CR), grouped into events at a blank line | each event ≤ `L_event` (P-08); each line's buffer ≤ 1 MiB |

Every failure carries a reason, **never the bytes**. Events out: `Head(status, headers)`,
`Body(bytes)` for non-stream responses, `Event(kind, data)` and `Comment` for streams, `End`.

**The I/O layer** (`_connection.py`): one `asyncio.Protocol` per connection (decided by
U4-NFR-D-Q1 A), owned by a core (P-10):
- `connection_made` writes the request with `transport.write`, exactly as assembled (FWD-02);
- `data_received` feeds the parser and hands events to the core; nothing is buffered beside the parser;
- `pause_reading()` and `resume_reading()` are SUB-06's backpressure (P-04);
- `transport.abort()` is `close()`'s and the finalizer's synchronous cleanup;
- `T_req` is a loop timer from the write to the head; `connection_lost` with no `End` is a drop.

**Tested** (NFR-U4-07 to -11):
- **table-driven malformed input**: truncated at every boundary; oversized status, header line, head, body, chunk-size line, trailers, event; conflicting framing (both lengths, differing `Content-Length`, unknown coding); bare LF; obs-fold; bad names; each expecting its reason and no bytes in the message;
- **the fuzz test** (TS-U4-06): fixed seeds, `random` bytes and mutations of valid responses (truncation, flips, duplicated and oversized lines), each fed at random split points: every input ends in a complete response or `TransportError`, never another exception, never a buffer beyond the bounds;
- the cases, through the Python driver, against U1's stub.

## P-08 The Event and Body Bounds, in Both Languages (NFR-U4-10, -37, -38; decided, accepted)

**Mechanism, the same in Python and TypeScript**:
- **Per event**: a byte count for the event being read. Each line's bytes are added; past `L_event` the reader enters **discard mode**: it keeps nothing more, frees what it held, and skips input until the blank line that ends the event, then yields `DeliveryError(reason="event-too-large", text="")` and continues with the next event. Memory held for one event never exceeds `L_event` plus one chunk.
- **Per non-stream body**: a byte count while collecting; past `B_body`, the request is aborted and `TransportError` (`response-too-large`) raised, never the bytes.

**In TypeScript** (the U3 defect fix, NFR-U4-38, its own commit in U4's code PR):
- `subscription.ts`: the stream keeps the current event's byte count beside `pending`; `#onData` stops appending in discard mode; `#pump` yields the error item when the blank line arrives;
- `transport.ts`: both body readers (`post` and `readReply`) count bytes and destroy the response past `B_body`;
- `limits.ts` gains `L_event` and `B_body`; unit tests for both.

**In U1** (F42, classed at Code Generation): §0 gains `L_event` and `B_body`; the statement beside
RCV-07; two cases (an oversized event of many `data:` lines under 1 MiB each, then a Delivery; a
Problem body over `B_body`); the stub gains a **generated-body directive** (decided, accepted): a
response or stream item naming a size and a filler, its bytes produced at send time, so no case
file holds a megabyte (class 1, an added capability). The reference driver declares the cases if
it passes them; the self-test's fault sets stay unchanged.

**Tested**: unit tests in both languages; the two cases under both drivers.

## P-09 The Reader and the Payload Walk (PH-RD, PH-PUB; carried from U3's P-09, in Python)

- **The reader** (`_reader.py`): U3's iterative scanner on an explicit list stack, strict JSON (no `NaN`, `Infinity`), member spans and depths; `envelope` parsed within `D_lang`, frozen (`MappingProxyType`, tuples), else `envelope-too-deep`; an envelope failing `json.loads` after the scan, `envelope-unparsed`; `payload` parsed within `D_lang` as plain types, and any parse failure after the scan (the digit limit, `RecursionError`) leaves it unparsed (PH-RD-06); `Delivery.payload` then raises `PayloadNotParsed` (PH-RD-07).
- **The payload walk** (`_json.py`): one iterative pass that checks exact types and writes the compact text (lone surrogates escaped; an `int` past `sys.get_int_max_str_digits()` refused with its path); no recursion, no depth limit.

**Tested**: the contract's delivery fixtures; deep and wide inputs; TC-PH-068 to 070, 073, 079.

## P-10 Handles over Cores, and the Collection Safety Net (PH-LIFE-03; NFR-U4-14; decided, accepted)

**Mechanism**:
- `AgentClient` and `Subscription` are **thin handles**: each holds one reference, to its core (`ClientCore`, `SubscriptionCore`). Every loop callback, timer, task and protocol references **only the core**, never the handle. A handle is therefore collectable as soon as tenant code drops it, even with sockets open.
- On creation, each handle registers `self._finalizer = weakref.finalize(self, _collect, core, "Subscription")`. **`_collect` is a module-level function, and its arguments are the core and a name, never the handle**, so the finalizer cannot keep the handle alive.
- `_collect(core, name)` runs synchronously: if the core's loop is closed, it drops references only; otherwise it calls `transport.abort()` on each open connection, `cancel()` on each timer handle and task, and marks the core closed. It never awaits or schedules a coroutine. Then `warnings.warn(f"unclosed {name}", ResourceWarning, source=None)`, naming the object, holding no credential, host or payload.
- `close()` (and `__aexit__`) calls `self._finalizer.detach()` before closing, so a closed handle never warns.

**Tested**:
- **TC-PH-076** (and the user's collection test): for a started `AgentClient`, and for an open `Subscription` with its stream connected to U1's stub, drop the last reference, run `gc.collect()`, and assert: **a `weakref` to the handle is dead**; the finalizer ran (the stub sees the connection closed; no SDK timer or task remains on the loop); **exactly one `ResourceWarning`** naming it, under `catch_warnings(record=True)`. This fails if the finalizer, a callback or a task holds the handle;
- a closed handle, collected, emits nothing.

## P-11 Resource Release and Task Exceptions (NFR-U4-14, -15; SECURITY-15)

**Mechanism**: the cores own every task they create in a set; each task gets a done callback
that retrieves its exception and routes it (to the next operation, or as an item). `close()`
cancels and awaits them, aborts transports and cancels timers, and is idempotent through one
stored future that concurrent callers await. `asyncio.run()` ending cancels whatever remains.

**Tested**: the package's tests run with warnings as errors and a loop exception handler that
fails the test on any unretrieved exception; TC-PH-054, 071; a child process whose main coroutine
leaves `async with` and returns exits within 1 s.

## P-12 Secret and Credential Hygiene (NFR-U4-18, -19; carried from U3's P-08)

The secret `str` is encoded into the bootstrap body's bytes and every SDK reference to the
`str` and the body is dropped once written, per attempt (SEC-01, SEC-02), so U1's
`sys.getrefcount` check passes. The credential lives only in `KeeperCore`; `__repr__`, `__str__`
and `__reduce__` of every public object omit it (pickling an `AgentClient` or a credential raises
`TypeError`). No warning, `ResourceWarning` or error message holds a secret, credential,
payload or response bytes.

**Tested**: CC-SEC-01, CC-CRD-02; a unit test over every public object's string and pickled forms.

## P-13 The Values Hook, Kept Out (PH-API-06; NFR-U4-22)

`soorma/_internal/test_values.py` sets a module-level slot that `_limits.capture()` reads once,
at core construction. `uv_build`'s `wheel-exclude` and `source-exclude` drop `soorma/_internal/`
from both artifacts; `package-python` asserts its absence and that importing
`soorma._internal.test_values` from the installed wheel fails.

## P-14 The `opentelemetry-api` Floor Run (NFR-U4-26; U4-NFR-D-Q2 A)

`pyproject.toml` declares the package's requirement as the range, plus two dependency groups,
`otel-latest` (the newest release past the cooldown, exact) and `otel-floor` (the floor, exact),
and `[tool.uv] conflicts = [[{ group = "otel-latest" }, { group = "otel-floor" }]]`. One
`uv lock` resolves both, with hashes, in `uv.lock`. CI syncs `uv sync --locked --group
otel-latest` everywhere except the floor entry, which syncs `--group otel-floor`. Nothing is
fetched outside the lock.

## P-15 The CI User Helper (OBL-04; NFR-U4-21; carried from U3's P-10)

`conformance-python` runs `sudo useradd --no-create-home --shell /usr/sbin/nologin soorma-foreign`
and passes `--foreign-user soorma-foreign`; `--local-skip` stays refused in CI. CC-SEC-05 must
show passed, not skipped, on every entry of the code PR's run.

## Security Compliance (this stage)

| Rule | Outcome |
|---|---|
| SECURITY-01 | Compliant: TLS always verified, TLS 1.2 minimum, no switch (P-06) |
| SECURITY-03 | Compliant: no secret, credential, payload or response bytes in any message, warning or `ResourceWarning` (P-07, P-10, P-12); the SDK writes no log. Centralised log service: N/A for the milestone, carried |
| SECURITY-05 | Compliant: every parsed input strict and bounded (P-07 to P-09) |
| SECURITY-10 | Compliant: one lock with both API resolutions (P-14), wheels only, cooldown, `pip-audit`. SBOM: N/A for the milestone, carried |
| SECURITY-11 | Compliant: security-critical logic isolated (`_keeper.py`, `_http.py`); misuse cases in the Functional Design |
| SECURITY-12 | Per clause as NFR Requirements: no hardcoded credentials Compliant; the rest N/A (server-side) |
| SECURITY-13 | Compliant: no unsafe deserialization; strict parsers; generated bodies in the stub only |
| SECURITY-15 | Compliant: fail closed, resources released, task exceptions retrieved, the warning advisory (P-03, P-10, P-11) |
| SECURITY-02, 04, 06 to 09, 14 | N/A: a client library with no endpoint, policy, network configuration or deployment |

## Invariant Compliance (this stage)

I1 compliant (no environment-keyed state); I2 compliant, cumulatively (no check the platform
relies on; the bounds are the SDK's own resource limits, not platform rules); I3 compliant
(nothing from the host; the `ResourceWarning` names the object only); I4 N/A for this unit; I5
compliant (forwarding unchanged); I6 compliant (S3 and S4 only); I7 compliant (unknowns
tolerated; generated types checked); I8 compliant (the values hook excluded, P-13); I9 compliant;
I10 compliant (nothing depends on where the agent runs); I11 N/A by design.
