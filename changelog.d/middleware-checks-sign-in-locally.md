## 2026-09-29 · perf(auth): the sign-in check in front of every page verifies the token locally

`updateSession()` (`apps/web/lib/supabase/middleware.ts`) called
`supabase.auth.getUser()`, a network round trip to the Supabase auth server,
on EVERY request, public pages included. The middleware uses that answer only
for `?demo=1` and the signed-in redirect. It now calls `getClaims()`, which
verifies the access token's ES256 signature on our server against the
project's published key (cached for 10 minutes per instance). It still
refreshes an expired session, and a legacy HS-signed token falls back to
`getUser()` automatically.

The returned user is now `SessionUser = { id: string }`, not a full supabase
`User`, because a token does not carry `last_sign_in_at`, `identities` and so
on. The type makes any other field a compile error (proven: `user.email`
fails tsc).

⚖ The trade, owner-approved 2026-09-29 ("change it"): a ban, deleted account or
sign-out-everywhere reaches THESE TWO USES only when the token expires (≤ 1 h).
Every protected surface still checks server-side, so no data access changes.
The ~590 page-level `getUser()` / `getCurrentUser()` checks are NOT changed.

Guarded by `lib/supabase/middleware-checks-the-token-locally.test.ts`
(sabotaged: putting `getUser()` back fails 2 of 3).

SPEC IMPACT: `DECISION_LOG.md`, row 2026-09-29 "THE SIGN-IN CHECK IN FRONT OF
EVERY PAGE VERIFIES THE TOKEN LOCALLY", records the owner's trade decision and
the deliberately-not-done page-level half.
