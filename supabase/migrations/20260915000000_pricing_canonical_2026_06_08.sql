-- ════════════════════════════════════════════════════════════════════════════
-- Canonical customer pricing reconcile — owner-locked 2026-06-08 ("apply now")
-- Source of truth: Pricing_Canonical_2026-06-08.md (corpus root).
--
-- Targets the V2 customer catalog (platform_retail_catalog_v2 +
-- platform_package_catalog) — the LIVE source read by /pricing, /for-vendors,
-- and dashboard checkout (lib/v2-catalog.ts). NOT the retired V1 service_catalog.
--
-- IDEMPOTENT (safe to re-run). Rows are NEVER deleted — event_software_activations_v2
-- FK-references platform_retail_catalog_v2.service_code, so retirements flip
-- is_active only (verified 0 orders reference the retired codes).
--
-- ⚠ SURFACED FOR OWNER SIGN-OFF — deliberately NOT changed here:
--   • Papic Guests: canonical lists ₱1,999 flat, but PAPIC_GUEST is the owner-locked
--     pax-priced SKU (₱2,999 floor, per the 2026-06-01 pax-pricing lock). Left pax-priced.
--   • Retirements the canonical doc itself flags "confirm" — left ACTIVE pending sign-off:
--     HIGH_RES_ARCHIVE, CALL_TIME_ESCALATOR, INDOOR_BLUEPRINT, PAKULAY.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Reprice 7 existing SKUs to canonical SRP ──────────────────────────────
UPDATE public.platform_retail_catalog_v2 SET retail_price_php =  999, updated_at = now() WHERE service_code = 'CUSTOM_QR_GUEST';      -- Custom QR        ₱1,499 → ₱999
UPDATE public.platform_retail_catalog_v2 SET retail_price_php = 1499, updated_at = now() WHERE service_code = 'PAPIC_ADDON_STORIES'; -- Guest Stories    ₱1,999 → ₱1,499
UPDATE public.platform_retail_catalog_v2 SET retail_price_php = 1499, updated_at = now() WHERE service_code = 'CAMERA_BRIDGE';       -- Camera Bridge    ₱1,999 → ₱1,499
UPDATE public.platform_retail_catalog_v2 SET retail_price_php = 1499, updated_at = now() WHERE service_code = 'PATIKTOK_COMPILER';   -- Patiktok         ₱2,499 → ₱1,499
UPDATE public.platform_retail_catalog_v2 SET retail_price_php = 3499, updated_at = now() WHERE service_code = 'PAPIC_ADDON_THANK_YOU'; -- Thank You      ₱5,499 → ₱3,499
UPDATE public.platform_retail_catalog_v2 SET retail_price_php = 4999, updated_at = now() WHERE service_code = 'SDE';                 -- Same Day Edit    ₱3,499 → ₱4,999 (up)
UPDATE public.platform_retail_catalog_v2 SET retail_price_php = 2499, updated_at = now() WHERE service_code = 'PANOOD_SYSTEM';       -- Panood (per day) ₱3,499 → ₱2,499

-- ── 2. Add the 3 canonical SKUs missing from the live catalog ────────────────
INSERT INTO public.platform_retail_catalog_v2 (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, is_active, description)
VALUES
  ('SETNAYAN_AI',   'Setnayan AI',   3999, 200, false, true, 'Assisted planning — match, sort, cross-reference + your planning workspace. The first paid tier.'),
  ('PRO_RSVP',      'Pro RSVP',      1999,   0, false, true, 'Premium RSVP — guest questions, meal choices, sub-events, and live tracking.'),
  ('EVENT_WEBSITE', 'Event Website', 1999,   0, false, true, 'Your published wedding website — schedule, directions, story, and RSVP.')
ON CONFLICT (service_code) DO UPDATE
  SET title = EXCLUDED.title, retail_price_php = EXCLUDED.retail_price_php, is_active = true, updated_at = now();

-- ── 3. Retire Today's Focus (superseded by Setnayan AI; 0 orders) ────────────
--      is_active only — row preserved for the activations FK + audit history.
UPDATE public.platform_retail_catalog_v2 SET is_active = false, updated_at = now() WHERE service_code = 'TODAYS_FOCUS';

-- ── 4. Assert the two bundles at canonical (already ₱12,999 / ₱27,999) ───────
UPDATE public.platform_package_catalog SET retail_price_php = 12999, updated_at = now() WHERE package_code = 'GUIDED_PACK'; -- Essentials
UPDATE public.platform_package_catalog SET retail_price_php = 27999, updated_at = now() WHERE package_code = 'MEDIA_PACK';  -- Complete

COMMIT;
