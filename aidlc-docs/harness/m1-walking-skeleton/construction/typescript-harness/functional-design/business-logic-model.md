# Business Logic Model — U3 `typescript-harness`

The flows of the TypeScript harness, step by step. The behaviour is U1's specification
(statements cited by id). This file shows how the TypeScript modules (domain-entities §3) carry
it, with the rules of `business-rules.md` (`TH-…`). Answers: U3-FD-Q1 to Q9.

## 1. One Agent's Life

```text
new AgentClient(options) --start()--> bootstrap --> [renewal loop] --close()--> closed
                                          |              |
                                          |              +--> credential_refused --> revoked
                                          v
                         publish() / delivery.publish() / subscribe()
```

Text alternative: the client is created without contacting anything. `start()` bootstraps once.
A renewal loop then keeps the credential fresh until `close()`, or until a `credential_refused`
makes the client revoked. While it is started, tenant code publishes, forwards through a
Delivery, and subscribes (one subscription at a time).

## 2. `start()`: Bootstrap (ACQ-01 to ACQ-09; SEC-01, SEC-02; TH-SEC-04)

| Step | Action | On failure |
|---|---|---|
| 1 | State must be *created*; otherwise `ClientStateError` (ACQ-07). State becomes *starting* | — |
| 2 | Call the provider once (`keeper.ts`); a throw, rejection or non-string gives `SecretSourceError` (`provider-failed`) | State back to *created*; nothing sent (SEC-08) |
| 3 | Build the body `{"agent":…,"secret":…,"instance":…}` and drop the secret reference | — |
| 4 | `POST {S3}/agent-credentials`: contract version header, no `Authorization`, no envelope; within `T_req`. Retries per PRB-05 and PRB-08 (`503`, or a connection failure with the request not sent) and PRB-09 (bootstrap always), within `R_max` and `W_max` | `ProblemError` or `TransportError`; state back to *created* (ACQ-06) |
| 5 | On `200`, check the body is a usable `AgentCredential`; otherwise `TransportError` (`unusable-response`), holding nothing (ACQ-08) | State back to *created* |
| 6 | Hold the credential and its details; record `receivedAt` (monotonic); lineage += 1; schedule the renewal (§3) | — |
| 7 | State *started*; `start()` resolves | — |

## 3. Renewal Scheduling, with REN-07 (REN-01 to REN-07; TH-REN-01 to 05)

On every credential received (bootstrap or renewal):

```text
target   = monotonicNow + (expiresAt - H_renew - Date.now())   # wall-clock target, carried over to the monotonic clock
floor    = receivedAt + R_min                                   # monotonic
due      = max(target, floor)
if expiresAt - H_renew <= Date.now() and not warnedThisLineage:
    process.emitWarning(clock-skew)                             # once per lineage, no credential
    warnedThisLineage = true
setTimeout(renew, due - monotonicNow).unref()
```

Text alternative: the renewal is due at `expiresAt − H_renew` by the wall clock, but never
sooner than `R_min` after the credential arrived, by the monotonic clock. If the target has
already passed for a credential just received, the client's clock is ahead of the platform's. The
SDK then warns once in that lineage and renews at the floor. Without REN-07, such a client renews
as fast as the network allows (the user, 2026-11-19T04:23:22Z).

**Constraints on the named values, from REN-07** (for NFR Requirements to check):
1. **`R_min` < `H_renew`**. A credential received with `expiresAt` inside `H_renew` is then still valid, on the client's own clock, when the floored renewal falls due. Otherwise REN-06 would make the next operation bootstrap instead.
2. **The end-to-end test's offset** must make the target already past and still leave the floor inside the credential's life, both on the client's clock:
   - `lifetime − H_renew` ≤ offset < `lifetime − R_min`, where `lifetime` is soorma-core's 15 minutes.
   - **The user's 14 minutes fits when `H_renew` ≥ 1 minute and `R_min` < 1 minute**, less the test's margin.
   - If NFR Requirements sets values outside that, the offset becomes `lifetime − H_renew`, and the change is recorded.

