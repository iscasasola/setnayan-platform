-- ============================================================================
-- 20271292138044_pairs_drop_the_filipiniana_sql_branch.sql
-- Created via `pnpm migration:new`. Idempotent (CREATE OR REPLACE only).
--
-- 🌳 THE TAXONOMY FOUNDATION — the one-line follow-up both ③0 builders flagged
-- (corpus prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md § 10 + § 11,
-- "Open, between ③0-a and ③0-b").
--
-- ③a (20271291224109) wrote `inspiration_category_service_pairs()` with a UNION branch
-- naming the ten Filipiniana & Barongs cross-view services by hand, "until ③0-a writes
-- it as secondary_tiles rows". ③0-a (20271290076754) writes exactly those ten as
-- `secondary_tiles` rows, so the first half of the function — tile_id OR secondary_tiles,
-- not marketplace_hidden — already returns every one of them. The hand list is now a
-- second copy of one fact; this drops it, so an admin un-listing a service from
-- Filipiniana & Barongs on /admin/categories ("Also listed under") actually un-lists it.
--
-- Eligibility on ship day is unchanged — held by
-- `apps/web/tests/db/part-eligibility-is-unchanged-by-the-move.db.test.ts` (it replays
-- every migration, this one included).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inspiration_category_service_pairs()
RETURNS TABLE (category_id TEXT, canonical_service TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT sc.id, c.canonical_service
    FROM public.service_categories sc
    JOIN public.canonical_service_taxonomy c
      ON NOT COALESCE(c.marketplace_hidden, FALSE)
     AND (c.tile_id = sc.id OR sc.id = ANY (COALESCE(c.secondary_tiles, ARRAY[]::TEXT[])))
   WHERE sc.tier = 2;
$$;

COMMENT ON FUNCTION public.inspiration_category_service_pairs() IS
  'Every tier-2 category with every shop service that supplies it — not marketplace_hidden, '
  'tile_id or secondary_tiles (the deriveBuckets rule). The Filipiniana & Barongs cross-view '
  'is secondary_tiles rows since ③0-a (20271290076754); the hand-kept list was dropped in '
  '20271292138044. The one rule behind the ③a backfill and inspiration_part_derived_categories.';

REVOKE ALL ON FUNCTION public.inspiration_category_service_pairs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspiration_category_service_pairs() TO authenticated;
