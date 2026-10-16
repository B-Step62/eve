---
issue: "TBD — no tracking issue supplied"
status: proposed
last_updated: "2026-10-16"
---

# Lazy Vercel Connect provisioning with project-local UIDs

## Decision

Keep registry-authored connections unchanged:

```ts
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  auth: connect("linear"),
});
```

For eligible managed OAuth connections, treat `"linear"` as a **project UID** (`projectUid`): the project-local UID stored on a connector's project link, not the connector's team UID. During runtime provisioning, Connect resolves an existing mapping for the authenticated project and environment, or creates a connector with a distinct team-global UID and writes `projectUid: "linear"` on its initial project link. The adapter uses the returned connector ID for token and authorization operations. No new eve authoring API is needed; the change spans the Connect API, its DynamoDB schema, and `@vercel/connect/eve`, followed by a registry rollout.

Before this change, the `connex-project-uid` flag enabled user-authorized writes of `projectUid` on connector–project attachments and project-first resolution on project-scoped reads, but the managed OAuth endpoint rejected `projectUid` on OIDC requests, and its general-purpose resolver fell back to a team-global UID when a project alias was absent. Neither behavior alone implemented safe lazy provisioning.

## Contract

The adapter sends the authored key as `projectUid: "linear"` to the existing managed OAuth creation endpoint, authenticated by its deployment OIDC token. It does **not** send `uid: "linear"` as the new connector's team-global identity. This request is enabled only for eligible URL-backed managed OAuth connections; opaque connector IDs (`scl_...`), app/JWT-bearer or provider-specific setups, and connections without a provisionable URL keep their existing paths. The endpoint enforces this: an OIDC `projectUid` must be nonempty and cannot be combined with `uid`, `jwtBearer`, `xaa`, `triggers`, `triggerDestination`, or `events` (`400`). Do not accept a caller-supplied project ID or environment as authority; derive both from OIDC.

For OIDC requests carrying `projectUid`, the endpoint uses a **project-attachment-only** lookup, separately from `resolveConnexClientIdAllowNotFound`'s project-then-team lookup. It checks, in order:

| State of `(team, project, key)`                                                                                                         | Result                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mapping exists and the current environment is attached                                                                                  | Validate compatibility (below); return its concrete ID without changing attachments.                                                                                                                                                                                                                                        |
| Mapping exists only for other environments                                                                                              | If a compatible connector with the exact team UID is attached to this project and environment, reuse it, matching how token endpoints resolve the same key. Otherwise report `attachment_required`. Do not create a replacement or widen access.                                                                            |
| Mapping points at a deleted connector                                                                                                   | The link is a leftover of a partially failed deletion; remove it and continue as if unmapped.                                                                                                                                                                                                                               |
| No mapping exists, but a compatible connector with the exact team UID is already attached to **this project and environment**           | Reuse its concrete ID without changing the attachment. This preserves source patched by today's `eve integration connect`. A recognized, qualified legacy UID that exists but is not attached reports `attachment_required` (or `attachment_removed` if it was auto-linked and later removed) instead of provisioning anew. |
| A connector Connect provisioned for this key no longer resolves through it                                                              | Report `attachment_removed` if its project link was removed and `project_uid_removed` if a user cleared or changed its project UID, with its `connectorId`. Do not provision a replacement. A provisioned connector whose link was never created (creation succeeded, linking failed) is linked instead.                    |
| No mapping exists, but exactly one compatible connector with the canonical name is already attached to **this project and environment** | Claim the local key on its attachment if it has no conflicting alias, then return its ID. This covers fresh registry source after legacy setup. Among several compatible matches, claim the single one with the exact server URL; otherwise require explicit setup (`ambiguous`).                                           |
| A compatible exact-UID or canonical-name connector is attached to this project but **not** this environment                             | Report `attachment_required`. Do not provision a replacement or widen access.                                                                                                                                                                                                                                               |
| No mapping or compatible attached connector exists                                                                                      | Allocate a unique team-global name and UID, create a managed OAuth connector, attach it to OIDC-authorized environments with `projectUid: key`, and return its concrete ID.                                                                                                                                                 |
| A user-mapped connector already claims the project UID alongside another, or configuration is incompatible                              | Return an explicit setup error (`ambiguous`, `alias_conflict`, `configuration_mismatch`); never choose an arbitrary match or repoint the key.                                                                                                                                                                               |

A connector is **compatible** when it is an OAuth connector whose server URL has the same host and path, ignoring a trailing `/sse` or `/mcp` segment, so a moved MCP endpoint keeps its connector and grants while distinct servers behind one gateway host stay separate. It must also have every grant the request enables (user authorization, client credentials, refresh tokens), the requested secure-egress network, and every requested forwarded claim, so a request never resolves to a connector with weaker settings than it asked for.

