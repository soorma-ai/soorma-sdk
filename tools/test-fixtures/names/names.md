# Name table (fixture)

| Concept | TypeScript | Python |
|---|---|---|
| package | `@soorma/sdk` | `soorma` |
| agent client | `AgentClient` | `AgentClient` |
| file secret provider | `fileSecret` | `file_secret` |

| Concept | On | TypeScript | Python |
|---|---|---|---|
| start | client | `start` | `start` |
| organization, project | environment | `organization`, `project` | `organization`, `project` |
| item kind | every item | `kind` (`"delivery"`, `"streamEnded"`) | the class |
| expiry | details | `expiresAt` | `expires_at` |
