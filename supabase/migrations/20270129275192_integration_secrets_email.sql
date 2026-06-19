-- integration_secrets_email
-- ============================================================================
-- Integration Activation Console — PR1 (email slice).
-- ============================================================================
-- Lets the owner set the Resend API key + from-address from /admin/integrations
-- WITHOUT a Vercel redeploy. The key is the ONLY new secret; it is stored as
-- AES-256-GCM ciphertext (lib/encryption.ts, off-DB ENCRYPTION_KEY) in a
-- deny-by-default table — NEVER in platform_settings, which is world-readable.
--
--   • platform_integration_secrets — singleton (id=1) holding the encrypted
--     Resend key. RLS enabled, NO policies → unreadable except via the
--     service-role admin client (resolveResendConfig / the admin save action).
--   • platform_settings.resend_from_address — NON-secret config (the verified
--     "from" address), mirrors the existing setnayan_pay_fee_pct precedent.
--
-- DB-first / env-fallback: lib/integration-config.ts reads this first and falls
-- back to RESEND_API_KEY / RESEND_FROM_ADDRESS env when unset, so today's
-- env-configured installs keep working byte-for-byte.
--
-- ⚠ Security posture (owner-approved 2026-06-16): storing the key in the DB
-- (encrypted) is a deliberate, small trade vs env-only — it adds pg_dump /
-- leaked-service-role vectors, narrowed by AES-256-GCM with an off-DB key. NOT
-- a security upgrade. ENCRYPTION_KEY is now a single point of failure for this
-- key AND the existing oauth_grants tokens — do not rotate casually.
--
-- Idempotent.

-- ----------------------------------------------------------------------------
-- 1) platform_integration_secrets — encrypted secrets singleton
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_integration_secrets (
  id                   INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  resend_api_key_enc   TEXT,
  last_verified_at     TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.platform_integration_secrets IS
  'Integration Activation Console — singleton (id=1) of AES-256-GCM-encrypted integration secrets (Resend key in PR1). RLS on, NO policies → service-role-only. NEVER store plaintext or put secrets in the world-readable platform_settings.';

-- Seed the singleton so the admin save can UPDATE ... WHERE id=1.
INSERT INTO public.platform_integration_secrets (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- RLS enabled, deliberately NO policies → deny-by-default for anon/authenticated.
-- Only the service-role key (createAdminClient) bypasses RLS to read/write.
ALTER TABLE public.platform_integration_secrets ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2) platform_settings.resend_from_address — non-secret config
-- ----------------------------------------------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS resend_from_address TEXT;

COMMENT ON COLUMN public.platform_settings.resend_from_address IS
  'Verified Resend "from" address (e.g. Setnayan <noreply@setnayan.com>). Non-secret; world-readable like the rest of platform_settings. The API KEY lives encrypted in platform_integration_secrets, never here.';
