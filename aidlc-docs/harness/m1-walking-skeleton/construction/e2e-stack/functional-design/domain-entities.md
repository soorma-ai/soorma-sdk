# Domain Entities — U2 `e2e-stack`

U2 builds test infrastructure: four commands that bring up soorma-core at `contract-v0.1.0`,
do the human set-up by raw calls, prove the stack, and take it down. Its entities are files,
processes and calls, not SDK concepts. Answers: U2-FD-Q1 to Q8 (audit 2026-11-18T18:51:06Z).

**Pinned by the commit check**: every soorma-core value below (paths, ports, the principal, the
environment) is read from soorma-core at `contract-v0.1.0` (commit `c1e3d7f3…`, read from
`contract.pin.json`). `core-up` refuses any other commit (CU-05), so these values cannot drift
under the commands.

## 1. Locations

All under `.e2e/` at the repository root, which is git-ignored (`.gitignore`).

| Entity | Path | Mode | Written by | Removed by |
|---|---|---|---|---|
| **Clone** | `.e2e/soorma-core/` | as cloned | `core-up` | `core-down` |
| **Ownership record** | `.e2e/owner.json` | `0600` | `core-up`, before it creates anything | `core-down`, last |
| **Fresh-stack marker** | `.e2e/fresh-stack` | `0600` | `core-up`, last, on success only | `setup`, first (U2-FD-Q1) |
| **Secrets directory** | `.e2e/secrets/` (default; `--secrets-dir` overrides) | `0700` | `setup` | `core-down` (the default directory; files by name otherwise) |
| **Agent secret file** | `<secrets dir>/<agent>.secret` | `0600` | `setup`, created exclusively | `core-down` |
| **Stack description** | `.e2e/stack.json` | `0600` | `setup`, last | `core-down` |

## 2. Entities

### E-01 Clone
soorma-core at the tag: a depth-1 clone of `contract.pin.json`'s `repository` at its `tag`, whose
`HEAD` must equal its `commit`. Holds soorma-core's own `deploy/local/` (Compose file, scripts,
and, after `stack:init`, `deploy/local/.secrets/` with the stack's CA and the handover file).
Read-only from this repository's side: nothing in the clone is edited.

### E-02 Stack
The `soorma-local` Compose project (`compose.yaml`: `name: soorma-local`) started by
`stack:up` from the clone: S1 to S4 for the organization `o1`, project `p1`, environments `e` and
`e2`, their stores and their volumes. U2 uses environment `e` only.

| Edge | Address | Used by |
|---|---|---|
| S1 org-gateway | `https://localhost:8441` | `setup` (first authentication, which returns the sign-in; end sign-in) |
| E's S2 control-gateway | `https://localhost:8442` | `setup` (environment credential, grant, registrations, secrets, end) |
| E's S3 data-gateway | `https://localhost:8444` | `prove-stack`; U3's and U4's scenarios |
| E's S4 event-ingest | `https://localhost:8446` | U3's and U4's scenarios |

Every edge is TLS on loopback, trusted through the clone's `deploy/local/.secrets/stack-ca.pem`
only.

### E-03 Ownership record
States that `core-up` started this stack: `{ "startedAt", "tag", "commit" }`. Its presence is
what lets `core-down` remove a stack (U2-FD-Q2). Holds no secret.

### E-04 Fresh-stack marker
States that the stack was brought up by `core-up` and that `setup` has not run on it yet.
Single use: `setup` removes it before its first call (U2-FD-Q1). Holds no secret.

