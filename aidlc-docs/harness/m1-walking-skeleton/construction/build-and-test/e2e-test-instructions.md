# End-to-End Test Instructions

M1's developer-visible outcome, through the SDKs, against a running soorma-core: the slice
brief's *done when* items **2** (each agent instance bootstraps and receives a short-lived
credential), **3** (A publishes; B, subscribed in the same environment, receives it) and **5**
(a trace context travels on the envelope and a trace is emitted). The brief assigns these three
to soorma-sdk (*Proves*).

## The Stack

```sh
pnpm e2e:core-up --core-node "$(nvm which 26.13.0)"   # soorma-core at contract-v0.1.0, built and started
pnpm e2e:setup --agents agent-a,agent-b              # the environment, both agents, their secret files (0600)
pnpm e2e:prove-stack                                 # one raw bootstrap per agent: 200
```

## The TypeScript Scenario (U3)

```sh
pnpm --filter @soorma/sdk build
pnpm e2e:scenario-typescript
```

## The Python Scenario (U4)

```sh
python/.venv/bin/python python/e2e/scenario.py       # Python 3.11 or 3.12 (soorma-ai/soorma-core#36)
```

CI's `e2e-python` installs the built wheel into a fresh environment first, with the scenario's
dependencies from `uv.lock`, hash-checked, and runs the scenario with `python -I`.

## What Each Scenario Asserts

| Step | Does | Asserts | *Done when* |
|---|---|---|---|
| 1 | Read `.e2e/stack.json`; install the scenario's own tracer provider and in-memory exporter | — | — |
| 2 | Only the wall clock patched (TypeScript: `Date`; Python: `time.time`, `time.time_ns`), 14 minutes ahead and advancing; start B, then A, each with its own instance and `file_secret` on its own file | Each start emits one clock-skew warning (two in all, one per lineage); each credential names its agent and the environment `setup` made | **2** |
| 3 | Wait for B's renewal | `expiresAt` moves once, from the real S3, no sooner than `R_min` (30 s) after B's start; no second renewal within `R_min`; no further warning | **2** (short-lived, renewed) |
| 4 | Restore the real clock | — | — |
| 5 | A decoy span current while B subscribes and runs its loop; wait for *stream started* | — | — |
| 6 | A publishes `{"hello": "B"}` outside the decoy | A `traceparent` of the W3C form | **3** |
| 7 | B receives it | B's Delivery carries A's draft's `traceparent`, an envelope and a seal; its payload is A's | **3**, **5** |
| 8 | Read the exporter | B's receive span has A's trace id and A's send span as parent; the decoy is neither parent nor linked | **5** |
| 9 | Close both | No socket left open; (Python) no `ResourceWarning` | — |

Then `pnpm e2e:core-down`.

## The Example (by hand)

`typescript/examples/two-agents/` and `python/examples/two_agents/`: start B, then A in a
second terminal; B prints A's envelope and trace id; Ctrl-C stops B cleanly. Each README gives
the commands. Run for Python at U4 (plan Step 40), for TypeScript at U3 (plan Step 41).

## Budget

AD-13: an end-to-end CI job within **8 minutes**. On #23's run: `e2e-typescript` 175 s,
`e2e-python` 161 s; each scenario about 60 s, most of it the `R_min` waits.
