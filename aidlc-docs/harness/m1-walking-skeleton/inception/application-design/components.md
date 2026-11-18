# Components — soorma-sdk, M1

Application Design for the soorma-sdk column of the M1 slice brief (`0aad84a`), against the
contract at `contract-v0.1.0`. Answers: plan Q1 to Q9 (audit 2026-11-18T05:32:10Z).

**Language key**: **N** language-neutral, written once · **T** TypeScript · **P** Python. A
component marked **T, P** exists once per language, with the same responsibilities and the
same names under the name table (C-02). Business rules are Functional Design's.

---

## Repository Layout (Q1 A)

```
contract/        C-01  vendored from soorma-core @ contract-v0.1.0, never edited
spec/            C-02  behaviour specification and name table
conformance/     C-03  case files, scripted platform stub, runner
tools/           C-04  repository checks
e2e/             C-05  core-up, setup, core-down (shared by both languages)
.github/         C-06  CI workflows (dco.yml exists)
typescript/      C-10 to C-22 (T): the package @soorma/sdk, its driver, examples, e2e test
python/          C-10 to C-22 (P): the package soorma, its driver, examples, e2e test
```

A third language adds one directory, one conformance driver, and one column in the name
table. Nothing else moves.

## Package Names (Q2 X)

| Language | Package | Import | Registry status |
|---|---|---|---|
| TypeScript | `@soorma/sdk` | `@soorma/sdk` | npm organisation `soorma` exists (the user's), holds no package yet |
| Python | `soorma` (distribution) | `soorma` | PyPI `soorma` is the user's 0.0.0 placeholder, described as the Python client harness |

**PyPI `soorma-sdk` is a redirect, not this package's name**: the user's 0.0.0 placeholder that
points to `soorma` ("Install this instead"). Nothing is published in M1 (D-05): both packages
are built and installed from this repository.

---

## Language-Neutral Components

### C-01 Contract copy — N
- **Purpose**: the one copy of soorma-core's wire contract this repository builds against (FR-01;
  US-12)
- **Responsibilities**: holds `contract/` exactly as at `contract-v0.1.0` (peeled commit
  `c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d`), all files including fixtures; `contract/PIN`
  beside it records the tag, the peeled commit, the git tree id of `contract/` at that commit,
  and a SHA-256 per file. Never edited by hand: an insufficiency is raised against the
  soorma-core initiative
- **Interface**: files read by the type generators (C-10), the conformance cases (C-03), and
  the drift check (C-04)

### C-02 Behaviour specification and name table — N
- **Purpose**: the single statement of what every language does (FR-02, FR-17; US-13)
- **Responsibilities**: `spec/behaviour.md` states each PF §11 operation, trace emission, the
  Problem codes surfaced, the retry rules, stream boundaries, the deep-payload fallback, exact
  forwarding, the span rules, the secret provider rules, and live-only delivery
  (GAP-INT-001) and the unstable span shape (GAP-INT-002). Each numbered statement names the
  conformance cases that check it. `spec/names.md` is the **name table** (Q3 A): one row per
  operation and concept, with its TypeScript and Python spelling
- **Naming convention**: the PRD and contract vocabulary. TypeScript: camelCase members,
  PascalCase types. Python: snake_case members, PascalCase classes (PEP 8). Nothing is
  exported that the table does not list
- **Interface**: read by people; parsed by the name check (C-04) and the conformance runner
  (statement-to-case links)

### C-03 Conformance suite — N (Q8 A)
- **Purpose**: the cases every language must pass, judged once (FR-03; US-13 #2, US-14)
- **Parts**:
  - **Cases** (`conformance/cases/*.json`): language-neutral data: the platform's scripted
    responses, the commands to the client, and the expected observations and requests. Each
    case names the specification statements it checks. Shapes come from
    `contract/fixtures/0.1.0/`
  - **Scripted platform stub** (`conformance/stub/`, TypeScript): S3 and S4 over TLS with a
    CA made per run, replaying each case's responses (including SSE streams, `end` events,
    heartbeats, dropped connections, `503` with `Retry-After`, short `expiresAt` values) and
    recording every request byte for byte
  - **Runner** (`conformance/runner/`, TypeScript): starts the stub and a language's driver
    (C-21), sends each case's commands, and makes **every assertion**. It fails if a driver
    skips or fails any case, and if any specification statement has no case