### E-05 Human session (memory only)
The first Admin `h@example.com` of organization `o1` (soorma-core's `tenancy.yaml`), acting
through raw calls:
- **K**, the human secret: generated in memory for this run and used **once**, as
  `firstAuthenticate`'s `newSecret`; never written, printed or passed to another process
- **the sign-in** (`soorma_si_…`): **the one `firstAuthenticate` returns**. `setup` makes no other
  sign-in (no `authenticate` call), so it opens exactly one
- **E's environment credential** (`soorma_ec_…`): issued from that sign-in
- Both are held in memory for the calls that need them, then ended (`endEnvironmentCredential`,
  `endSignIn`), **checked to be refused**, and dropped (ST-09). After `setup`, success or
  failure, no sign-in or environment credential it opened is left live
- **the enrollment material** (`soorma_em_…`): read from the clone's handover file into the
  request body only

### E-06 Agent
A logical agent registered in `e` by `setup`: identifier as given (`agent-a`, `agent-b` in
CI; U2-FD-Q3), standing permissions `event:publish` and `event:subscribe`, an empty
re-broadening declaration, autonomy declared, sponsor `h@example.com`; one registration secret
(`soorma_rs_…`), written to its secret file and nowhere else.

### E-07 Stack description
What `setup` hands to the language jobs (U2-FD-Q4). No secret: secret files by **path**.

```json
{
  "contractVersion": "0.1.0",
  "soormaCore": { "tag": "contract-v0.1.0", "commit": "c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d" },
  "environment": { "organization": "o1", "project": "p1", "environment": "e" },
  "s3": "https://localhost:8444",
  "s4": "https://localhost:8446",
  "ca": "<absolute path to .e2e/soorma-core/deploy/local/.secrets/stack-ca.pem>",
  "agents": [
    { "agent": "agent-a", "secretFile": "<absolute path to .e2e/secrets/agent-a.secret>" },
    { "agent": "agent-b", "secretFile": "<absolute path to .e2e/secrets/agent-b.secret>" }
  ]
}
```

### E-08 Stack proof result
Per agent: the agent, the HTTP status of one bootstrap at E's S3, and pass or fail. The
credential the bootstrap returns is validated and dropped; never kept, printed or renewed.

### E-09 Log search
Run by **every** `core-down` with a stack, before it is taken down (U2-FD-Q7; LS-11, changed at the Code Generation plan approval); `--logs` decides only whether clean logs are printed:

| Part | Source |
|---|---|
| **Typed prefixes** | Read from the vendored `contract/conventions/credentials.md` (every `` `soorma_…_` `` it names: at the tag, `soorma_ac_`, `soorma_ec_`, `soorma_si_`, `soorma_dc_` in *Typed prefixes*; `soorma_rs_`, `soorma_em_` in *Material is not a credential*). Never a copy in this repository's code |
| **Kind names** | The contract's name for each prefix (the table's *Kind* column; the name before the prefix in the material section) |
| **Token characters** | The contract's credential syntax (`credentials.md` *Syntax*: RFC 6750 `b64token`: letters, digits, `-`, `.`, `_`, `~`, `+`, `/`) |
| **Exact values** | Each agent secret (the files the stack description lists), and each enrollment material in the clone's `deploy/local/.secrets/handover/` files |
| **Logs** | Each service of the `soorma-local` project, read separately, so a hit names its service |
| **Unsearchable** | K, the human secret: never on disk, not prefixed, generated per run and discarded; worthless once the stack is down (`down -v`) |

### E-10 End-to-end job
The CI job C-06 adds: `e2e` (after U3, `e2e-typescript`; U4 adds `e2e-python`), gated by the
`changes` job. One fresh stack per job.

## 3. Relationships

```text
core-up --writes--> ownership record --> clone --stack:init, stack:up--> stack (soorma-local)
   +--writes last--> fresh-stack marker
setup --consumes--> marker; --raw calls--> S1, E's S2 --registers--> agents A, B
   +--writes--> secret files (0600) in secrets dir (0700); stack description (0600)
prove-stack --reads--> stack description, secret files --bootstrap--> E's S3
core-down --requires--> ownership record; log search (always; [--logs] prints clean logs); down -v; removes the rest
```

Text alternative: `core-up` writes the ownership record, clones soorma-core, starts the stack and
writes the marker last. `setup` consumes the marker, registers A and B through S1 and E's S2, and
writes the secret files and the stack description. `prove-stack` reads both and bootstraps each
agent at E's S3. `core-down` acts only with the ownership record: the log search, always (printing clean logs only with `--logs`), then
`down -v`, then removal of everything `core-up` and `setup` wrote.

Cardinality: one ownership record, one clone, one stack per run; one marker, consumed once; one
secrets directory; one secret file per agent; one stack description per `setup`.
