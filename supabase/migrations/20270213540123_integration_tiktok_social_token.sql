-- integration_tiktok_social_token
-- ============================================================================
-- Integration Activation Console — PR4b (TikTok social-publish access token).
-- ============================================================================
-- Completes the social-publish trio (Facebook + Instagram landed in PR4a). The
-- TikTok auto-post adapter is DORMANT in prod (gated on the token being present
-- AND a Content-Posting-API audit), so this is not a live-path change — but it
-- becomes console-settable with no redeploy.
--
--   • tiktok_access_token_enc → platform_integration_secrets (deny-by-default,
--     AES-256-GCM). The Setnayan TikTok account's user access token.
--
-- DISTINCT from the TikTok OAUTH client secret (tiktok_client_secret_enc, PR3)
-- which is for the per-couple Patiktok OAuth flow — this is the master-account
-- auto-publish token (path B). resolveTikTokAccessToken() reads it DB-first /
-- env-fallback to TIKTOK_ACCESS_TOKEN. Idempotent; no RLS change.

ALTER TABLE public.platform_integration_secrets
  ADD COLUMN IF NOT EXISTS tiktok_access_token_enc TEXT;

COMMENT ON COLUMN public.platform_integration_secrets.tiktok_access_token_enc IS
  'TikTok master-account user access token for social auto-publish (path B), AES-256-GCM. Resolved DB-first by resolveTikTokAccessToken() with env fallback to TIKTOK_ACCESS_TOKEN. Distinct from the OAuth client secret. Service-role-only.';
