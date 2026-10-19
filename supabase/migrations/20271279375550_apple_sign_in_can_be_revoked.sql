-- apple_sign_in_can_be_revoked
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

/*
  ── WHY ─────────────────────────────────────────────────────────────────────
  App Store Review Guideline 5.1.1(v): when a person who signed in with Apple
  deletes their account, the app must revoke their Sign in with Apple grant
  (POST https://appleid.apple.com/auth/revoke). Apple-readiness check
  2026-10-19, row 19: nothing did.

  Revoking needs a token Apple issued for that person. Supabase does not keep
  Apple's refresh token anywhere we can read later — it hands it over ONCE, as
  `session.provider_refresh_token`, at the moment the sign-in code is exchanged
  (/auth/callback), and the phone app's native Apple sheet produces only an
  identity token plus a five-minute authorization code. So the token has to be
  HELD at sign-in, or there is nothing to revoke at erasure.

  ── THE TABLE ───────────────────────────────────────────────────────────────
  One row per person: the latest Apple refresh token, SEALED (AES-256-GCM,
  lib/oauth-token-vault.ts — the same envelope the Google keys use), and which
  Apple client issued it, because a revoke must name the same client_id:
    'web'     → the Services ID Supabase's Apple provider uses (web + Android)
    'ios_app' → the app's bundle ID (the native Sign in with Apple sheet)

  · Written and read on the SERVICE client only — at sign-in (capture) and at
    erasure (revoke). RLS on, NO policies, no grant to anon/authenticated:
    a credential no browser should ever be able to read, its owner included.
  · user_id → public.users ON DELETE CASCADE. Erasure anonymizes in place and
    deletes nothing upstream, so the row is ALSO removed explicitly by the
    erasure purge (lib/erasure/coverage.ts OWN_ROW_DELETES), AFTER the revoke
    step has read it (lib/erasure/purge.ts, step 2b).
*/

CREATE TABLE IF NOT EXISTS public.apple_sign_in_tokens (
  user_id               UUID PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  apple_client          TEXT NOT NULL CHECK (apple_client IN ('web', 'ios_app')),
  refresh_token_sealed  TEXT NOT NULL,
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.apple_sign_in_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.apple_sign_in_tokens FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.apple_sign_in_tokens IS
  'The latest Sign in with Apple refresh token per person, sealed (lib/oauth-token-vault.ts), '
  'held only so account erasure can revoke it at appleid.apple.com/auth/revoke (App Store 5.1.1(v)). '
  'Service role only; RLS on with no policies. Deleted by the erasure purge after the revoke.';
