# Business Rules — U4 `python-harness`

U4 implements U1's specification (`spec/behaviour.md`, 104 statements, REN-07 included) in
Python. It changes no statement. Its changes to U1 are two Python-only rows in the name table,
`SoormaWarning` (U4-FD-Q7) and `PayloadNotParsed` (the Functional Design approval), both approved. The rules below are what is **Python's**: how each statement is met
in the language, and the choices the specification leaves to each language unit:
- SEC-09 (Windows);
- RCV-08 (the typed envelope);
- the depth bound's mechanism;
- the resource idiom.

Each rule cites the statements it implements. Answers: U4-FD-Q1 to Q8 (audit). **Carried
unchanged from U1 and U3** (the user, at the U3 approval): REN-07 and `R_min`, CDI-06,
SEC-01 per attempt, STR-02 and STR-05, the values hook outside the package, the `state` row,
CDI-01 to CDI-05, the case authors' `T_idle` rule, GAP-CAC-001, GAP-INT-001, GAP-INT-002,
PUB-04's unlimited depth, U3's example and end-to-end answers.

**Verification column**:
- The cases (`CC-…`) run under the Python driver (C-21), on Python 3.11 and the newest release.
- The `TC-PH-…` cases are U4's test specifications: 001 to 066 are from inception; 067 on are
  **planned here** for QA enrichment (business-logic-model §11).
- Unit tests are the package's own test suite.

## 1. The Surface — `PH-API`

