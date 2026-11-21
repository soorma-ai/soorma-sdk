# Dependencies

The register of every exception to soorma-sdk's dependency policy (U1 NFR-U1-24 to -26):
exact versions, a 7-day release cooldown, no install scripts, and `pnpm audit` failing CI on any
advisory at moderate or above. Each row says why it exists, what proves it is safe, and when it
is removed. Settings live in `pnpm-workspace.yaml`.

## Overrides

| Override                          | Reason                                                                                                                                                                                                                                                                                                                                                 | Proved by                                                 | Remove when                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------- |
| `minimatch@>=7 <11.0.1`: `11.0.3` | GHSA-g3hv-75wg-m249 (moderate: denial of service through glob-part amplification), fixed only in 11.0.1 and later. `eslint` 10.14.0 and `@typescript-eslint/typescript-estree` 8.72.1 still declare `minimatch` 10, so without the override `pnpm audit` fails CI. Development only. 11.0.3 is past the 7-day cooldown. Mirrors soorma-core's override | `pnpm lint` passes on 11.0.3; `pnpm audit` is clean of it | `eslint` and `typescript-eslint` declare `minimatch` 11 |

## Audit exceptions

Ignored **by advisory id only** (`auditConfig.ignoreGhsas`), never by package or severity; every
other advisory at moderate or above still fails CI. Each is also in
`tools/audit-exceptions/register.json`, and **expires by itself**: `pnpm check:audit-exceptions`
(in CI) fails once a fix is installable (published and older than the release cooldown) or the
affected package is no longer installed, and the exception is then removed in a recorded change.

| Advisory                                                                                  | Package     | Severity | Affected range | Fix                                              | Arrives through                                          | Scope                                                                                                            | Remove when                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | ----------- | -------- | -------------- | ------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GHSA-fc5q-39xc-vjpf (ReDoS through single-branch repeated extglobs; published 2026-10-19) | `picomatch` | high     | `<= 4.0.7`     | **none published** (4.0.7 is the newest release) | `vitest`, `typescript-eslint` (development dependencies) | Development only: the test runner and the linter match globs that live in this repository, never untrusted input | A `picomatch` release outside `<= 4.0.7` is published **and older than the release cooldown** (`minimumReleaseAge` in `pnpm-workspace.yaml`, judged by the registry's publish time), so pnpm can install it (upgrade, then remove); or no installed `picomatch` matches the range. While a fix is inside the cooldown the check passes and prints a notice naming the version and when it becomes installable. A fix with no publish time fails the check (fail closed) |

## Update rules

- **`@types/node` stays on `engines.node`'s major** (Node 24). Types for a newer major would let code use APIs Node 24 does not have, so `.github/dependabot.yml` ignores `@types/node`'s semver-major updates; minor and patch updates still arrive. Its major is changed by hand, in the same change that moves `engines.node`.
- **OpenTelemetry's development packages update together.** `.github/dependabot.yml` groups `@opentelemetry/*` (`@opentelemetry/sdk-trace-base`, `@opentelemetry/context-async-hooks` and any other), excluding `@opentelemetry/api`, whose peer range moves by hand: OpenTelemetry releases its SDK packages together and means them to match. The `uv` ecosystem, added with `python/` in U4, groups the Python `opentelemetry-*` packages the same way.
- **The Python package's `opentelemetry-api` range is `>=1.45.2,<2`** (`python/pyproject.toml`). 1.45.2 is the first release fixing GHSA-xcq7-p3pf-p88h (CVE-2026-114603) and GHSA-mf5v-w3w3-f6cg (CVE-2026-126360), so no resolution of the range has a known advisory, and none is accepted (the user, U4 G3). `uv.lock` holds two conflicting groups, `otel-latest` and `otel-floor`, and CI runs the conformance suite on each. **Until a newer release enters the lock, both groups are the same version, so the floor run tests what the latest run tests.** The floor moves only by hand, with the range; Dependabot updates `otel-latest` (its `opentelemetry` group) but never the range. `python/scripts/audit.sh` runs `pip-audit` over each resolution, and any advisory fails it. Defence in depth, whatever version a tenant installs: the SDK parses `traceparent` and `tracestate` itself and never calls `TraceState.from_header` or a propagator's `extract`.
- **Python's toolchain**: `uv` 0.13.8 (CI: `astral-sh/setup-uv` pinned by SHA, v10.3.3), `uv_build` 0.13.8, CPython 3.11.18 and 3.15.2; `exclude-newer` in `pyproject.toml` holds the 7-day cooldown, and dependencies install from wheels only (`no-build`).
- **`opentelemetry-api-floor` stays at `@soorma/sdk`'s peer range floor** (`npm:@opentelemetry/api@1.9.0`, a development dependency of `tools/`). CI's `conformance-typescript` 1.9.0 entry swaps it in for the installed API after the frozen install (`tools/otel-api-floor/use-floor.ts`), so the floor is locked with its integrity like every other dependency. `.github/dependabot.yml` ignores it; it moves by hand, in the same change that moves the peer range.

## The end-to-end stack

**soorma-core's dependencies, in the end-to-end stack.** `e2e/core-up` installs soorma-core at
`contract-v0.1.0+core.2` with its own frozen lock file. This repository does not audit those packages,
for these reasons:

- **No install scripts run.** soorma-core's `pnpm-workspace.yaml` at the tag sets
  `strictDepBuilds: true` and `allowBuilds: {}`. `core-up` checks both and refuses a clone
  without them.
- **Short-lived and unprivileged.** The clone runs only as a stack inside a job with
  `contents: read` and no repository secrets, and `e2e/core-down` takes it down.
- **Kept apart.** Its packages never enter this repository's packages, lock file or audit.
- **Frozen at the tag.** soorma-core's own CI audits soorma-core's latest code, not the lock
  file at the tag, so it is no check for the tag. An advisory against the tag is soorma-core's to
  fix and reaches this repository only through a new contract tag. It is not chased here.

**Known instance**: the tag's lock file holds `picomatch@4.0.7`, affected by
GHSA-fc5q-39xc-vjpf (soorma-core#35). It also fails soorma-core's own audit today.

## Install scripts

None allowed (`strictDepBuilds: true`, `allowBuilds: {}`).
