# L1 Coverage Matrix — U4 `python-harness`

**L1 sources** (from `## PRD Intake`, the most authoritative): PF @
`prd-platform-foundations-v1.3`: §7b *Envelope Fields*, *Compatibility Policy* and the
obligations table; FR-004, FR-005, FR-006; §9 *Operations* and *Failure Modes*; §11 *Harness
Surface* and *What the SDK may not populate*; §17 *Envelope*, *Namespacing Rules*, *Recognised
Kinds*, *Compatibility Rules*, *Revocation Behaviour*. ID @ `prd-identity-v1.0`: no L1 source;
its §11 prohibitions bind as constraints (NEV-01).

**How U4 covers L1**: U1 mapped each row to a specification statement and a conformance case. U4
carries every applicable row to Python, as U3 carried it to Python.
- **Implementation target**: the module, under `python/src/soorma/`, and the `PH-…` rule (business-rules.md) that implement the statement.
- **Verification target**: the row's conformance cases, run through the Python driver on Python 3.11 and the newest release (TC-PH-059), plus `e2e-python` (TC-PH-061 to 063) where the row is *done when* 2, 3 or 5.

Rows are numbered as in U1's, U2's and U3's matrices.

| # | L1 requirement (source) | Applies | Implementation target | Verification target | Status |
|---|---|---|---|---|---|
| L1-01 | Seven envelope fields; six platform-stamped, trace context agent-asserted (PF §7b; §17; FR-001, FR-002) | Yes | `_draft.py` (DRF-01 to DRF-03), `_reader.py` (the envelope as received) | CC-DRF-01, CC-NEV-02; TC-PH-023 | Verified |
| L1-02 | The draft declares the client contract version (PF §7b) | Yes | `_draft.py` (`clientContractVersion` `"0.1.0"`); `_transport.py` (the header on calls without a draft) | CC-DRF-01, CC-ACQ-01 | Verified |
| L1-03 | Trace context conforms to an open standard (PF §7b; §11) | Yes | `_tracing.py`, `_draft.py` (PH-SPN-02, PH-SPN-04) | CC-TRC-01, CC-TRC-02, CC-FWD-04, CC-FWD-05; TC-PH-025 to 027 | Verified |
| L1-04 | Never set a platform-stamped field; a draft that sets one is rejected (PF §7b; §11; FR-002) | Yes | `_draft.py` (no way to set one: PH-API-03), `_transport.py` (the Problem surfaced) | CC-NEV-02, CC-PRB-01; TC-PH-024 | Verified |
| L1-05 | Unknown envelope fields preserved and forwarded (PF FR-005 (a); §17) | Yes | `_reader.py` (PH-RD-03: exact text, unknown members kept), `_draft.py` (the spliced text, PH-PUB-02) | CC-RCV-03, CC-FWD-02; TC-PH-029, 047 | Verified |
| L1-06 | Unknown enumerated values not fatal (PF FR-005 (b)) | Yes | `_reader.py` (`originMode` as received), `_subscription.py` (end codes, STR-03), `_errors.py` (Problem codes, PRB-01) | CC-RCV-03, CC-STR-03, CC-PRB-01; TC-PH-039, 047, 052 | Verified |
| L1-07 | Compatibility: consumers tolerate unknown values and additive fields (PF §7b; FR-004) | Yes, the consumer's half | `_reader.py` (no schema rejection, PH-RD-05), the `Envelope` `TypedDict` (every member optional, CDI-04) | CC-RCV-03, CC-RCV-08; TC-PH-069 | Verified |
| L1-08 | FR-004's producer half | N/A | — | — | N/A: the platform's obligation; the SDK produces only drafts |
| L1-09 | The actor chain travels, bounded (PF FR-006) | Yes, as forwarded and received | `_draft.py` (forwarded unchanged), `_reader.py` (a 32-entry chain received), `_errors.py` (`chain_too_deep` surfaced) | CC-FWD-02, CC-RCV-02, CC-FWD-07 | Verified |
| L1-10 | Chain appending and `maxChainDepth` enforcement | N/A | — | — | N/A: the perimeter's; the SDK enforces nothing (NEV-04) |
| L1-11 | Populate agent-asserted fields only; enforce nothing (PF §7b; §11; FR-023) | Yes | `_draft.py`; `_reader.py` (no validation); `_keeper.py` (`agent`, `instance` sent as given, ACQ-09) | CC-NEV-02, CC-RCV-08, CC-ACQ-07 | Verified |
| L1-12 | Exchange bootstrap material, once per instance (PF §9; §11) | Yes | `_keeper.py` (§2 of the logic model; PH-SEC-04), `_secrets.py` | CC-ACQ-01, CC-SEC-01; **end-to-end**: TC-PH-061 (both agents bootstrap on U2's stack) | Verified |
| L1-13 | Renew credential: periodic, a still-valid credential required (PF §9; §11; §14) | Yes | `_keeper.py` (REN-01 to REN-07, PH-REN-01 to 06; `_clock.py`, PH-CLK-01, 02) | CC-REN-01 to CC-REN-07; **end-to-end**: TC-PH-061 (one real S3 renewal, `time.time` patched ahead) | Verified |
| L1-14 | Read revocation state (per request) | N/A | — | — | N/A: the perimeter's operation |
| L1-15 | Material unrecognised, or bound to a retired or revoked agent: denied (PF §9) | Yes | `_keeper.py` (ACQ-03: `ProblemError`, not retried) | CC-ACQ-02; TC-PH-009 | Verified |
| L1-16 | Credential expired: renew, or bootstrap when lapsed (PF §9) | Yes | `_keeper.py` (REN-04, REN-06; REN-07: after the clock-skew warning, S3's `credential_expired` decides), `_subscription.py` (SUB-05) | CC-REN-03, CC-REN-05, CC-REN-07, CC-SUB-05; TC-PH-018, 075 | Verified |
| L1-17 | Credential revoked: denied, terminal (PF §9; §17; FR-011) | Yes | `_keeper.py` (REN-05; PH-REN-05, GAP-CAC-001), `_subscription.py` (STR-07), `_client.py` (*revoked*) | CC-REN-04, CC-STR-09; TC-PH-019, 042 | Verified |
| L1-18 | Revocation state unavailable: cache, then denied (PF §9) | Yes, as seen by a client | `_transport.py` (`503` retried, PRB-05), `_subscription.py` (`end unavailable` non-terminal) | CC-PRB-04, CC-STR-01; TC-PH-011 | Verified |
| L1-19 | Chain depth exceeded: rejected (PF §9) | Yes | `_errors.py`, `_transport.py` (FWD-05: surfaced, not retried) | CC-FWD-07; TC-PH-031 | Verified |
| L1-20 | Malformed envelope or stamped field set: rejected (PF §9) | Yes | `_errors.py` (DRF-04 surfaced as given) | CC-PRB-01 | Verified |
| L1-21 | `autonomous` asserted with inbound context: rejected | N/A | — | — | N/A: a draft never carries origin mode; the SDK has no way to assert it (NEV-02) |
| L1-22 | No forwarded context, autonomy not declared: denied (PF §9) | Yes | `_client.py`, `_draft.py` (forwarding the default path through `delivery.publish`, FWD-01), `_errors.py` (`forbidden` as given) | CC-FWD-01, CC-PRB-03, CC-FWD-07; TC-PH-028, 053 | Verified |
| L1-23 | Hold and present credential (PF §11) | Yes | `_keeper.py` (in memory, opaque), `_transport.py` (bearer only, to S3 and S4 only), `_client.py` (details read only, PH-API-04) | CC-CRD-01 to CC-CRD-03, CC-CFG-03; TC-PH-020 to 022 | Verified |
| L1-24 | Forward inbound context: origin from it; omission harmless (PF §11) | Yes | `_reader.py`, `_draft.py`, `_client.py` (`delivery.publish` vs `client.publish`) | CC-FWD-01 to CC-FWD-07; TC-PH-027 to 031 | Verified |
| L1-25 | Environment identity configured, never inferred (PF §17; FR-022) | Yes | `_options.py` (no environment option), `_client.py` (`credential.environment` read only, CDI-01), the static check (PH-API-05) | CC-CFG-02, CC-CFG-06, CC-CRD-01; TC-PH-002, 006; **end-to-end**: the agents' credentials name U2's environment `e` | Verified |
| L1-26 | Identifiers never allocated by the client; received ones opaque (PF §17) | Yes, as received | `_reader.py` (RCV-04: never syntax-checked) | CC-RCV-04; TC-PH-048 | Verified |
| L1-27 | Logical agent and instance environment-scoped; the instance carries credentials (PF §17; §3) | Yes | `_options.py` (`agent`, `instance` supplied; `new_instance_id`), `_keeper.py` (asserted at bootstrap) | CC-CFG-01, CC-CFG-07, CC-CRD-01; **end-to-end**: two instances, each its own credential | Verified |
| L1-28 | Human principal (PF §17; ID) | N/A for the SDK | — | — | N/A: no human operation; its absence is checked (NEV-01, CC-NEV-01, TC-PH-057) |
| L1-29 | The envelope is assertions, never usable to act (PF §17) | Yes | `_draft.py` (the seal opaque, FWD-03), `_keeper.py` (acting needs the presenter's own credential) | CC-FWD-03, CC-CRD-03 | Verified |
| L1-30 | Revocation terminal, effective without redeploy (PF §17) | Yes, the client's half | `_keeper.py`, `_subscription.py`, `_client.py` (*revoked*) | CC-REN-04, CC-STR-09; TC-PH-019, 042 | Verified |

**Result** (Functional Design): 30 rows: **25 Covered**, 5 N/A with their reasons, **0
Missing**. At Code Generation each Covered row becomes Implemented, and Verified when its cases
pass through the Python driver on 3.11 and the newest release (and `e2e-python`, where named) on
U4's code PR.

**Code Generation** (U4 G1 to G10): the 25 applicable rows are **Implemented** in the modules
named, and every named case passes through the Python driver: 96 of 96 locally on 3.11.18 and
3.15.2 (CC-SEC-05 skipped locally only), and 97 of 97 on every `conformance-python` entry of push
run 44668858650. The end-to-end rows (L1-12, L1-13, L1-25, L1-27) passed in the local run of
the Python scenario against soorma-core's stack (plan Step 40). They become **Verified** on the
code PR's own run.

**Verified** on the code PR's own run, CI run 44670863814 (soorma-ai/soorma-sdk#23, head `fb3ae20`): every case 97 of 97 on each `conformance-python` entry, and `e2e-python` green (the end-to-end rows).
