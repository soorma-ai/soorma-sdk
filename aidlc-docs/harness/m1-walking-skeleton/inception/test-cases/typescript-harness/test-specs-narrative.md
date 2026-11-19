# Test Specifications — typescript-harness

Inception pass, scope **comprehensive** (`aidlc-state.md`, *Extension Configuration*). Sources: `inception/application-design/unit-of-work.md` and `inception/requirements/requirements.md` only. Unit abbreviation: TH = typescript-harness. Scope tags: happy-path, negative, edge/boundary.

---

### TC-TH-001 — Creating a client contacts nothing

**Context**: Configuration is explicit and local; creating a client must not reach the platform. Covers FR-15.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Creating a client contacts nothing” and observes the outcome below.

**Steps**:
1. Script the stub to record any request.
2. Create a client with S3 and S4 URLs, an agent, an instance and a secret provider.

**Expected outcome**: The client is created; the stub records no request; the secret provider has not been called.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-002 — No environment identifier is accepted

**Context**: Scope comes from the credential; an environment setting would let tenant code assert scope. Covers FR-15.

**Preconditions**:
- The TypeScript package's public interface

**Scenario**: a tester, under the preconditions above, exercises “No environment identifier is accepted” and observes the outcome below.

**Steps**:
1. Inspect the client options' type.
2. Try to create a client with an extra environment option.

**Expected outcome**: The options define no environment field; the extra option is rejected (a type error in TypeScript, an unexpected-argument error in Python) and no request is made.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-003 — A supplied CA is trusted; an untrusted certificate fails

**Context**: TLS verification is always on; the local stack's CA is added, not a bypass. Covers FR-15.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver
- The CA file is read at `start()`, before the bootstrap; the trust store is the system store, plus Node's bundled store, plus the CA (NFR-U3-11)

**Scenario**: a tester, under the preconditions above, exercises “A supplied CA is trusted; an untrusted certificate fails” and observes the outcome below.

**Steps**:
1. Create a client with `caFile` set to the run's CA and bootstrap against the stub.
2. Repeat against a stub presenting a certificate from a different CA.

**Expected outcome**: With the run's CA supplied, `start()` succeeds over TLS. A server certificate from the untrusted CA fails the call with `TransportError` before any body is sent. A missing, unreadable or non-PEM CA file fails `start()` with `TransportError` (reason `ca-file`, naming the path, never its contents), and no request is sent (TC-TH-080). Cases: CC-CFG-04.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`, construction/typescript-harness/nfr-design/nfr-design-patterns.md (P-06)

---

### TC-TH-004 — There is no option to disable TLS verification

**Context**: A verification switch is the most common way client libraries become insecure. Covers FR-15.

**Preconditions**:
- The TypeScript package's public interface and source

**Scenario**: a tester, under the preconditions above, exercises “There is no option to disable TLS verification” and observes the outcome below.

**Steps**:
1. Search the options and the package for any setting that disables certificate verification.

**Expected outcome**: `AgentClientOptions` has no member that turns verification off, and an unknown option member (a misspelt `rejectUnauthorized`, for example) is a `TypeError` at construction (TC-TH-074). Every request is made with verification on. Cases: CC-CFG-04.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-005 — Calls go only to the configured S3 and S4

**Context**: The credential is presented only to the endpoints of the environment the tenant configured. Covers FR-15, FR-06.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Calls go only to the configured S3 and S4” and observes the outcome below.

**Steps**:
1. Run a case that bootstraps, renews, publishes and subscribes.
2. Inspect every request the stub and a second listening host recorded.

**Expected outcome**: Bootstrap and renewal went to the S3 URL, publish and subscribe to the S4 URL; nothing went to any other host.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-15, FR-06

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-006 — Nothing is derived from the host or environment variables

**Context**: The instance identifier is asserted, never derived; no configuration comes from deployment metadata. Covers FR-15, FR-04.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver
- ESLint refuses `process.env`, `os.hostname`, `os.networkInterfaces` and `console` in `typescript/src/` (TS-U3-13)

**Scenario**: a tester, under the preconditions above, exercises “Nothing is derived from the host or environment variables” and observes the outcome below.

**Steps**:
1. Run the driver under two different hostnames and with unrelated environment variables set.
2. Create a client with an instance from `newInstanceId()` and bootstrap.

**Expected outcome**: No request carries anything derived from the host or the process environment; the instance identifier is the one supplied; the lint rule passes on `typescript/src/` and fails on a fixture that reads `process.env`. Cases: CC-CFG-06.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-15, FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-007 — Bootstrap sends exactly the contract's request

**Context**: Acquiring the credential is the first platform call every agent makes (done when 2). Covers FR-04.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Bootstrap sends exactly the contract's request” and observes the outcome below.

**Steps**:
1. Script a successful `exchangeBootstrap`.
2. Call `start()`.
3. Read the stub's recorded request.

**Expected outcome**: One `POST /agent-credentials` with the body exactly `{ agent, secret, instance }`, the header `Soorma-Contract-Version: 0.1.0`, no `Authorization` header, and no envelope; `start()` resolves and the credential's details are readable.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-008 — The provider is called once and the secret is not retained

**Context**: The secret exists only for the bootstrap that needs it. Covers FR-04.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “The provider is called once and the secret is not retained” and observes the outcome below.

**Steps**:
1. Use a counting test provider.
2. Call `start()`.
3. Ask the driver to `inspect` the runtime for the secret.

