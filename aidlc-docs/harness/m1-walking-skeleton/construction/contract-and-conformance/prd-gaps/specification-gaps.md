# Specification Gaps — U1 `contract-and-conformance`

Gaps found while building U1, qualified by repository whenever they leave this initiative
(soorma-sdk GAP-CAC-001). Classified per `prd-gap-classification.md`.

## GAP-CAC-001: Whether a renewal leaves the previous agent token valid

**Raised**: 2026-11-18T07:17:08Z
**Stage**: Functional Design (U1), on the user's correction to DEC-U1-10
**Raised against**: soorma-core wire contract @ `contract-v0.1.0` (`data-gateway.openapi.yaml` `renewAgentCredential`; `conventions/credentials.md`). PRD context: PF @ `prd-platform-foundations-v1.3` §11 *Renew credential*, §14 *Credential renewal*
**PRD section**: PF §14 (the renewal precondition, a still-valid credential, "is part of the contract"); no section addresses the previous token's validity after a renewal
**Owner**: the soorma-core initiative (the wire contract); the Identity and Platform Foundations PRDs if it is a PRD-level rule
**Unit**: contract-and-conformance (U1); implemented in typescript-harness (U3), python-harness (U4)
**Issue**: soorma-ai/soorma-core#34: https://github.com/soorma-ai/soorma-core/issues/34 (opened 2026-11-18T07:25:27Z; routing A, the user, 2026-11-18T07:24:45Z)
**Resolved by**: —

### What the build needs

A renewal request may be written and then lose its answer (a reset, or a timeout after
writing). The user's DEC-U1-10 retries renewal in that case while the current credential is
unexpired. If the lost renewal succeeded, the retry presents the **previous** token. The SDK
must know what the platform does with it:

- if the previous token stays valid until its own expiry, the retry succeeds and nothing is lost
- if a renewal invalidates the previous token, the retry is refused, most likely with
  `401 credential_refused`, which REN-05 treats as **terminal revocation**: the client stops,
  wrongly

Blocked without the answer: whether REN-05's terminal rule may apply to a `credential_refused`
that answers a **retried** renewal.

### What the contract says

`renewAgentCredential`: "A new token for the same credential: the same agent, environment, and
instance, with a later expiresAt, never past the credential's maximum age. Refused once the
credential or its agent is revoked." `credentials.md`: "valid for at most 15 minutes from its
bootstrap or its latest renewal". Nothing states whether a token issued before the latest
renewal remains valid.

### Why this is specification, not technology

It is a fact about the platform's behaviour, not a client choice: two engineers could not both
be right about what the platform answers. The contract is the interface a client builds
against, and its shape here changes what a client must build (whether a refused retry is
terminal). An implementation reading of soorma-core's code is not the contract and is not
relied on.

### Options considered

1. **The previous token stays valid until its own expiry** (stated in the contract): the retry
   is safe; `credential_refused` on a retry is a real revocation, terminal as REN-05
2. **A renewal invalidates the previous token, and the platform answers a superseded token
   with a distinct code** (for example `credential_superseded`): the SDK can tell it from a
   revocation and keep the newer token it never received by bootstrapping again
3. **A renewal invalidates the previous token, with no distinct code**: the SDK should not
   retry a sent renewal at all; it bootstraps a new lineage instead (a provider call and an
   abuse-bound attempt)

### Blocked

U1 Functional Design: PRB-09's renewal clause and REN-05 as applied to a retried renewal. Not
blocked: everything else in U1. **Work-around in place until answered**: a `credential_refused`
answering a retried renewal is treated as REN-05 says (terminal; fail closed; never
bootstrapping around a possible revocation). The cost, if option 2 or 3 turns out to be the
platform's behaviour, is a rare false stop after a lost renewal response, which tenant code
sees as a terminal `ClientStateError` and a terminal *stream ended*.

**Status**: Open: raised against soorma-core's wire contract (soorma-ai/soorma-core#34); worked around (a `credential_refused` answering a retried renewal is terminal; fail closed)
