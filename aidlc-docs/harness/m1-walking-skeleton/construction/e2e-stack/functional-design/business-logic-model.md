# Business Logic Model — U2 `e2e-stack`

The flows of the four commands and the end-to-end job, step by step. Rules are cited by their
ids in `business-rules.md`; entities by theirs in `domain-entities.md`. Answers: U2-FD-Q1 to Q8.

## 1. One Run

```text
core-up  -->  setup --agents agent-a,agent-b  -->  prove-stack  -->  [scenario: U3, U4]  -->  core-down [--logs]
   |              |                                    |                                         ^
   +-- fails -----+---------- fails -------------------+---------- always ----------------------+
```

Text alternative: a run is `core-up`, then `setup`, then `prove-stack`, then (from U3 on) the
language's scenario, and `core-down` at the end whatever happened; `--logs` when any earlier step
failed. A failed step ends the run early; `core-down` still runs. One run, one stack.

## 2. `e2e/core-up`

| Step | Action | On failure |
|---|---|---|
| 1 | `.e2e/owner.json` exists? Refuse (CU-01) | exit non-zero; nothing created |
| 2 | A `soorma-local` project or volume exists? Refuse (CU-02) | exit non-zero; nothing created |
| 3 | Write `.e2e/owner.json` (`0600`): `startedAt`, `tag`, `commit` from `contract.pin.json` (CU-03) | exit non-zero |
| 4 | Remove `.e2e/soorma-core/` if present; clone the pin's `repository` at its `tag`, depth 1 (CU-04) | exit non-zero; record stays (CU-10) |
| 5 | `git rev-parse HEAD` must equal the pin's `commit` (CU-05) | exit non-zero, naming expected and actual commit |
| 6 | Install soorma-core's workspace, frozen lockfile, its own Node and pnpm (CU-06) | exit non-zero |
| 7 | Build the four images, soorma-core's CI's `docker build` lines (CU-07) | exit non-zero |
| 8 | `pnpm stack:init`; `pnpm stack:up` (CU-08) | exit non-zero |
| 9 | Write `.e2e/fresh-stack` (`0600`) (CU-09) | exit non-zero |

## 3. `e2e/setup --agents <list> [--secrets-dir <dir>]`

**Before the marker** (ST-01, ST-02): parse and check the agent identifiers; prepare or check the
secrets directory. A failure here leaves the marker, so a corrected `setup` may run.

**Consume the marker** (ST-03): remove `.e2e/fresh-stack`; absent, refuse.

**The calls** (ST-04 to ST-09), each HTTPS to `localhost`, trusting only the clone's CA, with
`Soorma-Contract-Version: 0.1.0` (GEN-04):

