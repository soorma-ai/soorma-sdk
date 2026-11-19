# Logical Components — U3 `typescript-harness`

The components that carry U3's NFRs, their responsibilities, and their dependencies. Patterns
(`P-…`) are `nfr-design-patterns.md`'s. U3 deploys nothing: these are modules, private
packages and CI jobs.

## 1. The Package `@soorma/sdk` (`typescript/src/`)

| Module | Component | Responsibility | NFRs and patterns |
|---|---|---|---|
| `index.ts` | — | Exports exactly the name table's TypeScript column | NAM-01 |
| `client.ts` | C-11 | `AgentClient`: the states (domain-entities §4); orchestration; `close()`; one `AbortController` | P-07; NFR-U3-09 |
| `options.ts` | C-12 | Option presence and type checks; unknown members refused; `newInstanceId` | TH-API-02, -03 |
| `secrets.ts` | C-13 | `fileSecret`: non-blocking open, handle checks, read; refused on Windows | TH-SEC; SECURITY-11 |
| `keeper.ts` | C-14 | **The security-critical module**:<br>- bootstrap;<br>- the renewal schedule (P-03);<br>- `isUsable()`, the one validity check (P-02);<br>- lineage and warning state;<br>- revocation;<br>- the secret's path (P-08) | NFR-U3-03, -08, -13, -14 |
| `retry.ts` | (C-15) | The one retry policy (P-01) | NFR-U3-07 |
| `transport.ts` | C-15 | `node:https` requests; the trust store, built at `start()` (P-06); `T_req`; compact bodies with the forwarded envelope spliced; Problem parsing; the SSE line reader | NFR-U3-04, -11 |
| `draft.ts` | C-16 | Drafts only; no stamped field | DRF |
| `subscription.ts` | C-17 | The supervisor's state machine and bounded queue; backpressure; `T_idle` and `W_super` counted only while reading (P-04) | SUB, STR; NFR-U3-09 |
| `reader.ts` | C-18 | The iterative delivery-line scanner (P-09) | TH-RD; NFR-U3-05 |
| `json.ts` | (C-16) | The iterative payload check; `RangeError` caught (P-09) | TH-PUB-01 |
| `tracing.ts` | C-19 | Spans through `@opentelemetry/api`; the conventions at 1.45.0 as constants; the received context parsed by the SDK | TH-SPN; NFR-U3-17 |
| `errors.ts` | C-20 | The five error classes, with safe string and inspect forms | P-08; NFR-U3-12 |
| `clock.ts` | — | `wallNow`, `monoNow`, `setTimer`, `clearTimer`: every time read and timer (P-05) | TS-U3-10 |
| `limits.ts` | — | The named values (NFR-U3-06) | TS-U3-11 |
| `generated/` | C-10 | The agent-side contract types, from the vendored generator; every envelope member optional | NFR-U3-20 |

**Dependencies run one way**:

```text
index --> client, options, secrets, errors, (types)
client --> keeper, subscription, transport, draft, reader, tracing, json, errors
keeper --> transport, retry, secrets(provider type), clock, limits, errors
subscription --> transport, retry, reader, tracing, keeper(isUsable, credentials), clock, limits, errors
transport --> errors, limits
retry --> clock, limits, errors
reader, json, draft, tracing --> errors, limits, generated
```

Text alternative:
- The entry point exposes the client, the options, `fileSecret` and the errors.
- The client uses the keeper, the subscription, the transport, the draft builder, the reader, tracing and the payload check.
- The keeper and the subscription use the transport, the retry policy, the clock and the limits. The subscription also asks the keeper for validity and new credentials.
- The low-level modules use only the errors, the limits and the generated types.

No module depends on the client; nothing reaches back up.

**Lint rules** (`typescript/src/` only): no `process.env`, `os.hostname`,
`os.networkInterfaces` or `console`; no `Date.now`, `performance.now`, `setTimeout` or
`clearTimeout` outside `clock.ts`. A test searches for an `expiresAt` comparison outside
`keeper.isUsable` (P-02).

