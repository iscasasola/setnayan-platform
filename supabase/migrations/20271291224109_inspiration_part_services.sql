-- ============================================================================
-- 20271291224109_inspiration_part_services.sql
-- Created via `pnpm migration:new`. Idempotent (re-applying changes nothing).
--
-- 🌳 ③a — A PART LINKS SERVICES (owner 2026-10-26, DECISION_LOG "APPROVED — BUILD THE
-- TAXONOMY", decision (3): "Parts link SERVICES via one table that REPLACES
-- inspiration_part_categories; home = exactly one category; backfill = today's category
-- expansion (no shop loses a right)"; corpus prototypes/admin_taxonomy_four_levels_2026-10-26/
-- PLAN.md § 3 + § 5 ③a). Stacked on ③0-b (20271290389661).
--
-- ── WHAT LANDS ──────────────────────────────────────────────────────────────
--   1 · `inspiration_category_service_pairs()` — every tier-2 category with every shop
--       service that supplies it, ONE rule (not marketplace-hidden; tile_id or
--       secondary_tiles; + the Filipiniana & Barongs cross-view list until ③0-a writes it
--       as rows). ③0-b's `inspiration_category_services(category)` now reads it, so the
--       rule is written once.
--   2 · `inspiration_part_services(slot_key, canonical_service, sort_order)` — RLS at
--       CREATE TABLE exactly as step ① (authenticated SELECT; no write policy — writes go
--       through the service role behind requireAdmin(), as /admin/categories does).
--   3 · THE BACKFILL — for each part, its home then its also-categories (in their stored
--       order), each expanded through (1). A service reached by two categories keeps the
--       FIRST one's place (sort_order = category rank × 1000 + n). So the set of shops that
--       may add a photo is BYTE-IDENTICAL on ship day:
--       tests/db/part-eligibility-is-unchanged-by-the-move.db.test.ts. Runs only into an
--       EMPTY table, so a re-apply never re-links what an admin unlinked. Every (part,
--       category) pair whose category has no row of its own on the tables is NOTICEd.
--   4 · `inspiration_part_derived_categories(slot)` + the view
--       `inspiration_part_categories_derived` — a part's categories DERIVED from its
--       services (PLAN § 3 "partCategories() becomes DERIVED"): the categories whose every
--       service the part links, then — for any linked service none of those covers — that
--       service's own tile. Ordered by where each category's services sit. 🔑 WHY NOT THE
--       PLAN'S LITERAL "home ∪ distinct tile_id": measured read-only on prod before
--       writing, that rule changes the categories of 11 parts (every attire part: the
--       Filipiniana cross-view has no tile of its own, so Ring bearer would claim "Bride's
--       Attire" and Bridesmaids "Groom's Attire"; Centrepieces would gain "Accommodation") —
--       the credit line and the "Book a … first" words would change on ship day. The
--       covered-first rule reproduces all 28 parts exactly, and the fall-back-to-own-tile
--       half keeps a category when an admin later adds a service to it that this part does
--       not link. The reader (`getInspirationParts()`) reads the view.
--   5 · THE DOUBLE WRITE (until ③c drops the old table): any change to a part's services,
--       or to its home, rewrites that part's `inspiration_part_categories` from (4), in the
--       same transaction — so the table the pre-③a code reads stays a true copy, and a
--       revert of the app is safe. Triggers are created AFTER the backfill, so the
--       backfill does not rewrite the rows it was expanded from.
--   6 · `inspiration_suggestion_services(slot)` repointed at the link table.
--   7 · Two recorded controller calls (DECISION_LOG row above, "small calls"): part
--       `groom` is labelled "Groom’s attire" (label only — the key and every photo stay),
--       and part `entourage` is hidden (its photos stay; "not its own part").
-- ============================================================================

BEGIN;

-- ── 1 · Every tier-2 category → its shop services, one rule ─────────────────
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
   WHERE sc.tier = 2
  UNION
  -- The Filipiniana & Barongs cross-view (`FILIPINIANA_BARONG_CANONICALS`), until ③0-a
  -- writes it as secondary_tiles rows — then drop this branch in a NEW migration.
  SELECT 'filipiniana_barongs', k
    FROM unnest(ARRAY[
      'filipiniana_terno','filipiniana_maria_clara','filipiniana_balintawak',
      'barong_tagalog_custom','barong_tagalog_rental',
      'maranao_wedding_attire','tausug_wedding_attire','yakan_wedding_attire',
      'muslim_modest_bridal','inc_modest_bridal'
    ]::TEXT[]) AS k
   WHERE EXISTS (SELECT 1 FROM public.canonical_service_taxonomy c WHERE c.canonical_service = k);
$$;

COMMENT ON FUNCTION public.inspiration_category_service_pairs() IS
  'Every tier-2 category with every shop service that supplies it — not marketplace_hidden, '
  'tile_id or secondary_tiles (the deriveBuckets rule), plus the Filipiniana & Barongs '
  'cross-view until ③0-a. The one rule behind inspiration_category_services, the ③a backfill '
  'and inspiration_part_derived_categories.';

REVOKE ALL ON FUNCTION public.inspiration_category_service_pairs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspiration_category_service_pairs() TO authenticated;

CREATE OR REPLACE FUNCTION public.inspiration_category_services(
  p_category_id TEXT
) RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.canonical_service FROM public.inspiration_category_service_pairs() p WHERE p.category_id = p_category_id;
$$;

-- ── 2 · The link table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspiration_part_services (
  slot_key          TEXT NOT NULL REFERENCES public.inspiration_parts(slot_key) ON DELETE CASCADE,
  canonical_service TEXT NOT NULL REFERENCES public.canonical_service_taxonomy(canonical_service) ON DELETE RESTRICT,
  -- The credit's order, kept from the category order the service came from.
  sort_order        INT  NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slot_key, canonical_service)
);

