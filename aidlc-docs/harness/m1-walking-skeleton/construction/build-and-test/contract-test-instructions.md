# Contract Test Instructions: the Conformance Suite

soorma-sdk consumes soorma-core's wire contract at `contract-v0.1.0` (`c1e3d7f`) and owns none
of its own. Contract testing here has three layers.

## 1. The contract is the tag's, byte for byte

```sh
pnpm checks           # contract drift: the local half (234 pinned files) and the remote half (git, unauthenticated)
pnpm checks --offline # locally only: the local half
```

Expected: `ok    contract drift: local half: 234 pinned files checked; remote half:
contract-v0.1.0 -> c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d, contract/ tree 38900083…`.
`generated types: 2 package(s)` checks that each package's generated types equal its
generator's output from `contract/`.

## 2. Each SDK against U1's specification: the conformance suite

97 cases (`conformance/cases/`), each naming its statements in `spec/behaviour.md` (105
statements in 16 areas), the contract fixtures it uses, a stub script, driver commands and
assertions. The runner (`conformance/runner/`) starts the stub (`conformance/stub/`) as S3 and
S4 per case, with a fresh CA, and drives the SDK through its driver (`conformance/README.md`,
*The driver protocol*). Each case runs in a new driver process.

| Driver | Command (locally; CI passes `--foreign-user` and skips nothing) |
|---|---|
| TypeScript (U3) | `pnpm conformance run --driver "node --expose-gc typescript/conformance-driver/driver.ts" --local-skip CC-SEC-05` |
| Python (U4) | `pnpm conformance run --driver "python/.venv/bin/python python/conformance_driver/driver.py" --local-skip CC-SEC-05` |

- **Expected**: `conformance full (<language>): 96 passed, 0 failed, 1 not run` locally;
  `97 passed, 0 failed, 0 not run` in CI. Full mode fails on any skip except an explicit local
  `--local-skip`, which CI refuses.
- **CC-SEC-05** needs a second local user to own a file (OBL-04): CI's jobs create
  `soorma-foreign` with `sudo useradd` and pass `--foreign-user soorma-foreign`.
- **Budget**: 5 minutes per driver per runtime; the runner fails a run over budget, naming the
  slowest cases.
- **A failing case** is judged first (CDI-05): the SDK, the driver, the case (an F42 change,
  recorded, class 3 stopping for the user), or the specification (a specification question).
  Never edit a case quietly.

## 3. The suite tests itself: the reference driver and the negative controls

```sh
pnpm conformance:self-test
```

The test-only reference driver passes its 27 declared cases; then four faults, each injected
into the reference driver, must fail exactly the cases declared for them:

| Fault | Declared failing cases |
|---|---|
| `retain-secret` | CC-SEC-01 |
| `reorder-forwarded-envelope` | CC-FWD-02, CC-RCV-06 |
| `retry-publish` | CC-PRB-01, CC-PUB-03 |
| `skip-boundary` | CC-STR-04 |

Budget: 8 minutes. Expected: each fault `-> as declared`, `RESULT: pass`.

## 4. The name table

`pnpm checks`'s names check: every exported name and settable member of each package equals its
language's column of `spec/names.md` (protocol idioms aside). Needs the TypeScript package built
first.
