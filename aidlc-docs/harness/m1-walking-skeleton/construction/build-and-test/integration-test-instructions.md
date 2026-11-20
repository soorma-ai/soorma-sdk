# Integration Test Instructions

## Purpose

Test how the four units work together, and with soorma-core at `contract-v0.1.0`:

```text
U1 contract-and-conformance  --(cases, stub, runner)-->  U3 TypeScript driver, U4 Python driver
U1 names check               --(names, surface)------->  U3 and U4 drivers
U2 e2e-stack                 --(core-up, setup)------->  soorma-core's local stack
U3 @soorma/sdk, U4 soorma    --(real S3 and S4)------->  U2's stack (the scenarios)
U3, U4 packages              --(built, installed fresh)-> a new project (the packaging checks)
```

Text alternative: U1's runner and stub judge each language's SDK through its driver, and U1's
names check reads both drivers. U2 brings up soorma-core's real stack; both SDKs then run their
end-to-end scenarios against it. Each package is also built and installed into a fresh project.

## Test Scenarios

### Scenario 1: U1 → U3, every case through the TypeScript driver
- **Description**: the 97 cases on Node 24.22.3 and 26.13.0, with `@opentelemetry/api` 1.10.0, and on Node 24 with the 1.9.0 floor (CI). Details and judging: `contract-test-instructions.md`.
- **Setup**: `pnpm --filter @soorma/sdk build`.
- **Steps**: `pnpm conformance run --driver "node --expose-gc typescript/conformance-driver/driver.ts" --local-skip CC-SEC-05` (locally; CI passes `--foreign-user` and skips nothing).
- **Expected**: 96 passed, 1 not run (CC-SEC-05) locally; 97 passed in CI.
- **Cleanup**: none; the runner removes its run directory.

### Scenario 2: U1 → U4, every case through the Python driver
- **Description**: the 97 cases on Python 3.11.18 and 3.15.2 with `opentelemetry-api` 1.45.2, and 3.11 with the floor group (CI).
- **Setup**: `cd python && uv sync --locked` (and the 3.15 environment, `build-instructions.md`).
- **Steps**: `pnpm conformance run --driver "python/.venv/bin/python python/conformance_driver/driver.py" --local-skip CC-SEC-05`.
- **Expected**: as Scenario 1.

### Scenario 3: U1's names check over U3's and U4's drivers
- **Steps**: `pnpm --filter @soorma/sdk build && pnpm checks`.
- **Expected**: `ok    names: 2 language(s)`: each language's exported names and settable members equal its column of `spec/names.md`.

### Scenario 4: U2 → soorma-core, the stack proof
- **Steps**: `pnpm e2e:core-up --core-node <Node 26.13.0>`, `pnpm e2e:setup --agents agent-a,agent-b`, `pnpm e2e:prove-stack`.
- **Expected**: `prove-stack: agent-a: 200 pass`, `agent-b: 200 pass` (one raw bootstrap per agent).

### Scenario 5: U3 and U4 → U2's stack, the end-to-end scenarios
- **Description**: two agents each, one real renewal under a skewed clock, A to B, one trace across the hop. Details: `e2e-test-instructions.md`.
- **Steps**: after Scenario 4, `pnpm e2e:scenario-typescript` and `python/.venv/bin/python python/e2e/scenario.py` (on Python 3.11 or 3.12).
- **Cleanup**: `pnpm e2e:core-down` (searches every service's log for credentials and secrets, then removes the stack, its volumes and `.e2e/`).

### Scenario 6: each package as a tenant receives it
- **Steps**: `pnpm package:typescript`; `node tools/package-python/check.ts --python 3.11.18 --python 3.15.2`.
- **Expected**: `package-typescript: pass`, `package-python: pass` (built, guarded, installed fresh and offline, imported; the example's agent files type-checked and imported; the values hook absent).

## Setup the Integration Environment

### 1. Start required services

Only Scenarios 4 and 5 need services: soorma-core's stack, through U2's `core-up` (Docker;
ports 8441 to 8447 on loopback; Compose project `soorma-local`). `core-up` refuses to run if a
`soorma-local` project or its volumes already exist.

### 2. Configure service endpoints

Nothing to configure: `setup` writes `.e2e/stack.json` (S3, S4, the CA file, the environment,
each agent's secret file), which both scenarios read. The conformance stub binds its own
loopback ports per case.

## Run Integration Tests

The six scenarios above, in order. CI runs each as its own job (`conformance-typescript` ×3,
`conformance-python` ×3, `checks`, `e2e-typescript`, `e2e-python`, `package-typescript`,
`package-python`).

### Verify service interactions

- **Logs**: the conformance runner prints each failing case with its assertion; `core-down`
  prints `log searched, clean` per service; `core-down --logs` prints the stack's logs.
- **Build and Test's runs**: `build-and-test-summary.md`, *Runs*.

### Cleanup

```sh
pnpm e2e:core-down
```
