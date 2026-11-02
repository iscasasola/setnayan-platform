## 2026-10-19 · feat(erasure): erasing an account revokes its Sign in with Apple grant (App Store 5.1.1(v))

Apple-readiness check 2026-10-19 row 19: nothing called
`appleid.apple.com/auth/revoke`, and nothing held a token that could be revoked —
Supabase hands Apple's refresh token over once, at the code exchange, and keeps
no copy we can read; the iPhone app's native sheet yields only an identity token
and a five-minute authorization code.

- **Hold** — new service-role-only table `apple_sign_in_tokens` (RLS on, no
  policies, no anon/authenticated grant), one sealed refresh token per person
  (`lib/oauth-token-vault.ts`). Written by `/auth/callback` when the sign-in that
  just happened was the Apple one (`appleWasJustUsed`), and by the native marker
  action, which trades the sheet's authorization code at `/auth/token` for the
  bundle ID and holds the result only when its Apple `sub` matches the account.
  The iOS plugin now returns `authorizationCode` (needs a new app build).
- **Revoke** — `eraseUserAccount` step 2b calls `ErasureIo.revokeAppleSignIn`
  (required on the type) before the `OWN_ROW_DELETES` loop deletes the row.
  Every outcome except "never used Apple" is written to `admin_audit_log`:
  `apple_sign_in_revoked`, or `erasure_step_failed` with stage
  `apple-sign-in-revoke` and outcome `failed` / `not_configured` / `no_token_held`.
  A failed or throwing revoke never stops the erasure.
- **Secrets** — owner-held, read from env: `APPLE_SIGNIN_TEAM_ID`,
  `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY`, `APPLE_SIGNIN_SERVICES_ID`,
  `APPLE_SIGNIN_BUNDLE_ID`. Unset → recorded as `not_configured`.

Guards: `lib/apple-sign-in.test.ts` (client-secret header/claims, 64-byte
ieee-p1363 signature verified against a test key, revoke form body, outcomes),
`lib/erasure/apple-revoke-on-erasure.test.ts` (real `eraseUserAccount`, mocked
revoke: called once, before the row delete, every outcome recorded, a throw does
not stop erasure). Six sabotages, all red.

SPEC IMPACT: None — a compliance fix to the shipped erasure flow; no product
decision changes. Owner actions (env vars, Apple key grouping, a new iOS build)
are listed in the PR body.
