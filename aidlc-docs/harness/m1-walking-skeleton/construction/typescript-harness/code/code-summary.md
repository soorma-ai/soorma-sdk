# Code Summary — U3 `typescript-harness`

`@soorma/sdk`, the TypeScript harness (C-10 to C-22), built against soorma-core's contract tag
`contract-v0.1.0` (`c1e3d7f`). Code Generation ran in nine commit groups on `dev`, each gated and
pushed, with its CI run waited on; this summary is G9's (plan Step 42).

## Created

| Area | Files |
| --- | --- |
| The package | `typescript/package.json` (`@soorma/sdk` 0.1.0, ESM, `exports` with `types` then `default`, `engines.node` `>=24`, peer `@opentelemetry/api` `^1.9.0`; files `dist/` without `dist/internal`, the README, `LICENSE`, `NOTICE`), `typescript/tsconfig.build.json`, `typescript/scripts/generate.ts` (C-10 from the vendored generator) |
| Package source (`typescript/src/`) | `index.ts` (exactly the name table's TypeScript column), `client.ts`, `options.ts`, `keeper.ts` (bootstrap, renewal, REN-07), `secrets.ts` (`fileSecret`), `transport.ts` (TLS trust store, requests, Problems), `retry.ts`, `clock.ts` (P-05), `limits.ts` (the named values), `json.ts` (the payload check and iterative serializer), `draft.ts`, `tracing.ts`, `reader.ts` (the iterative delivery reader), `subscription.ts` (the P-04 supervisor), `delivery.ts`, `errors.ts`, `types.ts`, `internal/test-values.ts` (the values hook, never shipped), `generated/` (agent-side contract types) |
| Package tests | `skeleton.test.ts`, `keeper.test.ts`, `g3.test.ts`, `g4.test.ts`, `g5.test.ts`, `g5-exit.test.ts` (TC-TH-071 in a child process against U1's stub) |
| The conformance driver | `typescript/conformance-driver/driver.ts`, `names.ts` (names and surface from `dist/index.d.ts`), `spans.ts` (the test OpenTelemetry SDK) |
| The example | `typescript/examples/two-agents/agent-a.ts`, `agent-b.ts`, `README.md` |
| The end-to-end scenario | `typescript/e2e/scenario.test.ts`, `typescript/e2e/vitest.config.ts` |
| Tools | `tools/otel-api-floor/use-floor.ts` and its test (the 1.9.0 floor from the lock); `tools/package-typescript/check.ts` and its test (the packed package in a fresh project) |
| Documents | `typescript/README.md`, `typescript/LICENSE`, `typescript/NOTICE` |

## Changed

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | `checks` builds the package before the names check; `conformance-typescript` (a matrix of three); `e2e` renamed `e2e-typescript`, with the package built and the scenario after `prove-stack`; `package-typescript` |
| `.github/dependabot.yml`, `DEPENDENCIES.md` | `opentelemetry-api-floor` ignored; it moves by hand with the peer range |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `package.json`, `tools/package.json` | `typescript/` joins the workspace; its development dependencies; `opentelemetry-api-floor` (`npm:@opentelemetry/api@1.9.0`) in `tools/`; scripts `e2e:scenario-typescript`, `package:typescript` |
| `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `.prettierignore` | `typescript/` checked and tested; `@soorma/sdk` mapped to the source for the typecheck; `typescript/e2e/` left out of `pnpm test`; the package's lint rules (P-05 clock, CFG-05, CFG-07) |
| `tools/names/drivers.json`, `tools/generated-types/packages.json`, `tools/packaging/packages.json` | The package and its driver listed: each check now has a subject |
| `README.md`, `e2e/README.md` | `e2e-typescript` and the scenario command |
| U1's specification, cases, runner, stub and reference driver; U2's workflow test | The F42 changes below |

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter @soorma/sdk build` | `tsc` to `typescript/dist/` |
| `pnpm conformance run --driver "node --expose-gc typescript/conformance-driver/driver.ts"` | The 95 cases through the TypeScript driver (`--foreign-user` in CI; `--local-skip CC-SEC-05` locally only) |
| `pnpm e2e:scenario-typescript` | The end-to-end scenario, after `core-up`, `setup`, `prove-stack` and the build |
| `pnpm package:typescript` | Pack, guard the tarball, install it fresh, import and `require()`, the agent files type-checked and imported |
| `pnpm test` | 282 tests (98 from U1, 87 from U2, the rest added at U3) |

## Changes to Earlier Units' Tests (F42)

Every change to U1's or U2's tests, specification or cases, with its class, its diff, and the
message that covered it (timestamps are `audit.md` entries). The self-test passed after each,
with every fault set as declared and `faults.json` unchanged.

**U1's self-test ran its timing cases with production values until `0a91e6a`**: the runner never
passed a case's `values` to the driver's `create`, so the reference driver never received them,
contrary to `conformance/README.md`.

### G1 (`89aa962`), covered by the plan approval (2026-11-19T06:55:43Z) unless stated

| Change | Class | Diff |
| --- | --- | --- |
| `spec/behaviour.md` §0: `R_min` | 1 | `+ \| R_min \| The renewal floor: the least time between receiving a credential and the next renewal, on a monotonic clock (REN-07; added at U3) \| NFR Requirements \|` |
| `spec/behaviour.md` §4: REN-07 | 1 | A new statement: renewals no sooner than `R_min` after a response, on a monotonic clock; one clock-skew warning per lineage; the lineage's expiry then left to S3 |
| SEC-01 reworded (decided at the NFR Design approval, 2026-11-19T05:24:09Z) | 3 | `- …exactly once per bootstrap…` / `+ …exactly once per bootstrap attempt… A retried bootstrap (PRB-05, PRB-08, PRB-09) calls it again, and no reference to an earlier attempt's secret remains during the backoff or Retry-After wait (SEC-02)`; cases `+ CC-ACQ-08` |
| STR-02's sentence (decided at the NFR Design answers, 2026-11-19T05:13:36Z) | 3 | `+ T_idle is silence while the SDK is reading the stream: a stream paused because tenant code has not pulled items (SUB-06) does not time out, and a resume restarts T_idle…`; cases `+ CC-STR-12` |
| STR-05's sentence (same decision) | 3 | `+ W_super counts only while the old stream is read; the new stream may be paused from its opening until the old stream ends…`; cases `+ CC-STR-13` |
| The protocol's `warnings` command (`conformance/README.md`; `case.schema.json` op enum) | 1 | An added command, `{ warnings: [{ code }] }` |
| The stub's `{"$expiresIn": …}` response value (`stub/src/delivery.ts`; one test added in `stub.test.ts`) | 1 | An added capability; existing scripts unchanged |
| The reference driver implements REN-07 and `warnings` | 1 (the rule's exception) | Shown to behave as before: the reference run and the four faulted runs unchanged |
| CC-REN-06, CC-REN-07, CC-ACQ-08, CC-STR-12, CC-STR-13 | 1 | Added cases; the reference driver declares all but CC-STR-13 |
| `R_min: 1` in the `values` of 13 cases that script a renewal (Step 7a) | 1 | `+ "R_min": 1` in CC-CFG-03, CC-NEV-03, CC-PRB-08, CC-REN-01 to 05, CC-STR-04, 05, 06, 10, 11 |
| `spec.test.ts`: the statement count (approved 2026-11-19T07:09:13Z) | 3 | `- expect(statements).toHaveLength(103);` / `+ expect(statements).toHaveLength(104);` |
| `cases.test.ts`: the case count, and every id (approved 2026-11-19T07:09:13Z, with the id check the user added) | 3 | `- it('holds the 90 cases of the approved catalogue, with no problem'…expect(loaded.cases).toHaveLength(90)` / `+ it("holds U1's 90 cases and the 5 added at U3, with no problem"…toHaveLength(95)`, plus each of U1's 90 ids from a fixed list and the 5 new ones |

### G6, covered by the user's message of 2026-11-19T14:51:48Z

| Commit | Change | Class | Diff |
| --- | --- | --- | --- |
| `0a91e6a` | The runner passes a case's `values` to `create` (`conformance/runner/src/run.ts`), with a runner test (fixtures CC-AAA-06, CC-AAA-07; the fake driver echoes `create`) | 3 | `+ if (cmd.op === 'create' && c.values) args.values = { ...c.values };` |
| `78def37` | CC-STR-04, CC-STR-11: `T_idle` above the longest silence, each with a `$comment` | 3 | `- "T_idle": 1500,` / `+ "T_idle": 10000,` |
| `c391d72` | CC-PRB-08: exchange `s3` for STR-04's replacement subscribe; `T_idle` raised; its `$comment` updated | 3 | `+ { "label": "s3", "match": { "listener": "S4", "method": "POST", "path": "/subscriptions" }, "respond": { "stream": [{ "hold": true }] } }`; `- "T_idle": 1500,` / `+ "T_idle": 10000,` |
| `cda4473` | The name table: a `state` row (Python column filled for U4); `toJSON` an idiom in `names.md` and `IDIOMS`, with a new test | name table | `+ \| client state \| client state error \| \`state\` \| \`state\` \|`; `+ 'toJSON',` |

### G7, covered by the user's message of 2026-11-19T15:58:14Z

| Commit | Change | Class | Diff |
| --- | --- | --- | --- |
| `2c70ed4` | CC-STR-05: `T_idle` above the longest silence, CC-STR-04's `$comment` | 3 | `- "T_idle": 1500,` / `+ "T_idle": 10000,` |
| `fb6233f` | CC-STR-06: the same (it failed on Node 26 in CI run 44555060916) | 3 | `- "T_idle": 1500,` / `+ "T_idle": 10000,` |
| `ec74d30` | CC-STR-10: the same | 3 | `- "T_idle": 1500,` / `+ "T_idle": 10000,` |
| `3549c29` | `conformance/README.md`: *Rules for case authors*: `T_idle` exceeds every silence on a stream a case keeps open, unless the case tests the idle timeout itself | 1 (documentation) | A new section |

### G8, covered by the plan approval (2026-11-19T06:55:43Z, Step 38)

| Commit | Change | Class | Diff |
| --- | --- | --- | --- |
| `30ffa4b` | U2's workflow test follows the job's rename, and gains a test for the scenario's steps | 1 | `- const e2e = CI.jobs.e2e as Job;` / `+ const e2e = CI.jobs['e2e-typescript'] as Job;`; a new `describe` (package built before `core-up`; the scenario after `prove-stack`, before `core-down`; no job named `e2e`) |

## CDI-05: the Cases Judged

| Case | Judged | Outcome |
| --- | --- | --- |
| CC-FWD-05 | The SDK (TRC-04: the no-op tracer returned the parent's span id) | Fixed in `tracing.ts`, with a unit test |
| CC-CRD-01 | The SDK (CDI-04: an unknown `environment` member dropped) | Fixed in `keeper.ts`, with a unit test |
| CC-PRB-03 | The driver (an absent `title` or `detail` reported as `null`) | Fixed in the driver |
| 14 timing cases | The runner (the case's `values` never sent) | `0a91e6a` |
| CC-STR-04, 05, 06, 10, 11; CC-PRB-08 | The cases (silence longer than their own `T_idle`; CC-PRB-08 also lacked STR-04's subscribe) | `78def37`, `c391d72`, `2c70ed4`, `fb6233f`, `ec74d30`; the authors' rule `3549c29` |
| The names check | The specification (`state`, `toJSON`) | `cda4473` |

No specification ambiguity remained open. Every case passes through the TypeScript driver.

## Budgets

| Measure | Figure | Budget |
| --- | --- | --- |
| Step 8, static estimate | 33.5 s of scripted waits; about 1.5 minutes for a passing run | 5 minutes per driver per runtime |
| Step 30, first run (the committed runner) | Node 26.13.0: 74 passed, 20 failed, 220 s; after Step 30a, Node 24.22.3 and 26.13.0: 77 passed, 17 failed, 219 s | Within |
| Step 32, final run (local, CC-SEC-05 skipped) | Node 24.22.3 and 26.13.0: 94 passed, 0 failed, 113 s; at API 1.9.0: 94 passed, 111 s | Within |
| CI, `conformance-typescript` | 95 of 95 on each entry, 101–102 s of suite time; jobs 124–136 s | Within |
| CI, `e2e-typescript` (push run 44565965835) | 154 s; the scenario 59.6 s | 8 minutes (AD-13) |
| Self-test | 145–148 s | 8 minutes |

## Commit Groups and CI

| Group | Commits | CI run (push to `dev`) |
| --- | --- | --- |
| G1: the F42 changes to U1 | `89aa962` | 44477890224 green |
| G2: the package's skeleton | `eb57cf0` | 44479337399 green |
| G3: secrets, transport, retry, keeper | `fdd2613` | 44480624379 green |
| G4: drafts, publish, forwarding, tracing | `960fe5a`, then `7121dd4` (Step 25b: iterative serialization, after the Linux stack overflow) | 44481857808 red, then 44482725422 green |
| G5: the reader and the subscription | `80e931b` | 44485162024 green |
| G6: the driver; the first suite runs; the F42 changes; the names check | `a8c64d4`, `0a91e6a`, `78def37`, `c391d72`, `cda4473`, `230c4dc` | 44489245357 green; 44552096368 green |
| G7: `conformance-typescript`; the 1.9.0 floor | `d661bf5`, `2c70ed4`, `fb6233f`, `ec74d30`, `3549c29` | 44555060916 red (CC-STR-06 on Node 26), then 44562488457 green |
| G8: the example, the scenario, `e2e-typescript`, `package-typescript`, the README | `8e6bf68`, `30ffa4b`, `848a030` | 44565965835 green |

## Technology Decisions Made Here

- **The 1.9.0 floor from the lock** (Step 33a, accepted by the user): `opentelemetry-api-floor` in `tools/`, swapped in by `use-floor.ts` with a single-copy check; nothing fetched (NFR-U1-24).
- **`package-typescript` installs offline** (Step 39): the tarball by `npm install --offline --ignore-scripts --legacy-peer-deps`, the peer API copied from the workspace's locked copy; the agent files type-checked by the workspace's `tsc`.
- **The scenario uses the built package** through its own Vitest configuration; `pnpm test` excludes it.

## The Local Run (Step 41)

No `soorma-local` project or volume beforehand. `core-up` (Node 26.13.0) up in 36 s; `setup --agents
agent-a,agent-b` with both refusal checks `401`; `prove-stack` `agent-a: 200 pass`, `agent-b: 200
pass`; the scenario 1 passed in 60 s; the example as written, agent B then agent A: B received A's
Delivery in A's trace and exited cleanly on Ctrl-C; `core-down --logs` exit 0, the log search
clean, the stack, its volumes and `.e2e/` removed.

## Code PR

soorma-ai/soorma-sdk#19 (`dev` → `main`), opened 2026-11-19T18:03:27Z. Every check was green at
head `efe1597` on 2026-11-19T18:06:35Z:
- CI run 44583734202 (pull request): unit, repository checks, conformance self-test, `changes`, `conformance-typescript` on all three entries, `e2e-typescript`, `package-typescript` and dependency review;
- DCO run 44583734359.

**OBL-04, discharged for U3 on the PR's own run** (44583734202): CC-SEC-05 passed, not skipped, on
every `conformance-typescript` entry; each ran 95 passed, 0 failed, 0 not run (Node 24.22.3 with
API 1.9.0, 106 s; Node 24.22.3 with 1.10.0, 99 s; Node 26.13.0 with 1.10.0, 98 s).

**AD-13**: `e2e-typescript` took **172 s** (the scenario 59.8 s), under 8 minutes, so NFR
Requirements is not reopened.

The matrices' *Verified* includes this run.
