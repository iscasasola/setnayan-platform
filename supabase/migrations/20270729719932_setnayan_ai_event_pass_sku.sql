-- ============================================================================
-- 20270729719932_setnayan_ai_event_pass_sku.sql
-- Setnayan AI SKU restructure — add the ₱4,999 one-time EVENT PASS above the
-- existing ₱499 low-friction ENTRY (owner PRICING FOLLOW-THROUGH 2026-07-12).
--
-- WHAT CHANGES
-- -----------
-- The live SETNAYAN_AI is a ₱499 one-time PERMANENT unlock (billing_period
-- one_time; per-event-pricing flag OFF since migration 20270714262264, so no
-- lapsing window is stamped — eventOwnsSetnayanAi returns a permanent grant).
-- This migration ADDS a second, premium door WITHOUT disturbing the cheap one:
--
--   • NEW  SETNAYAN_AI_EVENT_PASS — ₱4,999 · billing_period 'one_time' ·
--          is_active TRUE. The full-price event pass. Its activation stamps
--          events.setnayan_ai_active permanently (same boolean gate as the ₱499
--          SKU; see the paired activation hook in apps/web/lib/sku-activation.ts).
--   • KEEP SETNAYAN_AI — ₱499 · one_time · unchanged. This is the deliberate
--          low-friction ENTRY (the cheap door); it is NOT repriced away.
--
-- WHAT DELIBERATELY DOES NOT CHANGE
-- --------------------------------
--   • SETNAYAN_AI stays ₱499 one-time, is_active TRUE (untouched here).
--   • SETNAYAN_AI_SUB (the dormant ₱499/mo per-USER subscription) stays
--     is_active=FALSE — recurring billing is deferred; NOT activated here.
--   • No feature flag is flipped: setnayan_ai_per_event_pricing_enabled,
--     setnayan_ai_per_user_enabled and the paywall flag are all left as-is.
--   • No charge logic, no entitlement gate is changed — the pass reuses the
--     existing setnayan_ai_active boolean path.
--
-- CHECK CONSTRAINTS (all satisfied by the values below)
-- -----------------------------------------------------
--   • platform_retail_catalog_v2_billing_period_check → 'one_time' is allowed
--     (one_time · per_28d · per_day · per_year; migration 20270712300100).
--   • platform_retail_catalog_v2_pax_config_complete → is_pax_priced=FALSE
--     branch passes with all pax_* NULL.
--   • NOT-NULL columns (service_code, title, retail_price_php,
--     saas_overhead_cost_php, is_token_able, is_active, billing_period,
--     is_pax_priced) are all supplied non-null.
--
-- Idempotent: ON CONFLICT re-syncs only the mutable display fields and leaves
-- is_active alone (mirrors the SETNAYAN_AI_RENEW seed pattern) so a later admin
-- deactivation from /admin/pricing is never reset by a re-apply.
-- ============================================================================

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, billing_period, is_active,
   description, saas_overhead_cost_php, is_token_able, is_pax_priced)
VALUES
  ('SETNAYAN_AI_EVENT_PASS', 'Setnayan AI — Event Pass', 4999, 'one_time', true,
   'Setnayan AI — the full event pass. One payment unlocks your always-on '
   'planning assistant for the whole wedding: finds and ranks vendors, watches '
   'your budget, deadlines and contracts, and flags risks. Permanent access — '
   'no renewals.',
   0, false, false)
ON CONFLICT (service_code) DO UPDATE
  SET retail_price_php = excluded.retail_price_php,
      title           = excluded.title,
      description      = excluded.description,
      billing_period  = excluded.billing_period,
      updated_at      = now();
