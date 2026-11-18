# AI-DLC Audit Log — harness/m1-walking-skeleton (soorma-sdk)

## Initial User Request
**Timestamp**: 2026-11-17T07:29:06Z
**User Input**: "Using AI-DLC, build soorma-sdk's part of M1 from the slice brief.

Target repository: soorma-sdk (empty; greenfield). soorma-core is in the workspace
read-only, for context only. Do not change it.

Entry point: the slice brief soorma-prd/backlog/m1-walking-skeleton.md, read at
soorma-prd origin/main and pinned. Build only what its soorma-sdk column in
\"Repositories and sessions\" assigns. The rest of the brief is context.
Initiative docs: soorma-sdk/aidlc-docs/harness/m1-walking-skeleton/ (from the brief).

Contract: soorma-core's wire contract at tag contract-v0.1.0 (see soorma-sdk#2).
Pin the tag, never a branch. The handover file at soorma-core 0b19457
(aidlc-docs/platform/m1-walking-skeleton/construction/build-and-test/soorma-sdk-handover.md)
is input, not scope. If the contract is insufficient, raise it against the
soorma-core initiative; never adapt it locally. Carry the handover's known
risk (S4 payload nesting depth versus client JSON parsers) into requirements.

At intake, record the unit shapes this repository's assignment implies and
confirm them with me (prd-intake.md 1.3; units-generation.md Step 2.5).

Git: work on dev, PR dev to main. Stop at every AI-DLC approval gate and
whenever a PR needs merging. Nothing is recorded as merged until GitHub shows it."
**AI Response**: "Displayed the AI-DLC welcome message. Loaded common rules (process-overview, session-continuity, content-validation, question-format-guide, artifact-durability) and the opt-in files of five extensions (pr-checkpoint, qa-test-cases, security-baseline, soorma-platform-invariants, tickets). Began Workspace Detection."
**Context**: Workflow start

---

## Workspace Detection
**Timestamp**: 2026-11-17T07:29:06Z
**User Input**: (none — automatic stage)
**AI Response**: "TARGET_REPO_ROOT = soorma-sdk (named explicitly by the user). INITIATIVE_ROOT = soorma-sdk/aidlc-docs/harness/m1-walking-skeleton/, from the brief's soorma-sdk column, *Initiative docs*. Created soorma-sdk/aidlc-docs/.gitignore from the artifact-durability template (it was absent). No aidlc-state.md existed: new initiative. soorma-sdk holds only README, CONTRIBUTING, DCO, LICENSE, NOTICE and .github: no source code, no build files. Greenfield; Reverse Engineering not needed. Entry point detected: slice brief soorma-prd/backlog/m1-walking-skeleton.md, pinned at origin/main commit 0aad84a27c94d8f6d7064c312aaaa2e553d162dd (Status: Ready). PRD Intake executes next."
**Context**: INCEPTION — Workspace Detection complete

---
## PRD Intake — artifacts written, questions and approval requested
**Timestamp**: 2026-11-17T07:35:38Z
**User Input**: (none since the initial request)
**AI Response**: "Ran prd-intake.md Steps 1-5.6. Brief pinned at soorma-prd origin/main 0aad84a27c94d8f6d7064c312aaaa2e553d162dd, Status Ready: proceed. Scoped to the soorma-sdk column. Milestone M1 matches build-sequence.md at origin/main (M1 entry, slice brief link, tags). PF @ prd-platform-foundations-v1.3 and ID @ prd-identity-v1.0: both Approved at their tags, versions and kinds match the brief, both on merge commit 80dd7c98 (#21). Cross-PRD checks: ID's upstream PF v1.3 consistent with the brief; no newer tags. Review PRs #4, #5, #19, #21 read: one review comment ('looks good'), no line comments; #19's body confirms OB-8 is a stated exception. Consumed contract: contract-v0.1.0, annotated tag on soorma-core main, peels to c1e3d7f3; published and pinnable. Intake sufficiency check of the contract against PF §11's six operations: no insufficiency found. Deferred questions imported: none (PF and ID: all answered). Unit shapes read from the brief: harness (Builds), no contract (Owns: nothing), no plane face; trace emission read as harness, flagged for confirmation. Build-time questions classified: 4 answered by a PRD (A-1 topics, A-2 discovery, A-3 human steps by raw calls outside the SDK, A-4 no local draft checks), 4 technology (T-1 language/runtime/packaging, T-2 payload parse depth from the handover's known risk, T-3 payload numbers, T-4 credential holding and renewal), 2 specification (GAP-INT-001 delivery guarantees = existing soorma-prd#13, worked around by the contract; GAP-INT-002 span semantics, OB-8, owner Observability, not yet raised), 0 errata. Created soorma-sdk/aidlc-docs/.gitignore earlier (absent). Artifacts: inception/prd-intake/prd-coverage-map.md, inception/prd-intake/specification-gaps.md, aidlc-state.md, and the session file inception/prd-intake/intake-questions.md (Q1 unit shapes, Q2 GAP-INT-002 routing, Q3 GAP-INT-001 comment on #13)."
**Context**: INCEPTION — PRD Intake, awaiting intake-questions.md answers, then the Step 7 approval

---
## PRD Intake — intake questions answered
**Timestamp**: 2026-11-18T02:07:55Z
**User Input**: "Intake answers: Q1 A, Q2 A, Q3 A.

Reviewed and accepted:

the brief pinned at 0aad84a;
the scope read from the soorma-sdk column;
generating types from the schemas at contract-v0.1.0, since @soorma/contract is private;
T-2's constraint that a payload too deep to parse never loses the envelope and seal;
the human steps done as raw calls outside the package.
Two additions:

