# Cloud Sync sign-in methods

For [Define first-release Cloud Sync sign-in methods](https://github.com/woahitsraj/PKSX/issues/466). The user selected passkeys first, Google and Apple social sign-in next, and one-time codes last on 2026-11-14. This replaces the earlier recommendation to start with email codes. Initial account setup, linking across different provider emails, and the exact recovery interaction remain questions below, not accepted decisions.

## Accepted methods and preference

Make passkeys the preferred ordinary sign-in. Support Google and Apple as the social choices. Keep emailed one-time codes below those choices in priority; do not make them a routine additional step after a successful passkey or social sign-in. Do not add passwords or additional social providers to the first-release scope.

One authenticated User Account owns at most one personal Sync Profile. A successful authentication does not grant Cloud Sync eligibility; the initial personal rollout permits only the maintainer's explicitly provisioned account. Authorization must be checked independently of the chosen sign-in method.

Use the provider's system-browser origin on Capacitor and an app-bound, single-use completion exchange under the existing session contract. PKSX must verify cancellation, restart, credential storage, and bounded revocation on native devices. These methods are future capabilities, not implemented or tested integrations.

## Research that sharpens the remaining decisions

Better Auth supports passkey registration, including pre-auth registration supplied with a server-validated user context. Its default registration path requires an authenticated session. **Inference:** a passkey proves control of a credential, not ownership of an arbitrary email typed into a registration form. The existing verified-email account rule therefore needs an email-verification bootstrap before a new account can complete setup. [Better Auth passkeys](https://better-auth.com/docs/plugins/passkey)

Better Auth documents Google and Apple sign-in. Apple requires its developer credentials and has private email relay support; an Apple email can differ from the address a user supplies through Google. **Inference:** equating those identities by similar names or silently changing the account email can split access or misidentify the Sync Profile. [Better Auth Google](https://better-auth.com/docs/authentication/google), [Better Auth Apple](https://better-auth.com/docs/authentication/apple), [Apple private email relay](https://developer.apple.com/documentation/signinwithapple/communicating-using-the-private-email-relay-service.md)

Better Auth allows explicit social linking while authenticated, can disable implicit linking, and has an explicit setting for linking providers with different email addresses. Linking need not replace the user's existing verified email. **Inference:** this can preserve a single Sync Profile while adding Google and Apple, but allowing different email addresses qualifies the existing rule that every sign-in method resolves by the same address. The domain rule must be amended only after the user approves this distinction. [Better Auth account linking](https://better-auth.com/docs/concepts/users-accounts#account-linking)

## Recommendations awaiting approval

1. For first account setup, sign in with Google or Apple to establish the verified email, then offer passkey enrollment immediately. Thereafter lead with passkey sign-in. This avoids a compulsory emailed code while retaining the verified-email requirement. Direct passkey-only registration without a verified enrollment context is not permitted.
2. Link Google and Apple explicitly from the authenticated account, including when Apple uses a relay address or the provider emails differ. Keep one verified primary account email and one Sync Profile. Do not merge pre-existing accounts or their Saves automatically, and do not implicitly grant personal access to a second account. A linked sign-in is a credential for the existing account, not another Sync Profile owner.
3. Offer multiple named passkeys with explicit removal and a safeguard against removing the last usable access method. Use linked Google/Apple as the preferred way back in when a passkey is unavailable. Keep email codes behind an explicit recovery choice rather than in the ordinary flow. Account recovery still revokes all sessions under the existing rule.

These recommendations are not authorization to change the existing account identity model. The issue remains open until the bootstrap, linking, and recovery choices are confirmed and the domain docs record them.

## Future acceptance boundaries

- A previously enrolled passkey signs into its existing account without a routine email-code challenge.
- Google and Apple are available as alternatives; cancellation cannot enroll an unintended account or adopt local Saves.
- Adding a passkey requires a verified enrollment context and cannot bind an attacker-supplied email to an unverified account.
- An Apple relay identity and Google identity can reach the same profile only through the approved linking policy; no silent profile merge or eligibility transfer occurs.
- An unavailable, deleted, or cancelled passkey leaves the fallback choices usable. Revoked credentials stop authorizing access under the session contract.
- A direct callback, stale session, or forged client eligibility cannot enroll another user in the personal rollout.

No runtime, provider, or native tests were run for this documentation. Exact API choices must be checked against the version selected for implementation.
