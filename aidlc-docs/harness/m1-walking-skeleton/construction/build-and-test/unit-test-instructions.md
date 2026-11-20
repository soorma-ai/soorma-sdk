# Unit Test Execution

Two suites: the workspace's Vitest suite (U1's runner, stub, reference driver and checks; U2's
end-to-end tooling; U3's `@soorma/sdk`; the repository tools) and the Python package's pytest
suite (U4). Both run with warnings as errors where the language allows it: Vitest fails on an
unhandled rejection; pytest's `filterwarnings = ["error"]`, plus a loop exception handler that
fails any test leaving a task exception unretrieved (P-11).

## Run Unit Tests

### 1. Execute all unit tests

```sh
pnpm test                                       # Vitest: every workspace package
cd python
uv run --locked pytest -q                       # Python 3.11 (the default environment)
UV_PROJECT_ENVIRONMENT=.venv-315 uv run --locked --python 3.15.2 pytest -q   # Python 3.15
```

`pnpm test` leaves out `typescript/e2e/` (the scenario needs the stack). pytest's `testpaths` is
`tests/`; the end-to-end scenario (`python/e2e/`) is a script, not a test module.

### 2. Review the results

- **Expected**: Vitest **302 passed** in 30 files; pytest **395 passed** on 3.11.18 and on
  3.15.2; nothing skipped.
- **Static checks that gate the same commits**: `pnpm typecheck`, `pnpm lint`,
  `pnpm format:check`; in `python/`, `uv run --locked ruff check`, `ruff format --check`, and
  `mypy` (`--strict`, 49 files).
- **Coverage**: not measured as a percentage. Each package's behaviour is held to U1's
  specification by the conformance suite (`contract-test-instructions.md`), every statement
  linked to at least one case; the unit tests cover what the cases cannot reach (parser
  fuzzing and bounds, the clock seam, collection, refcounts, packaging guards).
- **Report location**: the terminal; Build and Test recorded each run's log under
  `construction/working/build-and-test-runs/` (git-ignored, one file per run).

### 3. Fix failing tests

1. Read the failing test's output in the run's log.
2. Decide whether the code or the test is wrong. A test of an earlier unit changed for a later
   one is an F42 change: classify it (1: items added; 2: strictly stronger; 3: anything else,
   which stops for the user) and record it in the unit's code summary.
3. Fix it and run the suite again. Record the failed run and its cause (*Recording Runs*); a
   passing rerun never replaces it.

## Python-Specific Notes

- **Timing-sensitive tests** (the keeper's renewal floor, the subscription's `T_idle`) use
  small named values and windows at least twice the value concerned; they ran five times in a
  row without a failure at U4's G7.
- **The collection tests** (TC-PH-076) call `gc.collect()` and assert one `ResourceWarning`;
  they run under `warnings.catch_warnings(record=True)`.
- **The child-process test** (TC-PH-071) starts a Python subprocess with a TLS server of its own;
  it needs no network beyond loopback.
