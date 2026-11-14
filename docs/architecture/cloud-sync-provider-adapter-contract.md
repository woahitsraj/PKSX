# Cloud Sync provider adapter contract

For [Define the Cloud Sync provider adapter contract](https://github.com/woahitsraj/PKSX/issues/363), on [Wayfinder: Cloud Sync for Saves](https://github.com/woahitsraj/PKSX/issues/302).

Status: accepted by the user on 2026-11-14. No provider is selected. This contract specifies future implementation and does not authorize infrastructure or runtime changes.

## Existing boundaries

[CONTEXT.md](../../CONTEXT.md), [ADR 0004](../adr/0004-keep-save-artifacts-out-of-tinybase.md), and [ADR 0018](../adr/0018-use-versioned-content-addressed-cloud-sync-revisions.md) already require immutable versioned revisions, separate raw artifacts, causal authority in the provider-neutral coordinator, coherent multi-object changes, quota reporting, atomic chunked artifacts, and durable resumable execution. TinyBase replication is transport, never conflict authority.

The coordinator owns schema validation, digests of synchronized meaning, migration, causal reconciliation, adoption, conflict selection, and safe local application. An adapter transports opaque versioned records and artifacts. It may enforce transport integrity, authenticated ownership, size, and publication completeness without interpreting Sync Payloads or migrating them.

## Operations

These are behavioral operations, not final TypeScript signatures.

| Operation                         | Input                                                                                                       | Required result                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Establish or renew session        | Provider-issued session material, held outside synchronized records                                         | Stable opaque User Account and Sync Profile identities, credential expiry, renewable session or proven sign-in requirement |
| Open record transport             | Authenticated session and authorized profile                                                                | TinyBase immutable revision replication plus a durable catch-up path; reconnect cannot lose committed records              |
| Enumerate committed changes       | Profile and opaque checkpoint, with bounded page size                                                       | Complete committed change descriptors and a resumable checkpoint; duplicates allowed, permanent omissions forbidden        |
| Read immutable records            | Profile and requested revision or ancestry identities                                                       | Exact stored bytes, not-found, or retryable result; no fabricated replacement                                              |
| Begin or resume artifact transfer | Profile, artifact identity, byte length, transport checksum, durable transfer identity                      | Confirmed received ranges or chunks and transfer limits                                                                    |
| Write artifact chunk              | Transfer identity, chunk identity or offset, checksum and bytes                                             | Idempotent acknowledgement of durable bytes; different bytes at the same identity are rejected                             |
| Complete or read artifact         | Transfer identity, or artifact identity and requested range                                                 | Complete verified artifact, or resumable transfer status; partial bytes never appear as a complete artifact                |
| Publish coherent change           | Stable publication identity, immutable records, references to completed artifacts, and all affected objects | Durable all-or-nothing commit receipt; repeating the same request returns the same result                                  |
| Read publication outcome          | Publication identity                                                                                        | Committed receipt, still staged, or absent; a lost response never requires a new identity                                  |
| Inspect storage                   | Authorized profile                                                                                          | Sync Quota, used bytes, accounting freshness, and provider value/chunk limits                                              |
| Remove eligible content           | Coordinator-authorized exact identities and a storage generation or equivalent precondition                 | Conditional, idempotent cleanup with an explicit precondition failure if the target changed                                |
| End session or all sessions       | Authenticated scope                                                                                         | Revocation outcome covering HTTP, sockets, and artifact access within the existing credential lifetime bound               |
| Delete User Account               | Confirmed account-deletion request and stable operation identity                                            | Revoked access and resumable deletion of identity, Sync Profile, records, and artifacts; completion only after erasure     |

Durable acknowledgement means the service has persisted enough to recover the result after process restart. A WebSocket send, TinyBase merge event, or artifact upload alone is not a commit receipt. A checkpoint is transport progress, never Shared Sync State or causal authority. If a checkpoint expires, complete enumeration must remain possible. Live notifications are hints to catch up.

## Publication semantics

Upload artifacts and records into staging, then publish one immutable commit descriptor naming the full set. Expose committed changes only after every named component is durably available. Raw TinyBase arrivals may be staged; the coordinator must not present them as a complete accepted change. A physical transaction across every storage service is unnecessary if the descriptor supplies the same all-or-nothing observable result.

Concurrent publications from the same parent must both survive. Do not compare-and-swap a single winning head, use timestamps as authority, or let a TinyBase cell overwrite a different revision. Repeating a publication identity with different bytes fails without overwriting its original result. Delayed visibility of a component causes staging and retry, never partial application or acknowledgement of Shared Sync State.

Concurrent Conflict Resolutions are valid competing publications. The coordinator, rather than the adapter, decides whether an incoming change advances Shared Sync State. Local acknowledgement follows successful durable local application, not the remote commit receipt alone.

Retention needs a stronger guard than publication: cleanup must not delete content that became a competing head or Conflict Recovery after it was selected for pruning. Use a conditional storage generation or equivalent serialized operation that atomically checks pins and removes only eligible content. If the provider cannot supply that guarantee, it does not meet this contract. Preserve Sync Ancestry Records and Deletion Markers under the existing policy. Staged incomplete data may expire after 30 days without progress, and the origin can re-upload it with the same identity.

## Authentication and isolation

Every operation authorizes the User Account's profile at the service boundary. A profile ID, artifact hash, socket channel, signed URL, or cursor alone grants no account ownership. Reject cross-profile access even if the client supplies a valid identity belonging to another account. Artifact deduplication must not expose another profile's existence or bytes.

The existing session contract requires passwordless verified-email accounts and bearer credentials lasting at most one hour. Provider-specific credentials, URLs, and upload handles remain outside synchronized meaning. Reconnect and sign-in cancellation cannot silently enroll a different account or upload retained Saves without Sync Adoption.

Browser WebSocket authentication, native callback handling, secure credential storage, and bounded access after revocation need provider-specific evidence before selection. An adapter may obtain a restricted transport credential from an authenticated endpoint; long-lived session secrets must not appear in socket URLs or logs. Any existing socket or artifact grant must cease authorizing access by the existing one-hour bound, even if the connection remains open.

## Error contract

| Result                                                                                                    | Coordinator response                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Offline, timeout, throttling, outage, unknown denial, missing dependency, or uncertain publication result | Preserve pending work and retry silently; honor retry hints without an escalation timer                                            |
| Proven expired or revoked authentication that silent renewal cannot repair                                | Offer Sign in; preserve local data                                                                                                 |
| Proven Sync Quota rejection                                                                               | Offer storage management; preserve pending uploads; allow downloads and Deletion Markers                                           |
| Conditional-write precondition failed                                                                     | Refresh transport metadata and retry safely; never treat it as a content winner                                                    |
| Identity reused with different bytes, checksum failure, or malformed transport                            | Preserve original bytes and pending intent; diagnose internally, without pretending that sign-in or an update necessarily fixes it |

Unsupported Sync Revisions and Sync Migration failures are coordinator outcomes, not guesses from HTTP status codes. An Update PKSX action requires recognized evidence of an unsupported version. Adapter error codes include the operation and whether its outcome is known, without containing credentials or Save bytes.

Quota admission must account for concurrent uploads without publishing only half a coherent change. The provider must reserve enough capacity for Deletion Markers and cleanup bookkeeping to remain writable when the user-content quota is full. Quota size, payment, and user-visible space management remain separate product decisions.

## Contract verification before implementation is accepted

Use a credential-free fake adapter for coordinator tests and an isolated provider integration suite for storage guarantees. Required behavioral scenarios:

- Two installations publish different revisions from one parent; both revisions survive and the coordinator detects divergence.
- A process stops after any chunk, commit, or receipt; restart resumes with the same identities, without duplicated effects.
- A coherent Save File and Pokemon Storage move becomes visible completely or stays staged.
- A lost commit response is recovered by publication identity.
- Paginated catch-up during concurrent publication and after checkpoint expiry misses no committed revision.
- Two accounts cannot read, enumerate, subscribe to, or overwrite each other's records or artifact ranges.
- A full quota allows deletion and downloads, without partial publication of a multi-object change.
- A retention race with a new recovery pin fails its precondition rather than deleting the recovery.
- Revocation bounds apply to an already-open socket and an already-issued artifact grant.
- Account deletion retries across storage failures and cannot report success with residual accessible data.

These are implementation acceptance boundaries, not tests claimed to have passed.

## Dependencies and remaining decisions

The accepted boundary is recorded in [CONTEXT.md](../../CONTEXT.md) and [ADR 0020](../adr/0020-publish-coherent-cloud-sync-changes-idempotently.md). The focused PR closes this contract issue when merged.

Progress [Select the Cloud Sync provider](https://github.com/woahitsraj/PKSX/issues/414) after this issue closes. The existing [authentication and storage research](../research/cloud-sync-auth-and-tinybase-options.md) puts Cloudflare plus Better Auth first, but does not prove this contract or approve its operational burden. Recheck primary documentation against this contract before proposing the provider ADR. Contract approval does not select a provider, approve a paid plan, or authorize purchases or account changes.

The implementation breakdown waits for the complete specification, including the map's outstanding settings, quota ownership/payment, and space-view decisions. No implementation issues are declared ready by this contract.