- **Interface**: `conformance run --driver "<command>"`; the driver protocol (JSON lines on
  stdin and stdout) is in `component-methods.md`
- **Unit shape**: ordinary (D-14), to confirm at Units Generation

### C-04 Repository checks — N
- **Purpose**: failing checks, not review comments, for what must not drift (US-12, US-13)
- **Checks** (`tools/`, TypeScript on Node.js 24 or later):
  - **contract drift**: `contract/` matches `contract/PIN`, and `PIN` matches soorma-core at
    the tag (the tree id, fetched): any difference, addition or removal fails (US-12 #1)
  - **generated types**: each language's committed generated types equal what the copy
    generates (US-12 #2)
  - **names**: each package's exported names equal the name table's column for it (US-13 #3)
  - **SPDX**: every source file carries `SPDX-License-Identifier: Apache-2.0` (NFR-09)

### C-05 End-to-end harness — N (Q9 X)
- **Purpose**: soorma-core at `contract-v0.1.0`, fresh every run, with two agents registered,
  for the end-to-end scenario and the examples (FR-19, D-12; US-11 #1, US-14 #4)
- **Parts**:
  - **`e2e/core-up`**: clones soorma-core at the tag into a new git-ignored directory
    (`.e2e/soorma-core/`, removed first if present), fails unless the checkout's commit is
    `c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d`, builds the S1 to S4 images as soorma-core's CI
    does, then `pnpm stack:init` and `pnpm stack:up`. It refuses to start if a `soorma-local`
    Compose project or its volumes already exist, rather than tearing down a stack it did not
    start. It ends by writing a **single-use fresh-stack marker**
  - **`e2e/setup`**: the human steps as raw HTTPS calls, outside both packages; consumes the
    marker, so it never runs against an old stack (the first authentication from the handover
    file works once). Registers agents A and B in environment `e`, and writes each agent's
    registration secret to its own file (mode `0600`, directory `0700`). No human secret or
    credential is written anywhere
  - **`e2e/core-down`**: `docker compose … down -v` on the clone, then removes it. Run at the
    end of every run, on success or failure
- **Interface**: three commands, used identically in CI and locally

### C-06 CI workflows — N (Q9 X)
- **Purpose**: every check green on every code PR, DCO included (Workflow Planning approval)
- **Responsibilities**: per-language build, lint, unit tests and conformance on both supported
  runtimes (Node 24 and 26; Python 3.11 and the newest release); the repository checks; the
  end-to-end jobs; the existing DCO check. Actions pinned by commit SHA, read-only default
  permissions (NFR-07)
- **End-to-end triggers** (Q9 X, soorma-core's #26 pattern): pull requests and pushes to `dev`,
  **not pushes to `main`**; skipped by a job-level condition when every changed file is under
  `aidlc-docs/` (fail-safe: they run whenever the diff cannot be computed or is empty). Detail
  in `services.md`

---

## Per-Language Components (T, P)

The package's public interface is the client (C-11), the secret providers (C-13), the
subscription items (C-17), the Delivery (C-18), and the errors (C-20). Everything else is
internal.

### C-10 Generated contract types — T, P
- **Purpose**: types for the agent-side operations, generated from C-01 (FR-01, FR-18)
- **Responsibilities**: generated from `data-gateway.openapi.yaml`, `event-ingest.openapi.yaml`,
  `conventions/components.openapi.yaml`, `envelope.schema.json` and `delivery.schema.json`.
  Nothing is generated for S1 or S2 (no human-side operation, FR-16). Committed and checked by
  C-04. The generator is chosen at NFR Requirements
- **Location**: `typescript/src/generated/`, `python/src/soorma/_generated/`

### C-11 Agent client — T, P (Q4 A)
- **Purpose**: one client per agent instance; the developer's entry point (US-01 to US-10)
- **Responsibilities**: holds the configuration (C-12); creating it contacts nothing;
  `start()` bootstraps and starts renewal; `close()` ends every stream and timer; `publish()`
  without forwarding; `subscribe()`; exposes the credential's details read only, never the
  credential string. Orchestrates C-14 to C-19
- **Never offers**: an environment setting, a human credential, a delegation credential, a
  platform-stamped field, a TLS-verification switch, a topic or discovery parameter (FR-15,
  FR-16, FR-07, FR-11)

### C-12 Client configuration — T, P
- **Purpose**: the values a developer supplies, and nothing inferred (FR-15; US-01)
- **Values**: S3 base URL, S4 base URL, an optional CA file path, the logical agent
  identifier, the instance identifier, the secret provider. **No environment identifier**;
  nothing read from the host, the process's environment variables, or deployment metadata
- **Instance identifier (Q6 A, T-5)**: required. `newInstanceId()` returns a random UUID v4,
  reading nothing about the host; the developer calls it deliberately

### C-13 Secret providers — T, P (Q7 X)
- **Purpose**: where the registration secret comes from, for one bootstrap at a time (D-09;
  OB-9; US-02 #3)
- **The provider type**: a function the tenant supplies (TypeScript `() => Promise<string>`;
  Python an async callable returning `str`). The SDK calls it once per bootstrap and keeps no
  reference after that bootstrap's request is sent. A tenant on a secrets manager writes their
  own
- **`fileSecret(path)`, the one provider shipped**. **The SDK ships no provider that reads an
  environment variable.** Each call opens the path, **follows symlinks and checks the final
  file** (Kubernetes' `..data` links), checks it on the opened handle, then reads it, strips
  one trailing line ending, returns the value, and keeps nothing. It **refuses**, without
  reading the contents, when the final file is:
  - not a regular file
  - **writable by group or others**
  - **readable by others**
  - **owned by anyone other than the process's user or root**

  A **group read is allowed**, so Kubernetes secret volumes with `fsGroup` work. A refusal
  names the path and the reason, never the contents. Windows behaviour is Functional Design's
- **README** documents the matching settings: Kubernetes (`defaultMode: 0440` with `fsGroup`),
  and Docker (a secret file mounted with mode `0400` or `0440`, owned by the container's user
  or root)
- **The examples' configuration block names the path**, never the secret, for example
  `fileSecret('./.secrets/agent-a.secret')`

### C-14 Credential keeper — T, P
- **Purpose**: acquire, renew, hold and present the agent credential (FR-04, FR-05, FR-06;
  US-02, US-03)
- **Responsibilities**: bootstrap through C-13 and C-15 with `{ agent, secret, instance }`, no
  envelope; hold the credential **in memory only**, opaque; schedule renewal from `expiresAt`
  with headroom (NFR-02); on `credential_expired` at the end of a lineage, bootstrap again;
  on revocation (`credential_refused`), stop, terminally (PF FR-011); announce each new
  credential to C-17. Presents only as `Authorization: Bearer`, only to the configured S3 and
  S4
- **The one security-critical module** (SECURITY-11): everything that touches the secret or
  the credential lives here and in C-13

### C-15 Transport — T, P
- **Purpose**: every HTTPS request, to the configured S3 and S4 only (FR-06, FR-10, FR-13,
  FR-15)
- **Responsibilities**: TLS with verification always on, trusting the system store plus the
  optional CA; `Soorma-Contract-Version: 0.1.0` on calls without a draft; bodies as **compact
  JSON with no HTML-safe or ASCII escaping** and no duplicate members, with forwarded envelope
  text spliced in **byte for byte** (FR-09); Problems parsed with unknown codes and members
  kept, `Retry-After` read; the bounded retry on `503` for bootstrap, renewal and subscribe,
  never publish, never `429` (D-11; NFR-04); every error path releases its resources. Logs
  name no secret, credential, or payload content (NFR-06)

### C-16 Draft builder — T, P
- **Purpose**: the only way a draft is made (FR-07, FR-08, FR-09; US-04, US-08)
- **Responsibilities**: exactly `clientContractVersion` `"0.1.0"`, `traceContext` (this hop's
  `traceparent`, valid and never all-zero: the publish span's context (C-19) when it is valid,
  otherwise identifiers the SDK generates, as when no OpenTelemetry SDK is installed;
  `tracestate` when there is one), and, when forwarding,
  `inbound: { envelope, seal }` with the envelope as its received text. Offers no way to set a
  platform-stamped field. Never copies the forwarded envelope's trace context into the draft

### C-17 Subscription and stream supervisor — T, P (Q5 A)
- **Purpose**: one async iterator per subscription, across every stream it takes (FR-11;
  US-05, US-06)
- **Responsibilities**: `POST /subscriptions` with `{ draft }`; reads the event stream; turns
  `delivery` events into Deliveries (C-18), consumes heartbeats silently, surfaces `end` with
  its code (an open set; unknown codes surfaced, never fatal) or *no code received* when the
  connection drops. On each new credential, opens the next stream before the old one expires
  and yields **stream ended** and **stream started** items, promising no continuity: no
  `Last-Event-ID`, no replay (GAP-INT-001). At most one stream per credential lineage, except
  while a replacement supersedes it. Finishes after a terminal end (revocation, `close()`)

### C-18 Delivery reader — T, P
- **Purpose**: read a Delivery whatever it holds (FR-12; US-07)
- **Responsibilities**: extract `envelope`, `seal` and `payload` **independently of member
  order**; keep the envelope's **exact received text**; expose the envelope parsed and read
  only, unknown fields and enumerated values kept; treat received identifiers as opaque;
  parse the payload with native numbers and keep its **source text**; beyond the language's
  parse-depth bound (NFR-03), deliver the payload as raw text flagged as not parsed, with
  envelope and seal intact and forwardable (D-07); a line that cannot be read becomes a
  **delivery error** item and the stream continues
- **The Delivery's `publish(payload)`** forwards its context: the default path (US-08 #1, #5)

### C-19 Tracing — T, P
- **Purpose**: spans through the OpenTelemetry API only (FR-14; US-09; soorma-sdk GAP-INT-002's
  work-around)
- **Responsibilities**: spans for publish and for each received Delivery, under OpenTelemetry's
  messaging semantic conventions, **no soorma-defined name or attribute**; **no exporter, no
  sampler**; the shape documented as unstable. Depends on the OpenTelemetry **API** only, which
  does nothing until the tenant installs an OpenTelemetry SDK. **US-Q1** (a forwarding hop's
  span: child of, or linked to, the trace it received) is decided in this component's
  Functional Design

### C-20 Errors — T, P
- **Purpose**: every failure in a form tenant code can act on (FR-13; US-10)
- **Types**: `SoormaError` (base); `ProblemError` (an RFC 9457 Problem: status, code, title,
  detail, `Retry-After`, every member kept); `TransportError` (connection, TLS);
  `SecretSourceError` (a provider's refusal or failure: names the path and the reason, never
  the value); `ClientStateError` (an operation the client's state does not allow, such as
  publish before `start()` or after revocation)
- **Never carries** a secret, a credential, or payload content in its message or string form
  (NFR-06)

### C-21 Conformance driver — T, P
- **Purpose**: lets the runner (C-03) drive this language's public API (FR-03; US-14 #2)
- **Responsibilities**: reads commands as JSON lines on stdin, calls the package's **public
  interface only**, writes observations as JSON lines on stdout. Answers the few checks that
  look inside a language (no secret retained, US-02 #3) from its own internals. Not part of
  the package's public interface
- **Location**: `typescript/conformance-driver/`, `python/conformance_driver/`

### C-22 Example and end-to-end test — T, P
- **Example** (`typescript/examples/two-agents/`, `python/examples/two_agents/`): agent A
  publishes, agent B is subscribed; prints the envelope B received and the trace id. Each
  agent file has **one marked configuration block** (S3 and S4 addresses, CA path, agent
  identifier, secret path via `fileSecret`, instance identifier via `newInstanceId()`); public
  interface only; no human credential. The README names `e2e/core-up` and `e2e/setup`, and
  says that delivery is live only (start B first) and that the span shape is unstable
  (US-11)
- **End-to-end test**: the scenario of FR-19 in the language's test framework, with a
  test-installed in-memory exporter (never one the SDK ships), reading each agent's secret
  through `fileSecret` from the files `e2e/setup` wrote
