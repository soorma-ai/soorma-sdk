# L1 Domain Conformance Test Instructions

Every applicable row of every unit's `l1-coverage-matrix.md`, generated from the matrices at
Build and Test, with the assertion that proves it (the matrix's verification target) and the
evidence: the numbered runs of `build-and-test-summary.md` (*Runs*) and CI run 44670863814,
soorma-ai/soorma-sdk#23's pull-request run. The L1 sources are PF @
`prd-platform-foundations-v1.3` and ID @ `prd-identity-v1.0` (ID has no L1 source; its §11
prohibitions bind as constraints).

**How a row is verified**: its named conformance cases pass through each language's driver
(each case asserts the statement the row maps to, `spec/behaviour.md`), and, where the row is
one of *done when* 2, 3 or 5, the end-to-end scenarios pass on soorma-core's real stack. A row
fails if any named case or step fails on any runtime. **Blocking rule**: Build and Test is not
complete while any applicable row is failing or unverified.

## U1 `contract-and-conformance`: 25 applicable rows (5 N/A, as the matrix gives)

**Evidence for every row**: the cases through both drivers: TypeScript runs 18 (Node 24), 19 (Node 26); Python runs 20 (3.11), 21 (3.15); the reference run in the self-test, run 6; CI 44670863814 (97 of 97 on all six entries, CC-SEC-05 included).

| # | L1 requirement | Verification (the assertion) | Result |
|---|---|---|---|
| L1-01 | Seven envelope fields; six platform-stamped, trace context agent-asserted (PF §7b *Envelope Fields*; §17 *Envelope*; FR-001, FR-002) | CC-DRF-01, CC-NEV-02 | Pass |
| L1-02 | The draft declares the client contract version, distinct from the envelope version (PF §7b) | CC-DRF-01 | Pass |
| L1-03 | Trace context conforms to an open standard; validated for form (PF §7b; §11 *Populate trace context*) | CC-TRC-01, CC-TRC-02, CC-FWD-04, CC-FWD-05 | Pass |
| L1-04 | Never set a platform-stamped field; a draft that sets one is rejected, never overwritten (PF §7b obligations; §11 *What the SDK may not populate*; FR-002) | CC-NEV-02, CC-PRB-01 | Pass |
| L1-05 | Consumers preserve and forward unknown envelope fields (PF FR-005 (a); §7b; §17 *Compatibility Rules*) | CC-RCV-03, CC-FWD-02 | Pass |
| L1-06 | Unknown values in enumerated fields are not fatal (PF FR-005 (b); §7b; §17) | CC-RCV-03, CC-STR-03, CC-PRB-01 | Pass |
| L1-07 | Compatibility policy: widening a value set is compatible only because consumers tolerate unknown values; additive fields compatible (PF §7b *Compatibility Policy*; FR-004) | CC-RCV-03, CC-RCV-08, CC-STR-03, CC-PRB-01 | Pass |
| L1-09 | The full actor chain travels, most recent last, bounded; appended by the perimeter (PF FR-006) | CC-FWD-02, CC-RCV-02, CC-FWD-07 | Pass |
| L1-11 | Populate agent-asserted fields only; enforce nothing (PF §7b obligations; §11 *Advisory-only assertion*; FR-023) | CC-NEV-02, CC-RCV-08, CC-ACQ-07 | Pass |
| L1-12 | Exchange bootstrap material: startup, once per instance (PF §9 *Operations*; §11 *Acquire credential*) | CC-ACQ-01 | Pass |
| L1-13 | Renew credential: periodic; a still-valid credential required (PF §9; §11; §14) | CC-REN-01, CC-REN-02, CC-REN-05 | Pass |
| L1-15 | Failure: material unrecognised or bound to a retired or revoked agent → denied (PF §9 *Failure Modes*) | CC-ACQ-02 | Pass |
| L1-16 | Failure: credential expired → denied; renew, or re-bootstrap when lapsed (PF §9) | CC-REN-03, CC-REN-05, CC-SUB-05 | Pass |
| L1-17 | Failure: credential revoked → denied, terminal (PF §9; §17 *Revocation Behaviour*; FR-011) | CC-REN-04, CC-STR-09 | Pass |
| L1-18 | Failure: revocation state unavailable → served from cache, then denied (PF §9) | CC-PRB-04, CC-STR-01 | Pass |
| L1-19 | Failure: chain depth exceeded → rejected (PF §9) | CC-FWD-07 | Pass |
| L1-20 | Failure: malformed envelope or stamped field set → rejected (PF §9; O5) | CC-PRB-01 | Pass |
| L1-22 | Failure: no forwarded context, autonomy not declared → denied (PF §9; O12) | CC-FWD-01, CC-PRB-03, CC-FWD-07 | Pass |
| L1-23 | Hold and present credential: O1 to O4 on every request (PF §11) | CC-CRD-01, CC-CRD-02, CC-CRD-03 | Pass |
| L1-24 | Forward inbound context: origin stamped from it; omission made harmless (PF §11) | CC-FWD-01 to CC-FWD-07 | Pass |
| L1-25 | Environment identity is configured, never inferred from instance, host, cluster or deployment (PF §17 *Namespacing Rules*; FR-022) | CC-CFG-02, CC-CFG-06, CC-CRD-01 | Pass |
| L1-26 | Identifiers unique within an environment, composed with scope, never allocated (PF §17) | CC-RCV-04 | Pass |
| L1-27 | Recognised kinds: logical agent and instance are environment-scoped; the instance carries credentials (PF §17 *Recognised Kinds*; §3 *Logical Agent vs. Instance*) | CC-CFG-01, CC-CFG-06, CC-CRD-01 | Pass |
| L1-29 | The envelope is assertions, not proof; never usable to act (PF §17 *Envelope*) | CC-FWD-03, CC-CRD-03 | Pass |
| L1-30 | Revocation: terminal, effective without redeploy, within a published bound (PF §17 *Revocation Behaviour*) | CC-REN-04, CC-STR-09 | Pass |

## U2 `e2e-stack`: 5 applicable rows (5 N/A, as the matrix gives)

**Evidence for every row**: the stack: runs 25 (core-up), 26 (setup), 27 (prove-stack: both agents 200), 30 (core-down: every log searched clean); U2's unit tests in run 15; both scenarios on the stack, runs 28 and 29; CI `e2e-typescript`, `e2e-python` on 44670863814.

| # | L1 requirement | Verification (the assertion) | Result |
|---|---|---|---|
| L1-12 | Exchange bootstrap material: startup, once per instance (PF §9 *Operations*; §11 *Acquire credential*) | TC-ES-007 (the `e2e` job's `prove-stack` step) | Pass |
| L1-25 | Environment identity is configured, never inferred from instance, host, cluster or deployment (PF §17 *Namespacing Rules*; FR-022) | TC-ES-004; TC-ES-007 (agents registered at E's S2 bootstrap at E's S3) | Pass |
| L1-26 | Identifiers unique within an environment, composed with scope, never allocated or reused (PF §17) | TC-ES-019; TC-ES-004; TC-ES-005 | Pass |
| L1-27 | Recognised kinds: logical agent and instance are environment-scoped; the instance carries credentials (PF §17 *Recognised Kinds*; §3) | TC-ES-004; TC-ES-007 | Pass |
| L1-28 | Recognised kind: human principal (PF §17; ID) | TC-ES-006 (refusal on the real stack after success), TC-ES-020 (after a failure past first authentication); U1's packaging guard extended to `e2e/` (business-logic-model §6) | Pass |

## U3 `typescript-harness`: 25 applicable rows (5 N/A, as the matrix gives)

**Evidence for every row**: the cases through the TypeScript driver: runs 18, 19; CI 44670863814 (Node 24.22.3 with API 1.9.0 and 1.10.0, Node 26.13.0); the TypeScript scenario, run 28 and CI `e2e-typescript`; U3's unit tests in run 15.

| # | L1 requirement | Verification (the assertion) | Result |
|---|---|---|---|
| L1-01 | Seven envelope fields; six platform-stamped, trace context agent-asserted (PF §7b; §17; FR-001, FR-002) | CC-DRF-01, CC-NEV-02; TC-TH-023 | Pass |
| L1-02 | The draft declares the client contract version (PF §7b) | CC-DRF-01, CC-ACQ-01 | Pass |
| L1-03 | Trace context conforms to an open standard (PF §7b; §11) | CC-TRC-01, CC-TRC-02, CC-FWD-04, CC-FWD-05; TC-TH-025 to 027 | Pass |
| L1-04 | Never set a platform-stamped field; a draft that sets one is rejected (PF §7b; §11; FR-002) | CC-NEV-02, CC-PRB-01; TC-TH-024 | Pass |
| L1-05 | Unknown envelope fields preserved and forwarded (PF FR-005 (a); §17) | CC-RCV-03, CC-FWD-02; TC-TH-029, 047 | Pass |
| L1-06 | Unknown enumerated values not fatal (PF FR-005 (b)) | CC-RCV-03, CC-STR-03, CC-PRB-01; TC-TH-039, 047, 052 | Pass |
| L1-07 | Compatibility: consumers tolerate unknown values and additive fields (PF §7b; FR-004) | CC-RCV-03, CC-RCV-08; TC-TH-069 | Pass |
| L1-09 | The actor chain travels, bounded (PF FR-006) | CC-FWD-02, CC-RCV-02, CC-FWD-07 | Pass |
| L1-11 | Populate agent-asserted fields only; enforce nothing (PF §7b; §11; FR-023) | CC-NEV-02, CC-RCV-08, CC-ACQ-07 | Pass |
| L1-12 | Exchange bootstrap material, once per instance (PF §9; §11) | CC-ACQ-01, CC-SEC-01; **end-to-end**: TC-TH-061 (both agents bootstrap on U2's stack) | Pass |
| L1-13 | Renew credential: periodic, a still-valid credential required (PF §9; §11; §14) | CC-REN-01 to CC-REN-07; **end-to-end**: TC-TH-061 (one real S3 renewal, the fast clock) | Pass |
| L1-15 | Material unrecognised, or bound to a retired or revoked agent: denied (PF §9) | CC-ACQ-02; TC-TH-009 | Pass |
| L1-16 | Credential expired: renew, or bootstrap when lapsed (PF §9) | CC-REN-03, CC-REN-05, CC-REN-07, CC-SUB-05; TC-TH-018, 075 | Pass |
| L1-17 | Credential revoked: denied, terminal (PF §9; §17; FR-011) | CC-REN-04, CC-STR-09; TC-TH-019, 042 | Pass |
| L1-18 | Revocation state unavailable: cache, then denied (PF §9) | CC-PRB-04, CC-STR-01; TC-TH-011 | Pass |
| L1-19 | Chain depth exceeded: rejected (PF §9) | CC-FWD-07; TC-TH-031 | Pass |
| L1-20 | Malformed envelope or stamped field set: rejected (PF §9) | CC-PRB-01 | Pass |
| L1-22 | No forwarded context, autonomy not declared: denied (PF §9) | CC-FWD-01, CC-PRB-03, CC-FWD-07; TC-TH-028, 053 | Pass |
| L1-23 | Hold and present credential (PF §11) | CC-CRD-01 to CC-CRD-03, CC-CFG-03; TC-TH-020 to 022 | Pass |
| L1-24 | Forward inbound context: origin from it; omission harmless (PF §11) | CC-FWD-01 to CC-FWD-07; TC-TH-027 to 031 | Pass |
| L1-25 | Environment identity configured, never inferred (PF §17; FR-022) | CC-CFG-02, CC-CFG-06, CC-CRD-01; TC-TH-002, 006; **end-to-end**: the agents' credentials name U2's environment `e` | Pass |
| L1-26 | Identifiers never allocated by the client; received ones opaque (PF §17) | CC-RCV-04; TC-TH-048 | Pass |
| L1-27 | Logical agent and instance environment-scoped; the instance carries credentials (PF §17; §3) | CC-CFG-01, CC-CFG-07, CC-CRD-01; **end-to-end**: two instances, each its own credential | Pass |
| L1-29 | The envelope is assertions, never usable to act (PF §17) | CC-FWD-03, CC-CRD-03 | Pass |
| L1-30 | Revocation terminal, effective without redeploy (PF §17) | CC-REN-04, CC-STR-09; TC-TH-019, 042 | Pass |

## U4 `python-harness`: 25 applicable rows (5 N/A, as the matrix gives)

**Evidence for every row**: the cases through the Python driver: runs 20, 21; CI 44670863814 (3.11.18 and 3.15.2 with otel-latest, 3.11.18 with otel-floor); the Python scenario, run 29 and CI `e2e-python`; the unit tests, runs 13, 14.

| # | L1 requirement | Verification (the assertion) | Result |
|---|---|---|---|
| L1-01 | Seven envelope fields; six platform-stamped, trace context agent-asserted (PF §7b; §17; FR-001, FR-002) | CC-DRF-01, CC-NEV-02; TC-PH-023 | Pass |
| L1-02 | The draft declares the client contract version (PF §7b) | CC-DRF-01, CC-ACQ-01 | Pass |
| L1-03 | Trace context conforms to an open standard (PF §7b; §11) | CC-TRC-01, CC-TRC-02, CC-FWD-04, CC-FWD-05; TC-PH-025 to 027 | Pass |
| L1-04 | Never set a platform-stamped field; a draft that sets one is rejected (PF §7b; §11; FR-002) | CC-NEV-02, CC-PRB-01; TC-PH-024 | Pass |
| L1-05 | Unknown envelope fields preserved and forwarded (PF FR-005 (a); §17) | CC-RCV-03, CC-FWD-02; TC-PH-029, 047 | Pass |
| L1-06 | Unknown enumerated values not fatal (PF FR-005 (b)) | CC-RCV-03, CC-STR-03, CC-PRB-01; TC-PH-039, 047, 052 | Pass |
| L1-07 | Compatibility: consumers tolerate unknown values and additive fields (PF §7b; FR-004) | CC-RCV-03, CC-RCV-08; TC-PH-069 | Pass |
| L1-09 | The actor chain travels, bounded (PF FR-006) | CC-FWD-02, CC-RCV-02, CC-FWD-07 | Pass |
| L1-11 | Populate agent-asserted fields only; enforce nothing (PF §7b; §11; FR-023) | CC-NEV-02, CC-RCV-08, CC-ACQ-07 | Pass |
| L1-12 | Exchange bootstrap material, once per instance (PF §9; §11) | CC-ACQ-01, CC-SEC-01; **end-to-end**: TC-PH-061 (both agents bootstrap on U2's stack) | Pass |
| L1-13 | Renew credential: periodic, a still-valid credential required (PF §9; §11; §14) | CC-REN-01 to CC-REN-07; **end-to-end**: TC-PH-061 (one real S3 renewal, `time.time` patched ahead) | Pass |
| L1-15 | Material unrecognised, or bound to a retired or revoked agent: denied (PF §9) | CC-ACQ-02; TC-PH-009 | Pass |
| L1-16 | Credential expired: renew, or bootstrap when lapsed (PF §9) | CC-REN-03, CC-REN-05, CC-REN-07, CC-SUB-05; TC-PH-018, 075 | Pass |
| L1-17 | Credential revoked: denied, terminal (PF §9; §17; FR-011) | CC-REN-04, CC-STR-09; TC-PH-019, 042 | Pass |
| L1-18 | Revocation state unavailable: cache, then denied (PF §9) | CC-PRB-04, CC-STR-01; TC-PH-011 | Pass |
| L1-19 | Chain depth exceeded: rejected (PF §9) | CC-FWD-07; TC-PH-031 | Pass |
| L1-20 | Malformed envelope or stamped field set: rejected (PF §9) | CC-PRB-01 | Pass |
| L1-22 | No forwarded context, autonomy not declared: denied (PF §9) | CC-FWD-01, CC-PRB-03, CC-FWD-07; TC-PH-028, 053 | Pass |
| L1-23 | Hold and present credential (PF §11) | CC-CRD-01 to CC-CRD-03, CC-CFG-03; TC-PH-020 to 022 | Pass |
| L1-24 | Forward inbound context: origin from it; omission harmless (PF §11) | CC-FWD-01 to CC-FWD-07; TC-PH-027 to 031 | Pass |
| L1-25 | Environment identity configured, never inferred (PF §17; FR-022) | CC-CFG-02, CC-CFG-06, CC-CRD-01; TC-PH-002, 006; **end-to-end**: the agents' credentials name U2's environment `e` | Pass |
| L1-26 | Identifiers never allocated by the client; received ones opaque (PF §17) | CC-RCV-04; TC-PH-048 | Pass |
| L1-27 | Logical agent and instance environment-scoped; the instance carries credentials (PF §17; §3) | CC-CFG-01, CC-CFG-07, CC-CRD-01; **end-to-end**: two instances, each its own credential | Pass |
| L1-29 | The envelope is assertions, never usable to act (PF §17) | CC-FWD-03, CC-CRD-03 | Pass |
| L1-30 | Revocation terminal, effective without redeploy (PF §17) | CC-REN-04, CC-STR-09; TC-PH-019, 042 | Pass |

## Result

**80 applicable rows across the four units: 80 Pass, 0 Fail, 0 Unverified.**
