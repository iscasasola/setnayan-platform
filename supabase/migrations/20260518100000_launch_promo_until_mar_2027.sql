-- ============================================================================
-- 20260518100000_launch_promo_until_mar_2027.sql
--
-- Launch promo (locked 2026-05-18 by owner). 16 zero-marginal-cost SKUs are
-- FREE for couples + vendors until 2027-03-31 23:59:59 +08:00 (PH time).
-- After that, prices snap back to the canonical price_centavos.
--
-- Excluded from the promo (stay paid throughout launch):
--   • Setnayan Concierge ₱4,999 — has real coordinator labor cost
--   • AI Highlights (60s / 3min) — Claude vision API cost
--   • Custom Monogram + Hero Upgrade — design/SVG-trace work
--   • Contract Intelligence (couple + vendor) — Claude API cost
--   • Vendor Verification (annual renewal + redemption) — admin labor cost
--   • Boosted Ads (5/10/20km) + Sponsored Boost (Quarterly + Annual) —
--     competitive marketing slots; making them free defeats their purpose
--
-- Schema:
--   service_catalog.launch_promo_until TIMESTAMPTZ
--     NULL  → SKU is paid as usual
--     NOT NULL → SKU is FREE until that timestamp; reverts to
--                price_centavos once NOW() >= launch_promo_until
--
-- App-side helpers live in apps/web/lib/sku-catalog.ts (isFreeNow,
-- getEffectivePriceCentavos). Cart/admin tooling for auto-confirm at ₱0
-- is a V1.1 follow-up — V1 keeps the existing manual reconciliation flow
-- and the admin marks promo orders as paid at ₱0.
--
-- Idempotent. No drops.
-- ============================================================================

BEGIN;

ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS launch_promo_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS service_catalog_launch_promo_until_idx
  ON public.service_catalog(launch_promo_until)
  WHERE launch_promo_until IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Set the promo end date on the 16 included SKUs.
-- 2027-03-31 23:59:59 +08:00 = end of March 31 2027 in Manila local time.
-- Stored as TIMESTAMPTZ so comparisons against NOW() are deterministic
-- across server timezones.
-- ----------------------------------------------------------------------------

UPDATE public.service_catalog
   SET launch_promo_until = '2027-03-31 23:59:59+08'::TIMESTAMPTZ,
       updated_at = NOW()
 WHERE sku_code IN (
   -- Couple-side (9 SKUs · pure templating / BYO-platform infra)
   'pro_widget_schedule',
   'save_the_date_video',
   'panood_daily_broadcast',
   'panood_camera_sync',
   'panood_annual_streaming',
   'panood_annual_streaming_plus',
   'patiktok_setnayan_tiktok',
   'patiktok_personal_tiktok',
   'patiktok_video_overage',

   -- Vendor-side (7 SKUs · zero marginal cost productivity + tools)
   'vendor_pro_weekly',
   'all_tools_unlock_annual',
   'tool_mood_board_weekly',
   'tool_seat_arrangement_weekly',
   'tool_palette_weekly',
   'tool_qr_reader_weekly',
   'tool_advanced_pricing_weekly'
 );

COMMIT;
