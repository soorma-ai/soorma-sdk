# soorma-sdk

The client harness SDKs for the soorma.ai platform, in every language they ship
in.

> **Early construction.** Built so far: the language-neutral layer every language
> package is judged against: the vendored wire contract, the harness behaviour
> specification, the conformance suite, and the repository checks. The TypeScript
> and Python packages follow.

## What this is

A **harness** is the SDK a tenant embeds in each agent. It owns the agent's loop
and mediates its I/O — inversion of control, so the harness invokes the agent
rather than the reverse. It is client-side, per-agent, and in the hot path.

It **enforces nothing.** Tenants host their own agent compute, so an agent can
bypass the SDK and call the platform directly whenever it likes. Everything the
harness appears to enforce is advisory, and every mechanism that actually holds
is server-side, in
[`soorma-core`](https://github.com/soorma-ai/soorma-core).

The harness exists for developer convenience and consistency. Treat anything it
does as a courtesy the platform independently re-checks.

## What is here

| Path | What it is |
| --- | --- |
| [`contract/`](contract/) | soorma-core's wire contract at `contract-v0.1.0`, byte for byte; never edited (see [`contract.md`](contract.md)) |
| [`spec/`](spec/) | The [behaviour specification](spec/behaviour.md) every language implements, and the [name table](spec/names.md) |
| [`conformance/`](conformance/) | The conformance suite: cases, runner, stub, and the test-only reference driver ([README](conformance/README.md)) |
| [`tools/`](tools/) | Repository checks: contract drift, SPDX, workflows, generated types, names, packaging, DCO, audit exceptions |
| [`DEPENDENCIES.md`](DEPENDENCIES.md) | Every exception to the dependency policy |

## Working on it

The toolchain is pinned: **Node.js 24.22.3** (`.node-version`) and **pnpm 12.18.0**
(`packageManager`); install pnpm without Corepack.

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test                    # unit tests (Vitest)
pnpm checks                  # repository checks; the drift check reads soorma-core by git
pnpm checks --offline        # locally only: the drift check's local half; refused in CI
pnpm conformance:self-test   # the reference driver, then the four negative controls
pnpm audit --audit-level moderate && pnpm check:audit-exceptions
```

The conformance suite runs on Linux and macOS (it needs the `openssl` CLI); Windows is not
supported in M1. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of these on
pull requests and pushes to `dev`, with every action pinned by commit SHA, `ubuntu-24.04`, and
read-only permissions.

**Sign-off and Dependabot.** Every commit carries a `Signed-off-by` matching its author
([`dco.yml`](.github/workflows/dco.yml)). The one exemption is a commit GitHub's API reports as
authored by `dependabot[bot]` **and** verified (GitHub signs Dependabot's commits); a failed
lookup fails the check. Dependabot updates npm packages and actions weekly, after a 7-day
cooldown, into `dev`.

## Licence

[**Apache 2.0**](LICENSE), permanently — chosen over MIT for its express patent
grant and retaliation clause, which is what enterprise review looks for in a
dependency compiled into their own systems.

`soorma-core` is source-available under different terms. A use restriction on
the harness would reach into tenant systems while defending nothing, because the
harness enforces nothing and every mechanism worth protecting is server-side. So
the architectural split is also the licensing split, and this side stays
permissive in every language it ships in.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Contributions are certified under the
[Developer Certificate of Origin](DCO) — sign off each commit with
`git commit -s`. There is no agreement to sign.

For anything security-sensitive, email founders@soorma.ai rather than opening a
public issue.
