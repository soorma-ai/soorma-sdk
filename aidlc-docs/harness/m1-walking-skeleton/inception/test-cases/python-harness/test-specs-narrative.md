# Test Specifications — python-harness

Inception pass, scope **comprehensive** (`aidlc-state.md`, *Extension Configuration*). Sources: `inception/application-design/unit-of-work.md` and `inception/requirements/requirements.md` only. Unit abbreviation: PH = python-harness. Scope tags: happy-path, negative, edge/boundary.

---

### TC-PH-001 — Creating a client contacts nothing

**Context**: Configuration is explicit and local; creating a client must not reach the platform. Covers FR-15.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Creating a client contacts nothing” and observes the outcome below.

**Steps**:
1. Script the stub to record any request.
2. Create a client with S3 and S4 URLs, an agent, an instance and a secret provider.

**Expected outcome**: The client is created; the stub records no request; the secret provider has not been called.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-002 — No environment identifier is accepted

**Context**: Scope comes from the credential; an environment setting would let tenant code assert scope. Covers FR-15.

**Preconditions**:
- The Python package's public interface

**Scenario**: a tester, under the preconditions above, exercises “No environment identifier is accepted” and observes the outcome below.

**Steps**:
1. Inspect the client options' type.
2. Try to create a client with an extra environment option.

**Expected outcome**: The options define no environment field; the extra option is rejected (a type error in TypeScript, an unexpected-argument error in Python) and no request is made.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-003 — A supplied CA is trusted; an untrusted certificate fails

**Context**: TLS verification is always on; the local stack's CA is added, not a bypass. Covers FR-15.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A supplied CA is trusted; an untrusted certificate fails” and observes the outcome below.

**Steps**:
1. Create a client with `ca_file` set to the run's CA and bootstrap against the stub.
2. Repeat against a stub presenting a certificate from a different CA.

**Expected outcome**: The first bootstrap succeeds; the second fails with a `TransportError` naming a TLS verification failure, and no request body reaches the second server. **Construction design**: The context is `ssl.create_default_context()` (hostname checking, TLS 1.2 minimum) plus `load_verify_locations(ca_file)`, built at `start()`; a missing, unreadable or non-PEM CA file is `TransportError` (`ca-file`, the path) with nothing sent; a verification failure is `TransportError` (`tls`), never retried, its message naming no certificate detail.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-004 — There is no option to disable TLS verification

**Context**: A verification switch is the most common way client libraries become insecure. Covers FR-15.

**Preconditions**:
- The Python package's public interface and source

**Scenario**: a tester, under the preconditions above, exercises “There is no option to disable TLS verification” and observes the outcome below.

**Steps**:
1. Search the options and the package for any setting that disables certificate verification.

**Expected outcome**: None exists. **Construction design**: `AgentClientOptions` is a frozen keyword-only dataclass: an unknown keyword, such as a misspelt verification switch, is a `TypeError` at construction.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-005 — Calls go only to the configured S3 and S4

**Context**: The credential is presented only to the endpoints of the environment the tenant configured. Covers FR-15, FR-06.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Calls go only to the configured S3 and S4” and observes the outcome below.

**Steps**:
1. Run a case that bootstraps, renews, publishes and subscribes.
2. Inspect every request the stub and a second listening host recorded.

**Expected outcome**: Bootstrap and renewal went to the S3 URL, publish and subscribe to the S4 URL; nothing went to any other host.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-15, FR-06

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-006 — Nothing is derived from the host or environment variables

**Context**: The instance identifier is asserted, never derived; no configuration comes from deployment metadata. Covers FR-15, FR-04.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Nothing is derived from the host or environment variables” and observes the outcome below.

**Steps**:
1. Run the driver under two different hostnames and with unrelated environment variables set.
2. Create a client with an instance from `new_instance_id()` and bootstrap.

**Expected outcome**: The bootstrap's `instance` equals the supplied value; no request carries the hostname or any environment variable's value; `new_instance_id()` returns a UUID v4 that differs between calls. **Construction design**: `ruff`'s banned-API rules refuse `os.environ`, `os.getenv`, `socket.gethostname`, `platform.node` and `print` in `python/src/soorma/`, in the unit job.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-15, FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-007 — Bootstrap sends exactly the contract's request

**Context**: Acquiring the credential is the first platform call every agent makes (done when 2). Covers FR-04.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Bootstrap sends exactly the contract's request” and observes the outcome below.

**Steps**:
1. Script a successful `exchangeBootstrap`.
2. Call `start()`.
3. Read the stub's recorded request.

**Expected outcome**: One `POST /agent-credentials` with the body exactly `{ agent, secret, instance }`, the header `Soorma-Contract-Version: 0.1.0`, no `Authorization` header, and no envelope; `start()` resolves and the credential's details are readable.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-008 — The provider is called once and the secret is not retained

**Context**: The secret exists only for the bootstrap that needs it. Covers FR-04.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “The provider is called once and the secret is not retained” and observes the outcome below.

**Steps**:
1. Use a counting test provider.
2. Call `start()`.
3. Ask the driver to `inspect` the runtime for the secret.

**Expected outcome**: The provider was called exactly once; the runtime check finds no reference to the secret's value after the request was sent (Python: `sys.getrefcount` on the string the provider returned is back to its value before bootstrap). **Construction design**: The driver's `inspect` uses U1's Python check: the test provider builds the secret `str` at run time, records `sys.getrefcount` before bootstrap, and `found` is false after (CDI-02). The provider is called once per bootstrap attempt (SEC-01, reworded at U3).

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-009 — authentication_failed is surfaced and not retried

**Context**: A wrong secret, an unknown or revoked agent all answer the same `403`; retrying would only consume the abuse bound. Covers FR-04, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “authentication_failed is surfaced and not retried” and observes the outcome below.

**Steps**:
1. Script `403` with Problem code `authentication_failed`.
2. Call `start()`.

**Expected outcome**: `start()` fails with a `ProblemError` (status 403, code `authentication_failed`); the stub recorded one request.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-04, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-010 — too_many_attempts is surfaced with Retry-After and not retried

**Context**: The bootstrap abuse bound must not be consumed by automatic retries. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “too_many_attempts is surfaced with Retry-After and not retried” and observes the outcome below.

**Steps**:
1. Script `429` with code `too_many_attempts` and `Retry-After: 30`.
2. Call `start()`.

**Expected outcome**: `start()` fails with a `ProblemError` carrying code `too_many_attempts` and `retry_after` 30; one request was recorded.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-011 — unavailable is retried after Retry-After, within the bound

**Context**: Bootstrap, renewal and subscribe ride out a short platform outage. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “unavailable is retried after Retry-After, within the bound” and observes the outcome below.

**Steps**:
1. Script `503 unavailable` with `Retry-After: 1` twice, then success.
2. Call `start()`.
3. Repeat with `503` beyond the retry bound.

