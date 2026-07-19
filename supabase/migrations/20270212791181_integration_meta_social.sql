-- integration_meta_social
-- ============================================================================
-- Integration Activation Console — PR4a (Meta / Facebook + Instagram auto-publish).
-- ============================================================================
-- Makes the Meta publishing credential settable from /admin/integrations without
-- a Vercel redeploy. ⚠ This is the LIVE auto-publish path (FB posting is live in
-- prod), so the resolver is DB-first / env-fallback and BYTE-IDENTICAL when these
-- columns are empty — today's env-configured posting keeps working unchanged.
--
--   • meta_page_access_token_enc → platform_integration_secrets (deny-by-default,
--     AES-256-GCM). ONE token authorizes BOTH Facebook AND Instagram publishing.
--   • meta_page_id + ig_user_id → platform_settings (NON-secret public identifiers
--     — they appear in Graph API URLs; world-readable like resend_from_address).
--
-- resolveMetaConfig() (lib/integration-config.ts) reads these DB-first and falls
-- back to META_PAGE_ACCESS_TOKEN / META_PAGE_ID / IG_USER_ID env. Idempotent;
-- NO RLS change.

ALTER TABLE public.platform_integration_secrets
  ADD COLUMN IF NOT EXISTS meta_page_access_token_enc TEXT;

COMMENT ON COLUMN public.platform_integration_secrets.meta_page_access_token_enc IS
  'Meta Page access token (System User or Page token), AES-256-GCM. Authorizes BOTH Facebook Page + Instagram publishing. Resolved DB-first by resolveMetaConfig() with env fallback to META_PAGE_ACCESS_TOKEN. Service-role-only.';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS meta_page_id TEXT,
  ADD COLUMN IF NOT EXISTS ig_user_id   TEXT;

COMMENT ON COLUMN public.platform_settings.meta_page_id IS
  'Setnayan Facebook Page id (non-secret; appears in Graph API URLs). Resolved DB-first with env fallback to META_PAGE_ID.';
COMMENT ON COLUMN public.platform_settings.ig_user_id IS
  'Instagram Business account id linked to the Page (non-secret). Resolved DB-first with env fallback to IG_USER_ID.';
