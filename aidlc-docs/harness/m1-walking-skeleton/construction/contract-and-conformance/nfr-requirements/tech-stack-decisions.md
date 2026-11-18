# Tech Stack Decisions — U1 `contract-and-conformance`

Every choice below is **technology** under `prd-gap-classification.md` (no PRD or the contract
makes it; I11 places it here). **Exact versions are fixed at Code Generation** from the
registries, recorded in `pnpm-lock.yaml` and `.node-version`, and never a range.

| Id | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| TS-U1-01 | **Node.js 24 LTS**, exact patch in `.node-version`, for all U1 tooling | The oldest maintained LTS, the SDK's own floor (D-01, NFR-08); one runtime for the tooling keeps CI simple; the 24 and 26 matrix belongs to the SDK (U3) | Node 26 for tooling: newer than the SDK's floor for no gain |
| TS-U1-02 | **pnpm**, exact version in `packageManager`, installed **without Corepack**; **one workspace** at the repository root; `conformance/` and `tools/` private packages; U3's `typescript/` joins later; `python/` outside | Matches soorma-core's toolchain; a frozen lock file across all JavaScript in the repository; private packages cannot be published by accident | npm with `package-lock.json` (Q1 B) |
| TS-U1-03 | **TypeScript**, run directly by Node 24's type stripping where the code allows, compiled with `tsc` otherwise; **no bundler** | Fewer build steps for tooling; type checking stays in CI (`tsc --noEmit`) | A bundler: nothing to bundle for scripts and a long-running stub |
| TS-U1-04 | **Node built-ins** for the stub (`node:tls`, `node:net` for `refuse` and `reset`, SSE written by hand on the response), child processes (drivers), `node:v8` (heap snapshot), `node:crypto` (SHA-256, random values) | No dependency for what the platform provides; the stub must control bytes and sockets exactly | An HTTP framework for the stub: it would normalise what the cases need raw |
| TS-U1-05 | **`ajv`** with its **JSON Schema 2020-12** build for the request matchers and the fixture self-checks | The contract's schemas are 2020-12; soorma-core validates the same contract with it | Hand-written matchers: duplicate the schema and drift from it |
| TS-U1-06 | **`yaml`** to read the OpenAPI documents | Needed to resolve the operations' schemas from the vendored YAML | Converting the YAML to JSON in the copy: would edit the vendored contract |
| TS-U1-07 | The **system `openssl` CLI** makes the per-run CAs and certificates (ECDSA P-256) | As soorma-core's `stack-certs.ts`; present on `ubuntu-24.04` and macOS; no X.509 dependency | An X.509 library (Q2 B) |
| TS-U1-08 | **`@opentelemetry/api`** and **`@opentelemetry/sdk-trace-base`** (with its in-memory exporter) in the **reference driver only** | The CC-SPN cases need real spans; test-only; never a package dependency (SPN-05) | A hand-rolled span recorder: would not prove anything about the OpenTelemetry API |
| TS-U1-09 | **Vitest** for U1's own unit tests | Matches soorma-core and U3; one test runner across the TypeScript in the repository | `node:test` (Q2 C) |
| TS-U1-10 | **git** for the drift check's remote half: `git ls-remote` for the peeled commit; a `--depth 1` fetch of that commit for the `contract/` tree id | No token, no REST API rate limit on shared runner IPs, no environment variable (Q5 X) | The GitHub REST API |
| TS-U1-11 | **The DCO check in `actions/github-script`**, pinned by SHA, reading GitHub's commit API with its default `github-token` input; its logic in a module under `tools/` so Vitest can test it with recorded API responses and throw-away git repositories | The token stays an action input, never an environment variable (Q7a X); the logic is testable outside a workflow run (NFR-U1-32) | A shell script calling `curl` with `GITHUB_TOKEN` in the environment |
| TS-U1-12 | **CI**: GitHub Actions on **`ubuntu-24.04`**, every action pinned by commit SHA with its tag in a comment; Dependabot (npm, GitHub Actions) weekly, 7-day cooldown, `target-branch: dev`; `pnpm audit --audit-level moderate`; dependency review on pull requests; a workflow check | Q7 X; SECURITY-10, SECURITY-13; matches soorma-core | `ubuntu-latest` and tag-pinned actions (the existing DCO workflow's, fixed) |

## Jobs U1 Adds or Changes (shape, not YAML)

| Job | Runs | Fails when |
|---|---|---|
| `checks` | contract drift (both halves), SPDX, workflow check, names and generated types (no-ops until U3 and U4 add packages), `pnpm audit` | Any check fails; the remote half cannot reach soorma-core |
| `unit` | `tsc --noEmit`, lint, Vitest for `conformance/` and `tools/` (including the DCO tests) | Any test fails |
| `conformance-self-test` | the reference driver in `reference` mode; then each fault, expecting failure on its target case | NFR-U1-02's 8 minutes passed; the reference run fails; a faulted run passes or fails without naming its target |
| `dco` (rewritten) | NFR-U1-29 to -31 | A commit lacks a matching sign-off and is not a verified Dependabot commit; a lookup fails |
| `dependency-review` | pull requests | A dependency change below the policy |

## Language-Specific Values Not Decided Here

`D_lang` and the other named values are U3's and U4's. U1's only obligation is NFR-U1-06: every
case is written relative to the values a driver reports.
