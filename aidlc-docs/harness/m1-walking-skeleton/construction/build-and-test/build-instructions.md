# Build Instructions

soorma-sdk at M1: the language-neutral layer (U1, `contract-and-conformance`), the end-to-end
stack (U2, `e2e-stack`), the TypeScript package `@soorma/sdk` (U3) and the Python package
`soorma` (U4). Nothing is published to a registry; both packages build and install from this
repository. All commands run from the repository root unless a step says otherwise.

## Prerequisites

- **OS**: Linux or macOS (Windows is not supported in M1). The conformance suite needs the
  `openssl` CLI; `package-python` needs `unzip` and `tar`.
- **Node.js 24.22.3** (`.node-version`), and **Node.js 26.13.0** for soorma-core's own steps in
  the end-to-end stack (passed as `--core-node`) and for the Node 26 conformance entry.
- **pnpm 12.18.0** (`packageManager`), installed without Corepack.
- **uv 0.13.8**, which installs and selects **Python 3.11.18** and **3.15.2**
  (`uv python install 3.11.18 3.15.2`).
- **Docker Engine 26+ and Docker Compose 2.26.0+**, `git`: the end-to-end stack only.
- **Environment variables**: none. The SDKs read none (CFG-07); no step needs a secret or a
  token. The drift check reads soorma-core over git, unauthenticated.

## Build Steps

### 1. Install dependencies

```sh
pnpm install --frozen-lockfile                 # the workspace: tools, conformance, e2e, typescript
uv python install 3.11.18 3.15.2
(cd python && uv sync --locked)                # dev + otel-latest, wheels only, from uv.lock
```

`uv sync --locked` fails if `uv.lock` does not match `pyproject.toml`; dependencies install
from wheels only (`no-build`) and from releases at least 7 days old (`exclude-newer`).

### 2. Configure the environment

Nothing to configure. A Python 3.15 environment beside the default one, for the 3.15 runs:

```sh
(cd python && UV_PROJECT_ENVIRONMENT=.venv-315 uv sync --locked --python 3.15.2)
```

### 3. Build all units

```sh
pnpm --filter @soorma/sdk build                # U3: tsc to typescript/dist/
uv build --project python --out-dir python/dist  # U4: the wheel and the sdist (uv_build 0.13.8)
```

U1 and U2 are TypeScript run directly by Node (type stripping); they have no build step.
`pnpm typecheck` type-checks the whole workspace; `uv run --locked mypy` (in `python/`)
type-checks the Python package, tests, driver, example and scenario.

### 4. Verify the build

- **Expected output**: `tsc` exits 0 with no output; `uv build` prints
  `Successfully built python/dist/soorma-0.1.0.tar.gz` and `…/soorma-0.1.0-py3-none-any.whl`.
- **Artifacts**: `typescript/dist/` (ESM JavaScript and declarations; `dist/internal/` holds the
  test-only values hook and is left out of the packed tarball); `python/dist/soorma-0.1.0-py3-none-any.whl`
  and `python/dist/soorma-0.1.0.tar.gz` (neither holds `soorma/_internal/`).
- **The packaged form, checked**: `pnpm package:typescript` and
  `node tools/package-python/check.ts --python 3.11.18 --python 3.15.2` build, guard, install
  into a fresh project offline, import, and type-check the example's agent files.
- **Acceptable warnings**: none expected.

## Troubleshooting

### `pnpm checks` fails with "names: TypeScript: could not read the driver's names (driver timed out)"
- **Cause**: the TypeScript conformance driver loads the built package; `typescript/dist/` does
  not exist yet (Build and Test run 4, a fresh clone).
- **Solution**: `pnpm --filter @soorma/sdk build`, then `pnpm checks` again.

### `uv sync --locked` fails
- **Cause**: `uv.lock` is out of date with `pyproject.toml`, or a wheel is missing for the
  platform.
- **Solution**: never `uv lock` casually: the lock is refreshed deliberately, with the cooldown
  date in `exclude-newer` moved and `scripts/audit.sh` run (see `DEPENDENCIES.md`).

### `pnpm install --frozen-lockfile` fails
- **Cause**: `pnpm-lock.yaml` does not match a `package.json`, or the pnpm version differs.
- **Solution**: use pnpm 12.18.0; never update the lock as part of a build.

### Python 3.13+ refuses soorma-core's local stack ("Missing Authority Key Identifier")
- **Cause**: the stack's leaf certificates lack key identifiers (soorma-ai/soorma-core#36,
  OBL-05); Python 3.13+ verifies strictly, and the SDK keeps that on.
- **Solution**: run the end-to-end scenario and the example on Python 3.11 or 3.12 until a
  contract tag carries the fix.
