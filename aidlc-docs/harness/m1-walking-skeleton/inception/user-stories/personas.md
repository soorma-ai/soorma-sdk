# Personas — soorma-sdk, M1

Two personas (story plan Q1 A). Both are language-neutral: what each needs is the same in
TypeScript and Python, and the stories hold in both (Q3 A).

---

## P1 — Agent developer

**Who**: a developer at a tenant building an agentic system on soorma.ai. PF FR-023 names this
principal for the harness surface. They write the code an agent instance runs, on the tenant's
own compute (PF §1, *fabric now, managed runtime later*).

**What they build with the SDK**: agents that bootstrap, keep a credential alive, publish
events, subscribe and act on what arrives, forward inbound context when they act, and show up
in the tenant's own tracing.

**What they are given, by someone else**: a registered logical agent identifier and a
registration secret per agent, issued by a human through the platform's control face (*done
when* 1, soorma-core's), plus the S3 and S4 addresses of one environment and, locally, the
stack's CA.

**What they need from the SDK**:
- the six PF §11 operations, with the platform's rules handled for them: renewal timing,
  re-bootstrap at the end of a lineage, compact JSON, exact forwarding
- every failure the platform can report, surfaced in a form their code can act on, including
  codes the SDK has never seen
- honesty about what is not promised: delivery is live only (GAP-INT-001); the span shape is
  unstable (GAP-INT-002)
- a starting point: an example they can copy into a new agent (in TypeScript first, for
  example apps)

**What they must never be able to do through the SDK**:
- hold, request or present a human's credential (OB-19; ID §11 *Prohibitions*)
- set a platform-stamped envelope field (PF §11 *What the SDK may not populate*)
- configure or assert an environment: scope comes from the credential (PF FR-022)
- rely on the SDK for any check: the platform enforces everything, with or without the SDK
  (PF FR-023)

**How they meet the SDK**: install the package from this repository (D-05), start from the
example (FR-20), read the behaviour specification when the API alone doesn't say enough.

---

## P2 — SDK maintainer

**Who**: whoever keeps the language packages in step: today the soorma-sdk team; later,
whoever adds a third language.

**What they own**:
- the vendored contract at its pinned tag, and the check that it has not drifted (FR-01)
- the harness behaviour specification, the single statement of what every language does
  (FR-02)
- the conformance suite every language must pass (FR-03)

**What they need**:
- one place to change behaviour, so that two packages cannot drift apart
- a failing check, not a review comment, when a language diverges or the contract copy differs
  from its tag
- a clear route when the contract is insufficient: raise it against the soorma-core
  initiative, never patch the copy (brief, *Order and the shared contract*)

**What they must never do**: edit the vendored contract by hand; add behaviour to one language
that the specification and the conformance suite do not state.

---

## Persona to Story Map

| Persona | Stories |
|---|---|
| P1 Agent developer | US-01 to US-11 |
| P2 SDK maintainer | US-12 to US-14 |
