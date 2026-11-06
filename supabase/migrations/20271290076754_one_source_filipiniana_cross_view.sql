-- one_source_filipiniana_cross_view
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- ③0-a "one source" (corpus prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md § 8.3,
-- owner 2026-10-26 "Build the taxonomy").
--
-- WHAT. The Filipiniana & Barongs category is a CROSS-VIEW: the same terno / barong / modest-bridal
-- services that live under Bride's and Groom's Attire, surfaced a second time under their own shelf.
-- Until now that shelf existed only in code — a hand list (`FILIPINIANA_BARONG_CANONICALS`,
-- lib/taxonomy.ts) force-set onto the tile in lib/vendor-counts.ts. The database held no row saying
-- any service belonged there, so:
--   · /admin/categories showed Filipiniana & Barongs with 0 services, and nothing an admin did there
--     could change what the shelf held;
--   · an 11th Filipiniana service added in the database never reached the shelf.
--
-- This writes the cross-view as what every other cross-listing already is: a `secondary_tiles`
-- entry on each service. The services keep their primary tile (`tile_id` is untouched). The code
-- fallback (`TAXONOMY_MAP`) carries the same ten entries, so the reader and its fallback agree;
-- `apps/web/tests/db/one-source-buckets.db.test.ts` asserts that on the replayed seed and that a
-- service an admin cross-lists here afterwards shows on the shelf.
--
-- BEHAVIOUR ON TODAY'S DATA: identical. The shelf resolves to the same ten services it did when the
-- list was in code; `secondary_tiles` is read only by the buckets (lib/vendor-counts.ts) and the
-- admin page's "Also listed under", and Filipiniana & Barongs sits in the same group (`look`) as the
-- attire tiles, so no group-level bucket moves either.
--
-- A service an admin has since deleted or hidden is simply not matched / not shown — no error.

DO $$
DECLARE
  n int;
BEGIN
  UPDATE public.canonical_service_taxonomy
     SET secondary_tiles = array_append(secondary_tiles, 'filipiniana_barongs'),
         updated_at      = now()
   WHERE canonical_service IN (
           'filipiniana_terno',
           'filipiniana_maria_clara',
           'filipiniana_balintawak',
           'barong_tagalog_custom',
           'barong_tagalog_rental',
           'maranao_wedding_attire',
           'tausug_wedding_attire',
           'yakan_wedding_attire',
           'muslim_modest_bridal',
           'inc_modest_bridal'
         )
     AND NOT ('filipiniana_barongs' = ANY (secondary_tiles))
     AND COALESCE(tile_id, '') <> 'filipiniana_barongs';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'one_source_filipiniana_cross_view: % service(s) cross-listed onto filipiniana_barongs', n;
END $$;
