# NFR Design Patterns — U3 `typescript-harness`

How each NFR-U3 requirement is built: the mechanism, where it lives, what it guarantees, and how
it is tested. Answers: U3-NFR-D-Q1 A, Q2 A with the user's three changes, Q3 A (audit
2026-11-19T05:13:36Z). Modules are `logical-components.md`'s.

## P-01 The Retry Policy (NFR-U3-07; PRB-05, PRB-06, PRB-08 to PRB-10; D-11)

**Mechanism**: one internal function, `retry(kind, attempt, { signal })`, in `retry.ts`. `kind`
is `bootstrap`, `renewal` or `subscribe`; a publish never calls it.

| Outcome of an attempt | `bootstrap` | `renewal` | `subscribe` |
|---|---|---|---|
| `503` | retry | retry while `isUsable()` (P-02) | retry |
| Connection failure, request not sent (PRB-08) | retry | retry while `isUsable()` | retry |
| Connection failure after writing, or `T_req` expired after writing (PRB-09) | retry; each repeat counts toward `too_many_attempts` | retry while `isUsable()` | retry |
| TLS verification failure | never | never | never |
| `429`, any other `4xx`, `500` | never | never (`credential_expired` and `credential_refused` go to the keeper) | never (the same) |

**Waiting**:
- `Retry-After`, when the response gave one, else backoff: `min(B_cap, B_init × B_factor^(n−1))`, no jitter.
- The policy stops when the next wait would take the total past `W_max`, or at `R_max` attempts, and surfaces the last error.
- Waits use `clock.setTimer`, and `signal` (from `close()`) aborts at once with no further attempt.

**Tested**: unit tests over the table with fake timers; the cases CC-PRB-04 to 06 and CC-PRB-08.

## P-02 The Validity Check (NFR-U3-08; CDI-06; REN-06, REN-07)

**Mechanism**: `keeper.isUsable(): boolean`, the only place validity is decided.
- **On a lineage with the clock-skew warning**: true until S3 has answered `credential_expired` for it.
- **Otherwise**: `clock.wallNow() < expiresAt`.

**Callers, and only these**:
1. REN-06's bootstrap-first, before an operation;
2. REN-06's `503` retry on renewal (P-01);
3. PRB-09's renewal retry (P-01);
4. the supervisor's resubscribe (P-04), which bootstraps first when the credential is not usable.

**Enforced**: a check in the package's test suite searches `typescript/src/` for `expiresAt`
compared with a clock read, and fails if any is found outside `keeper.ts`'s `isUsable`.

**Tested**:
- CDI-06's unit test: on a skewed lineage, a `503` on renewal is retried, and a dropped stream is resubscribed, without a bootstrap.
- CC-REN-05, CC-REN-07.

## P-03 Renewal Scheduling (REN-01 to REN-07; TH-REN)

**Mechanism** (`keeper.ts`), on each credential received:
1. `receivedAt = clock.monoNow()`.
2. `due = max(receivedAt + R_min, clock.monoNow() + (expiresAt − H_renew − clock.wallNow()))`.
3. If the wall-clock target has already passed and the lineage has no warning, emit `SOORMA_CLOCK_SKEW` once and mark the lineage warned (P-02).
4. Then `clock.setTimer(renew, due − monoNow)`, `unref`'d.

A bootstrap starts a new lineage, with the warning cleared.

**Tested**: fake timers with the wall clock moved by `vi.setSystemTime` (P-05). The cases
CC-REN-01 to 07.

## P-04 The Subscription Supervisor (C-17; SUB, STR; DEC-U1-03, -04, -06, -12; U3-NFR-D-Q2)

**Structure**: an explicit state machine with a bounded queue (`subscription.ts`).

| State | Meaning |
|---|---|
| `opening` | `POST /subscriptions` in flight (P-01 retries); no stream yet |
| `open` | One stream, being read as the queue allows |
| `replacing` | A new stream is open alongside the old one, whose end is awaited (STR-04, STR-05) |
| `backingOff` | Between a non-terminal end and the next `opening` (STR-06) |
| `terminal` | A terminal end has been queued; the iterator finishes after it |
| `closed` | `close()`: everything released |