COMMENT ON TABLE public.inspiration_part_services IS
  'Which shop services may add photos to an inspiration part — the SAME canonical_service '
  'a shop sells. Replaces inspiration_part_categories (dropped in ③c; double-written until '
  'then). A part keeps exactly one home category (inspiration_parts.home_category_id). '
  'PLAN admin_taxonomy_four_levels_2026-10-26 § 3, ③a.';

-- The service panel and the eligibility read look up by service.
CREATE INDEX IF NOT EXISTS inspiration_part_services_service_idx
  ON public.inspiration_part_services (canonical_service);

ALTER TABLE public.inspiration_part_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inspiration_part_services_read_signed_in ON public.inspiration_part_services;
CREATE POLICY inspiration_part_services_read_signed_in
  ON public.inspiration_part_services FOR SELECT
  TO authenticated
  USING (TRUE);

REVOKE ALL ON public.inspiration_part_services FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inspiration_part_services TO authenticated;

-- ── 3 · The backfill — today's category expansion, byte for byte ────────────
DO $$
DECLARE
  r RECORD;
  n BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.inspiration_part_services) THEN
    RAISE NOTICE 'inspiration_part_services already holds rows — backfill skipped (an admin may have edited them)';
    RETURN;
  END IF;

  -- Said out loud: every (part, category) pair whose category has no service row of its own.
  FOR r IN
    WITH cats AS (
      SELECT p.slot_key, p.home_category_id AS category_id FROM public.inspiration_parts p
       WHERE p.kind = 'part' AND p.home_category_id IS NOT NULL
      UNION
      SELECT pc.slot_key, pc.category_id FROM public.inspiration_part_categories pc
    )
    SELECT c.slot_key, c.category_id,
           EXISTS (SELECT 1 FROM public.inspiration_category_service_pairs() x WHERE x.category_id = c.category_id) AS filled
      FROM cats c
     WHERE NOT EXISTS (
       SELECT 1 FROM public.canonical_service_taxonomy t
        WHERE NOT COALESCE(t.marketplace_hidden, FALSE)
          AND (t.tile_id = c.category_id OR c.category_id = ANY (COALESCE(t.secondary_tiles, ARRAY[]::TEXT[]))))
     ORDER BY 2, 1
  LOOP
    RAISE NOTICE 'part % · category % has no service row of its own — %', r.slot_key, r.category_id,
      CASE WHEN r.filled THEN 'linked from the cross-view list (③0-a makes it rows)' ELSE 'contributes NO service' END;
  END LOOP;

  INSERT INTO public.inspiration_part_services (slot_key, canonical_service, sort_order)
  SELECT DISTINCT ON (c.slot_key, x.canonical_service)
         c.slot_key, x.canonical_service,
         (c.rank * 1000 + row_number() OVER (PARTITION BY c.slot_key, c.category_id ORDER BY x.canonical_service))::INT
    FROM (
      SELECT p.slot_key, p.home_category_id AS category_id, 0 AS rank
        FROM public.inspiration_parts p
       WHERE p.kind = 'part' AND p.home_category_id IS NOT NULL
      UNION ALL
      SELECT pc.slot_key, pc.category_id,
             (1 + row_number() OVER (PARTITION BY pc.slot_key ORDER BY pc.sort_order, pc.category_id))::INT
        FROM public.inspiration_part_categories pc
    ) c
    JOIN public.inspiration_category_service_pairs() x ON x.category_id = c.category_id
   ORDER BY c.slot_key, x.canonical_service, c.rank;

  SELECT count(*) INTO n FROM public.inspiration_part_services;
  RAISE NOTICE 'inspiration_part_services backfilled: % links over % parts', n,
    (SELECT count(DISTINCT slot_key) FROM public.inspiration_part_services);
