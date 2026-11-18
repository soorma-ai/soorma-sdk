# NFR Requirements — U1 `contract-and-conformance`

**Unit**: U1, **ordinary**: test and repository tooling (the contract copy and its checks; the
runner, stub, reference driver and faults; the repository checks; their CI). No NFR profile is
seeded from a PRD (units-generation Step 2.5: not a plane face, contract or harness).
**Answers**: Q1 to Q4 A; Q5, Q6, Q7 X; Q7a X (audit 2026-11-18T07:45:14Z and
2026-11-18T07:55:51Z).

**Out of scope here**: the SDK's named values (`H_renew`, `R_max`, `W_max`, `B_init`, `B_factor`,
`B_cap`, `L_ends`, `W_super`, `N_buf`, `D_lang`, `T_idle`, `T_req`). They are U3's and U4's. U1
must **accept whatever values a driver reports** and script every timing case relative to them.

Ids: `NFR-U1-{nn}`. Each traces to the initiative's NFRs, the FRs, or SECURITY rules.

---

## 1. Performance

| Id | Requirement | Traces to |
|---|---|---|
| NFR-U1-01 | **A full conformance run (all cases) completes within 5 minutes per driver per runtime** on a CI runner (`ubuntu-24.04`). Exceeding it fails the run's check | Q3 A; NFR-10 |
| NFR-U1-02 | **The conformance self-test job** (the reference driver in `reference` mode, then each of the four faults) **completes within 8 minutes**. Exceeding it fails the job | Q3 A; U1 *done when* |
| NFR-U1-03 | Cases run **one at a time** against one stub (shared listeners, clean recordings). Parallel execution is a later optimisation, revisited at NFR Design only if NFR-U1-01 or -02 is at risk | Q3 A |
| NFR-U1-04 | The runner reports each case's duration and the run's total, so a budget breach names the slow cases | Q3 A |

## 2. Reliability and Determinism

| Id | Requirement | Traces to |
|---|---|---|
| NFR-U1-05 | **No automatic retry of a failed case.** A failure is reported once; an intermittent failure is a defect in the case or the SDK, fixed, never rerun to green | Q4 A |
| NFR-U1-06 | **Timing assertions use windows, never instants**, with margins of **at least twice the value in force** (a case asserting "before `expiresAt − H_renew`" allows `2 × H_renew` of slack in the direction that cannot produce a false pass) | Q4 A |
| NFR-U1-07 | Every case starts from a clean state: a new client, a cleared stub recording, freshly generated secrets and files. No case depends on another's order or result | Q4 A; FR-03 |
| NFR-U1-08 | Random values (secrets, payloads, identifiers) come from a cryptographically secure generator; a secret appears in the report only as its length, never its value or a hash of it | NFR-06 |
| NFR-U1-09 | A runner or stub crash fails the run (it is never read as a pass); a driver that exits early fails the remaining cases by name | FR-03; SECURITY-15 |

## 3. The Contract Drift Check

| Id | Requirement | Traces to |
|---|---|---|
| NFR-U1-10 | **Local half**, always: every file under `contract/` hashes to `PIN`; nothing missing or extra | FR-01; US-12 #1 |
| NFR-U1-11 | **Remote half, by git, not the GitHub REST API** (Q5 X): `git ls-remote https://github.com/soorma-ai/soorma-core refs/tags/contract-v0.1.0^{}` reads the tag's **peeled commit**, which must equal `PIN.commit`; a **shallow fetch of that commit** (`git fetch --depth 1 … <commit>`) gives the **tree id of `contract/`**, which must equal `PIN.tree`. No token, no API rate limit, nothing read from an environment variable | Q5 X; SECURITY-13; the user's rule on secrets |
| NFR-U1-12 | **Fail closed in CI**: if soorma-core cannot be reached or either value differs, the check fails, naming what it could not read or the two values | Q5 X; SECURITY-15 |
| NFR-U1-13 | **Locally, `--offline`** runs only the local half and **says so** in its output ("remote half not run"); **CI never passes it** (the workflow has no such argument, and the check refuses `--offline` when it detects CI) | Q5 X |

## 4. Where the Suite Runs

