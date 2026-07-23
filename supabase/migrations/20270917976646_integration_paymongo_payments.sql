-- PayMongo booking-fee rail — admin-uploadable credentials (mirrors the Maya
-- pattern, 20270213845820). Two encrypted secrets on the deny-by-default
-- singleton platform_integration_secrets so an admin can paste the keys at
-- /admin/integrations and they apply LIVE (DB-first resolver, no redeploy).
--
-- No RLS change: platform_integration_secrets has RLS enabled with NO policies
-- (deny-by-default) — only the service-role admin client reads/writes it. The
-- admin-only gate is enforced in the save action (requireAdmin), not a policy.
-- AES-256-GCM at rest via lib/encryption.ts (ENCRYPTION_KEY). No non-secret
-- config column needed — the PayMongo API base is a hardcoded const.

ALTER TABLE public.platform_integration_secrets
  ADD COLUMN IF NOT EXISTS paymongo_secret_key_enc     TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_webhook_secret_enc TEXT;

COMMENT ON COLUMN public.platform_integration_secrets.paymongo_secret_key_enc IS
  'PayMongo SECRET API key (sk_live_…/sk_test_…), AES-256-GCM. Resolved DB-first by '
  'resolvePaymongoConfig() with env fallback to PAYMONGO_SECRET_KEY. Service-role-only.';
COMMENT ON COLUMN public.platform_integration_secrets.paymongo_webhook_secret_enc IS
  'PayMongo WEBHOOK signing secret (whsk_…, shown once at webhook registration), '
  'AES-256-GCM. Resolved DB-first by resolvePaymongoConfig() with env fallback to '
  'PAYMONGO_WEBHOOK_SECRET. NOT the sk_ key — it verifies webhook signatures.';
