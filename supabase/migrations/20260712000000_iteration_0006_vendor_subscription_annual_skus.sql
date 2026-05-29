-- =============================================================================
-- 20260712000000_iteration_0006_vendor_subscription_annual_skus.sql
-- Add annual Pro + Enterprise vendor subscription SKUs to vendor_billing_catalog.
--
-- WHY: per CLAUDE.md eleventh 2026-05-28 row "v2.1 amendment · Vendor
-- verification fees RETIRED + Pro Vendor annual ₱19,999/yr + Enterprise
-- Vendor annual ₱54,999/yr added":
--   - Pro Vendor annual ₱19,999/yr · ~17% off vs ₱1,999/mo × 12 = ₱23,988
--     (savings ₱3,989) · charm-priced -1 ending per CLAUDE.md 2026-05-12 row
--   - Enterprise Vendor annual ₱54,999/yr · ~17% off vs ₱5,499/mo × 12 =
--     ₱65,988 (savings ₱10,989) · charm-priced -1 ending
--
-- Vendor picks monthly OR annual at signup · annual gets discount + single-
-- payment-per-year cash-flow simplicity. Standard SaaS retention lever
-- (Notion 16% · Linear 20% · Webflow 20% · Shopify 25% sit adjacent · 17%
-- lands mid-range · neither too cheap nor too stingy).
--
-- Schema shape: vendor_billing_catalog.offering_type CHECK constraint
-- extended with 'subscription_annual'. The vendor_billing_shape CHECK is
-- relaxed to treat annual identically to monthly (max_categories +
-- max_sub_seats meaningful · token_grant_count NULL).
--
-- Per-tier capability shape on annual rows is IDENTICAL to monthly
-- equivalents (1 category + 5 sub-seats for Pro · unlimited for
-- Enterprise) · only price + billing cadence differ.
--
-- Verification SKU retirements (vendor_verification_annual_renewal ₱1,499
-- + vendor_verification_reverification ₱2,499) from the same eleventh
-- 2026-05-28 row are NOT in this migration · those SKUs live in the V1
-- service_catalog · the V2 vendor_billing_catalog never had them seeded.
--
-- Pilot 2026-06-01 unaffected · this is additive only · no V1 surface
-- touched · monthly subs continue working exactly as before.
-- =============================================================================

BEGIN;

-- Extend offering_type CHECK constraint to allow 'subscription_annual'.
-- Drop + re-create the existing constraint (named by Postgres convention
-- as <table>_<column>_check when defined inline in CREATE TABLE).
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_catalog_offering_type_check;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_catalog_offering_type_check
  CHECK (offering_type IN ('subscription_monthly', 'subscription_annual', 'token_pack'));

-- Extend vendor_billing_shape CHECK to treat annual same as monthly.
-- Both subscription cadences carry max_categories + max_sub_seats with
-- token_grant_count NULL · token packs keep their existing shape rule.
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_shape;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_shape CHECK (
    (offering_type IN ('subscription_monthly', 'subscription_annual') AND token_grant_count IS NULL)
    OR
    (offering_type = 'token_pack' AND max_categories IS NULL AND max_sub_seats IS NULL)
  );

-- Seed the 2 V2 annual subscription SKUs · same per-tier capability shape
-- as the monthly equivalents (max_categories + max_sub_seats identical) ·
-- only price + billing cadence differ. display_order interleaved between
-- the monthly equivalent (Pro monthly 10 · Pro annual 15 · Enterprise
-- monthly 20 · Enterprise annual 25) so /pricing rendering keeps both
-- options visually paired per tier.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('pro_vendor_annual',        'Pro Vendor (Annual · save 17%)',        19999.00, 'subscription_annual', NULL, 1,    5,    15),
  ('enterprise_vendor_annual', 'Enterprise Vendor (Annual · save 17%)', 54999.00, 'subscription_annual', NULL, NULL, NULL, 25)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  price_php         = EXCLUDED.price_php,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();

COMMIT;

-- =============================================================================
-- VERIFICATION:
--
-- -- All 9 vendor SKUs (2 monthly + 2 annual + 5 token packs):
-- SELECT sku_code, title, price_php, offering_type, display_order
--   FROM vendor_billing_catalog
--  WHERE is_active = TRUE
--  ORDER BY display_order;
--
-- -- Expected output:
-- --  pro_vendor_monthly        ·  1999.00  ·  subscription_monthly  ·  10
-- --  pro_vendor_annual         · 19999.00  ·  subscription_annual   ·  15
-- --  enterprise_vendor_monthly ·  5499.00  ·  subscription_monthly  ·  20
-- --  enterprise_vendor_annual  · 54999.00  ·  subscription_annual   ·  25
-- --  vendor_token_pack_4       ·  1000.00  ·  token_pack            ·  30
-- --  vendor_token_pack_10      ·  2400.00  ·  token_pack            ·  40
-- --  vendor_token_pack_25      ·  5500.00  ·  token_pack            ·  50
-- --  vendor_token_pack_50      · 10000.00  ·  token_pack            ·  60
-- --  vendor_token_pack_100     · 18000.00  ·  token_pack            ·  70
-- =============================================================================
