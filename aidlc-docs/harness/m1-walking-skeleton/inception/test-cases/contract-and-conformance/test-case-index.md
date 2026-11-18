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
