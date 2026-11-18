# NFR Design Patterns — U1 `contract-and-conformance`

How U1's tooling meets NFR-U1-01 to -36. **Answers**: Q1 A (a new driver process per case),
Q2 A (finish, then judge; per-case timeouts; a watchdog at twice the budget), audit
2026-11-18T08:13:23Z. Components are in [logical-components.md](logical-components.md).

---

## P-01 Process Isolation per Case (Q1 A)

**Carries**: NFR-U1-07, NFR-U1-09, NFR-U1-22; CDI-02.

```text
for each case:
  stub.reset()                      clear recordings, load the case's script
  driver = spawn(driver command)    a new process; stdin/stdout JSON lines, stderr captured
  describe -> values, depthBound    read again per case (the same driver binary each time)
  commands ... observations
  inspect (if the case asks)        the runtime checks run in this process only
  close; wait for exit (bounded); kill if it does not exit
  evaluate expectations             against observations and the stub's recording
```

- **Why**: CDI-02's checks read the driver's whole heap (TypeScript) or reference counts
  (Python); anything an earlier case left behind could hide a retained secret or fake one. A
  fresh process makes clean state structural rather than a driver's duty
- A driver that crashes, writes a non-protocol line, or exits early **fails that case by name**;
  the next case starts a new process (NFR-U1-09)
- The stub and the per-run CAs live for the whole run; only the driver is per case
- Cost: a process start per case (about 0.1 s Node, 0.2 s Python), within NFR-U1-01

## P-02 Time Budgets: Finish, Then Judge (Q2 A)

**Carries**: NFR-U1-01 to -04.

| Level | Limit | On breach |
|---|---|---|
| **Case** | its timeout: the longest window its expectations use, plus a fixed margin, declared in the case file and checked by the loader | the case fails, naming the expectation it was waiting on; the driver is killed; the run continues |
| **Run** | the budget: 5 minutes for a full run per driver per runtime; 8 minutes for the self-test job | the run **completes**, then **fails**, and the report lists the **slowest cases** first with their durations |
| **Watchdog** | **twice the budget** (10 and 16 minutes) | the run is stopped, every case not reached is reported *not run*, and the run fails |

The runner measures wall time per case and per run (NFR-U1-04). The CI job's own timeout sits
above the watchdog, so the runner, not the CI platform, reports a hung run.

## P-03 Timing Windows, Never Instants

**Carries**: NFR-U1-05, NFR-U1-06.

- Every time-based expectation is a **window** relative to a **scripted moment** (for example
  "the renewal request arrives after `start` and before `expiresAt`"), with a margin of at
  least twice the value in force, placed on the side that cannot turn a failure into a pass
- Cases set short values through the driver's test hook, so windows are seconds, not minutes;
  the loader rejects a case whose window is narrower than the rule allows
- **No retry of a failed case** anywhere: the runner has no retry option. A flaky case is
  fixed

## P-04 Secrets and Certificates: Made per Run, Kept per Run

**Carries**: NFR-U1-08, NFR-U1-19, NFR-U1-21.

```text
run start: mkdtemp (mode 0700)  ->  CA A (stub), CA B (untrusted), server certs (openssl, P-256)
per case:  secrets from crypto.randomBytes, sent as base64 bytes; files under the run dir
           with the mode the case needs (0600, 0604, 0440 ...)
run end:   remove the run dir (always, also on failure); nothing committed or printed
```

- The report shows a secret only as its length
- The CA's private keys never leave the run directory; the driver receives only the CA
  certificate path
- **Heap snapshots stay private** (the user, at approval, 2026-11-18T08:26:29Z). CDI-02's heap
  snapshot may hold the test secret when a driver fails the check, and the reference driver's
  `retain-secret` fault guarantees it does. The TypeScript driver **analyses the snapshot as a
  stream in memory**; if a file is ever needed, it is written **only inside the run's `0700`
  directory** and **deleted at the end of the case, pass or fail**. A snapshot is **never put in
  a report and never uploaded as a CI artifact**: no CI job uploads the run directory, and the
  workflow check fails on an upload step that names it. A failure report names **the case and
  the number of matches, never the content**

## P-05 Loopback-Only Stub with Connection Faults

**Carries**: NFR-U1-20; business rules PRB-08, PRB-09.

- Every listener binds `127.0.0.1` (and `::1` where present); no other interface
- **`refuse N`**: the listener is closed (or rejects) for the next N connection attempts, so
  nothing is sent: PRB-08's "not sent"
- **`reset`**: the stub reads the **whole** request (headers and declared body), records it,
  then destroys the socket with no response: PRB-09's "sent, no answer"