**Renew**:
1. `POST {S3}/agent-credentials/current/renewal` with the bearer credential, no body (REN-02).
2. On `200`:
   - **a later expiry** replaces the credential, announces it to the subscription (§6, replacement) and reschedules;
   - **no later expiry** means the lineage is ending: bootstrap a new lineage before the current one expires (REN-03).
3. `401 credential_expired`: bootstrap (REN-04).
4. `401 credential_refused`, including on a retried renewal (GAP-CAC-001): revoked (REN-05).
5. `503`, or a connection failure, while the credential is valid: retried per PRB-05, PRB-08 and PRB-09.
6. Any other failure: none here. If the credential expires unrenewed, the next operation bootstraps first (REN-06).

## 4. Publishing and Forwarding (PUB, FWD, DRF, TRC; TH-PUB)

| Step | `client.publish(payload)` | `delivery.publish(payload)` |
|---|---|---|
| 1 | State must be *started* (ACQ-07); an expired credential bootstraps first (REN-06) | Same |
| 2 | Check the payload (TH-PUB-01): a `TypeError` naming the path, before any request | Same |
| 3 | Send span: parent = **the active context** (SPN-04) | Send span: parent = **the received context** (TH-SPN-02, TH-SPN-03); a link to the active span if valid and not the received context (TH-SPN-04) |
| 4 | Draft: `clientContractVersion`, `traceContext` from the send span or generated (TH-SPN-06) | Same, plus `inbound: { envelope: <envelopeText, spliced>, seal }` |
| 5 | `POST {S4}/events` with the bearer credential, `{"draft":…,"payload":…}` as compact JSON (TH-PUB-02) | Same |
| 6 | `202` gives `PublishAccepted { traceContext }`; anything else gives `ProblemError` or `TransportError`; **never retried**. The span ends with an error status and the Problem code (SPN-07) | Same; `invalid_inbound_context`, `chain_too_deep` and `forbidden` surface as given (FWD-05) |

## 5. Reading a Delivery: the Scanner (TH-RD-01 to 05; U3-FD-Q1)

```text
scan(data):
  expect '{'; for each member: read name (a JSON string); skip ':';
      start = pos; walk the value (strings with escapes; depth += on '{' '[', -= on '}' ']');
      record (name, start..pos, maxDepth); expect ',' or '}'
  expect end of data
  require envelope (object span), seal (string span), payload (any span); exactly one each
envelope = deepFreeze(JSON.parse(envelopeText))   # only if envelope depth <= D_lang
payload  = depth <= D_lang ? JSON.parse(payloadText) : absent, payloadParsed = false
```

Text alternative: one pass over the line records where each top-level member's value begins and
ends, and how deeply it nests, without building any value. The three members are found in any
order:
- **The envelope** is parsed from its own text (deep-frozen) if it is within the depth bound; otherwise the line is a delivery error.
- **The payload** is parsed only within `D_lang`; deeper, it stays as text.
- **Anything malformed** becomes a delivery error item, and the stream continues.

## 6. Subscribing and Stream Supervision (SUB, STR; DEC-U1-03, -04, -06, -12)

| Event | What the subscription does |
|---|---|
| `subscribe()` | `ClientStateError` if one is active (SUB-04). Returns a `Subscription` at once; the first pull sends `POST {S4}/subscriptions` with `{ draft }` (SUB-01). A failure before the stream opens surfaces from the iterator as the `ProblemError` (SUB-05) |
| Stream open | Yield *stream started* (STR-01). Read lines **only as tenant code pulls**, through a buffer of at most `N_buf` items (SUB-06). Heartbeats are consumed (SUB-02). `T_idle` of silence counts as dropped (STR-02) |
| `delivery` event | §5. The receive span is started and ended as the item is yielded, with parent the received context (TH-SPN-03) |
| `end` event or drop | Yield *stream ended* with the code, or `null`. Non-terminal: re-subscribe with backoff, `Retry-After` first, counting consecutive ends with no Delivery against `L_ends` (STR-03, STR-06). `credential_refused`: terminal, client revoked (STR-07) |
| New credential, same lineage | Open the next stream before expiry. Hold new Deliveries (counting against `N_buf`) until the old stream's `superseded`, or `W_super`. Yield *ended* (old), then *started* (new), then the held items (STR-04, STR-05). Duplicates are possible (DEC-U1-12) |
| New lineage | Open the new stream, close the old one at once, and yield the same sequence (STR-05) |
| `close()`, `break` | Abort the stream, yield a terminal *stream ended* (no code) if iterating, finish; release everything (SUB-07, TH-LIFE-01, -02) |

