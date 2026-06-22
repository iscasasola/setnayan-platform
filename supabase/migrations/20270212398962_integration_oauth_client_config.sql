-- integration_oauth_client_config
-- ============================================================================
-- Integration Activation Console — PR3 (OAuth trio: YouTube / Google Drive / TikTok).
-- ============================================================================
-- Makes the OAuth CLIENT config DB-first (settable without a Vercel redeploy)
-- for the three dormant OAuth integrations. Each has ONE secret (the client
-- secret) + non-secret config (client id/key + redirect URI(s)).
--
--   • CLIENT SECRETS  -> platform_integration_secrets (deny-by-default, RLS on /
--     NO policies, AES-256-GCM via lib/encryption.ts). NEVER world-readable.
--   • CLIENT IDs/KEYS + REDIRECT URIs -> platform_settings (non-secret config;
--     world-readable like resend_from_address). Redirect URIs and client ids
--     appear in the public OAuth consent URL, so they are not secrets.
--
-- Google Drive is SHARED by Papic (0012) and Photo Delivery (0009): ONE client
-- secret + ONE client id, but TWO redirect URIs (one per consumer).
--
-- DB-first / env-fallback: lib/integration-config.ts resolveOAuthClientConfig()
-- reads these first and falls back to the existing env vars when unset, so the
-- get*OAuthConfig() helpers stay byte-identical when the DB is empty (all three
-- integrations are dormant in prod today -> ready:false either way).
--
-- This is the PLUMBING; the console cards that write these land in the PR3b
-- follow-up. Idempotent.

-- ----------------------------------------------------------------------------
-- 1) Client secrets -> deny-by-default secrets singleton (encrypted)
-- ----------------------------------------------------------------------------
ALTER TABLE public.platform_integration_secrets
  ADD COLUMN IF NOT EXISTS youtube_oauth_client_secret_enc       TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_oauth_client_secret_enc  TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_client_secret_enc              TEXT;

COMMENT ON COLUMN public.platform_integration_secrets.google_drive_oauth_client_secret_enc IS
  'Google Drive OAuth client secret (AES-256-GCM), SHARED by Papic (0012) + Photo Delivery (0009). Resolved DB-first by resolveOAuthClientConfig() with env fallback to GOOGLE_DRIVE_OAUTH_CLIENT_SECRET. Service-role-only.';

-- ----------------------------------------------------------------------------
-- 2) Client ids/keys + redirect URIs -> non-secret config (world-readable)
-- ----------------------------------------------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS youtube_oauth_client_id          TEXT,
  ADD COLUMN IF NOT EXISTS youtube_oauth_redirect_uri       TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_oauth_client_id     TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_oauth_redirect_uri  TEXT,
  ADD COLUMN IF NOT EXISTS photo_delivery_oauth_redirect_uri TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_client_key                TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_oauth_redirect_uri        TEXT;

COMMENT ON COLUMN public.platform_settings.google_drive_oauth_client_id IS
  'Google Drive OAuth client id (non-secret; appears in the consent URL). Shared by Papic + Photo Delivery. Resolved DB-first with env fallback to GOOGLE_DRIVE_OAUTH_CLIENT_ID.';
