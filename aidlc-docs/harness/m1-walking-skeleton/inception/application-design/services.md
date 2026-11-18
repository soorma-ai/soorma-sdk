# Services and Orchestration — soorma-sdk, M1

A client library deploys no service. "Service" here means the orchestration that ties
components together: inside a client (S-1 to S-4), in the conformance suite (S-5), and in the
end-to-end and CI runs (S-6, S-7). Timing values (renewal headroom, the retry bound) are NFR
Requirements'.

---

## S-1 Client Lifecycle (C-11)

```text
created --start()--> starting --bootstrap ok--> running --close()--> closed
                         |                         |
                         | bootstrap Problem       | renewal: credential_refused
                         v                         v
                      failed                    revoked (terminal)
```

- **created**: options held; nothing contacted (US-01 #1)
- **starting**: one secret-provider call, one bootstrap (S-2). A `503` is retried within the
  bound; `403 authentication_failed` and `429 too_many_attempts` end `start()` with a
  `ProblemError` and leave the client restartable by a new `start()` call
- **running**: publish and subscribe allowed; renewal scheduled (S-2)
- **revoked**: terminal (PF FR-011). Every open subscription yields a terminal
  `StreamEnded`; later calls raise `ClientStateError` carrying the Problem. The SDK never
  bootstraps around a revocation
- **closed**: every stream, timer and connection released

## S-2 Credential Orchestration (C-13, C-14, C-15)

1. **Bootstrap**: call the secret provider once → `POST /agent-credentials` with
   `{ agent, secret, instance }` and `Soorma-Contract-Version: 0.1.0`, no `Authorization`, no
   envelope → drop the secret reference → hold the credential in memory
2. **Schedule renewal** from `expiresAt` minus headroom (NFR-02)
3. **Renew**: `POST /agent-credentials/current/renewal` with the current credential, no body →
   replace the held credential → announce it (S-3)
4. **Lineage end**: renewal answers `401 credential_expired` (the 24-hour lineage cap) →
   bootstrap again (step 1, a new provider call) → announce the new credential
5. **Revocation**: `credential_refused` on renewal → stop; the client is revoked (S-1)
6. **Unavailable**: `503` on bootstrap or renewal → retry after `Retry-After`, within the
   bound; past the bound, the `ProblemError` is surfaced, and while the credential is still
   valid it is kept

## S-3 Stream Supervision across Renewal (C-17)

```text
subscribe()
  -> open stream 1 with credential c1        yield StreamStarted
  -> deliveries ...                          yield Delivery | DeliveryError
  new credential c1' (renewal, same lineage)
  -> open stream 2 with c1'                  yield StreamStarted
  -> stream 1 ends: end superseded           yield StreamEnded(code "superseded", terminal false)
  new credential c2 (re-bootstrap, new lineage)
  -> open stream 3 with c2                   yield StreamStarted
  -> stream 2 ends: end credential_expired   yield StreamEnded(code "credential_expired", terminal false)
  revocation
  -> stream ends: end credential_refused     yield StreamEnded(code "credential_refused", terminal true)
  -> iterator finishes
```

- Items are yielded in the order the SDK observes them; the exact interleaving of a
  replacement's *started* and the old stream's *ended* is Functional Design's, under the rule
  that both are always yielded
- Nothing promises continuity between streams: no `Last-Event-ID`, no replay, and the
  documentation says so (GAP-INT-001)
- A dropped connection yields `StreamEnded(code null)`; the supervisor then subscribes again
  while the credential is valid (a `503` retried within the bound), yielding `StreamStarted`
- `unavailable` and `overflow` ends are not terminal; `credential_refused` is; an unknown code
  is surfaced, and whether the supervisor opens a new stream after it is Functional Design's

## S-4 Publishing and Forwarding (C-15, C-16, C-18, C-19)

1. `publish(payload)` on the client, or `delivery.publish(payload)` (forwarding)
2. Tracing starts the publish span; the draft builder takes its context as this hop's
   `traceparent` (or generates valid identifiers when no OpenTelemetry SDK is installed)
3. When forwarding: `inbound: { envelope: <received text, byte for byte>, seal }`
4. `POST /events` with `{ draft, payload }`, compact JSON, the current credential
5. `202` → `PublishAccepted` (accepted, not delivered). Any Problem → `ProblemError`, **never
   retried** (D-11), and the span records the error

## S-5 Conformance Orchestration (C-03, C-21; Q8 A)

```text
runner
  1. make a CA and a server certificate for this run
  2. start the stub (S3, S4 over TLS)
  3. start the language's driver (command given on the command line)
  for each case:
    4. load the case's scripted responses into the stub
    5. send the case's commands to the driver; collect observations
    6. assert: observations, and the requests the stub recorded (byte for byte where the
       case says so)
  7. fail if any case failed or was skipped, or if any specification statement has no case
```

- One runner, one stub, one set of assertions: the languages cannot be judged differently
- Timing cases use short `expiresAt` values from the stub, not a fake clock
- CI runs it per language, on each supported runtime (Node 24 and 26; Python 3.11 and the
  newest release)

## S-6 End-to-End Orchestration (C-05, C-22; Q9 X)

The same steps in CI and locally. Every run uses a fresh stack.

| Step | Command | What happens |
|---|---|---|
| 1 | `e2e/core-up` | Refuses if a `soorma-local` Compose project or its volumes exist. Removes any old clone; clones `soorma-ai/soorma-core` at `contract-v0.1.0` (depth 1) into `.e2e/soorma-core/`; **fails unless `HEAD` is `c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d`**. With soorma-core's pinned Node 26.13.0 and pnpm 12.18.0: `pnpm install --frozen-lockfile`; `docker build -f services/<s>/Dockerfile -t soorma/<s>:local .` for `org-gateway`, `control-gateway`, `data-gateway`, `event-ingest`; `pnpm stack:init`; `pnpm stack:up`. Writes the single-use fresh-stack marker |
| 2 | `e2e/setup` | Consumes the marker (refuses without it). Raw HTTPS calls trusting the clone's `deploy/local/.secrets/stack-ca.pem`: first authentication at S1 (`:8441`) with the enrollment material from `deploy/local/.secrets/handover/first-admin-1.txt` and a new human secret generated in memory; sign-in; an environment credential from E's S2 (`:8442`); a self-grant of `agent:register`, `event:publish`, `event:subscribe`; agents A and B registered with standing permissions `event:publish`, `event:subscribe` and autonomy declared; one registration secret each, written to `<dir>/<agent>.secret` (mode `0600`; `<dir>` mode `0700`). Ends the environment credential and the sign-in. Writes no human secret or credential; prints no secret |
| 3 | the scenario, per language | Each agent process: `fileSecret('<dir>/<agent>.secret')`, S3 `https://localhost:8444`, S4 `https://localhost:8446`, the clone's CA. B subscribes; A publishes; B receives; the test-installed exporter holds the span whose trace id matches B's envelope (*done when* 2, 3, 5) |
| 4 | the example, per language | The same set-up feeds the example's configuration block (US-11 #1) |
| 5 | `e2e/core-down` | `docker compose -f .e2e/soorma-core/deploy/local/compose.yaml down -v`; removes the clone. Always runs, on success or failure; the stack's logs are shown first on failure |

**Why every run is fresh**: the first authentication from the handover file works once; a
second `e2e/setup` against the same stack would fail, and a stack left from an earlier run
holds earlier agents. The marker makes "setup after a fresh core-up" a checked rule, not a
habit.

**Local side effects, stated in the README**: `core-up` builds the `soorma/*:local` images,
replacing any a developer built from a soorma-core working tree, and uses the `soorma-local`
Compose project and loopback ports 8441 to 8447; it refuses rather than stop a stack it did
not start.

## S-7 CI Orchestration (C-06; Q9 X)

```text
on:  pull_request
     push to dev                     (not main: a PR's run tested the merge result)

changes        computes the diff (pull request: base..test merge; push: before..head);
               output e2e=false only when the diff is computable, non-empty, and every
               path is under aidlc-docs/; anything else: e2e=true (soorma-core #26)
checks         contract drift, generated types, names, SPDX
typescript     Node 24 and 26: install, build, lint, unit tests, conformance (TS driver)
python         3.11 and newest: install, lint, unit tests, conformance (Python driver)
e2e-typescript needs: changes; if: needs.changes.outputs.e2e == 'true'
               S-6 on a fresh stack; the SDK on Node 24
e2e-python     needs: changes; if: needs.changes.outputs.e2e == 'true'
               S-6 on a fresh stack; the SDK on Python 3.11
dco            the existing workflow
```

- One stack per end-to-end job: delivery is live only and reaches every stream open in the
  environment, so a shared stack would mix one language's events into the other's stream
- The end-to-end jobs run soorma-core's tools on its pinned Node 26.13.0 and the SDK on the
  oldest supported runtime; how one runner holds both is Code Generation's
- Whether the non-end-to-end jobs also skip pushes to `main` follows the same pattern by
  default; Code Generation confirms it with the workflow
- **Expected CI time added per end-to-end job**: about **3 to 5 minutes** to bring soorma-core
  up, and under a minute for the set-up and the scenario. Basis: soorma-core's run at the
  tag's commit (run 43391996560: S1 image 28 s, S2 to S4 about 6 s each, `stack:init` 1 s,
  `stack:up` 20 s), plus a cold `pnpm install` and clone here. The two jobs run in parallel:
  wall time about 4 to 6 minutes, runner time twice that. **Measured at the first code PR**
  and recorded; past 8 minutes, NFR Design revisits it (for example, caching the images)
