# soorma-sdk

The client harness SDKs for the soorma.ai platform, in every language they ship
in.

> **Nothing is built yet.** This repository currently holds its licence and its
> contribution terms. Code lands against a settled harness design.

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