Name the repository with every gap ID whenever it leaves this initiative. soorma-sdk's GAP-INT-001 is soorma-core's GAP-INT-003 (#13), and soorma-core's own GAP-INT-001 is unrelated.
Write \"soorma-sdk GAP-INT-002\" in the new issue.
In the #13 comment, write \"soorma-sdk GAP-INT-001 (= soorma-core GAP-INT-003)\".
GAP-INT-002's workaround: the SDK installs no exporter, so done when 5 is proven by an exporter the test installs, such as an in-memory one, not one the SDK ships. Record that in the gap entry, so Requirements Analysis carries it into done when 5's proof.
Log the answers in audit.md word for word. Then:

open the soorma-prd issue for GAP-INT-002, labelled spec-gap;
add the comment to soorma-prd#13;
record both URLs;
present the intake approval gate."

**Answers Recorded** (inception/prd-intake/intake-questions.md):
- Q1 — Unit shapes for this repository: A — "Harness only. Every unit is a harness unit, trace emission included. No contract, plane face, or ordinary unit"
- Q2 — GAP-INT-002, span semantics (Observability, OB-8): A — "Raise and work around. Open an issue on soorma-prd labelled spec-gap, status Awaiting PRD: Observability. In M1, emit spans only through the OpenTelemetry API with OpenTelemetry's messaging semantic conventions, no soorma-defined names or attributes, no exporter or sampler installed by the SDK, and the span shape documented as unstable"
- Q3 — GAP-INT-001, delivery guarantees (already soorma-prd#13): A — "Comment on soorma-prd#13 with this initiative's entry"

**AI Response**: "Recorded the answers in intake-questions.md (all Answered). Applying the two additions: every gap ID leaving this initiative is repository-qualified (soorma-sdk GAP-INT-00n); GAP-INT-002's entry records that done when 5 is proven by an exporter the test installs (for example an in-memory one), never one the SDK ships. Then: commit the gap entries, open the soorma-prd issue for soorma-sdk GAP-INT-002 labelled spec-gap, comment on soorma-prd#13 as soorma-sdk GAP-INT-001 (= soorma-core GAP-INT-003), record both URLs, and present the intake approval gate."
**Context**: INCEPTION — PRD Intake, Step 5.6 routing (prd-gap-classification.md Step 3, option A for both gaps)

---
## PRD Intake — gaps routed
**Timestamp**: 2026-11-18T02:09:55Z
**User Input**: (none — executing the instructions logged at 2026-11-18T02:07:55Z)
**AI Response**: "Committed the intake artifacts on dev as d1e030696c0cb612757071522368af3cf857d21d and pushed, so the issue links resolve to a fixed commit. Checked soorma-prd's open spec-gap issues: none covers span semantics. Opened https://github.com/soorma-ai/soorma-prd/issues/37, 'Specification gap from build: span semantics for the trace the SDK emits (soorma-sdk GAP-INT-002)', labelled spec-gap, raised against PF @ prd-platform-foundations-v1.3, with the gap entry verbatim and permalinks pinned to d1e0306. Commented on soorma-prd#13 as 'soorma-sdk GAP-INT-001 (= soorma-core GAP-INT-003)', with the entry verbatim and a pinned permalink: https://github.com/soorma-ai/soorma-prd/issues/13#issuecomment-6966876924. Recorded both URLs in specification-gaps.md, the aidlc-state.md register and the coverage map. Statuses: soorma-sdk GAP-INT-001 Awaiting PRD: Event, worked around; soorma-sdk GAP-INT-002 Awaiting PRD: Observability, worked around (OpenTelemetry API only; no SDK exporter or sampler; span shape unstable; done when 5 proven by a test-installed exporter). Presenting the PRD Intake approval gate (prd-intake.md Step 7)."
**Context**: INCEPTION — PRD Intake, gaps routed; approval gate presented

---
## PRD Intake — approval
**Timestamp**: 2026-11-18T02:14:55Z
**User Input**: "B: Continue to Requirements Analysis.

Intake reviewed and accepted:

soorma-prd#37 and the #13 comment, both naming their repository, with links pinned to d1e0306;
the done when 5 check that the span's trace ID matches the traceparent on the envelope B receives;
committing on dev before approval, so the links could be fixed.
Log my approval in audit.md word for word, then start Requirements Analysis.

Carry T-2's constraint, that a payload too deep to parse never loses the envelope and seal, as a requirement.
Carry GAP-INT-002's workaround as stated.
When you present the extension opt-ins, include the security baseline's deployment choice (hosted or local-only), with your recommendation for a client library."
**AI Response**: "PRD Intake approved (option B). Recorded the intake approval in aidlc-state.md (prd-intake.md Step 8). prd-gap-classification.md loaded and kept active for every later stage (spine, PRD Intake step 15). Starting Requirements Analysis."
**Context**: INCEPTION — PRD Intake complete; Requirements Analysis begins

---
## Requirements Analysis — verification questions
**Timestamp**: 2026-11-18T02:16:51Z
**User Input**: (none since the intake approval)
**AI Response**: "Loaded requirements-analysis.md. Step 0: loaded the coverage map and PF @ prd-platform-foundations-v1.3, ID @ prd-identity-v1.0. Intent: new project (greenfield client library), clear request, multiple components, moderate complexity; depth Standard, with traceability to PF FR-005, FR-023, §11 and done when 2, 3, 5. Carried into requirements without asking, per the user's instruction: T-2's constraint (a too-deep payload never loses the envelope and seal) and GAP-INT-002's work-around as stated, including the done when 5 proof by a test-installed exporter matching the traceparent B receives. Read the security baseline's deployment-context section only (full rules not loaded before opt-in) to make the deployment recommendation. Created inception/requirements/requirement-verification-questions.md with 15 questions: Part 1 (technology and delivery, confirming T-1 to T-4) Q1 language and runtime, Q2 packaging, Q3 how the contract is taken, Q4 too-deep payload surface, Q5 payload numbers, Q6 registration secret and re-bootstrap, Q7 subscriptions across renewal and stream ends, Q8 retries, Q9 where done when 2/3/5 are proven, Q10 runnable example; Part 2 (extension opt-ins) Q11 security baseline with deployment context (recommended A2 local-only), Q12 platform invariants, Q13 PR checkpoint, Q14 QA test cases, Q15 tickets."
**Context**: INCEPTION — Requirements Analysis, Step 6 gate: awaiting answers

---
## Requirements Analysis — answers received
**Timestamp**: 2026-11-18T02:37:58Z
**User Input**: "Answers: Q1 X: both TypeScript and Python in this initiative, TypeScript first (details below), Q2 A for both packages, Q3 A, Q4 A, Q5 A, Q6 A, Q7 A, Q8 A, Q9 A (per language), Q10 A (a runnable example per language), Q11 A with A2 (local-only), Q12 A, Q13 A, Q14 A3, Q15 B (GitHub issues on soorma-ai/soorma-sdk: one tracking issue with a sub-issue per unit).

Q1 in detail: two languages, one behaviour.

Language-neutral, defined once:
the contract, copied once at contract-v0.1.0;
a harness behaviour specification: what each PF §11 operation does, which Problem codes surface, the retry rules, how stream ends and new streams appear, the deep-payload fallback, forwarding the exact JSON, and the span rules;
a shared conformance suite of language-neutral case files that every language must pass.
Per language:
types generated from the copied contract;
an idiomatic public interface, with the same semantics and names under one stated naming convention;
the same e2e scenario for done when 2, 3 and 5 against a running soorma-core.
Order: TypeScript first (Node 22 LTS), which I need for example apps; Python 3.11+ second.
M1's done when 2, 3 and 5 need one language. This initiative's Build and Test requires both.
The repository layout has room for further languages, e.g. typescript/, python/, contract/, conformance/. Propose it at Application Design.
Unit shapes: this amends intake's \"harness only\". The conformance suite is an ordinary unit by F45's rule; the rest are harness units. Record the amended list and confirm it with me at Units Generation.
Q4's depth bound is sized per language at NFR Requirements. The conformance suite tests the fallback behaviour, not the number.
Two additions to the requirements:

Q4: the code that pulls out the envelope and seal from a Delivery must not depend on the order of its members. The contract doesn't promise an order.
Q5 / PF FR-005: forwarding inbound context sends the envelope's JSON exactly as received, never re-serialized from the parsed object. Keep the received envelope's text with each Delivery, in both languages.
A blocker to fix first: DCO sign-off.

soorma-sdk's .github/workflows/dco.yml fails any PR with a commit that lacks Signed-off-by:. Your commits d1e0306 and f210493 lack it.
I authorise you to sign off commits in my name (Amit Bhadoria <gnulib@gmail.com>), on these two and on every later commit in this repository. Use git commit -s, and keep the Co-Authored-By line as well.
Run git rebase --signoff origin/main on dev, check every commit in origin/main..dev carries the sign-off, then force-push dev. Force-pushing is allowed only on dev, only this once.
Then repair the links: edit soorma-prd#37's body and your comment on #13 so every link to d1e0306 points to the new commit ID. Check both links resolve.
Record the change and the new commit IDs in audit.md.
Log the answers in audit.md word for word, then write the requirements and present the approval gate."

**Answers Recorded** (inception/requirements/requirement-verification-questions.md):
- Q1 — Language and runtime: X — "both TypeScript and Python in this initiative, TypeScript first (details below)", with the detail above ("Q1 in detail: two languages, one behaviour" ... "Propose it at Application Design.")
- Q2 — Packaging in M1: A — "Buildable package, not published", "for both packages"
- Q3 — How the SDK takes the contract: A — vendor contract/ at contract-v0.1.0 with a check against the tag; types generated from the copy; fixtures as conformance tests
- Q4 — Too-deep payload: A — raw-text fallback; envelope and seal parsed and forwardable; bound sized at NFR Requirements ("sized per language at NFR Requirements. The conformance suite tests the fallback behaviour, not the number.")
- Q5 — Payload numbers: A — native parsing, with the raw text available
- Q6 — Registration secret: A — a secret provider called for each bootstrap; the secret kept only for that call
- Q7 — Subscriptions: A — re-subscribe, and surface every boundary
- Q8 — Retries: A — retry where repeating is harmless (bootstrap, renewal, subscribe on 503, honouring Retry-After, bounded); never retry publish
- Q9 — Where done when 2, 3, 5 are proven: A — "per language": in CI and locally, against soorma-core at contract-v0.1.0
- Q10 — Runnable example: A — "a runnable example per language"
- Q11 — Security baseline: A with A2 — enforced; deployment context local-only
- Q12 — soorma Platform Invariants: A — enforced
- Q13 — Team review gates (PR checkpoint): A — enabled
- Q14 — QA test cases: A3 — comprehensive
- Q15 — Tickets: B — "GitHub issues on soorma-ai/soorma-sdk: one tracking issue with a sub-issue per unit"

**AI Response**: "Fixed the DCO blocker first (below), then recorded the answers. Unit shapes amended from intake's 'harness only': the conformance suite is an ordinary unit; every other unit is harness; the amended list is confirmed at Units Generation. Loading the full rules of the five extensions opted in, writing requirements.md, and presenting the approval gate."
**Context**: INCEPTION — Requirements Analysis, answers recorded

---
## DCO sign-off repair (user-authorised force-push of dev, once)
**Timestamp**: 2026-11-18T02:37:58Z
**User Input**: (the instruction above, 'A blocker to fix first: DCO sign-off ...')
**AI Response**: "Stashed the uncommitted stage edits; ran git rebase --signoff origin/main on dev; checked every commit in origin/main..dev against dco.yml's rule (author name and email match a Signed-off-by line exactly): both ok, and both keep the Co-Authored-By line. Trees unchanged: d1e030696c0cb612757071522368af3cf857d21d -> 2c9f972a087f00769c6012644368cf6dc77ce86e (tree a5cb5ab2), f2104935 -> c3b20fc0f85b37b28d2d15b3e0d53b7edcba922c (tree ffd15322). Force-pushed dev once, with lease on f210493 (f210493...c3b20fc). Restored the stash. Repaired the links: soorma-prd#37's body (2 links) and the comment https://github.com/soorma-ai/soorma-prd/issues/13#issuecomment-6966876924 (1 link) now point to 2c9f972a087f00769c6012644368cf6dc77ce86e; no link to d1e0306 remains. All three URLs return HTTP 200, and the two anchors match the gap headings at 2c9f972. Earlier audit entries that cite d1e0306 are left as written: they record what was true then. From now on every commit in soorma-sdk is made with git commit -s, keeping the Co-Authored-By line."
**Context**: Git — DCO compliance for soorma-sdk dev

---
## Requirements Analysis — extensions loaded; requirements written; approval requested
**Timestamp**: 2026-11-18T02:40:40Z
**User Input**: (none since the answers at 2026-11-18T02:37:58Z)
**AI Response**: "Step 5.1: recorded the five opt-ins under Extension Configuration and loaded each full rules file: security-baseline.md, soorma-platform-invariants.md, pr-checkpoint.md, qa-test-cases.md, tickets.md. Security baseline local-only: wrote ## Carried Security Obligations (SECURITY-01, -02, -03, -07, -10 SBOM, -14 hosted clauses). Platform invariants: read references/platform/invariants.md at prd-platform-foundations-v1.3 and prd-identity-v1.0; identical (SHA-256 c66c017052310db17b5c9868b069f322a851191962a92003426bf9120f98d3ec); scope inherited from PF §15 and ID §15, I1 to I11 Addressed, none N/A. Unit shapes amended per RA Q1 X: conformance suite ordinary, every other unit harness; to confirm at Units Generation. Wrote inception/requirements/requirements.md: decisions D-01 to D-14; FR-01 to FR-20 (language-neutral layer FR-01 to FR-03; the six PF §11 operations FR-04 to FR-09; publish FR-10; subscribe FR-11; receiving FR-12 with order-independent extraction, the received envelope text kept, and T-2's constraint as a requirement; Problems and retries FR-13; trace emission FR-14 as GAP-INT-002's work-around, stated; configuration FR-15; boundaries FR-16; naming FR-17; packages FR-18; e2e per language FR-19; examples FR-20); NFR-01 to NFR-11. One reading flagged to the user: D-11 retries only 503, so 429 too_many_attempts is surfaced and not retried. Presenting the Requirements Analysis approval gate; User Stories is the next stage."
**Context**: INCEPTION — Requirements Analysis, approval gate presented

---
## Requirements Analysis — user's correction and approval
**Timestamp**: 2026-11-18T02:47:34Z
**User Input**: "One change, then approved.

NFR-08 and D-01: change Node 22 LTS to Node.js 24 or later, the oldest maintained LTS. Node 22 reaches end of life in April 2027. CI tests on Node 24 and Node 26; soorma-core runs on 26. Python stays 3.11+, tested on 3.11 and the newest release. This corrects my earlier answer; record it in audit.md as my correction.

Reviewed and accepted:

the DCO fix: three signed commits, links repaired and resolving;
FR-01 to FR-03, the language-neutral layer;
FR-12's extraction regardless of member order, and the raw-text fallback;
exact forwarding;
FR-13's reading that 429 too_many_attempts goes to tenant code and is never retried;
the amended unit shapes, to be confirmed at Units Generation.
With NFR-08 corrected, I approve Requirements Analysis. Log this word for word, make the change, commit with sign-off, and continue to the next stage."

**Answers Recorded** (correction to requirement-verification-questions.md):
- Q1 — Language and runtime, **corrected by the user**: TypeScript on "Node.js 24 or later, the oldest maintained LTS" (was "Node 22 LTS"); "CI tests on Node 24 and Node 26; soorma-core runs on 26". Python unchanged at 3.11+, "tested on 3.11 and the newest release". The earlier answer (2026-11-18T02:37:58Z) stands in the log as given; this entry supersedes its Node version.

**AI Response**: "Recorded the user's correction. Updated requirements.md: D-01, FR-18, NFR-08 and the done criteria now read Node.js 24 or later (oldest maintained LTS), CI matrix Node 24 and Node 26; Python 3.11+, CI matrix 3.11 and the newest release. Requirements Analysis APPROVED. Next stage: User Stories."
**Context**: INCEPTION — Requirements Analysis approved, with the user's correction to RA Q1

---
## User Stories — assessment and story plan
**Timestamp**: 2026-11-18T02:48:45Z
**User Input**: (none since the Requirements Analysis approval)
**AI Response**: "Correction to the previous entry: the Node change touched D-01, FR-18 and NFR-08 only. The done criteria in requirements.md name no Node version, so they did not change. Committed the change as de9bf96 (signed off) and pushed. Loaded user-stories.md. Step 1 assessment (working/user-stories-assessment.md): Execute: yes. High-priority criteria: customer-facing API, new user features, complex logic, two personas. Wrote working/story-generation-plan.md: six questions (Q1 personas, Q2 breakdown, Q3 stories and the two languages, Q4 acceptance-criteria format, Q5 failure paths, Q6 deliverables that are not operations) and a ten-step generation checklist, including a gap-classification pass. PRD gap classification stays active."
**Context**: INCEPTION — User Stories, Part 1 planning: awaiting answers

---
## User Stories — plan answers
**Timestamp**: 2026-11-18T02:55:43Z
**User Input**: "User Stories plan answers: Q1 A, Q2 A, Q3 A, Q4 A, Q5 A, Q6 A.

Noted:

Q3's language-neutral story set is what keeps the two SDKs from drifting apart. Every acceptance criterion must be testable as a conformance case in both languages; flag any that can only be checked in one.
Q6's example story: write it so a developer can start a new TypeScript agent from it. I'll be building example apps on the TypeScript SDK.
Log the answers in audit.md word for word, then generate the stories and personas. Run the specification-gap pass, and present the approval gate."

**Answers Recorded** (inception/working/story-generation-plan.md):
- Q1 — Personas: A — two personas: the agent developer (language-neutral) and the SDK maintainer
- Q2 — Breakdown approach: A — journey-based, along an agent instance's life; each story names its PF §11 operation
- Q3 — Stories and the two languages: A — one language-neutral story set; every criterion holds in each language and becomes a conformance case
- Q4 — Acceptance criteria format: A — Given / When / Then, each citing FR-n and its PRD or contract source, checkable by a conformance case or an e2e assertion
- Q5 — Failure paths: A — within the story whose operation fails; split past about eight criteria
- Q6 — Deliverables that are not operations: A — maintainer stories for FR-01 to FR-03; the developer's example story (FR-20); the e2e scenario as the journey stories' acceptance

**AI Response**: "Plan approved with the user's two notes: every acceptance criterion must be checkable as a conformance case in both languages, and any that can only be checked in one is flagged; the example story is written so a developer can start a new TypeScript agent from it. Executing Part 2."
**Context**: INCEPTION — User Stories, plan approved; Part 2 generation

---
## User Stories — generated; approval requested
**Timestamp**: 2026-11-18T02:58:35Z
**User Input**: (none since the plan answers at 2026-11-18T02:55:43Z)
**AI Response**: "Executed the ten plan steps, all marked [x]. personas.md: P1 agent developer, P2 SDK maintainer. stories.md: 14 language-neutral journey stories (US-01 to US-11 agent developer; US-12 to US-14 maintainer), 80 Given/When/Then criteria, each citing FR-n and its source, each tagged by check: [C] conformance case, [E] end-to-end, [A] per-language API check. Flagged per the user's note: 16 [A] criteria are checked in both languages but by each language's own test, not a shared case file (US-13 #3, one naming convention, guards them); 1 criterion is TypeScript-only by the user's request (US-11 #2, the TypeScript starter; Python counterpart US-11 #3). GAP-INT-001 carried into US-05 and US-06; GAP-INT-002's work-around as stated into US-09, including the proof by a test-installed exporter. Done when 2, 3, 5 mapped to criteria and e2e steps; 1, 4, 6, 7 noted as soorma-core's. Every FR maps to a story. Specification-gap pass: no new specification gap; T-5 (default instance identifier) and T-6 (exposing the credential's environment reference) technology; A-5 inside soorma-sdk GAP-INT-002; A-6 inherited (soorma-core GAP-INT-008, soorma-prd#27); A-7 answered by the contract; T-7 (clock skew) technology. Presenting the User Stories approval gate; next stage Workflow Planning."
**Context**: INCEPTION — User Stories, approval gate presented

---
## User Stories — approval
**Timestamp**: 2026-11-18T03:05:37Z
**User Input**: "Approve & Continue: User Stories approved. Proceed to Workflow Planning.

Reviewed and accepted:

the 14 language-neutral stories and their check tags;
US-08's byte-for-byte forwarding, with forwarding as the default path;
the 16 criteria checked by each language's own tests, with US-13 #3 as their guard;
the TypeScript starter (US-11 #2);
the gap pass's result: no new gap.
Carry into design: US-08 #4 leaves open how a forwarding hop's span relates to the trace it received, child or link. That's GAP-INT-002's open choice. Settle it in Functional Design under the workaround, consistent with done when 5's trace-ID check, and record it as a decision.

Log this word for word in audit.md, then start Workflow Planning."
**AI Response**: "User Stories APPROVED. Registered the carried item as US-Q1 under ## Deferred Questions in aidlc-state.md: how a forwarding hop's span relates to the trace it received (child or link), GAP-INT-002's open choice, deferred to Functional Design of the unit that owns trace emission; settled under the work-around, consistent with done when 5's trace-id check, and recorded as a decision. Starting Workflow Planning."
**Context**: INCEPTION — User Stories approved; Workflow Planning begins

---
## Workflow Planning — plan written; approval requested
**Timestamp**: 2026-11-18T03:06:45Z
**User Input**: (none since the User Stories approval)
**AI Response**: "Loaded workflow-planning.md and all prior artifacts. Wrote inception/working/execution-plan.md (Mermaid validated: alphanumeric node IDs, <br/> line breaks; text alternative included). Risk: medium (public interface hard to withdraw; byte-exact forwarding, order-independent extraction with fallback, stream boundaries, two languages in step). EXECUTE: Application Design (coverage map: not addressed; layout D-04, naming FR-17, public interfaces, T-5); Units Generation (confirms amended shapes, assigns GAP-INT-001/002, sets the trace-emission unit for US-Q1); tickets, QA specs, Inception PR gate (extensions); per unit Functional Design, NFR Requirements, NFR Design, QA enrichment, Design PR gate, Code Generation with Code PR; Build and Test. SKIP: Reverse Engineering (greenfield); Infrastructure Design (expected for every unit: nothing deployed; reinstated per unit if needed). Order: language-neutral layer, then TypeScript, then Python. Updated aidlc-state.md (Execution Plan Summary, stage list). Presenting the Workflow Planning approval gate."
**Context**: INCEPTION — Workflow Planning, approval gate presented

---
## Workflow Planning — approval
**Timestamp**: 2026-11-18T05:13:20Z
**User Input**: "Approve & Continue: execution plan approved. Proceed to Application Design.

Accepted: the stages to run and to skip; the order (language-neutral layer, then TypeScript, then Python); Infrastructure Design skipped with per-unit reinstatement; US-Q1 targeting Functional Design; every code PR green including DCO.

Application Design must also settle:

The examples' secret source. Secrets never go in environment variables, source, or IaC. The TypeScript starter's configuration block (US-11 #2) names where the secret comes from, never the secret itself. The provider the examples ship doesn't read an environment variable. Name that provider, for example a file path with owner-only permissions, read once per bootstrap and not retained (D-09). The end-to-end run in CI hands each agent its secret the same way.
How CI runs soorma-core. Name the mechanism: a checkout of soorma-ai/soorma-core at contract-v0.1.0, which stack script brings it up, how agents A and B are registered in one environment (raw calls outside the package, as US-11 #1 says), and how their secrets reach the SDK processes under point 1. Record the expected CI time this adds.
Log this word for word in audit.md, then start Application Design."
**AI Response**: "Workflow Planning APPROVED. Starting Application Design. The two items the user named (the examples' secret provider; how CI runs soorma-core at contract-v0.1.0, registers agents A and B, and hands their secrets over) are carried into the Application Design plan as items the design must settle."
**Context**: INCEPTION — Workflow Planning approved; Application Design begins

---
## Application Design — plan and questions
**Timestamp**: 2026-11-18T05:17:11Z
**User Input**: (none since the Workflow Planning approval)
**AI Response**: "Loaded application-design.md. Read soorma-core at contract-v0.1.0, read only (deploy/local/scripts/smoke.ts and stack-client.ts, services/data-gateway and event-ingest READMEs, .github/workflows/ci.yml, package.json, .node-version) and the step timings of its CI run 43391996560 at the tag's commit (image builds 28 s for S1 and about 6 s each for S2 to S4; stack:init 1 s; stack:up 20 s). Wrote inception/working/application-design-plan.md (git-ignored) with nine questions: Q1 repository layout, Q2 package names, Q3 naming convention, Q4 public interface shape, Q5 how a subscription reaches tenant code, Q6 the instance identifier (T-5), Q7 the secret provider and the examples' secret source (the user's item 1: fileSecret(path), no environment-variable provider, the configuration block names the path), Q8 how the conformance suite drives each language, Q9 how CI runs soorma-core and the end-to-end topology (the user's item 2: e2e/core-up clones the tag and verifies c1e3d7f3, builds S1 to S4, pnpm stack:init, pnpm stack:up; e2e/setup registers A and B in environment e by raw calls and writes each secret to a 0600 file read by fileSecret; expected about 3 to 5 minutes per end-to-end job for bring-up). US-Q1 stays deferred to Functional Design. Awaiting answers."
**Context**: INCEPTION — Application Design, questions presented

---
## Application Design — answers
**Timestamp**: 2026-11-18T05:32:10Z
**User Input**: "Answers: Q1 A, Q3 A, Q4 A, Q5 A, Q6 A, Q8 A. Q2, Q7 and Q9 are X:

Q2 X: TypeScript @soorma/sdk, under the soorma npm organisation, which I've now created (it has no packages yet). Python is distributed as soorma and imported as soorma. Both PyPI names are already mine as 0.0.0 placeholders: soorma is described as the Python client harness, and soorma-sdk points to it ("Install this instead"). Record that soorma-sdk on PyPI is a redirect, not this package's name. Nothing is published in M1 (D-05).

Q7 X: As proposed, except for what fileSecret checks before reading:

Refuse if the file is writable by group or others, readable by others, or owned by anyone other than the process's user or root.
Allow a group read, so Kubernetes secret volumes with fsGroup work, and follow symlinks, checking the final file, so Kubernetes' ..data links work.
When refusing, name the path and the reason, never the contents.
Document the matching Kubernetes setting (defaultMode: 0440 with fsGroup) and Docker setting in the README. Windows behaviour stays with Functional Design. A tenant using a secrets manager writes their own provider; the SDK still ships none that reads an environment variable.

Q9 X: As A, but with soorma-core's CI triggers (#26):

Run the end-to-end jobs on PRs and on pushes to dev, not on pushes to main. The PR run already tests the merge result.
Skip them with a job-level condition when every changed file is under aidlc-docs/.
Every run uses a fresh stack (stack:init from a clean clone, down -v at the end). The first sign-in from the handover file works only once, so e2e/setup must never run against an old stack.
Log this word for word in audit.md, then generate the Application Design."
**AI Response**: "Answers recorded in the plan. Step 8 analysis: no ambiguity; no follow-up needed. Read soorma-core's #26 pattern at origin/main (read only): a `changes` job computes the diff (pull request: base to test merge; push: before to head) and outputs false only when the diff is computable, non-empty, and every path is under aidlc-docs/; anything else runs the dependent job. The end-to-end jobs follow it. Generating the Application Design."
**Context**: INCEPTION — Application Design, answers received

---
## Application Design — design generated; approval requested
**Timestamp**: 2026-11-18T05:38:01Z
**User Input**: (none since the answers at 2026-11-18T05:32:10Z)
**AI Response**: "Generated inception/application-design/: components.md (layout per Q1 A; package names per Q2 X, recording that PyPI soorma-sdk is a redirect to soorma, not this package's name; C-01 to C-06 language-neutral, C-10 to C-22 per language), component-methods.md (initial name table; public interface in TypeScript and Python; conformance driver protocol; e2e commands), services.md (client lifecycle, credentials, streams across renewal, publish and forward, conformance, end-to-end, CI with triggers per Q9 X and expected time), component-dependency.md (matrix, patterns, Mermaid component diagram and done-when 2/3/5 sequence, each with a text alternative), application-design.md (decisions AD-01 to AD-14, traceability FR and story to component, what is left out per FR-16, misuse cases, extension compliance, gap pass). fileSecret per Q7 X: follows symlinks and checks the final file on the opened handle; refuses non-regular, group- or other-writable, other-readable, or foreign-owned (other than the process's user or root); group read allowed; README to document Kubernetes defaultMode 0440 with fsGroup and Docker; Windows to Functional Design; no environment-variable provider. CI per Q9 X: end-to-end jobs on pull requests and pushes to dev, not main; skipped only when every changed file is provably under aidlc-docs/; a fresh stack every run, with a single-use marker so e2e/setup never runs against an old stack. Expected CI time added: about 3 to 5 minutes per end-to-end job, measured at the first code PR. US-Q1 carried to the Functional Design of the unit holding C-19. Gap pass: no new specification gap. Extension compliance: security-baseline compliant or N/A (hosted clauses carried); invariants I1 to I10 compliant, I11 N/A for this stage. Presenting the Application Design approval gate; next stage Units Generation."
**Context**: INCEPTION — Application Design, approval gate presented

---
## Application Design — approval
**Timestamp**: 2026-11-18T05:51:30Z
**User Input**: "Approve & Continue: Application Design approved. Proceed to Units Generation.

Accepted: AD-01 to AD-14 as written; the 19 components; the public interface and the starting name table; the driver protocol; the end-to-end commands; the gap pass result (no new gap); US-Q1 carried to the unit holding C-19.

Carry into Functional Design (add each to the deferred-questions table, or to the owning unit's design inputs):

Record the exposed environment reference as a decision. credential.environment (organisation, project, environment) is exposed read only. That settles the open technology item from the User Stories gap pass about exposing the credential's environment reference. Record it with its trace to FR-15: the client accepts no environment and only reports what the credential says.
US-02 #3 is checked by the runtime, not reported by the driver. The driver's inspect must check the runtime itself, not list its own fields.
TypeScript: force garbage collection, take a heap snapshot, and find no occurrence of the secret's value.
Python: sys.getrefcount on the string the test provider returned is back to its value before bootstrap. Python's gc doesn't track strings.
The conformance unit's Functional Design defines both.
fileSecret must not block on a special file. Open the path without blocking (O_NONBLOCK, or the language's equivalent), check the opened handle (regular file, mode, owner), and only then read. A named pipe or device at the path is refused, never waited on.
Log this word for word in audit.md, then start Units Generation."
**AI Response**: "Application Design APPROVED. Recorded the three carried items in aidlc-state.md under ## Carried Design Inputs (CDI-01 decision: credential.environment exposed read only, settling T-6, traced to FR-15; CDI-02: US-02 #3 checked by the runtime, TypeScript heap snapshot after forced GC, Python sys.getrefcount, defined by the conformance unit's Functional Design; CDI-03: fileSecret opens without blocking, checks the opened handle, refuses a named pipe or device). Noted them in application-design.md (AD-15) and aligned the driver's inspect row in component-methods.md and C-13 in components.md. Units Generation assigns each to its owning unit. Starting Units Generation."
**Context**: INCEPTION — Application Design approved; Units Generation begins

---
## Units Generation — plan and questions
**Timestamp**: 2026-11-18T05:53:18Z
**User Input**: (none since the Application Design approval)
**AI Response**: "Loaded units-generation.md (Step 2.4 intake gaps; Step 2.5 unit shapes). Wrote inception/working/unit-of-work-plan.md (git-ignored) with three questions. Q1 the units: recommended four, in build order: U1 contract-and-conformance (ordinary; C-01 to C-04), U2 e2e-stack (ordinary, amending D-14 by one unit; C-05), U3 typescript-harness (harness; C-10 to C-22 TypeScript; M1's proof), U4 python-harness (harness; C-10 to C-22 Python); alternatives: three units (U2 folded into TypeScript, D-14 as written) or six (each language split into credentials and events). Q2 where the language-neutral behaviour is designed: recommended all in U1's Functional Design, which moves US-Q1 to U1 (the span rules C-19 implements); alternative: split, US-Q1 stays with U3. Q3 design stages for the ordinary units: recommended U2 without NFR Design. Awaiting answers."
**Context**: INCEPTION — Units Generation, questions presented

---
## Units Generation — answers
**Timestamp**: 2026-11-18T06:05:15Z
**User Input**: "Answers: Q1 A, Q2 A, Q3 A, with two additions to the units' "done when" criteria:

U1 proves its own runner. U1 includes a test-only reference driver, written against the stub, that passes every case it covers. It also includes negative controls: a driver that breaks a rule must make the runner fail, naming the case. Cover at least these broken rules:
it retains the secret;
it reorders the forwarded envelope's text;
it retries a publish;
it skips a stream boundary item.
U1's code PR shows all of them in CI. The reference driver isn't part of either package.
U2 proves the stack before U3 uses it. U2's CI job runs core-up, then setup, then one raw POST /agent-credentials per agent using the secret file setup wrote, expecting 201, then core-down. The raw calls stay outside both packages, and the job prints no secret or credential. AD-13's CI time is first measured on U2's code PR, with the run ID recorded.
Q1 A changes D-14 for U2 (ordinary, not harness), at my direction: U2 is test infrastructure that makes raw control-face calls and that no agent code links. Q2 A moves US-Q1 to U1's Functional Design, where the span rules are written; U3 and U4 implement them in C-19.

Log this word for word in audit.md, then generate the units."
**AI Response**: "Answers recorded. Step 7 analysis found one conflict with the contract: the contract at contract-v0.1.0 defines exchangeBootstrap's success response as 200 (data-gateway.openapi.yaml, responses '200'; soorma-core's smoke.ts checks 200), not 201. The contract is not adapted locally. Generated the units with U2's check expecting the contract's success response, 200, and added follow-up Q1a to the plan, to be confirmed at the Units Generation gate. Generating the units."
**Context**: INCEPTION — Units Generation, answers received; one follow-up (Q1a)

---
## Units Generation — units generated; approval requested
**Timestamp**: 2026-11-18T06:07:29Z
**User Input**: (none since the answers at 2026-11-18T06:05:15Z)
**AI Response**: "Generated inception/application-design/unit-of-work.md (four units in build order U1 contract-and-conformance ordinary, U2 e2e-stack ordinary, changed from harness at the user's direction, U3 typescript-harness harness, U4 python-harness harness; harness fields: face none, calls the data face S3 and S4, NFR profile PF §11 and §14 @ prd-platform-foundations-v1.3, edition core, repository soorma-sdk; the user's done-when additions for U1 (reference driver; negative controls for a retained secret, a reordered forwarded envelope text, a retried publish, a skipped boundary item, each failing on its named case in CI) and U2 (core-up, setup, one raw POST /agent-credentials per agent, core-down, nothing printed, CI time measured with run ID); code organization; I6 check compliant), unit-of-work-dependency.md (matrix, hand-overs, build order Mermaid with text alternative, proof points), unit-of-work-story-map.md (80 criteria by check tag; done when 2, 3, 5 to U3 then U4 on U2's stack; FRs and personas to units). Assigned soorma-sdk GAP-INT-001 and GAP-INT-002 to U1, U3, U4 in specification-gaps.md and the register; US-Q1 to U1's Functional Design; CDI-01 to CDI-03 to U1, U3, U4. aidlc-state.md: unit shapes confirmed, ## Units, per-unit stage list (U2 without NFR Design). Follow-up Q1a: the user's 201 conflicts with the contract's 200 for exchangeBootstrap; generated with 200; to confirm at the gate. Presenting the Units Generation approval gate."
**Context**: INCEPTION — Units Generation, approval gate presented

---
## Units Generation — approval
**Timestamp**: 2026-11-18T06:14:40Z
**User Input**: "Approve & Continue: Units Generation approved. Proceed to Tickets, then the QA test specs' inception pass, then the Inception PR gate.

Q1a: confirmed, 200. "201" in my addition was my error. The contract at contract-v0.1.0 defines exchangeBootstrap's success as 200, and U2 expects that. Record Q1a as answered: 200, per the contract.

Accepted: the four units and their order (U1, U2, U3, U4); the shapes, with U2 ordinary at my direction; the "done when" items and proof points; the gap and carried-item assignments, including US-Q1 to U1; the story map; the I6 check.

When the Inception PR is open and its checks are green, stop and tell me the PR number. I'll merge it; don't record it as merged until GitHub shows it.

Log this word for word in audit.md, then start Tickets."
**AI Response**: "Units Generation APPROVED. Q1a recorded as answered: 200, per the contract (exchangeBootstrap at contract-v0.1.0); the user's 201 was their error. Starting Tickets, then the QA test specs' inception pass, then the Inception PR gate; will stop with the PR number once its checks are green, and not record it as merged until GitHub shows it."
**Context**: INCEPTION — Units Generation approved; Tickets begins

---
## Tickets (extension)
**Timestamp**: 2026-11-18T06:20:15Z
**User Input**: (none since the Units Generation approval)
**AI Response**: "Generated tickets per tickets.md on GitHub issues, soorma-ai/soorma-sdk: initiative ticket #3 (tracking issue, harness — m1-walking-skeleton); unit tickets as sub-issues of #3 in build order: #4 contract-and-conformance, #5 e2e-stack, #6 typescript-harness, #7 python-harness. Each carries the required fields only (no points, sprint, priority, labels, assignee); dependencies from unit-of-work-dependency.md; a resolved Start Construction prompt. Prohibited-field scan: none found. Recorded under ## Tickets in aidlc-state.md (Status: Complete)."
**Context**: INCEPTION — Tickets complete

---
## QA test specs, inception pass (extension)
**Timestamp**: 2026-11-18T06:20:15Z
**User Input**: (none)
**AI Response**: "Generated inception test specifications at scope comprehensive, from unit-of-work.md and requirements.md only (stories and tickets not used): inception/test-cases/{contract-and-conformance (CAC, 24), e2e-stack (ES, 12), typescript-harness (TH, 66), python-harness (PH, 66)}/test-specs-narrative.md and test-case-index.md. Each case has context, preconditions, steps, expected outcome, scope, priority, backward traceability (unit / FR) and forward traceability (construction/{unit-name}/). U1's cases include the reference driver and the four negative controls; U2's include the raw bootstrap expecting 200 per the contract."
**Context**: INCEPTION — QA test specs inception pass complete

---
## Inception PR gate (extension) — instructions; PR to open
**Timestamp**: 2026-11-18T06:20:15Z
**User Input**: (none; branch dev per the user's standing instruction; the user asked to be told the PR number once its checks are green, and that merge is recorded only when GitHub shows it)
**AI Response**: "Validated the always-expected artifacts. Wrote inception/working/pr-checkpoint-instructions.md (git-ignored). Recorded ## PR Checkpoint State: Inception PR Gate PENDING, branch dev. Committing with sign-off, pushing dev, and opening the PR dev → main."
**Context**: INCEPTION — Inception PR gate

---
## Inception PR gate (extension) — PR open, checks green
**Timestamp**: 2026-11-18T06:21:08Z
**User Input**: (none)
**AI Response**: "Opened soorma-ai/soorma-sdk#8 (dev → main), title "feat(inception): harness/m1-walking-skeleton — inception phase complete", description per pr-checkpoint.md §4.2. Every commit in origin/main..dev carries a Signed-off-by. Checks: Check sign-off pass. Mergeable: clean. Stopping for the user to merge; the gate stays PENDING and nothing is recorded as merged until GitHub shows it."
**Context**: INCEPTION — Inception PR gate, awaiting merge

---
## Inception PR gate — merged
**Timestamp**: 2026-11-18T06:47:24Z
**User Input**: "soorma-ai/soorma-sdk#8 is merged: merge commit c8bffb3020e9474043608e703eb0b77fc549cb54 on main, 2026-11-18T06:34:29Z. Confirm it on GitHub, then record the Inception PR gate as approved and merged.

Sync dev: git fetch origin && git merge --ff-only origin/main on dev, then push. Fast-forward only; no new merge commit. If a merge on dev is ever unavoidable, use git merge --signoff so the DCO check passes on the next PR.

Then start Construction with U1 contract-and-conformance (#4): Construction Phase Initialization (load the five enabled extensions' rules and prd-gap-classification.md), Unit Initialization, the L1 Domain Coverage Gate, then Functional Design. U1's Functional Design writes the whole behaviour specification and settles US-Q1 (child or link) under GAP-INT-002's work-around, consistent with done when 5's trace-ID check, recorded as a decision. It also defines CDI-02's runtime checks, states CDI-01 and CDI-03, and specifies the reference driver and the four negative controls.

Log this word for word in audit.md."
**AI Response**: "Confirmed on GitHub: PR #8 MERGED at 2026-11-18T06:34:29Z, merge commit c8bffb3020e9474043608e703eb0b77fc549cb54. Recorded the Inception PR gate APPROVED and merged. Synced dev: git fetch origin; git merge --ff-only origin/main (833032f..c8bffb3, fast-forward, no merge commit); pushed; origin/dev = origin/main = c8bffb3. Starting Construction with U1 contract-and-conformance (#4)."
**Context**: INCEPTION complete; CONSTRUCTION begins

---
## Construction Phase Initialization
**Timestamp**: 2026-11-18T06:49:05Z
**User Input**: (see the entry "Inception PR gate — merged")
**AI Response**: "Construction Phase Initialization: loaded extension rules for [security-baseline, soorma-platform-invariants, pr-checkpoint, qa-test-cases, tickets]. ## PRD Intake exists: loaded inception/prd-gap-classification.md, active for every construction stage."
**Context**: CONSTRUCTION — initialization

---
## Unit Initialization — U1 contract-and-conformance
**Timestamp**: 2026-11-18T06:49:05Z
**User Input**: (none)
**AI Response**: "Unit Initialization: loaded extension rules for [security-baseline, soorma-platform-invariants, pr-checkpoint, qa-test-cases, tickets] (unit: contract-and-conformance). L1 Domain Coverage Gate: L1 sources from ## PRD Intake, PF @ prd-platform-foundations-v1.3: §7b Envelope Fields and Compatibility Policy; FR-004, FR-005, FR-006; §11 What the SDK may not populate; §9 Operations and Failure Modes; §17 Envelope, Namespacing Rules, Recognised Kinds. ID @ prd-identity-v1.0: no L1 source (constraints only). Applicable to U1 as specification statements (implementation target) and conformance cases (verification target); l1-coverage-matrix.md is produced in Functional Design and blocks completion while any row is Missing. Assessment result recorded at Functional Design completion."
**Context**: CONSTRUCTION — U1 Unit Initialization and L1 gate

---
## U1 Functional Design — plan and questions
**Timestamp**: 2026-11-18T06:50:02Z
**User Input**: (none)
**AI Response**: "Loaded construction/functional-design.md. Read contract-v0.1.0 conventions/envelope.md on the stamped traceContext of a forwarded call: the draft's traceparent is this hop's assertion; a forwarded traceparent is never carried; the contract does not choose between continuing the received trace and starting a new one. Wrote construction/working/contract-and-conformance-functional-design-plan.md (git-ignored) with eight questions, each classified technology or design under an existing work-around (no new specification gap): Q1 US-Q1 child or link (recommended A: child of the received context, with a link); Q2 which operations emit spans (A: messaging send and receive only); Q3 boundary item order on replacement (A: ended before started); Q4 what follows a non-terminal end (A: re-subscribe; unknown codes non-terminal); Q5 background renewal failures (A: no new API; next operation re-bootstraps after an unrenewed expiry); Q6 back-pressure (A: pull-based); Q7 a second subscribe() (A: ClientStateError); Q8 reference driver coverage (A: declared subset; negative controls as one fault switch each). Awaiting answers."
**Context**: CONSTRUCTION — U1 Functional Design, questions presented

---
## U1 Functional Design — answers
**Timestamp**: 2026-11-18T06:57:33Z
**User Input**: "Answers: Q1 A, Q2 A, Q3 A, Q4 A, Q5 A, Q6 A, Q7 A, Q8 A, with three additions:

Q1 (US-Q1), child, as A, except the links:

When the parent is the received context, don't link it as well. A link to your own parent adds nothing.
When tenant code has an active span that isn't the received context, link that one.
Document the deviation. Choosing the received context over the tenant's active span departs from OpenTelemetry's usual ambient-context parenting. State this in the unstable span shape documentation (GAP-INT-002's work-around), with the reason: one trace follows the event across hops.
Record the result as the US-Q1 decision and discharge US-Q1.

Q3 A, with a bounded wait. If the old stream's end hasn't arrived within a bounded time after the new stream opens, the SDK:

closes the old stream itself;
yields its stream ended with no code received;
then yields stream started and the held Deliveries.
The held Deliveries count against the bounded buffer from Q6. Name the wait's value for NFR Requirements; don't invent it.

Q4 A, with a guard against reconnect loops:

Re-subscribing after any non-terminal end, including an unknown code, uses backoff, with Retry-After taking precedence.
Consecutive ends with no Delivery received in between count against the retry limit. When the limit is reached, the subscription yields a terminal stream ended and finishes.
Name the backoff and limit values for NFR Requirements.
Give each rule a conformance case: one where the stub ends every stream at once, and one where the old stream never sends end.
Log this word for word in audit.md, then generate the Functional Design."
**AI Response**: "Answers recorded in the plan; no ambiguity found (Step 5). Generating U1's Functional Design: US-Q1 decided (child of the received context; no link to the parent; a link to tenant code's active span when it differs; the deviation from ambient-context parenting documented in the unstable span shape, with its reason) and discharged; Q3's bounded wait and Q4's backoff and consecutive-end limit specified, their values named for NFR Requirements, each with its conformance case."
**Context**: CONSTRUCTION — U1 Functional Design, answers received

---
## U1 Functional Design — generated; approval requested
**Timestamp**: 2026-11-18T07:05:50Z
**User Input**: (none since the answers at 2026-11-18T06:57:33Z)
**AI Response**: "Generated construction/contract-and-conformance/functional-design/: business-rules.md (the behaviour specification: 100 statements in 16 areas, each sourced and linked to cases; nine values named for NFR Requirements: H_renew, R_max/W_max, B_init/B_factor/B_cap, L_ends, W_super, N_buf, D_lang, T_idle, T_req; decisions DEC-U1-01 to DEC-U1-14), domain-entities.md (conformance domain, SDK concepts, the complete name table), business-logic-model.md (contract copy, PIN and the four repository checks; stub, runner, modes, negative fixtures; the driver protocol in full; CDI-02's runtime checks: TypeScript heap snapshot after forced GC, searching every string for the value and its halves; Python sys.getrefcount on the returned string against its pre-bootstrap baseline, with its stated limit; the reference driver, test only, in neither package, 23 declared cases across all 16 areas and all ten assertion kinds; four negative controls as single faults with target cases CC-SEC-01, CC-FWD-02, CC-PUB-03, CC-STR-04; the catalogue of 88 cases, every agent-side fixture used), l1-coverage-matrix.md (30 rows: 25 Covered, 5 N/A, 0 Missing), invariant-coverage-matrix.md (10 Covered, I11 N/A, 0 Missing). US-Q1 decided as DEC-U1-01 (child of the received context; no link to the parent; a link to tenant code's active span when it is not the received context; the deviation documented in the unstable span shape) and discharged in aidlc-state.md. CDI-02 defined; CDI-01 stated as CRD-03; CDI-03 stated as SEC-04 and SEC-05. The user's additions specified: Q3's bounded wait W_super (STR-05; case CC-STR-05, the old stream never sends end); Q4's backoff with Retry-After first and the L_ends limit on consecutive ends (STR-06; case CC-STR-07, the stub ends every stream at once). Flagged for the user at the gate, as decisions made here: DEC-U1-09 (no schema validation of received envelopes), DEC-U1-10 (connection failures retried like 503; TLS never), DEC-U1-11 (messaging.system = soorma), DEC-U1-12 (lineage change: open new, close old; no duplicate suppression). Gap pass: no new specification gap. L1 Domain Coverage Gate result: covered (25), non-applicable (5), missing (0). Presenting the U1 Functional Design approval gate; next stage NFR Requirements (U1)."
**Context**: CONSTRUCTION — U1 Functional Design, approval gate presented

---
## U1 Functional Design — changes requested
**Timestamp**: 2026-11-18T07:15:17Z
**User Input**: "Request Changes: two corrections to U1's Functional Design, then present the gate again.

1. DEC-U1-12: duplicates at every replacement, not only a lineage change. STR-04 opens the new stream before the platform ends the old one with superseded, so a Delivery accepted in that overlap can be read on both streams on every renewal replacement too.

Restate DEC-U1-12 and STR-05 to cover both cases.
Add to SUB-03's documentation statement: "a Delivery may be delivered twice around a stream boundary; nothing identifies a duplicate (GAP-INT-001)".
Make sure a conformance case shows a duplicate in the renewal overlap being yielded, not suppressed.
2. DEC-U1-10 / PRB-05: split connection failures by whether the request was sent.

Not sent (connection refused, DNS failure, or a timeout before the connection opened): retried for bootstrap, renewal and subscribe, as now.
Sent, no answer (reset or timeout after the request was written):
Subscribe: retry; a repeat is harmless.
Renewal: retry while the current credential is unexpired; the contract describes renewal as a new token for the same credential.
Bootstrap: retry, recording that a repeat may mint an unused credential. That credential expires within the contract's 15-minute bound, and repeats count toward the too_many_attempts abuse limit.
Publish is never retried, in either case, as now.
Record this reasoning in DEC-U1-10. If the contract's silence on repeating bootstrap or renewal turns out to matter, classify it per prd-gap-classification.md; don't assume.
Add a case for each kind of failure: a refusal before sending, and a reset after sending.
Accepted as written: DEC-U1-01 (US-Q1); STR-05 and STR-06 with CC-STR-05 and CC-STR-07; DEC-U1-09, with one follow-on: the typed envelope (ReadonlyEnvelope and its Python equivalent) mustn't claim a field is present that the SDK didn't check. Use optional types, or document it, decided in U3 and U4. Also accepted: DEC-U1-11; the CDI-02 checks and their stated Python limit; the reference driver and the four negative controls; the 88-case catalogue; both coverage matrices.

Log this word for word in audit.md, then make the changes and present the Functional Design gate again."
**AI Response**: "Making the two corrections and recording the DEC-U1-09 follow-on as a carried input to U3 and U4; then presenting the gate again."
**Context**: CONSTRUCTION — U1 Functional Design, changes requested

---
## U1 Functional Design — changes made; gate presented again
**Timestamp**: 2026-11-18T07:17:08Z
**User Input**: (see "U1 Functional Design — changes requested", 2026-11-18T07:15:17Z)
**AI Response**: "1. DEC-U1-12 and STR-05 restated: at every replacement, renewal or lineage change, a Delivery accepted while both streams are open may be read on both; both copies are yielded in STR-05's order and neither is suppressed. SUB-03 now states: "a Delivery may be delivered twice around a stream boundary; nothing identifies a duplicate (GAP-INT-001)". New case CC-STR-11: a duplicate in the renewal overlap is yielded, not suppressed. 2. DEC-U1-10 restated with the user's reasoning; PRB-05 split into PRB-05 (503), PRB-08 (not sent: retried for bootstrap, renewal, subscribe), PRB-09 (sent, no answer: subscribe retried; renewal retried while unexpired; bootstrap retried, a repeat possibly minting an unused credential expiring within 15 minutes and counting toward too_many_attempts), PRB-10 (TLS never; publish never). Cases: CC-PRB-06 (a refusal before sending) and new CC-PRB-08 (a reset after sending). Stub gains refuse and reset faults. Classified the contract's silence on repeats per prd-gap-classification.md: subscribe and bootstrap repeats technology (the contract states their consequences); renewal repeats specification: the contract does not say whether a renewal leaves the previous token valid, which decides whether credential_refused on a retried renewal is a revocation. Raised as GAP-CAC-001 (construction/contract-and-conformance/prd-gaps/specification-gaps.md; register in aidlc-state.md), raised against soorma-core's wire contract at contract-v0.1.0; work-around in place: refused on a retried renewal treated as terminal (fail closed). Routing question presented with the gate. DEC-U1-09 follow-on recorded: RCV-08 and CDI-04 (typed envelope claims no unchecked field; optional types or documented; decided in U3 and U4). Catalogue now 90 cases, 103 statements; every case in the rules exists; NEV-05 and SEC-09 exempt as before."
**Context**: CONSTRUCTION — U1 Functional Design, gate presented again with GAP-CAC-001 routing

---
## U1 Functional Design — GAP-CAC-001 routing and approval
**Timestamp**: 2026-11-18T07:24:45Z
**User Input**: "GAP-CAC-001: A. Raise it against soorma-core, keeping the work-around (a credential_refused that answers a retried renewal is terminal; fail closed).

Open the issue on soorma-ai/soorma-core, citing contract-v0.1.0. Link the gap entry by a permalink pinned to 1449f09, and list the three options. Qualify the ID as soorma-sdk GAP-CAC-001.
You may note, labelled as an observation and not the contract, that soorma-core's implementation at the tag appears to match option 1: renewal moves the lineage record's expiry forward, and each token keeps its own exp. The ask is for the contract to state the behaviour, whichever it is.
Status: set it to Open with the issue link, in the gap entry and in the register in aidlc-state.md.
Then Continue to Next Stage: U1 Functional Design approved, with the two corrections as made: DEC-U1-12, STR-05, SUB-03 and CC-STR-11; DEC-U1-10 split into PRB-05, 08, 09 and 10, with CC-PRB-06 and CC-PRB-08. CDI-04 is carried to U3 and U4. Proceed to NFR Requirements for U1.

Log this word for word in audit.md."
**AI Response**: "Opening the issue on soorma-ai/soorma-core for soorma-sdk GAP-CAC-001, then recording it Open with the link, approving U1 Functional Design, and starting NFR Requirements for U1."
**Context**: CONSTRUCTION — U1 Functional Design approved; GAP-CAC-001 routed (A)

---
## U1 Functional Design — GAP-CAC-001 raised; approved
**Timestamp**: 2026-11-18T07:25:27Z
**User Input**: (see the entry at 2026-11-18T07:24:45Z)
**AI Response**: "Checked soorma-core for an existing open issue on renewal tokens: none. Verified the observation at the tag (packages/credentials/src/sql.ts renewAgentCredential: expires_at = GREATEST(expires_at, $7); agent-token.ts: renewal mints a new jti for the same cid, each token with its own exp). Opened soorma-ai/soorma-core#34, 'Contract gap from build: does a renewal leave the previous agent token valid? (soorma-sdk GAP-CAC-001)', citing contract-v0.1.0, the gap entry by permalink pinned to 1449f09e3b5002da20caf23702c0759f9da6efd7 (resolves, HTTP 200), the three options, the implementation observation labelled as not the contract, the ask (the contract to state the behaviour), and the fail-closed work-around. No spec-gap label exists on soorma-core; none was created. GAP-CAC-001 set to Open with the issue link in the gap entry and the register. U1 Functional Design APPROVED with the corrections as made; CDI-04 carried to U3 and U4. Starting NFR Requirements for U1."
**Context**: CONSTRUCTION — U1 Functional Design approved; NFR Requirements begins

---
## U1 NFR Requirements — plan and questions
**Timestamp**: 2026-11-18T07:26:29Z
**User Input**: (none since the Functional Design approval)
**AI Response**: "Loaded construction/nfr-requirements.md. U1 is ordinary: no shape profile to seed (Step 1.5 N/A). Read soorma-core at the tag for alignment only (pnpm 12.18.0 without Corepack; ajv 2020-12; openssl CLI for the local CA; Vitest; Dependabot with a 7-day cooldown). Wrote construction/working/contract-and-conformance-nfr-requirements-plan.md (git-ignored) with seven questions: Q1 toolchain (A: Node 24 LTS pinned, pnpm exact without Corepack, one workspace); Q2 libraries (A: Node built-ins, ajv, yaml, openssl CLI, OpenTelemetry test SDK in the reference driver only, Vitest); Q3 time budget (A: 5 minutes per driver per runtime; 8 minutes for the self-test job); Q4 flaky timing cases (A: no automatic retries; margins of at least twice the value); Q5 remote drift check (A: fail closed in CI; --offline locally); Q6 where the suite runs (A: Linux CI authoritative, second user via sudo; local macOS and Linux; CC-SEC-05 fails rather than skips without sudo); Q7 dependency updates and scanning (A: as soorma-core). The SDK's named values stay with U3 and U4. Awaiting answers."
**Context**: CONSTRUCTION — U1 NFR Requirements, questions presented

---
## U1 NFR Requirements — answers
**Timestamp**: 2026-11-18T07:45:14Z
**User Input**: "Answers: Q1 A, Q2 A, Q3 A, Q4 A. Q5, Q6 and Q7 are X:

Q5 X: Fail closed in CI, as A, but the remote half uses git, not the GitHub REST API:

git ls-remote reads the tag's peeled commit;
a shallow fetch of that commit (--depth 1) gives the contract/ tree ID.
No token and no API rate limit (hosted runners share IP addresses, so unauthenticated API calls fail at random). It also keeps the check consistent with the rule that secrets never go in environment variables. Locally, --offline runs only the local half and says so; CI never passes it.

Q6 X: Linux CI is authoritative and always runs CC-SEC-05, creating the second user with sudo. Locally, a named flag (for example --local-skip CC-SEC-05) skips that one case and prints that it didn't run and why; without the flag, the case runs and fails if it can't create the user. CI never passes the flag, and the runner refuses it when it detects CI. Don't use sudo in local test set-up. On macOS, user creation would be dscl, not useradd; don't build that. Windows: not supported in M1, as A.

Q7 X: As A (Dependabot weekly with a 7-day cooldown, pnpm audit at moderate, dependency review, every action pinned by SHA with read-only permissions), plus:

Dependabot uses target-branch: dev for both ecosystems, so its updates take the dev → main path.
The DCO workflow exempts dependabot[bot] only, matched on the PR author, since Dependabot can't sign off. Every other commit still needs Signed-off-by.
Add a test showing that a PR from another author without a sign-off still fails.
Log this word for word in audit.md, then generate the NFR Requirements."
**AI Response**: "Answers recorded; checking for ambiguity, then generating U1's NFR Requirements."
**Context**: CONSTRUCTION — U1 NFR Requirements, answers received

---
## U1 NFR Requirements — follow-up question Q7a
**Timestamp**: 2026-11-18T07:45:50Z
**User Input**: (none)
**AI Response**: "Step 5 analysis: Q1 to Q6 clear. Q7's DCO exemption 'matched on the PR author' conflicts with target-branch dev: Dependabot's unsigned commits merged into dev are also in the next dev → main PR, whose author is the user, so that PR's DCO check would fail. Also found in the existing .github/workflows/dco.yml: it exempts any commit whose author email contains [bot] (broader than dependabot[bot], and forgeable), uses actions/checkout@v4 (a tag, not a SHA) and runs on ubuntu-latest (not pinned); U1 fixes all three. Added follow-up Q7a to the plan: A) exempt a commit only if it reached the repository through a merged PR authored by dependabot[bot] (recommended), B) squash-merge Dependabot PRs into dev as the user with sign-off, C) PR author only, as stated. Generation waits for the answer."
**Context**: CONSTRUCTION — U1 NFR Requirements, follow-up presented

---
## U1 NFR Requirements — Q7a answer
**Timestamp**: 2026-11-18T07:55:51Z
**User Input**: "Q7a: X. Option A as described won't work. GitHub's commit-to-PR lookup (GET /repos/{owner}/{repo}/commits/{sha}/pulls) returns only open PRs for a commit that isn't on the default branch. Once a Dependabot commit is on dev, it finds the open dev → main PR, not the merged Dependabot PR. Option B depends on who GitHub records as a squash commit's author, and the check requires the sign-off to match the author.

Instead, anchor the exemption on GitHub's own signature. An unsigned commit is exempt only when GitHub's API (GET /repos/{owner}/{repo}/commits/{sha}) reports both:

author.login == "dependabot[bot]";
commit.verification.verified == true.
Dependabot's commits are signed by GitHub, so the email can't be spoofed into the exemption. This works on the Dependabot PR and on every later dev → main PR.

Token: read with the workflow's own token via an action input (for example actions/github-script with its default github-token), never as an environment variable, and with contents: read only.
Everything else unchanged: every other commit still needs a Signed-off-by matching its author, and merge commits stay skipped (--no-merges).
Fix the three problems you found: drop the *[bot]* email exemption; pin actions/checkout by commit SHA with its tag in a comment; pin the runner image (ubuntu-24.04).
Tests. Each of these fails:
another author's commit without a sign-off;
a commit whose author email contains [bot] but that isn't verified as Dependabot's;
a human commit without a sign-off pushed into a Dependabot PR.
And each of these passes:
a verified Dependabot commit, on its own PR;
the same commit already merged into dev, on the dev → main PR.
If the API lookup fails, the check fails closed.
Record target-branch: dev as before. Log this word for word in audit.md, then generate the NFR Requirements."
**AI Response**: "Q7a recorded; no further ambiguity. Generating U1's NFR Requirements."
**Context**: CONSTRUCTION — U1 NFR Requirements, follow-up answered

---
## U1 NFR Requirements — generated; approval requested
**Timestamp**: 2026-11-18T07:57:13Z
**User Input**: (none since the Q7a answer at 2026-11-18T07:55:51Z)
**AI Response**: "Generated construction/contract-and-conformance/nfr-requirements/: nfr-requirements.md (NFR-U1-01 to -36: performance budgets 5 and 8 minutes; no automatic retries, timing windows with margins of at least twice the value; drift check local half always, remote half by git ls-remote and a --depth 1 fetch, fail closed in CI, --offline locally only and refused in CI; Linux CI authoritative with CC-SEC-05 always run via sudo, --local-skip CC-SEC-05 locally only, refused in CI, no local sudo, no dscl, no Windows; secrets never printed or in reports; loopback-only stub with a per-run CA; test-only code out of the packages; pinned toolchain; Dependabot weekly with a 7-day cooldown and target-branch dev for npm and GitHub Actions; pnpm audit; dependency review; actions pinned by SHA, ubuntu-24.04, contents: read; the DCO check rewritten: exempt an unsigned commit only when GitHub's commit API reports author.login dependabot[bot] and verification.verified true, the [bot] email exemption removed, token via actions/github-script's input, fail closed on lookup failure, with three failing and two passing tests plus a failing lookup; security and invariant compliance; no new gap) and tech-stack-decisions.md (TS-U1-01 to -12; the jobs U1 adds or changes). Presenting the U1 NFR Requirements gate; next stage NFR Design (U1)."
**Context**: CONSTRUCTION — U1 NFR Requirements, approval gate presented

---
## U1 NFR Requirements — approval
**Timestamp**: 2026-11-18T08:05:52Z
**User Input**: "Continue to Next Stage: U1 NFR Requirements approved, including NFR-U1-31's added test (an API lookup that errors fails the check). One clarification to record in NFR-U1-32 before NFR Design:

How the DCO tests run. The check's logic is a script that can be tested apart from the workflow. Its tests run in CI against:

a local test git repository holding the commit shapes;
recorded or stubbed responses from GitHub's commit API, covering a verified Dependabot commit, an unverified commit with a [bot] email, a human commit, and a lookup error.
They don't depend on real PRs. The live confirmation is the first real Dependabot PR into dev, plus the dev → main PR after it. Record both run IDs in this initiative when they happen, as an open obligation tracked in aidlc-state.md until then.

Then proceed to NFR Design for U1. Log this word for word in audit.md."
**AI Response**: "U1 NFR Requirements APPROVED. Recorded the clarification in NFR-U1-32 and an open obligation (OBL-01: the first real Dependabot PR into dev and the dev → main PR after it, run IDs to record) in aidlc-state.md. Starting NFR Design for U1."
**Context**: CONSTRUCTION — U1 NFR Requirements approved; NFR Design begins

---
## U1 NFR Design — plan and questions
**Timestamp**: 2026-11-18T08:06:24Z
**User Input**: (none)
**AI Response**: "Loaded construction/nfr-design.md. Also recorded OBL-02 (AD-13's CI time, first measured on U2's code PR, run ID recorded) beside OBL-01 under ## Open Obligations, since it is the same kind of pending record. Wrote construction/working/contract-and-conformance-nfr-design-plan.md (git-ignored) with two questions: Q1 driver process lifetime (A: a new driver process per case); Q2 enforcing the time budgets (A: finish then judge, per-case timeouts, a watchdog at twice the budget). Other patterns follow from the approved requirements. Awaiting answers."
**Context**: CONSTRUCTION — U1 NFR Design, questions presented

---
## U1 NFR Design — state-file fix; answers
**Timestamp**: 2026-11-18T08:13:23Z
**User Input**: "First, fix aidlc-state.md. Your last edit inserted ## Open Obligations before the first match of \"## Carried Security Obligations\". That match is inside the security-baseline row of ## Extension Configuration, not the section heading.

The damage: the row is split at line 124, the obligations table sits inside the extension table, and the soorma-platform-invariants row and the ones after it now follow a stray \"## Carried Security Obligations` |\" line.
The fix: restore the security-baseline row to one line, ending \"(hosted) clauses listed under ## Carried Security Obligations |\". Move ## Open Obligations with OBL-01 and OBL-02 to just before the real ## Carried Security Obligations heading.
Check:
the extension table has exactly five rows, each with Enabled Yes;
the file has exactly one ## Open Obligations heading and one ## Carried Security Obligations heading.
When editing this file from now on, anchor each insertion on a whole heading line (\n## Heading\n), never on text that can also appear inside a row.
Commit the fix on its own, signed off.
Then the NFR Design answers: Q1 A, Q2 A.

Q1: a new driver process per case, because the CDI-02 runtime checks need a clean heap and clean reference counts.
Q2: finish the run, then fail if it went over the budget, naming the slowest cases. Keep the per-case timeout and the watchdog at twice the budget.
Log this word for word in audit.md, then generate the NFR Design."
**AI Response**: "Fixed aidlc-state.md: the security-baseline row restored to one line ending '*(hosted)* clauses listed under `## Carried Security Obligations` |'; ## Open Obligations (OBL-01, OBL-02) moved to just before the real ## Carried Security Obligations heading. Checked: the extension table has exactly five rows, each Enabled Yes; exactly one ## Open Obligations heading and one ## Carried Security Obligations heading. Committed on its own, signed off: c8db581. Insertions into this file now anchor on a whole heading line, asserted unique (saved as a standing memory). NFR Design answers recorded (Q1 A, Q2 A); generating the NFR Design."
**Context**: CONSTRUCTION — U1 NFR Design, answers received

---
## U1 NFR Design — generated; approval requested
**Timestamp**: 2026-11-18T08:14:41Z
**User Input**: (none since the answers at 2026-11-18T08:13:23Z)
**AI Response**: "Generated construction/contract-and-conformance/nfr-design/: nfr-design-patterns.md (P-01 a new driver process per case; P-02 budgets: finish then judge, per-case timeouts, watchdog at twice the budget, slowest cases named; P-03 timing windows, no retries; P-04 per-run secrets and CAs in a 0700 run directory, removed at the end; P-05 loopback-only stub with refuse and reset faults; P-06 fail closed; P-07 the CI guard for --offline and --local-skip CC-SEC-05; P-08 the DCO check as a pure function with injected git and API readers, wrapped by actions/github-script with its default github-token input, tested with a local git repository and recorded responses, live confirmation OBL-01; P-09 the drift check by git; P-10 supply-chain guards: frozen install, workflow check, audit, dependency review, Dependabot, packaging guard) and logical-components.md (data components; runner, stub, reference driver, repository checks and CI components, each with the NFRs it carries; every NFR-U1 requirement covered). Security: no findings; invariants unchanged; no new gap. Presenting the U1 NFR Design gate; next stage QA test specs, construction enrichment (U1), then the Construction Design PR gate."
**Context**: CONSTRUCTION — U1 NFR Design, approval gate presented

---
## U1 NFR Design — approval
**Timestamp**: 2026-11-18T08:26:29Z
**User Input**: "Continue to Next Stage: U1 NFR Design approved (P-01 to P-10 and the logical components), with one addition to P-04:

Heap snapshots stay private. The CDI-02 check's heap snapshot may contain the test secret when a driver fails the check, and the reference driver's retain-secret fault guarantees it does.

Analyse it as a stream in memory, or write it only inside the run's 0700 directory, and delete it at the end of the case, pass or fail.
Never put it in a report and never upload it as a CI artifact. A failure report names the case and the number of matches, never the content.
Then proceed to the QA test specs' construction enrichment for U1, then the Construction Design PR gate. When the design PR is open and its checks are green, stop and tell me the PR number; don't record it as merged until GitHub shows it.

Log this word for word in audit.md."
**AI Response**: "U1 NFR Design APPROVED. Adding the heap-snapshot rule to P-04, then QA enrichment for U1, then the Construction Design PR gate; will stop with the PR number once its checks are green."
**Context**: CONSTRUCTION — U1 NFR Design approved

---
## U1 QA enrichment and Construction Design PR gate
**Timestamp**: 2026-11-18T08:28:18Z
**User Input**: (see the entry at 2026-11-18T08:26:29Z)
**AI Response**: "P-04 gained the heap-snapshot rule as directed (stream in memory, or only inside the run's 0700 directory, deleted at the end of the case; never in a report or a CI artifact; failure reports give the case and the number of matches only); to enforce the artifact rule, the workflow check also fails on an upload step naming the run directory. QA construction enrichment for contract-and-conformance, sources: functional-design, nfr-requirements, nfr-design (no user stories, tickets, requirements.md or unit-of-work.md): 13 test cases modified in place (TC-CAC-001, 005, 007, 012 to 021), 21 added (TC-CAC-025 to 045: --offline and --local-skip guards, budgets and watchdog, per-case processes, no retry, timing windows, secrets and heap snapshots never leaving the run, run directory removal, loopback stub, the six DCO cases, the token and pins of dco.yml, the workflow check, Dependabot, frozen install and audit); IDs unchanged; enrichment-delta.md written (a session artifact, git-ignored). Construction Design PR gate: functional-design artifacts present; instructions written to construction/working/contract-and-conformance-design-pr-checkpoint-instructions.md (git-ignored); ## PR Checkpoint State gains 'Construction Design PR Gate — contract-and-conformance' PENDING, branch dev. Committing, pushing and opening the PR dev → main."
**Context**: CONSTRUCTION — U1 QA enrichment; design PR gate

---
## U1 Construction Design PR — open, checks green
**Timestamp**: 2026-11-18T08:28:55Z
**User Input**: (none)
**AI Response**: "Opened soorma-ai/soorma-sdk#9 (dev → main), 'feat(construction): harness/m1-walking-skeleton — contract-and-conformance design', with the unit summary and the design artifact list per pr-checkpoint.md §5.3. Every commit in origin/main..dev carries a Signed-off-by. Checks: Check sign-off pass; mergeable clean. Stopping for the user to merge; the gate stays PENDING and nothing is recorded as merged until GitHub shows it."
**Context**: CONSTRUCTION — U1 Construction Design PR gate, awaiting merge

---
## U1 Construction Design PR — merged; Code Generation begins
**Timestamp**: 2026-11-18T08:40:41Z
**User Input**: "soorma-ai/soorma-sdk#9 is merged: merge commit c8ebb7a708911e6a75a2bff3d2a3b2ab356c5ac6 on main, 2026-11-18T08:38:48Z. Confirm it on GitHub, then record U1's Construction Design PR gate as approved and merged.

Sync dev: git fetch origin && git merge --ff-only origin/main on dev, then push. Fast-forward only.

Accepted: P-04's heap-snapshot rule, plus your addition that the workflow check fails on an upload step naming the run directory; the QA enrichment (13 updated, 21 added, 45 total, IDs unchanged).

Then start U1's Code Generation, Part 1 (the plan) first, and stop for approval. The plan must show:

Commit groups and CI. Each group is pushed and CI is waited on before the next starts (F40). Every commit is signed off.
U1's "done when" in CI on the code PR:
the reference driver passes its 23 declared cases in reference mode;
each of the four faulted runs fails on exactly its named case: CC-SEC-01, CC-FWD-02, CC-PUB-03, CC-STR-04. The self-test job is green only when all four fail as expected;
the drift, generated-types, names, SPDX, workflow and packaging checks each have a test proving they catch the defect they look for;
the DCO tests (NFR-U1-32) run in CI.
The new dco.yml checks its own PR. Record the run ID that shows it.
The code PR (dev → main) is opened before the completion message, every check green, DCO included. Stop and tell me the PR number; don't record it as merged until GitHub shows it.
Log this word for word in audit.md."
**AI Response**: "Confirmed on GitHub: PR #9 MERGED at 2026-11-18T08:38:48Z, merge commit c8ebb7a708911e6a75a2bff3d2a3b2ab356c5ac6. Recorded U1's Construction Design PR gate APPROVED and merged. Synced dev: git fetch origin; git merge --ff-only origin/main (f712c20..c8ebb7a, fast-forward); pushed; origin/dev = origin/main = c8ebb7a. Starting U1 Code Generation, Part 1 (the plan)."
**Context**: CONSTRUCTION — U1 design gate merged; Code Generation Part 1 begins

---
## U1 Code Generation — Part 1 plan; approval requested
**Timestamp**: 2026-11-18T08:43:07Z
**User Input**: (see the entry at 2026-11-18T08:40:41Z)
**AI Response**: "Loaded construction/code-generation.md. L1 matrix has no Missing rows. Wrote construction/working/contract-and-conformance-code-generation-plan.md (git-ignored): 38 steps in 9 commit groups (G1 workspace and CI skeleton; G2 the DCO check rewritten with its tests; G3 the contract copy, PIN and the six repository checks, each with a test proving it catches its defect; G4 the specification and name table; G5 the runner; G6 the stub; G7 the 90 case files; G8 the reference driver, the four faults and the self-test job; G9 documentation, coverage rows, and the code PR with the dco.yml self-check run ID). Every group: gate (install frozen, typecheck, lint, format, tests, checks, and from G8 the self-test), signed-off commit, push, CI waited on before the next group. Points for approval: 1.1 the user's 'fails on exactly its named case' conflicts with the Functional Design's faults: as designed, reorder-forwarded-envelope would also fail CC-RCV-06, retry-publish CC-PRB-01, and skip-boundary CC-STR-05 and CC-STR-01; proposed: CC-RCV-06's envelope text in sorted compact form, CC-PRB-01 without a 503, and skip-boundary dropping only a superseded stream's ended item, so each faulted run's failed set equals exactly its named case (Step 2 aligns business-logic-model §5.2 and §6); 1.2 ESLint with typescript-eslint and Prettier; 1.3 'Verified' for U1's L1 and invariant rows: case validated, and for the 23 reference cases a passing reference run; others executed at U3 and U4; 1.4 the foreseen risk that U3 finds defects in cases it first executes, handled as changes to an earlier unit's tests by class. Changes to earlier units' tests: none (U1 is first)."
**Context**: CONSTRUCTION — U1 Code Generation Part 1, approval requested

---
## U1 Code Generation — plan approval
**Timestamp**: 2026-11-18T08:46:28Z
**User Input**: "Approve the plan, with 1.1 changed. \"Fails on exactly its named case\" was too strict on my part. Don't weaken real cases to satisfy the self-test:

CC-RCV-06 keeps its envelope with unusual member order and spacing. Its forward after the deep-payload fallback (FWD-06) must still catch a reordered envelope on that path.
CC-PRB-01 keeps 503. It's the only check of Retry-After in a Problem returned to publish.
The self-test rule instead:

Each faulted run must fail its named case (CC-SEC-01, CC-FWD-02, CC-PUB-03, CC-STR-04).
Its full set of failures must equal a declared expected set: the named case plus any knock-on cases, listed per fault in the business logic model §5.2. For example, reorder-forwarded-envelope fails {CC-FWD-02, CC-RCV-06}, and retry-publish fails {CC-PUB-03, CC-PRB-01}.
A failure outside the declared set, or a missing named failure, fails the self-test. The report prints each fault's expected and actual sets.
skip-boundary: your narrowing is accepted (it drops only the superseded stream's stream ended). That changes the fault, not a case; if it still fails more than CC-STR-04, declare those cases too.

Step 2 updates the Functional Design to the declared-set rule, with no change to CC-RCV-06 or CC-PRB-01. Steps 33 and 34 and the \"done when\" table follow.

1.2, 1.3, 1.4: approved as proposed.

Log this word for word in audit.md, then start G1."
**AI Response**: "Plan APPROVED with 1.1 changed: the declared-set rule (each faulted run fails its named case, and its failed set equals the declared expected set in business-logic-model §5.2; anything else fails the self-test; the report prints expected and actual sets). CC-RCV-06 and CC-PRB-01 unchanged. skip-boundary narrowed to the superseded stream's stream ended. Plan updated (1.1, Steps 2, 33, 34, the done-when table); 1.2 to 1.4 approved. Starting G1."
**Context**: CONSTRUCTION — U1 Code Generation, plan approved; Part 2 begins

---
## U1 Code Generation — G1 gate blocked by pnpm audit
**Timestamp**: 2026-11-18T08:49:10Z
**User Input**: (none)
**AI Response**: "G1 written locally, not committed: root package.json (pnpm 12.18.0, Node >=24.22.3 <25, exact devDependencies chosen past the 7-day cooldown and within peer ranges: typescript 6.0.3, vitest 5.1.0, eslint 10.14.0, @eslint/js 10.0.1, typescript-eslint 8.72.1, prettier 3.9.10, @types/node 24.19.2), pnpm-workspace.yaml, .node-version 24.22.3 (installed locally with nvm), tsconfig.json, eslint.config.js, Prettier configuration, vitest.config.ts, .gitignore, .github/dependabot.yml (npm and github-actions, weekly, cooldown 7, target-branch dev), .github/workflows/ci.yml skeleton (unit and dependency-review jobs; actions pinned by SHA as soorma-core pins them). Step 2 done: business-logic-model §5.2 and §5.3 now state the declared-set rule; §6 marks CC-RCV-06 and CC-PRB-01 as knock-ons; CC-RCV-06 and CC-PRB-01 unchanged in substance; skip-boundary narrowed. Gate: typecheck, lint, format, tests pass; pnpm audit fails: minimatch GHSA-g3hv-75wg-m249 (moderate, via eslint and typescript-eslint, fixed in 11.0.1+) and picomatch GHSA-fc5q-39xc-vjpf (high, via vitest and typescript-eslint, published 2026-10-19, no patched version; 4.0.7 newest). Plan Step 1a added. minimatch: an override to 11.0.3 as soorma-core records it. picomatch: no fix exists; changing the audit policy (NFR-U1-26) is the user's decision; stopped and asked."
**Context**: CONSTRUCTION — U1 Code Generation G1, blocked on a decision

---
## U1 Code Generation — picomatch decision
**Timestamp**: 2026-11-18T08:52:29Z
**User Input**: "picomatch: A, a narrow recorded exception, with two refinements:

Narrow: ignore only GHSA-fc5q-39xc-vjpf, using pnpm's audit settings in pnpm-workspace.yaml (by advisory ID, not by package or severity). Every other advisory at moderate or above still fails CI.
Recorded: add an entry in DEPENDENCIES.md (or the register you mirror from soorma-core) with:
the advisory, severity and affected range (<= 4.0.7, no fix);
the paths it arrives through (vitest, typescript-eslint);
the scope: development only, matching only globs that live in this repository, never untrusted input;
the removal condition.
Self-expiring: a check fails when a picomatch version outside the affected range has been published, or when no installed package matches the range any more. Then the exception is removed in a recorded change, not left behind. Test both triggers with recorded advisory and registry data.
minimatch: Step 1a as proposed. The override to 11.0.3 mirrors soorma-core, recorded with its removal condition, along with soorma-core's pnpm settings (7-day minimum release age, exact saves, strict engines, no install scripts).

Accepted: Step 2's declared expected sets (§5.2), including your rule that real cases are never weakened to shrink a set.

Log this word for word in audit.md, then finish Step 1a, run the G1 gate, commit signed off, push, and wait for CI before G2."
**AI Response**: "Finishing Step 1a as directed, then the G1 gate, commit, push and CI."
**Context**: CONSTRUCTION — U1 Code Generation G1, decision received

---
## U1 Code Generation — G1 gate green; commit and push
**Timestamp**: 2026-11-18T08:54:30Z
**User Input**: (none)
**AI Response**: "Step 1a done: pnpm-workspace.yaml gains pmOnFail ignore, minimumReleaseAge 10080, saveExact, engineStrict, strictDepBuilds with no allowed builds, the minimatch override to 11.0.3, and auditConfig.ignoreGhsas [GHSA-fc5q-39xc-vjpf] (by advisory id only). The lockfile was re-resolved from scratch because the first one held transitive releases younger than 7 days (@eslint/config-array 0.23.6, @jridgewell/resolve-uri 3.1.3, brace-expansion 5.0.13, ignore 7.0.16, minimatch 11.0.9), which the new minimumReleaseAge refused. DEPENDENCIES.md records the override and the audit exception (advisory, severity, range <= 4.0.7 with no fix, paths vitest and typescript-eslint, scope, removal condition). tools/audit-exceptions/ (register.json, check.ts, check.test.ts) makes the exception self-expiring: it fails when a release outside the range is published, when no installed version matches, when the ignore list and the register disagree, and closed without registry data; both triggers tested with recorded advisory and registry data. The tests caught a parser bug (only the first ignored id was read), fixed before commit. ci.yml runs the check after the audit. G1 gate: install frozen, typecheck, lint, format, 7 tests, pnpm audit (1 ignored: high), audit-exceptions check: all pass. Steps 1, 1a, 2, 3, 4, 5 marked done."
**Context**: CONSTRUCTION — U1 Code Generation G1

---
## U1 Code Generation — G1 CI green; G2 gate green
**Timestamp**: 2026-11-18T08:57:07Z
**User Input**: (none)
**AI Response**: "G1 pushed as 34d6f76; CI run 44271040027 green (unit job; dependency review skipped on a push). G2 written: tools/dco/check.ts (pure check: a matching Signed-off-by, else exempt only if the commit API reports author.login dependabot[bot] and verification.verified true; a failed lookup or missing field fails closed), tools/dco/git.ts (non-merge commits base..head), tools/dco/action.ts (the github-script wrapper using the action's own client), tools/dco/check.test.ts (a local test git repository and recorded API responses: fails for another author's unsigned commit, an unverified [bot]-email commit (and a dependabot login that is not verified), a human commit in a Dependabot PR, a lookup error and a response without verification; passes for a verified Dependabot commit on its own PR and on the dev -> main range with a merge commit and signed work; the wrapper tested with a fake client), and .github/workflows/dco.yml rewritten (ubuntu-24.04; checkout v7.0.1 and github-script v9.0.0 pinned by SHA with tag comments; contents: read; the [bot] email exemption removed; the job name 'Check sign-off' kept). action.ts imports under plain Node 24 type stripping, as github-script's node24 runtime will. G2 gate: frozen install, typecheck, lint, format, 16 tests, audit (1 ignored), audit-exceptions: pass."
**Context**: CONSTRUCTION — U1 Code Generation G2

---
## U1 Code Generation — G2 CI green; G3 gate green
**Timestamp**: 2026-11-18T09:02:12Z
**User Input**: (none)
**AI Response**: "G2 pushed as cbd0a4a; CI run 44271420822 green. G3 written: contract/ vendored by git archive from the local soorma-core clone at c1e3d7f3 (read only); all 234 blob ids match the tag; the tag peels to c1e3d7f3 (git ls-remote); contract/ tree 38900083586024a832c05af04789fc0639dc9e2f. Plan note: the pin is contract.pin.json at the root beside contract.md (not contract/PIN), because the approved design also requires contract/ to stay byte-identical to the tag; .gitattributes marks contract/** -text. tools/: drift (local half; remote half by git ls-remote and a --depth 1 fetch, no token; fails closed; --offline local only, refused in CI) with tests against a file:// stand-in remote (modified, added, removed file; wrong peeled commit; wrong tree; unreachable remote; --offline in and out of CI); spdx with tests; workflows (SHA pins with tag comments, ubuntu-24.04, contents: read at both levels, no upload of the run directory) with tests; generated-types (inert, packages.json empty) with a fixture generator and package; names (inert, drivers.json empty) with a fixture name table: the tests caught the package row being read as an export, fixed; packaging guard (inert) with fixture packages; tools/checks.ts aggregates them (pnpm checks); contract.md; ci.yml gains the checks job. G3 gate: frozen install, typecheck, lint, format, 46 tests, audit (1 ignored), audit-exceptions, pnpm checks online: pass."
**Context**: CONSTRUCTION — U1 Code Generation G3

---
## U1 Code Generation — G3 CI green; G4 gate green
**Timestamp**: 2026-11-18T09:03:51Z
**User Input**: (none)
**AI Response**: "G3 pushed as 266347d; CI run 44272174556 green (unit and checks; the drift check's remote half ran from a hosted runner by git with no token). G4 written: spec/behaviour.md transcribed from business-rules.md (sections 0 to 16, 103 statements, ids unchanged; the decisions table as an appendix; a header naming the contract, sources, the name table and the three worked-around gaps); spec/names.md from domain-entities §3; conformance/runner (private workspace package) with src/spec.ts parsing statements, cases and exemptions, and tests: 103 statements in 16 areas, only NEV-05 and SEC-09 exempt, US-Q1 and the SUB-03 and SPN-06 documentation statements present, duplicates refused. G4 gate: frozen install, typecheck, lint, format, 51 tests, pnpm checks, audit: pass."
**Context**: CONSTRUCTION — U1 Code Generation G4

---