**Expected outcome**: The first run succeeds after three requests spaced at least one second apart; the second fails with the last `ProblemError` once the bound is reached, with no request after it. **Construction design**: The retry policy (P-01) with `R_max` 5, `W_max` 60 s, `B_init` 0.5 s, `B_factor` 2, `B_cap` 10 s; `Retry-After` first; the last error raised past either bound.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-012 — `file_secret` reads an owner-only secret file

**Context**: The examples' secret source is a file the developer controls, never an environment variable. Covers FR-04.

**Preconditions**:
- A file with mode 0600 owned by the test's user, containing a secret and a trailing newline

**Scenario**: a tester, under the preconditions above, exercises “`file_secret` reads an owner-only secret file” and observes the outcome below.

**Steps**:
1. Create a provider with `file_secret(path)`.
2. Call it twice.

**Expected outcome**: Each call returns the secret without the trailing line ending; the file is read on each call.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-013 — `file_secret` refuses an unsafe file without reading it

**Context**: A secret others can read, or someone else can replace, must not be used. Covers FR-04.

**Preconditions**:
- Files with: mode 0604 (others can read); mode 0620 (group can write); mode 0602 (others can write); owned by another non-root user

**Scenario**: a tester, under the preconditions above, exercises “`file_secret` refuses an unsafe file without reading it” and observes the outcome below.

**Steps**:
1. Call `file_secret(path)` for each file.
2. Inspect each error's message and string form.

**Expected outcome**: Each call fails with a `SecretSourceError` naming the path and the reason (others' read, group write, others' write, foreign owner), never the contents. **Construction design**: The checks are on the descriptor opened with `os.O_RDONLY | os.O_NONBLOCK` (`os.fstat`); a tenant provider's failure is `SecretSourceError` (`provider-failed`) raised `from None`, so its exception is not chained.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-014 — `file_secret` allows group read and follows links to the final file

**Context**: Kubernetes secret volumes use group-readable files behind `..data` links. Covers FR-04.

**Preconditions**:
- A file with mode 0440 owned by root or the test's user
- A symlink chain to it like Kubernetes' `..data` layout

**Scenario**: a tester, under the preconditions above, exercises “`file_secret` allows group read and follows links to the final file” and observes the outcome below.

**Steps**:
1. Call `file_secret` on the symlink path.

**Expected outcome**: It returns the secret: the checks apply to the final file, which passes.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-015 — `file_secret` refuses a named pipe or device without blocking

**Context**: A special file at the path must never hang the bootstrap. Covers FR-04.

**Preconditions**:
- A named pipe (FIFO) at the path with no writer
- On Linux, a path to a character device such as `/dev/zero`

**Scenario**: a tester, under the preconditions above, exercises “`file_secret` refuses a named pipe or device without blocking” and observes the outcome below.

**Steps**:
1. Call `file_secret` on each path with a timeout of one second.

**Expected outcome**: Each call fails promptly (well within the timeout) with a `SecretSourceError` stating the file is not a regular file. **Construction design**: The open is `os.O_NONBLOCK`, off the event loop, so a named pipe neither blocks the open nor the loop; it is refused as `not-regular-file`.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-016 — No provider reads an environment variable

**Context**: Secrets never go in environment variables. Covers FR-04, FR-16.

**Preconditions**:
- The Python package's public interface and source

**Scenario**: a tester, under the preconditions above, exercises “No provider reads an environment variable” and observes the outcome below.

**Steps**:
1. List the secret providers the package exports.
2. Search the package for reads of environment variables.

**Expected outcome**: `file_secret` is the only provider exported; the package reads no environment variable anywhere.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-04, FR-16

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-017 — Renewal happens before expiry and replaces the credential

**Context**: A running agent must never present an expired credential. Covers FR-05.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Renewal happens before expiry and replaces the credential” and observes the outcome below.

**Steps**:
1. Script a bootstrap whose `expiresAt` is a few seconds ahead, and a renewal with a later `expiresAt`.
2. Call `start()` and wait past the first `expiresAt`.
3. Publish.

**Expected outcome**: `POST /agent-credentials/current/renewal` with the current credential and no body was sent before the first `expiresAt`; the publish presents the renewed credential; the details show the new `expiresAt`. **Construction design**: Renewal is due at `expires_at − H_renew` (120 s) by the wall clock, never sooner than `R_min` (30 s) after the credential arrived, by the monotonic clock.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-018 — At the end of a lineage the client bootstraps again

**Context**: The 24-hour lineage cap is reached by long-running agents. Covers FR-05.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “At the end of a lineage the client bootstraps again” and observes the outcome below.

**Steps**:
1. Script renewal to answer `401 credential_expired`, then a successful bootstrap.
2. Let renewal run.

**Expected outcome**: The provider is called again and a new bootstrap is sent; later calls present the new credential. **Construction design**: The decision goes through `is_usable()`, the one validity check (CDI-06).

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-019 — A refused renewal is terminal

**Context**: Revocation is terminal; the SDK must never bootstrap around it. Covers FR-05, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A refused renewal is terminal” and observes the outcome below.

**Steps**:
1. Script renewal to answer `401 credential_refused`.
2. Let renewal run.
3. Then call `publish`.

**Expected outcome**: No new bootstrap is sent; `publish` fails with a `ClientStateError` carrying the refusal's Problem. **Construction design**: A `credential_refused` on a retried renewal is terminal too (GAP-CAC-001's work-around, fail closed).

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-05, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-020 — The credential's details are readable; the credential is not

**Context**: Tenant code can see who and where it is, read only, never the bearer string. Covers FR-06, FR-15.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “The credential's details are readable; the credential is not” and observes the outcome below.

**Steps**:
1. Bootstrap.
2. Read the client's credential details.
3. Try to assign to them.

**Expected outcome**: `agent`, `instance`, `environment` (organization, project, environment) and `expiresAt` match the response; assignment fails; no property or method returns the credential string.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-06, FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-021 — The credential never appears in logs, errors or string forms

**Context**: A leaked bearer credential is a usable credential. Covers FR-06.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “The credential never appears in logs, errors or string forms” and observes the outcome below.

**Steps**:
1. Enable the most verbose logging the package has.
2. Bootstrap, publish, then provoke a Problem on each call.
3. Render the client, the details and each error as a string.

**Expected outcome**: Neither the secret nor the credential string appears in any log line, error message, or string form. **Construction design**: Also checked: `repr`, `str` and pickling (`__reduce__` raises) of the client, `CredentialInfo` and every error; the `SoormaWarning`, the `ResourceWarning` and every `TransportError` message hold no credential, secret, payload or response bytes.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-06

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-022 — The credential is presented only as a bearer header

**Context**: The credential travels in exactly one place. Covers FR-06.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “The credential is presented only as a bearer header” and observes the outcome below.

**Steps**:
1. Publish and subscribe.
2. Inspect the recorded requests.

**Expected outcome**: Each carries `Authorization: Bearer <credential>` once; no body, query or other header contains it.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-06

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-023 — A draft carries exactly the allowed members

