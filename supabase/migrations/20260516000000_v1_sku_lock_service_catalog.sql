-- ============================================================================
-- 20260516000000_v1_sku_lock_service_catalog.sql
-- V1 SKU framework lock (2026-05-16). Establishes the canonical
-- service_catalog table that holds every paid SKU Setnayan sells.
--
-- Source of truth: spec corpus commit a0fa3c7 (2026-05-16 Session Summary).
-- Prior to this migration, SKU pricing lived in freeform `orders.service_key`
-- text + scattered TypeScript constants. This migration introduces the
-- single canonical table; downstream features (orders form, vendor-earnings,
-- admin reconcile) will migrate to it iteratively.
--
-- Conservative: this migration does NOT add an FK from orders.service_key
-- to service_catalog.sku_code (existing orders may carry historical strings
-- that don't exist in the catalog). A future cleanup will normalize.
--
-- Idempotent. No drops.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- service_catalog — every paid SKU Setnayan offers.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_catalog (
  sku_code            TEXT PRIMARY KEY,
  display_name        TEXT NOT NULL,
  description         TEXT,
  category            TEXT NOT NULL,
  -- Pricing is stored in centavos to keep math integer-clean. PHP centavos
  -- = peso * 100. Display layer converts back to peso strings.
  price_centavos      INTEGER NOT NULL CHECK (price_centavos >= 0),
  unit                TEXT NOT NULL,
    -- 'event' | 'render' | 'day' | 'week' | 'month' | 'quarter' | 'year' |
    -- 'each' | 'verification' | 'contract'
  multi_purchase      BOOLEAN NOT NULL DEFAULT FALSE,
  subscription        BOOLEAN NOT NULL DEFAULT FALSE,
  refundable          BOOLEAN NOT NULL DEFAULT TRUE,
  purchaser_role      TEXT NOT NULL DEFAULT 'couple'
    CHECK (purchaser_role IN ('couple', 'vendor', 'either')),
  soft_cap            INTEGER,
    -- Optional throttle hint (e.g. Patiktok 40 videos/day soft cap).
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  effective_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at          TIMESTAMPTZ,
  spec_corpus_ref     TEXT,
    -- Free-form anchor back to the spec doc (e.g. '2026-05-16 a0fa3c7').
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_catalog_active_idx
  ON public.service_catalog(is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS service_catalog_category_idx
  ON public.service_catalog(category);

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

-- Catalog is public read (no secrets — just pricing). Writes are
-- service-role-only via admin tools.
DROP POLICY IF EXISTS service_catalog_read_all ON public.service_catalog;
CREATE POLICY service_catalog_read_all
  ON public.service_catalog FOR SELECT
  TO anon, authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- Seed: V1 SKUs locked 2026-05-16 (spec corpus a0fa3c7).
-- All inserts use ON CONFLICT (sku_code) DO UPDATE so this migration is
-- safely re-runnable and so a future migration can update the same SKUs.
-- ----------------------------------------------------------------------------

-- Save-the-Date Video (NEW — replaces retired save_the_date_render)
INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('save_the_date_video',
   'Save-the-Date Video Render',
   '60-second video render in vertical, square, and horizontal formats. ' ||
   '12-template gallery; 3–8 client video clips required.',
   'couple_addon', 9900, 'render',
   TRUE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  multi_purchase = EXCLUDED.multi_purchase,
  is_active = TRUE,
  updated_at = NOW();

-- Monogram Hero Upgrade
INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('monogram_hero_upgrade',
   'Monogram Hero — animated SVG trace + custom hero background',
   'One-time upgrade: animated SVG monogram trace + a custom hero background ' ||
   'applied to invitation cover. No-refund (rendered asset).',
   'couple_addon', 199900, 'event',
   FALSE, FALSE, FALSE, 'couple', TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  refundable = EXCLUDED.refundable,
  is_active = TRUE,
  updated_at = NOW();

-- Live Schedule Pro widget
INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('pro_widget_schedule',
   'Live Schedule "happening now" highlight',
   'Pro widget that surfaces the live "happening now" slot on the public ' ||
   'event invitation page. Per-event one-time purchase.',
   'couple_addon', 99900, 'event',
   FALSE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  is_active = TRUE,
  updated_at = NOW();

-- ---- Panood (live streaming) tiers ----

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('panood_daily_broadcast',
   'Panood Daily Broadcast',
   'One day of live-stream broadcast (single-cam). YouTube delivery + ' ||
   'AI highlights enabled for the day.',
   'panood', 49900, 'day',
   TRUE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-16 a0fa3c7'),
  ('panood_camera_sync',
   'Panood Camera Sync (multi-cam)',
   'Add multi-camera sync to a Panood daily broadcast (per day).',
   'panood', 9900, 'day',
   TRUE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-16 a0fa3c7'),
  ('panood_annual_streaming',
   'Panood Annual Streaming (single-cam unlimited)',
   'Annual subscription. Unlimited single-cam live streaming for the ' ||
   'subscription year.',
   'panood', 299900, 'year',
   FALSE, TRUE, TRUE, 'couple', TRUE,
   '2026-05-16 a0fa3c7'),
  ('panood_annual_streaming_plus',
   'Panood Annual Streaming Plus (multi-cam unlimited)',
   'Annual subscription. Unlimited multi-cam live streaming with sync.',
   'panood', 399900, 'year',
   FALSE, TRUE, TRUE, 'couple', TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  subscription = EXCLUDED.subscription,
  multi_purchase = EXCLUDED.multi_purchase,
  is_active = TRUE,
  updated_at = NOW();

-- ---- Patiktok dual-tier ----

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, soft_cap,
   is_active, spec_corpus_ref)
VALUES
  ('patiktok_setnayan_tiktok',
   'Patiktok — Setnayan TikTok',
   'One day of automated TikTok publishing on Setnayan''s shared TikTok ' ||
   'channel. Soft cap 40 videos/day.',
   'patiktok', 99900, 'day',
   TRUE, FALSE, TRUE, 'couple', 40, TRUE,
   '2026-05-16 a0fa3c7'),
  ('patiktok_personal_tiktok',
   'Patiktok — Personal TikTok (BYO)',
   'One day of automated TikTok publishing to couple''s own (BYO) TikTok ' ||
   'channel. Soft cap 40 videos/day.',
   'patiktok', 199900, 'day',
   TRUE, FALSE, TRUE, 'couple', 40, TRUE,
   '2026-05-16 a0fa3c7'),
  ('patiktok_video_overage',
   'Patiktok +10 videos overage',
   'Per-block-of-10 overage above the 40 videos/day soft cap.',
   'patiktok', 4900, 'each',
   TRUE, FALSE, TRUE, 'couple', NULL, TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  soft_cap = EXCLUDED.soft_cap,
  is_active = TRUE,
  updated_at = NOW();

-- ---- AI Highlights / Same-Day Edit ----

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('ai_video_highlight_60s',
   'AI Video Highlight 60s',
   'AI-generated 60-second highlight reel from event footage.',
   'panood', 99900, 'render',
   TRUE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-16 a0fa3c7'),
  ('ai_edited_highlight_3min',
   'AI Edited Highlight 3-min',
   'AI-generated 3-minute edited highlight with music + transitions. ' ||
   'Repriced 2026-05-16: was ₱4,999 (price_centavos=499900), now ₱3,499.',
   'panood', 349900, 'render',
   TRUE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-16 a0fa3c7'),
  ('same_day_edit',
   'Same-Day Edit',
   'Same-day editing rush: highlight reel delivered before reception ends.',
   'panood', 999900, 'render',
   FALSE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_centavos = EXCLUDED.price_centavos,
  is_active = TRUE,
  updated_at = NOW();

-- ---- Vendor Verification SKUs ----

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('vendor_verification_initial',
   'Vendor Verification — Initial (FREE)',
   'Initial vendor verification (DTI/BIR/Mayors permit + Persona ID + ' ||
   'Google Meet + reference + sanctions). Free.',
   'vendor_verification', 0, 'verification',
   FALSE, FALSE, FALSE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('vendor_verification_annual_renewal',
   'Vendor Annual Re-verification',
   'Annual re-verification charge (₱1,500/year) to keep verified vendor badge.',
   'vendor_verification', 150000, 'year',
   FALSE, TRUE, FALSE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('vendor_verification_redemption',
   'Vendor Re-verification after demotion',
   'Re-verification fee after a vendor is demoted (e.g. complaint review). ' ||
   '₱2,500 one-time.',
   'vendor_verification', 250000, 'verification',
   FALSE, FALSE, FALSE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  is_active = TRUE,
  updated_at = NOW();

-- ---- All Tools Unlock (NEW bundle) + individual tools ----

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('all_tools_unlock_annual',
   'All Tools Unlock — annual bundle (Mood Board, Palette, Seating, QR Reader, Advanced Pricing)',
   'Annual bundle that unlocks Mood Board, Palette, Seating, QR Reader, and ' ||
   'Advanced Pricing tools for the vendor. ₱9,999/year.',
   'vendor_tools', 999900, 'year',
   FALSE, TRUE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('tool_mood_board_weekly',
   'Mood Board Integration',
   'Weekly access to Mood Board integration for a vendor (₱99/wk).',
   'vendor_tools', 9900, 'week',
   FALSE, TRUE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('tool_seat_arrangement_weekly',
   'Seat Arrangement Integration',
   'Weekly access to Seating tool integration for a vendor (₱99/wk).',
   'vendor_tools', 9900, 'week',
   FALSE, TRUE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('tool_palette_weekly',
   'Palette Integration',
   'Weekly access to Palette tool integration for a vendor (₱99/wk).',
   'vendor_tools', 9900, 'week',
   FALSE, TRUE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('tool_qr_reader_weekly',
   'QR Reader Integration',
   'Weekly access to QR Reader tool integration for a vendor (₱99/wk).',
   'vendor_tools', 9900, 'week',
   FALSE, TRUE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('tool_advanced_pricing_weekly',
   'Advanced Pricing Tier',
   'Weekly Advanced Pricing tier upgrade for a vendor (₱99/wk).',
   'vendor_tools', 9900, 'week',
   FALSE, TRUE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  subscription = EXCLUDED.subscription,
  is_active = TRUE,
  updated_at = NOW();

-- ---- Boosted Ads (NEW weekly by radius) ----

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('boosted_ads_5km',
   'Boosted Ads — Local 5km',
   'Local 5km-radius boosted ads for a vendor profile (₱5,000/wk).',
   'vendor_ads', 500000, 'week',
   TRUE, FALSE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('boosted_ads_10km',
   'Boosted Ads — City 10km',
   '10km-radius boosted ads for a vendor profile (₱8,000/wk).',
   'vendor_ads', 800000, 'week',
   TRUE, FALSE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('boosted_ads_20km',
   'Boosted Ads — Metro 20km',
   '20km-radius (metro) boosted ads for a vendor profile (₱15,000/wk).',
   'vendor_ads', 1500000, 'week',
   TRUE, FALSE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  is_active = TRUE,
  updated_at = NOW();

-- ---- Sponsored Boost (NEW Quarterly + Annual; verified-only) ----

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('sponsored_boost_quarterly_30km',
   'Sponsored Boost Quarterly 30km',
   '30km-radius sponsored boost, quarterly term (3 months). Verified vendors ' ||
   'only. ₱250,000 / 3 months.',
   'vendor_ads', 25000000, 'quarter',
   FALSE, FALSE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('sponsored_boost_annual_30km',
   'Sponsored Boost Annual 30km',
   '30km-radius sponsored boost, annual term (12 months). Verified vendors ' ||
   'only. ₱800,000/year (subscription).',
   'vendor_ads', 80000000, 'year',
   FALSE, TRUE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  subscription = EXCLUDED.subscription,
  is_active = TRUE,
  updated_at = NOW();

-- ---- Vendor Pro Weekly + Contract Intelligence ----

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('vendor_pro_weekly',
   'Vendor Pro Weekly subscription',
   'Weekly Vendor Pro subscription (₱499/wk). Includes free Contract ' ||
   'Intelligence for the active period.',
   'vendor_subscription', 49900, 'week',
   FALSE, TRUE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7'),
  ('contract_intelligence_per_contract',
   'Contract Intelligence per contract',
   '₱199 per contract analyzed. Free for vendors with active Vendor Pro ' ||
   'Weekly subscription.',
   'vendor_tools', 19900, 'contract',
   TRUE, FALSE, TRUE, 'vendor', TRUE,
   '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  subscription = EXCLUDED.subscription,
  is_active = TRUE,
  updated_at = NOW();

-- ----------------------------------------------------------------------------
-- Retired SKUs. Keep rows around so historical orders can still be audited;
-- flip is_active=FALSE so the UI no longer offers them.
-- ----------------------------------------------------------------------------

-- Old Save-the-Date render (replaced by save_the_date_video).
INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   is_active, retired_at, spec_corpus_ref)
VALUES
  ('save_the_date_render',
   'Save-the-Date Render (retired)',
   'Retired 2026-05-16. Replaced by save_the_date_video.',
   'retired', 0, 'render',
   FALSE, NOW(), '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  is_active = FALSE,
  retired_at = COALESCE(public.service_catalog.retired_at, NOW()),
  updated_at = NOW();

-- Daily.co video meeting SKUs (feature retired with Daily.co).
INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   is_active, retired_at, spec_corpus_ref)
VALUES
  ('daily_co_video_meeting',
   'Daily.co Video Meeting (retired)',
   'Retired 2026-05-16. Daily.co integration removed; vendor↔couple chat ' ||
   'covers consult flow.',
   'retired', 0, 'event',
   FALSE, NOW(), '2026-05-16 a0fa3c7'),
  ('video_meeting_addon',
   'Video Meeting Add-on (retired)',
   'Retired 2026-05-16. Daily.co integration removed.',
   'retired', 0, 'event',
   FALSE, NOW(), '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  is_active = FALSE,
  retired_at = COALESCE(public.service_catalog.retired_at, NOW()),
  updated_at = NOW();

-- Old Patiktok 5hr booth SKU (replaced by daily dual-tier).
INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   is_active, retired_at, spec_corpus_ref)
VALUES
  ('patiktok_booth_5hr',
   'Patiktok 5hr Booth (retired)',
   'Retired 2026-05-16. Replaced by patiktok_setnayan_tiktok + ' ||
   'patiktok_personal_tiktok daily tiers.',
   'retired', 249900, 'event',
   FALSE, NOW(), '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  is_active = FALSE,
  retired_at = COALESCE(public.service_catalog.retired_at, NOW()),
  updated_at = NOW();

-- Old Sponsored Boost weekly (replaced by quarterly + annual 30km).
INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   is_active, retired_at, spec_corpus_ref)
VALUES
  ('sponsored_boost_weekly',
   'Sponsored Boost Weekly (retired)',
   'Retired 2026-05-16. Replaced by sponsored_boost_quarterly_30km + ' ||
   'sponsored_boost_annual_30km.',
   'retired', 0, 'week',
   FALSE, NOW(), '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  is_active = FALSE,
  retired_at = COALESCE(public.service_catalog.retired_at, NOW()),
  updated_at = NOW();

-- Old Pro Widget bundle + Story (Save-the-Date story widget) — retired.
INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   is_active, retired_at, spec_corpus_ref)
VALUES
  ('pro_widget_bundle',
   'Pro Widget Bundle (retired)',
   'Retired 2026-05-16. Widgets are now sold per-feature ' ||
   '(pro_widget_schedule, monogram_hero_upgrade).',
   'retired', 0, 'event',
   FALSE, NOW(), '2026-05-16 a0fa3c7'),
  ('pro_widget_story',
   'Pro Widget Story (retired)',
   'Retired 2026-05-16. Save-the-Date Story widget consolidated into ' ||
   'save_the_date_video.',
   'retired', 0, 'event',
   FALSE, NOW(), '2026-05-16 a0fa3c7'),
  ('pro_widget_hero',
   'Pro Widget Hero (renamed)',
   'Renamed to monogram_hero_upgrade 2026-05-16. Kept inactive for history.',
   'retired', 199900, 'event',
   FALSE, NOW(), '2026-05-16 a0fa3c7')
ON CONFLICT (sku_code) DO UPDATE SET
  is_active = FALSE,
  retired_at = COALESCE(public.service_catalog.retired_at, NOW()),
  updated_at = NOW();

COMMIT;
