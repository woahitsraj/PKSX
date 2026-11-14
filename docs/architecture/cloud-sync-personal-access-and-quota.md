# Cloud Sync personal access and initial quota

For [Set Cloud Sync beta funding and initial quota](https://github.com/woahitsraj/PKSX/issues/468). The user approved the personal rollout, hidden access, maintainer funding, and initial allowance on 2026-11-14. Future public billing and the deployment budget remain open. This document authorizes planning only.

## Accepted initial rollout

Cloud Sync is initially available only to the maintainer's explicitly authorized User Account. This replaces the proposed invite-only beta with one personal account. Other people continue using PKSX locally and see no Cloud Sync entry, sign-in prompt, upgrade advertisement, or disabled Cloud Sync control. Cloud Sync deep links and direct routes must not expose the feature to an unauthorized account.

Authorization is enforced by the service, not merely by a hidden client control. New profile enrollment, publication, record enumeration, artifact access, and existing transport connections must all respect the access policy. A public client flag or a request containing the maintainer's email or account ID cannot grant access. The default is denied. Missing or unverified eligibility never uploads local Saves.

Provisioning binds access to the maintainer's authenticated, immutable internal User Account identity. Account recovery must recover that account, not grant eligibility to a newly registered account that claims its email. Deleting the User Account and recreating one at the same email does not restore eligibility automatically. The exact identity is a deployment input to establish through an authenticated provisioning step; do not request credentials during planning or expose them in repository files.

Authentication and eligibility are distinct. A valid Google or Apple login is not permission to enroll. Account creation and passkey enrollment endpoints also need the bootstrap restriction so arbitrary public sign-ups cannot turn into authorized accounts. A native callback or restored session cannot bypass the same policy. Keep this as a small explicit access check, without building a generalized billing system for a single-user rollout.

## Accepted initial funding and allowance

The maintainer funds the personal rollout. There is no initial user billing. The initial Sync Quota is server-configured at 1 GiB per Sync Profile for user-visible synchronized content, including Backups and Conflict Recoveries. Preserve separate metadata headroom for Deletion Markers, ancestry, reservations, and cleanup so a full user quota can still accept deletion and downloads. The quota is a logical content allowance, not the physical maximum of a storage product.

Existing retention, artifact-size, offline-editing, Export, and full-quota rules remain unchanged. There is no automatic deletion of user-visible content or silent reduction of the allowance. The deployment plan must specify accounting and metadata limits without expiring causal history.

## Unresolved public product and deployment decisions

The user raised a paid public feature as a possibility. No price, subscription, payment vendor, public availability, trial, or payment platform is selected. Recommendation for discussion: public Cloud Sync can be an optional recurring paid service while local Saves, editing, and Export remain usable without it. Do not treat this recommendation as an approved business model or implement checkout.

Before any deployment or purchase, establish the total operating budget, hosting plan, email-delivery choice, and capacity alerts. These are not authorized by the approval of maintainer funding. With only the maintainer eligible, there is no public enrollment to pause; broader admission rules belong to a later public rollout decision.

## Future acceptance boundaries

- Only the provisioned maintainer User Account can enroll, read, publish, subscribe, or transfer artifacts. A second account is rejected even when it knows a valid profile or artifact identifier.
- Other users see no Cloud Sync controls or public marketing prompts, and direct URLs or native callbacks do not expose authorized data.
- A forged client eligibility value does not change the service's decision. A missing gate configuration denies access.
- Restoring local state from another Installation or signing into a different User Account does not inherit eligibility or upload previous-profile data.
- Account deletion and recreation at the same email do not transfer the deleted account's access grant or Sync Profile.
- Full content quota preserves pending changes, downloads, Deletion Markers, and local editing/Export under the accepted policy.

These are future implementation requirements, not tests claimed to have passed. The issue remains open for the outstanding deployment budget and public monetization decision.
