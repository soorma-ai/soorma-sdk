# L1 Coverage Matrix — U2 `e2e-stack`

**L1 sources** (from `## PRD Intake`, the most authoritative): PF @
`prd-platform-foundations-v1.3`, the rows U1's matrix lists (§7b, FR-004 to FR-006, §9, §11,
§17). ID @ `prd-identity-v1.0`: no L1 source; its §11 prohibitions bind as constraints.

**How U2 covers L1**: U2 builds no SDK behaviour. It brings up the platform that implements L1
and does the human set-up the scenario needs. So a row applies to U2 only where U2's own calls
touch it; the **implementation target** is the command and rule that makes the call, and the
**verification target** is the test case or CI step that shows it. Rows numbered as in U1's
matrix, so the two read together.

| # | L1 requirement (source) | Applies | Implementation target | Verification target | Status |
|---|---|---|---|---|---|
| L1-12 | Exchange bootstrap material: startup, once per instance (PF §9 *Operations*; §11 *Acquire credential*) | Yes, as the stack proof | `prove-stack` PS-02 (one bootstrap per agent, instance `e2e-proof`), PS-04 (the secret not used up), PS-05 (no attempt left behind) | TC-ES-007 (the `e2e` job's `prove-stack` step) | Covered |
| L1-25 | Environment identity is configured, never inferred from instance, host, cluster or deployment (PF §17 *Namespacing Rules*; FR-022) | Yes | `setup` ST-06 (every registration through E's S2 only, the stack's configured environment `e`), GEN-05; the stack description E-07 states the environment as configured, never derived | TC-ES-004; TC-ES-007 (agents registered at E's S2 bootstrap at E's S3) | Covered |
| L1-26 | Identifiers unique within an environment, composed with scope, never allocated or reused (PF §17) | Yes | `setup` ST-01 (client-chosen identifiers checked against the contract's pattern); JOB-04 and CU-09 (a fresh stack per run, so an identifier is never registered twice) | TC-ES-019; TC-ES-004; TC-ES-005 | Covered |
| L1-27 | Recognised kinds: logical agent and instance are environment-scoped; the instance carries credentials (PF §17 *Recognised Kinds*; §3) | Yes | `setup` ST-06, ST-07 (logical agents registered); `prove-stack` PS-02 (an instance asserted at bootstrap, never derived from the host) | TC-ES-004; TC-ES-007 | Covered |
| L1-28 | Recognised kind: human principal (PF §17; ID) | Yes, as a constraint | GEN-02 (no human secret or credential written, printed or passed on), GEN-03 (the human steps outside both packages), ST-05 (K used once, in first authentication), ST-06 (one sign-in only, the one first authentication returns), ST-09 (the sign-in and the environment credential ended and checked refused) | TC-ES-006 (refusal on the real stack after success), TC-ES-020 (after a failure past first authentication); U1's packaging guard extended to `e2e/` (business-logic-model §6) | Covered |
| L1-01 to L1-11 | Envelope fields, client contract version, trace context, stamped fields, unknown fields and values, compatibility policy, actor chain, agent-asserted fields (PF §7b; FR-001 to FR-006) | N/A for U2 | — | — | N/A: SDK behaviour, specified by U1 and built by U3 and U4; U2 sends no envelope |
| L1-13 | Renew credential (PF §9; §11; §14) | N/A for U2 | — | — | N/A: `prove-stack` never renews (PS-03); renewal is the SDK's (U3, U4) |
| L1-14 to L1-22 | Revocation reads and the failure modes (PF §9 *Failure Modes*) | N/A for U2 | — | — | N/A: the platform's behaviour and the SDK's handling of it; U2 makes no call that exercises them |
| L1-23, L1-24 | Hold and present credential; forward inbound context (PF §11) | N/A for U2 | — | — | N/A: SDK operations (U3, U4) |
| L1-29, L1-30 | The envelope is assertions; revocation behaviour (PF §17) | N/A for U2 | — | — | N/A: no envelope, no revocation in U2 |

**Result**: 5 applicable rows, all Covered; the rest N/A for U2 with a reason; **0 Missing**.
