## 2026-07-21 · feat(auth): re-add Facebook OAuth login (flag-off)

Owner directive 2026-07-21 ("i also want to add facebook login"). Facebook
OAuth was removed 2026-06-15 when the V1 provider set was locked to Google +
Apple; this restores it as a third provider behind its own gate.

- `apps/web/app/auth/oauth-actions.ts` — `'facebook'` added to the
  `SupabaseOAuthProvider` union; new `signInWithFacebook` server action reusing
  the shared `signInWithProvider` flow (no new callback path — `/auth/callback`
  is provider-agnostic).
- `apps/web/app/_components/oauth-icons.tsx` — new `FacebookIcon` (Meta's
  sanctioned white "f" on the #1877F2 brand circle; no per-variant fill needed
  since the brand circle carries its own contrast).
- `apps/web/app/_components/oauth-button-row.tsx` — third button, order
  Google → Apple → Facebook; `ANY_OAUTH_ENABLED` now includes Facebook so the
  "or continue with email" divider logic stays correct.
- `apps/web/app/_components/desktop-oauth-buttons.tsx` +
  `apps/web/lib/desktop-oauth.ts` — same provider added to the Tauri
  system-browser loopback variant so web and desktop stay at parity.
- `.env.example` — `NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED`, documented alongside
  the existing Google/Apple gates.

Ships **OFF**: the flag defaults to empty, so `/login`, `/signup`, and the
desktop rail are byte-identical on the live site until the owner (1) adds the
Facebook Login product to the Meta app with Supabase's callback in Valid OAuth
Redirect URIs, (2) pastes App ID + App Secret into Supabase Studio → Auth →
Providers → Facebook, and (3) sets the flag to `true` in Vercel. The Meta app
must also be in **Live** mode — in Development mode only people with a role on
the app can complete the login.

Unrelated to `lib/social/facebook.ts` (Page auto-publishing), which runs on a
separate Meta credential and is untouched here.

Verified: `tsc --noEmit` clean, ESLint clean on all five files, and the button
rendered correctly at `/login` against a local dev server with the flag forced
on.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-06-15 "Facebook OAuth removed"
lock is partially reversed (provider re-added, still owner-gated).