| Id | Requirement | Traces to |
|---|---|---|
| NFR-U1-14 | **Linux CI (`ubuntu-24.04`) is authoritative.** Every case runs there, including **CC-SEC-05**: the job creates a second local user with `sudo` and has the runner make the case's file owned by it | Q6 X |
| NFR-U1-15 | **Locally** (macOS and Linux), every case runs. **`--local-skip CC-SEC-05`** skips that one case and **prints that it did not run and why**. Without the flag, CC-SEC-05 runs and **fails** if it cannot create the foreign-owned file. The flag names exactly one case id; no other case can be skipped | Q6 X |
| NFR-U1-16 | **CI never passes the flag, and the runner refuses it when it detects CI** (the CI indicators set by GitHub's hosted runners) | Q6 X |
| NFR-U1-17 | **No `sudo` in local test set-up**, and no macOS user creation (`dscl`) is built | Q6 X |
| NFR-U1-18 | **Windows is not a supported place to run the suite in M1** | Q6 X |

## 5. Security

| Id | Requirement | Traces to |
|---|---|---|
| NFR-U1-19 | **Secrets the runner makes** are random per run, **never printed**, never in a report, never in a command line: sent to drivers as base64 bytes (CDI-02), written to files only under a per-run temporary directory of mode `0700`, each file mode as the case requires, removed at the end of the run | NFR-06; SECURITY-03, SECURITY-12 |
| NFR-U1-20 | **Network**: the stub listens on loopback only; the tooling's only outbound connections are the drift check's git reads of soorma-ai/soorma-core and the DCO check's GitHub API reads in CI | SECURITY-07 (design-level), SECURITY-11 |
| NFR-U1-21 | **TLS in the stub**: a CA and server certificates made per run (ECDSA P-256), never committed, removed at the end; the untrusted listener's CA is separate. Private keys never leave the run's temporary directory | FR-15; SECURITY-09 |
| NFR-U1-22 | **CDI-02's runtime checks** are isolated in the driver process: the TypeScript driver runs with `--expose-gc` only in conformance runs; nothing in a package depends on it | CDI-02 |
| NFR-U1-23 | **Test-only code stays out of the packages**: the reference driver, the faults, the stub and the runner are private workspace packages, never published, never a dependency of `typescript/` or `python/`; a check fails if either package's file list includes them | I8; NFR-U1-26 |

## 6. Supply Chain and CI Integrity

| Id | Requirement | Traces to |
|---|---|---|
| NFR-U1-24 | **Pinned toolchain**: Node.js 24 LTS at an exact patch in `.node-version`; pnpm at an exact version in `packageManager`, installed without Corepack; `pnpm install --frozen-lockfile`; every dependency at an exact version; `pnpm-lock.yaml` committed | Q1 A; NFR-07; SECURITY-10 |
| NFR-U1-25 | **Dependencies only from the npm registry**, as few as the machinery needs (tech-stack-decisions.md); each with an Apache-2.0-compatible licence | Q2 A; SECURITY-10; NFR-09 |
| NFR-U1-26 | **Vulnerability scan**: `pnpm audit --audit-level moderate` fails CI; GitHub's **dependency review** runs on pull requests | Q7 X (as A); SECURITY-10 |
| NFR-U1-27 | **Dependabot**, weekly, **7-day cooldown**, for **npm and GitHub Actions**, both with **`target-branch: dev`**, so updates take the `dev` → `main` path | Q7 X |
| NFR-U1-28 | **Every workflow**: each action pinned by **commit SHA with its tag in a comment**; runners pinned to **`ubuntu-24.04`**; default `permissions: contents: read`, no job widening it; a **workflow check** fails on an unpinned action, `ubuntu-latest`, or wider permissions | Q7 X; SECURITY-10, SECURITY-13 |
| NFR-U1-29 | **The DCO check** (the existing `.github/workflows/dco.yml`, rewritten): every non-merge commit in the PR (`git rev-list --no-merges`) carries `Signed-off-by: {author name} <{author email}>` matching its author, **except** a commit for which GitHub's API (`GET /repos/{owner}/{repo}/commits/{sha}`) reports **both** `author.login == "dependabot[bot]"` **and** `commit.verification.verified == true` (Dependabot's commits are signed by GitHub, so an email cannot be spoofed into the exemption). The **`*[bot]*` email exemption is removed**. Works on a Dependabot PR and on every later `dev` → `main` PR | Q7 X; Q7a X; NFR-11 |
| NFR-U1-30 | **The DCO check's token**: the workflow's own token, read **through an action input** (`actions/github-script`'s default `github-token`), **never as an environment variable**; job permissions `contents: read` only | Q7a X |
| NFR-U1-31 | **The DCO check fails closed**: if the API lookup for an unsigned commit fails (any error, rate limit, missing field), the commit is **not** exempt and the check fails, naming the commit and the lookup error | Q7a X; SECURITY-15 |
| NFR-U1-32 | **DCO tests**, each in CI. **Fail**: another author's commit without a sign-off; a commit whose author email contains `[bot]` but that is not verified as Dependabot's; a human commit without a sign-off pushed into a Dependabot PR; an API lookup that errors. **Pass**: a verified Dependabot commit on its own PR; the same commit already merged into `dev`, on the `dev` → `main` PR. **How they run** (the user's clarification at approval): the check's logic is a script tested apart from the workflow; its tests run in CI against a **local test git repository** holding the commit shapes and **recorded or stubbed responses from GitHub's commit API** (a verified Dependabot commit, an unverified commit with a `[bot]` email, a human commit, a lookup error); they **do not depend on real PRs**. **Live confirmation**: the first real Dependabot PR into `dev` and the `dev` → `main` PR after it, their run IDs recorded in this initiative (open obligation OBL-01 in `aidlc-state.md`) | Q7a X; the user at approval |

## 7. Maintainability

| Id | Requirement | Traces to |
|---|---|---|
| NFR-U1-33 | Statement ids and case ids are permanent once published; a retired id is marked retired, never reused | FR-02, FR-03 |
| NFR-U1-34 | Each rule lives in one place: the specification states behaviour; the case files hold data; the runner holds assertions; no assertion is duplicated in a driver | AD-09; FR-03 |
| NFR-U1-35 | U1's own code (runner, matchers, stub, checks) has unit tests in Vitest, run in CI; the four repository checks each have a test proving they fail on the defect they look for | FR-01, FR-03, FR-17; NFR-10 |
| NFR-U1-36 | Every source file carries `SPDX-License-Identifier: Apache-2.0` (the SPDX check) | NFR-09 |

---

## Compliance

### Security baseline (deployment `local-only`)

| Rule | Outcome | Clauses |
|---|---|---|
| SECURITY-01 | Compliant; 1 clause N/A for the milestone, carried | In transit: the stub is TLS only (NFR-U1-21). At rest: no data store (carried) |
| SECURITY-02 | N/A | No load balancer or gateway |
| SECURITY-03 | Compliant; 1 clause N/A for the milestone, carried | No secret in output (NFR-U1-19); the runner's report is its log; centralised log service carried |
| SECURITY-04 | N/A | No web application |
| SECURITY-05 | N/A | No API endpoint: the stub is a test double on loopback |
| SECURITY-06 | Compliant | Workflow permissions `contents: read` only (NFR-U1-28, -30) |
| SECURITY-07 | N/A for the milestone, carried (hosted clauses); design-level: loopback only (NFR-U1-20) | |
| SECURITY-08 | N/A | No application access control |
| SECURITY-09 | Compliant | No default credentials; per-run CA (NFR-U1-21); current, supported runtime (NFR-U1-24) |
| SECURITY-10 | Compliant; SBOM N/A for the milestone, carried | Lock file, exact versions, audit, Dependabot, pinned actions and runner (NFR-U1-24 to -28) |
| SECURITY-11 | Compliant | Security-critical checks isolated (drift, DCO); misuse cases tested (NFR-U1-32); rate limiting N/A |
| SECURITY-12 | Compliant | No credential in code, IaC or environment variables; the DCO token via an action input (NFR-U1-30) |
| SECURITY-13 | Compliant | The contract verified by commit and tree id (NFR-U1-11); pipeline definitions reviewed through PRs; Dependabot exemption anchored on GitHub's signature (NFR-U1-29) |
| SECURITY-14 | N/A for the milestone, carried | No deployed service |
| SECURITY-15 | Compliant | Fail closed: drift check, DCO lookup, runner crash (NFR-U1-09, -12, -31) |

### Platform invariants

No change from Functional Design: I1 to I10 Covered through the specification and cases; I8 also
through NFR-U1-23 (test-only code out of the packages); I11 N/A (Construction selects
technology).

### Specification-gap pass

No new specification gap: every choice here is tooling, which no PRD or the contract addresses.
GAP-CAC-001 (soorma-ai/soorma-core#34) is unaffected.
