# Invariant Coverage Matrix — U1 `contract-and-conformance`

**Invariants source**: soorma-prd `references/platform/invariants.md` @
`prd-platform-foundations-v1.3` and @ `prd-identity-v1.0` (text identical at both tags,
SHA-256 `c66c0170…`; Extension Configuration).
**PRD compliance tables**: PF §15 @ `prd-platform-foundations-v1.3` (all eleven Addressed, none
N/A); ID §15 @ `prd-identity-v1.0` (I1 to I11 Addressed).

**How U1 carries the invariants**: U1 ships no SDK code and serves nothing. Its code-level risk
is in **what the specification lets a language do** and **what the suite fails to catch**: a
missing statement or a lax case lets an SDK violate an invariant unnoticed. So for U1 the
implementation target is the statement that forbids the violation, and the verification
target is the case that would fail a language that commits it. U3 and U4 carry the rows into
code.

| Code | PRD Status | Applies to Unit | Code-Level Risk in This Unit | Implementation Target | Verification Target | Status |
|---|---|---|---|---|---|---|
| I1 Isolation | Addressed | Yes | A specification that lets the SDK take, infer or assert an environment, scoping by something other than the credential | CFG-02, CFG-05, CFG-07; CRD-03 (reports only what the credential says, CDI-01) | CC-CFG-02, CC-CFG-06, CC-CRD-01 | Verified (reference run: CC-CRD-01; structure: CC-CFG-02, CC-CFG-06, executed at U3 and U4) |
| I2 Perimeter enforcement | Addressed | Yes | A statement that makes the SDK refuse, validate or filter something the platform checks, inviting the platform to rely on it; a case that rewards SDK-side rejection | NEV-04, RCV-08 (no schema validation of received envelopes, DEC-U1-09), ACQ-09 (values sent as given), DRF-03 (no draft check as enforcement) | CC-RCV-08, CC-ACQ-07, CC-NEV-02. **Cumulative check**: no case in the catalogue expects the SDK to refuse a request or a Delivery the platform would judge; reviewed across all 88 | Verified (structure; executed at U3 and U4) |
| I3 Portable credential | Addressed | Yes | Deriving the instance identifier or any identifier from the host; a default instance id read from the machine | CFG-05, CFG-06 (`newInstanceId` random, nothing about the host), CRD-02 (identity only by the presented credential) | CC-CFG-06, CC-CFG-07, CC-CRD-03 | Verified (structure; executed at U3 and U4) |
| I4 Attribution recoverable | Addressed | Yes | Re-serializing a forwarded envelope (losing unknown fields, reordering what the seal covers); copying the forwarded trace context as this hop's | FWD-02, FWD-03, TRC-04, RCV-03 | CC-FWD-02 (negative control `reorder-forwarded-envelope` must fail it), CC-FWD-03, CC-FWD-04, CC-RCV-03 | Verified (reference run: CC-FWD-02; structure: CC-FWD-03, CC-FWD-04, CC-RCV-03, executed at U3 and U4) |
| I5 Monotonic authority | Addressed | Yes | An SDK path to assert origin, set a stamped field, request re-broadening, or present a delegation; making non-forwarding the default (escalation by omission is the platform's O12, but the default path matters) | DRF-03, NEV-02, NEV-03, FWD-01 (forwarding is the default), FWD-04 | CC-NEV-02, CC-NEV-03, CC-FWD-01, CC-FWD-06 | Verified (reference run: CC-FWD-01; structure: CC-FWD-06, CC-NEV-02, CC-NEV-03, executed at U3 and U4) |
| I6 Two faces | Addressed | Yes | A harness operation reaching a control face, or a human operation in the SDK | NEV-01, CRD-05; CFG-03 (only S3 and S4, the data face) | CC-NEV-01, CC-CFG-03. Units Generation checked the shapes: U1 is ordinary, no face | Verified (reference run: CC-NEV-01; structure: CC-CFG-03, executed at U3 and U4) |
| I7 Contract compatibility | Addressed | Yes | A copy that drifts from the tag; types not generated from it; an SDK that fails on unknown fields, values or codes, so an older SDK breaks against a newer platform | The drift check and `PIN` (business-logic-model §1), the generated-types check; DRF-01 (`clientContractVersion` declared), RCV-03, RCV-08, STR-03, PRB-01 | Contract drift check (local and remote), generated-types check, CC-RCV-03, CC-RCV-08, CC-STR-03, CC-PRB-01 | Verified (reference run: CC-PRB-01; structure: CC-RCV-03, CC-RCV-08, CC-STR-03, executed at U3 and U4) |
| I8 Packaging rule | Addressed | Yes | Test-only code (reference driver, faults, stub) leaking into a package; commercial code in the client | NEV-05; the reference driver in neither package (business-logic-model §5.1) | Packaging table at Code Generation: every U1 capability → PF §12 assignment (the harness surface: core) → `soorma-sdk`; the check that neither package's file list contains `conformance/` | Verified (the packaging guard and its test, tools/packaging/check.test.ts; the I8 table below) |
| I9 Mechanism, not instance | Addressed | Yes | A soorma-defined span name or attribute; tenant-specific names or schemas in the specification or cases outside labelled fixtures | SPN-01 (OpenTelemetry's conventions only), DEC-U1-11 (a convention attribute's value, flagged); PUB-04 (payload opaque) | CC-SPN-01; cases hold tenant-like data only as labelled fixtures or generated payloads | Verified (reference run: CC-SPN-01) |
| I10 Runtime-later | Addressed | Yes | Anything that holds only if the agent runs platform-supplied code; scoping by deployment topology | NEV-04 (enforces nothing), CFG-05, CFG-07 | CC-CFG-06, CC-RCV-08 | Verified (structure; executed at U3 and U4) |
| I11 No technology selection | Addressed | N/A | — | — | — | N/A: Construction is where technology is selected; this invariant constrains the PRD |

**Result** (Functional Design): 10 Covered, 1 N/A by design, **0 Missing**. **Updated at Code Generation** (plan 1.3): rows Implemented and Verified as each states; I7's drift and generated-types checks and I8's packaging guard each have a test proving they catch their defect (`tools/*/check.test.ts`).

## I8 Packaging Table — U1

| Capability implemented | PRD edition assignment | Repository | Notes |
| --- | --- | --- | --- |
| The harness behaviour specification and name table | PF §12: the harness surface (SDK) is core | soorma-sdk | Apache 2.0 |
| The conformance suite (runner, stub, cases) | PF §12: core (part of the harness surface's conformance) | soorma-sdk | Test only; private workspace packages, never published |
| The reference driver and its faults | Not a product capability: test infrastructure | soorma-sdk | In no package; the packaging guard keeps it out |
| The repository checks and the DCO check | Not a product capability: repository tooling | soorma-sdk | Private |

No commercial capability exists in U1 in any form (PF §11 *Commercial client check*); nothing in U1 lands in soorma-core.
