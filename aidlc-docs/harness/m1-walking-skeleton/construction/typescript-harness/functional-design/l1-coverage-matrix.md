# L1 Coverage Matrix — U3 `typescript-harness`

**L1 sources** (from `## PRD Intake`, the most authoritative): PF @
`prd-platform-foundations-v1.3`: §7b *Envelope Fields*, *Compatibility Policy* and the
obligations table; FR-004, FR-005, FR-006; §9 *Operations* and *Failure Modes*; §11 *Harness
Surface* and *What the SDK may not populate*; §17 *Envelope*, *Namespacing Rules*, *Recognised
Kinds*, *Compatibility Rules*, *Revocation Behaviour*. ID @ `prd-identity-v1.0`: no L1 source;
its §11 prohibitions bind as constraints (NEV-01).

**How U3 covers L1**: U1 mapped each row to a specification statement and a conformance case. U3
carries every applicable row to TypeScript.
- **Implementation target**: the module, under `typescript/src/`, and the `TH-…` rule (business-rules.md) that implement the statement.
- **Verification target**: the row's conformance cases, run through the TypeScript driver on Node 24 and 26 (TC-TH-059), plus the end-to-end test (TC-TH-061 to 063) where the row is *done when* 2, 3 or 5.

Rows are numbered as in U1's and U2's matrices.

