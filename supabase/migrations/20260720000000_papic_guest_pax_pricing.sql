-- 20260720000000_papic_guest_pax_pricing.sql
--
-- Pax-based pricing engine — FIRST BUILD (greenfield).
-- Owner-locked 2026-06-02 (CLAUDE.md decision-log row
-- "📸 Papic Guest pax-curve increment LOCKED at ₱350/50").
--
-- WHY — Setnayan Productions services that scale per guest are priced by pax,
-- not flat (memory project_setnayan_pax_based_pricing · CLAUDE.md 2026-06-01
-- pax-pricing lock). Model: a floor price at a floor guest count + a per-block
-- increment for each block of guests above the floor. Papic Guest (the per-
-- guest camera · "Every guest's phone, a candid camera") is the first SKU on
-- this engine:
--     floor 100 pax = ₱2,999 · +₱350 per additional 50 pax
--     → 100 = ₱2,999 · 150 = ₱3,349 · 200 = ₱3,699 · 300 = ₱4,399 · 500 = ₱5,799
--   formula: floor_price + increment_price * ceil(max(0, pax - floor) / block)
--
-- COMPETITIVE WHY — Once.film (the closest competitor, photos-only, no
-- video/tagging/reels) charges ~₱56/$ tiers landing ~₱5,600 at "unlimited";
-- this curve stays under Once across the 150–300-guest core market while
-- Papic out-delivers it. (CLAUDE.md 2026-06-02 "📸 Papic vs Once benchmark".)
--
-- SAFE BY CONSTRUCTION:
--   • ADDITIVE + NULLABLE + idempotent. Columns default such that every other
--     SKU stays is_pax_priced=FALSE → app code computes the flat retail_price_php
--     (byte-identical to today's charge path).
--   • PAPIC_GUEST.retail_price_php stays 2999.00 as the "from ₱2,999" floor
--     anchor for price-less display surfaces (/pricing, for-vendors catalog).
--   • Pilot-safe — PAPIC_GUEST has NO live couple buy surface yet (no add-ons
--     grid card; the [addon] route is a static explainer), so flipping it on
--     changes zero live pilot checkout. The server-side recompute in
--     submitOrderAction (apps/web/app/dashboard/[eventId]/checkout/actions.ts)
--     makes any future / admin-placed PAPIC_GUEST order correct + tamper-proof.

ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS is_pax_priced           BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pax_floor               INTEGER,
  ADD COLUMN IF NOT EXISTS pax_floor_price_php     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pax_increment_size      INTEGER,
  ADD COLUMN IF NOT EXISTS pax_increment_price_php NUMERIC(10,2);

COMMENT ON COLUMN public.platform_retail_catalog_v2.is_pax_priced IS
  'When TRUE, price scales with events.estimated_pax: pax_floor_price_php at pax<=pax_floor, +pax_increment_price_php per pax_increment_size guests above (ceil per block). Consumed by lib/v2-catalog.ts computePaxPriceCentavos(). Owner-locked 2026-06-02.';
COMMENT ON COLUMN public.platform_retail_catalog_v2.pax_floor IS
  'Floor guest count (e.g. 100). Events at or below this charge pax_floor_price_php — the 100-pax base. Nothing prices lower than the floor.';
COMMENT ON COLUMN public.platform_retail_catalog_v2.pax_floor_price_php IS
  'Price (PHP) at the floor pax count = the base price. PAPIC_GUEST = 2999.00.';
COMMENT ON COLUMN public.platform_retail_catalog_v2.pax_increment_size IS
  'Guest block size above the floor that triggers one increment (e.g. 50).';
COMMENT ON COLUMN public.platform_retail_catalog_v2.pax_increment_price_php IS
  'PHP added per increment block above the floor (ceil rounding per block). PAPIC_GUEST = 350.00.';

-- A pax-priced row MUST carry a complete, valid config. Guarded so the
-- migration is idempotent on re-run. Added while every row is still
-- is_pax_priced=FALSE (all pass), before the PAPIC_GUEST UPDATE below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_retail_catalog_v2_pax_config_complete'
  ) THEN
    ALTER TABLE public.platform_retail_catalog_v2
      ADD CONSTRAINT platform_retail_catalog_v2_pax_config_complete
      CHECK (
        is_pax_priced = FALSE
        OR (
          pax_floor               IS NOT NULL AND pax_floor > 0
          AND pax_floor_price_php  IS NOT NULL AND pax_floor_price_php >= 0
          AND pax_increment_size   IS NOT NULL AND pax_increment_size > 0
          AND pax_increment_price_php IS NOT NULL AND pax_increment_price_php >= 0
        )
      );
  END IF;
END$$;

-- Papic Guest = the first pax-priced SKU. Floor ₱2,999 @ 100 pax · +₱350 / 50.
-- Idempotent (re-running re-applies the same values). retail_price_php left
-- unchanged at 2999.00 so flat / no-event-context readers still anchor on the
-- floor.
UPDATE public.platform_retail_catalog_v2
SET is_pax_priced           = TRUE,
    pax_floor               = 100,
    pax_floor_price_php     = 2999.00,
    pax_increment_size      = 50,
    pax_increment_price_php = 350.00
WHERE service_code = 'PAPIC_GUEST';
