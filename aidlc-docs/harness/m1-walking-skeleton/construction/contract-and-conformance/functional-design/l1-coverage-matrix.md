# L1 Coverage Matrix — U1 `contract-and-conformance`

**L1 sources** (from `## PRD Intake`, the most authoritative): PF @
`prd-platform-foundations-v1.3`: §7b *Envelope Fields*, *Compatibility Policy* and the
obligations table; FR-004, FR-005, FR-006; §9 *Operations* and *Failure Modes*; §11 *Harness
Surface* and *What the SDK may not populate*; §17 *Envelope*, *Namespacing Rules*, *Recognised
Kinds*, *Compatibility Rules*, *Revocation Behaviour*. ID @ `prd-identity-v1.0`: no L1 source
(its §11 prohibitions bind as constraints: NEV-01).

**How U1 covers L1**: U1 builds no SDK code. For U1, the **implementation target** is the
specification statement every language implements (business-rules.md), and the **verification
target** is the conformance case that checks it (business-logic-model.md §6). U3 and U4 carry
the same rows to code and to a passing run.

| # | L1 requirement (source) | Applies | Implementation target | Verification target | Status |
|---|---|---|---|---|---|
| L1-01 | Seven envelope fields; six platform-stamped, trace context agent-asserted (PF §7b *Envelope Fields*; §17 *Envelope*; FR-001, FR-002) | Yes | DRF-01, DRF-02, DRF-03, NEV-02 | CC-DRF-01, CC-NEV-02 | Verified (reference run: CC-DRF-01; structure: CC-NEV-02, executed at U3 and U4) |
| L1-02 | The draft declares the client contract version, distinct from the envelope version (PF §7b) | Yes | DRF-01 (`clientContractVersion` `"0.1.0"`) | CC-DRF-01 | Verified (reference run: CC-DRF-01) |
| L1-03 | Trace context conforms to an open standard; validated for form (PF §7b; §11 *Populate trace context*) | Yes | TRC-01 to TRC-04 | CC-TRC-01, CC-TRC-02, CC-FWD-04, CC-FWD-05 | Verified (reference run: CC-TRC-01; structure: CC-FWD-04, CC-FWD-05, CC-TRC-02, executed at U3 and U4) |
| L1-04 | Never set a platform-stamped field; a draft that sets one is rejected, never overwritten (PF §7b obligations; §11 *What the SDK may not populate*; FR-002) | Yes | DRF-03, NEV-02; DRF-04 (the rejection surfaced) | CC-NEV-02, CC-PRB-01 | Verified (reference run: CC-PRB-01; structure: CC-NEV-02, executed at U3 and U4) |
| L1-05 | Consumers preserve and forward unknown envelope fields (PF FR-005 (a); §7b; §17 *Compatibility Rules*) | Yes | RCV-03, FWD-02 | CC-RCV-03, CC-FWD-02 | Verified (reference run: CC-FWD-02; structure: CC-RCV-03, executed at U3 and U4) |
| L1-06 | Unknown values in enumerated fields are not fatal (PF FR-005 (b); §7b; §17) | Yes | RCV-03 (`originMode`); STR-03 (end codes); PRB-01 (Problem codes) | CC-RCV-03, CC-STR-03, CC-PRB-01 | Verified (reference run: CC-PRB-01; structure: CC-RCV-03, CC-STR-03, executed at U3 and U4) |
| L1-07 | Compatibility policy: widening a value set is compatible only because consumers tolerate unknown values; additive fields compatible (PF §7b *Compatibility Policy*; FR-004) | Yes, the consumer's half | RCV-03, RCV-08 (no schema rejection of what the platform sends), STR-03, PRB-01 | CC-RCV-03, CC-RCV-08, CC-STR-03, CC-PRB-01 | Verified (reference run: CC-PRB-01; structure: CC-RCV-03, CC-RCV-08, CC-STR-03, executed at U3 and U4) |
| L1-08 | FR-004's producer half: new envelope versions, transition windows (PF FR-004) | N/A | — | — | N/A: the platform's obligation; the SDK produces no envelope (only a draft) |
| L1-09 | The full actor chain travels, most recent last, bounded; appended by the perimeter (PF FR-006) | Yes, as forwarded and received | FWD-02 (forwarded unchanged), RCV-02 (a 32-entry chain received), FWD-05 (`chain_too_deep` surfaced) | CC-FWD-02, CC-RCV-02, CC-FWD-07 | Verified (reference run: CC-FWD-02, CC-RCV-02; structure: CC-FWD-07, executed at U3 and U4) |
| L1-10 | Chain appending and `maxChainDepth` enforcement (PF FR-006; §7b obligations) | N/A | — | — | N/A: the perimeter's (Event plane ingest); the SDK enforces nothing (NEV-04) |
| L1-11 | Populate agent-asserted fields only; enforce nothing (PF §7b obligations; §11 *Advisory-only assertion*; FR-023) | Yes | DRF-03, NEV-04, RCV-08, ACQ-09 | CC-NEV-02, CC-RCV-08, CC-ACQ-07 | Verified (structure; executed at U3 and U4) |
| L1-12 | Exchange bootstrap material: startup, once per instance (PF §9 *Operations*; §11 *Acquire credential*) | Yes | ACQ-01, ACQ-02, SEC-01 | CC-ACQ-01 | Verified (reference run: CC-ACQ-01) |
| L1-13 | Renew credential: periodic; a still-valid credential required (PF §9; §11; §14) | Yes | REN-01, REN-02, REN-03, REN-06 | CC-REN-01, CC-REN-02, CC-REN-05 | Verified (reference run: CC-REN-01; structure: CC-REN-02, CC-REN-05, executed at U3 and U4) |
| L1-14 | Read revocation state: per request, hot path (PF §9 *Operations*) | N/A | — | — | N/A: the perimeter's operation; the SDK sees only its outcome (L1-18) |
| L1-15 | Failure: material unrecognised or bound to a retired or revoked agent → denied (PF §9 *Failure Modes*) | Yes | ACQ-03 | CC-ACQ-02 | Verified (structure; executed at U3 and U4) |
| L1-16 | Failure: credential expired → denied; renew, or re-bootstrap when lapsed (PF §9) | Yes | REN-04, REN-06, SUB-05 | CC-REN-03, CC-REN-05, CC-SUB-05 | Verified (structure; executed at U3 and U4) |
| L1-17 | Failure: credential revoked → denied, terminal (PF §9; §17 *Revocation Behaviour*; FR-011) | Yes | REN-05, STR-07 | CC-REN-04, CC-STR-09 | Verified (structure; executed at U3 and U4) |
| L1-18 | Failure: revocation state unavailable → served from cache, then denied (PF §9) | Yes, as seen by a client | PRB-05 (`503` retried), STR-03 (`end unavailable` non-terminal) | CC-PRB-04, CC-STR-01 | Verified (reference run: CC-PRB-04, CC-STR-01) |
| L1-19 | Failure: chain depth exceeded → rejected (PF §9) | Yes | FWD-05 | CC-FWD-07 | Verified (structure; executed at U3 and U4) |
| L1-20 | Failure: malformed envelope or stamped field set → rejected (PF §9; O5) | Yes | DRF-04 | CC-PRB-01 | Verified (reference run: CC-PRB-01) |
| L1-21 | Failure: `autonomous` asserted with inbound context → rejected (PF §9; O6) | N/A | — | — | N/A: a draft never carries origin mode (contract `pre-release.md` 5); the SDK has no way to assert it (NEV-02) |
| L1-22 | Failure: no forwarded context, autonomy not declared → denied (PF §9; O12) | Yes | FWD-01 (forwarding is the default path), PRB-04, FWD-05 (`forbidden` surfaced as given) | CC-FWD-01, CC-PRB-03, CC-FWD-07 | Verified (reference run: CC-FWD-01; structure: CC-FWD-07, CC-PRB-03, executed at U3 and U4) |
| L1-23 | Hold and present credential: O1 to O4 on every request (PF §11) | Yes | CRD-01, CRD-02, CRD-03 | CC-CRD-01, CC-CRD-02, CC-CRD-03 | Verified (reference run: CC-CRD-01; structure: CC-CRD-02, CC-CRD-03, executed at U3 and U4) |
| L1-24 | Forward inbound context: origin stamped from it; omission made harmless (PF §11) | Yes | FWD-01 to FWD-05 | CC-FWD-01 to CC-FWD-07 | Verified (reference run: CC-FWD-01; structure: CC-FWD-07, executed at U3 and U4) |
| L1-25 | Environment identity is configured, never inferred from instance, host, cluster or deployment (PF §17 *Namespacing Rules*; FR-022) | Yes | CFG-02, CFG-05, CFG-07, CRD-03 (reports only what the credential says) | CC-CFG-02, CC-CFG-06, CC-CRD-01 | Verified (reference run: CC-CRD-01; structure: CC-CFG-02, CC-CFG-06, executed at U3 and U4) |
| L1-26 | Identifiers unique within an environment, composed with scope, never allocated (PF §17) | Yes, as received | RCV-04 (opaque, never syntax-checked) | CC-RCV-04 | Verified (structure; executed at U3 and U4) |
| L1-27 | Recognised kinds: logical agent and instance are environment-scoped; the instance carries credentials (PF §17 *Recognised Kinds*; §3 *Logical Agent vs. Instance*) | Yes | CFG-01 (agent and instance supplied), CFG-05 (instance asserted), CRD-03 | CC-CFG-01, CC-CFG-06, CC-CRD-01 | Verified (reference run: CC-CFG-01, CC-CRD-01; structure: CC-CFG-06, executed at U3 and U4) |
| L1-28 | Recognised kind: human principal (PF §17; ID) | N/A for the SDK | NEV-01, CRD-05 | CC-NEV-01 | N/A: the SDK has no human operation; the absence is checked |
| L1-29 | The envelope is assertions, not proof; never usable to act (PF §17 *Envelope*) | Yes | FWD-03 (seal opaque, never checked), CRD-02 (acting needs the presenter's own credential) | CC-FWD-03, CC-CRD-03 | Verified (structure; executed at U3 and U4) |
| L1-30 | Revocation: terminal, effective without redeploy, within a published bound (PF §17 *Revocation Behaviour*) | Yes, the client's half | REN-05, STR-07 | CC-REN-04, CC-STR-09 | Verified (structure; executed at U3 and U4) |

**Result** (Functional Design): 30 rows: 25 Covered, 5 N/A with rationale, **0 Missing**. **Updated at Code Generation** (plan 1.3): every Covered row is Implemented (its statement is in `spec/behaviour.md`, its cases in `conformance/cases/`) and Verified as each row states; rows verified by structure are executed against a language driver at U3 and U4.