| # | L1 requirement (source) | Applies | Implementation target | Verification target | Status |
|---|---|---|---|---|---|
| L1-01 | Seven envelope fields; six platform-stamped, trace context agent-asserted (PF §7b; §17; FR-001, FR-002) | Yes | `draft.ts` (DRF-01 to DRF-03), `reader.ts` (the envelope as received) | CC-DRF-01, CC-NEV-02; TC-TH-023 | Covered |
| L1-02 | The draft declares the client contract version (PF §7b) | Yes | `draft.ts` (`clientContractVersion` `"0.1.0"`); `transport.ts` (the header on calls without a draft) | CC-DRF-01, CC-ACQ-01 | Covered |
| L1-03 | Trace context conforms to an open standard (PF §7b; §11) | Yes | `tracing.ts`, `draft.ts` (TH-SPN-02, TH-SPN-06) | CC-TRC-01, CC-TRC-02, CC-FWD-04, CC-FWD-05; TC-TH-025 to 027 | Covered |
| L1-04 | Never set a platform-stamped field; a draft that sets one is rejected (PF §7b; §11; FR-002) | Yes | `draft.ts` (no way to set one: TH-API-03), `transport.ts` (the Problem surfaced) | CC-NEV-02, CC-PRB-01; TC-TH-024 | Covered |
| L1-05 | Unknown envelope fields preserved and forwarded (PF FR-005 (a); §17) | Yes | `reader.ts` (TH-RD-03: exact text, unknown members kept), `draft.ts` (the spliced text, TH-PUB-02) | CC-RCV-03, CC-FWD-02; TC-TH-029, 047 | Covered |
| L1-06 | Unknown enumerated values not fatal (PF FR-005 (b)) | Yes | `reader.ts` (`originMode` as received), `subscription.ts` (end codes, STR-03), `errors.ts` (Problem codes, PRB-01) | CC-RCV-03, CC-STR-03, CC-PRB-01; TC-TH-039, 047, 052 | Covered |
| L1-07 | Compatibility: consumers tolerate unknown values and additive fields (PF §7b; FR-004) | Yes, the consumer's half | `reader.ts` (no schema rejection, TH-RD-05), the `Envelope` type (every member optional, CDI-04) | CC-RCV-03, CC-RCV-08; TC-TH-069 | Covered |
| L1-08 | FR-004's producer half | N/A | — | — | N/A: the platform's obligation; the SDK produces only drafts |
| L1-09 | The actor chain travels, bounded (PF FR-006) | Yes, as forwarded and received | `draft.ts` (forwarded unchanged), `reader.ts` (a 32-entry chain received), `errors.ts` (`chain_too_deep` surfaced) | CC-FWD-02, CC-RCV-02, CC-FWD-07 | Covered |
| L1-10 | Chain appending and `maxChainDepth` enforcement | N/A | — | — | N/A: the perimeter's; the SDK enforces nothing (NEV-04) |
| L1-11 | Populate agent-asserted fields only; enforce nothing (PF §7b; §11; FR-023) | Yes | `draft.ts`; `reader.ts` (no validation); `keeper.ts` (`agent`, `instance` sent as given, ACQ-09) | CC-NEV-02, CC-RCV-08, CC-ACQ-07 | Covered |
| L1-12 | Exchange bootstrap material, once per instance (PF §9; §11) | Yes | `keeper.ts` (§2 of the logic model; TH-SEC-04), `secrets.ts` | CC-ACQ-01, CC-SEC-01; **end-to-end**: TC-TH-061 (both agents bootstrap on U2's stack) | Covered |
| L1-13 | Renew credential: periodic, a still-valid credential required (PF §9; §11; §14) | Yes | `keeper.ts` (REN-01 to REN-07, TH-REN-01 to 05) | CC-REN-01 to CC-REN-06; **end-to-end**: TC-TH-061 (one real S3 renewal, the fast clock) | Covered |
| L1-14 | Read revocation state (per request) | N/A | — | — | N/A: the perimeter's operation |
| L1-15 | Material unrecognised, or bound to a retired or revoked agent: denied (PF §9) | Yes | `keeper.ts` (ACQ-03: `ProblemError`, not retried) | CC-ACQ-02; TC-TH-009 | Covered |
| L1-16 | Credential expired: renew, or bootstrap when lapsed (PF §9) | Yes | `keeper.ts` (REN-04, REN-06), `subscription.ts` (SUB-05) | CC-REN-03, CC-REN-05, CC-SUB-05; TC-TH-018 | Covered |
| L1-17 | Credential revoked: denied, terminal (PF §9; §17; FR-011) | Yes | `keeper.ts` (REN-05; TH-REN-04, GAP-CAC-001), `subscription.ts` (STR-07), `client.ts` (*revoked*) | CC-REN-04, CC-STR-09; TC-TH-019, 042 | Covered |
| L1-18 | Revocation state unavailable: cache, then denied (PF §9) | Yes, as seen by a client | `transport.ts` (`503` retried, PRB-05), `subscription.ts` (`end unavailable` non-terminal) | CC-PRB-04, CC-STR-01; TC-TH-011 | Covered |
| L1-19 | Chain depth exceeded: rejected (PF §9) | Yes | `errors.ts`, `transport.ts` (FWD-05: surfaced, not retried) | CC-FWD-07; TC-TH-031 | Covered |
| L1-20 | Malformed envelope or stamped field set: rejected (PF §9) | Yes | `errors.ts` (DRF-04 surfaced as given) | CC-PRB-01 | Covered |
| L1-21 | `autonomous` asserted with inbound context: rejected | N/A | — | — | N/A: a draft never carries origin mode; the SDK has no way to assert it (NEV-02) |
| L1-22 | No forwarded context, autonomy not declared: denied (PF §9) | Yes | `client.ts`, `draft.ts` (forwarding the default path through `delivery.publish`, FWD-01), `errors.ts` (`forbidden` as given) | CC-FWD-01, CC-PRB-03, CC-FWD-07; TC-TH-028, 053 | Covered |
| L1-23 | Hold and present credential (PF §11) | Yes | `keeper.ts` (in memory, opaque), `transport.ts` (bearer only, to S3 and S4 only), `client.ts` (details read only, TH-API-04) | CC-CRD-01 to CC-CRD-03, CC-CFG-03; TC-TH-020 to 022 | Covered |
| L1-24 | Forward inbound context: origin from it; omission harmless (PF §11) | Yes | `reader.ts`, `draft.ts`, `client.ts` (`delivery.publish` vs `client.publish`) | CC-FWD-01 to CC-FWD-07; TC-TH-027 to 031 | Covered |
| L1-25 | Environment identity configured, never inferred (PF §17; FR-022) | Yes | `options.ts` (no environment option), `client.ts` (`credential.environment` read only, CDI-01), the lint rule (TH-API-05) | CC-CFG-02, CC-CFG-06, CC-CRD-01; TC-TH-002, 006; **end-to-end**: the agents' credentials name U2's environment `e` | Covered |
| L1-26 | Identifiers never allocated by the client; received ones opaque (PF §17) | Yes, as received | `reader.ts` (RCV-04: never syntax-checked) | CC-RCV-04; TC-TH-048 | Covered |
| L1-27 | Logical agent and instance environment-scoped; the instance carries credentials (PF §17; §3) | Yes | `options.ts` (`agent`, `instance` supplied; `newInstanceId`), `keeper.ts` (asserted at bootstrap) | CC-CFG-01, CC-CFG-07, CC-CRD-01; **end-to-end**: two instances, each its own credential | Covered |
| L1-28 | Human principal (PF §17; ID) | N/A for the SDK | — | — | N/A: no human operation; its absence is checked (NEV-01, CC-NEV-01, TC-TH-057) |
| L1-29 | The envelope is assertions, never usable to act (PF §17) | Yes | `draft.ts` (the seal opaque, FWD-03), `keeper.ts` (acting needs the presenter's own credential) | CC-FWD-03, CC-CRD-03 | Covered |
| L1-30 | Revocation terminal, effective without redeploy (PF §17) | Yes, the client's half | `keeper.ts`, `subscription.ts`, `client.ts` (*revoked*) | CC-REN-04, CC-STR-09; TC-TH-019, 042 | Covered |

**Result** (Functional Design): 30 rows: **25 Covered**, 5 N/A with their reasons, **0
Missing**. At Code Generation each Covered row becomes Implemented, and Verified when its cases
pass through the TypeScript driver on Node 24 and 26 (and the end-to-end test, where named) on
U3's code PR.