**Events**:
- opened, line read, `end` received, dropped;
- `T_idle` expired, `W_super` expired;
- new credential, same lineage or new lineage (from the keeper);
- backoff elapsed;
- queue drained below its high mark;
- `close()`.

A transition table maps (state, event) to actions; each state's timers are cleared on leaving it.

**Backpressure, and the timers** (the user's changes 1 and 2):
1. **Each stream's reader pushes items into the queue** (at most `N_buf`, held Deliveries
   included). It **pauses its socket when the queue is full** and resumes when tenant code has
   pulled it below the mark. So the SDK reads only as tenant code pulls (SUB-06).
2. **`T_idle` and `W_super` count only while their stream's socket is being read.** A stream
   paused for backpressure cannot time out: the platform's `overflow` end is the signal for a
   consumer too slow for the platform. **A resume restarts `T_idle` from zero.** `W_super`'s
   elapsed time is kept across pauses: it counts only the time the old stream is read.
3. **During a replacement, the new stream is paused as soon as it opens.**
   - Its *stream started* item is held, to be queued after the old stream's *stream ended* (STR-05's order).
   - Its socket stays paused until the old stream has ended (`superseded`, any end, or a drop), or until `W_super` (counted as in 2) expires and the SDK closes the old stream itself.
   - Then the queue receives, in order: *ended* (old), *started* (new), then the new stream's Deliveries, read from then on.
   - The new stream's Deliveries **wait upstream**, in the socket and the platform, not in `N_buf`, so they cannot starve the old stream of buffer room. Deliveries accepted while both streams are open may still arrive on both (DEC-U1-12).
4. **A lineage change** (REN-03, REN-04, REN-06) closes the old stream as soon as the new one
   opens (STR-05), so there is nothing to wait for and the new stream is not paused.

**Specification change** (the user's change 3; language-neutral, so in U1's specification):

| Statement | Added sentence |
|---|---|
| STR-02 | `T_idle` is silence **while the SDK is reading the stream**: a stream paused because tenant code has not pulled items does not time out, and a resume restarts `T_idle` |
| STR-05 | `W_super` likewise counts only while the old stream is being read. The SDK **may pause the new stream from its opening until the old stream ends** or `W_super` expires, so that the new stream's Deliveries wait upstream rather than in the buffer |

**New conformance cases** (U1's suite; the user's change 3):

| Case | Script | Expectations |
|---|---|---|
| **CC-STR-12** | A stream with several Deliveries and heartbeats. The case does not pull for longer than `T_idle` (from `describe`), then pulls | No *stream ended* with `code: null`, no second `POST /subscriptions`, every Delivery received, in order, once pulled. Statements STR-02, SUB-06 |
| **CC-STR-13** | A full buffer (`N_buf` items unpulled) when a renewal opens a replacement. The old stream still has Deliveries, then `superseded`; the new stream has Deliveries of its own | The old stream's remaining Deliveries, then *stream ended* (`superseded`), then *stream started*, then the new stream's Deliveries. No *stream ended* with `code: null` (no `W_super` close). Statements STR-04, STR-05, SUB-06 |

**Both cases take time**: CC-STR-12 waits out `T_idle`, 45 s under the TypeScript driver. Code
Generation checks the suite stays within its 8-minute budget per run (NFR-U1-02), and raises it
with the user if not. These are changes to an earlier unit's tests (F42), with the other
foreseen ones (business-rules TH-F42-02). The reference driver declares them if it can; **the
self-test's fault sets stay unchanged**.

**Tested**:
- unit tests that feed the state machine events, including a paused stream outliving `T_idle`, a replacement with a full queue, and `close()` in every state;
- the cases CC-SUB-*, CC-STR-01 to 13.

## P-05 The Clock Seam (TS-U3-10; U3-NFR-D-Q1 A)

**Mechanism**: `clock.ts` exports `wallNow()` (`Date.now()`), `monoNow()` (`performance.now()`),
and `setTimer(fn, ms, { unref })` and `clearTimer(handle)` (wrapping `setTimeout` and
`clearTimeout`). **Every time read and timer in the package goes through it**; a lint rule
refuses the globals elsewhere in `typescript/src/`. Nothing is injected or exported.

