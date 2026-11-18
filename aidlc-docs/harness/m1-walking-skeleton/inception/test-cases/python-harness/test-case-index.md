# Test Case Index — python-harness

Unit abbreviation: PH = python-harness

| Test Case ID | Title | Source | Scope | Priority |
|---|---|---|---|---|
| TC-PH-001 | Creating a client contacts nothing | python-harness / FR-15 | happy-path | High |
| TC-PH-002 | No environment identifier is accepted | python-harness / FR-15 | negative | High |
| TC-PH-003 | A supplied CA is trusted; an untrusted certificate fails | python-harness / FR-15 | negative | High |
| TC-PH-004 | There is no option to disable TLS verification | python-harness / FR-15 | negative | High |
| TC-PH-005 | Calls go only to the configured S3 and S4 | python-harness / FR-15, FR-06 | edge/boundary | High |
| TC-PH-006 | Nothing is derived from the host or environment variables | python-harness / FR-15, FR-04 | edge/boundary | High |
| TC-PH-007 | Bootstrap sends exactly the contract's request | python-harness / FR-04 | happy-path | High |
| TC-PH-008 | The provider is called once and the secret is not retained | python-harness / FR-04 | edge/boundary | High |
| TC-PH-009 | authentication_failed is surfaced and not retried | python-harness / FR-04, FR-13 | negative | High |
| TC-PH-010 | too_many_attempts is surfaced with Retry-After and not retried | python-harness / FR-13 | negative | High |
| TC-PH-011 | unavailable is retried after Retry-After, within the bound | python-harness / FR-13 | edge/boundary | High |
| TC-PH-012 | `file_secret` reads an owner-only secret file | python-harness / FR-04 | happy-path | High |
| TC-PH-013 | `file_secret` refuses an unsafe file without reading it | python-harness / FR-04 | negative | High |
| TC-PH-014 | `file_secret` allows group read and follows links to the final file | python-harness / FR-04 | edge/boundary | Medium |
| TC-PH-015 | `file_secret` refuses a named pipe or device without blocking | python-harness / FR-04 | edge/boundary | High |
| TC-PH-016 | No provider reads an environment variable | python-harness / FR-04, FR-16 | negative | High |
| TC-PH-017 | Renewal happens before expiry and replaces the credential | python-harness / FR-05 | happy-path | High |
| TC-PH-018 | At the end of a lineage the client bootstraps again | python-harness / FR-05 | edge/boundary | High |
| TC-PH-019 | A refused renewal is terminal | python-harness / FR-05, FR-13 | negative | High |
| TC-PH-020 | The credential's details are readable; the credential is not | python-harness / FR-06, FR-15 | happy-path | High |
| TC-PH-021 | The credential never appears in logs, errors or string forms | python-harness / FR-06 | negative | High |
| TC-PH-022 | The credential is presented only as a bearer header | python-harness / FR-06 | edge/boundary | Medium |
| TC-PH-023 | A draft carries exactly the allowed members | python-harness / FR-07 | happy-path | High |
| TC-PH-024 | No platform-stamped field can be set | python-harness / FR-07, FR-16 | negative | High |
| TC-PH-025 | The draft carries the active span's trace context | python-harness / FR-08 | happy-path | High |
| TC-PH-026 | Without an OpenTelemetry SDK the draft still has a valid traceparent | python-harness / FR-08 | edge/boundary | High |
| TC-PH-027 | A forwarded call asserts its own trace context | python-harness / FR-08, FR-09 | edge/boundary | High |
| TC-PH-028 | Publishing through a Delivery forwards its context by default | python-harness / FR-09 | happy-path | High |
| TC-PH-029 | The forwarded envelope is the received text, byte for byte | python-harness / FR-09, FR-12 | edge/boundary | High |
| TC-PH-030 | Publishing on the client does not forward | python-harness / FR-09 | edge/boundary | Medium |
| TC-PH-031 | Refused forwarding is surfaced as given | python-harness / FR-09, FR-13 | negative | High |
| TC-PH-032 | A 202 is reported as accepted | python-harness / FR-10 | happy-path | High |
| TC-PH-033 | Bodies are compact JSON without ASCII or HTML escaping | python-harness / FR-10 | edge/boundary | High |
| TC-PH-034 | A failed publish is never retried | python-harness / FR-10, FR-13 | negative | High |
| TC-PH-035 | An oversized publish is surfaced as the platform's Problem | python-harness / FR-10, FR-13 | edge/boundary | Medium |
| TC-PH-036 | Subscribing opens a stream and yields its items | python-harness / FR-11 | happy-path | High |
| TC-PH-037 | Heartbeats are consumed silently | python-harness / FR-11 | edge/boundary | Medium |
| TC-PH-038 | A stream end is surfaced with its code | python-harness / FR-11 | edge/boundary | High |
| TC-PH-039 | An unknown end code is surfaced, not fatal | python-harness / FR-11 | edge/boundary | High |
| TC-PH-040 | A dropped connection is a stream end with no code | python-harness / FR-11 | edge/boundary | High |
| TC-PH-041 | Across renewal a new stream starts and both boundaries are surfaced | python-harness / FR-11 | edge/boundary | High |
| TC-PH-042 | A revoked stream ends the subscription | python-harness / FR-11, FR-13 | negative | High |
| TC-PH-043 | At most one stream per credential lineage | python-harness / FR-11 | edge/boundary | High |
| TC-PH-044 | A failed subscribe is surfaced; unavailable is retried | python-harness / FR-11, FR-13 | negative | High |
| TC-PH-045 | A Delivery exposes envelope, envelope text, seal and payload | python-harness / FR-12 | happy-path | High |
| TC-PH-046 | Extraction does not depend on member order | python-harness / FR-12 | edge/boundary | High |
| TC-PH-047 | Unknown fields and values are kept, not fatal | python-harness / FR-12 | edge/boundary | High |
| TC-PH-048 | Received identifiers are opaque | python-harness / FR-12 | edge/boundary | Medium |
| TC-PH-049 | Payload numbers are native, with the source text available | python-harness / FR-12 | edge/boundary | Medium |
| TC-PH-050 | A payload deeper than the bound falls back to raw text | python-harness / FR-12 | edge/boundary | High |
| TC-PH-051 | An unreadable Delivery line is an error item and the stream continues | python-harness / FR-12 | negative | High |
| TC-PH-052 | Unknown Problem codes and members are kept | python-harness / FR-13 | edge/boundary | High |
| TC-PH-053 | forbidden is surfaced without inference | python-harness / FR-13 | negative | Medium |
| TC-PH-054 | Every error path releases its resources | python-harness / FR-13 | edge/boundary | Medium |
| TC-PH-055 | Spans are emitted through the OpenTelemetry API under messaging conventions | python-harness / FR-14 | happy-path | High |
| TC-PH-056 | The SDK installs no exporter and no sampler | python-harness / FR-14 | negative | High |
| TC-PH-057 | No human-side operation, delegation or commercial code | python-harness / FR-16 | negative | High |
| TC-PH-058 | The package builds and installs from the repository, unpublished | python-harness / FR-18 | happy-path | High |
| TC-PH-059 | Every conformance case passes on every supported runtime | python-harness / FR-18, FR-03 | happy-path | High |
| TC-PH-060 | Exported names match the name table | python-harness / FR-17, FR-18 | edge/boundary | High |
| TC-PH-061 | Both agents bootstrap and one renews (done when 2) | python-harness / FR-19 | happy-path | High |
| TC-PH-062 | B receives what A publishes (done when 3) | python-harness / FR-19 | happy-path | High |
| TC-PH-063 | The trace travels and a span is emitted (done when 5) | python-harness / FR-19, FR-14 | happy-path | High |
| TC-PH-064 | The example runs and prints the envelope and trace id | python-harness / FR-20 | happy-path | Medium |
| TC-PH-065 | The agent file copies into a new project | python-harness / FR-20 | edge/boundary | Medium |
| TC-PH-066 | The example's README states what is not promised | python-harness / FR-20 | happy-path | Low |
