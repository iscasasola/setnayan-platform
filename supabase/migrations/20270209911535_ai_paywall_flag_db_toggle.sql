-- ai_paywall_flag_db_toggle
-- ============================================================================
-- Integration Activation Console — PR1 (AI-paywall slice).
-- ============================================================================
-- Lets the owner flip the Setnayan-AI paywall ON/OFF from /admin/integrations
-- WITHOUT a Vercel env change + redeploy, mirroring the email slice's
-- resend_from_address precedent and the setnayan_pay_fee_pct DB-config pattern.
--
-- This flag is NON-secret config (a feature toggle, not a credential), so it
-- lives on the world-readable platform_settings singleton — NOT in the
-- deny-by-default platform_integration_secrets table. (Knowing whether AI is
-- monetized is not sensitive.)
--
-- TRI-STATE column (the deliberate change vs the 2026-06-16 design's "OR-wins",
-- which is not a clean toggle — it can never turn the paywall OFF from the
-- console once SETNAYAN_AI_PAYWALL_ENABLED is set to true). The ₱3,999 flip is
-- currently PARKED (env OFF → AI free) for the holistic pricing pass
-- (DECISION_LOG 2026-06-22); this column lets the owner flip it with no redeploy):
--   • NULL  → defer to the SETNAYAN_AI_PAYWALL_ENABLED env var (today's source
--             of truth). DEFAULT — byte-identical to current prod behavior.
--   • TRUE  → paywall ON  (DB overrides env).
--   • FALSE → paywall OFF (DB overrides env).
--
-- lib/integration-config.ts resolveSetnayanAiPaywallEnabled() reads this
-- DB-first and falls back to env when NULL/unreadable, so existing installs
-- keep working unchanged until the owner touches the toggle.
--
-- Idempotent.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS setnayan_ai_paywall_enabled BOOLEAN;

COMMENT ON COLUMN public.platform_settings.setnayan_ai_paywall_enabled IS
  'Setnayan-AI paywall toggle (Integration Activation Console). Tri-state: NULL = defer to the SETNAYAN_AI_PAYWALL_ENABLED env var; TRUE = paywall on; FALSE = paywall off. Non-secret feature flag; world-readable like the rest of platform_settings.';
