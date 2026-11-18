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
