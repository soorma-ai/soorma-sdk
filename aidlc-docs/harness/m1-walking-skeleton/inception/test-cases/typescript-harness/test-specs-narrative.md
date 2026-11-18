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

**Scenario**: a tester, under the preconditions above, exercises “A supplied CA is trusted; an untrusted certificate fails” and observes the outcome below.

**Steps**:
1. Create a client with `caFile` set to the run's CA and bootstrap against the stub.
2. Repeat against a stub presenting a certificate from a different CA.

**Expected outcome**: The first bootstrap succeeds; the second fails with a `TransportError` naming a TLS verification failure, and no request body reaches the second server.

**Scope**: negative · **Priority**: High

**Source**: typescript-harness / FR-15

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-004 — There is no option to disable TLS verification

**Context**: A verification switch is the most common way client libraries become insecure. Covers FR-15.

**Preconditions**:
- The TypeScript package's public interface and source

**Scenario**: a tester, under the preconditions above, exercises “There is no option to disable TLS verification” and observes the outcome below.

**Steps**:
1. Search the options and the package for any setting that disables certificate verification.

**Expected outcome**: None exists.

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

**Scenario**: a tester, under the preconditions above, exercises “Nothing is derived from the host or environment variables” and observes the outcome below.

**Steps**:
1. Run the driver under two different hostnames and with unrelated environment variables set.
2. Create a client with an instance from `newInstanceId()` and bootstrap.

**Expected outcome**: The bootstrap's `instance` equals the supplied value; no request carries the hostname or any environment variable's value; `newInstanceId()` returns a UUID v4 that differs between calls.

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

**Expected outcome**: The provider was called exactly once; the runtime check finds no reference to the secret's value after the request was sent (TypeScript: after forced garbage collection, a heap snapshot holds no occurrence of the value).

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-04

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

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

**Expected outcome**: The first run succeeds after three requests spaced at least one second apart; the second fails with the last `ProblemError` once the bound is reached, with no request after it.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-13

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

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

**Expected outcome**: `POST /agent-credentials/current/renewal` with the current credential and no body was sent before the first `expiresAt`; the publish presents the renewed credential; the details show the new `expiresAt`.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-05

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-018 — At the end of a lineage the client bootstraps again

**Context**: The 24-hour lineage cap is reached by long-running agents. Covers FR-05.

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

**Expected outcome**: No new bootstrap is sent; `publish` fails with a `ClientStateError` carrying the refusal's Problem.

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

**Expected outcome**: Neither the secret nor the credential string appears in any log line, error message, or string form.

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

**Expected outcome**: Each is a valid version-00 `traceparent` with a non-zero trace id and parent id.

**Scope**: edge/boundary · **Priority**: High

**Source**: typescript-harness / FR-08

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-027 — A forwarded call asserts its own trace context

**Context**: The forwarded envelope's trace context is evidence of the previous hop, not this hop's assertion. Covers FR-08, FR-09.

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

**Expected outcome**: Only the stream-started item and the two Deliveries are yielded.

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

**Expected outcome**: A stream-ended item with no code is yielded; then, while the credential is valid, a new stream is opened and a stream-started item follows.

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

**Expected outcome**: The replacement subscribe was sent with the renewed credential before the old one expired; a stream-started item and a stream-ended item with code `superseded` are yielded; no `Last-Event-ID` header was sent and nothing claims continuity.

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

**Context**: Subscribe shares bootstrap's retry rule and surfaces every other failure. Covers FR-11, FR-13.

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

**Expected outcome**: The Delivery is yielded with envelope and seal intact, the payload absent, the payload text present, and the not-parsed flag set; forwarding sends the envelope text byte for byte.

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

**Expected outcome**: None remain open.

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

**Expected outcome**: Spans exist for the publish and the receive, named and attributed per OpenTelemetry's messaging semantic conventions, with no soorma-defined span name or attribute; the forwarding hop's span relates to the received trace as the specification's span rule states.

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

**Expected outcome**: It depends on the OpenTelemetry API only, and configures no exporter, sampler or provider.

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

**Scenario**: a tester, under the preconditions above, exercises “The package builds and installs from the repository, unpublished” and observes the outcome below.

**Steps**:
1. Build the package and install it into a new project from the repository path.
2. Import `@soorma/sdk`.

**Expected outcome**: It installs and imports on each supported runtime; the package metadata states Apache-2.0; nothing was published to a registry.

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

**Scenario**: a tester, under the preconditions above, exercises “Every conformance case passes on every supported runtime” and observes the outcome below.

**Steps**:
1. Run the runner with the TypeScript conformance driver on Node.js 24 and 26.

**Expected outcome**: Every case passes and none is skipped, on each runtime.

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

**Scenario**: a tester, under the preconditions above, exercises “Both agents bootstrap and one renews (done when 2)” and observes the outcome below.

**Steps**:
1. Start agents A and B with `fileSecret` reading their secret files.
2. Force one renewal on B.

**Expected outcome**: Both hold credentials naming their agent and environment `e`; B's renewal succeeds.

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

**Scenario**: a tester, under the preconditions above, exercises “The trace travels and a span is emitted (done when 5)” and observes the outcome below.

**Steps**:
1. Run the steps of the test case "B receives what A publishes (done when 3)" with the in-memory exporter installed.
2. Compare the `traceparent` on B's received envelope with the exported spans.

**Expected outcome**: A span's trace id equals the trace id in the `traceparent` on the envelope B received.

**Scope**: happy-path · **Priority**: High

**Source**: typescript-harness / FR-19, FR-14

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`

---

### TC-TH-064 — The example runs and prints the envelope and trace id

**Context**: The example is what a developer runs first. Covers FR-20.

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

**Expected outcome**: It names `e2e/core-up` and `e2e/setup` as the set-up, says delivery is live only (start B before A publishes), and says the span shape is unstable.

**Scope**: happy-path · **Priority**: Low

**Source**: typescript-harness / FR-20

**Construction artifacts**: `aidlc-docs/harness/m1-walking-skeleton/construction/typescript-harness/`

**Technical references**: `inception/application-design/unit-of-work.md`, `construction/typescript-harness/functional-design/`