A connector's project UID is not its team UID. A team UID or name can be used for **migration only after server-side verification of an existing attachment in the requesting project and environment**; finding it elsewhere in the team is insufficient. Match the canonical name by the legacy setup's exact display name or final UID segment and require a unique compatible candidate, never an arbitrary fuzzy name search. Claiming an alias must be a single conditional write on the attachment that preserves its environments and does not overwrite another alias; audit the OIDC-attributed claim. For a bare key such as `linear`, an unrelated team UID with no attachment to this project is not a migration candidate and must not prevent new project-local provisioning. No OIDC request may attach a team connector to another project or environment.

### Removal and recovery

Removing a provisioned connector from the project, or clearing or changing its project UID, is respected rather than undone. If the next request provisioned a replacement, the dashboard could not stop a deployment from using a connection; each cycle would also leave an orphaned connector and OAuth client registration and force fresh consent. Instead the request reports `attachment_removed` or `project_uid_removed` with the connector's ID, so the adapter can direct an operator to it. Recovery:

1. Reconnect the same connector to the project with the project UID; its grants are retained.
2. Map a different connector to the project UID.
3. Delete the connector; the next request provisions a fresh connector that requires new consent.

Changing the key in source also provisions a fresh connector but is a workaround, not a recovery path. This protection covers connectors Connect **provisioned** for the key. A legacy connector that was **claimed** and later removed is not tracked and is replaced by a provisioned connector on the next request.

### Provisioning record and concurrency

Connector IDs stay random, and no separate reservation record is kept. A connector Connect provisions records the project and project UID it was created for (`provisioningProjectId`, `provisioningProjectUid`) on the connector itself, indexed by a sparse `gsi-by-provisioning-project-uid` on `connex-clients`. The project link's UID is the current, user-editable mapping and disappears with the link; the provisioning record outlives a removed link or changed UID, which is what lets removal be detected.

Claiming and provisioning for one `(teamId, projectId, projectUid)` run under a Redis lock so concurrent workers, retries, and redeployments normally converge on one connector. The project-UID secondary index is eventually consistent and does not enforce uniqueness, so the lock holder records the connector ID in Redis for a few minutes as soon as it is created; the next holder checks that hint, revalidated against the link, before the index. If the lock or hint fails and racing requests still link several connectors with the same project UID, resolution keeps the UID on the oldest connector provisioned for that project UID and releases it from the others (their links and grants remain; their provisioning record is cleared). Releasing is required, not only picking the oldest: token endpoints reject a project UID that maps to several connectors in one environment as `ambiguous_connector`. A losing request may briefly use its own connector until the SDK resolves again. Any user-mapped duplicate remains ambiguous.

A failure between connector creation and linking no longer leaves an orphan: the next request finds the connector through the Redis hint or the provisioning index and links it instead of provisioning another. Name and team UID allocation account for collisions; a creation conflict from a concurrent request is retried once with fresh names, and a conflict that persists is returned as a non-retryable `409 conflict`.

The connector's display name, the OAuth client name shown on the provider's consent screen, and its team UID derive from the request's `name` when given and from the project name otherwise.

### Environments

Retain the current OIDC initial-environment policy: development can initially attach development, preview, and production; preview can attach preview and production; production can attach production; a custom environment attaches only its stable environment ID. Later requests from an unattached environment do not widen the attachment. Require explicit user-authorized setup to grant it. Validate every token/authorization operation server-side even when identity resolution is cached by the SDK.

### Responses

The response identifies the resolved connector (at least its canonical ID); `201` when this request created it and `200` otherwise. Errors are machine-readable:

