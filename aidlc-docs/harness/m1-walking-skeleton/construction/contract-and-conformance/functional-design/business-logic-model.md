# Business Logic Model — U1 `contract-and-conformance`

How the language-neutral layer works: the contract copy and its checks (§1), the conformance
machinery (§2), the driver protocol (§3), CDI-02's runtime checks (§4), the reference driver
and the negative controls (§5), and the case catalogue (§6). The behaviour it judges is in
[business-rules.md](business-rules.md); the entities in [domain-entities.md](domain-entities.md).

---

## 1. The Contract Copy and the Repository Checks

### 1.1 Vendoring and `PIN`

- `contract/` holds every file under `contract/` in soorma-core at the tag `contract-v0.1.0`,
  byte for byte, fixtures included
- `contract/PIN` (data, not prose): `tag: contract-v0.1.0`, `commit:
  c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d`, `tree:` the git tree id of `contract/` at that
  commit, and `files:` each path with its SHA-256
- `contract/README` beside it is **not** vendored text: it lives at `contract.md` at the
  repository root (so the copy stays byte-identical) and says: never edit `contract/`; an
  insufficiency is raised against the soorma-core initiative (FR-01; US-12 #3)

### 1.2 Contract drift check (two halves)

1. **Local** (every CI run, offline): every file under `contract/` hashes to `PIN`; no file
   is missing from or extra to `PIN`. A failure names the file and whether it differs, is
   missing, or is extra
2. **Remote** (every CI run): the tag `contract-v0.1.0` on soorma-ai/soorma-core peels to
   `PIN.commit`, and the tree of `contract/` at that commit equals `PIN.tree`. A failure names
   the tag and the two values

### 1.3 Generated-types check

For each language package present: regenerate its types from `contract/` with the pinned
generator, and compare with the committed files. A difference fails, naming the file. Inactive
until U3 commits TypeScript types; U4 adds Python.

### 1.4 Names check

For each language driver: `names` and `surface` (§3) list the exported names and option
fields; the check compares them with that language's column of the name table. An extra export
or a missing one fails, naming it. Protocol idioms (async iteration, disposal) are accepted by
a fixed list.

### 1.5 SPDX check

Every source file (`*.ts`, `*.py`, scripts, workflow files) begins with a comment carrying
`SPDX-License-Identifier: Apache-2.0`. `contract/` is exempt: it is vendored as is.

---

## 2. The Conformance Machinery

### 2.1 The stub

- **Listeners**, each TLS with certificates from a CA made for the run: **S3** and **S4**
  (`localhost` and `127.0.0.1`); an **untrusted** listener whose certificate comes from a
  second CA (CFG-04); a **stray** listener that records any request reaching it (CFG-03)
- **Scripts**: each case's exchanges are loaded before the case. A request is matched to the
  next exchange whose `match` it meets; a request matching nothing is answered `500` and
  **fails the case**
- **Connection faults**: `refuse` (the listener refuses the next N connections: nothing is
  sent) and `reset` (the stub reads the whole request, then resets the connection with no
  answer: the request was sent), for PRB-08 and PRB-09
- **Recording**: method, path, headers, body bytes, arrival time, and the connection it came
  on. Bodies are recorded as received bytes, never re-encoded
- **Streams**: SSE actions are written as text in order. `drop` closes the socket without
  `end`. `waitFor` holds the stream until another exchange happens (the replacement
  subscribe). `silence` sends nothing for a time. A stream also records when its client closes
  it
- **Deep payloads**: `deepPayload(depth)` generates a payload nested `depth` levels; cases ask
  for `D_lang + k` from the driver's `describe`, never a fixed number (FR-03; D-07)
- **Time**: real time. Cases make timing short through the named values (§3.2), and assert
  orderings and windows, not exact instants

### 2.2 The runner

```text
1. load spec/behaviour.md statements and conformance/cases/**; link check:
   every statement has a case (or a stated exemption); every case's statements exist
2. fixture coverage: every agent-side fixture under contract/fixtures/0.1.0/ is referenced
3. make the run's CAs; start the stub
4. start the driver; describe -> language, runtime, named values, D_lang, coverage, faults
5. for each case (mode decides which):
     load script; send commands; collect observations; read the stub's recording
     evaluate every expectation; the case fails on the first unmet one, naming it
6. report: per case pass | fail (expectation, detail) | not run; statements covered
7. exit 0 only if: full mode -> every case passed (a skip or "unsupported" is a failure)
                   reference mode -> every declared case passed
```

A failure always names **the case id and its statements**, so a negative control's failure is
attributable (§5).

### 2.3 Request matchers and negative fixtures

`request-shape` and `request-exact` judge what the driver sent. Each request-shape case also
lists **negative fixtures**: the contract's invalid request shapes for that operation. The
runner proves, inside the case, that its matcher **rejects** each negative fixture and accepts
the valid one, so a lax matcher cannot pass a wrong SDK. This is how every invalid
request-side fixture is used.

### 2.4 Modes

| Mode | Driver | Passes when |
|---|---|---|
| `full` | U3's and U4's drivers (CI, both runtimes each) | every case passes |
| `reference` | the reference driver (§5) | every case in its declared coverage passes; others are listed *not run* |
| `reference --fault X` | the reference driver with one fault | **must fail**, and the failures must include fault X's target case(s); CI inverts the result |

---

## 3. The Driver Protocol

JSON lines over stdin and stdout, UTF-8, one object per line. The driver writes nothing else
to stdout (diagnostics go to stderr, which the runner keeps with the case report).

```text
command      {"id": 7, "op": "publish", "args": {...}}
observation  {"id": 7, "ok": true,  "result": {...}}
           | {"id": 7, "ok": false, "error": {"type": "ProblemError", "status": 503,
                                              "code": "unavailable", "retryAfter": 1, ...}}
```

### 3.1 Commands

| `op` | `args` | Public call (language drivers) | `result` |
|---|---|---|---|
| `describe` | — | — | `language`, `runtime`, `sdkVersion`, `values` (§3.2), `depthBound`, `coverage` (reference only), `faults` |
| `create` | `dataGatewayUrl`, `eventIngestUrl`, `caFile`?, `agent`, `instance`, `secret`: `{ "kind": "test", "bytes": base64 }` or `{ "kind": "file", "path" }`; `values`? (§3.2) | `new AgentClient(options)`; a `test` secret is a provider the driver builds (§4) | `{}` |
| `start` | — | `start()` | `credential` (the public details) |
| `credential` | — | read `credential` | the details, or null |
| `publish` | `payload` (JSON), `inSpan`? (§3.3) | `client.publish(payload)` | `traceContext` |
| `subscribe` | — | `subscribe()` | `{}` |
| `next` | `timeoutMs` | the next subscription item | the item as data (`kind`, fields; a Delivery is given a `ref`) or `{ "timeout": true }` |
| `forward` | `ref`, `payload`, `inSpan`? | `delivery.publish(payload)` | `traceContext` |
| `closeSubscription` | — | `subscription.close()` | `{}` |
| `close` | — | `client.close()` | `{}` |
| `fileSecret` | `path`, `timeoutMs` | `fileSecret(path)()` | `{ "length": n }` (never the value) or the error |
| `newInstanceId` | — | `newInstanceId()` | the value |
| `inspect` | `checks`: `secretRetained`, `providerCalls`, `openResources` | the runtime checks (§4) | per check |
| `spans` | — | the test exporter's finished spans | each: name, kind, traceId, spanId, parentSpanId, links, status, attributes |
| `names` | — | the package's exported names | the list |
| `surface` | — | the options type's fields; settable members | the lists |
| `env` | `set`: map | set environment variables in the driver before `create` (CFG-06) | `{}` |

A language driver uses **only its package's public interface** for every op except
`inspect`, `spans`, `env` and the timing hook (§3.2).

### 3.2 Named values and the timing hook

`describe.values` reports the SDK's values for `H_renew`, `R_max`, `W_max`, `B_init`,
`B_factor`, `B_cap`, `L_ends`, `W_super`, `N_buf`, `T_idle`, `T_req`, and `depthBound`
(`D_lang`). A case that needs short timings passes `values` in `create`; the driver applies
them through a **test hook that is not part of the public interface** (not in the name table,
not exported from the package's entry point). The public API has no option for them. Cases
assert behaviour relative to the values in force, never absolute numbers.

### 3.3 Tenant spans

`inSpan: { "name": ... }` makes the driver run the call inside an active span it creates with
the test's OpenTelemetry SDK, and report that span's ids, so cases can check parenting and
links (SPN-03, SPN-04). The test SDK and its in-memory exporter belong to the driver, never to
the package (SPN-05).

---

## 4. CDI-02: Runtime Checks (US-02 #3)

**The check is made by the runtime, not reported by the driver**: the driver never answers
from a list of its own fields (CDI-02). The case CC-SEC-01 runs it after `start()` resolves
and the stub has recorded the bootstrap request.

### 4.1 The secret's form, so the check is not fooled

- The runner sends the secret to the driver as **base64 bytes** (a 48-character random value
  per run), so the plain value never exists as a string in the driver's command text
- A `test` provider holds **only the bytes**. Each call returns a **new string** decoded from
  them; the driver keeps no reference to any returned string, except where §4.3 requires one
- `fileSecret` cases use files the runner writes; the driver never reads them itself

### 4.2 TypeScript

1. The driver runs with `--expose-gc`
2. `inspect secretRetained`: await two macrotask turns; call `gc()` twice; take a heap
   snapshot through V8's heap snapshot API (`v8.getHeapSnapshot()`), streamed
3. Search **every string** in the snapshot for the secret's value, and for each half of it
   (a split across concatenated-string parts must not hide it)
4. Result: `{ "found": false }`, or `{ "found": true, "count": n }`. The case fails on `found`

### 4.3 Python

1. Before `start()`, the driver creates the secret string `s` from the bytes (not interned:
   decoded at run time) and records `baseline = sys.getrefcount(s)`; the provider returns
   **`s` itself**, so every reference the SDK keeps is a reference to `s`
2. `inspect secretRetained`: after `start()` returns, run `gc.collect()` (for reference cycles
   that might hold it); read `sys.getrefcount(s)`
3. Result: `{ "found": refcount > baseline }`. Python's garbage collector does not track
   strings, so the reference count is the measure (CDI-02, the user's direction)
4. **Limit, stated**: the count sees references to `s`, not copies derived from it (for
   example an encoded request body). U4's Functional Design may add a check for those; the
   statement SEC-02 covers both

### 4.4 Other `inspect` checks

- `providerCalls`: the count the driver's test provider kept (SEC-01)
- `openResources`: open sockets, streams and timers, read from the runtime (Node's active
  handles and resources; Python's open sockets and pending tasks), after `close()` (PRB-07)

---

## 5. The Reference Driver and the Negative Controls (DEC-U1-08)

### 5.1 The reference driver

- **Test only**: `conformance/reference-driver/`, TypeScript, run by the runner; in **neither
  package** (no import path from `typescript/` or `python/`, not in either package's file list)
- **Written against the stub**: it implements the protocol directly over HTTPS and SSE, with
  just enough behaviour to pass its declared cases. It is not the SDK and not a third client
- **Declared coverage** (`describe.coverage`): at least **one case of every area** (CFG, SEC,
  ACQ, REN, CRD, DRF, TRC, FWD, PUB, SUB, STR, RCV, PRB, SPN, NEV, NAM), **every assertion
  kind** (domain-entities §1.1), and **every fault's target case**. The catalogue (§6) marks
  them R
- **Proves the runner**: in `reference` mode, every declared case passes (U1 *done when*)

### 5.2 The four negative controls

Each is the reference driver started with **one** fault switched on, so a control differs from
the passing driver by exactly the rule it breaks.

| Fault | What the driver does wrong | Rule broken | Target case (runner must fail it, by name) | How the runner sees it |
|---|---|---|---|---|
| `retain-secret` | keeps each secret string it obtains in a module-level list | SEC-02 | **CC-SEC-01** | `runtime-check`: the heap snapshot finds the value |
| `reorder-forwarded-envelope` | forwards `inbound.envelope` re-serialized with members sorted | FWD-02 | **CC-FWD-02** | `request-exact`: the forwarded bytes differ from the delivered envelope's |
| `retry-publish` | retries a publish once after `503` | PUB-05 | **CC-PUB-03** | `request-count`: two `POST /events` where one is required |
| `skip-boundary` | drops *stream ended* items | STR-05 (and STR-02) | **CC-STR-04** (also fails CC-STR-05) | `item-sequence`: the *stream ended (old)* item is missing |

### 5.3 In CI (U1's code PR shows all of them)

The conformance self-test job runs, in order: the reference driver in `reference` mode (must
pass); then each fault (must exit non-zero, and the report must list the target case as
failed). Each step prints the case the runner named. The job fails if the reference run fails,
if a faulted run passes, or if a faulted run fails without naming its target.

---

## 6. Case Catalogue

**R**: in the reference driver's declared coverage. **Fault**: the negative control that must
fail it. Kinds abbreviated: `rx` request-exact, `rs` request-shape, `rc` request-count, `rt`
request-timing, `ob` observation, `is` item-sequence, `rk` runtime-check, `sp` span, `sf`
surface, `ab` absence. Fixture paths are under `contract/fixtures/0.1.0/`; `neg:` marks
negative fixtures (§2.3).

| Case | Title | Statements | Fixtures | Script, in short | Kinds | R | Fault |
|---|---|---|---|---|---|---|---|
| CC-CFG-01 | Creating a client contacts nothing | CFG-01 | — | `create`; wait | ab | R | |
| CC-CFG-02 | No environment option exists | CFG-02 | — | `surface` | sf | | |
| CC-CFG-03 | Calls go only to the configured S3 and S4 | CFG-03, CRD-02 | — | start, renew, publish, subscribe; stray listener armed | rs, ab | | |
| CC-CFG-04 | A supplied CA is trusted | CFG-04 | — | `create` with the run CA; start | ob | | |
| CC-CFG-05 | An untrusted certificate fails before any body | CFG-04 | — | S3 URL points at the untrusted listener; start | ob, ab | | |
| CC-CFG-06 | Nothing comes from the host or environment variables | CFG-05, CFG-07 | — | `env` sets decoy variables (agent, instance, URL, secret names); start; publish | rs, ab | | |
| CC-CFG-07 | `newInstanceId` is a fresh UUID v4 | CFG-06 | — | `newInstanceId` twice | ob | | |
| CC-SEC-01 | No reference to the secret remains after bootstrap | SEC-02 | — | test secret; start; `inspect secretRetained` | rk | R | retain-secret |
| CC-SEC-02 | One provider, none reading an environment variable | SEC-03 | — | `names`; `env` sets a variable; `fileSecret` on a path | sf, ob | | |
| CC-SEC-03 | `fileSecret` reads an owner-only file, one line ending removed, each call | SEC-04, SEC-07 | — | files `0600` with `\n`, `\r\n`, none; call twice after rewriting | ob | R | |
| CC-SEC-04 | Unsafe modes refused without reading | SEC-05, SEC-08 | — | files `0604`, `0620`, `0602`; contents are a marker | ob | | |
| CC-SEC-05 | A foreign owner is refused | SEC-05 | — | a file owned by another non-root user (the runner needs a second local user: CI provides one; a local run without one fails this case rather than skipping it) | ob | | |
| CC-SEC-06 | Group read and symlink chains allowed | SEC-06 | — | `0440` and `0640` files behind a `..data`-style link chain | ob | | |
| CC-SEC-07 | A named pipe or device is refused at once | SEC-04, SEC-05 | — | a FIFO with no writer; `/dev/zero`; `timeoutMs` 1000 | ob, rt | | |
| CC-SEC-08 | A provider failure surfaces and sends nothing | SEC-08 | — | test provider that throws; start | ob, ab | | |
| CC-ACQ-01 | Bootstrap sends exactly the contract's request | ACQ-01, ACQ-02, SEC-01 | `data-gateway/BootstrapRequest/valid/sample.json`; `data-gateway/AgentCredential/valid/sample.json`, `…/valid/unknown-field.json`; neg: `data-gateway/BootstrapRequest/invalid/*` | `200` with each valid response | rs, rx, ob | R | |
| CC-ACQ-02 | `authentication_failed` surfaces, once | ACQ-03 | `problem/valid/authentication-failed.json` | `403` | ob, rc | | |
| CC-ACQ-03 | `too_many_attempts` surfaces with `retryAfter`, once | ACQ-04, PRB-03, PRB-06 | — | `429`, `Retry-After: 30` | ob, rc | | |
| CC-ACQ-04 | A failed start can be retried by tenant code | ACQ-06 | — | `403`, then `200` on the second `start` | ob, rc | | |
| CC-ACQ-05 | Wrong-state calls raise and send nothing | ACQ-07 | — | publish before start; start twice | ob, ab | | |
| CC-ACQ-06 | An unusable `200` fails start | ACQ-08 | `data-gateway/AgentCredential/invalid/no-expiry.json`, `…/no-instance.json` | `200` with each | ob, rc | | |
| CC-ACQ-07 | Values are sent as given | ACQ-09 | `data-gateway/BootstrapRequest/invalid/bad-agent.json`, `…/secret-bad-character.json`, `…/secret-too-long.json`, `…/valid/material-of-another-type.json` (values taken from them) | `400 malformed_request` for invalid values; `200` for the other type | rs, ob | | |
| CC-REN-01 | Renewal before expiry; the renewed credential is used | REN-01, REN-02 | — | `expiresAt` = now + `H_renew` + 2 s; renewal `200`; publish after | rt, rs, ob | R | |
| CC-REN-02 | A lineage that cannot extend is replaced by a new bootstrap | REN-03 | — | renewal returns the same `expiresAt` | rc, rt | | |
| CC-REN-03 | `credential_expired` on renewal: one new provider call, one bootstrap | REN-04, SEC-01 | — | renewal `401 credential_expired`; bootstrap `200` | rc, rk | | |
| CC-REN-04 | `credential_refused` on renewal is terminal | REN-05 | — | renewal `401 credential_refused`; then publish | ob, ab | | |
| CC-REN-05 | An unrenewed expiry makes the next operation bootstrap | REN-06 | — | renewal `503` past the bound; wait past `expiresAt`; publish | rc, rs | | |
| CC-CRD-01 | Credential details read only; the credential string unreachable | CRD-03 | `data-gateway/AgentCredential/valid/sample.json` | start; `credential`; `surface` | ob, sf | R | |
| CC-CRD-02 | No secret or credential in logs, errors or string forms | CRD-01, CRD-04 | — | verbose logging; a Problem on every operation; driver renders errors and client as text to stderr | ob, ab | | |
| CC-CRD-03 | Presented once, as a bearer header | CRD-02 | — | publish; subscribe | rs | | |
| CC-DRF-01 | A draft has exactly the allowed members | DRF-01, DRF-02 | `draft/valid/sample.json`, `draft/valid/with-tracestate.json`; neg: `draft/invalid/*` | publish | rs | R | |
| CC-TRC-01 | The draft carries the send span's context | TRC-01, TRC-02 | — | publish with the test OpenTelemetry SDK | rs, sp | R | |
| CC-TRC-02 | Without an OpenTelemetry SDK, a valid non-zero `traceparent` | TRC-01, TRC-03 | — | driver started without the test SDK; publish twice | rs | | |
| CC-FWD-01 | `delivery.publish` forwards by default | FWD-01 | `draft/valid/forwarding.json`, `inbound/valid/sample.json`; neg: `inbound/invalid/*` | stream one Delivery; `forward` | rs | R | |
| CC-FWD-02 | The forwarded envelope is the received text, byte for byte | FWD-02 | `inbound/valid/envelope-with-unknown-fields.json`; `envelope/valid/unknown-fields-at-every-level.json` | Delivery text with unusual member order, spacing and `1.0`; `forward` | rx | R | reorder-forwarded-envelope |
| CC-FWD-03 | The seal is sent as received | FWD-03 | `delivery/valid/sample.json` | `forward` | rx | | |
| CC-FWD-04 | The draft's `traceparent` is this hop's, continuing trace T | TRC-02, TRC-04 | — | Delivery with `traceparent` T; `forward` with the test SDK | rs, sp | | |
| CC-FWD-05 | Without an OpenTelemetry SDK, forwarding still continues trace T | TRC-03 | `draft/valid/traceparent-higher-version.json` (its `traceparent` as the received context) | driver without the test SDK; `forward` | rs | | |
| CC-FWD-06 | `client.publish` does not forward | FWD-04 | — | receive a Delivery; `publish` | rs | | |
| CC-FWD-07 | Refused forwarding surfaces as given, once | FWD-05 | — | `400 invalid_inbound_context`, `400 chain_too_deep`, `403 forbidden` | ob, rc | | |
| CC-PUB-01 | `202` is accepted, not delivered | PUB-01, PUB-02, PUB-04 | `event-ingest/PublishRequest/valid/sample.json`, `…/valid/payload-null.json`, `…/valid/forwarding.json`; neg: `event-ingest/PublishRequest/invalid/*` | `202`; payloads object, null, array | rs, ob | R | |
| CC-PUB-02 | Compact JSON, no escaping, no duplicates | PUB-03 | — | payload with `<`, `>`, `&`, `é`, an emoji, nested objects | rx | | |
| CC-PUB-03 | A failed publish is never retried | PUB-05, PRB-06 | — | `503`, `Retry-After: 1`; then a connection reset | rc, ob | R | retry-publish |
| CC-PUB-04 | `payload_too_large` and others surface | PUB-06 | — | `413 payload_too_large` | ob | | |
| CC-SUB-01 | Subscribe opens a stream and yields started, then Deliveries | SUB-01, SUB-02, STR-01 | `event-ingest/SubscribeRequest/valid/sample.json`, `delivery/valid/sample.json`; neg: `event-ingest/SubscribeRequest/invalid/*` | stream: two deliveries | rs, is | R | |
| CC-SUB-02 | Heartbeats yield nothing | SUB-02 | — | heartbeats between deliveries | is | | |
| CC-SUB-03 | Live only: nothing from before the stream | SUB-03 | — | a publish recorded before subscribe; stream starts empty | is, ab | | |
| CC-SUB-04 | One active subscription per client | SUB-04 | — | subscribe twice; close; subscribe | ob | | |
| CC-SUB-05 | Failures before the stream opens | SUB-05 | — | `401 credential_refused`; `403 forbidden`; `503` then `200` | ob, rc | | |
| CC-SUB-06 | Pull-based: a slow consumer meets `overflow` | SUB-06, STR-03 | — | stream many deliveries; driver does not pull; stub sends `end overflow` once its send buffer is full | is, rc | | |
| CC-SUB-07 | Closing yields a terminal end | SUB-07 | — | open; `closeSubscription` | is | | |
| CC-STR-01 | Known non-terminal codes surface and re-subscribe | STR-02, STR-03 | `event-ingest/StreamEnd/valid/unknown-field.json`; `event-ingest/StreamEndCode/valid/credential-expired.json` | `end unavailable`; then `end overflow` | is, rc | R | |
| CC-STR-02 | No code: dropped, silent, or malformed `end` | STR-02 | `event-ingest/StreamEnd/invalid/no-code.json`, `…/code-not-string.json`; `event-ingest/StreamEndCode/invalid/not-string.json` | `drop`; `silence` > `T_idle`; each malformed `end` | is | | |
| CC-STR-03 | An unknown code is surfaced, not fatal | STR-03 | `event-ingest/StreamEnd/valid/unknown-code.json`; `event-ingest/StreamEndCode/valid/unknown.json` | `end brand_new_code` | is | | |
| CC-STR-04 | Replacement across renewal: ended (old), then started (new) | STR-04, STR-05, STR-08 | `event-ingest/StreamEnd/valid/superseded.json` | short `expiresAt`; renewal; old stream sends a Delivery, waits for the replacement subscribe, sends a Delivery, then `end superseded`; new stream sends a Delivery at once | is, rt, rs | R | skip-boundary |
| CC-STR-05 | **The old stream never sends `end`** | STR-05 | — | as CC-STR-04, but the old stream stays silent and open | is, rt | R | skip-boundary |
| CC-STR-06 | A lineage change closes the old stream itself | STR-05 | — | renewal `401 credential_expired`; bootstrap; new stream | is, rs | | |
| CC-STR-07 | **The stub ends every stream at once**: backoff, then terminal at `L_ends` | STR-06 | — | every subscribe: `200`, then immediately `end unavailable` | is, rt, rc | | |
| CC-STR-08 | `Retry-After` takes precedence over backoff | STR-06 | — | re-subscribe answered `503`, `Retry-After: 2` | rt | | |
| CC-STR-09 | `credential_refused` ends terminally | STR-07 | — | `end credential_refused`; then publish | is, ob, ab | | |
| CC-STR-10 | At most one stream per lineage | STR-09 | — | two renewals; count concurrently open streams | rc | | |
| CC-STR-11 | **A duplicate in the renewal overlap is yielded, not suppressed** | STR-05, SUB-03 | — | renewal replacement: after the replacement subscribe arrives, the stub sends the same Delivery text D on the old stream and on the new stream, then `end superseded` on the old | is | | |
| CC-RCV-01 | Extraction does not depend on member order | RCV-01 | `delivery/valid/sample.json` | the same Delivery in all six member orders | is | | |
| CC-RCV-02 | Parsed envelope, envelope text, seal, payload, payload text | RCV-02 | `delivery/valid/sample.json`; `envelope/valid/sample.json`, `…/delegated.json`, `…/re-broadened.json`, `…/chain-32-entries.json` | one Delivery per envelope | is | R | |
| CC-RCV-03 | Unknown fields and values kept | RCV-03 | `envelope/valid/unknown-fields-at-every-level.json`, `…/unknown-origin-mode.json`; `delivery/valid/unknown-field.json` | deliveries | is | | |
| CC-RCV-04 | Received identifiers are opaque | RCV-04 | `envelope/valid/received-identifiers-opaque.json` | delivery | is | | |
| CC-RCV-05 | Native numbers with source text | RCV-05 | `delivery/valid/payload-array.json`, `…/payload-null.json` | payloads with `1.0`, `1e400`, a 30-digit integer | is | | |
| CC-RCV-06 | A payload beyond `D_lang` falls back to text, envelope and seal intact | RCV-06, FWD-06 | — | `deepPayload(D_lang + 8)`; then `forward` | is, rx | R | |
| CC-RCV-07 | An unreadable line is an error item; the stream continues | RCV-07 | `delivery/invalid/missing-envelope.json`, `…/missing-seal.json`, `…/missing-payload.json` | a non-JSON line, each fixture, then a valid delivery | is | | |
| CC-RCV-08 | Envelopes are not schema-validated by the SDK | RCV-08, NEV-04 | `delivery/invalid/envelope-missing-actor-chain.json`; `envelope/invalid/*` (each as a Delivery's envelope) | one delivery per fixture; `forward` one | is, rx | | |
| CC-PRB-01 | Problems: every member kept, unknown codes included | PRB-01, PRB-03, DRF-04 | `problem/valid/*` | each as a `400`, `403`, `409` or `503` response to publish | ob | R | |
| CC-PRB-02 | A non-Problem error body | PRB-02 | `problem/invalid/*` | each as a `400` body; also a `502` with HTML | ob | | |
| CC-PRB-03 | `forbidden` surfaces with no added cause | PRB-04 | — | `403 forbidden` on publish | ob | | |
| CC-PRB-04 | `503` retried after `Retry-After`, within the bound | PRB-05, ACQ-05 | — | bootstrap `503`, `Retry-After: 1`, twice, then `200` | rc, rt | R | |
| CC-PRB-05 | Past the bound, the last error surfaces | PRB-05 | — | bootstrap `503` always | rc, ob | | |
| CC-PRB-06 | **A refusal before sending** is retried; a TLS failure is not | PRB-08, PRB-10 | — | for bootstrap, renewal and subscribe in turn: the listener refuses connections twice, then serves; separately, the untrusted listener | rc, ob | | |
| CC-PRB-08 | **A reset after sending**: subscribe, renewal (unexpired) and bootstrap retried; publish not | PRB-09, PRB-10 | — | the stub reads each whole request, then resets the connection once: subscribe, renewal with the credential unexpired, bootstrap, publish; then a renewal reset after `expiresAt` (not retried; the next operation bootstraps) | rc, ob | | |
| CC-PRB-07 | Error paths release resources | PRB-07 | — | each failure kind; `close`; `inspect openResources` | rk | | |
| CC-SPN-01 | Spans through the API only, messaging conventions, no soorma names | SPN-01, SPN-02 | — | publish; receive | sp | R | |
| CC-SPN-02 | A failed operation's span records the error, nothing sensitive | SPN-07, SPN-02 | — | publish `503` | sp | | |
| CC-SPN-03 | US-Q1: receive and forwarding spans are children of the received context, not linked to it | SPN-03 | — | Delivery with `traceparent` T; `next`; `forward` (no tenant span) | sp | | |
| CC-SPN-04 | US-Q1: a tenant span that is not the received context is linked | SPN-03 | — | `forward` with `inSpan` | sp | | |
| CC-SPN-05 | An unparseable received `traceparent` gives a root span | SPN-03 | `draft/valid/traceparent-higher-version.json` (parsed, not root); a malformed value (root) | `forward` each | sp | | |
| CC-SPN-06 | A client publish uses ambient parenting | SPN-04 | — | `publish` with `inSpan` | sp | | |
| CC-SPN-07 | No exporter, sampler or provider installed | SPN-05 | — | driver without the test SDK; publish; the global provider is still the no-op one | sp, ab | | |
| CC-SPN-08 | The documentation states the unstable shape, the deviation, live-only delivery and possible duplicates | SPN-06, SUB-03 | — | the runner reads the package's span and delivery documentation the driver points to | sf | | |
| CC-NEV-01 | No human-side operation or type | NEV-01, CRD-05 | — | `names`; `surface` | sf | R | |
| CC-NEV-02 | No stamped field can be set | NEV-02, DRF-03 | — | `surface`: no publish option names a stamped field | sf | | |
| CC-NEV-03 | `Soorma-Delegation` is never sent | NEV-03 | — | every operation; inspect every recorded header | rs | | |
| CC-NAM-01 | Exported names match the table | NAM-01 | — | `names`; `surface` | sf | R | |

**Totals**: 90 cases. Reference coverage (R): 23 cases, spanning all 16 areas and all ten
assertion kinds. Fault targets: CC-SEC-01, CC-FWD-02, CC-PUB-03, CC-STR-04 (and CC-STR-05).
The two loop-guard rules the user named each have a case: **CC-STR-07** (the stub ends every
stream at once) and **CC-STR-05** (the old stream never sends `end`).

**Fixture coverage**: every agent-side fixture (data-gateway, delivery, draft, envelope,
event-ingest, inbound, problem; 103 files) is referenced above, directly or by its directory's
`*`. Human-side fixtures (org-gateway, control-gateway) are not used: the SDK has no human
operation (NEV-01).
