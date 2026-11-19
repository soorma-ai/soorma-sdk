# Business Rules — U2 `e2e-stack`

Every rule of the four commands and the end-to-end job, numbered, each with its source and its
verification. Answers: U2-FD-Q1 to Q8 (audit 2026-11-18T18:51:06Z). Settled before this stage:
AD-10 to AD-13, S-6, S-7 (Application Design, approved).

**S-6, read** (the user, 2026-11-18T19:20:00Z): S-6's step list names a "sign-in" after first
authentication. It is satisfied by **the sign-in `firstAuthenticate` returns** when the organization
requires no second factor (`org-gateway.openapi.yaml` at `contract-v0.1.0`); `setup` makes no
separate `authenticate` call. A second sign-in would be one more live sign-in for `setup` to end,
and S-6's "ends the environment credential and the sign-in" could not then hold for both.

**Changed after approval** (the user, 2026-11-19T03:03:47Z, at the Code Generation plan approval: "search the logs on every run, print them only on failure"): the log search runs on **every** `core-down` with a stack, before `down -v`; a hit or an unreadable source fails `core-down`, and so the job, on a green run too; `--logs` decides only whether clean logs are printed. Changed: LS-11, CD-02, CD-06, JOB-03; added: LS-12 (follows from the change: no container, no log). Before: the search ran only with `--logs`.

**Verification column**: `TC-ES-001` to `012` are the inception test cases; `TC-ES-013` to `023`
are **planned here** and added at QA enrichment, with these numbers and titles (business-logic-model
§7). Entities are in `domain-entities.md`.

## GEN — Every command