## 2. The Private Packages

| Package | Path | Responsibility | Depends on |
|---|---|---|---|
| The conformance driver | `typescript/conformance-driver/` | The driver protocol, the public API only; U1's `heap.ts` for `inspect`; the `warnings` report (REN-07); `describe` with every named value | `@soorma/sdk` (`workspace:*`), U1's `conformance/reference-driver/src/heap.ts` |
| The example | `typescript/examples/two-agents/` | `agent-a.ts`, `agent-b.ts` (configuration block, `run(config)`), `README.md` | `@soorma/sdk` |
| The end-to-end test | `typescript/e2e/` | The scenario (business-logic-model §10): the fast `Date`, the decoy span, the in-memory exporter | `@soorma/sdk`, the example's agent files, `@opentelemetry/sdk-trace-base` (a test dependency, as U1's reference driver uses it) |

## 3. Changes to U1's Components (F42; business-rules TH-F42-02)

| U1 component | Change |
|---|---|
| `spec/behaviour.md` | REN-07 and `R_min` (§0); the sentences in STR-02 and STR-05 (P-04) |
| `conformance/cases/` | CC-REN-06, CC-REN-07, CC-STR-12, CC-STR-13 |
| The driver protocol (`conformance/README.md`) and the runner | The `warnings` report; if needed, stub times relative to each response or before the case's start |
| The reference driver | Implements REN-07 and declares CC-REN-06 and CC-REN-07; declares CC-STR-12 and CC-STR-13 if it can |
| `tools/generated-types/packages.json`, `tools/names/drivers.json`, `tools/packaging/packages.json` | List `typescript/` and its driver |

The class of each, and the refusal sweep, are Code Generation's. **The self-test's fault sets
stay unchanged.**

## 4. CI Components

| Job | Components | NFRs |
|---|---|---|
| `unit` (extended) | The package's unit tests (P-01 to P-09), CDI-06's test, the clock and source checks | NFR-U3-25 |
| `checks` (extended) | The names check, generated-types check and packaging guard over `typescript/` | NFR-U3-20, -21 |
| `conformance-typescript` | Matrix Node 24 and 26 with API 1.10.0, plus Node 24 with 1.9.0; the CI user helper (P-10); every case | NFR-U3-15, -23 |
| `e2e-typescript` | U2's job renamed (JOB-06), with the scenario | NFR-U3-24 |
| `package-typescript` | Pack; the guard over the tarball; a fresh project with an ESM import and a CommonJS `require()`, each constructing an `AgentClient`; the agent file copied in | NFR-U3-19, -22 |

## 5. NFR to Component

| NFR | Components |
|---|---|
| NFR-U3-01, -02 | `reader.ts`, `draft.ts`, `transport.ts` (tolerance, splicing); no enforcement anywhere |
| NFR-U3-03, -08, -14 | `keeper.ts` (P-02, P-03) |
| NFR-U3-04, -05 | `client.ts`, `transport.ts`, `reader.ts`, `json.ts` |
| NFR-U3-06 | `limits.ts`; the driver's `describe` |
| NFR-U3-07 | `retry.ts` |
| NFR-U3-09, -10 | `client.ts`, `subscription.ts` (P-07) |
| NFR-U3-11 | `transport.ts` (P-06) |
| NFR-U3-12, -13 | `keeper.ts`, `errors.ts` (P-08) |
| NFR-U3-15 | `conformance-typescript` (P-10) |
| NFR-U3-16 to -18 | the manifest, the lock file, `tracing.ts` |
| NFR-U3-19 to -22 | `typescript/package.json`, `generated/`, the guard, `package-typescript` |
| NFR-U3-23 to -26 | the CI jobs |
| NFR-U3-27 | the package README |