**Expected outcome**: The provider is called once for the bootstrap; after the request is written, the heap check (CDI-02, U1's `heap.ts`, imported by the TypeScript driver) finds no copy of the secret; `providerCalls` is 1. On a retried bootstrap the provider is called once per attempt and no earlier attempt's secret is held during the wait (SEC-01 reworded; TC-TH-079). Cases: CC-ACQ-01, CC-SEC-01, CC-ACQ-08.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`, construction/typescript-harness/nfr-design/nfr-design-patterns.md (P-08)

---

### TC-TH-009 — authentication_failed is surfaced and not retried

**Context**: A wrong secret, an unknown or revoked agent all answer the same `403`; retrying would only consume the abuse bound. Covers FR-04, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “authentication_failed is surfaced and not retried” and observes the outcome below.

**Steps**:
1. Script `403` with Problem code `authentication_failed`.
2. Call `start()`.

**Expected outcome**: `start()` fails with a `ProblemError` (status 403, code `authentication_failed`); the stub recorded one request.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-04, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-010 — too_many_attempts is surfaced with Retry-After and not retried

**Context**: The bootstrap abuse bound must not be consumed by automatic retries. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “too_many_attempts is surfaced with Retry-After and not retried” and observes the outcome below.

**Steps**:
1. Script `429` with code `too_many_attempts` and `Retry-After: 30`.
2. Call `start()`.

**Expected outcome**: `start()` fails with a `ProblemError` carrying code `too_many_attempts` and `retryAfter` 30; one request was recorded.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-011 — unavailable is retried after Retry-After, within the bound

**Context**: Bootstrap, renewal and subscribe ride out a short platform outage. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “unavailable is retried after Retry-After, within the bound” and observes the outcome below.

**Steps**:
1. Script `503 unavailable` with `Retry-After: 1` twice, then success.
2. Call `start()`.
3. Repeat with `503` beyond the retry bound.

**Expected outcome**: The bootstrap is retried after the `Retry-After` value, then succeeds. Without `Retry-After`, backoff is 0.5 s, 1 s, 2 s, 4 s (`B_init` 0.5 s, `B_factor` 2, `B_cap` 10 s). Retries stop at 5 attempts (`R_max`) or 60 s total wait (`W_max`), surfacing the last error. Each attempt calls the provider once. Cases: CC-PRB-04, CC-PRB-05, CC-ACQ-08.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`, construction/typescript-harness/nfr-requirements/nfr-requirements.md (the named values), construction/typescript-harness/nfr-design/nfr-design-patterns.md (P-01)

---

### TC-TH-012 — `fileSecret` reads an owner-only secret file

**Context**: The examples' secret source is a file the developer controls, never an environment variable. Covers FR-04.

**Preconditions**:
- A file with mode 0600 owned by the test's user, containing a secret and a trailing newline

**Scenario**: a tester, under the preconditions above, exercises “`fileSecret` reads an owner-only secret file” and observes the outcome below.

**Steps**:
1. Create a provider with `fileSecret(path)`.
2. Call it twice.

**Expected outcome**: Each call returns the secret without the trailing line ending; the file is read on each call.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-013 — `fileSecret` refuses an unsafe file without reading it

**Context**: A secret others can read, or someone else can replace, must not be used. Covers FR-04.

**Preconditions**:
- Files with: mode 0604 (others can read); mode 0620 (group can write); mode 0602 (others can write); owned by another non-root user
- `fileSecret` opens with `O_RDONLY | O_NONBLOCK` and checks the opened handle before reading (TH-SEC-01)

**Scenario**: a tester, under the preconditions above, exercises “`fileSecret` refuses an unsafe file without reading it” and observes the outcome below.

**Steps**:
1. Call `fileSecret(path)` for each file.
2. Inspect each error's message and string form.

**Expected outcome**: Each call fails with a `SecretSourceError` naming the path and the reason (others' read, group write, others' write, foreign owner), never the contents.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-014 — `fileSecret` allows group read and follows links to the final file

**Context**: Kubernetes secret volumes use group-readable files behind `..data` links. Covers FR-04.

**Preconditions**:
- A file with mode 0440 owned by root or the test's user
- A symlink chain to it like Kubernetes' `..data` layout

**Scenario**: a tester, under the preconditions above, exercises “`fileSecret` allows group read and follows links to the final file” and observes the outcome below.

**Steps**:
1. Call `fileSecret` on the symlink path.

**Expected outcome**: It returns the secret: the checks apply to the final file, which passes.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-015 — `fileSecret` refuses a named pipe or device without blocking

**Context**: A special file at the path must never hang the bootstrap. Covers FR-04.

**Preconditions**:
- A named pipe (FIFO) at the path with no writer
- On Linux, a path to a character device such as `/dev/zero`
- The open is non-blocking (`O_NONBLOCK`); the handle is checked with `stat()` before any read (TH-SEC-01)

**Scenario**: a tester, under the preconditions above, exercises “`fileSecret` refuses a named pipe or device without blocking” and observes the outcome below.

**Steps**:
1. Call `fileSecret` on each path with a timeout of one second.

**Expected outcome**: Each call fails promptly (well within the timeout) with a `SecretSourceError` stating the file is not a regular file.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-016 — No provider reads an environment variable

**Context**: Secrets never go in environment variables. Covers FR-04, FR-16.

**Preconditions**:
- The TypeScript package's public interface and source

**Scenario**: a tester, under the preconditions above, exercises “No provider reads an environment variable” and observes the outcome below.

**Steps**:
1. List the secret providers the package exports.
2. Search the package for reads of environment variables.

**Expected outcome**: `fileSecret` is the only provider exported; the package reads no environment variable anywhere.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-04, FR-16

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-017 — Renewal happens before expiry and replaces the credential

**Context**: A running agent must never present an expired credential. Covers FR-05.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Renewal happens before expiry and replaces the credential” and observes the outcome below.

**Steps**:
1. Script a bootstrap whose `expiresAt` is a few seconds ahead, and a renewal with a later `expiresAt`.
2. Call `start()` and wait past the first `expiresAt`.
3. Publish.

**Expected outcome**: Renewal was sent `H_renew` (120 s) before the first `expiresAt` by the wall clock, and no sooner than `R_min` (30 s) after the credential arrived, by the monotonic clock (REN-07), with the current credential and no body. The publish presents the renewed credential; the details show the new `expiresAt`. Cases: CC-REN-01.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-018 — At the end of a lineage the client bootstraps again

**Context**: The 24-hour lineage cap is reached by long-running agents. Covers FR-05. After construction design, the bootstrap decision goes through the one validity check (CDI-06).

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “At the end of a lineage the client bootstraps again” and observes the outcome below.

**Steps**:
1. Script renewal to answer `401 credential_expired`, then a successful bootstrap.
2. Let renewal run.

**Expected outcome**: The provider is called again and a new bootstrap is sent; later calls present the new credential.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-019 — A refused renewal is terminal

**Context**: Revocation is terminal; the SDK must never bootstrap around it. Covers FR-05, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A refused renewal is terminal” and observes the outcome below.

**Steps**:
1. Script renewal to answer `401 credential_refused`.
2. Let renewal run.
3. Then call `publish`.

**Expected outcome**: The client becomes revoked: no bootstrap follows, every later operation raises `ClientStateError` carrying the Problem, and an open subscription ends terminally. `credential_refused` on a **retried** renewal is treated the same way, terminal (soorma-sdk GAP-CAC-001, soorma-ai/soorma-core#34). Cases: CC-REN-04, CC-PRB-08.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-05, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-020 — The credential's details are readable; the credential is not

**Context**: Tenant code can see who and where it is, read only, never the bearer string. Covers FR-06, FR-15.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “The credential's details are readable; the credential is not” and observes the outcome below.

**Steps**:
1. Bootstrap.
2. Read the client's credential details.
3. Try to assign to them.

**Expected outcome**: `agent`, `instance`, `environment` (organization, project, environment) and `expiresAt` match the response; assignment fails; no property or method returns the credential string.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-06, FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-021 — The credential never appears in logs, errors or string forms

**Context**: A leaked bearer credential is a usable credential. Covers FR-06.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “The credential never appears in logs, errors or string forms” and observes the outcome below.

**Steps**:
1. Enable the most verbose logging the package has.
2. Bootstrap, publish, then provoke a Problem on each call.
3. Render the client, the details and each error as a string.

**Expected outcome**: No log is written by the SDK. The credential and the secret appear in no error message, `toString`, `toJSON` or `util.inspect` form of the client, `CredentialInfo` or any error class; the one diagnostic, the clock-skew warning, holds neither. Cases: CC-CRD-02.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-06

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-022 — The credential is presented only as a bearer header

**Context**: The credential travels in exactly one place. Covers FR-06.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “The credential is presented only as a bearer header” and observes the outcome below.

**Steps**:
1. Publish and subscribe.
2. Inspect the recorded requests.

**Expected outcome**: Each carries `Authorization: Bearer <credential>` once; no body, query or other header contains it.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-06

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-023 — A draft carries exactly the allowed members

**Context**: The platform stamps the envelope; the client drafts only what is its own. Covers FR-07.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A draft carries exactly the allowed members” and observes the outcome below.

**Steps**:
1. Publish a payload.
2. Read the recorded body's `draft`.

**Expected outcome**: `draft` has `clientContractVersion` `"0.1.0"` and `traceContext`, and nothing else.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-07

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-024 — No platform-stamped field can be set

**Context**: Stamped fields are the platform's; the SDK offers no way to set one. Covers FR-07, FR-16.

**Preconditions**:
- The TypeScript package's public interface

**Scenario**: a tester, under the preconditions above, exercises “No platform-stamped field can be set” and observes the outcome below.

**Steps**:
1. Look for any parameter that sets `envelopeVersion`, `scope`, `originMode`, `delegatingPrincipal`, `actorChain` or `reBroadening`.

**Expected outcome**: There is none.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-07, FR-16

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-025 — The draft carries the active span's trace context

**Context**: Trace context travels from the publisher's own tracing (done when 5). Covers FR-08.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver
- An OpenTelemetry SDK installed in the driver process

**Scenario**: a tester, under the preconditions above, exercises “The draft carries the active span's trace context” and observes the outcome below.

**Steps**:
1. Publish inside an active span.
2. Read the recorded `traceContext`.

**Expected outcome**: `traceparent` is valid W3C, carries the active trace id, and its parent id is the publish span's; `tracestate` is present only if the active context had one.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-08

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-026 — Without an OpenTelemetry SDK the draft still has a valid traceparent

**Context**: Many agents run without tracing configured; the platform still requires a valid traceparent. Covers FR-08.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver
- No OpenTelemetry SDK installed

**Scenario**: a tester, under the preconditions above, exercises “Without an OpenTelemetry SDK the draft still has a valid traceparent” and observes the outcome below.

**Steps**:
1. Publish twice.
2. Read both recorded `traceparent` values.

**Expected outcome**: The draft carries a valid `traceparent`: version `00`, a random trace id and span id from `crypto.randomBytes`, never all-zero, flags `00`. Cases: CC-TRC-02.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-08

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-027 — A forwarded call asserts its own trace context

**Context**: The forwarded envelope's trace context is evidence of the previous hop, not this hop's assertion. Covers FR-08, FR-09. The SDK parses the received `traceparent` itself, never through the global propagator, which may be unset (TH-SPN-02).

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A forwarded call asserts its own trace context” and observes the outcome below.

**Steps**:
1. Receive a Delivery whose envelope carries a `traceparent` T.
2. Publish in response through the Delivery.
3. Read the recorded draft.

**Expected outcome**: The draft's `traceContext.traceparent` is this hop's own, and is not T copied; T appears only inside the forwarded envelope text.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-08, FR-09

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-028 — Publishing through a Delivery forwards its context by default

**Context**: Forwarding is the default path when acting on an event. Covers FR-09.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Publishing through a Delivery forwards its context by default” and observes the outcome below.

**Steps**:
1. Receive a Delivery.
2. Call the Delivery's publish with a payload.
3. Read the recorded draft.

**Expected outcome**: The draft carries `inbound: { envelope, seal }` from that Delivery; the tenant code did not assemble it.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-09

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-029 — The forwarded envelope is the received text, byte for byte

**Context**: Re-serializing would lose unknown fields, member order or number spellings that the seal covers. Covers FR-09, FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “The forwarded envelope is the received text, byte for byte” and observes the outcome below.

**Steps**:
1. Script a Delivery whose envelope has unknown fields, an unusual member order and a number written `1.0`.
2. Forward it.
3. Compare the recorded `inbound.envelope` bytes with the delivered envelope bytes.

**Expected outcome**: They are identical, byte for byte; the seal is identical to the one received.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-09, FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-030 — Publishing on the client does not forward

**Context**: Dropping context takes a deliberate, separate call. Covers FR-09.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Publishing on the client does not forward” and observes the outcome below.

**Steps**:
1. Receive a Delivery.
2. Call the client's publish (not the Delivery's).
3. Read the recorded draft.

**Expected outcome**: The draft has no `inbound` member.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-09

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-031 — Refused forwarding is surfaced as given

**Context**: The SDK infers nothing about why the platform refused a forwarded call. Covers FR-09, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Refused forwarding is surfaced as given” and observes the outcome below.

**Steps**:
1. Script `400 invalid_inbound_context`, then `400 chain_too_deep`, then `403 forbidden` for three forwarded publishes.

**Expected outcome**: Each publish fails with a `ProblemError` carrying exactly the scripted status and code; none is retried.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-09, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-032 — A 202 is reported as accepted

**Context**: Publishing is the start of done when 3. Covers FR-10.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A 202 is reported as accepted” and observes the outcome below.

**Steps**:
1. Script `202` with no body.
2. Publish a payload.

**Expected outcome**: Publish resolves with a result that says accepted (with the trace context used), never delivered; one `POST /events` with `{ draft, payload }` was recorded.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-10

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-033 — Bodies are compact JSON without ASCII or HTML escaping

**Context**: The platform's body limits and canonical forms assume compact, unescaped JSON. Covers FR-10.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Bodies are compact JSON without ASCII or HTML escaping” and observes the outcome below.

**Steps**:
1. Publish a payload containing `<`, `>`, `&`, `é` and an emoji.
2. Read the recorded body bytes.

**Expected outcome**: The body has no insignificant whitespace, no duplicate member names, and the characters appear literally in UTF-8, not as `\u` escapes.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-10

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-034 — A failed publish is never retried

**Context**: A retried publish could duplicate an event. Covers FR-10, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A failed publish is never retried” and observes the outcome below.

**Steps**:
1. Script `503 unavailable` with `Retry-After: 1`.
2. Publish.

**Expected outcome**: Publish fails with the `ProblemError`; the stub recorded exactly one request.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-10, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-035 — An oversized publish is surfaced as the platform's Problem

**Context**: Size limits are enforced by the platform; the SDK reports them. Covers FR-10, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “An oversized publish is surfaced as the platform's Problem” and observes the outcome below.

**Steps**:
1. Script `413 payload_too_large`.
2. Publish a large payload.

**Expected outcome**: Publish fails with a `ProblemError` with status 413 and code `payload_too_large`.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-10, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-036 — Subscribing opens a stream and yields its items

**Context**: A subscribed agent receives what others publish (done when 3). Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Subscribing opens a stream and yields its items” and observes the outcome below.

**Steps**:
1. Script a stream with two `delivery` events.
2. Subscribe and read three items.

**Expected outcome**: One `POST /subscriptions` with `{ draft }` and the credential was recorded; the items are a stream-started item, then two Deliveries.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-037 — Heartbeats are consumed silently

**Context**: Heartbeat comments keep the connection alive and mean nothing to tenant code. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Heartbeats are consumed silently” and observes the outcome below.

**Steps**:
1. Script a stream with heartbeat comments between two deliveries.
2. Read the items.

**Expected outcome**: Heartbeat comment lines yield nothing and reset `T_idle` (45 s), which counts only while the stream is being read. Cases: CC-SUB-02.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-038 — A stream end is surfaced with its code

**Context**: Each end tells tenant code a stream stopped and why. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A stream end is surfaced with its code” and observes the outcome below.

**Steps**:
1. Script streams ending with `end` codes `unavailable` and `overflow`.

**Expected outcome**: Each yields a stream-ended item with that code, marked not terminal.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-039 — An unknown end code is surfaced, not fatal

**Context**: End codes are an open set. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “An unknown end code is surfaced, not fatal” and observes the outcome below.

**Steps**:
1. Script an `end` with code `brand_new_code`.

**Expected outcome**: A stream-ended item with code `brand_new_code` is yielded and the SDK does not fail.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-040 — A dropped connection is a stream end with no code

**Context**: A stream can end without an `end` event; tenant code must still see it. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A dropped connection is a stream end with no code” and observes the outcome below.

**Steps**:
1. Script a stream that closes the connection without an `end` event.

**Expected outcome**: A connection that ends without an `end` event, or 45 s (`T_idle`) of silence while the SDK is reading the stream, yields *stream ended* with `code: null`, then a resubscribe with backoff. A stream paused because tenant code has not pulled does not time out (TC-TH-077). Cases: CC-STR-02.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-041 — Across renewal a new stream starts and both boundaries are surfaced

**Context**: Live-only delivery means a boundary is where events can be missed; tenant code must see every one. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Across renewal a new stream starts and both boundaries are surfaced” and observes the outcome below.

**Steps**:
1. Script a short `expiresAt`, a renewal, and a stream that ends `superseded` once the replacement opens.
2. Read items across the renewal.
3. Inspect the second subscribe request.

**Expected outcome**: On renewal the SDK opens the next stream before the credential expires and **pauses it once open**. It yields the old stream's remaining Deliveries, *stream ended* (`superseded`), *stream started*, then the new stream's Deliveries. `W_super` (10 s) counts only while the old stream is read; if it expires, the SDK closes the old stream and yields *stream ended* with `code: null`. Cases: CC-STR-04, CC-STR-05, CC-STR-13.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-042 — A revoked stream ends the subscription

**Context**: Revocation is terminal for streams too. Covers FR-11, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A revoked stream ends the subscription” and observes the outcome below.

**Steps**:
1. Script an `end` with code `credential_refused`.

**Expected outcome**: A stream-ended item with code `credential_refused`, marked terminal, is yielded; the iterator then finishes; no new bootstrap or subscribe is sent.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-11, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-043 — At most one stream per credential lineage

**Context**: A second stream on a lineage supersedes the first; the SDK must not cause that by accident. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “At most one stream per credential lineage” and observes the outcome below.

**Steps**:
1. Subscribe and run through a renewal.
2. Count concurrently open streams recorded by the stub.

**Expected outcome**: Never more than one, except for the moment a replacement supersedes the previous stream.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-044 — A failed subscribe is surfaced; unavailable is retried

**Context**: Subscribe shares bootstrap's retry rule and surfaces every other failure. Covers FR-11, FR-13. The resubscribe after a failure decides validity through the one validity check (CDI-06), and retries per the one retry policy (P-01).

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A failed subscribe is surfaced; unavailable is retried” and observes the outcome below.

**Steps**:
1. Script `401 credential_refused`, then (fresh client) `403 forbidden`, then (fresh client) `503` with `Retry-After: 1` once followed by a stream.

**Expected outcome**: The first two subscriptions end with the `ProblemError` as scripted; the third opens its stream after one retry spaced at least one second.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-11, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-045 — A Delivery exposes envelope, envelope text, seal and payload

**Context**: Tenant code needs both the parsed envelope and its exact text. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A Delivery exposes envelope, envelope text, seal and payload” and observes the outcome below.

**Steps**:
1. Script a delivery with a known envelope, seal and payload.
2. Read the Delivery.

**Expected outcome**: The parsed envelope is read only; the envelope text equals the delivered bytes; the seal is as delivered; the payload is parsed and its source text is available.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-046 — Extraction does not depend on member order

**Context**: The contract promises no member order in a Delivery line. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Extraction does not depend on member order” and observes the outcome below.

**Steps**:
1. Script the same Delivery in every order of its `envelope`, `seal` and `payload` members.

**Expected outcome**: Every order yields an identical Delivery.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-047 — Unknown fields and values are kept, not fatal

**Context**: Consumers must tolerate and preserve what they do not know. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Unknown fields and values are kept, not fatal” and observes the outcome below.

**Steps**:
1. Script the contract's fixtures with unknown fields at every level and an unknown `originMode`.

**Expected outcome**: No error; the unknown fields and value are present in the parsed envelope and in its text.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-048 — Received identifiers are opaque

**Context**: Received identifiers are never syntax-checked. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Received identifiers are opaque” and observes the outcome below.

**Steps**:
1. Script the fixture with identifiers that the request-side patterns would reject.

**Expected outcome**: The Delivery is yielded with the identifiers exactly as received.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-049 — Payload numbers are native, with the source text available

**Context**: Large or precise numbers must not be silently changed for tenant code. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Payload numbers are native, with the source text available” and observes the outcome below.

**Steps**:
1. Script a payload with `1.0`, `1e400` and a 30-digit integer.

**Expected outcome**: The parsed payload uses native numbers; the payload source text contains the exact spellings.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-050 — A payload deeper than the bound falls back to raw text

**Context**: A deep payload must never cost the envelope or the seal. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A payload deeper than the bound falls back to raw text” and observes the outcome below.

**Steps**:
1. Script a payload nested beyond the depth the TypeScript conformance driver reports.
2. Read the Delivery.
3. Forward it.

**Expected outcome**: A payload nested deeper than `D_lang` (512) is yielded with `payloadParsed: false`, `payload` absent, `payloadText` kept, and the envelope and seal intact and forwardable. The scanner is iterative, so a line 10× deeper than `D_lang` neither overflows the stack nor delays the stream. Cases: CC-RCV-06.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-051 — An unreadable Delivery line is an error item and the stream continues

**Context**: One bad line must not end a subscription. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “An unreadable Delivery line is an error item and the stream continues” and observes the outcome below.

**Steps**:
1. Script a stream with a non-JSON line, a line missing `seal`, and then a valid delivery.

**Expected outcome**: Two delivery-error items are yielded, then the valid Delivery; the stream stays open.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-052 — Unknown Problem codes and members are kept

**Context**: Problem codes are an open set. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Unknown Problem codes and members are kept” and observes the outcome below.

**Steps**:
1. Script a `400` Problem with code `new_code` and an extra member.

**Expected outcome**: A `ProblemError` with code `new_code` is raised, and its full Problem includes the extra member.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-053 — forbidden is surfaced without inference

**Context**: The SDK does not guess why authority was refused. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “forbidden is surfaced without inference” and observes the outcome below.

**Steps**:
1. Script `403 forbidden` on publish.

**Expected outcome**: The `ProblemError` carries status 403 and code `forbidden`, and its message adds no cause.

**Scope**: negative · **Priority**: Medium

**Source**: typescript-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-054 — Every error path releases its resources

**Context**: Leaked connections and timers accumulate in long-running agents. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Every error path releases its resources” and observes the outcome below.

**Steps**:
1. Provoke each failure (TLS error, Problem on each operation, dropped stream), then call `close()`.
2. Ask the driver for open connections, streams and timers.

**Expected outcome**: After each failure, and after `close()` in every client and subscription state, no socket, request or timer remains (`process.getActiveResourcesInfo()` shows none of the SDK's). `close()` is idempotent: a second call returns the same promise. No unhandled rejection occurs. Cases: CC-PRB-07.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-055 — Spans are emitted through the OpenTelemetry API under messaging conventions

**Context**: The agent's operations appear in the tenant's own tracing (done when 5). Covers FR-14.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver
- An OpenTelemetry SDK with an in-memory exporter installed by the test

**Scenario**: a tester, under the preconditions above, exercises “Spans are emitted through the OpenTelemetry API under messaging conventions” and observes the outcome below.

**Steps**:
1. Publish, receive a Delivery, and forward it.
2. Read the exported spans.

**Expected outcome**: Send (producer) and receive (consumer) spans follow OpenTelemetry semantic conventions **1.45.0** for messaging, with `messaging.system` `soorma` and no soorma-defined span name or attribute. Cases: CC-SPN-01.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-14

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-056 — The SDK installs no exporter and no sampler

**Context**: Where spans go is the tenant's decision. Covers FR-14.

**Preconditions**:
- The TypeScript package's dependencies and source

**Scenario**: a tester, under the preconditions above, exercises “The SDK installs no exporter and no sampler” and observes the outcome below.

**Steps**:
1. List the package's runtime dependencies.
2. Search the package for exporter or sampler set-up.

**Expected outcome**: `@soorma/sdk` declares `@opentelemetry/api` as a peer dependency (`^1.9.0`) and installs no exporter, sampler or provider. Conformance passes with API 1.10.0 and with 1.9.0. Cases: CC-SPN-07.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-14

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-057 — No human-side operation, delegation or commercial code

**Context**: The SDK never holds a human credential and offers no delegation in M1. Covers FR-16.

**Preconditions**:
- The TypeScript package's public interface, source and generated types

**Scenario**: a tester, under the preconditions above, exercises “No human-side operation, delegation or commercial code” and observes the outcome below.

**Steps**:
1. Look for any API taking a sign-in, an environment credential or a delegation credential.
2. Search for the `Soorma-Delegation` header.
3. Look for generated S1 or S2 types.

**Expected outcome**: None exists; the header is never sent; only agent-side types are generated.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-16

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-058 — The package builds and installs from the repository, unpublished

**Context**: Developers install from this repository in M1. Covers FR-18.

**Preconditions**:
- A clean environment with Node.js 24 and 26
- The `package-typescript` job (NFR-U3-22)

**Scenario**: a tester, under the preconditions above, exercises “The package builds and installs from the repository, unpublished” and observes the outcome below.

**Steps**:
1. Build the package (`tsc` to `dist/`) and pack it (`pnpm pack`); run the packaging guard over the tarball's file list.
2. In a fresh project outside the workspace, install the tarball and `@opentelemetry/api`.
3. Run an ESM file that `import`s `@soorma/sdk` and constructs an `AgentClient`.
4. Run a CommonJS file that `require()`s `@soorma/sdk` and constructs an `AgentClient`.

**Expected outcome**: The tarball holds only `dist/`, the README and the licence files, and the guard finds nothing test-only. Both files run on Node 24 and 26; each `AgentClient` is constructed without contacting anything. The `exports` map is `"types"` then `"default"`, so `require()` resolves. The metadata states Apache-2.0; nothing was published.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-18

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-059 — Every conformance case passes on every supported runtime

**Context**: A language is not complete until it passes every case. Covers FR-18, FR-03.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver
- The `conformance-typescript` job: Node 24 and 26 with `@opentelemetry/api` 1.10.0, and Node 24 with 1.9.0; the second local user created (`sudo useradd soorma-foreign`) and passed with `--foreign-user` (OBL-04)

**Scenario**: a tester, under the preconditions above, exercises “Every conformance case passes on every supported runtime” and observes the outcome below.

**Steps**:
1. Run the runner with the TypeScript driver on each matrix entry, with `--foreign-user soorma-foreign`.
2. Read each run's report.

**Expected outcome**: Every case passes and none is skipped, CC-SEC-05 included, on each entry: U1's 90 cases plus CC-REN-06, CC-REN-07, CC-STR-12, CC-STR-13 and CC-ACQ-08. Each run stays within the 8-minute suite budget (NFR-U1-02). `--local-skip` is refused in CI. **A case that fails is judged first, SDK or case (CDI-05)**; a case fix is a recorded change to an earlier unit's tests (F42), never a quiet edit.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-18, FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-060 — Exported names match the name table

**Context**: One naming convention across languages. Covers FR-17, FR-18.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Exported names match the name table” and observes the outcome below.

**Steps**:
1. Run the names check for this package.

**Expected outcome**: Every exported name is in the table's TypeScript column and every name in that column is exported.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-17, FR-18

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-061 — Both agents bootstrap and one renews (done when 2)

**Context**: The first of M1's three proofs through the SDK. Covers FR-19.

**Preconditions**:
- A fresh stack and secret files from `e2e/core-up` and `e2e/setup` (U2)
- The TypeScript end-to-end test with a test-installed in-memory exporter
- The `e2e-typescript` job (JOB-06), after `prove-stack`, on Node 24; both agents in the test's one process

**Scenario**: a tester, under the preconditions above, exercises “Both agents bootstrap and one renews (done when 2)” and observes the outcome below.

**Steps**:
1. Before `start()`, fake only `Date` (Vitest `toFake: ['Date']`), 14 minutes ahead.
2. Start A and B with `fileSecret` reading their secret files from `.e2e/stack.json`.
3. Wait for B's renewal; then watch for `R_min` (30 s) more.
4. Collect `process` warnings with code `SOORMA_CLOCK_SKEW`.
5. Restore the real `Date`.

**Expected outcome**: Both hold credentials naming their agent and environment `e`. B's `credential.expiresAt` moves once: one real renewal from S3. There is no second renewal within `R_min`, and exactly one clock-skew warning per client lineage. The real `Date` is restored before closing.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-062 — B receives what A publishes (done when 3)

**Context**: Delivery is live only: B subscribes before A publishes. Covers FR-19.

**Preconditions**:
- A fresh stack and secret files from `e2e/core-up` and `e2e/setup` (U2)
- The TypeScript end-to-end test with a test-installed in-memory exporter
- Both agents in the test's one process (TH-E2E-02); each reads its own secret file through `fileSecret`

**Scenario**: a tester, under the preconditions above, exercises “B receives what A publishes (done when 3)” and observes the outcome below.

**Steps**:
1. B subscribes and waits for its stream-started item.
2. A publishes a payload.
3. B reads the next items.

**Expected outcome**: B receives a Delivery whose payload is A's, with an envelope and a seal.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-063 — The trace travels and a span is emitted (done when 5)

**Context**: The third proof: trace context crosses the platform. Covers FR-19, FR-14.

**Preconditions**:
- A fresh stack and secret files from `e2e/core-up` and `e2e/setup` (U2)
- The TypeScript end-to-end test with a test-installed in-memory exporter
- A **decoy span**, created by the test and active around B's `subscribe()` and its loop

**Scenario**: a tester, under the preconditions above, exercises “The trace travels and a span is emitted (done when 5)” and observes the outcome below.

**Steps**:
1. Start the decoy span; inside it, B subscribes and starts its loop.
2. Outside it, A publishes.
3. B receives the Delivery.
4. Read the in-memory exporter.

**Expected outcome**: B's receive span has A's trace id, and its parent span id is A's send span id. Both match the `traceparent` on the envelope B received. **The decoy is neither the receive span's parent nor linked from it** (SPN-03; the user's ruling). A test that could pass on the ambient context would not prove SPN-03.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-19, FR-14

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-064 — The example runs and prints the envelope and trace id

**Context**: The example is what a developer runs first. Covers FR-20. Each agent file has one marked configuration block and exports `run(config)` (TH-E2E-01).

**Preconditions**:
- A fresh stack and secret files from U2 at the paths the example's configuration names

**Scenario**: a tester, under the preconditions above, exercises “The example runs and prints the envelope and trace id” and observes the outcome below.

**Steps**:
1. Run the TypeScript example (`typescript/examples/two-agents/`): B first, then A.

**Expected outcome**: B prints the envelope it received and the trace id.

**Scope**: happy-path · **Priority**: Medium

**Source**: typescript-harness / FR-20

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-065 — The agent file copies into a new project

**Context**: A developer starts their own agent from the example. Covers FR-20.

**Preconditions**:
- A new, empty TypeScript project
- The `package-typescript` job: the agent file is copied into the fresh project, type-checked and imported (NFR-U3-22)

**Scenario**: a tester, under the preconditions above, exercises “The agent file copies into a new project” and observes the outcome below.

**Steps**:
1. Copy one agent file from `typescript/examples/two-agents/` into the project.
2. Install the package from the repository.
3. Edit only the marked configuration block and run it.

**Expected outcome**: It builds and runs as a single agent. The configuration block holds the S3 and S4 addresses, the CA path, the agent identifier, the secret source as a `fileSecret` path (never the secret) and the instance identifier; nothing else needed editing; the file uses only the public interface and holds no human credential.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-20

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-066 — The example's README states what is not promised

**Context**: Developers must know delivery is live only and the span shape is unstable. Covers FR-20.

**Preconditions**:
- The README in `typescript/examples/two-agents/`

**Scenario**: a tester, under the preconditions above, exercises “The example's README states what is not promised” and observes the outcome below.

**Steps**:
1. Read the README.

**Expected outcome**: The README says that delivery is live only (start B first), that the span shape is unstable (with DEC-U1-01's deviation), `fileSecret`'s file settings and that Windows tenants supply their own provider, what the `SOORMA_CLOCK_SKEW` warning means (fix the clock), and that the package is ESM, loadable by `require()` on Node 24 or later.

**Scope**: happy-path · **Priority**: Low

**Source**: typescript-harness / FR-20

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-067 — `fileSecret` is refused on Windows without opening the path

**Context**: SEC-09 leaves Windows to each language; TypeScript refuses rather than read a file it cannot check (TH-SEC-02). Covers FR-04.

**Preconditions**:
- The package's unit tests (Vitest), in the `unit` job
- `process.platform` stubbed as `win32`

**Scenario**: A provider from `fileSecret` is called on Windows.

**Steps**:
1. Call the provider for an existing path.

**Expected outcome**: `SecretSourceError` with reason `unsupported-platform` and the path; the file was not opened.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/functional-design/business-rules.md` (TH-SEC-02)

---

### TC-TH-068 — A delivery line with a duplicate `envelope`, `seal` or `payload` is a delivery error

**Context**: A duplicate member makes the line ambiguous; `JSON.parse` would take the last silently (TH-RD-02). Covers FR-12.

**Preconditions**:
- The package's unit tests (Vitest), in the `unit` job

**Scenario**: The scanner reads lines with a duplicated member.

**Steps**:
1. Feed a line with two `envelope` members; then two `seal`; then two `payload`.
2. Feed a line with a duplicated unknown member.

**Expected outcome**: Each of the first three is a `DeliveryError` (reason `duplicate-member`) and the stream continues; the last is a Delivery.

**Scope**: negative · **Priority**: Medium

**Source**: typescript-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/functional-design/business-rules.md` (TH-RD-02)

---

### TC-TH-069 — Every member of the `Envelope` type is optional

**Context**: The SDK never checks a received envelope, so its type claims no member is present (CDI-04; RCV-08). Covers FR-12.

**Preconditions**:
- The package's type tests (`tsc --noEmit` over a fixture)

**Scenario**: Tenant code reads an envelope member without a check.

**Steps**:
1. Compile a fixture that reads `delivery.envelope.eventId.length` without checking it.
2. Compile one that checks it first.

**Expected outcome**: The first fails to compile (possibly undefined); the second compiles. Unknown members are typed `JsonValue | undefined`.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/functional-design/business-rules.md` (TH-RD-05)

---

### TC-TH-070 — `publish` refuses a payload JSON cannot carry exactly, naming the path, never the value

**Context**: JSON would silently change `NaN`, `undefined`, a `Date` or a `Map` (TH-PUB-01). Depth is not limited (PUB-04). Covers FR-10.

**Preconditions**:
- The package's unit tests (Vitest), in the `unit` job

**Scenario**: Tenant code publishes values JSON cannot carry exactly.

**Steps**:
1. Publish payloads holding, in turn: `NaN`, `Infinity`, `undefined`, a function, a symbol, a `bigint`, a cycle, a `Date`, a `Map`.
2. Publish a payload 10× `D_lang` deep.
3. Publish one deep enough to overflow `JSON.stringify`'s stack.

**Expected outcome**: Each value in step 1 throws a `TypeError` naming its path (`$.a[2].b`) and kind, never the value, before any request. The step 2 payload is sent as given. Step 3 throws a `TypeError` saying the payload is too deeply nested to serialize, before any request.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-10

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/functional-design/business-rules.md` (TH-PUB-01)

---

### TC-TH-071 — Leaving a loop closes the subscription; the renewal timer alone does not keep the process alive

**Context**: TypeScript's resource idiom (TH-LIFE-02, -03). Covers FR-11.

**Preconditions**:
- The package's unit tests (Vitest), in the `unit` job
- A child Node process for the exit check

**Scenario**: Tenant code breaks out of a `for await` loop; a process closes its client and exits.

**Steps**:
1. `break` out of a `for await` over a subscription.
2. In a child process, start a client against the stub, close its subscription, drop the client, and end the script.

**Expected outcome**: The `break` closes the subscription and its stream. The child process exits within a second, without `close()` on the client: the renewal timer is `unref`'d.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/functional-design/business-rules.md` (TH-LIFE-02, -03)

---

### TC-TH-072 — A client whose clock runs fast renews at most once per `R_min` and warns once per lineage

**Context**: REN-07: a fast clock must not make the SDK renew in a tight loop (the user). Covers FR-05.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver
- The package's unit tests (Vitest), in the `unit` job

**Scenario**: The stub answers each bootstrap and renewal with an `expiresAt` already inside `H_renew` of the client's clock.

**Steps**:
1. Run CC-REN-06.
2. Unit test: fake timers, the wall clock moved ahead with `vi.setSystemTime`; start; advance several `R_min`.

**Expected outcome**: Renewals are at least `R_min` (30 s) apart; exactly one `SOORMA_CLOCK_SKEW` warning per lineage, holding no credential.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/functional-design/business-rules.md` (TH-REN-01 to 03), `construction/typescript-harness/nfr-design/nfr-design-patterns.md` (P-03)

---

### TC-TH-073 — An envelope nested deeper than `D_lang` is a delivery error; the stream continues

**Context**: The platform's envelope must never exhaust the stack (TH-RD-03). Covers FR-12.

**Preconditions**:
- The package's unit tests (Vitest), in the `unit` job

**Scenario**: The scanner reads a line whose envelope nests deeper than 512.

**Steps**:
1. Feed the line, then an ordinary Delivery.

**Expected outcome**: A `DeliveryError` (reason `envelope-too-deep`), then the Delivery.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: typescript-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/functional-design/business-rules.md` (TH-RD-03)

---

### TC-TH-074 — An unknown option, such as a misspelt TLS switch, is refused

**Context**: No misspelt option can pass silently (TH-API-03). Covers FR-15.

**Preconditions**:
- The package's unit tests (Vitest), in the `unit` job

**Scenario**: Tenant code passes an option the client does not have.

**Steps**:
1. Construct `AgentClient` with an extra `rejectUnauthorized: false` member.

**Expected outcome**: A `TypeError` naming the unknown member; nothing is contacted.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/functional-design/business-rules.md` (TH-API-03)

---

### TC-TH-075 — A client whose clock runs more than a lifetime ahead uses its credential until S3 answers `credential_expired`, then bootstraps once

**Context**: REN-07's addition: no bootstrap before every operation on a skewed lineage (the user). Covers FR-05.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: The stub issues a credential whose `expiresAt` is already past on the client's clock.

**Steps**:
1. Run CC-REN-07: start, publish three times within `R_min`, wait for the floored renewal (answered `credential_expired`), publish once more.

**Expected outcome**: Exactly two bootstraps. The first three publishes present the first credential with no bootstrap before them, and the last presents the second. One warning.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/functional-design/business-rules.md` (TH-REN-01, -05)

---

### TC-TH-076 — On a skewed lineage, a `503` on renewal is retried and a dropped stream is resubscribed, without a bootstrap

**Context**: CDI-06: one validity check, used everywhere "while the credential is valid" is decided (the user). Covers FR-05, FR-11.

**Preconditions**:
- The package's unit tests (Vitest), in the `unit` job

**Scenario**: A lineage with the clock-skew warning meets a `503` on renewal and a dropped stream.

**Steps**:
1. Fake timers; skew the wall clock past `expiresAt`; answer the renewal `503` then `200`.
2. Drop the stream.
3. Search `typescript/src/` for an `expiresAt` comparison outside `keeper.isUsable`.

**Expected outcome**: The renewal is retried and succeeds; the stream is resubscribed; no bootstrap occurs. The search finds no other comparison.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-05, FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/nfr-design/nfr-design-patterns.md` (P-02); CDI-06

---

### TC-TH-077 — A stream paused for backpressure does not time out; a resume restarts `T_idle`

**Context**: STR-02's added sentence: `T_idle` counts only while the SDK reads (the user). Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver
- The package's unit tests (Vitest), in the `unit` job

**Scenario**: A consumer does not pull for longer than `T_idle`.

**Steps**:
1. Run CC-STR-12: hold the stream unpulled for longer than `T_idle` (45 s), then pull.
2. Unit test with fake timers: fill the queue, advance past `T_idle`, pull, then stay silent.

**Expected outcome**: No *stream ended* with `code: null` and no second `POST /subscriptions`; every Delivery arrives in order once pulled. After the resume, `T_idle` of silence while reading does count as dropped.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/nfr-design/nfr-design-patterns.md` (P-04)

---

### TC-TH-078 — A replacement with a full buffer yields the old stream's remaining Deliveries, its `superseded` end, then the new stream's

**Context**: STR-05's added sentence: the new stream is paused until the old one ends (the user). Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: A renewal opens a replacement while `N_buf` items are unpulled.

**Steps**:
1. Run CC-STR-13.

**Expected outcome**: The old stream's remaining Deliveries, *stream ended* (`superseded`), *stream started*, then the new stream's Deliveries; no *stream ended* with `code: null` (no `W_super` close).

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/nfr-design/nfr-design-patterns.md` (P-04)

---

### TC-TH-079 — A retried bootstrap calls the provider once per attempt and holds no secret during the wait

**Context**: SEC-01 reworded (the user): once per bootstrap attempt, and SEC-02 between attempts. Covers FR-04.

**Preconditions**:
- The conformance runner and stub (U1)
- The TypeScript conformance driver

**Scenario**: The stub answers a bootstrap `503` with `Retry-After`, then `200`.

**Steps**:
1. Run CC-ACQ-08; if the protocol allows, run the heap check during the wait.

**Expected outcome**: Exactly two provider calls and two requests; during the wait the heap check finds no copy of the first attempt's secret.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/nfr-design/nfr-design-patterns.md` (P-08)

---

### TC-TH-080 — A bad CA file fails `start()` before anything is sent

**Context**: The trust store is built at `start()` (P-06). Covers FR-15.

**Preconditions**:
- The package's unit tests (Vitest), in the `unit` job

**Scenario**: The CA file is missing, unreadable, or not PEM.

**Steps**:
1. Construct a client with each bad `caFile`; call `start()`.

**Expected outcome**: Construction succeeds (no I/O). `start()` fails with `TransportError` (reason `ca-file`, naming the path, never the contents); no request reaches the stub.

**Scope**: negative · **Priority**: Medium

**Source**: typescript-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/code/`

**Technical references**: `construction/typescript-harness/nfr-design/nfr-design-patterns.md` (P-06)

---