END $$;

-- ── 4 · A part's categories, derived from its services ──────────────────────
CREATE OR REPLACE FUNCTION public.inspiration_part_derived_categories_all()
RETURNS TABLE (slot_key TEXT, category_id TEXT, sort_order INT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH pairs AS (
    SELECT * FROM public.inspiration_category_service_pairs()
  ), size AS (
    SELECT category_id, count(*) AS n FROM pairs GROUP BY category_id
  ), links AS (
    SELECT ps.slot_key, ps.canonical_service, ps.sort_order, p.home_category_id
      FROM public.inspiration_part_services ps
      JOIN public.inspiration_parts p ON p.slot_key = ps.slot_key AND p.kind = 'part'
  ), covered AS (
    -- every service of the category is linked; placed where its LAST service sits
    SELECT l.slot_key, x.category_id, max(l.sort_order) AS k
      FROM links l
      JOIN pairs x ON x.canonical_service = l.canonical_service
      JOIN size s ON s.category_id = x.category_id
     GROUP BY l.slot_key, x.category_id, s.n
    HAVING count(*) = s.n
  ), uncovered AS (
    SELECT l.slot_key, l.canonical_service, l.sort_order
      FROM links l
     WHERE NOT EXISTS (
       SELECT 1 FROM covered cv JOIN pairs x ON x.category_id = cv.category_id
        WHERE cv.slot_key = l.slot_key AND x.canonical_service = l.canonical_service)
  ), filled AS (
    -- a linked service no covered category holds brings its own tile; placed where its FIRST such service sits
    SELECT u.slot_key, t.tile_id AS category_id, min(u.sort_order) AS k
      FROM uncovered u
      JOIN public.canonical_service_taxonomy t ON t.canonical_service = u.canonical_service
      JOIN public.service_categories sc ON sc.id = t.tile_id AND sc.tier = 2
     GROUP BY u.slot_key, t.tile_id
  ), allc AS (
    SELECT slot_key, category_id, min(k) AS k FROM (SELECT * FROM covered UNION ALL SELECT * FROM filled) z
     GROUP BY slot_key, category_id
  )
  SELECT a.slot_key, a.category_id,
         (row_number() OVER (PARTITION BY a.slot_key ORDER BY a.k, a.category_id))::INT AS sort_order
    FROM allc a
    JOIN public.inspiration_parts p ON p.slot_key = a.slot_key
   WHERE a.category_id IS DISTINCT FROM p.home_category_id;
$$;

COMMENT ON FUNCTION public.inspiration_part_derived_categories_all() IS
  'Each part''s also-categories DERIVED from its linked services (home excluded): the '
  'categories whose every service it links, then the own tile of any linked service none of '
  'those covers; in the services'' order. Reproduces every part''s stored categories on the '
  '③a backfill. Read through the view inspiration_part_categories_derived.';

REVOKE ALL ON FUNCTION public.inspiration_part_derived_categories_all() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspiration_part_derived_categories_all() TO authenticated;

CREATE OR REPLACE VIEW public.inspiration_part_categories_derived
WITH (security_invoker = true) AS
  SELECT d.slot_key, d.category_id, d.sort_order FROM public.inspiration_part_derived_categories_all() d;

COMMENT ON VIEW public.inspiration_part_categories_derived IS
  'A part''s also-categories, derived from inspiration_part_services — what getInspirationParts() '
  'reads since ③a (security_invoker: the reader''s own grants decide).';

REVOKE ALL ON public.inspiration_part_categories_derived FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inspiration_part_categories_derived TO authenticated;

-- ── 5 · The double write (until ③c drops inspiration_part_categories) ───────
CREATE OR REPLACE FUNCTION public.inspiration_part_categories_resync(p_slot_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inspiration_parts WHERE slot_key = p_slot_key) THEN
    RETURN; -- the part is being deleted; its rows cascade
  END IF;
  DELETE FROM public.inspiration_part_categories WHERE slot_key = p_slot_key;
  INSERT INTO public.inspiration_part_categories (slot_key, category_id, sort_order)
  SELECT d.slot_key, d.category_id, d.sort_order
    FROM public.inspiration_part_derived_categories_all() d
   WHERE d.slot_key = p_slot_key;
END;
$$;

REVOKE ALL ON FUNCTION public.inspiration_part_categories_resync(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.inspiration_part_services_keep_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.inspiration_part_categories_resync(OLD.slot_key);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.slot_key IS DISTINCT FROM OLD.slot_key) THEN
    PERFORM public.inspiration_part_categories_resync(NEW.slot_key);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.inspiration_part_services_keep_categories() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS inspiration_part_services_keep_categories ON public.inspiration_part_services;
CREATE TRIGGER inspiration_part_services_keep_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.inspiration_part_services
  FOR EACH ROW EXECUTE FUNCTION public.inspiration_part_services_keep_categories();

DROP TRIGGER IF EXISTS inspiration_parts_rehome_keeps_categories ON public.inspiration_parts;
CREATE TRIGGER inspiration_parts_rehome_keeps_categories
  AFTER UPDATE OF home_category_id ON public.inspiration_parts
  FOR EACH ROW
  WHEN (NEW.home_category_id IS DISTINCT FROM OLD.home_category_id)
  EXECUTE FUNCTION public.inspiration_part_services_keep_categories();

-- ── 6 · The suggestion door reads the link table ────────────────────────────
CREATE OR REPLACE FUNCTION public.inspiration_suggestion_services(
  p_slot_key TEXT
) RETURNS TEXT[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT ps.canonical_service ORDER BY ps.canonical_service), ARRAY[]::TEXT[])
    FROM public.inspiration_part_services ps
    JOIN public.inspiration_parts p ON p.slot_key = ps.slot_key
   WHERE p.slot_key = p_slot_key
     AND p.kind = 'part'
     AND p.status <> 'retired'
     -- The parts the couple's Studio draws a photos line on (libraryPhotoParts()) — ③0-b (a).
     AND p.slot_key = ANY (ARRAY[
       'overall','stage','ceiling','backdrop','tunnel','table','chairs','ribbons_candles','lights',
       'bridal_bouquet','entourage_bouquets','centrepieces','flower_accents','cake',
       'bride','groom','bridesmaids','groomsmen','flower_girl','ring_bearer'
     ]::TEXT[]);
