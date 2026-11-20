# Code Summary — U4 `python-harness`

`soorma`, the Python harness (C-10 to C-22), built against soorma-core's contract tag
`contract-v0.1.0` (`c1e3d7f`). Code Generation ran in ten commit groups on `dev`, each gated and
pushed, with its CI run waited on; this summary is G11's (plan Step 41).

## Created

| Area | Files |
| --- | --- |
| The project | `python/pyproject.toml` (`soorma` 0.1.0, Apache-2.0, `requires-python >=3.11`, the one runtime dependency `opentelemetry-api>=1.45.2,<2`; `uv_build` 0.13.8; `_internal` excluded from the wheel and the sdist; the `dev`, `otel-latest` and `otel-floor` groups; `exclude-newer`, `no-build`; ruff, mypy `--strict` and pytest settings), `python/uv.lock`, `python/scripts/generate.ts` (C-10: `TypedDict`s from the vendored schemas), `python/scripts/audit.sh` (pip-audit per resolution) |
| Package source (`python/src/soorma/`) | `__init__.py` (exactly the name table's Python column), `_client.py` (the handle over `ClientCore`), `_options.py`, `_keeper.py` (bootstrap per attempt, renewal, REN-07 with the guarded warning), `_secrets.py` (`file_secret`), `_transport.py` (the TLS context, the Install Certificates hint, Problems), `_connection.py` (an `asyncio.Protocol`), `_http.py` (the strict, bounded, sans-IO response parser), `_retry.py`, `_clock.py` (P-05), `_limits.py` (the named values, `D_LANG` 256), `_json.py` (the iterative payload walk), `_draft.py`, `_tracing.py` (traceparent and tracestate parsed by the SDK), `_reader.py` (the iterative delivery scanner), `_subscription.py` (the P-04 supervisor under a handle), `_errors.py`, `_types.py`, `_internal/test_values.py` (the values hook, never shipped), `_generated/` (agent-side contract types), `py.typed` |
| Package tests (`python/tests/`) | `conftest.py` (session certificates with full RFC 5280 extensions; a scripted TLS server; a loop exception handler failing any unretrieved exception), `test_skeleton.py`, `test_http.py`, `test_connection.py`, `test_clock_binding.py`, `test_secrets.py`, `test_transport.py`, `test_retry.py`, `test_keeper.py`, `test_json.py`, `test_draft.py`, `test_tracing.py`, `test_client.py`, `test_no_environment.py`, `test_reader.py`, `test_subscription.py` (395 tests) |
| The conformance driver | `python/conformance_driver/driver.py`, `names.py` (names and surface by introspection), `spans.py` (the test OpenTelemetry SDK) |
| The example | `python/examples/two_agents/agent_a.py`, `agent_b.py`, `README.md` |
| The end-to-end scenario | `python/e2e/scenario.py` |
| Tools | `tools/package-python/check.ts` and its test (the built distributions guarded, installed fresh and offline, the example checked) |
| Documents | `python/README.md`, `python/LICENSE`, `python/NOTICE` |

## Changed

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | `unit` and `checks` gain uv 0.13.8 and Python 3.11.18 (ruff, mypy, pytest, pip-audit; the Python driver for the names check); `conformance-python` (a matrix of three); `e2e-python`; `package-python` |
| `.github/dependabot.yml`, `DEPENDENCIES.md` | A `uv` entry for `python/` with an `opentelemetry-*` group; npm's OpenTelemetry development packages grouped; the Python range and its floor, which moves only by hand |
| `tools/names/drivers.json`, `tools/generated-types/*`, `tools/packaging/*` | The Python package and driver listed; `withoutCaches` in the generated-types check; `checkPythonPackage` |
| `.gitignore`, `eslint.config.js` | Python caches; `.venv` ignored |
| `README.md` | Both packages, the Python commands, the Python scenario |
| `typescript/src/` | The U3 fix for RCV-09 (G2, below) |
| U1's specification, cases, runner, stub and reference driver | The F42 changes below |

## Commands

| Command | What it does |
| --- | --- |
| `cd python && uv sync --locked` | The locked environment (`dev`, `otel-latest`) |
| `uv run --locked ruff check`, `ruff format --check`, `mypy`, `pytest -q` | Lint, format, types (`--strict`), the 395 tests |
| `scripts/audit.sh` | pip-audit over every resolution in `uv.lock` |
| `pnpm conformance run --driver "python/.venv/bin/python python/conformance_driver/driver.py"` | The 97 cases through the Python driver (`--foreign-user` in CI; `--local-skip CC-SEC-05` locally only) |
| `python/.venv/bin/python python/e2e/scenario.py` | The end-to-end scenario, after `core-up`, `setup` and `prove-stack` (Python 3.11 or 3.12) |
| `node tools/package-python/check.ts --python 3.11.18 --python 3.15.2` | Build, guard, install fresh and offline, import; the agent files type-checked and imported |

## Changes to Earlier Units' Tests (F42)

Every change to U1's or U3's tests, specification or cases, with its class, its diff, and the
message that covered it (timestamps are `audit.md` entries). The self-test passed after each,
with every fault set as declared and `faults.json` unchanged.

### G1 (`12d5fdb`), covered by the plan approval (2026-11-20T00:37:17Z)

| Change | Class | Diff |
| --- | --- | --- |
| `spec/behaviour.md` §0: `L_event`, `B_body` | 1 | Two named values, 1 MiB each (decided at NFR Requirements' approval) |
| `spec/behaviour.md` §10: RCV-09 | 1 | A new statement: an SSE event over `L_event` discarded to its blank line, a delivery error (`event-too-large`); a body over `B_body` is `TransportError` (`response-too-large`) |
| `spec/names.md`: `PayloadNotParsed`, `SoormaWarning` (Python-only rows, approved at Functional Design) | name table | `+ \| payload not parsed (Python only…) \| — \| \`PayloadNotParsed\` \|`; `+ \| warning category (Python only…) \| — \| \`SoormaWarning\` \|` |
| The stub's `generate` directive (`stub/src/delivery.ts`, `stub.ts`; four tests in `stub.test.ts`) | 1 | An added capability: a body or stream event generated at send time; existing scripts unchanged |
| `case.schema.json`, `runner/src/types.ts` (`NAMED_VALUES`), the reference driver's `DEFAULTS` | 1 | `L_event`, `B_body` added |
| CC-RCV-09, CC-RCV-10 | 1 | Added cases; the reference driver does not declare them (it has no bound) |
| `spec.test.ts`: the statement count | 3 | `- expect(statements).toHaveLength(104);` / `+ expect(statements).toHaveLength(105);` |
| `cases.test.ts`: the case count, and the new ids | 3 | `- expect(loaded.cases).toHaveLength(95);` / `+ expect(loaded.cases).toHaveLength(97);`, with `+ for (const id of U4_CASES) expect(ids.has(id), id).toBe(true);` and every U1 and U3 id still checked |

### Strict TLS (`91049a7`), covered by the user's message of 2026-11-20T02:30:41Z

| Change | Class | Diff |
| --- | --- | --- |
| `conformance/runner/src/rundir.ts` `makeServer`: both server certificates carry key identifiers | 3 (a helper earlier assertions depend on), shown to behave as before | `+ 'subjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n'`. `openssl verify -x509_strict` OK on both; a Python 3.15.2 strict handshake OK; the self-test passed with every fault set as declared; TypeScript 96 passed on Node 24.22.3 and 26.13.0 (CC-SEC-05 not run locally) |

### G2: the U3 fix (`ea653bc`), its own commit, covered by the plan approval

`typescript/src/limits.ts` (`L_event`, `B_body`), `subscription.ts` (events split at blank lines;
past `L_event` discarded to the blank line, one `event-too-large` marker), `transport.ts`
(`response-too-large` past `B_body`), `retry.ts` (never retried). U3's tests: `skeleton.test.ts`
gains the two values (class 1); new `g5.test.ts` (5) and `bounds.test.ts` (6) tests. CC-RCV-09 and
CC-RCV-10 passed 97 of 97 on all three `conformance-typescript` entries (run 44662297886).

## CDI-05: the Cases Judged

| Case | Judged | Outcome |
| --- | --- | --- |
| CC-RCV-05 | The driver (`Infinity` written for the payload's `1e400`, which Python parses natively as `inf`) | The driver writes a non-finite float as `null`, as `JSON.stringify` does |
| CC-PRB-07 | The driver (its own main task counted as an open task) | The driver leaves out its own tasks |

No SDK failure, no case change, no specification question. Every case passes through the Python
driver on 3.11 and 3.15.

## Budgets

| Measure | Figure | Budget |
| --- | --- | --- |
| Step 8f, static estimate | The scripted time equals the TypeScript suite's; about 2 minutes | 5 minutes per driver per runtime |
| Step 30, first run (3.11.18, CC-SEC-05 skipped) | 94 passed, 2 failed, 91 s | Within |
| Step 32, final runs (local, CC-SEC-05 skipped) | 3.11.18: 96 passed, 88 s; 3.15.2: 96 passed, 88 s | Within |
| CI, `conformance-python` (push run 44668858650) | 97 of 97 on each entry, 79 s of suite time each | Within |
| `e2e-python` | Measured on the code PR | 8 minutes (AD-13) |
| The local scenario (Step 40) | 59 s | — |

## Commit Groups and CI

| Group | Commits | CI run (push to `dev`) |
| --- | --- | --- |
| G1: the F42 changes to U1 | `12d5fdb` | pushed with G2 |
| G2: the TypeScript fix | `ea653bc`, `746cbde` | 44650779597 green |
| G3: the Python project, its checks, CI's first Python steps | `4034875` | 44653134454 green |
| G4: the HTTP parser and its connection | `b87473f`, `ad3470c` | 44655672879 green; 44656224727 green |
| Strict TLS: the stub's key identifiers; OBL-05 | `91049a7`, `5c1f293` | 44662297886 green; 44662725414 green |
| G5: clock, limits, secrets, transport, retry, keeper | `8e30397` | 44663915379 green |
| G6: payload walk, drafts, tracing, the client | `0bee91e` | 44665689842 green |
| G7: the reader and the subscription | `530bbe9` | 44666800108 green |
| G8: the driver; the suite on 3.11 and 3.15; the names check | `3b24eba` | 44668464349 green |
| G9: `conformance-python` | `28f1be6` | 44668858650 green |
| G10: the example, the scenario, `e2e-python`, `package-python` | `c883b94`, `ab8eea7` | 44669854985 red (`package-python`'s offline install), then `ab8eea7` (Step 38a): 44670360719 green |

## Technology Decisions Made Here

- **The `opentelemetry-api` floor at 1.45.2** (the user's ruling, B): every resolution audits clean with no accepted advisory; defence in depth kept: the SDK parses `traceparent` and `tracestate` itself (at most 32 members and 512 characters) and never calls `TraceState.from_header` or a propagator's `extract`. The floor group stays, and moves only by hand.
- **Python 3.13+ strict TLS kept on** (the user's ruling): the SDK never clears `VERIFY_X509_STRICT`; a test asserts it; the README states the local-stack limitation (soorma-ai/soorma-core#36, OBL-05); `e2e-python` stays on 3.11.
- **A bad CA file names its path** in the `TransportError` message (TC-PH-084), never the file's contents.
- **The payload walk builds a path only on refusal** (a linked node per level), so depth costs linear time.
- **The stream opens when `subscribe()` is called**, as SUB-01 says and CC-STR-13 needs; Functional Design §6's "the first `__anext__` opens it" was the wording, not a decision.
- **T_idle counts bytes, heartbeats included**: the connection reports every read (`on_bytes`).
- **A 200 subscribe answer that is not `text/event-stream`** is `TransportError` (`unusable-response`), never retried.
- **`conformance-python` runs the synced environment's interpreter directly**, so `uv run` never re-syncs the default groups over the floor; a step checks the installed API against the group's pin (TC-PH-090).
- **`package-python` and `e2e-python` install from `uv.lock`, hash-checked**: `package-python` offline, with `uv sync --locked --offline --no-install-project` into the fresh environment (the lock's URLs from the cache; `uv pip install -r` would need index metadata a cache filled by `uv sync` lacks: push run 44669854985 red, Step 38a); the wheel with `--no-deps`.

## The Local Run (Step 40)

No `soorma-local` project or volume beforehand (a volume `soorma-postgres-data` belongs to the
compose project `soorma`, and was left alone). `core-up` (Node 26.13.0) up in 34 s; `setup --agents
agent-a,agent-b` 2 s; `prove-stack` pass; the wheel installed into a fresh 3.11.18 environment as
`e2e-python` does; the scenario passed in 59 s; `core-down` exit 0, every service's log searched
clean, the stack and its volumes removed. Then the example as written on a second fresh stack:
agent B's stream started, agent A published, B printed the envelope and A's trace id, and B
exited 0 on Ctrl-C with no traceback; `core-down` exit 0.

## Code PR

Pending (plan Step 43).
