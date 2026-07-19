-- integration_maya_payments
-- ============================================================================
-- Integration Activation Console — PR4c (Maya / PayMaya automated checkout).
-- ============================================================================
-- Makes the Maya checkout credentials (Branch B) settable from /admin/integrations
-- without a Vercel redeploy for the KEYS. Branch B is DORMANT in prod (gated on
-- the build-time NEXT_PUBLIC_MAYA_STATUS='APPROVED' flag, which itself still needs
-- a redeploy to flip — so this PR removes the redeploy only for the credentials).
--
--   • maya_public_api_key_enc + maya_secret_api_key_enc → platform_integration_secrets
--     (deny-by-default, AES-256-GCM). BOTH are secrets — they form the HTTP Basic
--     auth pair (`{public}:{secret}`); the "public" key is still a server-only
--     merchant credential, never client-exposed.
--   • maya_checkout_endpoint → platform_settings (non-secret config; selects
--     sandbox vs prod base URL).
--
-- resolveMayaConfig() (lib/integration-config.ts) reads these DB-first / env-
-- fallback (MAYA_PUBLIC_API_KEY / MAYA_SECRET_API_KEY / MAYA_CHECKOUT_ENDPOINT).
-- Idempotent; no RLS change.

ALTER TABLE public.platform_integration_secrets
  ADD COLUMN IF NOT EXISTS maya_public_api_key_enc TEXT,
  ADD COLUMN IF NOT EXISTS maya_secret_api_key_enc TEXT;

COMMENT ON COLUMN public.platform_integration_secrets.maya_secret_api_key_enc IS
  'Maya/PayMaya checkout SECRET key (Basic-auth pair with the public key), AES-256-GCM. Resolved DB-first by resolveMayaConfig() with env fallback to MAYA_SECRET_API_KEY. Service-role-only.';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS maya_checkout_endpoint TEXT;

COMMENT ON COLUMN public.platform_settings.maya_checkout_endpoint IS
  'Maya checkout base URL (sandbox vs prod). Non-secret. Resolved DB-first with env fallback to MAYA_CHECKOUT_ENDPOINT (default sandbox).';
