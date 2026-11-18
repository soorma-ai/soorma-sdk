# Invariant Coverage Matrix — U2 `e2e-stack`

**Invariants source**: soorma-prd `references/platform/invariants.md` @
`prd-platform-foundations-v1.3` and @ `prd-identity-v1.0` (text identical at both tags,
SHA-256 `c66c0170…`; Extension Configuration).
**PRD compliance tables**: PF §15 @ `prd-platform-foundations-v1.3` (all eleven Addressed); ID §15
@ `prd-identity-v1.0` (I1 to I11 Addressed).

**How U2 carries the invariants**: U2 is test infrastructure (ordinary shape). It calls the
platform directly, without the SDK: the control faces S1 and S2 for the human set-up, and S3 once
per agent for the stack proof. Its code-level risk is that raw calls, or what they set up, leak
into the SDK or the examples, or that the set-up depends on something other than the presented
credential. The platform's own enforcement is soorma-core's, used as built at the tag.

| Code | PRD Status | Applies to Unit | Code-Level Risk in This Unit | Implementation Target | Verification Target | Status |
|---|---|---|---|---|---|---|
| I1 Isolation | Addressed | Yes | Registering in one environment and handing the language jobs another's addresses (E2's S2 is 8443, its S3 8445) | GEN-05 (E's ports only), ST-06 (E's S2), E-07 (E's S3 and S4 in the stack description) | TC-ES-007: agents registered at E's S2 bootstrap at E's S3; a mismatch fails it | Covered |
| I2 Perimeter enforcement | Addressed | Yes, cumulatively | A raw helper becoming something the SDK or the examples rely on, so a check exists only in test code | GEN-03 (`e2e/` outside both packages, imported by no package code); U2 enforces nothing: every check on its calls is the platform's | U1's packaging guard extended to `e2e/` (business-logic-model §6); the cumulative check: no package imports `e2e/` | Covered |
| I3 Portable credential | Addressed | Yes | Identifying an agent by host or position instead of its secret; an instance id derived from the machine | PS-02 (the proof presents the secret; instance `e2e-proof`, fixed, not from the host); ST-07 | TC-ES-007 | Covered |
| I4 Attribution recoverable | Addressed | N/A for this unit | — | — | — | N/A for this unit: U2 writes no governed record; registrations and grants are written by soorma-core, which records sponsor and actor |
| I5 Monotonic authority | Addressed | Yes | Granting agents more than the scenario's agent needs; asking for re-broadening | ST-07 (standing set `event:publish`, `event:subscribe`; no re-broadening declaration); the sponsor's grant limited to the three permissions the set-up needs (ST-06) | TC-ES-004 (registration `200` means S2 found the set within the sponsor's ceiling) | Covered |
| I6 Two faces | Addressed | Yes | A control-face call reachable from the SDK or an example agent | GEN-03; the unit's ordinary shape (Units Generation: raw control-face calls in test infrastructure no agent code links); US-11 #4 (the human set-up in a separate script) | Packaging guard; U3's and U4's example checks (US-11 #4) | Covered |
| I7 Contract compatibility | Addressed | Yes | Running against a stack that is not the contract's tag; calls without the contract version | CU-05 (commit check from `contract.pin.json`), GEN-04 (`Soorma-Contract-Version: 0.1.0`), PS-02 (the response validated against the contract's schema) | TC-ES-002; TC-ES-007 | Covered |
| I8 Packaging rule | Addressed | Yes | Test infrastructure landing in a package | GEN-03; the packaging table below | The packaging guard with `e2e/` (business-logic-model §6) | Covered |
| I9 Mechanism, not instance | Addressed | Yes | Tenant-like names outside labelled fixtures | GEN-05: `o1`, `p1`, `e`, `h@example.com` are soorma-core's local stack's, at the tag; `agent-a`, `agent-b` are CI arguments; none appears in SDK code | Review at Code Generation: the constants sit in `e2e/` only, labelled as the local stack's | Covered |
| I10 Runtime-later | Addressed | Yes | Depending on how or where the stack runs (Compose, a host) beyond bringing it up | Nothing in U2's set-up or proof keys on topology: identity is the presented secret (PS-02), scope is the configured environment (GEN-05). Compose is how this test infrastructure runs soorma-core, not something the SDK sees | Statement; Code Generation confirms | Covered |
| I11 No technology selection | Addressed | N/A | — | — | — | N/A: Construction is where technology is selected; this invariant constrains the PRD |

**Result** (Functional Design): 9 Covered, 1 N/A for this unit (I4, with reason), 1 N/A by design
(I11), **0 Missing**.

## I8 Packaging Table — U2

| Capability implemented | PRD edition assignment | Repository | Notes |
| --- | --- | --- | --- |
| The end-to-end stack commands (`core-up`, `setup`, `prove-stack`, `core-down`) and the log search | Not a product capability: test infrastructure | soorma-sdk | In no package; the packaging guard keeps `e2e/` out |
| The end-to-end job skeleton | Not a product capability: repository tooling | soorma-sdk | Private |

No commercial capability exists in U2 in any form; nothing in U2 lands in soorma-core.
