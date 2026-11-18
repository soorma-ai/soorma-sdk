# Unit to Story Map — soorma-sdk, M1

**Assignment rule**, by each criterion's check tag (stories.md):
- **[C] conformance case**: U1 writes the specification statement and the case; U3 and U4
  pass it
- **[E] end to end**: U3 and U4 assert it in their end-to-end test, on U2's stack
- **[A] per-language API check**: U3 and U4 each check it in their own tests

Exceptions, where the criterion is about the language-neutral layer or the stack itself, are
marked in the table.

## Story Map

| Story | Criteria | U1 | U2 | U3 | U4 |
|---|---|---|---|---|---|
| US-01 Configure a client | 5 | #1 to #4 statements, cases | | #1 to #5 | #1 to #5 |
| US-02 Bootstrap | 8 | #1 to #8 statements, cases; #3's runtime check defined (CDI-02) | | #1 to #8 | #1 to #8 |
| US-03 Keep the credential alive | 7 | #1 to #7 statements, cases | | #1 to #7 | #1 to #7 |
| US-04 Publish | 8 | #1, #2, #4 to #8 statements, cases | | #1 to #8 | #1 to #8 |
| US-05 Subscribe and receive | 6 | #1 to #6 statements, cases | | #1 to #6 | #1 to #6 |
| US-06 Every stream boundary | 7 | #1 to #7 statements, cases | | #1 to #7 | #1 to #7 |
| US-07 Read what arrived | 7 | #1 to #7 statements, cases | | #1 to #7 | #1 to #7 |
| US-08 Forward context | 6 | #1 to #4, #6 statements, cases | | #1 to #6 | #1 to #6 |
| US-09 Tracing | 5 | #1, #3 statements, cases; the span rules and US-Q1 | | #1 to #5 | #1 to #5 |
| US-10 Act on what the platform reports | 6 | #1 to #6 statements, cases | | #1 to #6 | #1 to #6 |
| US-11 Start from the example | 5 | | **#1** (the set-up the README names) | #1, **#2 ⚑** (TypeScript only), #4, #5 | #1, **#3** (Python counterpart), #4, #5 |
| US-12 Contract copy pinned | 3 | **#1 to #3** (drift check, generated-types check, maintainer documentation) | | #2 (commits generated types) | #2 (commits generated types) |
| US-13 One behaviour, stated once | 3 | **#1 to #3** (specification, statement-to-case links, names check) | | #3 (exports match the table) | #3 (exports match the table) |
| US-14 Bring a language to conformance | 4 | **#1 to #3** (case files, runner, fixture coverage) | **#4** (the stack) | #2, #4 (its run) | #2, #4 (its run) |

**Totals**: 14 stories, 80 criteria. Every criterion is assigned to at least one unit; every
story to at least one unit.

## *Done When* to Units

| *Done when* (brief) | Proven by | On |
|---|---|---|
| 2 — each instance bootstraps and holds a short-lived credential | U3 (M1's proof), then U4 | U2's stack |
| 3 — A publishes; B, subscribed, receives it | U3, then U4 | U2's stack |
| 5 — trace context travels; a trace is emitted | U3, then U4, with a test-installed exporter (GAP-INT-002) | U2's stack |
| 1, 4, 6, 7 | soorma-core's | — |

## Requirements to Units

| FR | Units | FR | Units |
|---|---|---|---|
| FR-01 | U1 (copy, drift); U3, U4 (generated types) | FR-11 | U1 (spec, cases); U3, U4 |
| FR-02 | U1 | FR-12 | U1; U3, U4 |
| FR-03 | U1; U3, U4 (drivers) | FR-13 | U1; U3, U4 |
| FR-04 | U1; U3, U4 | FR-14 | U1 (span rules, US-Q1); U3, U4 |
| FR-05 | U1; U3, U4 | FR-15 | U1; U3, U4 |
| FR-06 | U1; U3, U4 | FR-16 | U1; U3, U4 |
| FR-07 | U1; U3, U4 | FR-17 | U1 (table, check); U3, U4 |
| FR-08 | U1; U3, U4 | FR-18 | U3, U4 |
| FR-09 | U1; U3, U4 | FR-19 | U2 (step 1); U3, U4 (steps 2 to 4) |
| FR-10 | U1; U3, U4 | FR-20 | U3, U4 (U2 feeds its set-up) |

## Personas to Units

| Persona | Units |
|---|---|
| P1 Agent developer | U3, U4 (what they call); U2 (the set-up the example's README names) |
| P2 SDK maintainer | U1 (the copy, the specification, the suite); U2 (the stack the proof runs on) |
