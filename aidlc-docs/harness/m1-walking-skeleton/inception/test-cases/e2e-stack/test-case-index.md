# Test Case Index — e2e-stack

Unit abbreviation: ES = e2e-stack

| Test Case ID | Title | Source | Scope | Priority |
|---|---|---|---|---|
| TC-ES-001 | core-up brings up soorma-core at the tag | e2e-stack / FR-19 | happy-path | High |
| TC-ES-002 | core-up fails when the checkout is not the pinned commit | e2e-stack / FR-19 | negative | High |
| TC-ES-003 | core-up refuses an existing soorma-local stack | e2e-stack / FR-19 | negative | High |
| TC-ES-004 | setup registers agents A and B and writes owner-only secret files | e2e-stack / FR-19 | happy-path | High |
| TC-ES-005 | setup refuses without a fresh stack | e2e-stack / FR-19 | negative | High |
| TC-ES-006 | setup writes and prints no human secret or credential | e2e-stack / FR-19, FR-16 | negative | High |
| TC-ES-007 | A raw bootstrap per agent succeeds with the written secret | e2e-stack / FR-19, FR-04 | happy-path | High |
| TC-ES-008 | core-down removes the stack and its volumes, also after a failure | e2e-stack / FR-19 | edge/boundary | High |
| TC-ES-009 | End-to-end jobs run on pull requests and pushes to dev, not on pushes to main | e2e-stack / FR-19 | happy-path | High |
| TC-ES-010 | aidlc-docs-only changes skip the end-to-end job; anything else runs it | e2e-stack / FR-19 | edge/boundary | Medium |
| TC-ES-011 | The CI time the stack adds is measured and recorded | e2e-stack / FR-19 | happy-path | Low |
| TC-ES-012 | The same commands work locally | e2e-stack / FR-19 | happy-path | Medium |
| TC-ES-013 | The log search finds each typed prefix, naming the service and the kind | e2e-stack / FR-19, FR-16 | negative | High |
| TC-ES-014 | The log search finds the exact enrollment material and an exact agent secret | e2e-stack / FR-19, FR-16 | negative | High |
| TC-ES-015 | A clean log is printed; nothing is searched without --logs | e2e-stack / FR-19 | happy-path | Medium |
| TC-ES-016 | An unreadable log: nothing printed, fail closed, still torn down | e2e-stack / FR-19 | edge/boundary | High |
| TC-ES-017 | The prefixes come from the vendored contract; none readable fails closed | e2e-stack / FR-19 | edge/boundary | Medium |
| TC-ES-018 | core-down without an ownership record removes nothing and exits 0 | e2e-stack / FR-19 | negative | High |
| TC-ES-019 | setup refuses a bad agent identifier or secrets directory before consuming the marker | e2e-stack / FR-19 | negative | High |
| TC-ES-020 | setup stops at the first failed call and leaves nothing it opened live | e2e-stack / FR-19 | negative | High |
| TC-ES-021 | core-up refuses missing prerequisites, install scripts, and a mismatched toolchain | e2e-stack / FR-19 | negative | High |
| TC-ES-022 | A raw call that never answers times out with its step's name, and setup still ends what it opened | e2e-stack / FR-19 | edge/boundary | High |
| TC-ES-023 | A child step that never ends times out with its step's name | e2e-stack / FR-19 | edge/boundary | High |
