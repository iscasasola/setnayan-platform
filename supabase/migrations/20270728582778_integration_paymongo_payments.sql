-- integration_paymongo_payments
-- ============================================================================
-- PayMongo ONE-TIME payment gateway — Phase 0 (provider seam).
-- ============================================================================
-- Makes the PayMongo Checkout-Sessions credentials settable from
-- /admin/integrations without a Vercel redeploy for the KEYS. The gateway is
-- DORMANT in prod: it is gated on the build-time NEXT_PUBLIC_PAYMONGO_STATUS
-- ='APPROVED' flag (which itself still needs a redeploy to flip — so this
-- migration removes the redeploy only for the credentials), AND on the presence
-- of the keys themselves. Nothing charges without BOTH the keys and the flag.
--
--   • paymongo_secret_key_enc → platform_integration_secrets (deny-by-default,
--     AES-256-GCM). The PayMongo SECRET API key (sk_test_… / sk_live_…). It is
--     the sole credential for the Checkout-Sessions REST API; auth is HTTP Basic
--     with base64("<secretKey>:") (empty password), so there is NO separate
--     "public" key (unlike Maya's pair).
--   • paymongo_webhook_secret_test_enc + paymongo_webhook_secret_live_enc →
--     platform_integration_secrets (AES-256-GCM). The webhook SIGNING secrets
--     (whsk_…), SEPARATE from the API key and separate test-vs-live. The webhook
--     route (/api/webhooks/paymongo) verifies the 'Paymongo-Signature' header
--     (t=…,te=…,li=…) by recomputing HMAC-SHA256 over "<t>.<raw-body>" and
--     timing-safe-comparing against `te` (test secret) or `li` (live secret).
--   • paymongo_api_endpoint → platform_settings (non-secret config; the REST
--     base URL, defaults to https://api.paymongo.com when unset).
--
-- resolvePayMongoConfig() + resolvePayMongoWebhookSecrets()
-- (lib/integration-config.ts) read these DB-first / env-fallback
-- (PAYMONGO_SECRET_KEY / PAYMONGO_WEBHOOK_SECRET_TEST /
--  PAYMONGO_WEBHOOK_SECRET_LIVE / PAYMONGO_API_ENDPOINT).
--
-- Idempotent; no RLS change (platform_integration_secrets is deny-by-default,
-- reached only via the service-role admin client).

ALTER TABLE public.platform_integration_secrets
  ADD COLUMN IF NOT EXISTS paymongo_secret_key_enc TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_webhook_secret_test_enc TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_webhook_secret_live_enc TEXT;

COMMENT ON COLUMN public.platform_integration_secrets.paymongo_secret_key_enc IS
  'PayMongo SECRET API key (sk_test_/sk_live_), AES-256-GCM. Sole credential for the Checkout-Sessions REST API (HTTP Basic base64("<key>:")). Resolved DB-first by resolvePayMongoConfig() with env fallback to PAYMONGO_SECRET_KEY. Service-role-only.';

COMMENT ON COLUMN public.platform_integration_secrets.paymongo_webhook_secret_test_enc IS
  'PayMongo webhook signing secret for TEST mode (whsk_), AES-256-GCM. Used to verify the te= field of the Paymongo-Signature header. Resolved DB-first by resolvePayMongoWebhookSecrets() with env fallback to PAYMONGO_WEBHOOK_SECRET_TEST. Service-role-only.';

COMMENT ON COLUMN public.platform_integration_secrets.paymongo_webhook_secret_live_enc IS
  'PayMongo webhook signing secret for LIVE mode (whsk_), AES-256-GCM. Used to verify the li= field of the Paymongo-Signature header. Resolved DB-first by resolvePayMongoWebhookSecrets() with env fallback to PAYMONGO_WEBHOOK_SECRET_LIVE. Service-role-only.';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS paymongo_api_endpoint TEXT;

COMMENT ON COLUMN public.platform_settings.paymongo_api_endpoint IS
  'PayMongo REST API base URL. Non-secret. Resolved DB-first with env fallback to PAYMONGO_API_ENDPOINT (default https://api.paymongo.com).';
