-- the_price_formula_is_an_admin_setting
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- THE PRICE FORMULA IS AN ADMIN SETTING (owner 2026-11-21, Setnayan-specs
-- DECISION_LOG "NEW BASE PRICING FORMULA"):
--
--   price = base cost × 10 (OPEX) × 4.5 ÷ 0.73 (Maya fees + tax), rounded UP
--
-- where base cost is the EXISTING platform_retail_catalog_v2.saas_overhead_cost_php
-- (no second cost column). The four numbers become platform_settings columns,
-- edited on /admin/pricing beside the catalog.
--
-- 🔒 THESE COLUMNS PRICE NOTHING. The formula only SUGGESTS a price beside the
-- current one (apps/web/lib/pricing-formula.ts). A price changes only when an
-- admin presses "Use formula price" / "Apply to all rows with a cost", which go
-- through the same audited per-row save (and the § 9.1 second-admin approval)
-- as a typed edit. No trigger, no function and no default here reads them, and
-- this migration writes no price.
--
-- platform_settings already has RLS + its read-all policy and a TABLE-level
-- `GRANT SELECT … TO authenticated`, which covers a new column. The only writer
-- is /admin/pricing (`savePricingFormula`, service role, audited as
-- `pricing_formula_edit`). No new policy, no new grant — the same access as the
-- other pricing settings on this row (booking_fee_*, onboarding_discount_pct).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS pricing_opex_factor NUMERIC(8, 3) NOT NULL DEFAULT 10;
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS pricing_margin_factor NUMERIC(8, 3) NOT NULL DEFAULT 4.5;
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS pricing_fee_tax_cover NUMERIC(6, 4) NOT NULL DEFAULT 0.73;
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS pricing_round_step_php SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_pricing_opex_factor_positive;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_pricing_opex_factor_positive
  CHECK (pricing_opex_factor > 0);

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_pricing_margin_factor_positive;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_pricing_margin_factor_positive
  CHECK (pricing_margin_factor > 0);

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_pricing_fee_tax_cover_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_pricing_fee_tax_cover_range
  CHECK (pricing_fee_tax_cover > 0 AND pricing_fee_tax_cover <= 1);

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_pricing_round_step_php_allowed;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_pricing_round_step_php_allowed
  CHECK (pricing_round_step_php IN (1, 5, 10));

COMMENT ON COLUMN public.platform_settings.pricing_opex_factor IS
  'Price formula (owner 2026-11-21): the OPEX multiplier on a SKU''s base cost (saas_overhead_cost_php). Default 10. '
  'SUGGESTS a price on /admin/pricing only — nothing reads it to charge anyone. Written only by savePricingFormula '
  '(audited as pricing_formula_edit). Mirror: apps/web/lib/pricing-formula.ts.';
COMMENT ON COLUMN public.platform_settings.pricing_margin_factor IS
  'Price formula (owner 2026-11-21): the margin multiplier. Default 4.5. Suggests only; see pricing_opex_factor.';
COMMENT ON COLUMN public.platform_settings.pricing_fee_tax_cover IS
  'Price formula (owner 2026-11-21): the share of the price left after Maya fees + tax; the price is divided by it. '
  'Default 0.73. CHECK > 0 and <= 1. Suggests only; see pricing_opex_factor.';
COMMENT ON COLUMN public.platform_settings.pricing_round_step_php IS
  'Price formula (owner 2026-11-21): the suggested price is rounded UP to this many pesos — 1, 5 or 10. Default 1. '
  'Suggests only; see pricing_opex_factor.';

COMMIT;
