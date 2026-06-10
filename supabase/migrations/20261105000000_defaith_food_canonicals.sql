-- ============================================================================
-- 20261105000000_defaith_food_canonicals.sql
--
-- De-faith the 4 food/beverage canonicals — the LIVE never-subtract-lock bug fix
-- (owner-ratified 2026-06-11, option 1(c); Catering_Dietary_Halal_Model_2026-06-11.md).
--
-- THE BUG: `passesReligionFilter` (app/vendors/page.tsx, INCLUDE-only) was
-- SUBTRACTING `halal_catering` (faith=Muslim) from every non-Muslim couple and
-- the three `mocktail_*` (faith=INC) from every non-INC couple — exactly the
-- silent subtraction the 2026-06-10 faith lock forbids. A halal caterer / an
-- alcohol-free bar must be bookable by ANYONE who wants it.
--
-- THE FIX: clear `faith` on these 4 (food dietary is a per-vendor capability, not
-- a faith gate). `halal_catering` stays as a faith-NEUTRAL "Halal Catering
-- Specialists" discovery canonical (option 1c) — visible to all couples. The
-- matching hardcoded `faith` tags in apps/web/lib/taxonomy.ts (lines 596,
-- 739-741) are removed in the SAME PR — a DB-only change would leave stale TS
-- driving the filter (taxonomy.ts is both the fallback and the re-seed source).
-- `dietary` tags are KEPT (a useful capability signal for the future graded
-- dietary-capability model). Additive + idempotent + reversible.
-- ============================================================================

BEGIN;

UPDATE public.canonical_service_taxonomy
   SET faith = NULL, updated_at = now()
 WHERE canonical_service IN (
         'halal_catering', 'mocktail_bar', 'mocktail_only_caterer', 'mocktail_booth_mini'
       )
   AND faith IS NOT NULL;

-- Fail loud: no food/beverage canonical may keep a faith tag (faith is reserved
-- for officiants / pre-cana / counseling). Guards against a re-seed clobber.
DO $$
DECLARE bad TEXT;
BEGIN
  SELECT string_agg(canonical_service, ', ') INTO bad
    FROM public.canonical_service_taxonomy
   WHERE canonical_service IN (
           'halal_catering', 'mocktail_bar', 'mocktail_only_caterer', 'mocktail_booth_mini'
         )
     AND faith IS NOT NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'food canonical still faith-tagged after de-faith: %', bad;
  END IF;
END $$;

COMMIT;
