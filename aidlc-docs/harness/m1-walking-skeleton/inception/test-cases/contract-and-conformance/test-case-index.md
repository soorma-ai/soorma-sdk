# Test Case Index — contract-and-conformance

Unit abbreviation: CAC = contract-and-conformance

| Test Case ID | Title | Source | Scope | Priority |
|---|---|---|---|---|
| TC-CAC-001 | Vendored contract matches the tag | contract-and-conformance / FR-01 | happy-path | High |
| TC-CAC-002 | Drift check fails on a modified vendored file | contract-and-conformance / FR-01 | negative | High |
| TC-CAC-003 | Drift check fails on an added file | contract-and-conformance / FR-01 | edge/boundary | High |
| TC-CAC-004 | Drift check fails on a removed file | contract-and-conformance / FR-01 | edge/boundary | High |
| TC-CAC-005 | Drift check fails when the tag no longer peels to the pinned commit | contract-and-conformance / FR-01 | edge/boundary | Medium |
| TC-CAC-006 | Maintainer documentation routes an insufficient contract to soorma-core | contract-and-conformance / FR-01 | happy-path | Medium |
| TC-CAC-007 | Generated-types check fails on a stale or edited generated file | contract-and-conformance / FR-01 | negative | High |
| TC-CAC-008 | Specification covers every required topic | contract-and-conformance / FR-02 | happy-path | High |
| TC-CAC-009 | Every statement names its cases and every case names its statement | contract-and-conformance / FR-02, FR-03 | happy-path | High |
| TC-CAC-010 | Runner fails on a statement with no case | contract-and-conformance / FR-02, FR-03 | negative | High |
| TC-CAC-011 | Case files are language-neutral data | contract-and-conformance / FR-03 | happy-path | High |
| TC-CAC-012 | Every agent-side contract fixture is used by a case | contract-and-conformance / FR-03 | edge/boundary | Medium |
| TC-CAC-013 | Deep-payload cases test the fallback, never a fixed depth | contract-and-conformance / FR-03 | edge/boundary | High |
| TC-CAC-014 | Stub replays scripted responses and records requests byte for byte | contract-and-conformance / FR-03 | happy-path | High |
| TC-CAC-015 | Reference driver passes every case it covers | contract-and-conformance / FR-03 | happy-path | High |
| TC-CAC-016 | Negative control: a driver that retains the secret fails | contract-and-conformance / FR-03 (FR-04) | negative | High |
| TC-CAC-017 | Negative control: a driver that reorders the forwarded envelope's text fails | contract-and-conformance / FR-03 (FR-09) | negative | High |
| TC-CAC-018 | Negative control: a driver that retries a publish fails | contract-and-conformance / FR-03 (FR-10) | negative | High |
| TC-CAC-019 | Negative control: a driver that skips a stream boundary item fails | contract-and-conformance / FR-03 (FR-11) | negative | High |
| TC-CAC-020 | Runner fails when a driver skips a case | contract-and-conformance / FR-03 | negative | High |
| TC-CAC-021 | Reference and negative-control drivers are in neither package | contract-and-conformance / FR-18 | edge/boundary | Medium |
| TC-CAC-022 | Name table lists every operation and concept in both spellings | contract-and-conformance / FR-17 | happy-path | High |
| TC-CAC-023 | Names check fails on an export not in the table, or a table name not exported | contract-and-conformance / FR-17 | negative | High |
| TC-CAC-024 | SPDX check fails on a source file without the licence header | contract-and-conformance / FR-18 | negative | Medium |
| TC-CAC-025 | --offline is local only and says so | contract-and-conformance / FR-01 (NFR-U1-13) | negative | Medium |
| TC-CAC-026 | --local-skip accepts only CC-SEC-05, only outside CI | contract-and-conformance / FR-03 (NFR-U1-15, -16) | negative | High |
| TC-CAC-027 | Over budget: the run finishes, then fails, naming the slowest cases | contract-and-conformance / FR-03 (NFR-U1-01, -04) | edge/boundary | Medium |
| TC-CAC-028 | A hung run is stopped by the watchdog | contract-and-conformance / FR-03 (NFR-U1-09) | edge/boundary | Medium |
| TC-CAC-029 | A case timeout fails that case only | contract-and-conformance / FR-03 (NFR-U1-09) | negative | Medium |
| TC-CAC-030 | A new driver process per case; a crash fails one case | contract-and-conformance / FR-03 (NFR-U1-07, -09) | negative | High |
| TC-CAC-031 | The runner has no retry | contract-and-conformance / FR-03 (NFR-U1-05) | negative | Medium |
| TC-CAC-032 | A case with too narrow a timing window is rejected | contract-and-conformance / FR-03 (NFR-U1-06) | negative | Medium |
| TC-CAC-033 | Secrets and heap snapshots never leave the run | contract-and-conformance / FR-03 (NFR-U1-19; P-04) | negative | High |
| TC-CAC-034 | The run directory and CAs are removed, also on failure | contract-and-conformance / FR-03 (NFR-U1-21) | edge/boundary | Medium |
| TC-CAC-035 | The stub listens on loopback only | contract-and-conformance / FR-03 (NFR-U1-20) | negative | Medium |
| TC-CAC-036 | DCO: another author's commit without a sign-off fails | contract-and-conformance / NFR-11 (NFR-U1-32) | negative | High |
| TC-CAC-037 | DCO: an unverified commit with a `[bot]` email fails | contract-and-conformance / NFR-11 (NFR-U1-29, -32) | negative | High |
| TC-CAC-038 | DCO: a human commit pushed into a Dependabot PR fails | contract-and-conformance / NFR-11 (NFR-U1-32) | negative | High |
| TC-CAC-039 | DCO: a lookup error fails closed | contract-and-conformance / NFR-11 (NFR-U1-31) | negative | High |
| TC-CAC-040 | DCO: a verified Dependabot commit passes on its own PR | contract-and-conformance / NFR-11 (NFR-U1-32) | happy-path | High |
| TC-CAC-041 | DCO: the same commit passes on the dev → main PR | contract-and-conformance / NFR-11 (NFR-U1-32) | happy-path | High |
| TC-CAC-042 | DCO: the token comes from an action input; permissions read-only | contract-and-conformance / NFR-11 (NFR-U1-30) | negative | High |
| TC-CAC-043 | The workflow check catches unpinned or over-privileged workflows | contract-and-conformance / NFR-07 (NFR-U1-28) | negative | High |
| TC-CAC-044 | Dependabot targets dev with a 7-day cooldown | contract-and-conformance / NFR-07 (NFR-U1-27) | happy-path | Medium |
| TC-CAC-045 | Frozen install and audit gate CI | contract-and-conformance / NFR-07 (NFR-U1-24, -26) | negative | Medium |
