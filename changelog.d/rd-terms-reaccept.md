## 2026-09-26 · fix(signup): accounts with no Terms agreement on record are asked once

Measured in production: all 3 accounts created since the clickwrap shipped (2026-09-22)
had no `terms_accepted_at` — one email, one **Google**, one **Apple**. The OAuth callback
(`app/auth/callback`) has never recorded the agreement, so every Google/Apple sign-up
would keep arriving without one. The dashboard layout now shows a one-time "One quick
thing — please agree to our Terms" screen IN PLACE of the page (never a redirect, so it
cannot loop) to a signed-in, non-anonymous account created on or after 2026-09-22 with no
agreement (`needsTermsAgreement` in `lib/terms-agreement.ts`; fails open on a failed read).
`acceptTermsNow` refuses without the ticked box and only writes where nothing is recorded.
The welcome tour waits until after. Tests: `lib/terms-reaccept.test.ts` (sabotage: `>=` →
`>` on the date boundary → 1 fail). +1 server-action export.

Follow-up (not in this PR): a guest who signs up from an invitation and never opens the
dashboard is not asked; and the OAuth door itself should record the agreement at sign-up.

SPEC IMPACT: None (implements the owner's 2026-09-25 "yes" to re-prompting).
