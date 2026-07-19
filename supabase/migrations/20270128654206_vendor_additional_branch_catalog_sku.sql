-- vendor_additional_branch_catalog_sku
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- =============================================================================
-- WHY: Move the Additional-Branch fee out of a TypeScript literal and into the
-- admin-managed catalog (owner rule 2026-06-19 · "prices are admin-managed").
-- The branch fee was a hardcoded ₱999 in lib/vendor-branches.ts; this migration
-- seeds a `vendor_additional_branch` row into vendor_billing_catalog so the
-- branch-order creation path reads the price from the DB at runtime. The code
-- falls back to the ₱999 literal if this row is absent, so it stays
-- backward-compatible whether or not this migration has been applied yet.
--
-- vendor_billing_catalog stores price in PHP (NUMERIC(10,2)), NOT centavos —
-- mirroring every other vendor SKU read (lib/v2-catalog.ts: Number(row.price_php)).
-- The app converts to centavos at the payment boundary as needed.
--
-- A branch is a recurring 28-day add-on, neither a tier subscription nor a
-- token pack, so we extend the `offering_type` CHECK with a new 'branch' value
-- (same drop+recreate pattern as 20260712000000 adding 'subscription_annual')
-- and relax `vendor_billing_shape` so a 'branch' row carries NULL
-- token_grant_count (like a subscription) without max_categories/max_sub_seats
-- meaning anything. Additive only · no existing SKU touched · idempotent.
-- =============================================================================

BEGIN;

-- Extend offering_type CHECK to allow 'branch'. Drop + re-create the existing
-- constraint (Postgres named it vendor_billing_catalog_offering_type_check;
-- 20260712000000 already re-created it under that name when adding annual).
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_catalog_offering_type_check;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_catalog_offering_type_check
  CHECK (offering_type IN ('subscription_monthly', 'subscription_annual', 'token_pack', 'branch'));

-- Extend vendor_billing_shape so a 'branch' row behaves like a subscription
-- shape-wise: token_grant_count NULL. max_categories / max_sub_seats are not
-- meaningful for a branch and are left NULL by the seed below.
ALTER TABLE public.vendor_billing_catalog
  DROP CONSTRAINT IF EXISTS vendor_billing_shape;

ALTER TABLE public.vendor_billing_catalog
  ADD CONSTRAINT vendor_billing_shape CHECK (
    (offering_type IN ('subscription_monthly', 'subscription_annual', 'branch') AND token_grant_count IS NULL)
    OR
    (offering_type = 'token_pack' AND max_categories IS NULL AND max_sub_seats IS NULL)
  );

-- Seed the Additional-Branch fee · ₱999 / 28-day (owner-locked 2026-06-05 charm
-- price · now admin-editable here). display_order 80 sits after the token packs.
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_additional_branch', 'Additional Branch (28-day)', 999.00, 'branch', NULL, NULL, NULL, 80)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();
  -- NOTE: price_php intentionally NOT overwritten on conflict — once this SKU
  -- exists, its price is admin-managed (/admin/pricing). Re-applying the
  -- migration must not stomp an admin's price edit back to ₱999.

COMMIT;

-- =============================================================================
-- VERIFICATION:
--
-- SELECT sku_code, title, price_php, offering_type, display_order
--   FROM vendor_billing_catalog
--  WHERE sku_code = 'vendor_additional_branch';
-- -- Expected: vendor_additional_branch · Additional Branch (28-day) · 999.00 · branch · 80
-- =============================================================================
