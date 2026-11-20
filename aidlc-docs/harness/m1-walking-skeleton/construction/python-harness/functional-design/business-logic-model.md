# Business Logic Model — U4 `python-harness`

The flows of the Python harness, step by step. The behaviour is U1's specification (statements
cited by id), the same that judged U3. This file shows how the Python modules (domain-entities
§3) carry it, with the rules of `business-rules.md` (`PH-…`). Answers: U4-FD-Q1 to Q8. Where a
flow is the same as U3's, it says so and gives only what differs in Python.

## 1. One Agent's Life

```text
AgentClient(options) --await start()--> bootstrap --> [renewal task] --await close()--> closed
                                             |               |
                                             |               +--> credential_refused --> revoked
                                             v
                       await publish() / await delivery.publish() / subscribe()
```

Text alternative: the client is created without contacting anything. `await client.start()`
bootstraps. A renewal timer on the running loop then keeps the credential fresh until
`await client.close()` (or leaving `async with`), or until `credential_refused` makes the client
revoked. While started, tenant code publishes, forwards through a Delivery, and subscribes, one
subscription at a time.

```python
async with AgentClient(options) as client:
    await client.start()
    async with client.subscribe() as subscription:
        async for item in subscription:
            if isinstance(item, Delivery):
                await item.publish({"seen": True})
```

## 2. `start()`: Bootstrap (ACQ-01 to ACQ-09; SEC-01, SEC-02; PH-SEC-04)

As U3's §2, with SEC-01 per attempt:

| Step | Action | On failure |
|---|---|---|
| 1 | State must be *created*, else `ClientStateError` (ACQ-07); state *starting*; the CA file read and the TLS context built (system store plus the CA) | `TransportError` (`ca-file`), nothing sent; back to *created* |
| 2 | **Per attempt**: call the provider (awaiting an awaitable result); a raise or a non-`str` gives `SecretSourceError` (`provider-failed`, not chained) | Back to *created*; nothing sent (SEC-08) |
| 3 | Encode `{"agent":…,"secret":…,"instance":…}` to bytes; drop the `str` and the body once written | — |
| 4 | `POST {S3}/agent-credentials` within `T_req`; retried per PRB-05, PRB-08, PRB-09 within `R_max` and `W_max`, **each retry a new provider call** (step 2); no reference to the previous attempt's secret during the wait | `ProblemError` or `TransportError`; back to *created* (ACQ-06) |
| 5 | A `200` that is not a usable `AgentCredential` is `TransportError` (`unusable-response`), holding nothing (ACQ-08) | Back to *created* |
| 6 | Hold the credential and details; `received_at = mono_now()`; new lineage; schedule the renewal (§3) | — |
| 7 | State *started* | — |

## 3. Renewal Scheduling, REN-07, and the Guarded Warning (PH-REN; PH-CLK)

```text
on credential received (bootstrap or renewal):
    target = mono_now() + (expires_at - H_renew - wall_now())   # wall_now() calls time.time() now
    floor  = received_at + R_min                                # monotonic
    if expires_at - H_renew <= wall_now() and not warned:
        warned = True                                           # S3 judges this lineage's expiry from now on
        try:
            warnings.warn_explicit(SoormaWarning(...), SoormaWarning,
                                   filename, lineno, registry={})  # fresh registry: once per lineage
        except BaseException-not-cancellation:                  # e.g. -W error raises it here
            pass                                                # advisory, never control flow (PH-REN-04)
    loop.call_later(max(target, floor) - mono_now(), renew)

is_usable():                                                    # CDI-06: the one validity check
    return not expired_by_s3 and (warned or wall_now() < expires_at)

before each operation:  if not is_usable(): bootstrap first     # REN-06, limited by REN-07
```

Text alternative: as U3's. The renewal is due at `expires_at − H_renew` by the wall clock, never
sooner than `R_min` after the credential arrived by the monotonic clock. A credential already
due on arrival means the client's clock is ahead: the SDK warns once in that lineage, renews at
the floor, and leaves that lineage's expiry to S3. **In Python the warning can raise**: under
the `error` filter action, `warn_explicit` raises `SoormaWarning` in the renewal task. The SDK
catches it (and any other exception from the emit, but never `asyncio.CancelledError`), and the
schedule continues exactly as without it.

