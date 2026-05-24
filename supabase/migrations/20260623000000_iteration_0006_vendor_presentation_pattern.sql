-- ============================================================================
-- 20260623000000_iteration_0006_vendor_presentation_pattern.sql
--
-- Adds `presentation_pattern` to `vendor_profiles` so the Concierge wizard
-- VendorPickGridCard can branch tile rendering between two patterns:
--
--   creations · Pattern A · multi-photo tile (2×2 collage of up to 4
--               vendor_services.primary_photo_r2_key photos · couples
--               see the vendor's portfolio range at a glance)
--   locked    · Pattern B · single-hero tile (one vendor_profiles.logo_url
--               or primary photo · couples see one defining image)
--
-- Locks the spec-corpus assignment from CLAUDE.md decision-log row
-- 2026-05-24 "Vendor presentation pattern locked · Creations vs Locked"
-- + 02_Specifications/Vendor_Taxonomy_V1_Master.md § 10. Same V1/V1.1
-- split applies: V1 ships single-hero everywhere; V1.1 (this migration
-- + the tile rendering change) upgrades Pattern A vendors to multi-photo.
--
-- BACKFILL STRATEGY
--
-- Reads from vendor_profiles.services[1] (the primary canonical_service
-- string per the existing column shape) and runs a CASE expression
-- against the locked Pattern A / Pattern B assignment. Default fallback
-- is 'locked' (the safe choice — single-hero is the unchanged baseline;
-- mis-classifying a creations vendor as locked just means they don't
-- get the multi-photo upgrade until corrected manually).
--
-- WHY a column on vendor_profiles (not a computed derivation in code):
--   1. Vendors can override the default (V1.x admin surface · "this
--      stylist actually sells one fixed package · classify as locked").
--   2. SQL queries that need the pattern (admin reports, vendor-side
--      analytics, /vendors browse) read directly from the column · no
--      need to recompute the mapping in 3 different render paths.
--   3. Index-friendly · the partial index WHERE presentation_pattern IS
--      NOT NULL covers the "show me all creations vendors" query without
--      a function-based index on a CASE expression.
--
-- IDEMPOTENT · safe to re-run. The backfill UPDATE is gated on
-- `WHERE presentation_pattern IS NULL` so subsequent runs are no-ops.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- 1. column · presentation_pattern with CHECK enum
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS presentation_pattern TEXT
    CHECK (presentation_pattern IS NULL OR presentation_pattern IN ('creations', 'locked'));

COMMENT ON COLUMN public.vendor_profiles.presentation_pattern IS
  'Per-vendor display pattern in the marketplace grid (2026-05-24 owner directive). ''creations'' = multi-photo 2×2 tile sourced from vendor_services.primary_photo_r2_key (stylist · photo · cake · attire · HMUA · band · florist · catering · etc.). ''locked'' = single hero photo (venues · officiants · accommodation · photobooth · mobile_bar · coordinator · pyrotechnics · lights+sound · drone · bridal car). NULL = unclassified, defaults to single-hero behavior. Backfilled from services[1] by migration 20260623000000.';

-- ────────────────────────────────────────────────────────────────────────
-- 2. partial index · "all creations" lookup
-- ────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS vendor_profiles_presentation_pattern_idx
  ON public.vendor_profiles(presentation_pattern)
  WHERE presentation_pattern IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────
-- 3. backfill · derive presentation_pattern from services[1] canonical
--
-- Pattern A (creations) canonicals · 30+ entries covering portfolio-
-- driven categories. Pattern B (locked) catches everything else via the
-- ELSE branch.
-- ────────────────────────────────────────────────────────────────────────

UPDATE public.vendor_profiles
SET presentation_pattern = CASE
  -- ──── Photography + Video (5) ────
  WHEN services[1] = 'photographer'            THEN 'creations'
  WHEN services[1] = 'videographer'            THEN 'creations'
  WHEN services[1] = 'sde_editor'              THEN 'creations'
  WHEN services[1] = 'std_video_editor'        THEN 'creations'
  WHEN services[1] = 'prenup_shoot'            THEN 'creations'

  -- ──── Design + Decor (3) ────
  WHEN services[1] = 'reception_decor'         THEN 'creations'
  WHEN services[1] = 'florist'                 THEN 'creations'

  -- ──── Food (2) ────
  WHEN services[1] = 'catering'                THEN 'creations'
  WHEN services[1] = 'cake_maker'              THEN 'creations'

  -- ──── Attire + Accessories (8 · post 2026-05-24 expansion) ────
  WHEN services[1] = 'bridal_gown'             THEN 'creations'
  WHEN services[1] = 'groom_suit'              THEN 'creations'
  WHEN services[1] = 'bridal_shoes'            THEN 'creations'
  WHEN services[1] = 'groom_shoes'             THEN 'creations'
  WHEN services[1] = 'entourage_attire'        THEN 'creations'
  WHEN services[1] = 'parents_attire'          THEN 'creations'
  -- Legacy values · backfill compatibility before the rename migration
  -- 20260621000000 fully propagates to seed data
  WHEN services[1] = 'gown_designer'           THEN 'creations'
  WHEN services[1] = 'suit_designer'           THEN 'creations'

  -- ──── HMUA (2) ────
  WHEN services[1] = 'makeup_artist'           THEN 'creations'
  WHEN services[1] = 'hair_stylist'            THEN 'creations'

  -- ──── Music + Performance (6) ────
  WHEN services[1] = 'band_dj'                 THEN 'creations'
  WHEN services[1] = 'acoustic_performer'      THEN 'creations'
  WHEN services[1] = 'choir'                   THEN 'creations'
  WHEN services[1] = 'string_quartet'          THEN 'creations'
  WHEN services[1] = 'host_emcee'              THEN 'creations'
  WHEN services[1] = 'choreographer'           THEN 'creations'

  -- ──── Stationery + Souvenirs (5) ────
  WHEN services[1] = 'invitations_stationery'  THEN 'creations'
  WHEN services[1] = 'stationery_signage'      THEN 'creations'
  WHEN services[1] = 'souvenirs'               THEN 'creations'
  WHEN services[1] = 'rings'                   THEN 'creations'
  WHEN services[1] = 'calligrapher'            THEN 'creations'

  -- ──── Niche creations (2) ────
  WHEN services[1] = 'live_painter'            THEN 'creations'
  WHEN services[1] = 'magician'                THEN 'creations'

  -- ──── Everything else falls through to 'locked' (Pattern B):
  --      venue · religious_venue · officiant · accommodation ·
  --      photobooth · mobile_bar · pyrotechnics · lights_and_sound ·
  --      led_screens · wedding_coordination · drone · transportation ·
  --      inflatable_rentals · plus any unclassified services. Safe
  --      default — single-hero is the unchanged baseline.
  ELSE 'locked'
END
WHERE presentation_pattern IS NULL
  AND services IS NOT NULL
  AND array_length(services, 1) >= 1;

COMMIT;