No `Last-Event-ID` is sent; no item claims continuity (STR-08). At most one stream per lineage,
except during a replacement (STR-09).

## 7. Spans (SPN-01 to SPN-07; DEC-U1-01; TH-SPN)

```text
client.publish:        send span   parent = active context            links: none
delivery.publish:      send span   parent = received context (parsed) links: active span if valid and != received
yield Delivery:        receive span parent = received context (parsed) links: none (TH-SPN-04, open point)
received unparseable:  root span (receive or send), linking the active span if any (SPN-03)
```

Text alternative: a client publish follows ambient parenting. A forwarding publish and a
receive are children of the context the envelope carried, parsed by the SDK itself, so an
ambient span can never become their parent. A forwarding publish links tenant code's active
span when it differs; the receive span links nothing, which is SPN-03's text. Whether the
receive span should also link the active span is the open point in TH-SPN-04.

## 8. Closing (TH-LIFE; PRB-07)

`close()` marks the client *closed*, then:
1. aborts in-flight requests;
2. closes the subscription (§6);
3. clears the renewal timer;
4. drops the credential.

It resolves when all of these are done, and a second call returns the same promise. The renewal
timer is `unref`'d, so only open sockets keep the process alive.

## 9. The Conformance Driver (C-21; TH-DRV)

- `typescript/conformance-driver/src/driver.ts` reads commands as JSON lines and calls `@soorma/sdk`'s public interface. It writes observations in the protocol of `conformance/README.md`.
- `inspect` uses U1's `heap.ts` (TH-DRV-02).
- `describe` reports the named values in force, `R_min` included.
- **The warning report (a protocol addition, TH-F42-02)**:
  - the driver listens for `process` `warning` events with code `SOORMA_CLOCK_SKEW`;
  - a `warnings` command returns `{ "warnings": [{ "code": "clock-skew" }, …] }`, in order;
  - a case asserts on that result.
  - The reference driver implements the same command. Its exact form is fixed at Code Generation, with the runner's assertion kinds.
