-- vendor_3d_booth_sku_and_trial
-- ============================================================================
-- 3D Booth — a sellable, per-vendor-entitled add-on that turns ON a BRANDED
-- virtual booth for the vendor inside their couples' PUBLISHED 3D Plans (the
-- guest venue walk + the couple's own 3D lab). Owner-locked 2026-07-22:
--
--   • FLAT ₱1,500 / 28-day add-on, available on the PRO / ENTERPRISE / CUSTOM
--     tiers (verified only) — NOT Solo/free. (The AI add-on is Solo+; this one
--     is Pro+ because booth branding is already a Pro/Enterprise perk —
--     lib/seating-3d.ts boothCanBrand.)
--   • FREE for the vendor's FIRST 28-day cycle (one-time per account, on
--     activation + verification); ₱1,500 / cycle after that.
--   • Without the add-on a Pro/Enterprise vendor's booth stays GENERIC (the
--     existing unbranded booth) — the ₱1,500 only buys the branded booth.
--
-- This migration mirrors the Vendor AI add-on (20270905761946) exactly:
--   1. Seed the admin-managed `vendor_3d_booth` SKU (₱1,500) into
--      vendor_billing_catalog. The `vendor_addon_recurring` offering_type
--      ALREADY EXISTS in the offering_type + vendor_billing_shape CHECKs (added
--      by 20270905761946) — no CHECK change needed here; we only INSERT a row.
--   2. Add the per-account one-time trial marker + the entitlement window to
--      vendor_profiles.
--
-- The ₱0 FIRST cycle is NOT a catalog row (vendor_billing_catalog has a
-- price_php > 0 CHECK) — it is expressed by a price RESOLVER that returns 0
-- when the trial is unused (apps/web/lib/vendor-3d-booth-pricing.ts). The
-- catalog carries only the standing ₱1,500 renewal price.
--
-- RLS: no new table. vendor_billing_catalog is public-select (admin-managed
-- writes); vendor_profiles already has RLS. So no new policy is needed.
--
-- KEEP IDEMPOTENT (may be re-applied): IF NOT EXISTS everywhere, ON CONFLICT
-- DO UPDATE that never stomps an admin's price edit.
-- ============================================================================

BEGIN;

-- ── 1 · seed the 3D Booth add-on SKU · ₱1,500 / 28-day (owner 2026-07-22) ─────
-- display_order 85 sits after the Additional-Branch (80) / Extra-Seat (81) /
-- Vendor AI (82) / Photo Challenge (83) add-ons, before the Custom rate-card
-- block (90+). price_php intentionally NOT overwritten on conflict — once the
-- row exists its price is admin-managed at /admin/pricing. token_grant_count /
-- max_* stay NULL (add-on shape, per vendor_billing_shape).
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_3d_booth', '3D Booth — Branded Virtual Booth (28-day)', 1500.00, 'vendor_addon_recurring', NULL, NULL, NULL, 85)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();
  -- price_php intentionally NOT overwritten on conflict (admin-managed).

-- ── 2 · per-vendor trial marker + entitlement window ─────────────────────────
-- booth_addon_trial_used_at — the ONE-TIME-per-account free-cycle marker. NULL =
-- the free first cycle is still available (price resolves to ₱0); once stamped,
-- every future cycle is the ₱1,500 renewal. The claim is made atomic in the
-- app layer via `UPDATE … WHERE booth_addon_trial_used_at IS NULL`.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS booth_addon_trial_used_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_profiles.booth_addon_trial_used_at IS
  '3D Booth add-on (owner 2026-07-22): timestamp the ONE-TIME free first 28-day cycle was claimed. NULL = free cycle still available (resolveVendor3dBoothPricePhp returns 0); once set, every cycle is the ₱1,500 renewal. Claimed atomically (UPDATE … WHERE IS NULL).';

-- booth_addon_expires_at — the ACTIVE entitlement window end. The vendor's booth
-- brands inside couples' published 3D Plans only while now() < booth_addon_expires_at
-- (checked at the boothIsBranded render boundary). Stamped now()+28d on activation
-- (free cycle direct-activate) or on paid-order approval (sku-activation hook,
-- stacking from the later of now / current expiry). NULL = never activated.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS booth_addon_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_profiles.booth_addon_expires_at IS
  '3D Booth add-on (owner 2026-07-22): end of the active 28-day entitlement window. The vendor''s BRANDED booth renders in couples'' published 3D Plans only while now() < this (lib/seating-3d.ts boothIsBranded). Stamped on activation (free cycle) / paid-order approval; NULL = never activated. Lapse is automatic at read time — no cron.';

COMMIT;

-- ============================================================================
-- VERIFICATION:
--
-- SELECT sku_code, price_php, offering_type, display_order
--   FROM vendor_billing_catalog WHERE sku_code = 'vendor_3d_booth';
-- -- Expected: vendor_3d_booth · 1500.00 · vendor_addon_recurring · 85
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'vendor_profiles'
--    AND column_name IN ('booth_addon_trial_used_at', 'booth_addon_expires_at');
-- -- Expected: both rows present.
-- ============================================================================
