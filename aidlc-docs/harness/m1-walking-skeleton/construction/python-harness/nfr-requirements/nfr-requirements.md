# NFR Requirements — U4 `python-harness`

**Answers**: U4-NFR-Q1 to Q9, all A; Q2 and Q3 with the user's conditions (audit).
**Shape**: harness, seeded from PF §11 *Harness Surface* and §14 *Harness Surface Register* @
`prd-platform-foundations-v1.3` (Step 1.5), as U3.

**Sources**: the initiative's NFR-01 to NFR-11 (requirements.md §4); U4's Functional Design
(approved, with PH-RD-06, PH-RD-07 and `envelope-unparsed`); U3's NFR requirements where
language-neutral; CDI-06; the security baseline (`local-only`); U1's and U2's repository rules.

**Measured for this stage (2026-11-19)**:
- Python releases: newest stable **3.15.2** (2026-10-25); **3.11.18** (security fixes, end of life 2027-10). The matrix is **3.11 and 3.15**.
- `json.loads` depth: about 9 990 levels on 3.12.3 and 3.13.12 anywhere; on **3.11.12, 994 at the top, 985 in an `asyncio` task, 792 under 200 frames** (the recursion limit minus the caller's stack).
- `ssl.create_default_context()` loads 128 to 186 OS CAs on every local interpreter.

## The Harness Profile, Carried (PF §11, §14)

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U4-01 | **Advisory only.** No SDK check is one the platform relies on; a tenant bypassing the SDK reaches identical enforcement. No server-side property | PF §11; NEV-04 | CC-RCV-08; U2's raw `prove-stack`; the I2 review |
| NFR-U4-02 | **Additive compatibility, as a consumer**: `clientContractVersion` `0.1.0`; unknown fields, enumerated values, Problem codes and `end` codes tolerated; unknown envelope fields preserved and forwarded byte for byte | PF §14; NFR-05; I7 | CC-RCV-03, CC-FWD-02, CC-PRB-01, CC-STR-03 |
| NFR-U4-03 | **The renewal precondition** is the contract's; renewal `H_renew` before expiry, never from a hard-coded lifetime; on a skewed lineage S3 decides validity (REN-07, CDI-06) | PF §14; NFR-02 | CC-REN-01 to 07 |

## Performance on the Request Path

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U4-04 | **No round trip beyond the operation's own**: a publish makes one request; renewal runs on its own timer; a bootstrap precedes an operation only per REN-06, never on a skewed lineage | NFR-01; as NFR-U3-04 | The cases' request counts; TC-PH-007, 032 |
| NFR-U4-05 | **No blocking work beyond the request's own, and none on the event loop that can stall it**: the payload walk, serialization, the delivery-line scan and the HTTP parser are linear in their input with no recursion; `file_secret`'s file I/O runs off the loop. No timing benchmark in M1 | NFR-01; as NFR-U3-05 | Code review; unit tests over large and deep inputs |

## The Named Values (spec §0; U4-NFR-Q1 A)

| Name | Value | Reason |
|---|---|---|
| `H_renew` | **120 s** | As U3 |
| `R_min` | **30 s** | As U3; the end-to-end renewal wait is about 1 minute |
| `R_max` | **5 attempts** | As U3 |
| `W_max` | **60 s** | As U3 |
| `B_init`, `B_factor`, `B_cap` | **0.5 s, 2, 10 s** | As U3 |
| `L_ends` | **5** | As U3 |
| `W_super` | **10 s** | As U3 |
| `N_buf` | **64 items** | As U3 |
| **`D_lang`** | **256 levels** | On 3.11 `json.loads` reaches about 1000 levels minus the caller's stack (792 under 200 frames); 256 leaves room for about 700 frames above the parse. PH-RD-06 catches a `RecursionError` beyond that, as an unparsed payload |
| `T_idle` | **45 s** | As U3: three of the platform's 15-second heartbeats |
| `T_req` | **10 s** | As U3 |
| **`L_event`** | **1 MiB** | **New in spec §0, both languages** (the user, at this stage's approval): the most bytes one SSE event may hold before its terminating blank line; 16 times the contract's 64 KiB Delivery payload bound |
| **`B_body`** | **1 MiB** | **New in spec §0, both languages**: the most bytes a non-stream response body may hold |

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U4-06 | The values are **constants in one module** (`_limits.py`); the driver's `describe` reports them, `R_min` included; a unit test pins the table | Spec §0 | CC-* via `describe`; a unit test |

## The HTTP Response Parser (U4-NFR-Q2, the user's conditions)

The SDK parses untrusted server responses with its own code, so the parser is **strict and
bounded**, and fails closed. Every failure is `TransportError` with a reason; **never the bytes**.

| Id | Requirement | Verification |
|---|---|---|
| NFR-U4-07 | **Strict framing.** The status line is `HTTP/1.1 SP 3DIGIT SP reason CRLF`; each header line is `name ":" OWS value OWS CRLF`, the name a token. **CRLF only** in the head: S3 and S4 (Node's `http` at the tag) write CRLF, so a bare LF is malformed. **No obs-fold**: a line starting with a space or tab is malformed. A malformed status, header or chunk-size line is `TransportError` (`malformed-response`) | Table-driven tests |
| NFR-U4-08 | **Bounds**: status line ≤ **1 KiB**; each header line ≤ **8 KiB**; at most **100** header lines and **64 KiB** for the whole head; a non-stream body ≤ **`B_body`** (1 MiB; the contract's largest is a Problem or a credential, far smaller; its publish body bound is 256 KiB), beyond which `TransportError` (`response-too-large`) as the new statement says; each chunk-size line ≤ **1 KiB**; trailers ≤ **16 KiB** and **32** lines. Beyond any bound: `TransportError` (`response-too-large`) | Table-driven tests |
| NFR-U4-09 | **Framing conflicts refused**: `Content-Length` with `Transfer-Encoding`, two `Content-Length` values that differ, a `Transfer-Encoding` other than exactly `chunked`, a negative or non-decimal length: `TransportError` (`malformed-response`). **Chunk extensions are ignored**; trailers are read, bounded, and discarded. A body ending before its declared length or final chunk is `TransportError` (`truncated-response`) | Table-driven tests |
| NFR-U4-10 | **SSE events are bounded** (the user, at this stage's approval): an event holding more than **`L_event`** bytes before its terminating blank line, however many `data:` lines it has, is discarded up to that blank line, **keeping no more than the bound in memory**, and yielded as a `DeliveryError` (`event-too-large`, no text); the stream continues (the new statement beside RCV-07). The 1 MiB per-line bound stays as the parser's own buffer bound; a line over it is necessarily an event over `L_event` and is reported the same way. SSE line endings are LF, CRLF or CR, as the SSE format allows and S4 writes LF | Unit tests; the new conformance case |
| NFR-U4-11 | **The parser is sans-IO and incremental**: bytes in, events out, with no read or wait of its own, so it cannot hang; the I/O layer's `T_req`, `T_idle` and abort bound the time. **A fuzz test** feeds seeded random bytes, and random mutations of valid responses (truncation, byte flips, duplicated and oversized lines), in random split points, and asserts that every input ends in a complete response or `TransportError`, never another exception and never an unbounded buffer | The fuzz test, in the unit job |

## Reliability

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U4-12 | **One retry policy** for bootstrap, renewal and subscribe: `Retry-After` first, else backoff; at most `R_max` attempts and `W_max` total; a publish never retried, nor `429`, other `4xx`, `500` or a TLS failure | D-11; NFR-04 | CC-PRB-04 to 06, CC-PRB-08, CC-PUB-03 |
| NFR-U4-13 | **One validity check** (CDI-06, PH-REN-02); nowhere else compares `expires_at` with the wall clock | CDI-06; REN-07 | Unit test; the clock check's search |
| NFR-U4-14 | **Every error path releases its resources**; `close()` idempotent and complete; collection of an unclosed object aborts its sockets and cancels its tasks synchronously, with a `ResourceWarning` (PH-LIFE-03) | PRB-07; SECURITY-15 | CC-PRB-07; TC-PH-054, 071, 076 |
| NFR-U4-15 | **No lost task exception**: every task the SDK creates has its exception retrieved; nothing prints "Task exception was never retrieved". A background failure surfaces on the next operation or as an item | SECURITY-15 | Unit tests under warnings as errors and a loop exception handler that fails the test |
| NFR-U4-16 | **The clock-skew warning is advisory**: its emit is guarded, so a `SoormaWarning` raised under the `error` action never changes renewal (PH-REN-04) | REN-07 | TC-PH-077 |

## Security

| Id | Requirement | Source | Verification |
|---|---|---|---|
| NFR-U4-17 | **TLS always verified** (U4-NFR-Q3 A): `ssl.create_default_context()` (the OS store through OpenSSL's defaults, hostname checking, TLS 1.2 minimum) plus the CA file when given; no option turns verification off. **A certificate-verification failure** is `TransportError` (`tls`) whose message hints, when the default context loaded **no** CA certificates, that a python.org macOS install needs its *Install Certificates* command run, or `ca_file` supplied. The message holds no certificate detail | CFG-04; the user's condition | CC-CFG-04; TC-PH-003, 004; a unit test with an empty store |
| NFR-U4-18 | **No secret, credential or payload** in any message, `str`, `repr`, pickled form, warning or `ResourceWarning`. The SDK writes no log | NFR-06; SECURITY-03; CRD-04 | CC-CRD-02; TC-PH-021 |
| NFR-U4-19 | **The secret is not retained**: U1's Python check (`sys.getrefcount`) | SEC-02; CDI-02 | CC-SEC-01 |
| NFR-U4-20 | **REN-07 bounds both floods**: renewals at most one per `R_min`; no bootstrap before operations on a warned lineage | REN-07; SECURITY-11 | CC-REN-06, CC-REN-07 |
| NFR-U4-21 | **The Python conformance job runs CC-SEC-05**: CI creates the second local user and passes `--foreign-user`; `--local-skip` refused in CI | OBL-04 | `conformance-python`'s report: CC-SEC-05 passed on every entry |
| NFR-U4-22 | **The values hook never ships** (PH-API-06): `soorma/_internal/` excluded from the wheel and the sdist | I8 | `package-python` |

## Supply Chain (U4-NFR-Q4, Q6, Q9)

| Id | Requirement | Verification |
|---|---|---|
| NFR-U4-23 | **One runtime dependency**: `opentelemetry-api`, a range `>= floor, < 2`, the floor the oldest 1.x with what the SDK uses and wheels for 3.11 (picked at Code Generation and recorded). Nothing else at run time: `asyncio`, `ssl`, `json`, `os`, `uuid` are the standard library | `pyproject.toml`; the lock |
| NFR-U4-24 | **The lock**: `python/uv.lock` committed with hashes; `uv sync --locked` everywhere; the **7-day cooldown** through `exclude-newer`; **wheels only** for dependencies (no third-party build code at install); `uv` itself at an exact version, pinned in CI | `uv sync --locked` in CI |
| NFR-U4-25 | **Vulnerability scanning**: `pip-audit` over the lock's exported requirements, moderate and above failing, exceptions by advisory id only in `tools/audit-exceptions/`, expiring as the JavaScript ones do; Dependabot's `uv` ecosystem for `python/`, into `dev`, with the cooldown | The `unit` job; `dependabot.yml` |
| NFR-U4-26 | **Tested at both ends of the API range**: the lock's newest release past the cooldown, and once at the floor, from the lock as U3's 1.9.0 run | `conformance-python`'s floor entry |

## The Distribution (TC-PH-058, TC-PH-065)

| Id | Requirement | Verification |
|---|---|---|
| NFR-U4-27 | **`python/`, a `uv` project with a `src/` layout**, `requires-python = ">=3.11"`, built by `uv_build` at an exact version into a wheel and an sdist holding `soorma/` with `py.typed`, the README and the licence files, and **not `soorma/_internal/`** | `package-python` |
| NFR-U4-28 | **The generated types (C-10)**: `python/scripts/generate.ts` writes `python/src/soorma/_generated/` (`TypedDict` modules, agent side only, every envelope member optional, no S1 or S2 type); committed; checked by U1's generated-types check with the package added to `tools/generated-types/packages.json` | `pnpm checks` |
| NFR-U4-29 | **The packaging guard** lists `python/`: nothing from `conformance/`, `tools/` or `e2e/` in the distribution, and it runs over the built wheel's and sdist's file lists | `pnpm checks`; `package-python` |
| NFR-U4-30 | **`package-python` proves the distribution outside the repository**: the wheel installed **offline** into a fresh virtual environment, the API's wheel from the lock; the package imported and an `AgentClient` constructed (contacting nothing); a deep import of the hook refused; the example's agent file copied in, type-checked with `mypy` and imported | The job |

## Testing and CI (U4-NFR-Q5, Q8)

| Id | Requirement | Verification |
|---|---|---|
| NFR-U4-31 | **`conformance-python`**: 3.11 and 3.15 with the locked API, plus 3.11 at the API's floor; every case (95); the second user (NFR-U4-21); within U1's suite budget per run; a failing case judged under CDI-05 | The job; TC-PH-059 |
| NFR-U4-32 | **`e2e-python`** on 3.11: `core-up`, `setup`, `prove-stack`, the package installed from its wheel, the scenario, `core-down` (`if: always()`, the log search). Its own stack. **Its time is measured on U4's code PR; over 8 minutes reopens this stage** (AD-13) | The code PR's run |
| NFR-U4-33 | **The `unit` job** gains, on 3.11: the package's tests (`pytest`, `pytest-asyncio`, warnings as errors), the parser's table-driven and fuzz tests, the clock check (PH-CLK-02), `ruff` (lint and format, banning `os.environ`, `os.getenv` and the host functions in the package), `mypy --strict`, and `pip-audit` | The job |
| NFR-U4-36 | **The `checks` job gains Python 3.11 and the locked environment**, so the names check can run the Python driver's `names` and `surface` (`tools/names/drivers.json` gains it) | `pnpm checks` |
| NFR-U4-34 | Every job keeps U1's workflow rules (SHA pins, `ubuntu-24.04`, `contents: read`); `e2e-python` references no secret and uploads nothing from `.e2e/` | `pnpm checks` |

## The Specification Change and the U3 Fix This Stage Brings (F42)

| Id | Requirement | Verification |
|---|---|---|
| NFR-U4-37 | **Language-neutral bounds** (the user, at this stage's approval), F42 items made in U4's Code Generation, each classed there:<br>- `spec/behaviour.md` §0 gains **`L_event`** and **`B_body`** (1 MiB each);<br>- **a statement beside RCV-07**: an event over `L_event` is discarded up to its terminating blank line, keeping no more than the bound in memory, and yields a delivery error (`event-too-large`, no text), and the stream continues; a non-stream body over `B_body` is `TransportError` (`response-too-large`), never the bytes;<br>- **two cases**: the stub sends one oversized event (many `data:` lines, each under 1 MiB) and then a normal Delivery, expecting the error, then the Delivery, with the stream still open; and a Problem body over `B_body`, expecting the transport error;<br>- **the stub**, if needed, gains a way to generate a large body without the case file holding it (a change to U1's stub);<br>- the reference driver declares the new cases **if it already passes them**; the self-test's fault sets unchanged | The self-test; both drivers on the new cases |
| NFR-U4-38 | **The TypeScript defect fix** (merged U3 code): `typescript/src/subscription.ts` bounds each event at `L_event` (today it appends to `pending` until a blank line, and the queue-full pause never fires because no item completes); `typescript/src/transport.ts` bounds both non-stream body readers at `B_body`. Unit tests for both. **Made inside U4's code PR, in its own commit**, listed in U4's code summary under changes to earlier units; the TypeScript driver passes the new cases | Unit tests; `conformance-typescript` on the new cases |

## Usability

| Id | Requirement | Verification |
|---|---|---|
| NFR-U4-35 | **The package README** documents: the client, configuration and errors (`PayloadNotParsed` and `SoormaWarning` included); `async with` as the closing idiom; `file_secret`'s file settings (Kubernetes `defaultMode: 0440` with `fsGroup`; Docker `0400` or `0440`) and Windows tenants' own provider; **python.org's macOS installer starting with no CA certificates until *Install Certificates* is run, every public TLS connection failing until then** (the user's condition); delivery live only; the unstable span shape with DEC-U1-01's deviation; REN-07's warning and fixing the clock; that the SDK never changes the process's integer digit limit; Python 3.11 or later and `asyncio` | Review at Code Generation; TC-PH-066 |

## Security Compliance, Per Clause (SECURITY-12)

As U3's: password policy, credential storage, MFA, session management and brute-force protection
are **N/A** (server-side; S3 bounds bootstrap attempts, the SDK retries no `429` or `403`, and
REN-07 bounds its renewals and bootstraps). **No hardcoded credentials: Compliant**: secrets only
through a provider; the example names a secret file, never a secret; the package reads no
environment variable (a `ruff` ban); fixtures use generated or fake values.

## NFR Design: Runs for U4

**It runs.** U4 has patterns the requirements fix but do not yet shape in Python:
- **the strict, bounded, sans-IO HTTP response parser** and its I/O layer (NFR-U4-07 to -11);
- **the subscription supervisor in `asyncio`**: `pause_reading` for backpressure, the replacement held paused, `T_idle` and `W_super` counted only while reading;
- **the clock seam** and its import-binding check (PH-CLK);
- **the collection finalizer**, synchronous, and its `ResourceWarning` (PH-LIFE-03);
- **the guarded warning** (PH-REN-04);
- **the single retry policy and validity check** across their callers;
- **the trust store and the TLS failure's hint** (NFR-U4-17);
- **the distribution's exclusion of the values hook**, and the floor run from the lock.
