-- integration_openai_secret
-- ============================================================================
-- Integration Activation Console — PR2 (generalize: first registry-driven secret).
-- ============================================================================
-- Adds the OpenAI moderation API key to the deny-by-default secrets singleton so
-- the owner can set it from /admin/integrations WITHOUT a Vercel redeploy, via
-- the new data-driven SECRET_INTEGRATIONS registry (lib/integrations/registry.ts).
--
-- Same posture as the PR1 Resend key: AES-256-GCM ciphertext (lib/encryption.ts,
-- off-DB ENCRYPTION_KEY) in platform_integration_secrets (RLS on, NO policies →
-- service-role-only). NEVER plaintext, NEVER on the world-readable platform_settings.
--
-- DB-first / env-fallback: lib/integration-config.ts resolveOpenAiKey() reads this
-- first and falls back to OPENAI_API_KEY env when unset, so today's env-configured
-- behavior is byte-identical. OpenAI moderation FAILS OPEN (no key -> text is never
-- flagged), so an empty value never blocks editorial publishing.
--
-- Idempotent.

ALTER TABLE public.platform_integration_secrets
  ADD COLUMN IF NOT EXISTS openai_api_key_enc TEXT;

COMMENT ON COLUMN public.platform_integration_secrets.openai_api_key_enc IS
  'OpenAI API key (editorial content moderation), AES-256-GCM ciphertext. Resolved DB-first by lib/integration-config.ts resolveOpenAiKey() with env fallback to OPENAI_API_KEY. Service-role-only (deny-by-default table). Never store plaintext.';