**Context**: The platform stamps the envelope; the client drafts only what is its own. Covers FR-07.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A draft carries exactly the allowed members” and observes the outcome below.

**Steps**:
1. Publish a payload.
2. Read the recorded body's `draft`.

**Expected outcome**: `draft` has `clientContractVersion` `"0.1.0"` and `traceContext`, and nothing else.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-07

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-024 — No platform-stamped field can be set

**Context**: Stamped fields are the platform's; the SDK offers no way to set one. Covers FR-07, FR-16.

**Preconditions**:
- The Python package's public interface

**Scenario**: a tester, under the preconditions above, exercises “No platform-stamped field can be set” and observes the outcome below.

**Steps**:
1. Look for any parameter that sets `envelopeVersion`, `scope`, `originMode`, `delegatingPrincipal`, `actorChain` or `reBroadening`.

**Expected outcome**: There is none.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-07, FR-16

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-025 — The draft carries the active span's trace context

**Context**: Trace context travels from the publisher's own tracing (done when 5). Covers FR-08.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver
- An OpenTelemetry SDK installed in the driver process

**Scenario**: a tester, under the preconditions above, exercises “The draft carries the active span's trace context” and observes the outcome below.

**Steps**:
1. Publish inside an active span.
2. Read the recorded `traceContext`.

**Expected outcome**: `traceparent` is valid W3C, carries the active trace id, and its parent id is the publish span's; `tracestate` is present only if the active context had one.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-08

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-026 — Without an OpenTelemetry SDK the draft still has a valid traceparent

**Context**: Many agents run without tracing configured; the platform still requires a valid traceparent. Covers FR-08.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver
- No OpenTelemetry SDK installed

**Scenario**: a tester, under the preconditions above, exercises “Without an OpenTelemetry SDK the draft still has a valid traceparent” and observes the outcome below.

**Steps**:
1. Publish twice.
2. Read both recorded `traceparent` values.

**Expected outcome**: Each is a valid version-00 `traceparent` with a non-zero trace id and parent id. **Construction design**: Generated trace and span ids come from `secrets.token_bytes`.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-08

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-027 — A forwarded call asserts its own trace context

**Context**: The forwarded envelope's trace context is evidence of the previous hop, not this hop's assertion. Covers FR-08, FR-09.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A forwarded call asserts its own trace context” and observes the outcome below.

**Steps**:
1. Receive a Delivery whose envelope carries a `traceparent` T.
2. Publish in response through the Delivery.
3. Read the recorded draft.

**Expected outcome**: The draft's `traceContext.traceparent` is this hop's own, and is not T copied; T appears only inside the forwarded envelope text. **Construction design**: The received `traceparent` is parsed by the SDK into a remote `SpanContext`, not through the global propagator; without an OpenTelemetry SDK the draft's span id is this hop's own, never the parent's.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-08, FR-09

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-028 — Publishing through a Delivery forwards its context by default

**Context**: Forwarding is the default path when acting on an event. Covers FR-09.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Publishing through a Delivery forwards its context by default” and observes the outcome below.

**Steps**:
1. Receive a Delivery.
2. Call the Delivery's publish with a payload.
3. Read the recorded draft.

**Expected outcome**: The draft carries `inbound: { envelope, seal }` from that Delivery; the tenant code did not assemble it.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-09

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-029 — The forwarded envelope is the received text, byte for byte

**Context**: Re-serializing would lose unknown fields, member order or number spellings that the seal covers. Covers FR-09, FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “The forwarded envelope is the received text, byte for byte” and observes the outcome below.

**Steps**:
1. Script a Delivery whose envelope has unknown fields, an unusual member order and a number written `1.0`.
2. Forward it.
3. Compare the recorded `inbound.envelope` bytes with the delivered envelope bytes.

**Expected outcome**: They are identical, byte for byte; the seal is identical to the one received.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-09, FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-030 — Publishing on the client does not forward

**Context**: Dropping context takes a deliberate, separate call. Covers FR-09.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Publishing on the client does not forward” and observes the outcome below.

**Steps**:
1. Receive a Delivery.
2. Call the client's publish (not the Delivery's).
3. Read the recorded draft.

**Expected outcome**: The draft has no `inbound` member.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-09

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-031 — Refused forwarding is surfaced as given

**Context**: The SDK infers nothing about why the platform refused a forwarded call. Covers FR-09, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Refused forwarding is surfaced as given” and observes the outcome below.

**Steps**:
1. Script `400 invalid_inbound_context`, then `400 chain_too_deep`, then `403 forbidden` for three forwarded publishes.

**Expected outcome**: Each publish fails with a `ProblemError` carrying exactly the scripted status and code; none is retried.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-09, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-032 — A 202 is reported as accepted

**Context**: Publishing is the start of done when 3. Covers FR-10.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A 202 is reported as accepted” and observes the outcome below.

**Steps**:
1. Script `202` with no body.
2. Publish a payload.

**Expected outcome**: Publish resolves with a result that says accepted (with the trace context used), never delivered; one `POST /events` with `{ draft, payload }` was recorded.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-10

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-033 — Bodies are compact JSON without ASCII or HTML escaping

**Context**: The platform's body limits and canonical forms assume compact, unescaped JSON. Covers FR-10.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Bodies are compact JSON without ASCII or HTML escaping” and observes the outcome below.

**Steps**:
1. Publish a payload containing `<`, `>`, `&`, `é` and an emoji.
2. Read the recorded body bytes.

**Expected outcome**: The body has no insignificant whitespace, no duplicate member names, and the characters appear literally in UTF-8, not as `\u` escapes. **Construction design**: The body's text equals `json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)` for every accepted value, except that a lone surrogate is written as its `\uXXXX` escape; the serializer is iterative.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-10

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-034 — A failed publish is never retried

**Context**: A retried publish could duplicate an event. Covers FR-10, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A failed publish is never retried” and observes the outcome below.

**Steps**:
1. Script `503 unavailable` with `Retry-After: 1`.
2. Publish.

**Expected outcome**: Publish fails with the `ProblemError`; the stub recorded exactly one request.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-10, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-035 — An oversized publish is surfaced as the platform's Problem

**Context**: Size limits are enforced by the platform; the SDK reports them. Covers FR-10, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “An oversized publish is surfaced as the platform's Problem” and observes the outcome below.

**Steps**:
1. Script `413 payload_too_large`.
2. Publish a large payload.

**Expected outcome**: Publish fails with a `ProblemError` with status 413 and code `payload_too_large`.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-10, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-036 — Subscribing opens a stream and yields its items

**Context**: A subscribed agent receives what others publish (done when 3). Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Subscribing opens a stream and yields its items” and observes the outcome below.

**Steps**:
1. Script a stream with two `delivery` events.
2. Subscribe and read three items.