- **CC-REN-06 (new)**: the stub answers the bootstrap, and every renewal, with an `expiresAt` **relative to that response's own time**: more than `R_min` and less than `H_renew` after it. Each credential is then already due, still valid when the floor arrives, and later than the one before, so REN-03's lineage end does not fire.
  - U1's templates give times relative to the case's start (`${TIME:+…}`). **If the stub cannot yet give a time relative to each response, it gains that** (another foreseen F42 item, TH-F42-02).
  - The case's commands:
  1. `create`, then `start`.
  2. Wait several `R_min`.
  3. Report the `warnings`.

  Its expectations:
  - the renewals the stub recorded are **at least `R_min` apart** (within the timing margins U1's loader enforces), and no more in number than the window allows;
  - the warnings report holds **exactly one** `clock-skew`;
  - no request carries anything but the contract's renewal shape.

  Its statements: REN-07, REN-01. The reference driver declares it, and **the self-test's four fault sets are unchanged**.

## 10. The Example and the End-to-End Test (C-22; FR-19, FR-20; JOB-06)

**The example**: `typescript/examples/two-agents/agent-b.ts` subscribes and prints each
Delivery's envelope and the trace id. `agent-a.ts` publishes one payload. Each has its
configuration block and `run(config)` (TH-E2E-01). The README names `e2e/core-up` and
`e2e/setup` and states the following:
- live only: start B first;
- the span shape is unstable, with DEC-U1-01's deviation;
- `fileSecret`'s file settings, and that Windows tenants supply their own provider.

**The end-to-end test** (`typescript/e2e/scenario.test.ts`), after `prove-stack`:

| Step | Does | Asserts |
|---|---|---|
| 1 | Read `.e2e/stack.json`; install an in-memory exporter and a tracer provider (the test's, never the SDK's) | — |
| 2 | Fake **only `Date`**, 14 minutes ahead; create and `start()` A and B (their own instances, `fileSecret` on U2's secret files) | Both started (done when 2) |
| 3 | Wait for B's renewal | `credential.expiresAt` moved once (a real S3 renewal); no second renewal before `R_min`; one `SOORMA_CLOCK_SKEW` warning (TH-E2E-04) |
| 4 | Restore the real `Date` | — |
| 5 | Start a **decoy span**; inside it, B subscribes and starts its loop; wait for *stream started* | — |
| 6 | A publishes `{ "hello": "B" }` outside the decoy | `PublishAccepted` with a `traceparent` (done when 5) |
| 7 | B receives the Delivery | Envelope and seal present; the envelope's `traceContext.traceparent` equals A's draft's (done when 3, 5) |
| 8 | Read the exporter | B's receive span: trace id equals A's; parent span id is A's send span id; **parent is not the decoy**; links as TH-SPN-04 says |
| 9 | `close()` both | Nothing left open |

The `e2e-typescript` job (JOB-06) is U2's job, renamed, with the scenario after `prove-stack`.

## 11. Test Cases Planned for QA Enrichment

The inception cases TC-TH-001 to 066 stand. QA enrichment extends these:
- **TC-TH-061**: the fast clock, one real renewal, none before `R_min`, the warning once (TH-E2E-04).
- **TC-TH-063**: the decoy span and the parent assertions (TH-E2E-03).
- **TC-TH-059**: CDI-05's rule for a failing case, and CC-REN-06 among the cases.

It adds these, with these numbers:

| TC | Title | Rules |
|---|---|---|
| TC-TH-067 | `fileSecret` is refused on Windows without opening the path | TH-SEC-02; SEC-09 |
| TC-TH-068 | A delivery line with a duplicate `envelope`, `seal` or `payload` is a delivery error | TH-RD-02 |
| TC-TH-069 | Every member of the `Envelope` type is optional | TH-RD-05; RCV-08; CDI-04 |
| TC-TH-070 | `publish` refuses a payload JSON cannot carry, naming the path, never the value | TH-PUB-01 |
| TC-TH-071 | Leaving a loop closes the subscription; the renewal timer alone does not keep the process alive | TH-LIFE-02, TH-LIFE-03 |
| TC-TH-072 | A client whose clock runs fast renews at most once per `R_min` and warns once per lineage (REN-07; CC-REN-06) | TH-REN-01 to 03 |
| TC-TH-073 | An envelope nested deeper than `D_lang` is a delivery error; the stream continues | TH-RD-03 |
| TC-TH-074 | An unknown option, such as a misspelt TLS switch, is refused | TH-API-03 |

## 12. Values Left to NFR Requirements

These come from the harness profile (PF §11 *Harness Surface*, §14 *Harness Surface
Register*):
- `H_renew`, `R_min` (new: `R_min` < `H_renew`; the end-to-end offset constraint in §3; weighed against the end-to-end job's time, about `2 × R_min`, and AD-13);
- `R_max`, `W_max`, `B_init`, `B_factor`, `B_cap`, `L_ends`, `W_super`, `N_buf`, `D_lang`, `T_idle`, `T_req`.

Also left to NFR Requirements:
- the package's module format and build;
- the C-10 generator;
- the `@opentelemetry/api` version and the messaging conventions' version;
- the Node versions (24 and 26);
- the CI jobs: the TypeScript conformance job with OBL-04's second user and `--foreign-user`, where CC-SEC-05 runs and `--local-skip` stays refused; and JOB-06.
