# The vendored contract

`contract/` is soorma-core's wire contract, copied **byte for byte** from the tag
[`contract-v0.1.0`](https://github.com/soorma-ai/soorma-core/tree/contract-v0.1.0/contract)
(peeled commit `c1e3d7f3a71eddb0a2bce8e7d27fd736181c667d`). `contract.pin.json` records the
tag, the commit, the git tree id of `contract/` at that commit, and the SHA-256 of every file.
Every language package generates its types from this copy.

**Never edit `contract/`.** The contract check (`pnpm checks`) fails on any difference, addition
or removal, and on a tag that no longer peels to the pinned commit or tree.

**When the contract is insufficient**, raise it against the soorma-core initiative, citing the
tag, never patch the copy (soorma-sdk GAP-CAC-001, soorma-ai/soorma-core#34, is an example). A
new contract version is taken by re-vendoring at its tag (`node tools/drift/write-pin.ts`) in a
recorded change.