**Tested**:
- **Unit tests**: `vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'] })`, with the two clocks moved apart by `vi.setSystemTime` (a skewed lineage) and `vi.advanceTimersByTime` (both).
- **The end-to-end test**: fakes only `Date` (TH-E2E-04).
- **The cases**: real time against the stub's scripted expiries.

## P-06 The Trust Store and TLS (NFR-U3-11; CFG-04; U3-NFR-D-Q3 A)

**Mechanism**: at `start()`, **before the bootstrap request**, the client reads the CA file (if
any) and builds `ca = system ∪ bundled ∪ the file's certificates`. It is fixed for the client's
life: renewals, publishes and streams use it, and a later change to the file is not picked up.
- A missing, unreadable or non-PEM CA file fails `start()` with `TransportError` (reason `ca-file`, naming the path, never the contents), and nothing is sent.
- `rejectUnauthorized` is always `true`; there is no option to change it.
- The constructor does no I/O (CFG-01).

**Tested**: CC-CFG-04; a unit test for each failing CA file; a unit test that the store includes
the bundled certificates when the system store is empty.

## P-07 Resource Release and No Unhandled Rejection (NFR-U3-09, -10; PRB-07; SECURITY-15)

**Mechanism**:
- One `AbortController` per client, and one per subscription, whose signals reach every request, stream and retry wait.
- `close()`:
  1. aborts;
  2. closes the supervisor (P-04);
  3. clears the renewal timer;
  4. drops the credential;
  5. resolves when every socket has closed.

  A second call returns the same promise.
- Every background promise (renewal, stream reads) has a handler. Its failure is stored and surfaces on the next operation or as an item (DEC-U1-05), never as an unhandled rejection.

**Tested**:
- unit tests check, after `close()` in every client and supervisor state, that no socket or timer is left (`process.getActiveResourcesInfo()`);
- tests run with Node's default `--unhandled-rejections=throw`;
- the case CC-PRB-07.

## P-08 Secret and Credential Hygiene (NFR-U3-12, -13; SEC-02; CRD-01 to CRD-04)

**The secret's path**, all in `keeper.ts`:
1. the provider's string;
2. the request body (a string, then a `Buffer` written to the socket);
3. every reference dropped when the write completes.

No closure, error or retry keeps the secret.

**A retried bootstrap calls the provider once per attempt.** The retry policy (P-01) re-runs the
whole attempt, provider call included, and each attempt drops the secret once its request is
written. So SEC-02 holds between attempts too: the secret is never held through a `Retry-After`
or backoff wait. SEC-01's "exactly once per bootstrap" is read as **once per attempt**, which is
what U1's reference driver does (`conformance/reference-driver/src/client.ts`: the provider call
is inside its retry). The cases count requests on a retried bootstrap, not provider calls
(CC-PRB-04, CC-PRB-08); CC-ACQ-04 and CC-SEC-01 count one call per un-retried bootstrap.

**The credential**: held in one private field of the keeper. `CredentialInfo` is a frozen copy
without it. Every error and the client define `toJSON` and `[util.inspect.custom]` to show
nothing secret.

**Tested**: CC-SEC-01 (the heap), CC-CRD-02; a unit test that inspects and stringifies every
error class and the client.

## P-09 The Delivery Scanner and the Payload Check (NFR-U3-05; TH-RD, TH-PUB)

**Mechanism**: both are **iterative**, with an explicit stack depth counter and no recursion, so
neither can overflow the stack. The scanner records spans and depths only (TH-RD-01).
- **The payload check** walks with an explicit stack and a `WeakSet` for cycles (TH-PUB-01).
- **`JSON.stringify`** on a very deep payload may throw `RangeError`; that is caught and refused (TH-PUB-01).
- **`JSON.parse`** is called only on spans within `D_lang`.

**Tested**: unit tests over the contract's delivery fixtures, inputs 10× `D_lang` deep,
duplicate members, and every refused value kind.

## P-10 The CI User Helper (OBL-04; NFR-U3-15)

