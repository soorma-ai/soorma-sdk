# AI-DLC Audit Log — harness/contract-core2 (soorma-sdk)

A follow-up to `harness/m1-walking-skeleton` (complete, soorma-ai/soorma-sdk#26), for
soorma-ai/soorma-sdk#27. One entry per decision.

## Initial User Request
**Timestamp**: 2026-11-21T00:27:34Z (logged at this time; the request opened the session earlier on 2026-11-20 UTC)
**User Input**: "work on soorma-sdk issue #27 using the following...

soorma-sdk: pin soorma-core's contract-v0.1.0+core.2; discharge OBL-05; answer GAP-CAC-001

soorma-core tagged contract-v0.1.0+core.2: an annotated tag peeling to
0405e2a96a9389cab45e67312de903fd42f5d01e on main. It names the same wire contract, 0.1.0,
at soorma-core revision 2; contract/conventions/versioning.md, \"soorma-core revisions:
+core.N\", defines the scheme. CONTRACT_VERSION stays '0.1.0' (clients declare the version
alone, never the +core.N). It carries both:
- soorma-ai/soorma-core#36's fix (since +core.1): the local stack's leaf certificates have
  Subject and Authority Key Identifiers, so Python 3.13+'s default context verifies them
- the answer to GAP-CAC-001 (soorma-ai/soorma-core#34): contract/conventions/credentials.md,
  Revocation and Lifetimes, and renewAgentCredential's description now say \"A token issued
  before a renewal stays valid until its own expiresAt unless the credential or its agent is
  revoked, and renewing with it is accepted.\" 0.1.0 has behaved this way since contract-v0.1.0.
Never move or recreate contract-v0.1.0, +core.1 or +core.2.

The stack is unchanged for core-up: .node-version 26.13.0, packageManager pnpm@12.18.0,
pnpm-lock.yaml unchanged since c1e3d7f, the stack's names and ports unchanged. Nothing outside
contract/ changed between +core.1 and +core.2.

The new pin (from git; contract.pin.json today records contract-v0.1.0):
  tag     contract-v0.1.0+core.2
  commit  0405e2a96a9389cab45e67312de903fd42f5d01e   (was c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d)
  tree    8d375fd66899184b4d7871e188d02268a992325e   (was 38900083586024a832c05af04789fc0639dc9e2f)
  files   234, none added or removed; these 8 change (SHA-256, old -> new):
    contract/CHANGELOG.md                dd9e3c91…ffd4 -> faac1040de02e8b7499de21be5072605569ce38affd9f1fdced3ab61a4e7684f
    contract/README.md                   a42a4f88…a8e8 -> e3edf591ac7309c4acff44919f235190c57869932780db8689edd611d0e5898b
    contract/conventions/credentials.md  736aa24e…f797 -> 1179d9f2b3707caab0d1efa7dfc1ea8888344f0e155cd581349fc704e7759be2
    contract/conventions/versioning.md   ea19796e…9134 -> b0e2d30168e29fb87eab32b7524ba3e9dd8d4f08d16ca22b873fab37a7623df8
    contract/data-gateway.openapi.yaml   3bf319d7…7d27 -> b4b3f8effbb1f9dc5f76d25846b8d855c85ae622e5b28c07dc9359080125a2b5
    contract/generated/data-gateway.ts   3c37a047…aaa0 -> 660c90799b09529b72d98104487e1e8a4f02c86162731b8e46ad151d31029a87
    contract/test/conventions.test.ts    1406457f…31ef -> 9a17c95a42f1700ece82730552933205958275708896028cd20ceccd1fd93152
    contract/test/data-gateway.test.ts   b34163e4…51e  -> ee3d5281aeaf00725025e87f52d2648311a5a2d3bbcaf9487e2ece1e33d160b2

Do:
1. Re-vendor contract/ byte for byte from the tag (copy, never edit), then
     node tools/drift/write-pin.ts https://github.com/soorma-ai/soorma-core \\
       'contract-v0.1.0+core.2' 0405e2a96a9389cab45e67312de903fd42f5d01e \\
       8d375fd66899184b4d7871e188d02268a992325e
   Check that contract.pin.json changes exactly the tag, commit, tree, and the 8 hashes above.
   Run your type generation and pnpm checks; commit any regeneration the new OpenAPI
   description causes.
2. Update what names the old tag or commit: README.md, contract.md, DEPENDENCIES.md,
   e2e/README.md, spec/behaviour.md, e2e/src/stack.ts's header, and the tests
   e2e/src/shared.test.ts and e2e/src/log-search.test.ts. In tools/drift/check.test.ts,
   change only values that name the real pin; values that are test data stay. Quote the tag
   wherever a shell sees it. The \"+\" is fine in git refs and GitHub tree URLs, but must be
   %2B inside a URL query string.
3. OBL-05: add Python 3.15.2 to e2e-python beside 3.11.18, built and installed as the job
   does now. Update the job's comment and the Python README's limitation note, which cite
   soorma-ai/soorma-core#36.
   Record OBL-05 as discharged in aidlc-docs/harness/m1-walking-skeleton/aidlc-state.md, with
   evidence: the tag, the PR, and the green 3.15 run.
4. GAP-CAC-001: record it as answered by contract-v0.1.0+core.2,
   conventions/credentials.md, Revocation and Lifetimes. Do that in prd-gaps/
   specification-gaps.md, the register in aidlc-state.md, and build-and-test-summary.md. It was
   raised against soorma-core's contract, not a PRD: if the gap rule's status set has no exact
   fit, ask me.
   - The fail-closed work-around becomes the contract's rule, with no code-path change.
     credential_refused on a retried renewal stays terminal, because it is now a real refusal.
   - Reword TH-REN-04 and PH-REN-05, the comments in typescript/src/keeper.ts and
     python/src/soorma/_keeper.py, DEC-U1-10, and spec/behaviour.md's \"worked around fail
     closed\" line, so they cite the contract rule instead of the gap. If you find code that
     exists only because the gap was open, show it to me before removing it.
   - Add a test that a retry after a lost renewal, presenting the earlier token, succeeds:
     a. against the real stack, at +core.2: renew, then renew again presenting the first
        token: 200 with a later expiresAt; and
     b. in each keeper (TypeScript and Python): a renewal whose response is lost after the
        request is sent is retried with the earlier token, the client adopts the new
        credential, and it is not revoked.
   The existing \"credential_refused is terminal, also on a retried renewal\" tests stay.
5. One audit.md entry per decision. Ask me before starting any new AI-DLC initiative for
   this; propose the lightest record.

Rules: work on dev, one PR dev→main. Every commit uses git commit -s in my name and ends
with \"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\". PR bodies and comments end
with \"🤖 Generated with [Claude Code](https://claude.com/claude-code)\". Never put close,
closes, fix, fixes, resolve or resolves before an issue number, even negated: write \"for #N\".
Grep every body and comment for them before posting, and before stopping show that
gh pr view N --json closingIssuesReferences is empty. This tracking issue is closed by hand
after the merge, with a comment linking the PR and its merge commit. Stop when every required check passes;
I merge."
**AI Response**: "Verified at soorma-core: 'contract-v0.1.0+core.2' is an annotated tag peeling to 0405e2a96a9389cab45e67312de903fd42f5d01e; contract/ at it is tree 8d375fd66899184b4d7871e188d02268a992325e (the root tree is 072fe2e, not the pinned value). Between +core.1 and +core.2 only contract/ changed (7 files; the eighth hash, contract/README.md, changed at +core.1). Proceeding on dev, from fca0d20."
**Context**: Initiative start (follow-up to harness/m1-walking-skeleton); tracking issue soorma-ai/soorma-sdk#27

---

## Decision: re-vendor at contract-v0.1.0+core.2 and write the pin
**Timestamp**: 2026-11-21T00:27:34Z
**User Input**: (none; step 1 of the request)
**AI Response**: "contract/ removed and re-extracted from the tag with git archive (no edit). git status: the 8 listed files modified, none added or removed. write-pin.ts (it checks that the tag peels to the commit by git ls-remote) wrote 234 files; git diff contract.pin.json changes exactly the tag, commit, tree and the 8 hashes in the request. Type generation: node typescript/scripts/generate.ts changes typescript/src/generated/data-gateway.ts only (renewAgentCredential's description, the renewal rule); node python/scripts/generate.ts changes nothing. pnpm checks: contract drift ok, local and remote halves (contract-v0.1.0+core.2 -> 0405e2a…, tree 8d375fd…); generated types ok. Commit 754fefb."
**Context**: Pin; the regeneration committed with it

---

## Decision: names of the old tag and commit
**Timestamp**: 2026-11-21T00:27:34Z
**User Input**: (none; step 2 of the request)
**AI Response**: "Updated to contract-v0.1.0+core.2 (and 0405e2a… where the commit is named): README.md (2), contract.md (the tag link, as a GitHub tree URL with a literal '+'; the commit; a paragraph on +core.N and the unchanged soorma-contract-version 0.1.0; GAP-CAC-001 named as answered; the write-pin command with the tag quoted), DEPENDENCIES.md, e2e/README.md, spec/behaviour.md's header, e2e/src/stack.ts's header, e2e/src/shared.test.ts (tag and commit read from the real contract.pin.json), e2e/src/log-search.test.ts (TAG). tools/drift/check.test.ts unchanged: its 'contract-v0.1.0' is a tag the test creates in a temporary local remote, test data, never the real pin. No URL query string names the tag. git grep of the old tag and commit outside contract/, aidlc-docs/ and check.test.ts: none left. Commit 23a2501."
**Context**: References

---

## Decision: CC2-Q1, GAP-CAC-001's status
**Timestamp**: 2026-11-21T00:27:34Z (asked and answered earlier in this session; logged at this time)
**User Input**: "Resolved — contract amended"
**AI Response**: "Asked because prd-gap-classification.md's status set has no exact fit: every 'Resolved —' value names a PRD, and GAP-CAC-001 was raised against soorma-core's wire contract. Options offered: 'Resolved — contract amended' (recommended: a new value, the contract's analogue of 'Resolved — PRD amended'), 'Resolved — PRD amended' word for word, 'Resolved — answered elsewhere'. Recorded as 'Resolved — contract amended', Resolved by soorma-core contract @ contract-v0.1.0+core.2, conventions/credentials.md, Revocation and Lifetimes, in the gap entry, the register in m1's aidlc-state.md and build-and-test-summary.md; each notes that the value is not in the rule's set, which names only PRDs."
**Context**: GAP-CAC-001 status (question CC2-Q1)

---

## Decision: CC2-Q2, the record for this work
**Timestamp**: 2026-11-21T00:27:34Z (asked and answered earlier in this session; logged at this time)
**User Input**: "New small initiative"
**AI Response**: "Options offered: a post-completion section in m1-walking-skeleton's aidlc-state.md (recommended as the lightest) or a new small initiative holding only aidlc-state.md and audit.md. The user chose the new initiative: aidlc-docs/harness/contract-core2/ with aidlc-state.md and this audit.md, cross-linked from m1-walking-skeleton. No AI-DLC stage runs in it. OBL-05 and GAP-CAC-001 are still updated where m1 records them, as the request asks."
**Context**: Initiative record (question CC2-Q2)

---

## Decision: no code exists only because GAP-CAC-001 was open
**Timestamp**: 2026-11-21T00:27:34Z
**User Input**: (none; reported with CC2-Q2)
**AI Response**: "Searched typescript/src, python/src, conformance and the tests for the gap and for the sent/unsent split. The work-around was a policy with no code path of its own: credential_refused ends in revoke() on any renewal, first or retried (keeper.ts #renew, _keeper.py _renew). The transport's sent flag (TransportFailure.sent; TransportError._sent) belongs to DEC-U1-10 in general and changes no retry decision. Nothing proposed for removal; no code path changed."
**Context**: GAP-CAC-001 (step 4, the 'show me before removing' check)

---

## Decision: OBL-05, e2e-python on 3.11.18 and 3.15.2
**Timestamp**: 2026-11-21T00:27:34Z
**User Input**: (none; step 3 of the request)
**AI Response**: "e2e-python becomes a matrix over python [3.11.18, 3.15.2] (fail-fast false), the same steps: uv python install, uv build, a fresh venv on that version, the locked otel-latest requirements hash-checked, the wheel with --no-deps. The version reaches the run script through env (PYTHON_VERSION), never interpolated into it. The job name gains the version; soorma-sdk main's ruleset requires only 'Check sign-off', so no required check is renamed. The job's comment and python/README.md's limitation note now say that the stack's certificates carry key identifiers from contract-v0.1.0+core.1 (soorma-ai/soorma-core#36) and that only the earlier tag needs 3.11 or 3.12; README.md's local-run line no longer limits Python to 3.11 or 3.12. Commit 90b58a4. Discharged in m1's aidlc-state.md once the PR's 3.15 run is green."
**Context**: OBL-05

---

## Decision: GAP-CAC-001's citations become the contract rule
**Timestamp**: 2026-11-21T00:27:34Z
**User Input**: (none; step 4 of the request)
**AI Response**: "Reworded to cite contract-v0.1.0+core.2, conventions/credentials.md, Revocation and Lifetimes: TH-REN-04 and PH-REN-05 (the earlier token stays valid until its own expiresAt and renewing with it is accepted; a retried renewal presenting it succeeds; credential_refused on it is a real refusal, terminal; was the gap's fail-closed work-around, no code-path change), DEC-U1-10 in U1's business rules and in spec/behaviour.md (the same row: renewal repeats are settled by the contract rule; the history of the gap kept in a parenthesis), spec/behaviour.md's 'worked around fail closed' line (now: resolved, the contract's rule is what the SDK does), and the comments in keeper.ts and _keeper.py. The existing TypeScript test 'credential_refused is terminal, also on a retried renewal' is unchanged except its title's citation (TH-REN-04 for GAP-CAC-001); Python's test_a_refused_renewal_is_terminal unchanged. Left as history: m1's audit, L1 matrices and enrichment deltas, which record what was true when written. Commit 7d58b29."
**Context**: GAP-CAC-001 (step 4)

---

## Decision: the keeper tests for a retry after a lost renewal
**Timestamp**: 2026-11-21T00:27:34Z
**User Input**: (none; step 4b of the request)
**AI Response**: "typescript/src/keeper.test.ts: 'a renewal whose response is lost after sending is retried with the earlier token and adopted': the first renewal throws TransportFailure('connection', sent true), the retry returns a later credential; asserts both renewals present 'Bearer soorma_ac_one', the listener sees a renewal (not a new lineage) and no revocation, the keeper is usable and hands out the new token, one provider call. python/tests/test_keeper.py: test_a_renewal_lost_after_sending_is_retried_with_the_earlier_token_and_adopted, the same with TransportError('connection', sent=True). Each fails when the retry policy is mutated to stop retrying a sent request (checked, then restored). Runs: pnpm test 303 passed; pytest 396 passed on 3.11.18 and on 3.15.2; ruff, mypy --strict clean. Local note: the machine's uv is 0.6.14, which cannot sync this project (no-build); every Python run used uv 0.13.8 (uvx uv@0.13.8), the version CI pins; the first attempt with 0.6.14 had recreated python/.venv (git-ignored)."
**Context**: GAP-CAC-001 (step 4b)

---

## Decision: the real-stack test
**Timestamp**: 2026-11-21T00:27:34Z
**User Input**: (none; step 4a of the request)
**AI Response**: "typescript/e2e/renewal-rule.test.ts, raw calls with U2's helpers (e2e/src/https.ts call; contract-ops checkResponse): bootstrap agent-a as instance e2e-renewal-rule; after 1.1 s renew with that token (200, schema-valid, same agent, instance and environment, later expiresAt); after 1.1 s renew again with the first token: 200, schema-valid, expiresAt later than the first token's, a different token. It lives under typescript/e2e/ so CI's e2e-typescript job runs it against the real stack at the pin with no workflow change; prove-stack is left as designed (PS-01 to PS-06: bootstrap only, no renewal). typescript/e2e/vitest.config.ts runs its files one at a time (fileParallelism false) so the test never overlaps the scenario's timing. Not run against a local stack: proven by the PR's e2e-typescript run."
**Context**: GAP-CAC-001 (step 4a)

---

## PR opened
**Timestamp**: 2026-11-21T00:35:49Z
**User Input**: (none)
**AI Response**: "Push run 44843922365 on 7d58b29: all 16 jobs green, both e2e-python entries and e2e-typescript included (renewal-rule.test.ts passed in 2.4 s, beside the scenario). The PR body was grepped for close, closes, fix, fixes, resolve and resolves before an issue number: none ('For #27'). Opened soorma-ai/soorma-sdk#28, dev → main; gh pr view 28 --json closingIssuesReferences: []."
**Context**: PR soorma-ai/soorma-sdk#28

---

## Decision: OBL-05 discharged, with evidence
**Timestamp**: 2026-11-21T00:35:49Z
**User Input**: (none; step 3 of the request)
**AI Response**: "#28's run 44844441207 (pull_request, head 7d58b29): success; End-to-end, Python 3.15.2 is job 136660621071, success; End-to-end, Python 3.11.18 job 136660620941, success; DCO 44844441252 success. On the push run's 3.15.2 entry the log shows 'Installed Python 3.15.2', 'core-up: soorma-core contract-v0.1.0+core.2 (0405e2a96a9389cab45e67312de903fd42f5d01e) is up as soorma-local', and the Python scenario step passing. m1's OBL-05 row records it Discharged with the tag, #28 and the runs; m1's Open follow-ups line and build-and-test-summary.md (the OBL-05 bullet and a new 'After completion: contract-v0.1.0+core.2' section) say so too."
**Context**: OBL-05

---

## Decision: GAP-CAC-001 recorded resolved in m1
**Timestamp**: 2026-11-21T00:35:49Z
**User Input**: (none; step 4 of the request, with CC2-Q1)
**AI Response**: "m1's specification-gaps.md: Resolved by soorma-core contract @ contract-v0.1.0+core.2 (0405e2a…), conventions/credentials.md Revocation and Lifetimes, and renewAgentCredential's description; Status 'Resolved — contract amended', with the was-status kept; a Resolution subsection (option 1; no code-path change; the proofs; this initiative). m1's register row: the same status and Resolved by. m1's Consumed contract line notes the re-pin. build-and-test-summary.md: the GAP-CAC-001 bullet points to the new After completion section; Open gaps now 0."
**Context**: GAP-CAC-001

---

## Merge recorded; initiative complete
**Timestamp**: 2026-11-21T00:54:11Z
**User Input**: "#28 is merged as 3f09adf (2026-11-21T00:50:32Z).

1. Fast-forward dev to main and push.
2. Record the merge in aidlc-docs/harness/contract-core2/ (aidlc-state.md and an audit.md entry, with a real timestamp) and mark the initiative complete. Commit with -s and the Co-Authored-By line, and push to dev. This rides with the next soorma-sdk PR; don't open one now.
3. Comment on #27: done in #28, merged as 3f09adf. The pin is at contract-v0.1.0+core.2, OBL-05 is discharged (cite the 3.15.2 e2e run), and GAP-CAC-001 is Resolved — contract amended. Grep the comment for closing keywords, post it, then run gh issue close 27.
Then STOP."
**AI Response**: "Checked on GitHub: #28 MERGED as 3f09adfac51cf0649066c2918fa3af6215cdc1f9 at 2026-11-21T00:50:32Z. dev fast-forwarded to 3f09adf (git merge --ff-only origin/main) and pushed. aidlc-state.md: the stage COMPLETE, the final head's runs (CI pull_request 44844931427, DCO 44844931504, CI push 44844925789), the merge, and an Initiative Complete section. Then: this record committed and pushed to dev (no PR); a comment on #27 citing #28, 3f09adf, the pin, OBL-05's 3.15.2 end-to-end run (44844441207, job 136660621071) and GAP-CAC-001's status, grepped for closing keywords before posting; #27 closed with gh issue close."
**Context**: Initiative complete

---
