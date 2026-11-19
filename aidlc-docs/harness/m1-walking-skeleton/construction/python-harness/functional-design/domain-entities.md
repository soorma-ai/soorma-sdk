# Domain Entities — U4 `python-harness`

U4 is the Python harness: the package `soorma`, its conformance driver, and the example with the
end-to-end test. Its behaviour is U1's specification (`spec/behaviour.md`, 104 statements with
REN-07, cited by id). Its public names are U1's name table (`spec/names.md`, Python column).
This file gives their Python shapes and the modules behind them. Answers: U4-FD-Q1 to Q8
(audit). Technology choices (the HTTP and TLS mechanism, the build backend, the OpenTelemetry API
range, the test framework, the named values with `D_lang`) are NFR Requirements'.

## 1. Locations

| Entity | Path | Published |
|---|---|---|
| **The package** `soorma` (C-10 to C-20) | `python/src/soorma/` (generated types in `python/src/soorma/_generated/`) | Yes, at a later milestone; built and checked as a distribution in M1. The packaging guard checks it (I8) |
| **The conformance driver** (C-21) | `python/conformance_driver/` | No: test code using `soorma`'s public interface only, outside the distribution |
| **The example** (C-22) | `python/examples/two_agents/` (`agent_a.py`, `agent_b.py`, `README.md`) | No |
| **The end-to-end test** (C-22, FR-19) | `python/e2e/` | No: run by the `e2e-python` job |
| **The values hook** (the driver protocol's timing hook) | `python/src/soorma/_internal/test_values.py` in the source tree | **No**: excluded from the built distribution, as `dist/internal` is from `@soorma/sdk` (PH-API-06) |

## 2. The Public Surface (the name table, Python column)

Every exported name is a row of `spec/names.md` and nothing else (NAM-01), listed in
`soorma.__all__`. Read-only members are properties or frozen dataclass fields. Dunder methods are
protocol members, not table rows.

### 2.1 Functions

| Name | Shape | Statements |
|---|---|---|
| `new_instance_id` | `() -> str`: a random UUID v4 (`uuid.uuid4()`), reading nothing about the host | CFG-06 |
| `file_secret` | `(path: str) -> SecretProvider`: each call of the returned provider opens, checks and reads afresh, off the event loop; refused on Windows (U4-FD-Q4) | SEC-03 to SEC-09 |

### 2.2 Classes and types

| Name | Python shape | Statements |
|---|---|---|
| `SecretProvider` | `Callable[[], Awaitable[str] \| str]`: a function returning the secret, or a coroutine function; the SDK awaits an awaitable result | SEC-01 |
| `AgentClientOptions` | frozen, keyword-only dataclass: `data_gateway_url: str`, `event_ingest_url: str`, `ca_file: str \| None = None`, `agent: str`, `instance: str`, `secret: SecretProvider`. No environment, no TLS switch, no logger, no human or delegation credential. An unknown keyword is a `TypeError` | CFG-01, CFG-02, CFG-04, CRD-05, NEV-01, NEV-03 |
| `AgentClient` | class (U4-FD-Q1): `AgentClient(options)` (contacts nothing); `async start()`; `async close()`; `async __aenter__()` (returns the client, **does not start it**); `async __aexit__()` (closes); property `credential -> CredentialInfo`; `async publish(payload) -> PublishAccepted`; `subscribe() -> Subscription`. Bound to the event loop it was started on | CFG-01, ACQ, CRD-03, PUB, SUB-01 |
| `CredentialInfo` | frozen dataclass: `agent: str`, `instance: str`, `environment: EnvironmentRef`, `expires_at: str`, exactly as returned; **no credential string** in any field, `repr` or `str` | CRD-03, CRD-04, CDI-01 |
| `EnvironmentRef` | frozen dataclass: `organization: str`, `project: str`, `environment: str` | CRD-03 |
| `PublishAccepted` | frozen dataclass: `trace_context: TraceContext` | PUB-02 |
| `TraceContext` | frozen dataclass: `traceparent: str`, `tracestate: str \| None` | DRF-02 |
| `Subscription` | class (U4-FD-Q2): async iterator (`__aiter__`, `__anext__`) of `SubscriptionItem`; async context manager (`__aexit__` closes); `async close()`; a finalizer that, if the subscription is collected unclosed, aborts its socket and cancels its timers synchronously and emits a `ResourceWarning` | SUB-01, SUB-07, PRB-07 |
| `SubscriptionItem` | `Delivery \| DeliveryError \| StreamStarted \| StreamEnded`, told apart **by class** (the name table's Python cell for the item kind: "the class") | STR-01, STR-02, RCV-07 |
| `Delivery` | class: `envelope: Envelope` (read only); `envelope_text: str`; `seal: str`; `payload: JsonValue` (absent beyond `D_lang`: the attribute raises `AttributeError`; check `payload_parsed`); `payload_text: str`; `payload_parsed: bool`; `async publish(payload) -> PublishAccepted` (forwards) | RCV-02, RCV-05, RCV-06, FWD-01 |
| `DeliveryError` | frozen dataclass: `reason: str`, `text: str` | RCV-07 |
| `StreamStarted` | frozen dataclass, no fields | STR-01 |
| `StreamEnded` | frozen dataclass: `code: str \| None`, `terminal: bool` | STR-02, STR-03, STR-07 |
| `Envelope` | **a `TypedDict`, `total=False`** (U4-FD-Q5; CDI-04): the contract's members with the wire names (`envelopeVersion`, `eventId`, …, `traceContext`), each optional with the contract's type, generated from `envelope.schema.json` (C-10). At run time the value is **deeply read only**: objects as `types.MappingProxyType`, arrays as tuples; unknown members kept. Documented as the platform sent it, unchecked | RCV-02, RCV-03, RCV-08, DEC-U1-09 |
| `JsonValue` | `None \| bool \| int \| float \| str \| list[JsonValue] \| dict[str, JsonValue]` for payloads (plain types, U4-FD-Q5) | PUB-04, RCV-05 |
| `SoormaError` | `Exception` subclass, base of the four below; **no secret, credential or payload in its message, `str` or `repr`** | CRD-04 |
| `ProblemError` | `status: int`; `code: str \| None`; `title: str \| None`; `detail: str \| None`; `retry_after: float \| None` (seconds); `problem: Mapping[str, JsonValue] \| None` (the whole Problem, unknown members kept) | PRB-01 to PRB-03, DEC-U1-14 |
| `TransportError` | `reason: str`: `tls`, `connection`, `timeout`, `unusable-response`, `ca-file`, an open set; no response body | CFG-04, ACQ-08, PRB-08 to PRB-10 |
| `SecretSourceError` | `reason: str` (`not-regular-file`, `owned-by-another-user`, `readable-by-others`, `writable-by-group`, `writable-by-others`, `unreadable`, `unsupported-platform`, `provider-failed`); `path: str \| None` | SEC-05, SEC-08, SEC-09 |
| `ClientStateError` | `state: str` (`created`, `starting`, `closed`, `revoked`, `subscribed`); `problem: ProblemError \| None` when revoked | ACQ-07, REN-05, SUB-04 |
| `SoormaWarning` | **new name-table row, Python only** (U4-FD-Q7, approved as a change to U1's spec): `UserWarning` subclass with `code: str` (`"SOORMA_CLOCK_SKEW"`); the category tenant code filters on | REN-07 |

**Not exported**: no draft builder, transport, keeper, clock or reader; no S1 or S2 type; the
values hook.

## 3. Internal Modules (C-10 to C-20 in Python)

| Module | Component | Holds | Never |
|---|---|---|---|
| `_generated/` | C-10 | Agent-side types from the vendored contract (S3, S4, components, envelope, delivery), every envelope member optional | An S1 or S2 type |
| `_client.py` | C-11 | `AgentClient`: the states (created → starting → started → revoked or closed); orchestration; the loop it belongs to | An environment setting |
| `_options.py` | C-12 | `AgentClientOptions`; type checks; `new_instance_id` | Reading the host or the environment |
| `_secrets.py` | C-13 | `file_secret`: a non-blocking open, the handle checks, the read, the strip | Keeping a value between calls |
| `_keeper.py` | C-14 | **The one security-critical module** (SECURITY-11): the credential, opaque, in memory; bootstrap (provider once per attempt); the renewal schedule (wall-clock target, monotonic floor); lineage; **the one validity check** (CDI-06); revocation; the clock-skew warning, guarded (U4-FD-Q7) | The secret after the request is written; the credential in any string form |
| `_transport.py` | C-15 | HTTPS to the configured S3 and S4 only; TLS always verified (system store plus the CA); the contract version header; compact JSON with the forwarded envelope spliced byte for byte; Problem parsing; the retry policy; `T_req` | A retried publish; a body in an error |
| `_retry.py` | C-15 | Backoff with `Retry-After`, within `R_max` and `W_max` | — |
| `_clock.py` | P-05's seam | `wall_now()` calls `time.time()` **at each read**; `mono_now()` calls `time.monotonic()`; timer helpers on the running loop (U4-FD-Q8) | A wall-clock function bound at import |
| `_limits.py` | — | The named values (NFR Requirements), and capture of the values hook's slot at client construction | — |
| `_draft.py` | C-16 | The only maker of drafts: `clientContractVersion`, `traceContext`, `inbound` when forwarding | A platform-stamped field |
| `_json.py` | (C-16, C-18) | The payload check and the iterative serializer (U4-FD-Q6) | Changing a value |
| `_subscription.py` | C-17 | `Subscription`: the pull buffer (`N_buf`), stream supervision (P-04 as U3's), replacement, boundaries, ends, backoff, `L_ends`, `W_super`, `T_idle`; the finalizer | `Last-Event-ID`; any continuity claim |
| `_reader.py` | C-18 | The iterative delivery-line scanner (U4-FD-Q3); `Delivery`, `DeliveryError`; deep freezing of the envelope | Schema validation; recursion |
| `_tracing.py` | C-19 | Send and receive spans through `opentelemetry-api` only (SPN-01 to SPN-07; DEC-U1-01) | An exporter, sampler or provider |
| `_errors.py` | C-20 | The five error classes, and `SoormaWarning` | A secret, credential or payload in a message |
| `__init__.py` | — | `__all__`: exactly the name table's Python column | Any other public name |

## 4. The Client's States

```text
created --start()--> starting --200--> started --renewal ok--> started
   |                    |                 |  \--credential_refused (renewal or stream end)--> revoked
   |                    +--failure--------+--> created (start() may be called again: ACQ-06)
   |                                      |
   +--close()--> closed <-----close()-----+
```

Text alternative: as U3's. A new client is *created* and contacts nothing. `start()` moves it to
*starting*: a failure returns it to *created* (ACQ-06), success makes it *started*. Renewals keep
it *started*. `credential_refused`, on a renewal or as a stream's end, makes it *revoked* (REN-05,
STR-07): terminal, every later operation raising `ClientStateError` with the Problem. `close()`
from any state makes it *closed*. `async with` closes on exit but does not start.

## 5. The Credential Lineage (REN-01 to REN-07; CDI-06)

| Field (in memory only, `_keeper.py`) | Meaning |
|---|---|
| credential | the opaque token, presented as `Authorization: Bearer` (CRD-01, CRD-02) |
| details | `agent`, `instance`, `environment`, `expires_at`, as returned (CRD-03) |
| lineage | incremented by each bootstrap; the clock-skew warning is once per lineage (REN-07) |
| warned | set when the lineage's warning fires; from then on the lineage's expiry is judged by S3 (`401 credential_expired`), never by the wall clock |
| expired by S3 | set by a `credential_expired` answer |
| received at | `mono_now()` at the response that delivered the credential |
| renewal timer | a loop timer at `max(received at + R_min, now + (expires_at − H_renew − wall_now()))` |
| `is_usable()` | **the one validity check** (CDI-06): `not expired by S3 and (warned or wall_now() < expires_at)` |

## 6. Example and End-to-End Test (C-22)

| Entity | Shape |
|---|---|
| **An agent file** (`agent_a.py`, `agent_b.py`) | One marked configuration block with the local stack's values as literals (S3 `https://localhost:8444`, S4 `https://localhost:8446`, the CA path, `agent`, `file_secret('.e2e/secrets/agent-a.secret')`, `new_instance_id()`); `async def run(config)`; run directly (`if __name__ == "__main__"`), `asyncio.run(run(config))` |
| **The end-to-end test** | Reads `.e2e/stack.json`; two clients in one process from its values; one test-installed in-memory OpenTelemetry exporter; a decoy span around B's subscription; `time.time` patched 14 minutes ahead (U4-FD-Q8) |

## 7. Changes U4 Brings to U1 (F42)

| Item | Kind | Where |
|---|---|---|
| **`SoormaWarning` row** | Name table: `\| warning category \| — \| \`SoormaWarning\` \|`, the TypeScript cell without a backticked name (approved by the user with U4-FD-Q7, like `state`) | `spec/names.md` |
| Python idioms in the names check | The Python driver reports public names only (no leading underscore), so dunders never reach the check; `IDIOMS` already lists the async dunders | `tools/names/drivers.json` gains the Python driver |
| Any case found wrong when first run under Python | Judged under CDI-05; never edited quietly; class 3 stops for the user | — |