**Expected outcome**: One `POST /subscriptions` with `{ draft }` and the credential was recorded; the items are a stream-started item, then two Deliveries. **Construction design**: `async with client.subscribe() as subscription:` is the closing idiom; items are told apart by their class.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-037 — Heartbeats are consumed silently

**Context**: Heartbeat comments keep the connection alive and mean nothing to tenant code. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Heartbeats are consumed silently” and observes the outcome below.

**Steps**:
1. Script a stream with heartbeat comments between two deliveries.
2. Read the items.

**Expected outcome**: Only the stream-started item and the two Deliveries are yielded. **Construction design**: `T_idle` is 45 s and counts only while the stream is read.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-038 — A stream end is surfaced with its code

**Context**: Each end tells tenant code a stream stopped and why. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A stream end is surfaced with its code” and observes the outcome below.

**Steps**:
1. Script streams ending with `end` codes `unavailable` and `overflow`.

**Expected outcome**: Each yields a stream-ended item with that code, marked not terminal.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-039 — An unknown end code is surfaced, not fatal

**Context**: End codes are an open set. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “An unknown end code is surfaced, not fatal” and observes the outcome below.

**Steps**:
1. Script an `end` with code `brand_new_code`.

**Expected outcome**: A stream-ended item with code `brand_new_code` is yielded and the SDK does not fail.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-040 — A dropped connection is a stream end with no code

**Context**: A stream can end without an `end` event; tenant code must still see it. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A dropped connection is a stream end with no code” and observes the outcome below.

**Steps**:
1. Script a stream that closes the connection without an `end` event.

**Expected outcome**: A stream-ended item with no code is yielded; then, while the credential is valid, a new stream is opened and a stream-started item follows. **Construction design**: `T_idle` counts only while the socket is read (`pause_reading` stops it; a resume restarts it).

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-041 — Across renewal a new stream starts and both boundaries are surfaced

**Context**: Live-only delivery means a boundary is where events can be missed; tenant code must see every one. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Across renewal a new stream starts and both boundaries are surfaced” and observes the outcome below.

**Steps**:
1. Script a short `expiresAt`, a renewal, and a stream that ends `superseded` once the replacement opens.
2. Read items across the renewal.
3. Inspect the second subscribe request.

**Expected outcome**: The replacement subscribe was sent with the renewed credential before the old one expired; a stream-started item and a stream-ended item with code `superseded` are yielded; no `Last-Event-ID` header was sent and nothing claims continuity. **Construction design**: The new stream is paused from its opening until the old stream ends or `W_super` (10 s, counted only while the old stream is read) expires.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-042 — A revoked stream ends the subscription

**Context**: Revocation is terminal for streams too. Covers FR-11, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A revoked stream ends the subscription” and observes the outcome below.

**Steps**:
1. Script an `end` with code `credential_refused`.

**Expected outcome**: A stream-ended item with code `credential_refused`, marked terminal, is yielded; the iterator then finishes; no new bootstrap or subscribe is sent.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-11, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-043 — At most one stream per credential lineage

**Context**: A second stream on a lineage supersedes the first; the SDK must not cause that by accident. Covers FR-11.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “At most one stream per credential lineage” and observes the outcome below.

**Steps**:
1. Subscribe and run through a renewal.
2. Count concurrently open streams recorded by the stub.

**Expected outcome**: Never more than one, except for the moment a replacement supersedes the previous stream.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-044 — A failed subscribe is surfaced; unavailable is retried

**Context**: Subscribe shares bootstrap's retry rule and surfaces every other failure. Covers FR-11, FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A failed subscribe is surfaced; unavailable is retried” and observes the outcome below.

**Steps**:
1. Script `401 credential_refused`, then (fresh client) `403 forbidden`, then (fresh client) `503` with `Retry-After: 1` once followed by a stream.

**Expected outcome**: The first two subscriptions end with the `ProblemError` as scripted; the third opens its stream after one retry spaced at least one second. **Construction design**: Resubscribe goes through the one validity check and the retry policy.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-11, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-045 — A Delivery exposes envelope, envelope text, seal and payload

**Context**: Tenant code needs both the parsed envelope and its exact text. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A Delivery exposes envelope, envelope text, seal and payload” and observes the outcome below.

**Steps**:
1. Script a delivery with a known envelope, seal and payload.
2. Read the Delivery.

**Expected outcome**: The parsed envelope is read only; the envelope text equals the delivered bytes; the seal is as delivered; the payload is parsed and its source text is available. **Construction design**: The envelope is deeply read only (`MappingProxyType`, tuples): mutating it raises; the payload is plain JSON types.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-046 — Extraction does not depend on member order

**Context**: The contract promises no member order in a Delivery line. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Extraction does not depend on member order” and observes the outcome below.

**Steps**:
1. Script the same Delivery in every order of its `envelope`, `seal` and `payload` members.

**Expected outcome**: Every order yields an identical Delivery.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-047 — Unknown fields and values are kept, not fatal

**Context**: Consumers must tolerate and preserve what they do not know. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Unknown fields and values are kept, not fatal” and observes the outcome below.

**Steps**:
1. Script the contract's fixtures with unknown fields at every level and an unknown `originMode`.

**Expected outcome**: No error; the unknown fields and value are present in the parsed envelope and in its text.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-048 — Received identifiers are opaque

**Context**: Received identifiers are never syntax-checked. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Received identifiers are opaque” and observes the outcome below.

**Steps**:
1. Script the fixture with identifiers that the request-side patterns would reject.

**Expected outcome**: The Delivery is yielded with the identifiers exactly as received.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-049 — Payload numbers are native, with the source text available

**Context**: Large or precise numbers must not be silently changed for tenant code. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Payload numbers are native, with the source text available” and observes the outcome below.

**Steps**:
1. Script a payload with `1.0`, `1e400` and a 30-digit integer.

**Expected outcome**: The parsed payload uses native numbers; the payload source text contains the exact spellings. **Construction design**: Integers are exact `int`s; a payload holding an integer longer than `sys.get_int_max_str_digits()` is left unparsed (TC-PH-079).

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-050 — A payload deeper than the bound falls back to raw text

**Context**: A deep payload must never cost the envelope or the seal. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “A payload deeper than the bound falls back to raw text” and observes the outcome below.

**Steps**:
1. Script a payload nested beyond the depth the Python conformance driver reports.
2. Read the Delivery.
3. Forward it.

**Expected outcome**: The Delivery is yielded with envelope and seal intact, the payload absent, the payload text present, and the not-parsed flag set; forwarding sends the envelope text byte for byte. **Construction design**: `D_lang` is 256; the scanner is iterative; reading `payload` raises `PayloadNotParsed`, and `hasattr(delivery, "payload")` is false.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-051 — An unreadable Delivery line is an error item and the stream continues

**Context**: One bad line must not end a subscription. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “An unreadable Delivery line is an error item and the stream continues” and observes the outcome below.

**Steps**:
1. Script a stream with a non-JSON line, a line missing `seal`, and then a valid delivery.

