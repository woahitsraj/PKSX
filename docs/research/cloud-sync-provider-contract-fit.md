# Cloud Sync provider recommendation against the accepted contract

For [Select the Cloud Sync provider](https://github.com/woahitsraj/PKSX/issues/414). Reviewed 2026-11-14 against the [accepted adapter contract](../architecture/cloud-sync-provider-adapter-contract.md). This is a recommendation awaiting the user's provider decision, not an accepted ADR or authorization to deploy, purchase, or change accounts.

## Recommendation

Select Cloudflare Workers for the authenticated service boundary, SQLite-backed Durable Objects for per-profile revision and publication metadata plus TinyBase transport, private R2 for raw artifacts, and Better Auth with D1 for identity and sessions. This retains the lead from the [earlier candidate research](cloud-sync-auth-and-tinybase-options.md). PKSX would operate the identity service and integrate email delivery. It would not collect passwords.

This recommendation is an architectural inference from the documented capabilities below. None of the documentation proves the complete PKSX adapter. No provider integration or native sign-in tests were run in this planning effort. A selected provider still needs implementation acceptance against the contract.

## Rechecked primary evidence

- TinyBase documents a synchronizer server running as a Cloudflare Durable Object, available since v5.4.0. This alone does not require upgrading PKSX's locked TinyBase 8.5.0. Verify the chosen persistence API against the locked version before implementation; do not use current documentation as evidence that every current API exists in that version. [TinyBase Durable Object module](https://tinybase.org/api/synchronizer-ws-server-durable-object/)
- SQLite-backed Durable Objects expose synchronous transactions with rollback. They cannot include asynchronous R2 operations. **Inference:** keep the publication identity, descriptor, sequence, quota reservations, and retention references in transactional metadata; finish remote artifacts before committing the descriptor. This fits coherent publication without pretending that SQLite and R2 share a transaction. [Durable Object storage transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#transactionsync)
- R2 documents strongly consistent object reads, writes, deletions, and listings. IAM changes are eventually consistent, and caching can alter what a public route serves. **Inference:** use private authenticated access and avoid cache paths for mutable publication metadata or access decisions. [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/)
- R2's Workers API supports multipart upload resumption by key and upload ID, part upload, and completion. **Inference:** the adapter must persist transfer identity, accepted part checksums, and completion outcome; the example API is not the contract's idempotency ledger. [R2 multipart API](https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/)
- Better Auth documents database-backed sessions and session revocation, and its database documentation explicitly covers SQLite/D1 programmatic migrations. **Inference:** D1 is a documented identity-storage option; exact runtime configuration, session renewal, and recovery behavior still need integration verification. [Better Auth database](https://better-auth.com/docs/concepts/database), [session management](https://better-auth.com/docs/concepts/session-management)
- Better Auth's JWT plugin supports a configurable expiry and defaults to 15 minutes. Its JWTs are distinct from the primary session. **Inference:** short-lived access credentials can meet the one-hour contract while a renewable session stays separate; JWT signature validation alone cannot enforce immediate session revocation or close an open socket. [Better Auth JWT plugin](https://better-auth.com/docs/plugins/jwt)
- Better Auth's passwordless magic-link plugin requires the operator to implement the email sender callback. It is not a hosted identity or email-delivery service. **Inference:** select a delivery integration and establish ownership of security updates, abuse controls, and email reliability before launch. [Better Auth magic link](https://better-auth.com/docs/plugins/magic-link)
- Better Auth provides account-deletion hooks. **Inference:** one cleanup callback is insufficient evidence of durable deletion across D1, Durable Objects, and R2. Persist a deletion job and prevent renewed access while deletion resumes; report completion only after all account data is erased. [Better Auth user deletion](https://better-auth.com/docs/concepts/users-accounts)
- Capacitor documents receiving associated links through `appUrlOpen`; RFC 8252 requires external user agents and PKCE for native OAuth authorization. **Inference:** use a system-browser sign-in and a one-time, app-bound return exchange, never a long-lived credential in a deep link. This is a PKSX integration to design and test, not a claim of turnkey Better Auth Capacitor support. [Capacitor deep links](https://capacitorjs.com/docs/guides/deep-links), [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252)

## Contract obligations PKSX must build

1. An authenticated profile boundary for every record, cursor, socket, artifact, and upload handle. The server chooses the profile from identity, rather than trusting a client room name.
2. A transactional append-only publication ledger with recoverable receipts and gap-free catch-up, retaining concurrent heads. TinyBase merges never choose Shared Sync State.
3. Resumable artifacts, checksum verification, and quota reservations before coherent publication. A full user quota must leave deletion and bookkeeping possible.
4. Conditional cleanup coordinated with new recovery pins. Use a durable deletion reservation that prevents a new reference to the same artifact generation while an R2 delete is in flight. Release or complete that reservation on recovery; a stale cleanup attempt must never delete a newly live generation. This is a design requirement, not a proven algorithm.
5. Session renewal and revocation across HTTP, sockets, and artifact grants. Stop existing access within the accepted one-hour bound and bind any new grant to the remaining authorization lifetime.
6. Restart-safe account deletion, email recovery with session revocation, and a native browser callback exchange with secure credential storage.

These obligations follow the accepted contract. Selecting the stack does not mark them implemented or verified.

## Limits and remaining product decisions

A single SQLite-backed Durable Object has a finite metadata capacity. The current limits document distinguishes 1 GB on Free and 10 GB on Paid; writes fail at the physical limit. **Inference:** raw artifacts belong in R2, and capacity planning must reserve metadata headroom for deletion and ancestry before reaching that limit. No plan, per-user quota, budget, or purchase is selected here. [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/)

Deletion Markers and Sync Ancestry Records persist under the accepted policy, so metadata can grow even after superseded content is removed. Implementation planning must cover admission limits and a future partitioning path without expiring causal history or pretending a user's artifact quota is the physical database ceiling.

Still unresolved on [Wayfinder: Cloud Sync for Saves](https://github.com/woahitsraj/PKSX/issues/302): settings entry and account controls, quota ownership and payment, the family-level space view, and the final implementation breakdown. The adapter contract now defines test boundaries; the breakdown must turn them into issue-specific acceptance criteria.

## Decision frontier

Accept this stack as the first Sync Provider, including PKSX ownership of the passwordless identity service and email-delivery integration?

Recommendation: yes. This chooses the proposed service roles for planning and accepts the operational responsibility. Email vendor, initial sign-in methods, quota, budget, and hosting plan require subsequent focused decisions. If the user instead wants managed identity operations, revisit the managed candidate from the earlier research before selecting a provider.

After approval, record the selected service roles and reasons in an ADR and CONTEXT.md, and complete this focused issue through its PR. Until then, leave the issue open and use no closing keyword.
