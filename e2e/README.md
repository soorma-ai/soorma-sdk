<!-- SPDX-License-Identifier: Apache-2.0 -->

# The end-to-end stack

Four commands bring up a fresh **soorma-core at `contract-v0.1.0+core.2`**, register the agents the
end-to-end tests use, prove the stack works, and take it down. They are test infrastructure: no
package imports `e2e/`, and the packaging guard keeps it out of every package. How to run them,
and what they do to your machine, is in the [repository README](../README.md#the-end-to-end-stack).
The rules below are from the U2 design (`aidlc-docs/harness/m1-walking-skeleton/construction/e2e-stack/`).

| Command                                         | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm e2e:core-up --core-node <node 26.13.0>`   | Refuses an earlier run's leftovers or a `soorma-local` stack it did not start; checks Docker Engine 26+, Compose 2.26.0+, `git` and the Node; writes `.e2e/owner.json`; clones soorma-core at the tag from `contract.pin.json` and refuses any other commit; refuses a clone that would run dependency install scripts or needs another toolchain; installs, builds the four images and runs `stack:init` and `stack:up` exactly as soorma-core's CI does; writes `.e2e/fresh-stack` last |
| `pnpm e2e:setup --agents a,b [--secrets-dir d]` | Uses up the fresh-stack marker (one `setup` per stack). As the first Admin: first authentication with a new human secret used once, which gives the only sign-in; the environment credential; the self-grant; per agent, a registration and a registration secret written to `<dir>/<agent>.secret` (`0600`). Then ends the environment credential and the sign-in **and checks each is refused**, also after a failure. Writes `.e2e/stack.json` last                                    |
| `pnpm e2e:prove-stack`                          | Per agent, one raw `POST /agent-credentials` with its secret file, expecting the contract's `200` for that agent and environment. The credential is dropped; the secret is not used up                                                                                                                                                                                                                                                                                                    |
| `pnpm e2e:core-down [--logs]`                   | Only with `.e2e/owner.json`. **Searches every service's log**, then `down -v`, then clears `.e2e/`, the record last                                                                                                                                                                                                                                                                                                                                                                       |

## Rules a maintainer must keep

- **No secret or credential** is printed, logged, put in an argument or an environment variable,
  or written anywhere but an agent's own secret file. Child processes get no secret.
- **The `.e2e/fresh-stack` marker is single use.** After any failure the remedy is `core-down`,
  then `core-up`. Nothing is retried.
- **The ownership record** is written before anything is created and removed last; a teardown that
  fails or times out keeps it, so `core-down` can be run again and `core-up` keeps refusing.
- **Every raw call has a 30 s limit, and every child step its own limit** (`src/stack.ts`). A
  limit that runs out is a failure, naming the step.
- **The log search** reads the typed prefixes from the vendored
  [`contract/conventions/credentials.md`](../contract/conventions/credentials.md), never a list in
  code, and also searches for each agent secret and enrollment material by its exact value. It
  runs on **every** `core-down`. Its outcomes:
  - **clean**: with `--logs`, the logs are printed; without it, one line per service
  - **hit**: no log is printed; the service and the kind are named, never the value; the stack is
    still taken down; the command fails. It is a soorma-core logging defect: raise it as a
    soorma-core issue naming the service and the tag, without the value. It is never worked
    around here (for example by filtering logs)
  - **unreadable** (a log, a secret file, the handover directory, the contract file): no log is
    printed, and the command fails
  - the human secret is not searchable: it is never on disk and has no prefix
- **Values are soorma-core's local stack's** (`src/stack.ts`): organization `o1`, project `p1`,
  environment `e`, principal `h@example.com`, ports 8441 (S1), 8442 (E's S2), 8444 (S3), 8446
  (S4). They hold because `core-up` refuses any other commit.

## Tests

Everything that needs no stack runs in the `unit` job (`pnpm test`): the log search against
recorded log text, `core-up` and `core-down` with fake `docker`, `git`, `pnpm` and Node
(`test-fixtures/fake-command.mjs`), `setup` and `prove-stack` against a fake S1, S2 and S3 that
checks every request and response against the vendored contract (`test-fixtures/fake-stack.ts`),
and the CI jobs' own scripts. The `e2e-typescript` job runs the four commands on a real stack, with
the TypeScript scenario (`typescript/e2e/`) after `prove-stack`.