- The recording marks a reset request as *answered: none*, so a case can assert both that the
  first request arrived and that a retry followed

## P-06 Fail Closed

**Carries**: NFR-U1-09, -12, -31; SECURITY-15.

| Check | Fails closed when |
|---|---|
| Drift, remote half | `git ls-remote` or the shallow fetch fails, or a value differs |
| DCO | an unsigned commit's API lookup errors, is rate-limited, or lacks a field |
| Runner | a driver crashes, a stub listener fails to start, the link or fixture check fails, the loader rejects a case |
| Faults | a faulted run passes, or fails without naming its target |

No check has a "warn and continue" path.

## P-07 The CI Guard for Local-Only Flags

**Carries**: NFR-U1-13, -15, -16.

- `--offline` (drift check) and `--local-skip CC-SEC-05` (runner) are **refused when CI is
  detected**: the GitHub Actions indicators the hosted runner sets (`GITHUB_ACTIONS`, `CI`).
  Reading these is a detection, not configuration; no value from them changes behaviour except
  the refusal
- `--local-skip` accepts **exactly one case id, `CC-SEC-05`**; any other id is rejected
- A local skip prints the case id, "not run", and the reason; the run's summary repeats it, so
  a local pass with a skip never reads as a full pass

## P-08 The DCO Check: a Pure Function with Injected Readers

**Carries**: NFR-U1-29 to -32; OBL-01.

```text
tools/dco/check.ts
  check({ commits, readCommitMeta, readCommitApi }) -> { ok, lines[] }
    commits         : non-merge commits in base..head          (git rev-list --no-merges)
    readCommitMeta  : sha -> author name, email, message        (git)
    readCommitApi   : sha -> { authorLogin, verified } | error   (GitHub commit API)
  for each commit:
    signed off as its author            -> ok
    else readCommitApi(sha):
      error                             -> fail closed, name the commit and the error
      authorLogin == dependabot[bot]
        and verified == true            -> exempt
      else                              -> fail, name the expected Signed-off-by
```

- **In the workflow**: `actions/github-script` (pinned by SHA) loads the module and passes a
  `readCommitApi` built on its own `github` client, authenticated by the action's default
  `github-token` input. No token in an environment variable; job permissions
  `contents: read`. `actions/checkout` pinned by SHA with its tag in a comment; `ubuntu-24.04`
- **In tests** (Vitest, in CI): a **local git repository** built by the test holds the commit
  shapes (signed off, unsigned human, unsigned with a `[bot]` email, a merge); `readCommitApi`
  is a **stub returning recorded responses**: verified Dependabot, unverified `[bot]`, human,
  and an error. The five required outcomes plus the lookup error are each a test; none uses a
  real PR (NFR-U1-32)
- **Live confirmation**: the first real Dependabot PR into `dev` and the `dev` → `main` PR after
  it; their run IDs recorded (OBL-01)

## P-09 The Drift Check by git

**Carries**: NFR-U1-10 to -13; TS-U1-10.

```text
local:  hash every file under contract/ (SHA-256); compare with PIN.files; list differs,
        missing, extra
remote: git ls-remote https://github.com/soorma-ai/soorma-core refs/tags/contract-v0.1.0^{}
          -> peeled commit == PIN.commit
        git init (temporary, bare); git fetch --depth 1 <url> <PIN.commit>
          -> git rev-parse <PIN.commit>:contract == PIN.tree
```

- Anonymous HTTPS read: no token, no REST API, nothing from environment variables
- The temporary repository is removed after the check

## P-10 Supply-Chain Guards

**Carries**: NFR-U1-24 to -28.

- `pnpm install --frozen-lockfile` in every job; a lock-file change without its `package.json`
  change fails
- **Workflow check** (`tools/`): parses every workflow; fails on an action not pinned to a
  40-character SHA, a missing tag comment, `runs-on` other than `ubuntu-24.04`, or
  permissions wider than `contents: read` (at workflow or job level)
- `pnpm audit --audit-level moderate`; dependency review on pull requests; Dependabot
  (`.github/dependabot.yml`: npm and github-actions, weekly, `cooldown.default-days: 7`,
  `target-branch: dev`)
- **Packaging guard** (NFR-U1-23): fails if `conformance/` or `tools/` is listed in a package's
  published file list, or a package depends on them; inert until U3 adds the first package

## Compliance

- **Security**: no findings; the per-rule outcomes of NFR Requirements stand. P-04 (SECURITY-03,
  -12), P-05 (SECURITY-07 design-level), P-06 (SECURITY-15), P-08 and P-10 (SECURITY-10, -13)
  realise them
- **Invariants**: no change. I8 through P-10's packaging guard; I11 N/A
- **Specification-gap pass**: no new gap