| # | Rule | Source | Verification |
|---|---|---|---|
| GEN-01 | The four commands (`core-up`, `setup`, `prove-stack`, `core-down`) are the same in CI and locally; none reads a CI-only setting to change what it does, except `core-down --logs`, which CI passes on a failed job and a developer may pass by hand | AD-10; C-05 *Interface* | TC-ES-012 |
| GEN-02 | **No secret or credential is printed, logged, or put in an argument, an environment variable, an error message or a file other than its own secret file.** This covers K, the enrollment material, the sign-in, the environment credential, each registration secret and each agent credential. A secret reaches another process only through a file named for it (an agent's secret file) or a request body | NFR-06; the user's rule (secrets never in environment variables); *done when* ("prints no secret or credential") | TC-ES-006; TC-ES-007 (prove-stack's output) |
| GEN-03 | The commands live under `e2e/`, outside both packages; nothing under `e2e/` is imported by `typescript/` or `python/` package code, and no package's file list contains `e2e/` | *done when* ("the raw calls stay outside both packages"); I6, I8 | U1's packaging guard, extended to `e2e/` (business-logic-model §6) |
| GEN-04 | Every raw call is HTTPS to `localhost` on the stack's ports, trusting **only** the clone's `deploy/local/.secrets/stack-ca.pem`, and sends `Soorma-Contract-Version: 0.1.0` | AD-10; contract `conventions/versioning.md` | TC-ES-004, TC-ES-007 |
| GEN-05 | soorma-core values (`o1`, `p1`, `e`, `h@example.com`, the ports, the handover and CA paths) are soorma-core's at the tag, and hold because `core-up` refuses any other commit (CU-05) | domain-entities.md | TC-ES-002 |
| GEN-06 | A command that fails exits non-zero with one line naming what failed; it never prints a stack trace that could hold a request or response body | SECURITY-15; NFR-06 | TC-ES-020 |
| GEN-07 | **Every raw call and every child step that can hang has a time limit** (values: TS-U2-11; raw calls 30 s each). A limit that runs out is a failure: one line naming the step and saying it timed out, then the command's usual failure path. Never retried. *Added at the NFR Requirements approval* | The user (2026-11-18T20:54:18Z); NFR-U2-01, -07 | TC-ES-022, TC-ES-023 |

## CU — `e2e/core-up`

| # | Rule | Source | Verification |
|---|---|---|---|
| CU-01 | Refuses if `.e2e/owner.json` exists: an earlier run was not torn down. The message says to run `core-down` | U2-FD-Q2 | TC-ES-003 |
| CU-02 | Refuses if a `soorma-local` Compose project, or any volume of that project, exists: it never touches a stack it did not start | AD-11 | TC-ES-003 |
| CU-03 | Writes the ownership record **before** it creates anything (clone, images, secrets, containers), so every later failure leaves a stack `core-down` can remove | U2-FD-Q2 | TC-ES-008 |
| CU-04 | Removes any old `.e2e/soorma-core/`, then clones `contract.pin.json`'s `repository` at its `tag`, depth 1 | AD-10; S-6 | TC-ES-001 |
| CU-05 | **Fails unless the clone's `HEAD` equals `contract.pin.json`'s `commit`** (`c1e3d7f3…`). The pin file is the one source of tag and commit for the contract copy and the stack | AD-10; SECURITY-13 | TC-ES-002 |
| CU-06 | Installs soorma-core's workspace with its frozen lockfile, under soorma-core's own pinned toolchain (Node `26.13.0`, pnpm `12.18.0`, from its `.node-version` and `packageManager`) | AD-10; S-6 | TC-ES-001 |
| CU-07 | Builds the four images exactly as soorma-core's CI does at the tag: `docker build -f services/<s>/Dockerfile -t soorma/<s>:local .` for `org-gateway`, `control-gateway`, `data-gateway`, `event-ingest` | AD-10; S-6 | TC-ES-001 |
| CU-08 | Runs `pnpm stack:init`, then `pnpm stack:up`, in the clone | AD-10 | TC-ES-001 |
| CU-09 | Writes the fresh-stack marker **last**, and only when every step succeeded | AD-11; U2-FD-Q1 | TC-ES-001, TC-ES-005 |
| CU-10 | On a failure at any step, exits non-zero and leaves the ownership record, so `core-down` removes whatever was created | U2-FD-Q2 | TC-ES-008 |
| CU-11 | **Prerequisites, before the ownership record**: Docker Engine 26 or later, Docker Compose 2.26.0 or later, `git`, and the `--core-node` executable present; otherwise refuses, leaving nothing to tear down. *Added at NFR Requirements* | U2-NFR-Q5; NFR-U2-06 | TC-ES-021 |
| CU-12 | **No install scripts**: after the clone, refuses unless the clone's `pnpm-workspace.yaml` has `strictDepBuilds: true` and `allowBuilds: {}`. True at `contract-v0.1.0` by CU-05; checked explicitly so the trust is stated and survives a new tag. *Added at NFR Requirements* | U2-NFR-Q6 (the user); NFR-U2-15 | TC-ES-021 |
| CU-13 | **soorma-core's toolchain, exactly**: after the clone, refuses unless `--core-node`'s version equals the clone's `.node-version` and this repository's pnpm equals the clone's `packageManager`. *Added at NFR Requirements* | U2-NFR-Q2; NFR-U2-16 | TC-ES-021 |

## ST — `e2e/setup --agents <a,b> [--secrets-dir <dir>]`

| # | Rule | Source | Verification |
|---|---|---|---|
| ST-01 | **Checks before consuming the marker**: each agent identifier matches the contract's `LogicalAgentIdentifier` (`^[A-Za-z0-9][A-Za-z0-9._~-]*$`, 1 to 64 characters), the identifiers are distinct, and there is at least one. A bad argument fails with the marker still in place | U2-FD-Q3; contract `components.openapi.yaml` | TC-ES-019 |
| ST-02 | **The secrets directory** (default `.e2e/secrets/`; `--secrets-dir` overrides) is created with mode `0700` if absent. If present, it must be a directory (not a symbolic link) owned by the current user, mode exactly `0700`, holding no `<agent>.secret` for any agent given; otherwise `setup` refuses, before consuming the marker | U2-FD-Q5; AD-10 | TC-ES-019 |
| ST-03 | **Consumes the marker first**: removes `.e2e/fresh-stack` before any call. Without it, refuses ("no fresh stack: run core-down, then core-up"). One attempt per stack; after any failure the remedy is `core-down`, then `core-up` | U2-FD-Q1; AD-11 | TC-ES-005 |
| ST-04 | Reads the enrollment material from the clone's `deploy/local/.secrets/handover/first-admin-1.txt` (its `enrollmentMaterial:` line) into the first call's body only | S-6 | TC-ES-004, TC-ES-006 |
| ST-05 | Generates K in memory, meeting S1's secret policy (8 to 256 code points after NFKC normalisation), and uses it **once**, as `firstAuthenticate`'s `newSecret`. K is never written, printed or passed to another process | S-6; GEN-02; the user (2026-11-18T19:20:00Z) | TC-ES-006 |
| ST-06 | Makes the calls in this order, each expecting exactly the contract's success status (business-logic-model §3): `firstAuthenticate` `200` with a sign-in present (the stack has `secondFactorRequired: false`; a response asking for a second factor is a failure); **no `authenticate` call**: `issueEnvironmentCredential` at E's S2 `200`, presenting the sign-in `firstAuthenticate` returned; `grantToHuman` (self, `agent:register`, `event:publish`, `event:subscribe`) `200`; per agent, `registerAgent` `200` then `issueRegistrationSecret` `200` | S-6; the contract's S1, S2 documents | TC-ES-004 |
| ST-07 | **Registration**: standing permissions `event:publish` and `event:subscribe`, no re-broadening declaration, `autonomyDeclared: true`, for every agent. Both permissions for each agent because the example's agent file is copied as one agent that both publishes and subscribes (US-11 #2); nothing broader is granted, and the standing set stays within what the sponsor holds (checked by S2, not here) | S-6; US-11 #2; SECURITY-06 note | TC-ES-004 |
| ST-08 | Each registration secret is written to `<dir>/<agent>.secret`, **created exclusively with mode `0600`** (never overwriting a file), holding the secret's value and nothing else, then dropped from memory | AD-10; U2-FD-Q5 | TC-ES-004 |
| ST-09 | **Ends what it opened, and checks it is refused.** `endEnvironmentCredential` (`204`), then presents the environment credential once more with `endEnvironmentCredential` and requires `401` (refused); then `endSignIn` (`204`) for the sign-in `firstAuthenticate` returned, then presents it once more with `endSignIn` and requires `401`. The environment credential is checked **before** the sign-in is ended, so its refusal is its own end's, not the sign-in's. The repeated end call is the check because, on a credential still live, it ends it rather than extending it. **On a failure past first authentication**, it does the same for whichever of the two exist, then reports the **original** failure; a credential found still live after its end adds a second failure line, naming which (sign-in or environment credential), never its value. A call that **timed out** (GEN-07) is a failure like any other: the ends and checks still run, each under its own limit. **After `setup`, success or failure, no sign-in or environment credential it opened is left live** | S-6 ("ends the environment credential and the sign-in"); the user (2026-11-18T19:20:00Z); SECURITY-15 | TC-ES-006 (success), TC-ES-020 (failure) |
| ST-10 | Writes the stack description `.e2e/stack.json` (mode `0600`) **last**, holding exactly domain-entities.md E-07's fields: secret files by path, never contents | U2-FD-Q4 | TC-ES-004 |
| ST-11 | Prints the same values as plain lines (environment, S3, S4, CA path, each agent and its secret file's path, the stack description's path); nothing parses them | U2-FD-Q4 | TC-ES-004, TC-ES-006 |
| ST-12 | **No retry. Stops at the first failure**, printing the step's name, the HTTP status, the Problem's `code` and the `Soorma-Request-Id`; never the response body beyond the code, never a request body. Any status other than the operation's success status is a failure | U2-FD-Q8 | TC-ES-020 |

## PS — `e2e/prove-stack`

| # | Rule | Source | Verification |
|---|---|---|---|
| PS-01 | Reads the stack description and, per agent, its secret file, as an SDK would: nothing else from `setup` | U2-FD-Q6 | TC-ES-007 |
| PS-02 | Per agent, **one** `exchangeBootstrap` at E's S3 (`POST /agent-credentials`, body `{ agent, secret, instance: "e2e-proof" }`), expecting **`200`** (the contract's success status; Q1a), with the response body validating against the contract's `exchangeBootstrap` `200` schema | *done when*; Q1a; U2-FD-Q6 | TC-ES-007 |
| PS-03 | Prints per agent the agent, the status and pass or fail; never the credential or the secret. The credential is dropped after validation: never kept, renewed or written; it expires on its own (at most 15 minutes) | GEN-02; U2-FD-Q6 | TC-ES-007 |
| PS-04 | **The proof does not use the secret up.** The contract's `exchangeBootstrap` requires only that the secret be "an active secret of that agent's registration in this environment"; a bootstrap consumes nothing, so the same secret file serves U3's and U4's scenarios after the proof | The user (U2-FD-Q6); contract `data-gateway.openapi.yaml` `exchangeBootstrap` at `contract-v0.1.0` | U3's scenario bootstraps after the proof (TC-TH, carried) |
| PS-05 | **The proof cannot affect the attempt limit.** soorma-core's bootstrap bound counts only failures: `FailedBootstrapAttemptWriter` records failed attempts, and the slot bound keeps an entry on failure while "a success removes exactly its own" (`packages/abuse-bound/src/agent-bound.ts`, `slot-bound.ts` at `contract-v0.1.0`). A successful proof leaves no attempt behind for U3's scenario to run into | The user (U2-FD-Q6); soorma-core at the tag, read only | U3's scenario (carried); stated, not tested here |
| PS-06 | Bootstraps every agent and reports each; exits non-zero if any agent's proof failed. No retry | U2-FD-Q6, Q8 | TC-ES-007, TC-ES-020 |

## CD — `e2e/core-down [--logs]`

| # | Rule | Source | Verification |
|---|---|---|---|
| CD-01 | **Acts only on a stack `core-up` started.** Without `.e2e/owner.json` it removes nothing, prints that no stack started by `core-up` is recorded, and exits `0` | U2-FD-Q2 | TC-ES-018 |
| CD-02 | **Runs the log search (LS) on every run**, **before** taking the stack down, while the containers and their logs exist. `--logs` only decides whether clean logs are printed (LS-11). *Changed at the Code Generation plan approval* (before: only with `--logs`) | U2-FD-Q7; S-6 ("logs shown first on failure"); the user (2026-11-19T03:03:47Z) | TC-ES-013 to TC-ES-016, TC-ES-015 (without `--logs`) |
| CD-03 | Runs `docker compose -f .e2e/soorma-core/deploy/local/compose.yaml down -v`; if the clone's Compose file is missing (a `core-up` that failed early), `docker compose -p soorma-local down -v` | AD-10; S-6 | TC-ES-008 |
| CD-04 | Then removes the stack description, each agent secret file it lists, the default secrets directory, the marker, the clone, and the ownership record **last**. A `--secrets-dir` outside `.e2e/` is not removed; the secret files in it are, by name | U2-FD-Q5; U2-FD-Q2 | TC-ES-008 |
| CD-05 | Tears down **whatever the log search found**: a hit or an unreadable log changes the exit status, never whether the stack is removed | U2-FD-Q7 (change 3) | TC-ES-013, TC-ES-016 |
| CD-06 | Exits non-zero if the log search found a hit or could not read a source, **with or without `--logs`**, or the teardown failed; otherwise `0`. So a leak fails a green job. *Changed at the Code Generation plan approval* | U2-FD-Q7; SECURITY-15; the user (2026-11-19T03:03:47Z) | TC-ES-008, TC-ES-013, TC-ES-015, TC-ES-016 |
| CD-07 | **A teardown that fails or times out keeps the ownership record** (and the clone), so `core-down` can be run again and `core-up` still refuses (CU-01) until the stack is gone. *Added at the NFR Requirements approval* | GEN-07; U2-FD-Q2 | TC-ES-023 |

## LS — The log search (every `core-down`)

| # | Rule | Source | Verification |
|---|---|---|---|
| LS-01 | **The typed prefixes are read from the vendored contract**, `contract/conventions/credentials.md`: every `` `soorma_…_` `` it names. Never a list copied into this repository's code. At the tag that is `soorma_ac_`, `soorma_ec_`, `soorma_si_`, `soorma_dc_` (*Typed prefixes*) and `soorma_rs_`, `soorma_em_` (*Material is not a credential*). The file is the tag's, byte for byte (U1's drift check) | The user (U2-FD-Q7 change 1) | TC-ES-017 |
| LS-02 | If no prefix can be read from the contract, the search **fails closed**: no log is printed | SECURITY-15 | TC-ES-017 |
| LS-03 | **A prefix followed by at least one token character is a hit.** Token characters are the contract's credential syntax (`credentials.md` *Syntax*, RFC 6750 `b64token`): letters, digits, `-`, `.`, `_`, `~`, `+`, `/`. A prefix with no token character after it (the bare name in a sentence) is not a hit. So the sign-in, the environment credential and the agent credentials, which never touch disk, are searched for by their prefixes | The user (U2-FD-Q7 change 1); `credentials.md` | TC-ES-013 |
| LS-04 | **Exact values are searched for too**: each agent secret (the files the stack description lists) and each enrollment material in the clone's `deploy/local/.secrets/handover/` files (every `enrollmentMaterial:` value) | U2-FD-Q7 (A; change 2) | TC-ES-014 |
| LS-05 | **The human secret K is not searchable**, and the search says so in its output: K is never on disk and has no prefix. It is generated per run and discarded, so a leak of it is worthless once the stack is down (`down -v`) | The user (U2-FD-Q7 change 1) | stated; TC-ES-006 shows K is never written |
| LS-06 | Each service of the `soorma-local` project is read **separately**, so a hit names its service | U2-FD-Q7 | TC-ES-013 |
| LS-07 | **No hit, every log read**: the logs are printed, service by service | U2-FD-Q7 (A); S-6 | TC-ES-015 |
| LS-08 | **A hit is a soorma-core logging defect.** No log is printed (not even the clean services'). `core-down` prints, per hit, the service and the kind (the contract's name for the prefix, such as "Agent credential" or "registration secret", or "agent secret (exact value)", "enrollment material (exact value)"), **never the value or the line**; tears the stack down (CD-05); and exits non-zero | The user (U2-FD-Q7 change 3) | TC-ES-013, TC-ES-014 |
| LS-09 | **A hit is raised as a soorma-core issue** naming the service and the tag (`contract-v0.1.0`), and the kind found, never the value. `core-down`'s message says so. This repository never works around it (for example by filtering the logs) | The user (U2-FD-Q7 change 3); the standing rule: never adapt soorma-core locally | stated; the message checked in TC-ES-013 |
| LS-10 | **An unreadable log fails closed**: if any service's log (including one whose `docker compose logs` runs out of its time limit, GEN-07), any agent secret file the stack description lists, or the handover directory cannot be read, no log is printed, `core-down` names what could not be read, tears the stack down, and exits non-zero | The user (U2-FD-Q7: "an unreadable log (refuse to print, fail closed)"); SECURITY-15 | TC-ES-016 |
| LS-11 | **The search runs on every `core-down` that has a stack to take down**, whether or not `--logs` is given, so a leak in soorma-core's logs is caught on every CI run, green ones included. A hit (LS-08) or an unreadable source (LS-10) fails `core-down`. **`--logs` decides only whether clean logs are printed**: with it, a clean search prints the logs service by service (LS-07); without it, one line per service saying it was searched and is clean, and no log text. *Changed at the Code Generation plan approval* (before: the search ran only with `--logs`) | the user (2026-11-19T03:03:47Z): "search the logs on every run, print them only on failure" | TC-ES-015, TC-ES-008 |
| LS-12 | **No container, no search**: when the `soorma-local` project has no container, stopped ones included (a `core-up` that failed before `stack:up`), there is no log to search; `core-down` says so and reads no value source. A listing that fails is unreadable (LS-10). *Added at the Code Generation plan approval, following from LS-11*: without it, every early `core-up` failure would also fail `core-down` over a handover file `stack:init` never wrote | LS-11; LS-10 | TC-ES-018 (extended: a record and no container) |

## JOB — The end-to-end job (C-06)

| # | Rule | Source | Verification |
|---|---|---|---|
| JOB-01 | Triggers: `pull_request`, and `push` to `dev`. **Not** `push` to `main`: a PR's run already tested the merge result | AD-12; S-7 | TC-ES-009 |
| JOB-02 | **`changes` job**: computes the changed paths (pull request: base to the test merge; push: before to head). Outputs `e2e=false` only when the diff is computable, non-empty, and every path is under `aidlc-docs/`; anything else, including an error, `e2e=true` (fails safe; soorma-core #26) | AD-12; S-7 | TC-ES-010 |
| JOB-03 | **`e2e` job**: `needs: changes`, `if: needs.changes.outputs.e2e == 'true'`. Steps: check out; toolchains; `core-up`; `setup --agents agent-a,agent-b`; `prove-stack`; then **`core-down`, `if: always()`, with `--logs` when `failure() \|\| cancelled()`**: a job stopped by its timeout or cancelled is reported as cancelled, not failed, and still gets its logs shown. **The search itself runs on every run** (LS-11): on a green run `core-down` is called without `--logs`, searches, prints no log, and fails the job on a hit or an unreadable source. *Changed at the Code Generation plan approval* | U2-FD-Q6; S-6; the user (2026-11-18T20:54:18Z); the user (2026-11-19T03:03:47Z) | TC-ES-001 to 008 in CI; TC-ES-008 (the condition, read from the workflow) |
| JOB-04 | One fresh stack per job; no job shares or reuses a stack | AD-11; S-7 | TC-ES-005 |
| JOB-05 | `ubuntu-24.04`; actions pinned by commit SHA; `permissions: contents: read`; nothing under `.e2e/` is uploaded as an artifact. U1's workflow check enforces each | NFR-07; U1 NFR-U1-28 | U1's workflow check (`pnpm checks`) |
| JOB-06 | **After U3**, the `e2e` job becomes `e2e-typescript`: the scenario added after `prove-stack`. U4 adds `e2e-python` on the same steps. `prove-stack` stays in every language job, so a stack failure is told apart from an SDK failure; no job runs a stack only to prove it | U2-FD-Q6 | U3's and U4's code PRs |
| JOB-07 | **The CI time** the job adds is measured on U2's code PR, with its run ID recorded in `aidlc-state.md` (OBL-02). Past 8 minutes, NFR Requirements revisits it (AD-13) | AD-13; OBL-02 | TC-ES-011 |

## Misuse Considered (SECURITY-11)

| Misuse | Rule that stops it |
|---|---|
| `setup` run twice, or against a developer's long-lived stack | ST-03 (single-use marker), CU-09 |
| `core-down` removing a developer's own `soorma-local` volumes | CD-01, CU-02 |
| A secret reaching public CI logs through soorma-core's logs | LS-01 to LS-12 (searched on every run) |
| A secret file another local user can read, or one overwritten | ST-02, ST-08 |
| The stack built from a branch or a moved tag | CU-05 |
| Agent code coming to depend on the raw human calls | GEN-03 |