$$;

COMMENT ON FUNCTION public.inspiration_suggestion_services(TEXT) IS
  'The canonical shop services that may SUGGEST a photo to one couple part — the part''s rows '
  'in inspiration_part_services (③a, 20271291224109). Only the parts the couple''s Studio draws '
  'a photos line on (libraryPhotoParts()) answer; any other slot answers EMPTY.';

REVOKE ALL ON FUNCTION public.inspiration_suggestion_services(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inspiration_suggestion_services(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.inspiration_suggestion_services(TEXT) TO authenticated;

-- ── 7 · Two recorded calls: Groom's attire · Entourage hidden ───────────────
UPDATE public.inspiration_parts SET label_en = 'Groom’s attire'
 WHERE slot_key = 'groom' AND label_en = 'Groom’s suit';
UPDATE public.inspiration_parts SET hidden = TRUE
 WHERE slot_key = 'entourage' AND hidden = FALSE;

-- ── Said out loud: the derivation reproduces every part's stored categories ─
DO $$
DECLARE
  bad TEXT;
BEGIN
  SELECT string_agg(slot_key, ', ' ORDER BY slot_key) INTO bad FROM (
    SELECT p.slot_key
      FROM public.inspiration_parts p
     WHERE p.kind = 'part'
       AND ARRAY(SELECT pc.category_id FROM public.inspiration_part_categories pc
                  WHERE pc.slot_key = p.slot_key ORDER BY pc.sort_order, pc.category_id)
           IS DISTINCT FROM
           ARRAY(SELECT d.category_id FROM public.inspiration_part_categories_derived d
                  WHERE d.slot_key = p.slot_key ORDER BY d.sort_order, d.category_id)
  ) z;
  IF bad IS NOT NULL THEN
    -- A NOTICE, not an EXCEPTION: a refusal here would stop deploy-prod for every later merge.
    -- The reader then shows the DERIVED categories for these parts; the db test fails on the replay.
    RAISE NOTICE 'derived categories differ from the stored ones for: %', bad;
  ELSE
    RAISE NOTICE 'derived categories equal the stored ones for every part';
  END IF;
END $$;

COMMIT;
