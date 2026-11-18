# Test Case Index — typescript-harness

Unit abbreviation: TH = typescript-harness

| Test Case ID | Title | Source | Scope | Priority |
|---|---|---|---|---|
| TC-TH-001 | Creating a client contacts nothing | typescript-harness / FR-15 | happy-path | High |
| TC-TH-002 | No environment identifier is accepted | typescript-harness / FR-15 | negative | High |
| TC-TH-003 | A supplied CA is trusted; an untrusted certificate fails | typescript-harness / FR-15 | negative | High |
| TC-TH-004 | There is no option to disable TLS verification | typescript-harness / FR-15 | negative | High |
| TC-TH-005 | Calls go only to the configured S3 and S4 | typescript-harness / FR-15, FR-06 | edge/boundary | High |
| TC-TH-006 | Nothing is derived from the host or environment variables | typescript-harness / FR-15, FR-04 | edge/boundary | High |
| TC-TH-007 | Bootstrap sends exactly the contract's request | typescript-harness / FR-04 | happy-path | High |
| TC-TH-008 | The provider is called once and the secret is not retained | typescript-harness / FR-04 | edge/boundary | High |
| TC-TH-009 | authentication_failed is surfaced and not retried | typescript-harness / FR-04, FR-13 | negative | High |
| TC-TH-010 | too_many_attempts is surfaced with Retry-After and not retried | typescript-harness / FR-13 | negative | High |
| TC-TH-011 | unavailable is retried after Retry-After, within the bound | typescript-harness / FR-13 | edge/boundary | High |
| TC-TH-012 | `fileSecret` reads an owner-only secret file | typescript-harness / FR-04 | happy-path | High |
| TC-TH-013 | `fileSecret` refuses an unsafe file without reading it | typescript-harness / FR-04 | negative | High |
| TC-TH-014 | `fileSecret` allows group read and follows links to the final file | typescript-harness / FR-04 | edge/boundary | Medium |
| TC-TH-015 | `fileSecret` refuses a named pipe or device without blocking | typescript-harness / FR-04 | edge/boundary | High |
| TC-TH-016 | No provider reads an environment variable | typescript-harness / FR-04, FR-16 | negative | High |
| TC-TH-017 | Renewal happens before expiry and replaces the credential | typescript-harness / FR-05 | happy-path | High |
| TC-TH-018 | At the end of a lineage the client bootstraps again | typescript-harness / FR-05 | edge/boundary | High |
| TC-TH-019 | A refused renewal is terminal | typescript-harness / FR-05, FR-13 | negative | High |
| TC-TH-020 | The credential's details are readable; the credential is not | typescript-harness / FR-06, FR-15 | happy-path | High |
| TC-TH-021 | The credential never appears in logs, errors or string forms | typescript-harness / FR-06 | negative | High |
| TC-TH-022 | The credential is presented only as a bearer header | typescript-harness / FR-06 | edge/boundary | Medium |
| TC-TH-023 | A draft carries exactly the allowed members | typescript-harness / FR-07 | happy-path | High |
| TC-TH-024 | No platform-stamped field can be set | typescript-harness / FR-07, FR-16 | negative | High |
| TC-TH-025 | The draft carries the active span's trace context | typescript-harness / FR-08 | happy-path | High |
| TC-TH-026 | Without an OpenTelemetry SDK the draft still has a valid traceparent | typescript-harness / FR-08 | edge/boundary | High |
| TC-TH-027 | A forwarded call asserts its own trace context | typescript-harness / FR-08, FR-09 | edge/boundary | High |
| TC-TH-028 | Publishing through a Delivery forwards its context by default | typescript-harness / FR-09 | happy-path | High |
| TC-TH-029 | The forwarded envelope is the received text, byte for byte | typescript-harness / FR-09, FR-12 | edge/boundary | High |
| TC-TH-030 | Publishing on the client does not forward | typescript-harness / FR-09 | edge/boundary | Medium |
| TC-TH-031 | Refused forwarding is surfaced as given | typescript-harness / FR-09, FR-13 | negative | High |
| TC-TH-032 | A 202 is reported as accepted | typescript-harness / FR-10 | happy-path | High |
| TC-TH-033 | Bodies are compact JSON without ASCII or HTML escaping | typescript-harness / FR-10 | edge/boundary | High |
| TC-TH-034 | A failed publish is never retried | typescript-harness / FR-10, FR-13 | negative | High |
| TC-TH-035 | An oversized publish is surfaced as the platform's Problem | typescript-harness / FR-10, FR-13 | edge/boundary | Medium |
| TC-TH-036 | Subscribing opens a stream and yields its items | typescript-harness / FR-11 | happy-path | High |
| TC-TH-037 | Heartbeats are consumed silently | typescript-harness / FR-11 | edge/boundary | Medium |
| TC-TH-038 | A stream end is surfaced with its code | typescript-harness / FR-11 | edge/boundary | High |
| TC-TH-039 | An unknown end code is surfaced, not fatal | typescript-harness / FR-11 | edge/boundary | High |
| TC-TH-040 | A dropped connection is a stream end with no code | typescript-harness / FR-11 | edge/boundary | High |
| TC-TH-041 | Across renewal a new stream starts and both boundaries are surfaced | typescript-harness / FR-11 | edge/boundary | High |
| TC-TH-042 | A revoked stream ends the subscription | typescript-harness / FR-11, FR-13 | negative | High |
| TC-TH-043 | At most one stream per credential lineage | typescript-harness / FR-11 | edge/boundary | High |
| TC-TH-044 | A failed subscribe is surfaced; unavailable is retried | typescript-harness / FR-11, FR-13 | negative | High |
| TC-TH-045 | A Delivery exposes envelope, envelope text, seal and payload | typescript-harness / FR-12 | happy-path | High |
| TC-TH-046 | Extraction does not depend on member order | typescript-harness / FR-12 | edge/boundary | High |
| TC-TH-047 | Unknown fields and values are kept, not fatal | typescript-harness / FR-12 | edge/boundary | High |
| TC-TH-048 | Received identifiers are opaque | typescript-harness / FR-12 | edge/boundary | Medium |
| TC-TH-049 | Payload numbers are native, with the source text available | typescript-harness / FR-12 | edge/boundary | Medium |
| TC-TH-050 | A payload deeper than the bound falls back to raw text | typescript-harness / FR-12 | edge/boundary | High |
| TC-TH-051 | An unreadable Delivery line is an error item and the stream continues | typescript-harness / FR-12 | negative | High |
| TC-TH-052 | Unknown Problem codes and members are kept | typescript-harness / FR-13 | edge/boundary | High |
| TC-TH-053 | forbidden is surfaced without inference | typescript-harness / FR-13 | negative | Medium |
| TC-TH-054 | Every error path releases its resources | typescript-harness / FR-13 | edge/boundary | Medium |
| TC-TH-055 | Spans are emitted through the OpenTelemetry API under messaging conventions | typescript-harness / FR-14 | happy-path | High |
| TC-TH-056 | The SDK installs no exporter and no sampler | typescript-harness / FR-14 | negative | High |
| TC-TH-057 | No human-side operation, delegation or commercial code | typescript-harness / FR-16 | negative | High |
| TC-TH-058 | The package builds and installs from the repository, unpublished | typescript-harness / FR-18 | happy-path | High |
| TC-TH-059 | Every conformance case passes on every supported runtime | typescript-harness / FR-18, FR-03 | happy-path | High |
| TC-TH-060 | Exported names match the name table | typescript-harness / FR-17, FR-18 | edge/boundary | High |
| TC-TH-061 | Both agents bootstrap and one renews (done when 2) | typescript-harness / FR-19 | happy-path | High |
| TC-TH-062 | B receives what A publishes (done when 3) | typescript-harness / FR-19 | happy-path | High |
| TC-TH-063 | The trace travels and a span is emitted (done when 5) | typescript-harness / FR-19, FR-14 | happy-path | High |
| TC-TH-064 | The example runs and prints the envelope and trace id | typescript-harness / FR-20 | happy-path | Medium |
| TC-TH-065 | The agent file copies into a new project | typescript-harness / FR-20 | edge/boundary | Medium |
| TC-TH-066 | The example's README states what is not promised | typescript-harness / FR-20 | happy-path | Low |