**Renew**, as U3's §3: `POST {S3}/agent-credentials/current/renewal` with the bearer; a later
expiry replaces the credential, announces it to the subscription and reschedules; no later
expiry bootstraps a new lineage (REN-03); `credential_expired` bootstraps (REN-04);
`credential_refused`, a retried one included (GAP-CAC-001), revokes (REN-05); `503` or a
connection failure is retried while `is_usable()` (PRB-05, PRB-08, PRB-09). Each renewal runs as
a task whose exception is always retrieved.

## 4. Publishing and Forwarding (PUB, FWD, DRF, TRC; PH-PUB)

As U3's §4. Python's steps:
1. *started*, else `ClientStateError`; bootstrap first if not `is_usable()`.
2. **The payload check and serialization in one iterative walk** (PH-PUB-01): exact types only, the path on refusal, no depth limit; the text equals `json.dumps(..., ensure_ascii=False, separators=(",", ":"), allow_nan=False)`, lone surrogates escaped.
3. The send span: the active context as parent for `client.publish`; the received context for `delivery.publish`, linking the active span when it differs (PH-SPN-03).
4. The draft; when forwarding, `inbound.envelope` is `envelope_text` spliced byte for byte.
5. `POST {S4}/events`; `202` gives `PublishAccepted`; anything else `ProblemError` or `TransportError`; **never retried**; the span ends with an error status and the Problem code.

## 5. Reading a Delivery: the Iterative Scanner (PH-RD; U4-FD-Q3)

```text
scan(line):                                       # explicit stack, no recursion, strict JSON
  expect '{'; for each member:
      name = a JSON string; expect ':'
      start = pos; walk the value with a stack of open containers; track max depth
      record (name, line[start:pos], depth); expect ',' or '}'
  expect end of line
  require exactly one envelope (object), seal (string), payload (any)
envelope = deep_freeze(json.loads(envelope_text))  # only if depth <= D_lang, else DeliveryError
payload  = json.loads(payload_text) if depth <= D_lang else absent    # a ValueError (digit limit) or
           # RecursionError here also leaves it absent: payload_parsed False (PH-RD-06)
# an envelope that fails json.loads after the scan: DeliveryError envelope-unparsed (PH-RD-03)
```

