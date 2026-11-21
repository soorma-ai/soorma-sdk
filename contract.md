# The vendored contract

`contract/` is soorma-core's wire contract, copied **byte for byte** from the tag
[`contract-v0.1.0+core.2`](https://github.com/soorma-ai/soorma-core/tree/contract-v0.1.0+core.2/contract)
(peeled commit `0405e2a96a9389cab45e67312de903fd42f5d01e`). `contract.pin.json` records the
tag, the commit, the git tree id of `contract/` at that commit, and the SHA-256 of every file.
Every language package generates its types from this copy.

The tag names wire contract **0.1.0** at soorma-core revision 2 (`contract/conventions/versioning.md`,
*soorma-core revisions: +core.N*). Clients declare the version alone: `soorma-contract-version`
stays `0.1.0`, never with the `+core.N`.

**Never edit `contract/`.** The contract check (`pnpm checks`) fails on any difference, addition
or removal, and on a tag that no longer peels to the pinned commit or tree.

**When the contract is insufficient**, raise it against the soorma-core initiative, citing the
tag, never patch the copy. soorma-sdk GAP-CAC-001 (soorma-ai/soorma-core#34) is an example: it
was answered at `contract-v0.1.0+core.2` (`conventions/credentials.md`, *Revocation and
Lifetimes*). A new contract version or revision is taken by re-vendoring at its tag, in a
recorded change. Quote the tag wherever a shell sees it:

```sh
node tools/drift/write-pin.ts https://github.com/soorma-ai/soorma-core \
  'contract-v0.1.0+core.2' 0405e2a96a9389cab45e67312de903fd42f5d01e \
  8d375fd66899184b4d7871e188d02268a992325e
```