**Expected outcome**: Two delivery-error items are yielded, then the valid Delivery; the stream stays open. **Construction design**: The reasons include `not-json` (the tokens `NaN` and `Infinity` too), `duplicate-member`, `envelope-too-deep`, `envelope-unparsed` and `event-too-large`.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-052 — Unknown Problem codes and members are kept

**Context**: Problem codes are an open set. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Unknown Problem codes and members are kept” and observes the outcome below.

**Steps**:
1. Script a `400` Problem with code `new_code` and an extra member.

**Expected outcome**: A `ProblemError` with code `new_code` is raised, and its full Problem includes the extra member.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-053 — forbidden is surfaced without inference

**Context**: The SDK does not guess why authority was refused. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “forbidden is surfaced without inference” and observes the outcome below.

**Steps**:
1. Script `403 forbidden` on publish.

**Expected outcome**: The `ProblemError` carries status 403 and code `forbidden`, and its message adds no cause.

**Scope**: negative · **Priority**: Medium

**Source**: python-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-054 — Every error path releases its resources

**Context**: Leaked connections and timers accumulate in long-running agents. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Every error path releases its resources” and observes the outcome below.

**Steps**:
1. Provoke each failure (TLS error, Problem on each operation, dropped stream), then call `close()`.
2. Ask the driver for open connections, streams and timers.

**Expected outcome**: None remain open. **Construction design**: `close()` is idempotent and concurrent calls await one close; every task's exception is retrieved; the package's tests run with warnings as errors and a loop exception handler that fails a test on any unretrieved exception.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-055 — Spans are emitted through the OpenTelemetry API under messaging conventions

**Context**: The agent's operations appear in the tenant's own tracing (done when 5). Covers FR-14.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver
- An OpenTelemetry SDK with an in-memory exporter installed by the test

**Scenario**: a tester, under the preconditions above, exercises “Spans are emitted through the OpenTelemetry API under messaging conventions” and observes the outcome below.

**Steps**:
1. Publish, receive a Delivery, and forward it.
2. Read the exported spans.

**Expected outcome**: Spans exist for the publish and the receive, named and attributed per OpenTelemetry's messaging semantic conventions, with no soorma-defined span name or attribute; the forwarding hop's span relates to the received trace as the specification's span rule states. **Construction design**: Messaging attributes follow OpenTelemetry semantic conventions 1.45.0, as constants; `messaging.system` `soorma`.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-14

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-056 — The SDK installs no exporter and no sampler

**Context**: Where spans go is the tenant's decision. Covers FR-14.

**Preconditions**:
- The Python package's dependencies and source

**Scenario**: a tester, under the preconditions above, exercises “The SDK installs no exporter and no sampler” and observes the outcome below.

**Steps**:
1. List the package's runtime dependencies.
2. Search the package for exporter or sampler set-up.

**Expected outcome**: It depends on the OpenTelemetry API only, and configures no exporter, sampler or provider. **Construction design**: `opentelemetry-api` is the one runtime dependency, a range `>= floor, < 2`; the floor run is TC-PH-090.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-14

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-057 — No human-side operation, delegation or commercial code

**Context**: The SDK never holds a human credential and offers no delegation in M1. Covers FR-16.

**Preconditions**:
- The Python package's public interface, source and generated types

**Scenario**: a tester, under the preconditions above, exercises “No human-side operation, delegation or commercial code” and observes the outcome below.

**Steps**:
1. Look for any API taking a sign-in, an environment credential or a delegation credential.
2. Search for the `Soorma-Delegation` header.
3. Look for generated S1 or S2 types.

**Expected outcome**: None exists; the header is never sent; only agent-side types are generated.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-16

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-058 — The package builds and installs from the repository, unpublished

**Context**: Developers install from this repository in M1. Covers FR-18.

**Preconditions**:
- A clean environment with Python 3.11 and the newest release

**Scenario**: a tester, under the preconditions above, exercises “The package builds and installs from the repository, unpublished” and observes the outcome below.

**Steps**:
1. Build the package and install it into a new project from the repository path.
2. Import `soorma`.

**Expected outcome**: It installs and imports on each supported runtime; the package metadata states Apache-2.0; nothing was published to a registry. **Construction design**: `package-python` builds the wheel and the sdist; the guard over both file lists finds no test-only path and no `soorma/_internal/`; the wheel installs offline into a fresh virtual environment with the API's wheel from the lock; importing `soorma` constructs an `AgentClient`; importing `soorma._internal.test_values` fails.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-18

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-059 — Every conformance case passes on every supported runtime

**Context**: A language is not complete until it passes every case. Covers FR-18, FR-03.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Every conformance case passes on every supported runtime” and observes the outcome below.

**Steps**:
1. Run the runner with the Python conformance driver on Python 3.11 and the newest release.

**Expected outcome**: Every case passes and none is skipped, on each runtime. **Construction design**: `conformance-python`: 3.11 and 3.15 with `otel-latest`, and 3.11 with `otel-floor`; the second local user and `--foreign-user` (CC-SEC-05 passed, not skipped, on every entry); every case, the two new ones included; a failing case judged under CDI-05.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-18, FR-03

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-060 — Exported names match the name table

**Context**: One naming convention across languages. Covers FR-17, FR-18.

**Preconditions**:
- The conformance runner and stub (U1)
- The Python conformance driver

**Scenario**: a tester, under the preconditions above, exercises “Exported names match the name table” and observes the outcome below.

**Steps**:
1. Run the names check for this package.

**Expected outcome**: Every exported name is in the table's Python column and every name in that column is exported. **Construction design**: The Python column includes the Python-only rows `SoormaWarning` and `PayloadNotParsed`; the driver reports `__all__` and public members only, so dunders never reach the check.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-17, FR-18

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-061 — Both agents bootstrap and one renews (done when 2)

**Context**: The first of M1's three proofs through the SDK. Covers FR-19.

**Preconditions**:
- A fresh stack and secret files from `e2e/core-up` and `e2e/setup` (U2)
- The Python end-to-end test with a test-installed in-memory exporter

**Scenario**: a tester, under the preconditions above, exercises “Both agents bootstrap and one renews (done when 2)” and observes the outcome below.

**Steps**:
1. Start agents A and B with `file_secret` reading their secret files.
2. Force one renewal on B.

**Expected outcome**: Both hold credentials naming their agent and environment `e`; B's renewal succeeds. **Construction design**: Only `time.time` and `time.time_ns` are patched, 14 minutes ahead and advancing; two warnings, one per client's lineage, none at B's renewal; one real renewal no sooner than `R_min`; no second within `R_min`; the real clock restored before closing.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-062 — B receives what A publishes (done when 3)

**Context**: Delivery is live only: B subscribes before A publishes. Covers FR-19.

**Preconditions**:
- A fresh stack and secret files from `e2e/core-up` and `e2e/setup` (U2)
- The Python end-to-end test with a test-installed in-memory exporter

