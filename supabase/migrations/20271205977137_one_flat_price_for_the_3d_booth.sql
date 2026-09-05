-- one_flat_price_for_the_3d_booth
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ── OWNER PRICE DECISION 2026-09-05 ──────────────────────────────────────────
--
--   "yes flat prices for all of them."
--
-- 1 · `vendor_3d_booth` (the 3D Booth — branded presence in couples' published
--     3D Plans, 28-day cycle) → ₱3,000 FLAT, every paid tier the same.
--
--     This product carried THREE prices at once, and which one a vendor was
--     charged was decided by a flag:
--       · docblock owner-lock, lib/vendor-3d-booth-pricing.ts   ₱1,500 (2026-07-22)
--       · this catalogue row                                   ₱2,500 (2026-08-27)
--       · lib/vendor-addon-tier-pricing.ts `ads_3d_plan` band   ₱2,000 entry / ₱1,500 growth
--     NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING="true" in production (pulled
--     2026-09-05), so the matrix won and the owner's catalogue ₱2,500 was never
--     what anybody paid. The fallback constant and the matrix bands move to
--     ₱3,000 in the SAME commit as this row (the fallback-prices-match-the-catalog
--     db test holds them together), so the flag no longer selects a price.
--
-- 2 · `SEATING_3D` (the couple's 3D Plan, ₱1,500 one-time) → is_active = FALSE.
--     The 3D Plan is FREE for couples (owner 2026-09-05; `SEATING_3D` is in
--     FREE_FOR_ALL_SKUS, PR #5185). Measured before deciding: the charge gated
--     nothing at any layer and had zero orders in its history. KWENTO precedent
--     (20271156242842): deactivate, keep the row, price untouched — "not on
--     sale" is what is_active means (see the column comment).
--
-- Both statements are scoped with IS DISTINCT FROM so a re-apply, or a live
-- database already at these values, updates ZERO rows and leaves updated_at alone.

BEGIN;

UPDATE public.vendor_billing_catalog
   SET price_php  = 3000.00,
       updated_at = NOW()
 WHERE sku_code = 'vendor_3d_booth'
   AND price_php IS DISTINCT FROM 3000.00;

UPDATE public.platform_retail_catalog_v2
   SET is_active  = FALSE,
       updated_at = NOW()
 WHERE service_code = 'SEATING_3D'
   AND is_active IS DISTINCT FROM FALSE;

COMMIT;
