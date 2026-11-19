# @soorma/sdk

The soorma agent SDK for TypeScript. It acquires, renews and presents an agent credential; drafts,
publishes, forwards and subscribes on the data face; and emits spans through the OpenTelemetry API.
It is advisory only: the platform enforces everything.

## Delivery

Delivery is **live only**: a stream receives every Delivery accepted in its environment after it
opened, the subscriber's own publishes included, and nothing earlier. No durability, ordering,
redelivery, acknowledgement, resumption or duplicate suppression is promised (soorma-sdk
GAP-INT-001).

When a stream ends, the SDK opens another and yields *stream ended*, then *stream started*; events
accepted between two streams may be missed. Across a renewal both streams are open for a moment,
and a Delivery may be read on both: a Delivery may be delivered twice around a stream boundary; nothing identifies a duplicate (GAP-INT-001).

## Spans

The SDK emits spans only through the OpenTelemetry API and installs no exporter, sampler or
provider. It follows OpenTelemetry's messaging semantic conventions 1.45.0: a `send` span (kind
producer) for every publish, and a `receive` span (kind consumer) for every Delivery.

The span shape is **unstable**: it is outside the SDK's compatibility guarantee until the
Observability PRD specifies span semantics (soorma-sdk GAP-INT-002, soorma-prd#37).

**A deviation from OpenTelemetry's usual parenting**: when you publish through a Delivery, the send
span is a child of the received context, not of your active span (which it links instead), and a
receive span is a child of the received context, so that one trace follows the event across hops.
