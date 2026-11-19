# Conformance

The language-neutral judge of every soorma-sdk language package (FR-03). **Every assertion lives
here, once** (`runner/`); a language provides only a **driver**: a small program that calls its
package's public interface and reports what it observed.

| Path | What it is |
| --- | --- |
| `../spec/behaviour.md` | The statements every language implements; each names its cases |
| `../spec/names.md` | The name table (the names check compares each language with its column) |
| `cases/{area}/CC-*.json` | The 90 cases: language-neutral data (`case.schema.json`), never code |
| `runner/` | Loader, link and fixture checks, request matchers (the vendored contract's own validator), evaluator, scheduler, reporter, `conformance run` |
| `stub/` | The scripted S3 and S4: TLS on loopback, byte-exact recording, SSE, connection faults |
| `reference-driver/` | Test only, in no package: proves the runner; `faults.json` holds the negative controls' declared sets |

## Running

```sh
pnpm conformance run --driver "<command>"            # full mode: every case must pass; a skip fails
pnpm conformance:reference                            # the reference driver's 23 declared cases
pnpm conformance:self-test                            # reference run, then the four negative controls
```

Options: `--mode full|reference`, `--fault NAME` (reference mode only), `--only CC-X,CC-Y`,
`--budget-ms N`, `--report PATH` (JSON; no secret, only lengths and counts),
`--foreign-user NAME` (CI only: the second user for CC-SEC-05), and, **outside CI only**,
`--local-skip CC-SEC-05` (it prints that the case did not run and why). There is no retry option.

Budgets: a full run per driver per runtime within **5 minutes**; the self-test within **8
minutes**. A run finishes, then fails if over budget, naming the slowest cases; a watchdog stops
a hung run at twice the budget. Each case runs in **a new driver process**. Timing assertions are
windows at least twice the value they concern. The run directory (`soorma-conformance-run-*`,
mode `0700`) holds the run's CAs and case files and is removed at the end; it is never uploaded.

## The driver protocol

JSON lines: the runner writes one command per line to the driver's stdin; the driver writes one
reply per line to stdout, and nothing else there (diagnostics to stderr).

```text
command  {"id": 7, "op": "publish", "args": {...}}
reply    {"id": 7, "ok": true,  "result": {...}}
       | {"id": 7, "ok": false, "error": {"type": "ProblemError", "status": 503, "code": "unavailable", ...}}
```

A driver uses **only its package's public interface**, except for `describe`'s values, `inspect`,
`spans`, `env`, `docs`, `warnings` and the timing hook.

### Commands

| `op` | `args` | Reply `result` |
| --- | --- | --- |
| `describe` | — | `language`, `runtime`, `sdkVersion`, `values` (below), `depthBound` (`D_lang`), `coverage` (reference only), `faults` |
| `create` | `dataGatewayUrl`, `eventIngestUrl`, `caFile`, `agent`, `instance`, `secret`, `values`?, `otel`? (`true`: install the driver's test OpenTelemetry SDK with an in-memory exporter; `false` or absent: none), `logLevel`?, `render`? (`true`: write every error, and the client, as text to stderr) | `{}`; a new `create` closes the previous client |
| `start` | — | `credential`: the public details |
| `credential` | — | `credential`: `{agent, instance, environment, expiresAt}` or `null`; never the credential string |
| `publish` | `payload`, `inSpan`? (`{name}`: run inside a tenant span the driver creates) | `traceContext` (`traceparent`, `tracestate`?), `tenantSpan`? (`{traceId, spanId}`) |
| `subscribe` | — | `{}` |
| `next` | `timeoutMs` | an item (below), or `{"timeout": true}`; an error reply when the subscription fails before a stream opens |
| `forward` | `ref` (a Delivery's `ref`), `payload`, `inSpan`? | as `publish`; calls the Delivery's own publish |
| `closeSubscription`, `close` | — | `{}` |
| `fileSecret` | `path`, `timeoutMs` | `{length}`, never the value |
| `newInstanceId` | — | `{value}` |
| `inspect` | `checks`: `secretRetained`, `providerCalls`, `openResources` | `secretRetained: {found, count}`; `providerCalls: n`; `openResources: {sockets, streams, timers}` |
| `warnings` | — | `warnings`: `[{code}]`, every warning the SDK emitted since `create`, in order; `code` is `clock-skew` for REN-07's warning (added at U3). Never a credential or a secret |
| `spans` | — | `spans`: `[{name, kind ('producer'/'consumer'), traceId, spanId, parentSpanId?, links: [{traceId, spanId}], status ('ok'/'error'/'unset'), attributes}]`; `providerIsNoop` |
| `names` | — | `names`: every exported name |
| `surface` | — | `members`: the options' fields and every settable member |
| `env` | `set`: `{NAME: value}` | sets environment variables in the driver before `create` (CC-CFG-06 checks nothing is read from them) |
| `docs` | `topic`: `spans` or `delivery` | `text`: the package's documentation on that topic |

Secrets (`create.secret`): `{kind: "test", bytes: <base64>}` (a provider the driver builds that
returns a **new** string decoded from the bytes on each call, keeping only the bytes),
`{kind: "file", path}` (the package's file provider), `{kind: "literal", value}`,
`{kind: "failing"}` (a provider that fails).

Items (`next`): `{kind: "streamStarted"}`; `{kind: "delivery", ref, envelope, envelopeText, seal,
payload?, payloadText, payloadParsed}` (`payload` absent when not parsed);
`{kind: "deliveryError", reason, text}`; `{kind: "streamEnded", code (string or null), terminal}`;
`{kind: "done"}` once a subscription has finished.

Errors: `{type: "ProblemError", status, code (string or null), title, detail, retryAfter?, problem
(the whole Problem, when the body was one)}`; `{type: "TransportError", reason: "tls" |
"connection" | "timeout" | "unusable-response"}`; `{type: "SecretSourceError", path?, reason:
"not-regular-file" | "readable-by-others" | "writable-by-group" | "writable-by-others" |
"owned-by-another-user" | "provider-failed" | "unreadable"}`; `{type: "ClientStateError",
state}`.

### Values and the timing hook

`describe.values` reports the SDK's named values (`spec/behaviour.md` §0) in milliseconds or
items: `H_renew`, `R_max`, `W_max`, `B_init`, `B_factor`, `B_cap`, `L_ends`, `W_super`, `N_buf`,
`T_idle`, `T_req`, `R_min` (added at U3, REN-07). A case may pass `values` in `create`; the driver applies them through **a test
hook that is not part of the public interface** (not exported, not in the name table). Cases
assert relative to the values in force.

### CDI-02: checking that no secret is retained

The check is made by the runtime, never reported from the driver's own fields (US-02 #3):

- **TypeScript**: run the driver with `--expose-gc`; after `start`, force garbage collection,
  stream a heap snapshot in memory, and search it for the secret's value and each half of it,
  as bytes. Never write the snapshot outside the run directory; report only `{found, count}`
- **Python**: before `start`, keep `baseline = sys.getrefcount(s)` for the string `s` the test
  provider returns (the provider returns `s` itself); after `start`, `gc.collect()`, then
  `found` is `sys.getrefcount(s) > baseline`. This sees references to `s`, not copies made from
  it (U4's Functional Design may add a check for those)

## The case format

`case.schema.json` is authoritative. A case names its `statements`, the contract `fixtures` it
uses (and the invalid `negativeFixtures` its request matchers must reject), its `timeoutMs`,
optional `values` and `setup` (files: `file`, `fifo`, `device`, `symlink`; modes; a foreign
owner), the stub `script` (exchanges matched in order; bodies, Problems, SSE streams, `reset`;
listener `refuse`), the driver `commands`, and the `expect`ed assertions (`request-exact`,
`request-shape`, `request-count`, `request-timing`, `observation`, `item-sequence`,
`runtime-check`, `span`, `surface`, `absence`). Placeholders (`${S3}`, `${CA}`, `${FILE:x}`,
`${TIME:+H_renew+2000}`, `${DEPTH+8}`, …) are resolved at case start (`runner/src/template.ts`).
