# Invariant Coverage Matrix — U4 `python-harness`

**Invariants source**: soorma-prd `references/platform/invariants.md` @
`prd-platform-foundations-v1.3` and @ `prd-identity-v1.0` (text identical at both tags,
SHA-256 `c66c0170…`; Extension Configuration).
**PRD compliance tables**: PF §15 @ `prd-platform-foundations-v1.3` (all eleven Addressed);
ID §15 @ `prd-identity-v1.0` (I1 to I11 Addressed).

**How U4 carries the invariants**: U4 is the second harness unit, the code a Python tenant
links. Its code-level risks are U3's, in Python: that the SDK comes to be relied on for a check
the platform must make (I2); derives identity or scope from where it runs (I1, I3, I10); reaches
the control face (I6); or lands where its edition does not allow, including the values hook
shipping in the distribution (I8). The platform's enforcement is soorma-core's, used as built at
the tag. The SDK enforces nothing (NEV-04).

| Code | PRD Status | Applies to Unit | Code-Level Risk in This Unit | Implementation Target | Verification Target | Status |
|---|---|---|---|---|---|---|
| I1 Isolation | Addressed | Yes | An SDK-side cache, key or name built without the environment; an environment option scoping requests | No environment option (CFG-02); scope comes only from the presented credential; `credential.environment` read only (CDI-01); the SDK keeps no module-level cache or key across clients. Each `AgentClient` holds one credential | CC-CFG-02, CC-CRD-01; `e2e-python` (two clients, one environment, each its own credential); the absence of any environment-keyed state, reviewed at Code Generation | Covered |
| I2 Perimeter enforcement | Addressed | Yes, cumulatively | An SDK check the platform comes to rely on: a draft check, a chain bound, a payload rule | NEV-04: no SDK refusal of anything the platform checks. PH-PUB-01 refuses only what JSON cannot carry exactly; it is not a platform rule, and the platform checks its own bounds. The receive path never validates (PH-RD-05). **Cumulative**: across U1 to U4, every platform check reached through either SDK is reached identically without it (U2's raw calls; CC-RCV-08); the Python SDK adds no check the TypeScript one lacks | CC-RCV-08, CC-NEV-02; U2's `prove-stack` (raw, outside the SDK) against the same stack; reviewed against U1 to U3 at Code Generation | Covered |
| I3 Portable credential | Addressed | Yes | Identity or instance derived from the host, the process or the network | `new_instance_id()` (random, CFG-06); `instance` supplied; no `os.environ`, `os.getenv`, `socket.gethostname` or `platform.node` (PH-API-05, a static check); identity is the secret presented, then the credential | CC-CFG-06, CC-CFG-07; TC-PH-006 | Covered |
| I4 Attribution recoverable | Addressed | N/A for this unit | — | — | — | N/A for this unit: the SDK writes no governed record. Scope, actor, chain and origin are the platform's to stamp; the SDK forwards the received envelope byte for byte (FWD-02), so no hop's attribution is lost through it |
| I5 Monotonic authority | Addressed | Yes | Forwarding that drops the inbound context and so acts with broader authority; re-broadening requested at runtime | Forwarding is the default path when acting on an event (`delivery.publish`, FWD-01); dropping context takes the separate `client.publish` (FWD-04); no re-broadening, origin or chain field can be set (NEV-02); the envelope is forwarded as its exact received text | CC-FWD-01, CC-FWD-02, CC-FWD-06, CC-NEV-02 | Covered |
| I6 Two faces | Addressed | Yes | A control-face (S1, S2) call or type in the package | **Harness shape, no face**: the package calls S3 and S4 only (CFG-03); no S1 or S2 type is generated (C-10); no human credential (CRD-05) | CC-CFG-03, CC-NEV-01; the generated types' file list; TC-PH-057 | Covered |
| I7 Contract compatibility | Addressed | Yes | Requests without the contract version; a received unknown field or value that breaks the client; generated types drifting from the contract | The contract version on every call (draft or header); unknown fields and values kept (RCV-03, STR-03, PRB-01); generated types checked by U1's generated-types check with the Python package listed; the every-member-optional `Envelope` `TypedDict` (CDI-04) | CC-DRF-01, CC-RCV-03, CC-RCV-08; `pnpm checks` (generated types) | Covered |
| I8 Packaging rule | Addressed | Yes | Test code, the values hook, or a capability not assigned to core, in the `soorma` distribution | The distribution holds C-10 to C-20 only. The driver, the example and the end-to-end test are outside it. **The values hook is excluded from the built distribution** (PH-API-06). The packaging guard lists `python/` (`conformance/`, `tools/`, `e2e/` forbidden); the packed-distribution check runs over the built wheel and sdist. The packaging table is below | The packaging guard's run on `python/`; the packed-distribution check; TC-PH-058 | Covered |
| I9 Mechanism, not instance | Addressed | Yes | A tenant's schema, event name or identifier in package code | The package names no event type, payload schema or tenant identifier. The payload is any JSON value (PUB-04). The local stack's values (`o1`, `agent-a`, ports) appear only in the example's configuration block and in tests, labelled | Review at Code Generation (a search of `python/src/soorma/`) | Covered |
| I10 Runtime-later | Addressed | Yes | Relying on a managed runtime, code identity, or deployment topology | Nothing depends on where the agent runs. Identity is the credential; scope is the credential's environment; the SDK reads no host, environment variable or deployment metadata (CFG-05, CFG-07). Tempting places, refused: a host-derived instance id; an environment variable for the secret (SEC-03); a TLS bypass for "internal" networks (CFG-04); a hostname in the `ResourceWarning` text (it names the object only) | Statement at Code Generation; CC-CFG-06 | Covered |
| I11 No technology selection | Addressed | N/A | — | — | — | N/A: Construction is where technology is selected; this invariant constrains the PRD |

**Result** (Functional Design): 9 Covered, 1 N/A for this unit (I4, with reason), 1 N/A by design
(I11), **0 Missing**.

## I8 Packaging Table — U4

| Capability implemented | PRD edition assignment | Repository | Notes |
| --- | --- | --- | --- |
| Acquire credential, renew credential, hold and present credential (PF §11) | core (PF §11 *Harness Surface*; PF §12) | soorma-sdk, `soorma` (Apache 2.0) | C-13, C-14, C-15 |
| Draft envelope, populate trace context, forward inbound context (PF §11) | core | soorma-sdk, `soorma` | C-16, C-18 |
| Publish and subscribe on the data face (PF §11; the contract's S4) | core | soorma-sdk, `soorma` | C-11, C-17 |
| Trace emission through the OpenTelemetry API (PF §11; FR-14) | core | soorma-sdk, `soorma` | C-19; no exporter |
| The Python conformance driver, the example, the end-to-end test, the values hook | Not a product capability: test infrastructure and documentation | soorma-sdk, outside the `soorma` distribution | Kept out by the packaging guard and the packed-distribution check |

No commercial capability exists in U4 in any form; nothing in U4 lands in soorma-core. Across
U3 and U4, the same four core capabilities are implemented once per language, each in this
repository under Apache 2.0.