**Scenario**: a tester, under the preconditions above, exercises “B receives what A publishes (done when 3)” and observes the outcome below.

**Steps**:
1. B subscribes and waits for its stream-started item.
2. A publishes a payload.
3. B reads the next items.

**Expected outcome**: B receives a Delivery whose payload is A's, with an envelope and a seal. **Construction design**: Both clients run in the test's one process.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-19

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-063 — The trace travels and a span is emitted (done when 5)

**Context**: The third proof: trace context crosses the platform. Covers FR-19, FR-14.

**Preconditions**:
- A fresh stack and secret files from `e2e/core-up` and `e2e/setup` (U2)
- The Python end-to-end test with a test-installed in-memory exporter

**Scenario**: a tester, under the preconditions above, exercises “The trace travels and a span is emitted (done when 5)” and observes the outcome below.

**Steps**:
1. Run the steps of the test case "B receives what A publishes (done when 3)" with the in-memory exporter installed.
2. Compare the `traceparent` on B's received envelope with the exported spans.

**Expected outcome**: A span's trace id equals the trace id in the `traceparent` on the envelope B received. **Construction design**: B's subscription and loop run inside a decoy span; B's receive span's parent is A's send span, and the decoy is neither its parent nor linked from it.

**Scope**: happy-path · **Priority**: High

**Source**: python-harness / FR-19, FR-14

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-064 — The example runs and prints the envelope and trace id

**Context**: The example is what a developer runs first. Covers FR-20.

**Preconditions**:
- A fresh stack and secret files from U2 at the paths the example's configuration names

**Scenario**: a tester, under the preconditions above, exercises “The example runs and prints the envelope and trace id” and observes the outcome below.

**Steps**:
1. Run the Python example (`python/examples/two_agents/`): B first, then A.

**Expected outcome**: B prints the envelope it received and the trace id. **Construction design**: Each agent file has one marked configuration block and `async def run(config)`; run directly, `asyncio.run(run(config))`.

**Scope**: happy-path · **Priority**: Medium

**Source**: python-harness / FR-20

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-065 — The agent file copies into a new project

**Context**: A developer starts their own agent from the example. Covers FR-20.

**Preconditions**:
- A new, empty Python project

**Scenario**: a tester, under the preconditions above, exercises “The agent file copies into a new project” and observes the outcome below.

**Steps**:
1. Copy one agent file from `python/examples/two_agents/` into the project.
2. Install the package from the repository.
3. Edit only the marked configuration block and run it.

**Expected outcome**: It builds and runs as a single agent. The configuration block holds the S3 and S4 addresses, the CA path, the agent identifier, the secret source as a `file_secret` path (never the secret) and the instance identifier; nothing else needed editing; the file uses only the public interface and holds no human credential. **Construction design**: Proved by `package-python`: the agent file copied into a fresh environment, type-checked with `mypy` and imported.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-20

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

---

### TC-PH-066 — The example's README states what is not promised

**Context**: Developers must know delivery is live only and the span shape is unstable. Covers FR-20.

**Preconditions**:
- The README in `python/examples/two_agents/`

**Scenario**: a tester, under the preconditions above, exercises “The example's README states what is not promised” and observes the outcome below.

**Steps**:
1. Read the README.

**Expected outcome**: It names `e2e/core-up` and `e2e/setup` as the set-up, says delivery is live only (start B before A publishes), and says the span shape is unstable. **Construction design**: The README also states: `async with` as the closing idiom; python.org's macOS installer starting with no CA certificates until *Install Certificates* is run; that the SDK never changes the process's integer digit limit; `PayloadNotParsed` and `SoormaWarning`.

**Scope**: happy-path · **Priority**: Low