| # | Operation | Port | Credential presented | Body (secrets in **bold** never leave memory except as shown) | Expect |
|---|---|---|---|---|---|
| 1 | `firstAuthenticate` `POST /first-authentication` | 8441 (S1) | none | `principal {o1, h@example.com}`, **enrollment material** (handover file), **K** (new; its only use) | `200`, `signIn` present: **the sign-in** for calls 2 and 8 |
| 2 | `issueEnvironmentCredential` `POST /environment-credentials` | 8442 (E's S2) | **sign-in** (from call 1) | none | `200` |
| 3 | `grantToHuman` `POST /grants` | 8442 | **environment credential** | `target {o1, h@example.com}`, `permissions [agent:register, event:publish, event:subscribe]` | `200` |
| 4n | `registerAgent` `POST /registrations` | 8442 | **environment credential** | `agent`, `standingPermissions [event:publish, event:subscribe]`, `autonomyDeclared: true` | `200` |
| 5n | `issueRegistrationSecret` `POST /registration-secrets` | 8442 | **environment credential** | `registration: agent` | `200`; **secret** written to `<dir>/<agent>.secret` (`0600`, exclusive create), then dropped |
| 6 | `endEnvironmentCredential` `POST /environment-credentials/current/end` | 8442 | **environment credential** | none | `204` |
| 7 | `endEnvironmentCredential` again: **the refusal check** | 8442 | **environment credential** | none | `401` (refused) |
| 8 | `endSignIn` `POST /sign-ins/current/end` | 8441 | **sign-in** (from call 1) | none | `204` |
| 9 | `endSignIn` again: **the refusal check** | 8441 | **sign-in** | none | `401` (refused) |

Calls 4n and 5n run once per agent, in the order given. There is **no `authenticate` call**: the
sign-in is the one call 1 returns (S-6, read; ST-06), so `setup` opens exactly one sign-in and one
environment credential, and calls 6 to 9 end both and check that each is refused (ST-09). Call 7
comes before call 8 so that the environment credential's refusal is its own end's, not a
consequence of the sign-in ending. A repeated end call is the check because on a credential that
is somehow still live it ends it, never extends it. Call 1's response may not ask for a second
factor: the stack is configured with `secondFactorRequired: false`, so a response with
`secondFactorEnrollmentRequired` and no sign-in is a failure (ST-06).

**On a failure** (ST-12): stop; print `setup: <step> failed: <status> <Problem code> (request
<Soorma-Request-Id>)`. If the failure is past call 1, run calls 6 to 9 for whichever of the
environment credential and the sign-in exist (ST-09); the original failure stays the reported
one, and a credential found still live after its end adds a line naming which (never its value);
exit non-zero. No
retry; the next run is `core-down`, `core-up`.

**On success**: write `.e2e/stack.json` (`0600`, E-07) last (ST-10); print the values as plain
lines (ST-11).

## 4. `e2e/prove-stack`

| Step | Action |
|---|---|
| 1 | Read `.e2e/stack.json`; for each agent, read its secret file (PS-01) |
| 2 | `POST https://localhost:8444/agent-credentials`, body `{ agent, secret, instance: "e2e-proof" }`, contract version header, the stack's CA (PS-02) |
| 3 | Pass when the status is `200` and the body validates against the contract's `exchangeBootstrap` `200` response schema (read from the vendored `contract/data-gateway.openapi.yaml`); otherwise fail with the status and the Problem's `code` |
| 4 | Print `prove-stack: <agent>: <status> pass` or `... fail`; drop the credential (PS-03) |
| 5 | After every agent: exit non-zero if any failed (PS-06) |

Why the proof does not disturb the scenario that follows: the bootstrap needs only an **active**
secret and consumes nothing (PS-04), and soorma-core's attempt bound keeps entries for **failed**
attempts only; a success removes its own (PS-05).

## 5. `e2e/core-down [--logs]`

```text
owner.json? --no--> print "no stack started by core-up is recorded"; exit 0
     | yes
     v
--logs? --yes--> log search (5.1) --> print logs | refuse (hit) | refuse (unreadable)
     |                                        |
     v                                        v
down -v (Compose file, or -p soorma-local) <--+
     |
     v
remove: stack.json, listed secret files, default secrets dir, marker, clone, owner.json (last)
     |
     v
exit: non-zero on a hit, an unreadable log, or a teardown failure; else 0
```

Text alternative: without the ownership record, `core-down` does nothing and exits `0`. With it,
and `--logs`, it searches the logs first, then prints them only if clean and fully read. It then
takes the stack down, removes everything the run wrote, removes the ownership record last, and
exits non-zero if the search found a hit or could not read something, or the teardown failed.

### 5.1 The log search (LS-01 to LS-11)

1. **Patterns**. Read `contract/conventions/credentials.md`; collect every `` `soorma_…_` `` it
   names, with the contract's name for each (LS-01). None found: fail closed (LS-02). Each
   prefix becomes the pattern *prefix, then one or more of* `[A-Za-z0-9._~+/-]` (LS-03).
2. **Exact values**. Read the stack description (if `setup` wrote one) and each agent secret file
   it lists; read every `enrollmentMaterial:` value in the clone's
   `deploy/local/.secrets/handover/` files (LS-04). Any of these unreadable: fail closed (LS-10).
3. **Logs**. List the `soorma-local` project's services; read each service's log separately
   (`docker compose logs --no-color --no-log-prefix <service>`). A service whose log cannot be
   read: fail closed (LS-06, LS-10).
4. **Search**. Each log against every pattern and every exact value. Record per hit: the service
   and the kind. Keep no matched text.
5. **Outcome**.
   - **Clean** (every log read, no hit): print the logs, service by service (LS-07)
   - **Hit**: print nothing of the logs; print `core-down: <service>'s log holds a <kind>: a
     soorma-core logging defect. Not printing any log. Raise it as a soorma-core issue naming
     <service> and contract-v0.1.0, without the value.` once per hit (LS-08, LS-09)
   - **Unreadable**: print nothing of the logs; print what could not be read (LS-10)
   - Every outcome states that the human secret K is not searchable, and why (LS-05)
6. Continue to `down -v` in every outcome (CD-05).

## 6. Packaging (GEN-03; I6, I8)

U1's packaging guard (`tools/packaging/`) checks that neither package's file list contains
`conformance/`. U2 adds `e2e/` to what it forbids, and the guard's test proves it catches an
`e2e/` file placed in a package. Inert until U3 (no package yet), as for `conformance/`.

## 7. Test Cases Planned for QA Enrichment

The inception cases TC-ES-001 to 012 stand. Functional Design adds these; QA enrichment writes
them with these numbers:

| TC | Title | Rules |
|---|---|---|
| TC-ES-013 | The log search finds each typed prefix followed by token characters, naming the service and the kind; a bare prefix is not a hit | LS-03, LS-06, LS-08, LS-09; one case per prefix read from the contract |
| TC-ES-014 | The log search finds the exact enrollment material, and an exact agent secret | LS-04, LS-08 |
| TC-ES-015 | A clean log is printed; nothing is searched without `--logs` | LS-07, LS-11 |
| TC-ES-016 | An unreadable log: nothing printed, `core-down` fails closed and still tears the stack down | LS-10, CD-05, CD-06 |
| TC-ES-017 | The prefixes come from the vendored contract; none readable fails closed | LS-01, LS-02 |
| TC-ES-018 | `core-down` without an ownership record removes nothing and exits `0` | CD-01 |
| TC-ES-019 | `setup` refuses a bad agent identifier or secrets directory before consuming the marker | ST-01, ST-02 |
| TC-ES-020 | `setup` stops at the first failed call, printing step, status, Problem code and request id, nothing else; **after a failure past first authentication, no sign-in or environment credential `setup` opened is left live**, shown by each being refused when presented again (calls 7 and 9) | ST-12, ST-09, GEN-06 |

**TC-ES-006, extended at QA enrichment** (the user, 2026-11-18T19:20:00Z): after a **successful**
`setup`, no sign-in or environment credential `setup` opened is left live, shown by each being
refused when presented again (calls 7 and 9 return `401`), on the real stack in the `e2e` job.
The check is the refusal, never an assumption that an end call worked. That `setup` makes no
`authenticate` call is shown by TC-ES-020's fake, which records every call it receives.

**TC-ES-020's failure path** needs a failure past first authentication. On the real stack nothing
reachable from `setup`'s arguments fails there without a fault hook in `setup`, which this design
refuses (test-only code in the command). So TC-ES-020 runs `setup` against a **local fake of S1
and S2** that follows the contract's end semantics (an ended credential is refused with `401`) and
fails `registerAgent` with `503`. It asserts that no `authenticate` call is made, that calls 6 to 9 are made, and that the fake holds no
live sign-in or environment credential at the end. The real-stack refusal is TC-ES-006's.

TC-ES-013 to 017 run against recorded log text and the vendored contract, without a stack, so
they run in `unit` on every PR; the end-to-end job exercises the search for real only when a job
fails.

## 8. Values Left to NFR Requirements

The commands' language and runtime; how a runner and a developer machine hold soorma-core's Node
`26.13.0` beside this repository's Node 24; how a `soorma-local` project and its volumes are
detected; K's generation; the job's expected time, now measured (OBL-02).
