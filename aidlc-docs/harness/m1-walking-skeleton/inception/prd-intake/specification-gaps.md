# Specification Gaps Found at Intake

Gaps found in Inception, before Units Generation assigns units. Classified by
`prd-gap-classification.md`; registered under `## PRD Specification Gaps` in
`aidlc-state.md`. A Team artifact: committed.

**Naming outside this initiative.** Gap IDs are numbered per initiative, so the same ID means
different gaps in different repositories. Whenever a gap ID leaves this initiative (an issue,
a comment, a handover), it is qualified by repository: **soorma-sdk GAP-INT-001**. soorma-sdk
GAP-INT-001 is soorma-core GAP-INT-003 (soorma-prd#13); soorma-core's own GAP-INT-001 is
unrelated. (User instruction, intake answers, 2026-11-18T02:07:55Z.)

---

## GAP-INT-001: Event delivery guarantees, as the SDK's subscriber sees them

**Raised**: 2026-11-17T07:33:14Z
**Stage**: PRD Intake
**Raised against**: PF — soorma-prd/aiprd-docs/platform-foundations/requirements/prd.md @ `prd-platform-foundations-v1.3`
**PRD section**: PF §2 *What This Is Not* (delivery semantics belong to Event); PF §13 (Event row); PF §19 *Success-Claim Trace* step 8; OB-6
**Owner**: Event plane, which has no approved PRD
**Unit**: (pre-unit), until Units Generation assigns it
**Issue**: [soorma-prd#13](https://github.com/soorma-ai/soorma-prd/issues/13) — **already open**, raised by soorma-core as its GAP-INT-003. Not a new issue (brief, *Specification gaps from two sessions*)
**Resolved by**: —

### What the build needs
What the SDK's subscribe operation may tell tenant code it gets: at-most-once or
at-least-once, whether an event published while the subscriber is offline, superseded or
overflowed ever arrives, ordering, acknowledgement, and resumption. The SDK's subscription API
and its documentation state, or carefully decline to state, each of these.

### What the PRD says
Nothing, by design. PF §2 assigns delivery semantics to the Event plane. PF §19 step 8: "A
delivery semantic: at-most-once or at-least-once, offline subscribers, ordering,
acknowledgement — **Nothing in this PRD, by design.**" ID @ v1.0 lists it as Event's.

### Why this is specification, not technology
The same reasoning as soorma-core's GAP-INT-003: the guarantee changes what every consumer
must build, and whichever guarantee ships becomes relied on. In the SDK the risk is sharper,
because a client library is where tenants learn the semantics. An SDK that reconnected and
re-subscribed silently, for example, would present live-only delivery as a continuous stream
and hide the gaps between streams.

### Options considered
1. **Build against the contract's work-around** (`contract-v0.1.0`,
   `conventions/pre-release.md` statement 2): live subscribers only; no durability, ordering,
   redelivery, acknowledgement or resumption. The SDK surfaces every stream end (`end` codes,
   an open set) to tenant code and promises nothing about delivery. *Done when* 3 is proven by
   opening B's subscription before A publishes
2. **Wait** for the Event plane PRD. *Done when* 3 waits with it
3. **Comment on soorma-prd#13** with this entry, so the Event PRD sees the client-side
   consequence (an SDK must not paper over gaps between streams). Combinable with 1

### Blocked
*Done when* 3, worked around under option 1. The SDK's subscription operation.

**Routing**: options 1 and 3 (intake Q3 A, 2026-11-18T02:07:55Z). Comment on soorma-prd#13
as "soorma-sdk GAP-INT-001 (= soorma-core GAP-INT-003)": *(URL recorded once posted)*

**Status**: `Awaiting PRD: Event`. Worked around in M1 by building against
`contract-v0.1.0`'s live-only delivery.

---

## GAP-INT-002: Span semantics for the trace the SDK emits

**Raised**: 2026-11-17T07:33:14Z
**Stage**: PRD Intake
**Raised against**: PF — soorma-prd/aiprd-docs/platform-foundations/requirements/prd.md @ `prd-platform-foundations-v1.3`
**PRD section**: PF §19 *Success-Claim Trace* step 10; PF §7b (trace context field; Observability row); PF §2 *Seams*; OB-8
**Owner**: Observability plane, which has no approved PRD
**Unit**: (pre-unit), until Units Generation assigns it
**Issue**: — *(being raised; routing: intake Q2 A)*
**Resolved by**: —

### What the build needs
*Done when* 5: "A trace context travels on the envelope **and a trace is emitted**." The
platform emits no spans (contract `conventions/envelope.md`: "The platform never interprets
the values, and emits no spans"), so the SDK emits the trace. To emit one, it must decide:
which operations produce a span (publish, subscribe, each delivery received, acquire and
renewal); each span's name, kind and attributes, including whether soorma identifiers
(environment, agent, instance) appear on it; whether a received Delivery's span is a child of
the publisher's span or linked to it; how the sampled flag in `traceparent` is set; and where
spans go.

### What the PRD says
PF §7b assigns the trace context field to the agent and makes Observability "Consume the
reserved trace-context field; own span semantics". OB-8: "own span semantics, sampling, and
ingest. The field is a contract obligation, not a technology selection." PF §19 step 10: for
the emitted trace, span semantics are presupposed and specified by "**Observability** (§2
*Seams*; OB-8)", and the PF §19 claim lists it as one of the two exceptions that remain at
v1.3. PF §19 also says: "`soorma-sdk`'s session, which proves *done when* 5, may hit it; it is
not yet classified." PR #19's body records it among the exceptions (Q8 A).

### Why this is specification, not technology
The choice of open standard for the field is technology, and the contract has made it (W3C
Trace Context; soorma-core T-3). What a span *means* is not: PF assigns span semantics,
sampling and ingest to a plane by name, and lists them as an architectural decision M1's
builders would otherwise have to invent. Two engineers would emit different spans, and
whichever the SDK ships becomes what tenants' dashboards and alerts are built on. An SDK
cannot be force-upgraded (I7), so a span shape shipped now is hard to withdraw. The brief
forbids "stand-ins that look like product". Classifying this as technology would need the
caveat "unless Observability means otherwise", which is the rule's signal for specification.

### Options considered
1. **Raise against soorma-prd and work around in M1** (soorma-core's routing for GAP-INT-003).
   The work-around emits spans only through the **OpenTelemetry API** — an open standard, as
   W3C Trace Context is for the field — using **OpenTelemetry's own messaging semantic
   conventions** and adding **no soorma-defined span names or attributes**. The SDK installs
   no exporter and no sampler: the tenant's OpenTelemetry configuration decides where spans go
   and whether they are sampled, so the SDK defines no ingest. The span shape is documented as
   **unstable and not part of the SDK's compatibility guarantee**, pending the Observability
   PRD. *Done when* 5 is proven with an in-memory exporter in the test
2. **Resolve here**: the user decides the span semantics now. The SDK diverges from the PRD of
   record until Observability's PRD exists
3. **Reclassify as technology**: AI-DLC decides the span shape, recorded with rationale
4. **Work around without raising**: as option 1, with no issue opened

The reading AI-DLC would choose is option 1's work-around. It is an option, not the decision.

### Blocked
*Done when* 5, unless worked around. Trace emission.

**Routing**: option 1, raise and work around (intake Q2 A, 2026-11-18T02:07:55Z).

### The work-around, as built in M1

1. Spans are emitted **only through the OpenTelemetry API**, following **OpenTelemetry's own
   messaging semantic conventions**. No soorma-defined span name or attribute
2. **The SDK installs no exporter and no sampler.** The tenant's OpenTelemetry configuration
   decides where spans go and whether they are sampled; the SDK defines no ingest
3. The span shape is documented as **unstable**, outside the SDK's compatibility guarantee,
   until the Observability PRD specifies span semantics
4. **The proof of *done when* 5.** Because the SDK ships no exporter, *done when* 5 is proven
   by an exporter **the test installs**, such as an in-memory one, **never one the SDK
   ships**. The test asserts that the span is emitted and that its trace id matches the
   `traceparent` on the envelope B receives. Requirements Analysis carries this into *done
   when* 5's proof

**Status**: `Awaiting PRD: Observability`. Worked around in M1, as above. Issue: *(URL
recorded once opened)*