**Source**: python-harness / FR-20

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/python-harness/functional-design/`

### TC-PH-067 — `file_secret` is refused on Windows without opening the path

**Context**: The SEC-09 choice for Python (PH-SEC-02). Covers FR-04.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “`file_secret` is refused on Windows without opening the path” and observes the outcome below.

**Steps**:
1. Patch `sys.platform` to `win32`.
2. Call a `file_secret` provider on an existing path.

**Expected outcome**: `SecretSourceError` with reason `unsupported-platform` and the path; the file is never opened.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-SEC-02)

---

### TC-PH-068 — A delivery line with a duplicate `envelope`, `seal` or `payload` is a delivery error

**Context**: `json.loads` would silently take the last member (PH-RD-02). Covers FR-12.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “A delivery line with a duplicate `envelope`, `seal` or `payload` is a delivery error” and observes the outcome below.

**Steps**:
1. Feed the reader a line with each member duplicated in turn.

**Expected outcome**: Each yields `DeliveryError` (`duplicate-member`); the stream continues.

**Scope**: negative · **Priority**: Medium

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-RD-02)

---

### TC-PH-069 — Every member of the `Envelope` type is optional, and the envelope is read only

**Context**: CDI-04 and RCV-02 in Python (PH-RD-03, PH-RD-05). Covers FR-12.

**Preconditions**:
- The package's unit tests and `mypy --strict`

**Scenario**: a tester, under the preconditions above, exercises “Every member of the `Envelope` type is optional, and the envelope is read only” and observes the outcome below.

**Steps**:
1. Type-check code reading an `Envelope` member without a check.
2. Mutate a received envelope and a nested member.

**Expected outcome**: `mypy` requires the member's absence to be handled (`total=False`); each mutation raises.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-RD-03, -05)

---

### TC-PH-070 — `publish` refuses a payload JSON cannot carry exactly, naming the path, never the value

**Context**: PH-PUB-01: exact types only; an over-long `int` included; no depth limit. Covers FR-10.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “`publish` refuses a payload JSON cannot carry exactly, naming the path, never the value” and observes the outcome below.

**Steps**:
1. Publish payloads holding `NaN`, a tuple, an `int` key, an `IntEnum`, a `set`, a cycle, and an `int` longer than `sys.get_int_max_str_digits()`.
2. Publish payloads 10 000 and 1 000 000 levels deep.

**Expected outcome**: Each refused payload is `TypeError` naming its path and kind, never the value, before any request; the deep payloads are sent.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-10

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-PUB-01)

---

### TC-PH-071 — Leaving `async with` closes the subscription; a process whose main coroutine returns exits

**Context**: PH-LIFE-02, PH-LIFE-04. Covers FR-11.

**Preconditions**:
- The package's unit tests
- A child Python process against U1's stub

**Scenario**: a tester, under the preconditions above, exercises “Leaving `async with` closes the subscription; a process whose main coroutine returns exits” and observes the outcome below.

**Steps**:
1. Leave an `async with client.subscribe()` block by `break`, `return`, an exception and cancellation.
2. In a child process, leave such a block and return from the main coroutine.

**Expected outcome**: Each way of leaving closes the stream; the child exits within 1 s.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-LIFE-02, -04)

---

### TC-PH-072 — A client whose clock runs fast renews at most once per `R_min` and warns once per lineage

**Context**: REN-07 in Python (PH-REN-01, -03); CC-REN-06. Covers FR-05.

**Preconditions**:
- The conformance runner and stub; the Python driver

**Scenario**: a tester, under the preconditions above, exercises “A client whose clock runs fast renews at most once per `R_min` and warns once per lineage” and observes the outcome below.

**Steps**:
1. Run CC-REN-06 under the Python driver.

**Expected outcome**: Renewals at least `R_min` apart; exactly one `clock-skew` warning reported.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-REN-01, -03)

---

### TC-PH-073 — An envelope nested deeper than `D_lang` is a delivery error; the stream continues

**Context**: PH-RD-03: no envelope reaches `RecursionError`. Covers FR-12.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “An envelope nested deeper than `D_lang` is a delivery error; the stream continues” and observes the outcome below.

**Steps**:
1. Feed a line whose envelope nests `D_lang` + 1 levels, then a valid line.

**Expected outcome**: `DeliveryError` (`envelope-too-deep`), then the Delivery.

**Scope**: edge/boundary · **Priority**: Medium

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-RD-03)

---

### TC-PH-074 — An unknown option, such as a misspelt TLS switch, is refused

**Context**: PH-API-03. Covers FR-15.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “An unknown option, such as a misspelt TLS switch, is refused” and observes the outcome below.

**Steps**:
1. Construct `AgentClientOptions` with an unknown keyword.

**Expected outcome**: `TypeError`; nothing contacted.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-API-03)

---

### TC-PH-075 — A client more than a lifetime ahead uses its credential until S3 answers `credential_expired`, then bootstraps once

**Context**: REN-07's second half (PH-REN-01, -02); CC-REN-07. Covers FR-05.

**Preconditions**:
- The conformance runner and stub; the Python driver

**Scenario**: a tester, under the preconditions above, exercises “A client more than a lifetime ahead uses its credential until S3 answers `credential_expired`, then bootstraps once” and observes the outcome below.

**Steps**:
1. Run CC-REN-07 under the Python driver.

**Expected outcome**: Exactly two bootstraps; no bootstrap before the first publishes; the last publish presents the second credential.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-REN-01, -02)

---

### TC-PH-076 — An unclosed subscription or client, forgotten, is collected, closes its socket synchronously and emits one `ResourceWarning`

**Context**: PH-LIFE-03 and P-10, with the user's collection test: guards against the finalizer or any callback holding the handle. Covers FR-13.

**Preconditions**:
- The package's unit tests
- U1's stub, for a connected stream

**Scenario**: a tester, under the preconditions above, exercises “An unclosed subscription or client, forgotten, is collected, closes its socket synchronously and emits one `ResourceWarning`” and observes the outcome below.

**Steps**:
1. Start a client; open a subscription with its stream connected.
2. Drop the last reference to the subscription; run `gc.collect()`.
3. Repeat for the client.

**Expected outcome**: For each: a `weakref` to the handle is dead; the finalizer ran (the stub sees the connection closed; no SDK timer or task remains); exactly one `ResourceWarning` naming it was emitted; no coroutine was scheduled. A closed handle, collected, emits nothing.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-10); `construction/python-harness/functional-design/business-rules.md` (PH-LIFE-03)

---

### TC-PH-077 — With warnings set to error, the skew path still renews at the floor

**Context**: PH-REN-04: the warning is advisory, never control flow. Covers FR-05.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “With warnings set to error, the skew path still renews at the floor” and observes the outcome below.

**Steps**:
1. Under `warnings.simplefilter("error")`, start a client whose credential arrives already due.

**Expected outcome**: No exception escapes the renewal task; the renewal happens at `R_min`; the lineage is unchanged.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-REN-04)

---

### TC-PH-078 — A module binding `time.time`, `time.time_ns` or `datetime.now` at import fails the clock check

**Context**: PH-CLK-02, P-05: otherwise a patched clock could never reach the SDK. Covers FR-05.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “A module binding `time.time`, `time.time_ns` or `datetime.now` at import fails the clock check” and observes the outcome below.

**Steps**:
1. Run the check over the package.
2. Run it over scratch modules holding each forbidden form: `from time import time`, `now = time.time`, a default argument `time.time`, `datetime.now` outside `_clock.py`.

**Expected outcome**: The package passes; each scratch form fails, naming its file and line.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-05)

---

### TC-PH-079 — A payload holding a 5000-digit integer is left unparsed, its Delivery intact

**Context**: PH-RD-06, -07, on 3.11 and the newest release. Covers FR-12, FR-10.

**Preconditions**:
- The package's unit tests, on 3.11 and 3.15

**Scenario**: a tester, under the preconditions above, exercises “A payload holding a 5000-digit integer is left unparsed, its Delivery intact” and observes the outcome below.

**Steps**:
1. Feed a Delivery whose payload holds a 5000-digit integer.
2. Forward it.
3. Publish an `int` of 5000 digits.

**Expected outcome**: `payload_parsed` is false; `payload` raises `PayloadNotParsed`; `payload_text` exact; the envelope and seal intact and forwardable; `sys.get_int_max_str_digits()` unchanged; the publish is refused with the path, never the value.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-12, FR-10

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/functional-design/business-rules.md` (PH-RD-06, -07)

---

### TC-PH-080 — On a skewed lineage, a `503` on renewal is retried and a dropped stream is resubscribed, without a bootstrap

**Context**: CDI-06 in Python (P-02). Covers FR-05, FR-11.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “On a skewed lineage, a `503` on renewal is retried and a dropped stream is resubscribed, without a bootstrap” and observes the outcome below.

**Steps**:
1. On a warned lineage, answer a renewal `503`.
2. Drop the stream.

**Expected outcome**: The renewal is retried; the stream is resubscribed; no bootstrap.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-05, FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-02)

---

### TC-PH-081 — A stream paused for backpressure does not time out; a resume restarts `T_idle`

**Context**: STR-02 in Python (P-04). Covers FR-11.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “A stream paused for backpressure does not time out; a resume restarts `T_idle`” and observes the outcome below.

**Steps**:
1. Fill the queue so the protocol pauses reading; wait past `T_idle`; pull.

**Expected outcome**: No *stream ended* with `None`; reading resumes; `T_idle` restarts.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-04)

---

### TC-PH-082 — A replacement with a full buffer yields the old stream's remaining Deliveries, its `superseded` end, then the new stream's

**Context**: STR-05 in Python (P-04); CC-STR-13. Covers FR-11.

**Preconditions**:
- The package's unit tests; CC-STR-13 under the Python driver

**Scenario**: a tester, under the preconditions above, exercises “A replacement with a full buffer yields the old stream's remaining Deliveries, its `superseded` end, then the new stream's” and observes the outcome below.

**Steps**:
1. Fill the queue; renew so a replacement opens; pull.

