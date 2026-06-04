-- ============================================================================
-- 20260810000000_vendor_profiles_venue_type.sql
--
-- Fine reception-venue TYPE for the Hybrid leaf-match contract (CLAUDE.md
-- 2026-06-04 · [[project_setnayan_leaf_match_contract]]). The onboarding
-- reception screen captures a precise pick (hotel ballroom · events place ·
-- restaurant · garden · beach · heritage · resort), but it collapses to the
-- coarse 7-value events.venue_setting CHECK enum at commit (hotel / events
-- place / restaurant all → banquet_hall). `venue_type` lets a reception venue
-- declare its PRECISE type so the couple's fine pick can filter on it — the
-- "hotel vs events place" distinction venue_setting can't express.
--
-- Additive + NULLABLE: ONLY reception venues populate it. Every other vendor
-- stays NULL = "no venue-type constraint" (Hybrid admit-unknown). Free TEXT (no
-- CHECK) on purpose — the canonical fine vocabulary is still being ratified via
-- Cowork (0044 venue refinement schema + the venue_setting ↔ venue_directory
-- .venue_type reconciliation); a CHECK would lock it prematurely. The app-side
-- enum lives in onboarding actions (RECEPTION_TO_VENUE_TYPE) + the demo seed.
--
-- NOT added to the vendor_market_stats view — the matcher reads venue_type in
-- the same candidate-pool lookup as capacity_max, so the live view is untouched.
-- ============================================================================

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS venue_type TEXT;

COMMENT ON COLUMN public.vendor_profiles.venue_type IS
  'Fine reception-venue type (hotel_ballroom · events_place · restaurant · '
  'garden · beach · heritage · resort). NULL = non-venue or unstated. The '
  'leaf-match matcher filters it against the couple''s fine reception pick '
  '(Hybrid: NULL admits). Distinct from the coarse events.venue_setting enum.';

CREATE INDEX IF NOT EXISTS vendor_profiles_venue_type_idx
  ON public.vendor_profiles (venue_type)
  WHERE venue_type IS NOT NULL;
