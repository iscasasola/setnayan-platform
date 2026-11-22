-- the_price_formula_is_an_admin_setting
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- THE PRICE FORMULA IS AN ADMIN SETTING (owner 2026-11-21, Setnayan-specs
-- DECISION_LOG "NEW BASE PRICING FORMULA"):
--
--   price = base cost × 10 (OPEX) × 4.5 ÷ 0.73 (Maya fees + tax), rounded UP
--
-- where base cost is the EXISTING platform_retail_catalog_v2.saas_overhead_cost_php
-- (no second cost column). The four numbers live in ONE row of a table of their
-- own, public.pricing_formula_settings, edited on /admin/pricing beside the
-- catalog.
--
-- 🔒 THESE COLUMNS PRICE NOTHING. The formula only SUGGESTS a price beside the
-- current one (apps/web/lib/pricing-formula.ts). A price changes only when an
-- admin presses "Use formula price" / "Apply to all rows with a cost", which go
-- through the same audited per-row save (and the § 9.1 second-admin approval)
-- as a typed edit. No trigger, no function and no default here reads them, and
-- this migration writes no price.
--
-- 🔒 ADMIN-ONLY, AND WHY THEY ARE NOT ON platform_settings (controller ruling
-- 2026-11-22). The four numbers are our markup. platform_settings carries a
-- TABLE-level `GRANT SELECT … TO authenticated`, which covers every column on it
-- — so as columns there, any signed-in couple or supplier could have read the
-- markup straight from the API. They therefore get their own table, which no
-- browser can reach: RLS on with NO policy, every grant to PUBLIC / anon /
-- authenticated revoked, service_role only. This is the repo's "server-only"
-- shape, copied from the one-row public.booking_fee_platform_counter
-- (20271356196197) and public.maya_checkouts (20271356998019).
--
-- The only reader and the only writer is the /admin/pricing server code, through
-- the service-role client and only after the admin check: the page read in
-- pricing-surface.tsx, and `saveSignupDiscount` with pricing_formula_op = save |
-- apply (audited as `pricing_formula_edit`). The GRANT below names what that code
-- uses — SELECT + UPDATE: the one row is seeded here, and the app never inserts
-- or deletes it.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.pricing_formula_settings (
  id                     SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pricing_opex_factor    NUMERIC(8, 3) NOT NULL DEFAULT 10
    CONSTRAINT pricing_formula_settings_pricing_opex_factor_positive
    CHECK (pricing_opex_factor > 0),
  pricing_margin_factor  NUMERIC(8, 3) NOT NULL DEFAULT 4.5
    CONSTRAINT pricing_formula_settings_pricing_margin_factor_positive
    CHECK (pricing_margin_factor > 0),
  pricing_fee_tax_cover  NUMERIC(6, 4) NOT NULL DEFAULT 0.73
    CONSTRAINT pricing_formula_settings_pricing_fee_tax_cover_range
    CHECK (pricing_fee_tax_cover > 0 AND pricing_fee_tax_cover <= 1),
  pricing_round_step_php SMALLINT NOT NULL DEFAULT 1
    CONSTRAINT pricing_formula_settings_pricing_round_step_php_allowed
    CHECK (pricing_round_step_php IN (1, 5, 10)),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS AT CREATE TABLE — and no policy: service_role only.
ALTER TABLE public.pricing_formula_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pricing_formula_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.pricing_formula_settings TO service_role;

-- The one row, at the owner's 2026-11-21 numbers (the column DEFAULTs).
INSERT INTO public.pricing_formula_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.pricing_formula_settings IS
  'ONE row: the four numbers of the cost-based price formula (owner 2026-11-21) — price = base cost '
  '(saas_overhead_cost_php) × OPEX × margin ÷ fee-and-tax cover, rounded UP to a step. They only SUGGEST a price on '
  '/admin/pricing; nothing reads them to charge anyone. ADMIN-ONLY (controller ruling 2026-11-22): service-role only '
  '(RLS on, no policy, no grant to anon or authenticated) — they are our markup, so they are NOT on platform_settings, '
  'which every signed-in account can read. Read and written only by the /admin/pricing server code after the admin '
  'check. Migration 20271356452488.';
COMMENT ON COLUMN public.pricing_formula_settings.pricing_opex_factor IS
  'Price formula (owner 2026-11-21): the OPEX multiplier on a SKU''s base cost (saas_overhead_cost_php). Default 10. '
  'SUGGESTS a price on /admin/pricing only — nothing reads it to charge anyone. Written only by saveSignupDiscount (pricing_formula_op=save) '
  '(audited as pricing_formula_edit). Mirror: apps/web/lib/pricing-formula.ts.';
COMMENT ON COLUMN public.pricing_formula_settings.pricing_margin_factor IS
  'Price formula (owner 2026-11-21): the margin multiplier. Default 4.5. Suggests only; see pricing_opex_factor.';
COMMENT ON COLUMN public.pricing_formula_settings.pricing_fee_tax_cover IS
  'Price formula (owner 2026-11-21): the share of the price left after Maya fees + tax; the price is divided by it. '
  'Default 0.73. CHECK > 0 and <= 1. Suggests only; see pricing_opex_factor.';
COMMENT ON COLUMN public.pricing_formula_settings.pricing_round_step_php IS
  'Price formula (owner 2026-11-21): the suggested price is rounded UP to this many pesos — 1, 5 or 10. Default 1. '
  'Suggests only; see pricing_opex_factor.';

COMMIT;
