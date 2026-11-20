# Performance Test Instructions

## Purpose

soorma-sdk ships client libraries and deploys nothing, so there is no service to load. M1's
performance requirements are the **budgets** each unit set on its own suites and jobs, and the
SDKs' **bounds** on what they read from the network. Load, stress and throughput testing of the
platform is soorma-core's.

## Performance Requirements

| Requirement | Source | Budget |
|---|---|---|
| A full conformance run, per driver per runtime | U1 (`conformance/README.md`) | 5 minutes; a watchdog stops a hung run at twice that |
| The conformance self-test | U1 | 8 minutes |
| An end-to-end CI job (`e2e-typescript`, `e2e-python`) | AD-13 (U2; NFR-U3, NFR-U4-32) | 8 minutes; over it reopens the unit's NFR Requirements |
| Each SSE event read | RCV-09 (`L_event`) | At most 1 MiB held; a larger event is discarded to its blank line |
| Each non-stream response body | RCV-09 (`B_body`) | At most 1 MiB; more is `TransportError` (`response-too-large`) |
| The Python HTTP parser's head | U4 (P-07) | Status line 1 KiB, header line 8 KiB, 100 headers, head 64 KiB, chunk-size line 1 KiB, trailers 16 KiB / 32 lines, SSE line 1 MiB |
| A payload's depth | PUB-04 | Not limited: iterative serialization in both languages (a 1 000 000-deep payload serializes in under 5 s in Python's unit test) |

## Run Performance Tests

There is no separate load test. The budgets are measured by the runs that already exist:

```sh
pnpm conformance run --driver "<driver>" --local-skip CC-SEC-05   # prints its time; fails over 5 minutes
pnpm conformance:self-test                                        # each run's time
pnpm e2e:scenario-typescript; python/.venv/bin/python python/e2e/scenario.py   # each about 60 s
```

The bounds are unit-tested: `python/tests/test_http.py` (each bound, a table of malformed
inputs, and a seeded fuzz test), `typescript/src/bounds.test.ts`, and CC-RCV-09 and CC-RCV-10
through both drivers.

## Analyze Results

Record each run's time against its budget in `build-and-test-summary.md`. A run over budget
fails; the runner names the slowest cases. Cases are never trimmed to meet a budget.
