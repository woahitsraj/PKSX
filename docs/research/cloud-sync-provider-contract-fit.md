# Cloud Sync provider recommendation against the accepted contract

For [Select the Cloud Sync provider](https://github.com/woahitsraj/PKSX/issues/414). Reviewed 2026-11-14 against the [accepted adapter contract](../architecture/cloud-sync-provider-adapter-contract.md). The user accepted the provider selection on 2026-11-14 after the deeper trade-off review. [ADR 0021](../adr/0021-use-cloudflare-and-better-auth-for-cloud-sync.md) records the decision. This research does not authorize deployment, purchases, or account changes.

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

## Deeper trade-off review

The user's provisional agreement on 2026-11-14 was followed by a request for more evidence. The user accepted Cloudflare plus Better Auth after this review. The strongest comparison is Cloudflare with Better Auth versus managed Supabase. The earlier ranking should not be read as a proven ranking of total engineering effort or total cost.

### What the operator owns

With Better Auth, PKSX operates the auth deployment and database migrations, updates the library when security fixes land, protects credentials, configures recovery and account linking, and handles rate limits and abuse. The library supplies authentication mechanisms; it does not supply a team operating the service. Passwordless sign-in removes password storage, but verification links and sessions remain security-sensitive. These are operational inferences from the deployment, session, and sender responsibilities in the [Better Auth database](https://better-auth.com/docs/concepts/database), [sessions](https://better-auth.com/docs/concepts/session-management), and [magic-link](https://better-auth.com/docs/plugins/magic-link) documentation.

Supabase hosts the auth service and supplies tokens, refresh, and account APIs. PKSX still owns authorization policies, frontend redirects, email configuration, deletion orchestration, and the sync protocol. Supabase's built-in SMTP is explicitly unsuitable for production and sends only to pre-authorized team addresses until custom SMTP is configured. Choosing managed auth therefore reduces auth-server operation, but does not eliminate email delivery work. [Supabase Auth](https://supabase.com/docs/guides/auth), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

An email delivery subcontractor does not become the owner of the Sync Profile or the account database. That is distinct from splitting identity authority and storage across separate Sync Providers. No email vendor is selected here.

### Sync implementation effort

Cloudflare has the closer existing TinyBase transport. PKSX's installed TinyBase 8.5.0 package already includes the Durable Object synchronizer and SQL persister. Inspection of its published synchronizer JavaScript found `ctx.acceptWebSocket` and `webSocketMessage`, so hibernation support is present in the pinned package. This is source inspection, not a runtime test. [TinyBase 8.5.0 published synchronizer](https://unpkg.com/tinybase@8.5.0/synchronizers/synchronizer-ws-server-durable-object/index.js)

Supabase has a TinyBase persister that serializes a whole Store into one row, not a ready-made append-only PKSX revision transport. A Supabase design should use normalized immutable revision/publication rows, database transactions, and a durable catch-up query, with Realtime as a notification hint. This is an architectural inference, not an implemented alternative. TinyBase can remain the local reactive layer. [TinyBase Supabase persister](https://tinybase.org/api/persister-supabase/functions/creation/createsupabasepersister/), [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

Both choices need PKSX's causal coordinator, immutable revisions, conflict preservation, coherent publication, quota admission, restart-safe deletion, and guarded artifact cleanup. Supabase supplies resumable uploads through TUS, while Cloudflare supplies R2 multipart uploads. Neither makes a blob upload and a metadata transaction one atomic operation. The accepted completeness descriptor is still necessary. [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads), [R2 multipart uploads](https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/)

There is no measured basis to claim that Cloudflare is faster to deliver overall. It trades less transport adaptation for more identity operation. Supabase trades more transport adaptation for a managed identity service and familiar Postgres operations.

### Cost and idle connections

As of this review, Workers Paid has a USD 5 monthly account minimum. Supabase Pro starts at USD 25 monthly with the first project included. These are different bundles, not full PKSX cost estimates. Existing subscriptions, additional environments, compute, storage, operations, logs, and email change the incremental bill. No subscription or plan is authorized. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Supabase pricing](https://supabase.com/pricing)

R2 Standard storage is USD 0.015 per GB-month after its 10 GB-month free allowance, plus operation charges; internet egress is free. Supabase Pro includes 100 GB of file storage and 250 GB of uncached egress, with listed overage rates of USD 0.0213 per GB-month of file storage and USD 0.09 per GB of uncached egress. These rates favor R2 for repeated artifact downloads at volume, but a small deployment may remain within either provider's included allowances. [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Supabase pricing](https://supabase.com/pricing)

Cloudflare Durable Object duration can be charged while sockets keep an object awake; hibernation avoids idle-duration charges when eligible. The pinned TinyBase implementation has the right API, but an adapter's timers or background work can still prevent hibernation. Supabase meters Realtime messages and peak connections. Neither should be costed only by total Save bytes. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Supabase Realtime pricing](https://supabase.com/pricing)

A useful future cost model needs active users, retained bytes including Backups and Conflict Recoveries, installations per user, downloads, publication frequency, connected hours, and sign-in email volume. No workload measurements exist yet. The accepted indefinite recovery/ancestry retention makes quotas and metadata headroom more important than an optimistic per-save estimate.

### Reliability, portability, and exit cost

Cloudflare lets us keep identity and sync operations under one deployment ecosystem, but requires coordination across D1, Durable Objects, and R2. Moving away means replacing the Durable Object execution and socket model as well as migrating records and artifacts. Supabase offers standard Postgres for records and policy enforcement, but its Auth, Storage, Realtime APIs, and operational setup still create migration work. Provider-neutral object/revision identities reduce data coupling; they do not make either deployment portable without work. These are architectural inferences from the respective service roles and the accepted adapter boundary.

For either provider, a service outage leaves local editing and Export usable under the existing domain rules. The difficult failures are partial publication and cleanup races, not only provider availability. Both need fault-injection tests before launch. Provider backup is disaster recovery for an operator, not a replacement for the user's Backups or Conflict Recoveries.

Free-tier behavior differs. Supabase may pause an inactive free project after one week. Cloudflare's Durable Object free limits reject further operations of the exhausted type until the applicable daily reset. Free tiers are useful for evaluation, but neither is evidence of a reliable production cost ceiling. [Supabase pricing](https://supabase.com/pricing), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

### Native integration and other candidates

Native sign-in remains a real integration task on either stack. A browser-based success does not verify system-browser callbacks, process restart, secure token storage, recovery, or sign out everywhere on iOS/Android. The previous research's phrase "no candidate documents Capacitor" should be read narrowly as no verified turnkey PKSX integration, not proof that no relevant Ionic or community guidance exists. Keep native acceptance explicit and do not assume that switching to managed auth removes it. [Capacitor deep links](https://capacitorjs.com/docs/guides/deep-links), [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252), [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)

Firebase remains possible, but this review found no reason to displace the two leading options. Its Cloud Storage requires the pay-as-you-go Blaze plan starting February 3, 2026, so it is not a no-billing-account alternative. The earlier research records its weaker TinyBase fit. Clerk with separate storage would reopen the settled single-provider boundary. A mixed Supabase Auth/Cloudflare storage stack also reopens that decision and adds a cross-provider lifecycle. [Firebase storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [earlier candidate research](cloud-sync-auth-and-tinybase-options.md)

### Recommendation after the deeper review

Cloudflare plus Better Auth remains the recommendation if PKSX accepts owning authentication operations. Supabase is a credible alternative if reducing that responsibility matters more than using TinyBase's existing server transport. Do not choose on the USD 20 difference between advertised starting fees alone; modest maintenance work can outweigh it, and no engineering-hour estimate has been measured.

More broad vendor research has diminishing value. The remaining technical uncertainty calls for a small acceptance spike after separate implementation authorization: prove durable publication across a lost response, a cleanup/recovery race, bounded access on an already-open socket, and restart-safe native sign-in. This planning thread does not implement that spike. Until then, the recommendation has documentation and source-inspection support, not tested production guarantees.

## Accepted decision and remaining planning

The user accepted Cloudflare Workers, SQLite-backed Durable Objects, private R2, and D1 with Better Auth as the first Sync Provider, including PKSX ownership of passwordless authentication operations and email-delivery integration. [ADR 0021](../adr/0021-use-cloudflare-and-better-auth-for-cloud-sync.md) records the reasons and rejected alternative; [CONTEXT.md](../../CONTEXT.md) records the provider boundary.

Initial sign-in methods, email vendor, settings and space-management workflows, quota, budget, and hosting plan remain separate focused decisions. The implementation breakdown must include the acceptance spikes identified above and cannot treat this research as a passing provider integration test. No infrastructure or runtime work is authorized by this planning decision.