Text alternative: as U3's reader, written for Python. One pass records each top-level member's
exact text and depth without building a value, so `json.loads` only ever sees text within
`D_lang`, which is set at NFR Requirements well under CPython's recursion limit. The envelope is
deeply frozen (mapping proxies and tuples); the payload is plain JSON types, fresh for each
Delivery. **A payload that passed the scan but still fails to parse** (an integer longer than
the process's digit limit, which `json.loads` refuses since Python 3.11, or `RecursionError`) is
left unparsed exactly as a too-deep one, and reading `payload` then raises `PayloadNotParsed`. The
SDK never changes the process-global digit limit. Anything malformed, including the non-standard tokens `NaN` and `Infinity`, becomes a
`DeliveryError`, and the stream continues.

## 6. Subscribing and Stream Supervision (SUB, STR; P-04 as U3's)

As U3's §6 and its NFR Design P-04, in `asyncio`:
- `subscribe()` raises `ClientStateError` (`subscribed`) while one is active (SUB-04), else returns a `Subscription` at once, **having opened the stream** (`POST {S4}/subscriptions` with `{draft}`), as SUB-01 says, as U3 does, and as CC-STR-13 needs (it waits for the request before its first pull); a failure before any stream opens is raised from `__anext__` (SUB-05). *(Corrected at Code Generation: this line said the first `__anext__` opens the stream; see audit.md, "Code Generation Part 2: G7 (Steps 26 to 28)", 2026-11-20T03:18:11Z.)*
- The stream is read **only as items are pulled**, through a queue of at most `N_buf` items; when it is full the socket's reading is paused (`transport.pause_reading()`), so the platform's buffer fills (SUB-06).
- **`T_idle` and `W_super` count only while the stream is being read** (STR-02, STR-05): pausing stops them, resuming restarts `T_idle`.
- **The replacement stream is held paused from its opening until the old stream ends** or `W_super` expires (STR-05); a lineage change forces the switch.
- `credential_refused` as an end is terminal and revokes (STR-07); other ends resubscribe with backoff, `Retry-After` first, within `L_ends` (STR-03, STR-06), through `is_usable()` (CDI-06).
- No `Last-Event-ID`; at most one stream per lineage outside a replacement (STR-08, STR-09).

**Closing a subscription** (PH-LIFE):

| How it ends | What happens |
|---|---|
| `await subscription.close()`, `await client.close()` | The stream aborted, timers cancelled; a pending or next `__anext__` yields a terminal `StreamEnded(None, True)`, then `StopAsyncIteration` (SUB-07) |
| Leaving `async with client.subscribe() as s:` | `__aexit__` closes, as above, whatever left the block |
| `break` out of a bare `async for` | Nothing at once (Python calls nothing); the stream stays open until a close or collection |
| The `Subscription` collected unclosed | The finalizer, **synchronously**: `transport.abort()`, timers and tasks cancelled, references dropped; no coroutine scheduled; a `ResourceWarning` naming it (PH-LIFE-03) |
| The main coroutine returns | `asyncio.run()` cancels the SDK's tasks; the process exits (PH-LIFE-04) |

## 7. Spans (SPN-01 to SPN-07; DEC-U1-01; PH-SPN)

As U3's §7, through `opentelemetry-api`'s `trace` and `context`:

```text
client.publish:     send span    parent = active context              links: none
delivery.publish:   send span    parent = received context (parsed)   links: active span if valid and != received
yield Delivery:     receive span parent = received context (parsed)   links: none
received unparseable: a root span, linking the active span if any (SPN-03)
draft traceparent:  the send span's context only if it is this hop's own new span, else generated (TRC-04)
```

## 8. Closing (PH-LIFE; PRB-07)

`close()` marks the client *closed*; aborts in-flight requests; closes the subscription (§6);
cancels the renewal timer and tasks; drops the credential. It returns when all are done; a
second or concurrent call awaits the same close. The client's finalizer does the same
synchronously, with a `ResourceWarning`, if the client is collected unclosed.

## 9. The Conformance Driver (C-21; PH-DRV)

- `python/conformance_driver/` reads JSON-line commands and runs each on one event loop, calling `soorma`'s public interface.
- `create` applies the case's `values` through the values hook around construction, then clears it; it maps `dataGatewayUrl`, `eventIngestUrl`, `caFile` to the Python option names.
- `next` keeps one pending `__anext__` across timeouts (as U3's driver).
- `inspect`: `secretRetained` by U1's Python check (`sys.getrefcount`); `providerCalls`; `openResources` from the loop's open transports and pending tasks.
- `warnings` from `warnings.catch_warnings(record=True)`.
- `spans` from a test SDK with an in-memory exporter; `names` and `surface` by introspection of `soorma`.

## 10. The Example and the End-to-End Test (C-22; FR-19; PH-E2E)

**The example**: `python/examples/two_agents/agent_b.py` subscribes (inside `async with`) and
prints each Delivery's envelope and trace id until interrupted; `agent_a.py` publishes
`{"hello": "B"}` and prints the traceparent. Each has its configuration block and
`async def run(config)`. The README names `e2e:core-up` and `e2e:setup`, says start B first (live
only), the span shape is unstable with DEC-U1-01's deviation, `file_secret`'s file settings,
Windows tenants supplying their own provider, and that `async with` closes a subscription.

**The end-to-end test** (`python/e2e/`), after `prove-stack`, as U3's §10:

| Step | Does | Asserts |
|---|---|---|
| 1 | Read `.e2e/stack.json`; install the test's tracer provider and in-memory exporter | — |
| 2 | Patch **only `time.time` and `time.time_ns`**, 14 minutes ahead, advancing; create and start B, then A | Each start gives one `SoormaWarning` (two in all, one per lineage) |
| 3 | Wait for B's renewal | `credential.expires_at` moves once, from the real S3, no sooner than `R_min` after B's start; no second renewal within `R_min` after it; no further warning |
| 4 | Restore the real `time.time` | — |
| 5 | A decoy span; inside it, B's `async with client.subscribe()` and its loop; wait for *stream started* | — |
| 6 | A publishes `{"hello": "B"}` outside the decoy | `PublishAccepted` with a `traceparent` |
| 7 | B receives it | Envelope and seal present; the envelope's `traceparent` equals A's |
| 8 | Read the exporter | B's receive span: A's trace id, parent A's send span; the decoy neither parent nor linked |
| 9 | Close both | No open socket or SDK task remains; no `ResourceWarning` |

**`e2e-python`**: `core-up`, `setup`, `prove-stack`, the package installed from its built
distribution, the scenario, `core-down` (`if: always()`, the log search every run).

## 11. Test Cases Planned for QA Enrichment

The inception cases TC-PH-001 to 066 stand. QA enrichment extends TC-PH-059 (CDI-05's rule;
CC-REN-06, CC-REN-07, CC-ACQ-08, CC-STR-12, CC-STR-13 among the cases), TC-PH-061 (the patched
`time.time`, two warnings, one real renewal) and TC-PH-063 (the decoy), and adds:

| TC | Title | Rules |
|---|---|---|
| TC-PH-067 | `file_secret` is refused on Windows without opening the path | PH-SEC-02; SEC-09 |
| TC-PH-068 | A delivery line with a duplicate `envelope`, `seal` or `payload` is a delivery error | PH-RD-02 |
| TC-PH-069 | Every member of the `Envelope` type is optional, and the envelope is read only | PH-RD-03, PH-RD-05; RCV-08; CDI-04 |
| TC-PH-070 | `publish` refuses a payload JSON cannot carry exactly (an over-long `int` included), naming the path, never the value; a very deep payload is sent | PH-PUB-01 |
| TC-PH-071 | Leaving `async with` closes the subscription; a process whose main coroutine returns exits | PH-LIFE-02, PH-LIFE-04 |
| TC-PH-072 | A client whose clock runs fast renews at most once per `R_min` and warns once per lineage | PH-REN-01, PH-REN-03 |
| TC-PH-073 | An envelope nested deeper than `D_lang` is a delivery error; the stream continues | PH-RD-03 |
| TC-PH-074 | An unknown option, such as a misspelt TLS switch, is refused | PH-API-03 |
| TC-PH-075 | A client more than a lifetime ahead uses the credential until S3 answers `credential_expired`, then bootstraps once | PH-REN-01, PH-REN-02 |
| TC-PH-076 | An unclosed subscription or client, collected, closes its socket synchronously and emits a `ResourceWarning` naming it | PH-LIFE-03 |
| TC-PH-077 | With warnings set to error, the skew path still renews at the floor | PH-REN-04 |
| TC-PH-078 | A module binding `time.time`, `time.time_ns` or `datetime.now` at import fails the clock check | PH-CLK-02 |
| TC-PH-079 | A payload holding a 5000-digit integer, on 3.11 and the newest release: `payload_parsed` is `False`, `payload` raises `PayloadNotParsed`, `payload_text` exact, the envelope and seal intact and forwardable; `sys.get_int_max_str_digits()` unchanged; publishing such an `int` is refused with the path, never the value | PH-RD-06, PH-RD-07, PH-PUB-01 |

## 12. Values Left to NFR Requirements

As U3's §12, set for Python: `H_renew`, `R_min`, `R_max`, `W_max`, `B_init`, `B_factor`, `B_cap`,
`L_ends`, `W_super`, `N_buf`, `T_idle`, `T_req`, and **`D_lang` above all**: CPython's `json`
recursion is bounded by the interpreter's recursion limit (1000 by default), and a payload within
`D_lang` must parse with room to spare on 3.11 and the newest release. Also NFR Requirements': the
HTTP and TLS mechanism, the build and the distribution's contents, the `opentelemetry-api` range,
the Python versions, the test framework, and the CI jobs (the Python conformance job with OBL-04's
second user and `--foreign-user`, `--local-skip` refused; `e2e-python`; the packed-distribution
check).
