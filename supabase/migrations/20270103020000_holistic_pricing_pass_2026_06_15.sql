-- 20270103020000_holistic_pricing_pass_2026_06_15.sql
--
-- WHY: executes the VERIFIED, unambiguous parts of the holistic pricing pass
-- (`Pricing_Holistic_Pass_2026-06-15.md`) — owner "do it now" 2026-06-15. Only
-- the changes whose current state + target value are both confirmed from the
-- migration history are applied here. The contested à-la-carte reprices
-- (ANIMATED_MONOGRAM, PAKANTA — the collection doc claimed DB values that the
-- migration history contradicts) are DELIBERATELY NOT touched; they're flagged
-- for owner confirmation against the live site (source-of-truth order:
-- live site > code > DB > docs).
--
-- Idempotent (upsert + targeted UPDATEs). NOT AUTO-APPLIED: owner runs
-- `supabase db push --db-url "$SUPABASE_DB_URL"` after review.
--
-- ⚠ LOAD-BEARING (surfaced, executed per the owner's "do it now" on the §5
-- recommendations): the WEBSITE COLLAPSE retires the in-build Editorial Website
-- (PRO_WEBSITE ₱7,999) + the overlapping Event/RSVP-Pro website SKUs into ONE
-- COUPLE_WEBSITE_PRO ₱3,999 (owner ruling 2026-06-14). The FREE 4-in-1 site +
-- unlimited free RSVP are NOT SKUs (free baseline) and are untouched.
-- Deactivation (is_active=false) does NOT revoke any existing order — ownership
-- is orders.status, not catalog is_active — it only hides the SKU from /pricing
-- + buy surfaces.

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) WEBSITE COLLAPSE — one premium unlock supersedes the overlapping SKUs.
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, is_active, description)
VALUES
  ('COUPLE_WEBSITE_PRO', 'Couple Website PRO', 3999, 0, false, true,
   'One premium unlock across all 4 website phases (Save-the-Date · RSVP · Event · Editorial): premium templates, custom domain, "Made on Setnayan" badge removal, premium motion + editorial layouts. The free 4-in-1 site + unlimited RSVP stay free.')
ON CONFLICT (service_code) DO UPDATE
  SET title = EXCLUDED.title,
      retail_price_php = EXCLUDED.retail_price_php,
      is_active = true,
      description = EXCLUDED.description,
      updated_at = now();

-- Retire the collapsed website/RSVP SKUs. Idempotent — already-inactive rows
-- (e.g. RSVP_WEBSITE) stay inactive. No FK risk: existing orders keep their
-- service_key + entitlement; this only removes the rows from the live catalog.
UPDATE public.platform_retail_catalog_v2
   SET is_active = false, updated_at = now()
 WHERE service_code IN (
   'EVENT_WEBSITE',       -- Event Website ₱1,999  → folded into COUPLE_WEBSITE_PRO
   'PRO_RSVP',            -- Pro RSVP ₱1,999        → folded
   'RSVP_PRO_WEBSITE',    -- RSVP Pro ₱4,499        → folded
   'RSVP_WEBSITE',        -- RSVP ₱2,499 (already inactive) → folded
   'PRO_WEBSITE'          -- Editorial Website ₱7,999 → ABSORBED (owner §5① "absorb" rec, do-it-now)
 );

-- ---------------------------------------------------------------------------
-- (2) VENDOR TOKEN PACKS → flat ₱100/token (holistic pass §4 · owner-locked).
-- DB seed was a tiered ₱180–250/token ladder (₱1,000/2,400/5,500/10,000/18,000);
-- repriced to a flat ₱100/token. Bulk value will come from BONUS tokens later,
-- not a per-token discount.
-- ---------------------------------------------------------------------------
UPDATE public.vendor_billing_catalog SET price_php =   400, updated_at = now() WHERE sku_code = 'vendor_token_pack_4';
UPDATE public.vendor_billing_catalog SET price_php =  1000, updated_at = now() WHERE sku_code = 'vendor_token_pack_10';
UPDATE public.vendor_billing_catalog SET price_php =  2500, updated_at = now() WHERE sku_code = 'vendor_token_pack_25';
UPDATE public.vendor_billing_catalog SET price_php =  5000, updated_at = now() WHERE sku_code = 'vendor_token_pack_50';
UPDATE public.vendor_billing_catalog SET price_php = 10000, updated_at = now() WHERE sku_code = 'vendor_token_pack_100';

-- ---------------------------------------------------------------------------
-- NOT TOUCHED (flagged for owner — live-site confirmation needed):
--   • ANIMATED_MONOGRAM — DB ₱2,499 (seed, never repriced) vs §2 target ₱1,999.
--     The collection doc's "live+DB ₱1,999" is contradicted by the migration
--     history. Confirm the live-site price before repricing.
--   • PAKANTA — DB ₱3,499 (seed, never repriced) vs §2 target ₱2,499 (live).
--     Live vs DB genuinely disagree. Confirm intended value.
-- Every other §2 à-la-carte value already matches the canonical DB
-- (CUSTOM_QR_GUEST 999 · PAPIC_ADDON_STORIES/CAMERA_BRIDGE/PATIKTOK 1499 ·
--  PAPIC_ADDON_THANK_YOU 3499 · SDE 4999 · PANOOD_SYSTEM 2499 · LIVE_WALL 2499 ·
--  SETNAYAN_AI 3999) → no-op, intentionally omitted.
-- ---------------------------------------------------------------------------

COMMIT;
