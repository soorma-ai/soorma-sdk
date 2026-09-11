# Contributing to soorma-sdk

Thanks for your interest. This repository holds the client harness SDKs for the
soorma.ai platform, in every language they ship in. It is [Apache
2.0](LICENSE), permanently.

**Before anything else:** this repository is design-first and currently has no
code. Until the first harness is designed and built, the most useful
contributions are questions and design discussion in issues rather than pull
requests.

## Sign your commits

Contributions are certified under the [Developer Certificate of
Origin](DCO). Sign off every commit:

```
git commit -s
```

That appends a single line:

```
Signed-off-by: Your Name <your.email@example.com>
```

The name and address must match the commit author. If you forget, fix the whole
branch with `git rebase --signoff origin/dev` and force-push. A check on each
pull request verifies it.

**There is no CLA here.** A contributor agreement exists to preserve the option
of relicensing under different terms, and this repository has already given that
option up: the harness is Apache 2.0 permanently. An agreement that buys nothing
is not worth asking anyone to read, so the DCO is used instead — it certifies
that you had the right to submit the work, which is the part that still matters.

`soorma-core` is licensed differently and does require a signed agreement. That
difference is deliberate, not an inconsistency.

### Third-party material

If a contribution contains anything you did not write yourself — vendored code,
a snippet from another project, generated output carrying its own terms — say so
in the pull request description, identify the source and its licence, and mark
it in the source file itself.

**Copyleft material cannot be accepted**, even though this repository is
permissively licensed. Harness code may migrate into `soorma-core`, which is
source-available rather than open source, and copyleft terms that are harmless
here would be a licensing defect there — expensive to unwind once it has shipped.
This is stricter than Apache 2.0 alone would require, and it is deliberate.

If you are unsure whether something qualifies, ask in the pull request rather
than omitting it. A disclosed dependency is a conversation; an undisclosed one
is a defect.

## What belongs in the harness

The single rule that governs everything here:

> **The harness enforces nothing.**

Tenants host their own agent compute. Any agent can ignore the SDK and call the
platform directly, so anything this code appears to enforce is advisory and the
platform independently re-checks it at the perimeter.

The failure mode to watch for is subtle and cumulative: an SDK convenience that
the platform comes to depend on. The clearest case is envelope construction — if
the SDK builds the envelope and the perimeter does not independently validate
it, the SDK has become enforcement. Convenience is fine. Being load-bearing is
not.

Two consequences worth holding onto:

- **A deployed SDK cannot be force-upgraded.** Tenants run their own agents on
  their own schedule, so every version you ship stays in the field indefinitely.
  Compatibility is not a nicety here.
- **Server-side capability belongs in `soorma-core`**, not here. If a change
  wants the platform to trust something the SDK computed, it is in the wrong
  repository.

## Making a change

1. **Open an issue first** for anything beyond a small fix — particularly
   anything touching the wire contract, identity, or the enforcement boundary
   above.
2. **Branch from `dev`.** Pull requests target `dev`, not `main`.
3. **Sign off every commit.**
4. **Include tests.** New behaviour needs coverage; changed behaviour needs its
   tests updated.
5. **Keep the wire contract backward compatible**, or state the migration
   explicitly in the pull request. A silent break surfaces in someone else's
   agent, running a version you cannot upgrade.
6. **Keep languages consistent.** A behaviour that exists in one SDK and not
   another is a defect in the one that lacks it, unless the difference is
   documented and deliberate.
7. **Update the docs** that your change makes wrong.

## Reporting bugs

Open an issue with the SDK language and version, what you expected, what
happened, and the smallest reproduction you can manage. For anything
security-sensitive, do not open a public issue — email founders@soorma.ai
instead.