**Mechanism**: a step in `conformance-typescript`, before the run:
`sudo useradd --no-create-home --shell /usr/sbin/nologin soorma-foreign`. Then the runner gets
`--foreign-user soorma-foreign`. U1's runner already changes the CC-SEC-05 file's owner with
`sudo -n chown` (`conformance/runner/src/rundir.ts`). Locally nothing changes:
`--local-skip CC-SEC-05`, refused in CI (NFR-U1-16).

**Tested**: the job's report shows CC-SEC-05 passed, not skipped.

## Security Compliance (this stage)

| Rule | Outcome |
|---|---|
| SECURITY-01 | In transit **Compliant** (P-06: TLS always verified, trust store fixed at start). At rest: N/A for the milestone, carried; the SDK has no store |
| SECURITY-02 | N/A: no network intermediary in a client library |
| SECURITY-03 | **Compliant** on its untagged clauses as they apply to a library: no log is written; no secret, credential, token or payload in any message or string form (P-08); the one diagnostic, REN-07's warning, holds none. The centralized-log clause: N/A for the milestone, carried |
| SECURITY-04 | N/A: no HTML endpoint |
| SECURITY-05 | N/A: the SDK serves no API. It checks its own inputs (options' presence and type, the payload's JSON) without being the platform's validation (NEV-04) |
| SECURITY-06, -07 | N/A: no IAM policy or network configuration |
| SECURITY-08 | N/A: authorization is the platform's, server side; the SDK presents the credential only (CRD-02) |
| SECURITY-09 | **Compliant**: no default credentials; errors carry no internals or bodies (PRB-02, DEC-U1-14); runtimes current (Node 24, 26) |
| SECURITY-10 | **Compliant** on its untagged clauses: the lock file; exact versions; `pnpm audit` and dependency review in CI; one runtime peer dependency; pinned CI; official registry. SBOM: N/A for the milestone, carried |
| SECURITY-11 | **Compliant**: the security-critical logic in `keeper.ts` and `secrets.ts`; defence in depth (TLS, typed errors, hygiene); REN-07 bounds both floods (P-03, P-02); the misuse table (business-rules) |
| **SECURITY-12, per clause** (the user, 2026-11-19T05:02:26Z) | **Password policy**: N/A (server-side). **Credential storage**: N/A (server-side; the agent credential is in memory only, CRD-01). **MFA**: N/A (server-side). **Session management**: N/A (server-side; no cookies). **Brute-force protection**: N/A (server-side: S3's `too_many_attempts`; the SDK never retries `429` or `403`). **No hardcoded credentials: Compliant**: secrets only through a provider (`fileSecret`); the example's block names a secret file, never a secret; the lint rule refuses `process.env` in the package; tests and fixtures use generated or clearly fake values |
| SECURITY-13 | **Compliant**: no unsafe deserialization (P-09: bounded, iterative, `JSON.parse` only within `D_lang`); no external scripts |
| SECURITY-14 | Alerting, log integrity and retention: N/A for the milestone, carried. Dashboards: N/A for a client library |
| SECURITY-15 | **Compliant**: one retry policy (P-01); fail closed (TLS never retried; a refused credential is terminal); resources released on every path (P-07); no unhandled rejection; no internals in errors |

## Invariant Compliance (this stage)

| Code | Outcome |
|---|---|
| I1 | Compliant: no environment-keyed state; scope from the credential only |
| I2 | Compliant: the retry policy, the validity check and the supervisor decide nothing the platform relies on (NEV-04) |
| I3 | Compliant: no host or environment read; the clock seam reads time only (P-05) |
| I4 | N/A for this unit (no governed record) |
| I5 | Compliant: forwarding unchanged by any pattern here |
| I6 | Compliant: S3 and S4 only |
| I7 | Compliant: unknown codes and fields tolerated in the supervisor and the scanner |
| I8 | Compliant: the CI helper and the driver are outside the package |
| I9 | Compliant: no tenant value in any pattern |
| I10 | Compliant: nothing depends on where the agent runs; the trust store reads the machine's CA list, not its identity |
| I11 | N/A by design |