| Response                                 | Meaning                                                                                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400 bad_request`                        | Empty `projectUid`, or combined with an unsupported field.                                                                                                                                                                                                      |
| `404 project_uid_unavailable`            | `connex-project-uid` is off for the team.                                                                                                                                                                                                                       |
| `409 connector_setup_required`           | User-authorized setup needed; `reason` is one of `ambiguous`, `alias_conflict`, `attachment_required`, `attachment_removed`, `configuration_mismatch`, `connector_unavailable`, `project_uid_removed`, with `retryable: false` and, where known, `connectorId`. |
| `409 conflict`                           | Creation failed for a reason a retry does not fix.                                                                                                                                                                                                              |
| `503 connector_provisioning_in_progress` | Another request holds the lock or won a claim race; `retryable: true`.                                                                                                                                                                                          |

Do not expose unrelated team resources or privileged settings to end users. Transient failures may be retried; access failures must not be retried as creation.

## Relationship to `connex-project-uid`

Extend the existing team-gated feature, rather than adding a separate flag or changing the meaning of user-authorized `projectUid` writes. When enabled, allow an OIDC caller to **resolve or provision a connector by its own project UID** on this managed OAuth endpoint under the strict rules above. A request with no `projectUid` retains the current exact team-UID behavior. The generic project-first/team-fallback resolver can remain for existing API callers, but the provisioning endpoint must independently verify attachment and environment before treating a team UID or canonical name as a migration candidate. Turning the flag off must not delete mappings or make an inaccessible alias silently resolve to a different team connector; with the flag off, otherwise-valid OIDC `projectUid` requests return 404, and nothing is resolved or created.

Deploying the API makes the OIDC path live for every team that already has the flag on, so the provisioning index must exist before the API deploys if any team is enabled.

## Adapter and eve rollout

`@vercel/connect/eve` previously posted the authored connector string as `uid`. Its managed OAuth path sends `projectUid` instead and consumes the resolved ID consistently for `getToken`, authorization start/completion, revocation, and cache eviction. It maps `connector_setup_required` to a non-retryable authorization failure and `connector_provisioning_in_progress` to a retryable one, and falls back to provisioning by team UID on `404 project_uid_unavailable` and on the `403` that Connect versions predating OIDC project UIDs return. Partition bounded caches by authenticated project/environment, endpoint, key, and configuration; a cache is not proof of continuing attachment. Preserve exact `scl_...` references and an explicit opt-out via the existing `autoProvision: false` option for intentionally managed team-global references.

Making bare `connect("linear")` lazy by default changes the meaning of an existing exact UID. Today's `eve integration connect` patches `connect("linear")` to the CLI-returned **team-global UID**, typically `connect("mcp.linear.app/linear")` on a blank team; its project attachment has no `projectUid`. An attachment-verified exact-UID fallback preserves that patched source without creating a second connector. Fresh `connect("linear")` source can reuse the same connector by an unambiguous, attachment-verified canonical-name match and atomically assign its local alias. Neither fallback may select a connector merely because it exists in the team. When matching is ambiguous or an alias is already occupied, require explicit user-authorized setup; preserving `connect({ connector: "mcp.linear.app/linear", autoProvision: false })` remains an option for intentionally exact references.

For new eager setup runs after this contract ships, write the project-local key on the attachment and keep `connect("linear")` in source rather than patching it to the returned team UID. Qualify migration against existing patched sources and attached connectors before changing the adapter default or removing registry setup. Leave bespoke app-installation, JWT-bearer, API-key, trigger, and custom-creation setups eager.

After the backend and SDK contract ships, remove `integration connect` setup metadata only for verified standard user-managed OAuth registry entries. Keep `connect("linear")` in their source, update validation and published connection docs, and retain an explicit operator path for sharing an existing connector or repairing an environment attachment. A registry install provides source; OAuth consent still happens when a user first uses the connection.

## Rollout order

1. **Infra (`vercel/infra`, `modules/connex/dynamodb-connex-clients.tf`):** add the `provisioningProjectId` and `provisioningProjectUid` attributes and the keys-only `gsi-by-provisioning-project-uid`, from the `connex-clients` schema snapshot in `vercel/api`. Wait for the index to become active in every replica region. Confirm `gsi-by-project-uid` on `connex-client-projects`.
2. **API (`vercel/api`, `api-connex` and `@api/connex`):** deploy. With the flag off, the OIDC path returns 404 before touching new storage.
3. **SDK (`@vercel/connect`):** release the adapter. It tolerates both the old API's 403 and the new 404.
4. **Flag:** enable `connex-project-uid` per team, internal teams first.
5. **Registry:** switch eve registry entries and `integration connect` as described above.

## Validation gates

- With the flag on, two blank projects in one team using `connect("linear")` get distinct mappings; an unattached team UID `linear` is not claimed or attached. With the flag off, no lazy project-UID creation occurs.
- Legacy source patched to a team UID reuses it only while attached to the requesting project/environment. Fresh `connect("linear")` source adopts the single compatible, already-attached legacy connector by name without widening its attachment or losing its grants; ambiguous or detached cases require setup.
- Concurrent cold starts converge on one connector; duplicates left by a failed lock resolve to the oldest provisioned connector, and token endpoints resolve the project UID unambiguously afterwards. A failed link after creation is linked on retry rather than duplicated.
- Removing a provisioned connector from the project, or clearing or changing its project UID, reports setup required with its connector ID instead of provisioning; reconnecting it restores access with its grants, and deleting it leads to a fresh connector that requires new consent.
- Development-first creation works in production; production-first creation reports setup required in development; an authorized attachment followed by retry works without redeployment. Custom environments remain exact-only.
- Invalid service/URL/principal, weaker egress or grants, alias collisions, and ambiguous existing rows fail safely. Exact connector IDs and the legacy no-`projectUid` endpoint retain their behavior.
- The SDK uses the returned ID throughout OAuth and token lifecycle; ordinary callers receive a redacted setup error and operators get actionable remediation. Test the API's real resolution and concurrency boundary, not just a mocked adapter.

The API/SDK work must precede switching eve registry entries: changing source or enabling `autoProvision` alone still sends an exact team UID with the currently installed SDK and can encounter a 409.
