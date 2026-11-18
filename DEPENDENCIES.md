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

## Install scripts

None allowed (`strictDepBuilds: true`, `allowBuilds: {}`).
