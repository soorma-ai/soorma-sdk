# Logical Components — U4 `python-harness`

The components NFR Design places, with what each holds and which patterns
(`nfr-design-patterns.md`) it implements. Nothing is deployed: the components are modules,
test code and CI jobs.

## 1. The Package `soorma` (`python/src/soorma/`)

| Module | Component | Holds | Patterns |
|---|---|---|---|
| `__init__.py` | — | `__all__`: exactly the name table's Python column, `SoormaWarning` and `PayloadNotParsed` included | PH-API-01 |
| `_client.py` | C-11 | `AgentClient` (the handle) and `ClientCore` (states, the loop, orchestration, the finalizer's cleanup) | P-10, P-11 |
| `_options.py` | C-12 | `AgentClientOptions` (frozen, keyword-only), `new_instance_id` | — |
| `_secrets.py` | C-13 | `file_secret`, off the loop | P-12 |
| `_keeper.py` | C-14 | `KeeperCore`: the credential, bootstrap per attempt, the schedule, `is_usable()`, the guarded warning | P-02, P-03, P-12 |
| `_transport.py` | C-15 | Requests to S3 and S4, the TLS context and its hint, Problem parsing, `B_body` | P-06, P-08 |
| `_http.py` | C-15 | `ResponseParser`, sans-IO, strict and bounded | P-07, P-08 |
| `_connection.py` | C-15 | The `asyncio.Protocol` per connection over the parser | P-07, P-10 |
| `_retry.py` | C-15 | The retry policy | P-01 |
| `_clock.py` | P-05 | `wall_now()`, `mono_now()` | P-05 |
| `_limits.py` | — | The named values (`D_lang` 256, `L_event`, `B_body` included); `capture()` of the hook's slot | P-13 |
| `_draft.py` | C-16 | Drafts; the forwarded envelope spliced | — |
| `_json.py` | C-16 | The payload walk and serializer | P-09 |
| `_subscription.py` | C-17 | `Subscription` (the handle) and `SubscriptionCore` (the state machine, queue, timers) | P-04, P-08, P-10 |
| `_reader.py` | C-18 | The scanner, `Delivery`, `DeliveryError`, the frozen envelope | P-09 |
| `_tracing.py` | C-19 | Send and receive spans through `opentelemetry-api` | — |
| `_errors.py` | C-20 | The five errors, `PayloadNotParsed`, `SoormaWarning` | P-12 |
| `_generated/` | C-10 | `TypedDict` modules from `python/scripts/generate.ts` | — |
| `_internal/test_values.py` | the hook | The values slot; **in the source tree only** | P-13 |
| `py.typed` | — | Marks the package typed | — |

## 2. Outside the Distribution

| Component | Path | Holds |
|---|---|---|
| The conformance driver (C-21) | `python/conformance_driver/` | The protocol over JSON lines on one loop; U1's `sys.getrefcount` check; names and surface by introspection; warnings recorded |
| The example (C-22) | `python/examples/two_agents/` | `agent_a.py`, `agent_b.py`, `README.md` |
| The end-to-end test (C-22) | `python/e2e/` | The scenario: `time.time` patched, the decoy span, two clients |
| The package's tests | `python/tests/` | Unit tests; the parser's table-driven and fuzz tests; the clock check; the collection test |
| The generator | `python/scripts/generate.ts` | C-10 from the vendored schemas |
| Project files | `python/pyproject.toml`, `python/uv.lock`, `python/README.md`, `python/LICENSE`, `python/NOTICE` | The `otel-latest` and `otel-floor` groups, conflicting (P-14) |

## 3. Changes to Earlier Units (F42; NFR-U4-37, -38; PH-F42-02)

| Component | Change | Class (set at Code Generation) |
|---|---|---|
| `spec/behaviour.md` | §0 gains `L_event`, `B_body`; a statement beside RCV-07 | To be classed |
| `spec/names.md` | Python-only rows `SoormaWarning`, `PayloadNotParsed` (approved) | Name table |
| `conformance/cases/` | Two cases: an oversized event then a Delivery; a Problem body over `B_body` | Added cases |
| `conformance/stub/` | A generated-body directive (bytes produced at send time) | Added capability |
| `conformance/reference-driver/` | Declares the new cases if it already passes them | — |
| `typescript/src/subscription.ts`, `transport.ts`, `limits.ts` | The `L_event` and `B_body` defect fix, with unit tests; its own commit in U4's code PR | Defect fix to U3 |
| `tools/names/drivers.json`, `tools/generated-types/packages.json`, `tools/packaging/packages.json` | The Python package and driver listed | Configuration |
| `tools/audit-exceptions/` | Reads `pip-audit`'s advisories beside `pnpm`'s | Strictly stronger |
| `.github/dependabot.yml` | The `uv` ecosystem for `python/` | Configuration |

## 4. CI Components

| Job | Implements |
|---|---|
| `conformance-python` | 3.11 and 3.15 with `otel-latest`, 3.11 with `otel-floor` (P-14); the CI user helper (P-15); every case |
| `e2e-python` | 3.11; `core-up`, `setup`, `prove-stack`, the wheel installed, the scenario, `core-down` |
| `package-python` | Wheel and sdist; the guard; the offline install; import, `AgentClient`; the hook's absence (P-13); the agent file type-checked and imported |
| `unit` (extended) | `pytest` (warnings as errors), the parser's tests, the clock check, the collection test, `ruff`, `mypy --strict`, `pip-audit`, on 3.11 |
| `checks` (extended) | Python 3.11 and the locked environment for the names check; the generated-types check and the packaging guard with `python/` |

## 5. NFR to Component

| NFR | Components |
|---|---|
| NFR-U4-04, -05 | `_transport.py`, `_json.py`, `_reader.py`, `_http.py` |
| NFR-U4-06 | `_limits.py`; the driver's `describe` |
| NFR-U4-07 to -11 | `_http.py`, `_connection.py`; their tests |
| NFR-U4-12, -13 | `_retry.py`, `_keeper.py` |
| NFR-U4-14, -15 | the cores, `_connection.py`; the collection test |
| NFR-U4-16 | `_keeper.py` |
| NFR-U4-17 | `_transport.py` |
| NFR-U4-18, -19 | `_keeper.py`, `_errors.py`, every public object |
| NFR-U4-20 | `_keeper.py` |
| NFR-U4-21 | `conformance-python` |
| NFR-U4-22 | `_internal/`, `pyproject.toml`, `package-python` |
| NFR-U4-23 to -26 | `pyproject.toml`, `uv.lock`, `unit` (`pip-audit`), `dependabot.yml` |
| NFR-U4-27 to -30 | `pyproject.toml`, `_generated/`, the packaging guard, `package-python` |
| NFR-U4-31 to -34, -36 | the CI jobs |
| NFR-U4-35 | `python/README.md` |
| NFR-U4-37 | U1's specification, cases, stub, reference driver |
| NFR-U4-38 | `typescript/src/subscription.ts`, `transport.ts`, `limits.ts` |
