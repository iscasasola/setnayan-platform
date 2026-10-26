-- ============================================================================
-- 20271290389661_suggestion_services_read_the_parts_tables.sql
-- Created via `pnpm migration:new`. Idempotent (CREATE OR REPLACE only).
--
-- 🌳 ③0-b — ONE SOURCE FOR "WHO MAY SUGGEST A PHOTO TO THIS PART" (owner 2026-10-26,
-- DECISION_LOG "APPROVED — BUILD THE TAXONOMY"; corpus
-- prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md § 8.3 ③0-b, audit A18).
--
-- MEASURED BEFORE THIS: `inspiration_suggestion_services(slot)` (migration
-- 20271279311294) was a CASE over 20 slot keys, each with a hard-coded list of
-- canonical services GENERATED from the TS fallback map. Its guard compared it to
-- that same TS fallback, so it stayed green after any admin edit: re-home a part,
-- link a category, add a service under a home category — the couple's picker moved
-- and the SQL door that decides a supplier's suggestion did not.
--
-- ── WHAT LANDS ──────────────────────────────────────────────────────────────
--   1 · `inspiration_category_services(category)` — the shop services that supply
--       ONE tier-2 category, read off `canonical_service_taxonomy` exactly as
--       `deriveBuckets` / `CANONICAL_SERVICES_BY_TILE` (apps/web/lib/vendor-counts.ts)
--       read it: not marketplace-hidden, and `tile_id` = the category OR the category
--       is one of its `secondary_tiles`.
--   2 · `inspiration_suggestion_services(slot)` — rewritten as a JOIN: the part's
--       home + its `inspiration_part_categories`, each expanded through (1). Same
--       signature, same grants, same caller (`vendor_begin_inspiration_suggestion`).
--       STABLE now (it reads tables); it was IMMUTABLE only because it was a literal.
--
-- 🧩 TWO THINGS STAY WRITTEN DOWN HERE, ON PURPOSE (audit class C — product rules /
-- documented fallbacks, each held by a db test):
--   a · WHICH parts take a supplier's suggestion at all: the parts the couple's Studio
--       draws a photos line on (`libraryPhotoParts()` — the main palette, the colour
--       lanes, the attire boards). That set is the STUDIO's code structure
--       (`studioPhotoParts` in apps/web/lib/inspiration-slots.ts), not admin data — an
--       admin-added part is not drawn by the Studio until step ④ — so it cannot be read
--       from a table. Every other part answers EMPTY, exactly as before.
--       `a-supplier-suggests-only-to-its-own-parts.db.test.ts` (test 1) holds this list
--       equal to `libraryPhotoParts(fallbackInspirationParts())`.
--   b · The Filipiniana & Barongs cross-view. On the tables that category has NO
--       service (`lib/taxonomy.ts` calls it "a CROSS-VIEW, not a primary bucket"); the
--       TS reader force-fills it from `FILIPINIANA_BARONG_CANONICALS`. Without the same
--       ten keys here, 11 parts would silently lose every barong / Filipiniana shop on
--       ship day. ⚠ ③0-a (`claude/one-source-buckets`, another PR) turns that list into
--       `secondary_tiles` rows; when it lands, the UNION branch below is redundant and
--       must be dropped in a NEW migration. Until then the same db test holds the ten
--       keys equal to the TS const, so the two copies cannot drift apart silently.
--
-- ✅ UNCHANGED ON TODAY'S DATA: for every slot the new function answers exactly what
-- the CASE answered (checked on the replay against the TS map the CASE was generated
-- from, and read-only on prod before writing — see the PR body).
-- ============================================================================

BEGIN;

-- ── 1 · One category → its shop services ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inspiration_category_services(
  p_category_id TEXT
) RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.canonical_service
    FROM public.canonical_service_taxonomy c
   WHERE NOT COALESCE(c.marketplace_hidden, FALSE)
     AND (c.tile_id = p_category_id
          OR p_category_id = ANY (COALESCE(c.secondary_tiles, ARRAY[]::TEXT[])))
  UNION
  -- (b) above — the Filipiniana & Barongs cross-view, until ③0-a writes it as rows.
  SELECT k
    FROM unnest(ARRAY[
      'filipiniana_terno','filipiniana_maria_clara','filipiniana_balintawak',
      'barong_tagalog_custom','barong_tagalog_rental',
      'maranao_wedding_attire','tausug_wedding_attire','yakan_wedding_attire',
      'muslim_modest_bridal','inc_modest_bridal'
    ]::TEXT[]) AS k
   WHERE p_category_id = 'filipiniana_barongs';
$$;

COMMENT ON FUNCTION public.inspiration_category_services(TEXT) IS
  'The canonical shop services that supply one tier-2 category: not marketplace_hidden, '
  'tile_id = the category or the category in secondary_tiles — the same rule as '
  'deriveBuckets (apps/web/lib/vendor-counts.ts). Plus the Filipiniana & Barongs '
  'cross-view list until ③0-a writes it as secondary_tiles rows. PLAN '
  'admin_taxonomy_four_levels_2026-10-26 § 8.3 ③0-b.';

REVOKE ALL ON FUNCTION public.inspiration_category_services(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inspiration_category_services(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.inspiration_category_services(TEXT) TO authenticated;

-- ── 2 · One part → the services that may suggest to it ──────────────────────
CREATE OR REPLACE FUNCTION public.inspiration_suggestion_services(
  p_slot_key TEXT
) RETURNS TEXT[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT s.svc ORDER BY s.svc), ARRAY[]::TEXT[])
    FROM public.inspiration_parts p
    CROSS JOIN LATERAL (
      SELECT p.home_category_id AS category_id
      UNION
      SELECT pc.category_id FROM public.inspiration_part_categories pc WHERE pc.slot_key = p.slot_key
    ) cat
    CROSS JOIN LATERAL public.inspiration_category_services(cat.category_id) AS s(svc)
   WHERE p.slot_key = p_slot_key
     AND p.kind = 'part'
     AND p.status <> 'retired'
     -- (a) above — the parts the couple's Studio draws a photos line on (libraryPhotoParts()).
     AND p.slot_key = ANY (ARRAY[
       'overall','stage','ceiling','backdrop','tunnel','table','chairs','ribbons_candles','lights',
       'bridal_bouquet','entourage_bouquets','centrepieces','flower_accents','cake',
       'bride','groom','bridesmaids','groomsmen','flower_girl','ring_bearer'
     ]::TEXT[]);
$$;

COMMENT ON FUNCTION public.inspiration_suggestion_services(TEXT) IS
  'The canonical shop services that may SUGGEST a photo to one couple part — read off '
  'the tables (inspiration_parts.home_category_id + inspiration_part_categories, each '
  'expanded by inspiration_category_services), so an admin edit of a part moves it. Only '
  'the parts the couple''s Studio draws a photos line on (libraryPhotoParts()) answer; any '
  'other slot answers EMPTY. tests/db/a-supplier-suggests-only-to-its-own-parts.db.test.ts '
  'holds it equal to the tables after a simulated admin edit. ③0-b, 20271290389661.';

REVOKE ALL ON FUNCTION public.inspiration_suggestion_services(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inspiration_suggestion_services(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.inspiration_suggestion_services(TEXT) TO authenticated;

COMMIT;
