-- setnayan ai per-type tier prices
-- ============================================================================
-- Per-EVENT-TYPE Setnayan AI pricing (owner-locked 2026-07-22 "go"). Setnayan AI
-- is priced by AI LOAD — "how much data is needed to help them" — on a discrete
-- 5-point ladder, NOT a range:
--
--   ₱1,499  Wedding                                            (Tier A)
--   ₱999    Debut · Corporate                                  (Tier B)
--   ₱499    Christening·Birthday·Celebration·Travel·Tournament (Tier C)
--           (+ Anniversary·Graduation·Reunion — assigned to C)
--   ₱99     Gender reveal · Dinner Date                        (Tier D)
--   ₱0      Simple Event / any digital-services-only           (no AI to price)
--
-- Tier A is the EXISTING `SETNAYAN_AI` row (₱1,499, is_active=TRUE — the single
-- sellable Setnayan-AI door). This migration adds the three lower tiers as
-- PRICE-SOURCE rows only. They are NOT independently sellable: an order's
-- service_key stays `SETNAYAN_AI` (that's the entitlement that stamps
-- events.setnayan_ai_active); only the CHARGE is resolved by the event's type
-- via lib/setnayan-ai-type-pricing.ts + the checkout re-resolve.
--
-- WHY is_active = FALSE on the tier rows:
--   • They must never surface as their own buy/pricing card (formatV2Sku /
--     getCustomerSkuPriceLabel filter is_active). The per-type resolver reads
--     `retail_price_php` DIRECTLY (same as SETNAYAN_AI_RENEW / the intro/renew
--     resolver), so is_active does not gate the price.
--   • Prices stay catalog-authoritative + admin-editable (owner rule: never
--     hardcode a live price); the code carries only last-resort fallbacks.
--
-- INERT until the owner flips the per-event-pricing flag (default OFF since
-- 20270714262264) alongside the paywall — the checkout resolver is gated on it.
-- ON CONFLICT never touches is_active, so a re-apply can't undo a later owner
-- activation. Idempotent (re-runnable).
-- ============================================================================

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php,
   is_token_able, description, is_pax_priced, is_active, billing_period)
VALUES
  ('SETNAYAN_AI_B', 'Setnayan AI (Tier B · major milestone)', 999, 0,
   false,
   'Setnayan AI per-event-type price for major-milestone events (Debut · Corporate). Price source only — the sellable door is SETNAYAN_AI; the charge is resolved by the event''s type.',
   false, false, 'one_time'),
  ('SETNAYAN_AI_C', 'Setnayan AI (Tier C · standard event)', 499, 0,
   false,
   'Setnayan AI per-event-type price for standard events (Christening · Birthday · Celebration · Travel · Tournament · Anniversary · Graduation · Reunion). Price source only — the sellable door is SETNAYAN_AI.',
   false, false, 'one_time'),
  ('SETNAYAN_AI_D', 'Setnayan AI (Tier D · light)', 99, 0,
   false,
   'Setnayan AI per-event-type price for light events (Gender reveal · Dinner Date). Price source only — the sellable door is SETNAYAN_AI.',
   false, false, 'one_time')
ON CONFLICT (service_code) DO UPDATE
  SET retail_price_php = excluded.retail_price_php,
      title           = excluded.title,
      description      = excluded.description,
      billing_period  = excluded.billing_period,
      updated_at      = now();