| # | Rule | Implements | Verification |
|---|---|---|---|
| PH-API-01 | `soorma` exports **exactly** the name table's Python column, `SoormaWarning` and `PayloadNotParsed` included (domain-entities §2), through `__all__`; every other module is private (a leading underscore) | NAM-01 | CC-NAM-01; the names check; TC-PH-060 |
| PH-API-02 | **`asyncio` only** (U4-FD-Q1). `start`, `publish`, `close` and `Delivery.publish` are coroutines; `subscribe()` returns a `Subscription` at once. A client belongs to the loop `start()` ran on: its tasks and sockets live there, and using it from another loop is unsupported (documented). No synchronous facade | ACQ, PUB, SUB | Unit tests |
| PH-API-03 | `AgentClient(options)` checks only each option's presence and type (`TypeError`), **contacts nothing** and calls no provider. `AgentClientOptions` is a frozen keyword-only dataclass: an unknown keyword (a misspelt TLS switch) is a `TypeError`. It has no environment, TLS switch, logger, human or delegation credential, or platform-stamped field | CFG-01, CFG-02, CFG-04, CRD-05, NEV-01 to NEV-03, ACQ-09 | CC-CFG-01, CC-CFG-02, CC-NEV-01; TC-PH-001, 002, 004, TC-PH-074 |
| PH-API-04 | `client.credential` returns a frozen `CredentialInfo` while *started*; otherwise `ClientStateError`, carrying the Problem when revoked. No attribute, `repr`, `str` or `__reduce__` (pickling) form of the client, its details or any error holds the credential or the secret | CRD-03, CRD-04, ACQ-07, CDI-01 | CC-CRD-01, CC-CRD-02; TC-PH-020, 021 |
| PH-API-05 | The SDK reads **no environment variable** and nothing about the host: no `os.environ`, `os.getenv`, `socket.gethostname`, `platform.node` anywhere in the package (a static check) | CFG-05, CFG-07; I3, I10 | CC-CFG-06; TC-PH-006 |
| PH-API-06 | **The values hook** (the driver protocol's timing hook): `soorma/_internal/test_values.py` sets a slot read once, at client construction. It is not exported, not in the name table, and **excluded from the built distribution**; the packaging check fails if it is present (as `package-typescript` does for `dist/internal`). The example and the end-to-end test never use it | Driver protocol; I8 | The packed-distribution check; TC-PH-058 |

## 2. The Secret Provider — `PH-SEC`

| # | Rule | Implements | Verification |
|---|---|---|---|
| PH-SEC-01 | `file_secret(path)` returns a provider. **Each call**, off the event loop: opens the path with `os.O_RDONLY \| os.O_NONBLOCK` (following symbolic links); `os.fstat` **on the opened descriptor**; refuses, without reading, a descriptor that is not a regular file, is owned by anyone but `os.getuid()` or `0`, or has mode bits `0o004`, `0o020` or `0o002`; reads, decodes UTF-8, removes **one** trailing `\n` or `\r\n`; closes in `finally`; keeps nothing between calls | SEC-04 to SEC-07; CDI-03 | CC-SEC-03 to CC-SEC-07; TC-PH-012 to 015 |
| PH-SEC-02 | **On Windows** (`sys.platform == "win32"`), the provider raises `SecretSourceError` (`unsupported-platform`, the path) **without opening it** (U4-FD-Q4). The README says Windows tenants supply their own provider. The rest of the package is not refused on Windows; M1 tests on Linux and macOS | SEC-09 (defined here for Python) | Unit test with the platform patched; TC-PH-067 |
| PH-SEC-03 | A refusal is `SecretSourceError` with `path` and `reason`, **never the contents**. A tenant provider that raises, or returns something not a `str`, gives `SecretSourceError` (`provider-failed`, no path), **without the provider's exception chained** (`raise … from None`), since it may hold anything. No request is sent | SEC-08; NFR-06 | CC-SEC-04, CC-SEC-08; TC-PH-013 |
| PH-SEC-04 | **SEC-01 per attempt**: the provider is called once per bootstrap attempt, in `_keeper.py` only; a retried bootstrap calls it again. The secret goes straight into the request body's bytes, and every SDK reference to the `str` and to the body is dropped once the request is written, so U1's Python check (CDI-02: `sys.getrefcount` back to its baseline) passes, during a backoff wait too | SEC-01, SEC-02; CDI-02 | CC-SEC-01, CC-ACQ-01, CC-ACQ-08; TC-PH-008 |

## 3. Reading a Delivery — `PH-RD` (U4-FD-Q3)

| # | Rule | Implements | Verification |
|---|---|---|---|
| PH-RD-01 | **An iterative scanner reads each `delivery` event's data once**, with an explicit stack and no recursion. It records each outer member's name, its value's exact text span and its maximum nesting depth, and builds no value. The scan is strict JSON: the tokens `NaN`, `Infinity` and `-Infinity`, which Python's `json` accepts, are refused. Not an object, trailing text, or a missing `envelope` (object), `seal` (string) or `payload` gives a `DeliveryError` with its reason and the line, and the stream continues | RCV-01, RCV-07 | CC-RCV-01, CC-RCV-07; TC-PH-046, 051 |
| PH-RD-02 | **A duplicate `envelope`, `seal` or `payload` member** is a `DeliveryError` (`duplicate-member`); `json.loads` would silently take the last | RCV-07 | Unit test; TC-PH-068 |
| PH-RD-03 | `envelope_text` and `payload_text` are the **exact spans**, never re-serialized. `envelope` is `json.loads(envelope_text)` only when its depth is within `D_lang`, then **deeply read only** (objects as `MappingProxyType`, arrays as tuples), unknown members kept. Deeper, the line is a `DeliveryError` (`envelope-too-deep`), so no envelope can reach `RecursionError`. **An envelope that passed the scanner but still fails to parse** (an integer longer than the process's `sys.get_int_max_str_digits()`, or `RecursionError`) is likewise a `DeliveryError` (`envelope-unparsed`), and the stream continues: an envelope the SDK cannot parse cannot be exposed read only (RCV-02) | RCV-02, RCV-03, RCV-04 | CC-RCV-02 to CC-RCV-04; TC-PH-045, 047, 048, 073 |
| PH-RD-04 | **The payload is parsed only within `D_lang`**, with `json.loads` (integers exact, floats native), as **plain JSON types**, fresh per Delivery (U4-FD-Q5): changing it affects neither `payload_text` nor forwarding. Deeper: `payload` absent, `payload_text` kept, `payload_parsed` `False`, envelope and seal intact and forwardable. `D_lang` is set at NFR Requirements well under the interpreter's recursion limit | RCV-05, RCV-06, FWD-06; D-07; NFR-03 | CC-RCV-05, CC-RCV-06; TC-PH-049, 050 |
| PH-RD-06 | **Any failure to parse a payload that passed the scanner's syntax check is treated as RCV-06** (the user, at the Functional Design approval). Since Python 3.11, `json.loads` raises `ValueError` on an integer longer than `sys.get_int_max_str_digits()` (4300 by default), and a payload within `D_lang` may still meet `RecursionError`. Either way: the payload is left unparsed, `payload_parsed` is `False`, `payload_text` is kept, and the envelope and seal are intact and forwardable. **The SDK never calls `sys.set_int_max_str_digits`**: the limit is process-global and the tenant's | RCV-06 (extended to Python's parse limits); FR-12 | Unit tests; TC-PH-079 (a payload holding a 5000-digit integer, on 3.11 and the newest release) |
| PH-RD-07 | **`Delivery.payload` on an unparsed payload raises `PayloadNotParsed`** (the user, at the Functional Design approval), an exported subclass of `AttributeError`. Its message says the payload was not parsed and to check `payload_parsed` or use `payload_text`, and holds no payload text. `hasattr(delivery, "payload")` stays `False`, as for any absent attribute | RCV-06; NAM-01 | Unit test; TC-PH-079 |
| PH-RD-05 | **The envelope is never schema-validated** (DEC-U1-09). **`Envelope` is a `TypedDict` with every member optional** (`total=False`), documented as sent, unchecked (U4-FD-Q5; CDI-04) | RCV-08; CDI-04 | CC-RCV-08; the type's declaration; TC-PH-069 |

## 4. Publishing and Forwarding — `PH-PUB`

| # | Rule | Implements | Verification |
|---|---|---|---|
| PH-PUB-01 | **A payload JSON cannot carry exactly is refused before any request** (U4-FD-Q6): an iterative walk raises `TypeError` unless every value is **exactly** a `dict` with `str` keys, a `list`, a `str`, an `int`, a finite `float`, a `bool` or `None` (subclasses refused, `bool` aside; tuples, sets, `bytes`, `Decimal`, datetimes, `IntEnum`, non-`str` keys and cycles refused). **An `int` whose decimal form is longer than the process's `sys.get_int_max_str_digits()`** is refused the same way (the user, at the Functional Design approval), since `str()` would raise there too; the limit is read, never changed. The error names the path (`$.a[2].b`) and the kind, **never the value**. **Depth is not limited** (PUB-04; the user's ruling at U3): the serializer is iterative, so no depth can raise `RecursionError`; for every accepted value its text equals `json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)`, except that a lone surrogate in a string is written as its `\uXXXX` escape, so the body is always valid UTF-8 and carries the string exactly | PUB-04; FR-10 | Unit tests (equality with `json.dumps`; payloads 10 000 and 1 000 000 deep sent); TC-PH-070 |
| PH-PUB-02 | The body is assembled as text: `{"draft":…,"payload":…}`, compact, no ASCII or HTML escaping. When forwarding, the received `envelope_text` is **spliced byte for byte** as `inbound.envelope` | PUB-01, PUB-03, FWD-02 | CC-PUB-01, CC-FWD-02; TC-PH-029, 033 |
| PH-PUB-03 | `delivery.publish(payload)` forwards (`inbound: {envelope, seal}`); `client.publish(payload)` never does. A publish is **never retried** | FWD-01, FWD-04, PUB-05, PRB-10 | CC-FWD-01, CC-FWD-06, CC-PUB-03; TC-PH-028, 030, 034 |

## 5. Closing and Lifetime — `PH-LIFE` (U4-FD-Q2)

| # | Rule | Implements | Verification |
|---|---|---|---|
| PH-LIFE-01 | `close()` on the client and on a subscription is **idempotent** and returns once every stream, in-flight request and task is released; concurrent calls await the same close. `__aexit__` calls `close()` on both; `AgentClient.__aenter__` returns the client **unstarted** | SUB-07, PRB-07 | CC-SUB-07, CC-PRB-07; TC-PH-054 |
| PH-LIFE-02 | **`async with client.subscribe() as subscription:` is the closing idiom**: leaving the block, however (`break`, `return`, an exception, cancellation), closes the subscription. The README shows only this form. A bare `async for` works; leaving it early leaves the stream open until `close()`, `client.close()`, or collection (PH-LIFE-03) | SUB-07 | Unit test; TC-PH-071 |
| PH-LIFE-03 | **Collection as a safety net** (the user's addition to U4-FD-Q2): a `Subscription` or `AgentClient` collected without `close()` runs a **synchronous** finalizer. It **aborts its sockets** (`transport.abort()`) and **cancels its timers and tasks** (`cancel()`), and never schedules or awaits a coroutine. If the loop is closed, it only drops references. It then emits a **`ResourceWarning`** naming the unclosed object (`unclosed Subscription …`, `unclosed AgentClient …`), as `asyncio`'s transports do, holding no credential | PRB-07 | Unit test: a dropped, unclosed subscription and client each raise one `ResourceWarning` naming it, their sockets are closed and no task remains, and no coroutine was scheduled; TC-PH-076 |
| PH-LIFE-04 | **No background task keeps a process alive**: `asyncio.run()` ends with the main coroutine and cancels the SDK's tasks (renewal, supervision). Every task the SDK creates has its exception retrieved, so no "Task exception was never retrieved" is printed | PRB-07; SECURITY-15 | Unit test (a child process whose main coroutine leaves an `async with` subscription and returns exits within 1 s); TC-PH-071 |
| PH-LIFE-05 | After `close()`, every operation raises `ClientStateError`. `close()` during `start()` aborts the bootstrap and leaves the client *closed* | ACQ-07 | CC-ACQ-05; unit test |

## 6. Renewal — `PH-REN` (REN-01 to REN-07; CDI-06; U4-FD-Q7)

| # | Rule | Implements | Verification |
|---|---|---|---|
| PH-REN-01 | **REN-07 as U3**: the next renewal is at `max(received_at + R_min, now + (expires_at − H_renew − wall_now()))`; `received_at` and `now` from `mono_now()`; the wall clock only sets the target. A credential already due on arrival warns once per lineage, and from then on S3 judges that lineage's expiry | REN-01, REN-07 | CC-REN-06, CC-REN-07; unit tests with patched clocks; TC-PH-072, 075 |
| PH-REN-02 | **One validity check** (CDI-06): `is_usable()` in `_keeper.py` decides "while the credential is valid" for REN-06's bootstrap-first, the `503` renewal retry, PRB-09's renewal retry and the supervisor's resubscribe. Nothing else compares `expires_at` with the wall clock | REN-06, PRB-09, STR-04; CDI-06 | Unit test: on a skewed lineage, a `503` on renewal is retried and a dropped stream is resubscribed, with no bootstrap |
| PH-REN-03 | **The warning**: `SoormaWarning(message)` with `code = "SOORMA_CLOCK_SKEW"`, emitted by `warnings.warn_explicit` with a **fresh suppression registry**, so the default filter shows each lineage's warning once; tenant filters still apply. The message holds no credential, secret or token detail | REN-07; NFR-06 | CC-REN-06 (the driver reports it); TC-PH-072 |
| PH-REN-04 | **The emit is guarded** (the user's addition to U4-FD-Q7): under the `error` action (`python -W error`, pytest's `filterwarnings = error`) the emit raises `SoormaWarning` inside the renewal task. The SDK catches **any** exception from the emit and carries on: the schedule, the renewal and the lineage are unaffected. **The warning is advisory, never control flow** | REN-07; SECURITY-15 | Unit test: the skew path under `warnings.simplefilter("error")` still renews at the floor; TC-PH-077 |
| PH-REN-05 | **GAP-CAC-001's work-around** (soorma-ai/soorma-core#34): `credential_refused` on a retried renewal is terminal, fail closed | REN-05, PRB-09 | CC-REN-04, CC-PRB-08 |
| PH-REN-06 | REN-02 to REN-06 as stated, limited by REN-07; no status API (DEC-U1-05) | REN-02 to REN-07 | CC-REN-01 to 07; TC-PH-017 to 019 |

## 7. The Clock Seam — `PH-CLK` (U4-FD-Q8)

| # | Rule | Implements | Verification |
|---|---|---|---|
| PH-CLK-01 | **Every time read in the package goes through `_clock.py`**: `wall_now()` returns `time.time()`, **called at each read**; `mono_now()` returns `time.monotonic()`; timers are the running loop's (`loop.call_later`). The ISO `expires_at` is parsed to seconds without reading any clock | REN-01, REN-07; P-05 | Unit test: patching `time.time` shifts `wall_now()` and the keeper's schedule; `time.monotonic` is untouched |
| PH-CLK-02 | **Nothing under the package binds a wall-clock function at import** (the user's addition to U4-FD-Q8). A check parses every module under `python/src/soorma/` and fails on: `from time import time` or `time_ns`; `from datetime import datetime` used for `now`, `utcnow` or `today`; any reference to `time.time`, `time.time_ns`, `datetime.now`, `datetime.utcnow` or `datetime.today` outside `_clock.py`; and in `_clock.py`, `time.time` used other than as an immediate call inside a function body (never stored, aliased or used as a default argument). Otherwise the end-to-end test could pass with the skew never reaching the SDK | REN-07; TH-E2E-04's counterpart | The check itself (in the unit job), with tests feeding it each forbidden form; TC-PH-078 |

## 8. Spans — `PH-SPN` (DEC-U1-01; GAP-INT-002's work-around)

| # | Rule | Implements | Verification |
|---|---|---|---|
| PH-SPN-01 | `opentelemetry-api` is the **only** OpenTelemetry dependency; no SDK, exporter, sampler or provider is installed or configured. Span names `send` and `receive`, OpenTelemetry's messaging conventions, `messaging.system` `soorma` (DEC-U1-11) | SPN-01, SPN-05 | CC-SPN-01, CC-SPN-07; TC-PH-055, 056 |
| PH-SPN-02 | The received `traceparent` is **parsed by the SDK**, not through the global propagator, into a remote `SpanContext`; unparseable is no context | SPN-03; TRC-03 | CC-SPN-05; TC-PH-027 |
| PH-SPN-03 | A receive span and the send span of `delivery.publish()` have **the received context as explicit parent**, never the active context, so a decoy cannot become their parent; neither links the received context. The send span of a forward **links tenant code's active span** when valid and not the received context; **the receive span links nothing** | SPN-03 (DEC-U1-01) | CC-SPN-03, CC-SPN-04; TC-PH-063 |
| PH-SPN-04 | A client `publish` parents its send span on the active context. **Without an OpenTelemetry SDK**, the API returns non-recording spans whose context may be the parent's: the draft's `traceparent` uses a span context only when it is this hop's own (a new span id), else generates one (TRC-04; the defect U3 found under CC-FWD-05) | SPN-04; TRC-01 to TRC-04; DEC-U1-13 | CC-SPN-06, CC-TRC-01, CC-TRC-02, CC-FWD-04, CC-FWD-05; TC-PH-025 to 027 |

## 9. The Conformance Driver — `PH-DRV` (C-21)

| # | Rule | Implements | Verification |
|---|---|---|---|
| PH-DRV-01 | `python/conformance_driver/` speaks the driver protocol and uses **only `soorma`'s public interface**, except where the protocol allows: `describe`'s values, the values hook, `inspect`, `spans`, `env`, `docs`, `warnings`. It maps the protocol's camelCase arguments to Python's names | FR-03; US-14 #2 | The suite; the names check |
| PH-DRV-02 | `inspect`'s `secretRetained` is **U1's Python check** (CDI-02; U1 business-logic-model §4.3): the test provider builds the secret `str` at run time, records `sys.getrefcount` before bootstrap, and reports `found` when it is above the baseline after; `openResources` from the loop's open transports and tasks | CDI-02; SEC-02; PRB-07 | CC-SEC-01, CC-PRB-07 |
| PH-DRV-03 | `names` reports `__all__` and every public member (no leading underscore) of each exported class; `surface` reports `AgentClientOptions`'s fields. Dunders never reach the names check | NAM-01; FR-17 | The names check |
| PH-DRV-04 | `warnings` reports each `SoormaWarning` with code `SOORMA_CLOCK_SKEW` as `clock-skew`, in order, recorded with `warnings.catch_warnings(record=True)` and the `always` action | REN-07 | CC-REN-06 |
| PH-DRV-05 | **Every case is declared**, all 95, on 3.11 and the newest release. A failing case is judged first under **CDI-05** (the SDK, the case under F42, or the specification); a class 3 change stops for the user. The case authors' `T_idle` rule holds for any case added | FR-03; CDI-05 | TC-PH-059 |

## 10. The Example and the End-to-End Test — `PH-E2E` (C-22; FR-19, FR-20)

| # | Rule | Implements | Verification |
|---|---|---|---|
| PH-E2E-01 | **Each agent file has one marked configuration block** with the local stack's values as literals, and `async def run(config)`; run directly, it runs `asyncio.run(run(config))`. Only the public interface; nothing human-side | FR-20; US-11 #3 | TC-PH-064, 065 |
| PH-E2E-02 | **Both agents in the test's one process**: two clients with their own instance identifiers and secret files (`file_secret` on U2's files, from `.e2e/stack.json`), one test-installed in-memory exporter | FR-19 steps 1 to 4 | TC-PH-061 to 063 |
| PH-E2E-03 | **The decoy span**: B's `subscribe()` and its loop run inside a separate active span; B's receive span's parent is A's send span (both equal to the envelope's `traceparent`), and the decoy is neither its parent nor linked from it | SPN-03; DEC-U1-01 | TC-PH-063 |
| PH-E2E-04 | **One real renewal** (U4-FD-Q8): before `start()`, the test patches **only `time.time` and `time.time_ns`**, 14 minutes ahead and advancing with real time; `time.monotonic`, `asyncio`'s timers, sockets and TLS are untouched. It asserts: **two** clock-skew warnings, one per client's lineage, and none at B's renewal; one real renewal from S3 (`expires_at` moves), no sooner than `R_min`; no second within `R_min` after it; the real clock restored before closing. It relies on PH-CLK-02 for the skew to reach the SDK | FR-19 step 2; REN-07 | TC-PH-061 |
| PH-E2E-05 | **`e2e-python`**, on the same steps as `e2e-typescript`: `core-up`, `setup`, `prove-stack` (kept), the Python package installed from its built distribution, the scenario, then `core-down` (`if: always()`, the log search on every run). Its name keeps U1's workflow check (`e2e-*`) | FR-19; JOB-06's counterpart | The job; U1's workflow check |

## 11. Changes to Earlier Units — `PH-F42`

| # | Rule |
|---|---|
| PH-F42-01 | Every change U4 makes to U1's specification, name table, cases, runner, reference driver or protocol, or to U2's or U3's tests, is a **change to an earlier unit's tests (F42)**, listed with its class in the Code Generation plan and recorded in U4's code summary and `audit.md` |
| PH-F42-02 | **Foreseen**: the `SoormaWarning` row in `spec/names.md` (approved by the user with U4-FD-Q7); the `PayloadNotParsed` row (the user, at the Functional Design approval); **`L_event` and `B_body` in spec §0, the statement beside RCV-07, its two cases and any stub capability they need, and the TypeScript defect fix to `subscription.ts` and `transport.ts`** (the user, at the NFR Requirements approval; nfr-requirements NFR-U4-37, -38); `tools/names/drivers.json` gaining the Python driver; the CI jobs for Python (conformance with OBL-04's second user, `e2e-python`, the packed-distribution check), each a configuration change that weakens no existing assertion |
| PH-F42-03 | **Not foreseen**: a case found wrong when first run under Python (CDI-05). It is judged first, never edited quietly; a class 3 change stops for the user |

## Misuse Considered (SECURITY-11)

| Misuse | Rule that stops it |
|---|---|
| A tenant misspells a TLS option to turn verification off | PH-API-03 (an unknown keyword is a `TypeError`) |
| The secret lingers in the process | PH-SEC-04; CC-SEC-01 |
| A world-readable or swapped-in secret file (a FIFO that blocks) | PH-SEC-01 |
| A Windows path whose permissions cannot be checked | PH-SEC-02 |
| A hostile delivery line driving `json` into `RecursionError` | PH-RD-01, PH-RD-03, PH-RD-04 |
| A valid payload with a huge integer costing the Delivery its envelope and seal | PH-RD-06 (never by changing the process-global digit limit) |
| `NaN`, a tuple or an `int` key silently changed on the wire | PH-PUB-01 |
| A fast clock flooding S3 with renewals, or bootstrapping before every operation | PH-REN-01, PH-REN-02 |
| `python -W error` turning the advisory warning into a renewal failure | PH-REN-04 |
| A forgotten `async with` leaving sockets open silently | PH-LIFE-03 (closed on collection, with a `ResourceWarning`) |
| A wall clock bound at import, so a test or a fix to the clock never reaches the SDK | PH-CLK-02 |
| An ambient span hijacking the trace a forwarding hop belongs to | PH-SPN-03 |
| The credential printed by `print(client)` or pickled | PH-API-04 |
| The values hook shipped, letting tenant code shrink the SDK's limits | PH-API-06 |
