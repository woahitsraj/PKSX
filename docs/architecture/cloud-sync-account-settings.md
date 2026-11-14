# Cloud Sync account settings and space management

Accepted by the user on 2026-11-14 for [Define Cloud Sync account settings and space management](https://github.com/woahitsraj/PKSX/issues/467). This specifies behavior for future implementation.

## Entry and account controls

Eligible users open one Cloud Sync Takeover through the existing settings entry. Eligibility is controlled by the separate access policy; signing in is not itself permission to use Cloud Sync. The initial personal rollout hides the entry from other users. Do not add a public upgrade, sign-in, or waitlist prompt as part of this workflow.

While signed out, explain opt-in, provider-readable storage, and local-only use, then offer enable/sign-in. Existing local Saves enters the profile only through the already-defined Sync Adoption confirmation. Cancelling sign-in or adoption preserves local Saves and leaves the Installation unenrolled. A person can use PKSX locally without an account.

While enrolled, show the User Account identity, cloud space used and Sync Quota, actionable authentication or quota state, degraded durability if applicable, and Manage storage. Do not show automatic transient retry failures. Exact sign-in methods are specified separately.

Offer sign out, sign out everywhere, and delete account. Sign out retains local Saves and profile association. Sign out everywhere includes the requesting Installation; it cannot erase another Installation's local bytes. Account deletion explains that it irreversibly removes the Sync Profile and all cloud data while retaining local Saves. A new account, even at the same email, is a new profile. Account-deletion completion waits for the provider to finish durable erasure; a network interruption must not claim success prematurely.

## Manage storage

Manage storage replaces the account view within the Takeover workflow. Show aggregate usage and quota plus usage by Save File Family, Pokemon Storage, and Conflict Recoveries. Each family can be opened to inspect the owning Save File, its optional Workspace, and Backups. Explain remote-only recovery bytes when applicable. Usage belongs to the Sync Profile, rather than being confused with this Installation's local storage usage.

Use existing domain deletion operations and their confirmations. Deleting a Save File covers its entire family, including its Workspace and Backups, and warns about a Dirty Workspace. Backup deletion, Workspace Discard, and Conflict Recovery deletion retain their existing meanings. Deleting cloud data is not an independent operation that leaves a silently resurrecting local counterpart. Never offer arbitrary raw-artifact deletion or automatic removal to make space.

Cloud usage may lag a user action or an offline Installation's pending work. Preserve the last known usage with an indication when it cannot be refreshed; do not report projected savings as confirmed freed space. Until the provider confirms a deletion, pending uploads may still be blocked by quota. A failed local write leaves the prior state and acknowledgement unchanged.

## Navigation and confirmations

Follow ADRs 0012 and 0014: one Menu or Takeover at a time, destructive confirmations inline, durable status in its owning view, and transient feedback only for user actions. Back from a confirmation cancels it; Back from a storage detail returns through the workflow; leaving the Takeover returns Controller Focus to its launcher. Back never signs out, deletes data, or silently accepts Sync Adoption.

Opening settings does not replace active local content with incoming revisions or erase staged edits. Unrelated local work and Export remain available when the workflow closes. Offline actions explain which remote result cannot be completed yet without inventing an automatic retry warning.

## Implementation acceptance

- An ineligible user sees no Cloud Sync entry, including on a direct navigation attempt; the service also rejects unauthorized access under the separate access policy.
- Sign-in and adoption cancellation preserve local Saves and never enroll an unintended account.
- Keyboard, gamepad, and pointer reach the same controls. Back cancels confirmations and restores focus without stacked surfaces.
- Signing out preserves local Saves; signing out everywhere includes the requester and explains retained remote local copies.
- A family deletion warns about its Dirty Workspace and includes the family; no individual child is orphaned.
- Quota and local-storage errors remain distinct. Offline or stale usage does not claim confirmed space savings.
- Account deletion interrupted between storage services resumes without declaring completion while data remains.

These are future acceptance requirements, not tests claimed to have passed. Access eligibility, billing, funding, and exact sign-in methods remain separate decisions.
