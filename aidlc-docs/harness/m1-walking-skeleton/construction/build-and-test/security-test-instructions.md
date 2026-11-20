# Security Test Instructions

The security baseline is enabled with deployment context `local-only`. soorma-sdk deploys
nothing; its security tests are the SDKs' own behaviour (secrets, credentials, TLS, logs), the
dependency audits, and the CI's supply-chain checks. The *(hosted)* clauses are carried
(`aidlc-state.md`, *Carried Security Obligations*).

## 1. Dependency vulnerability scanning

```sh
pnpm audit --audit-level moderate && pnpm check:audit-exceptions
(cd python && scripts/audit.sh)       # pip-audit over every resolution in uv.lock: dev + otel-latest, dev + otel-floor
```

- Expected: `pnpm audit` passes with only registered exceptions (`DEPENDENCIES.md`; each
  self-expiring), and `audit exceptions: every exception is still needed and registered`;
  pip-audit `No known vulnerabilities found` for both resolutions, with no accepted advisory.
- CI also runs GitHub's dependency review on pull requests, and Dependabot (npm, actions, uv)
  weekly after a 7-day cooldown.

## 2. Secrets and credentials (both SDKs, through the conformance suite)

| What | Cases |
|---|---|
| The secret file: owner-only or group-read, links followed, unsafe modes and a foreign owner refused without reading, special files refused without blocking | CC-SEC-03 to CC-SEC-07 (CC-SEC-05 needs the second user: CI); Windows refused: each package's unit tests (TC-PH-067 for Python) |
| No secret retained after bootstrap (TypeScript: a heap snapshot; Python: `sys.getrefcount`), per attempt | CC-SEC-01, CC-ACQ-08 |
| The credential unreachable, and never in an error, string form or log; presented once, as a bearer header | CC-CRD-01, CC-CRD-02, CC-CRD-03 |
| No environment variable or host read; no provider reads one | CC-CFG-06, CC-SEC-02 (and each package's static check) |
| Credentials sent to S3 and S4 only | CC-CFG-03 |
| No human credential; no control-face call | CC-NEV-01 |

## 3. TLS

- A supplied CA is trusted (CC-CFG-04); an untrusted certificate fails before any body is sent
  (CC-CFG-05). No option turns verification off: an unknown option is a `TypeError` (TC-PH-074,
  and U3's option tests).
- Python keeps `VERIFY_X509_STRICT` on 3.13+ (`python/tests/test_transport.py`); an AST check
  finds no assignment to `verify_flags`, `check_hostname` or `verify_mode`, no `CERT_NONE` and no
  unverified context.

## 4. Hostile input

- The Python HTTP parser: bounds, malformed framing, and a seeded fuzz test (`test_http.py`).
- The delivery readers: iterative, strict JSON; too deep, duplicate members, `NaN`, an integer
  past Python's digit limit (TC-PH-079): CC-RCV-01 to CC-RCV-10 and the unit tests.

## 5. Logs on the real stack

`pnpm e2e:core-down` searches every soorma-core service's log for the run's credentials and
secrets before it removes the stack, and fails on a match or an unreadable log (U2, LS rules).

## 6. CI supply chain

`pnpm checks`'s workflows check: every action pinned by commit SHA, `ubuntu-24.04`,
`contents: read`, no run-directory upload, no repository secret in an end-to-end job. The DCO
check reads every non-merge commit's sign-off.
