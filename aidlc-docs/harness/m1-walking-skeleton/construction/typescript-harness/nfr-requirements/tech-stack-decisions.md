# Tech Stack Decisions — U3 `typescript-harness`

Every choice below is **technology** under `prd-gap-classification.md`: no PRD and no part of the
contract makes it, and I11 places it here. Answers: U3-NFR-Q1 to Q8 (audit
2026-11-19T04:55:32Z).

**Inherited from U1 unchanged**:
- TS-U1-01 (Node 24 for the repository's tooling);
- TS-U1-02 (pnpm, one workspace);
- TS-U1-05 (`ajv` 2020-12);
- TS-U1-06 (`yaml`);
- TS-U1-09 (Vitest);
- TS-U1-12 (CI rules);
- ESLint and Prettier.

| Id | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| TS-U3-01 | **The package at `typescript/`** (`@soorma/sdk`), a workspace member. **The driver**, **the example** and **the end-to-end test** are private workspace packages beside it (`typescript/conformance-driver/`, `typescript/examples/two-agents/`, `typescript/e2e/`) | One workspace and lock file; the private packages depend on the package through `workspace:*`, as a tenant would through npm | The driver inside the package (it would ship, or need exclusion rules) |
| TS-U3-02 | **ESM only, built with `tsc`** to `dist/` with `.d.ts`; `"type": "module"`; `engines.node` `>=24`. **`exports`**: `{ ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }`. `"default"` serves both `import` and Node 24's `require()` of ESM, which resolves with the `"require"` condition (the user, U3-NFR-Q4). No top-level `await` in the package, which `require()` of ESM would refuse | U3-NFR-Q4 A | Dual ESM and CommonJS builds (Q4 B); an `"import"`-only exports map (fails `require()`) |
| TS-U3-03 | **The package's sources are compiled** (`tsc`), not run by type stripping. The repository's tooling keeps type stripping; the package must run wherever a tenant's Node runs it, from `dist/` | A published library ships JavaScript | Shipping `.ts` and relying on the consumer's type stripping |
| TS-U3-04 | **`node:https`** for every request, with a fresh `AbortController` per request. The SSE stream is read from the response stream, with a small line parser (`event:`, `data:`, comments). No HTTP client dependency | U3-NFR-Q2 A; exact control of the bytes written (FWD-02) | `fetch` with an `undici` `Agent` (a runtime dependency for a custom CA) |
| TS-U3-05 | **The trust store**: `tls.getCACertificates('system')` ∪ `tls.getCACertificates('bundled')` ∪ the CA file, passed as `ca` on every request; verification is never turned off. Read once per client | U3-NFR-Q3 A; measured: 0 system and 118 bundled certificates on macOS (Node 24.22.3, 26.13.0) | The system store alone (fails on that measurement); Node's bundled store alone (ignores an OS-installed CA) |
| TS-U3-06 | **`@opentelemetry/api`**: a **peer dependency** `^1.9.0`, and a development dependency at exactly `1.10.0`. Conformance also runs once at `1.9.0` | U3-NFR-Q6 A; one API global shared with the tenant's SDK | A regular dependency at an exact version (two copies of the API, spans lost between them) |
| TS-U3-07 | **Semantic conventions 1.45.0** for messaging spans, attribute names as constants in `tracing.ts`; `messaging.system` `soorma` (DEC-U1-11) | U3-NFR-Q6 A; SPN-01; the newest release past the cooldown (2026-11-06) | Depending on `@opentelemetry/semantic-conventions` (its messaging attributes are incubating) |
| TS-U3-08 | **C-10 by a script reusing the vendored generator** (`typescript/scripts/generate.ts` imports `contract/scripts/generate-types.ts`'s transform). It writes the agent side to `typescript/src/generated/`, and the envelope and delivery types with every envelope member optional. Committed, and checked by U1's generated-types check | U3-NFR-Q5 A; one generator, soorma-core's | Copying `contract/generated/*.ts` (it carries S1 and S2 types: NEV-01) |
| TS-U3-09 | **Randomness and identifiers**: `crypto.randomUUID()` for `newInstanceId`; `crypto.randomBytes` for generated trace and span ids (TRC-03) | CFG-06; TRC-03 | `Math.random` |
| TS-U3-10 | **Clocks**: `Date.now()` for comparing with `expiresAt` (wall), and `performance.now()` for the floor, `T_idle` and backoff (monotonic). Both are read through one internal clock module, so tests can drive them (NFR Design shapes it) | REN-07; CDI-06 | `Date.now()` for everything (skew moves the floor) |
| TS-U3-11 | **The named values** in `typescript/src/limits.ts`, as NFR Requirements sets them (`H_renew` 120 s, `R_min` 30 s, `R_max` 5, `W_max` 60 s, `B` 0.5 s ×2 to 10 s, `L_ends` 5, `W_super` 10 s, `N_buf` 64, `D_lang` 512, `T_idle` 45 s, `T_req` 10 s) | U3-NFR-Q1 A | Options a tenant sets (the name table has none, and they are the specification's values) |
| TS-U3-12 | **The clock-skew warning**: `process.emitWarning(message, { type: 'SoormaWarning', code: 'SOORMA_CLOCK_SKEW' })` | TH-REN-03; Node's warning mechanism, which tenants already route | A logger option (none in the name table) |
| TS-U3-13 | **No logger, no environment variable, no host read** in the package; ESLint `no-restricted-properties` and `no-restricted-imports` refuse `process.env`, `os.hostname`, `os.networkInterfaces` and `console` in `typescript/src/` | CFG-05, CFG-07; NFR-06; TH-API-05 | A review-only rule |

## Jobs U3 Adds and Changes (shape, not YAML)

| Job | Runs | Fails when |
|---|---|---|
| `conformance-typescript` | Every PR and push to `dev`. Matrix: Node 24 and 26 with `@opentelemetry/api` 1.10.0, plus one run on Node 24 with 1.9.0. It builds `@soorma/sdk`, creates the second local user (`sudo useradd`) and runs `pnpm conformance run --driver "<typescript driver>" --foreign-user <user>` | Any case fails or is skipped; over the suite budget |
| `e2e-typescript` | U2's `e2e` job renamed (JOB-06), on Node 24: `core-up`, `setup`, `prove-stack`, **the scenario** (`typescript/e2e/`), then `core-down` (`if: always()`, the log search on every run) | Any step fails; a log-search hit |
| `package-typescript` | Every PR and push to `dev`. It packs `@soorma/sdk` (`pnpm pack`) and runs the packaging guard over the tarball's files. Then, in a fresh project outside the workspace, it installs the tarball and `@opentelemetry/api`, and runs an **ESM file that imports** the package and a **CommonJS file that `require()`s** it, each constructing an `AgentClient`. It copies the example's agent file in, type-checks it, and imports it | Any step fails |
| `unit` (extended) | Also the package's unit tests | Any test fails |
| `checks` (extended) | The names check, generated-types check and packaging guard now find a package (`typescript/`) | Any check fails |