**Expected outcome**: Old Deliveries, *ended* (`superseded`), *started*, new Deliveries; no *ended* with `None`.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-11

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-04)

---

### TC-PH-083 — A retried bootstrap calls the provider once per attempt and holds no secret during the wait

**Context**: SEC-01 per attempt (P-12); CC-ACQ-08. Covers FR-04.

**Preconditions**:
- The conformance runner and stub; the Python driver

**Scenario**: a tester, under the preconditions above, exercises “A retried bootstrap calls the provider once per attempt and holds no secret during the wait” and observes the outcome below.

**Steps**:
1. Run CC-ACQ-08 under the Python driver.

**Expected outcome**: Two provider calls, two requests; the `sys.getrefcount` check finds nothing during the wait.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-12)

---

### TC-PH-084 — A bad CA file fails `start()` before anything is sent

**Context**: P-06. Covers FR-15.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “A bad CA file fails `start()` before anything is sent” and observes the outcome below.

**Steps**:
1. Start with a missing, an unreadable and a non-PEM CA file.

**Expected outcome**: `TransportError` (`ca-file`, the path) each time; no request sent.

**Scope**: negative · **Priority**: Medium

**Source**: python-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-06)

---

### TC-PH-085 — The response parser refuses malformed, oversized and conflicting input, table-driven

**Context**: NFR-U4-07 to -09; P-07: the SDK parses untrusted responses with its own code. Covers FR-13.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “The response parser refuses malformed, oversized and conflicting input, table-driven” and observes the outcome below.

**Steps**:
1. Feed the parser each table row: truncation at every boundary; an oversized status line, header line, header block, header count, body, chunk-size line, trailers; `Content-Length` with `Transfer-Encoding`; differing `Content-Length`s; an unknown coding; a bare LF; an obs-fold line; a bad header name; a malformed chunk size.

**Expected outcome**: Each row ends in `TransportError` with its reason (`malformed-response`, `response-too-large` or `truncated-response`), its message holding none of the input bytes; valid responses parse, chunk extensions ignored, trailers discarded.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-07); `construction/python-harness/nfr-requirements/nfr-requirements.md` (NFR-U4-07 to -09)

---

### TC-PH-086 — Random bytes never hang the parser or raise anything but `TransportError`

**Context**: NFR-U4-11; TS-U4-06: a seeded fuzz test. Covers FR-13.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “Random bytes never hang the parser or raise anything but `TransportError`” and observes the outcome below.

**Steps**:
1. With fixed seeds, feed random bytes and mutations of valid responses (truncation, byte flips, duplicated and oversized lines) at random split points.

**Expected outcome**: Every input ends in a complete response or `TransportError`; no other exception; no buffer past the bounds; the run is reproducible from its seed.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-requirements/tech-stack-decisions.md` (TS-U4-06)

---

### TC-PH-087 — An SSE event over `L_event` is a delivery error, and the next Delivery still arrives

**Context**: The new statement beside RCV-07 (NFR-U4-10, -37): a new conformance case, under both drivers. Covers FR-12.

**Preconditions**:
- The conformance runner and stub (the generated-body directive); the Python and TypeScript drivers

**Scenario**: a tester, under the preconditions above, exercises “An SSE event over `L_event` is a delivery error, and the next Delivery still arrives” and observes the outcome below.

**Steps**:
1. Script one event of many `data:` lines, each under 1 MiB, together over `L_event`, then a normal Delivery.
2. Pull items under each driver.

**Expected outcome**: A `DeliveryError` (`event-too-large`, no text), then the Delivery, the stream still open; memory held for the event never beyond `L_event` and a chunk.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-12

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-requirements/nfr-requirements.md` (NFR-U4-10, -37); `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-08)

---

### TC-PH-088 — A non-stream response body over `B_body` is a transport error

**Context**: The new statement beside RCV-07 (NFR-U4-37): a new conformance case, under both drivers. Covers FR-13.

**Preconditions**:
- The conformance runner and stub (the generated-body directive); both drivers

**Scenario**: a tester, under the preconditions above, exercises “A non-stream response body over `B_body` is a transport error” and observes the outcome below.

**Steps**:
1. Script a Problem response whose body exceeds `B_body`.
2. Run the operation under each driver.

**Expected outcome**: `TransportError` (`response-too-large`), its message holding none of the body.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-requirements/nfr-requirements.md` (NFR-U4-37); `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-08)

---

### TC-PH-089 — The TypeScript fix bounds each SSE event and each non-stream body

**Context**: NFR-U4-38: a defect fix to merged U3 code, in its own commit in U4's code PR. Covers FR-12, FR-13.

**Preconditions**:
- The TypeScript package's unit tests (Vitest)

**Scenario**: a tester, under the preconditions above, exercises “The TypeScript fix bounds each SSE event and each non-stream body” and observes the outcome below.

**Steps**:
1. Feed `subscription.ts` an event over `L_event` in many lines, then a Delivery.
2. Answer a request in `transport.ts`'s `post` and `readReply` paths with a body over `B_body`.

**Expected outcome**: The event yields `event-too-large` and the Delivery follows, `pending` never beyond the bound; each body read stops with `response-too-large`. The TypeScript driver passes TC-PH-087 and 088's cases.

**Scope**: negative · **Priority**: High

**Source**: python-harness / FR-12, FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-requirements/nfr-requirements.md` (NFR-U4-38); `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-08)

---

### TC-PH-090 — Every case passes at the `opentelemetry-api` floor, from the lock

**Context**: NFR-U4-26; P-14. Covers FR-14, FR-18.

**Preconditions**:
- `conformance-python`'s floor entry

**Scenario**: a tester, under the preconditions above, exercises “Every case passes at the `opentelemetry-api` floor, from the lock” and observes the outcome below.

**Steps**:
1. `uv sync --locked --group otel-floor` on 3.11.
2. Run every case.

**Expected outcome**: The installed API is the floor version from `uv.lock`; nothing is fetched outside the lock; every case passes, CC-SEC-05 included.

**Scope**: edge/boundary · **Priority**: High

**Source**: python-harness / FR-14, FR-18

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-14)

---

### TC-PH-091 — A TLS failure on a Python with no CA certificates hints at *Install Certificates*

**Context**: NFR-U4-17; P-06: the user's condition. Covers FR-15.

**Preconditions**:
- The package's unit tests

**Scenario**: a tester, under the preconditions above, exercises “A TLS failure on a Python with no CA certificates hints at *Install Certificates*” and observes the outcome below.

**Steps**:
1. Start against a server whose certificate fails, once with a context whose default store is empty, once with a normal store.

**Expected outcome**: Both are `TransportError` (`tls`); only the empty-store message hints at python.org's *Install Certificates* step or `ca_file`; neither names any certificate detail.

**Scope**: negative · **Priority**: Medium

**Source**: python-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/python-harness/code/`

**Technical references**: `construction/python-harness/nfr-design/nfr-design-patterns.md` (P-06)

---
