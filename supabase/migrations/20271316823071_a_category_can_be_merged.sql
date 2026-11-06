-- ============================================================================
-- A CATEGORY CAN BE MERGED — and the events filed under it move with it.
--
-- Owner, 2026-11-06, approving the supplier-taxonomy simplification (categories
-- 77 → 37): "combine the services in the events running like cale-ice".
--
-- Measured answer before this migration:
--   ✅ A TRADE can be merged (`merge_canonical_service`, 20271176753752).
--   🟡 A CATEGORY (tier-2 tile) could only be DELETED with a destination
--      (`deleteTileWithDestination`): sequential TS writes over TWO of the
--      tile-key holders (canonical_service_taxonomy.tile_id +
--      onboarding_refinements.tile_id), then a HARD delete — and it REFUSED
--      outright whenever couples' suppliers were filed under the tile, because
--      `event_vendors.category_key` (a RESTRICT FK) was never moved. That is
--      exactly the cale-ice case: shoes_footwear, food_truck, coffee_espresso,
--      mens_attire, perfume_bar, dj, womens_attire — every one a tile the
--      approved map folds away.
--   🔴 `service_categories.merged_into_category_id` (added 2026-08-03) had
--      ZERO writers and ZERO readers. This migration is its writer; the
--      reader ships beside it (lib/tile-merge-forward.ts).
--
-- 🚨 WHO HOLDS A TILE ID — enumerated BY THE COLUMN out of production
--    (2026-11-06), not from a remembered list. Two sweeps:
--      1. every FOREIGN KEY that references service_categories (12 columns);
--      2. every text / text[] column in `public` whose stored values intersect
--         the tier-2 ids — which turns up MANY false friends, because 25 trade
--         keys and 11 plan-group ids are spelled exactly like a tile
--         (`dj`, `catering`, `live_band`, `ceremony_venue` …). Each hit was
--         classified by its declaration + writer. The registry and the reasons
--         live in apps/web/lib/tile-merge-holders.ts; the guard beside it fails
--         when a tile-keyed column appears that this function does not move.
--
--    Seven of the moved holders sit under a UNIQUE / PK that includes the tile:
--      event_category_decisions        partial UNIQUE (event_id, tile)
--      event_bench_arrangement         PK (event_id, tile, vendor_id)
--      inspiration_part_categories     PK (slot_key, category_id)
--      vendor_service_recommendations  UNIQUE (tile_id, service_code)
--      vendor_recommendation_optins    UNIQUE (vendor_profile_id, tile_id, service_code)
--      vendor_recommendation_feedback  UNIQUE (vendor_profile_id, tile_id, feedback_type, service_code)
--    …so each drops the colliding SOURCE row first (the owner already holds the
--    destination), then moves the rest — the same shape as the trade merge.
--    Two holders are TEXT[] (team_first is ORDERED — the swap keeps the first
--    occurrence's position; secondary_tiles drops the row's own tile).
--
-- 🔑 A MERGED TILE IS A TOMBSTONE, NEVER A DELETE. The row stays with
--    merged_into_category_id → dest, marketplace_hidden = TRUE, status =
--    'retired', scope = 'merged', so an old id (a bookmarked /explore?tile=,
--    a code constant, a link emitted months ago) still resolves. Every picker
--    already drops `status = 'retired'` or `marketplace_hidden` tiles, and the
--    taxonomy snapshot (lib/taxonomy-snapshot.ts) now drops merged ones too.
--
-- 🔒 A WRITER THAT STILL NAMES AN OLD TILE CANNOT RE-STRAND AN EVENT. The
--    couple-side writers compute `event_vendors.category_key` from a code
--    constant (primaryTileForVendorCategory). A BEFORE trigger forwards a
--    merged id to its replacement on write, so the column can never again
--    point at a tombstone, whatever the constant says.
--
-- Idempotent: CREATE OR REPLACE / DROP … IF EXISTS throughout.
-- ============================================================================

CREATE INDEX IF NOT EXISTS service_categories_merged_into_idx
  ON public.service_categories (merged_into_category_id)
  WHERE merged_into_category_id IS NOT NULL;

COMMENT ON COLUMN public.service_categories.merged_into_category_id IS
  'Tile forwarding pointer. NULL = a live category. Non-NULL = this tile was '
  'merged into that one by merge_service_category(): every stored tile id was '
  'moved, and the row is kept ONLY so an old id still resolves (a bookmarked '
  '/explore?tile=, a code constant, an emitted link). A merged tile also carries '
  'marketplace_hidden = TRUE and status = ''retired'' so it leaves every picker. '
  'Readers follow it via lib/tile-merge-forward.ts. NEVER hard-delete a merged row.';

-- ── 1 · The merge itself — one transaction, every tile-key holder ───────────
CREATE OR REPLACE FUNCTION public.merge_service_category(
  p_source TEXT,
  p_dest   TEXT,
  p_actor  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_moved       JSONB := '{}'::jsonb;
  v_n           INT;
  v_dest_parent TEXT;
BEGIN
  IF p_source IS NULL OR p_dest IS NULL OR btrim(p_source) = '' OR btrim(p_dest) = '' THEN
    RAISE EXCEPTION 'merge_service_category: source and destination are both required';
  END IF;
  IF p_source = p_dest THEN
    RAISE EXCEPTION 'merge_service_category: a category cannot be merged into itself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM service_categories WHERE id = p_source AND tier = 2) THEN
    RAISE EXCEPTION 'merge_service_category: source category % does not exist', p_source;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM service_categories WHERE id = p_dest AND tier = 2) THEN
    RAISE EXCEPTION 'merge_service_category: destination category % does not exist', p_dest;
  END IF;
  -- The destination must be LIVE. Merging into a tombstone would build a chain
  -- every reader has to walk; point at the end of the chain instead.
  IF EXISTS (SELECT 1 FROM service_categories
              WHERE id = p_dest
                AND (merged_into_category_id IS NOT NULL OR status = 'retired')) THEN
    RAISE EXCEPTION
      'merge_service_category: destination % is not live — merge into its replacement instead',
      p_dest;
  END IF;
  IF EXISTS (SELECT 1 FROM service_categories
              WHERE id = p_source AND merged_into_category_id IS NOT NULL) THEN
    RAISE EXCEPTION 'merge_service_category: source % has already been merged', p_source;
  END IF;
  -- Tier-3 children are not re-pointable here (none exist in prod; the shipped
  -- delete refused them too).
  IF EXISTS (SELECT 1 FROM service_categories WHERE parent_id = p_source) THEN
    RAISE EXCEPTION 'merge_service_category: source % still has sub-categories', p_source;
  END IF;

  SELECT parent_id INTO v_dest_parent FROM service_categories WHERE id = p_dest;

  -- ── The taxonomy itself ──────────────────────────────────────────────────
  -- tile_id + the DENORMALISED folder_id (a trade's folder is its tile's parent).
  UPDATE canonical_service_taxonomy
     SET tile_id = p_dest, folder_id = v_dest_parent, updated_at = NOW()
   WHERE tile_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('canonical_service_taxonomy.tile_id', v_n);

  -- secondary_tiles: swap, de-duplicate, and drop the row's OWN tile (a trade
  -- is never a secondary of the tile it already lives in). The second WHERE arm
  -- is the trade that just MOVED into the destination while already listing the
  -- destination as a secondary — it holds no source id, yet must be cleaned.
  UPDATE canonical_service_taxonomy t
     SET secondary_tiles = COALESCE((
           SELECT array_agg(x.v ORDER BY x.first_ord)
             FROM (
               SELECT CASE WHEN u.s = p_source THEN p_dest ELSE u.s END AS v,
                      min(u.ord) AS first_ord
                 FROM unnest(t.secondary_tiles) WITH ORDINALITY AS u(s, ord)
                GROUP BY 1
             ) x
            WHERE x.v IS DISTINCT FROM t.tile_id
         ), ARRAY[]::text[]),
         updated_at = NOW()
   WHERE t.secondary_tiles @> ARRAY[p_source]::text[]
      OR (t.tile_id = p_dest AND t.secondary_tiles @> ARRAY[p_dest]::text[]);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('canonical_service_taxonomy.secondary_tiles', v_n);

  UPDATE onboarding_refinements SET tile_id = p_dest, updated_at = NOW()
   WHERE tile_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('onboarding_refinements.tile_id', v_n);

  -- ── The EVENT holders — the reason this function exists ──────────────────
  UPDATE event_vendors SET category_key = p_dest
   WHERE category_key = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('event_vendors.category_key', v_n);

  DELETE FROM event_category_decisions a
   WHERE a.tile = p_source
     AND EXISTS (SELECT 1 FROM event_category_decisions b
                  WHERE b.event_id = a.event_id AND b.tile = p_dest);
  UPDATE event_category_decisions SET tile = p_dest
   WHERE tile = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('event_category_decisions.tile', v_n);

  DELETE FROM event_bench_arrangement a
   WHERE a.tile = p_source
     AND EXISTS (SELECT 1 FROM event_bench_arrangement b
                  WHERE b.event_id = a.event_id AND b.vendor_id = a.vendor_id
                    AND b.tile = p_dest);
  UPDATE event_bench_arrangement SET tile = p_dest
   WHERE tile = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('event_bench_arrangement.tile', v_n);

  -- ── Admin configuration that names a tile ────────────────────────────────
  -- team_first is ORDERED (the type's first supplier suggestions): the swap
  -- keeps the first occurrence's position and collapses the duplicate.
  UPDATE event_type_profiles p
     SET team_first = (
           SELECT array_agg(x.v ORDER BY x.first_ord)
             FROM (
               SELECT CASE WHEN u.s = p_source THEN p_dest ELSE u.s END AS v,
                      min(u.ord) AS first_ord
                 FROM unnest(p.team_first) WITH ORDINALITY AS u(s, ord)
                GROUP BY 1
             ) x
         )
   WHERE p.team_first @> ARRAY[p_source]::text[];
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('event_type_profiles.team_first', v_n);

  DELETE FROM inspiration_part_categories a
   WHERE a.category_id = p_source
     AND EXISTS (SELECT 1 FROM inspiration_part_categories b
                  WHERE b.slot_key = a.slot_key AND b.category_id = p_dest);
  UPDATE inspiration_part_categories SET category_id = p_dest
   WHERE category_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('inspiration_part_categories.category_id', v_n);

  UPDATE inspiration_parts SET home_category_id = p_dest
   WHERE home_category_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('inspiration_parts.home_category_id', v_n);

  -- A part's "also from" never repeats its HOME. Folding can make them one
  -- category two ways — the home folds onto an also-from (Fireworks → Lights),
  -- or an also-from folds onto the home (AV → Lights) — so drop the also-row
  -- the fold just made redundant. Only rows on p_dest can have become one.
  DELETE FROM inspiration_part_categories c
   USING inspiration_parts p
   WHERE c.slot_key = p.slot_key
     AND c.category_id = p.home_category_id
     AND c.category_id = p_dest;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('inspiration_part_categories.collapsed_into_home', v_n);

  -- ── Supplier recommendation tables (CASCADE FKs — a hard delete would have
  --    silently DESTROYED these; a merge moves them) ──────────────────────────
  DELETE FROM vendor_service_recommendations a
   WHERE a.tile_id = p_source
     AND EXISTS (SELECT 1 FROM vendor_service_recommendations b
                  WHERE b.tile_id = p_dest
                    AND b.service_code IS NOT DISTINCT FROM a.service_code);
  UPDATE vendor_service_recommendations SET tile_id = p_dest
   WHERE tile_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_service_recommendations.tile_id', v_n);

  DELETE FROM vendor_recommendation_optins a
   WHERE a.tile_id = p_source
     AND EXISTS (SELECT 1 FROM vendor_recommendation_optins b
                  WHERE b.tile_id = p_dest
                    AND b.vendor_profile_id = a.vendor_profile_id
                    AND b.service_code IS NOT DISTINCT FROM a.service_code);
  UPDATE vendor_recommendation_optins SET tile_id = p_dest
   WHERE tile_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_recommendation_optins.tile_id', v_n);

  DELETE FROM vendor_recommendation_feedback a
   WHERE a.tile_id = p_source
     AND EXISTS (SELECT 1 FROM vendor_recommendation_feedback b
                  WHERE b.tile_id = p_dest
                    AND b.vendor_profile_id = a.vendor_profile_id
                    AND b.feedback_type IS NOT DISTINCT FROM a.feedback_type
                    AND b.service_code IS NOT DISTINCT FROM a.service_code);
  UPDATE vendor_recommendation_feedback SET tile_id = p_dest
   WHERE tile_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_recommendation_feedback.tile_id', v_n);

  -- ── Category requests (SET NULL FKs — a hard delete blanked the link) ────
  UPDATE taxonomy_category_requests SET tile_id = p_dest
   WHERE tile_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('taxonomy_category_requests.tile_id', v_n);

  UPDATE taxonomy_category_request_drafts SET suggested_tile_id = p_dest
   WHERE suggested_tile_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('taxonomy_category_request_drafts.suggested_tile_id', v_n);

  -- ── The tombstone: the row STAYS so the old id still resolves ────────────
  UPDATE service_categories
     SET merged_into_category_id = p_dest,
         marketplace_hidden      = TRUE,
         status                  = 'retired',
         scope                   = 'merged',
         updated_at              = NOW()
   WHERE id = p_source;

  -- Anything already forwarding to the source now forwards straight to the
  -- destination, so no reader ever has to walk a chain.
  UPDATE service_categories
     SET merged_into_category_id = p_dest, updated_at = NOW()
   WHERE merged_into_category_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('service_categories.merged_into_rechained', v_n);

  RETURN jsonb_build_object(
    'source', p_source,
    'dest',   p_dest,
    'actor',  p_actor,
    'moved',  v_moved
  );
END $$;

COMMENT ON FUNCTION public.merge_service_category(TEXT, TEXT, UUID) IS
  'Fold category (tier-2 tile) A into B in ONE transaction. Moves every column '
  'that holds a tile id (registry: lib/tile-merge-holders.ts) — including the '
  'EVENT holders event_vendors.category_key, event_category_decisions.tile and '
  'event_bench_arrangement.tile — dropping the colliding source row first where '
  'a UNIQUE/PK includes the tile, then leaves A as a tombstone carrying '
  'merged_into_category_id so an old id still resolves. Returns per-holder '
  'counts. Admin-gated in the app; EXECUTE is NOT granted to anon or authenticated.';

REVOKE ALL ON FUNCTION public.merge_service_category(TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_service_category(TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.merge_service_category(TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.merge_service_category(TEXT, TEXT, UUID) TO service_role;

-- ── 2 · A writer naming an old tile lands on its replacement ────────────────
CREATE OR REPLACE FUNCTION public.event_vendors_forward_merged_tile()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fwd TEXT;
BEGIN
  IF NEW.category_key IS NOT NULL THEN
    SELECT merged_into_category_id INTO v_fwd
      FROM service_categories WHERE id = NEW.category_key;
    -- One hop is enough: merge_service_category re-chains at write time.
    IF v_fwd IS NOT NULL THEN
      NEW.category_key := v_fwd;
    END IF;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.event_vendors_forward_merged_tile() IS
  'BEFORE INSERT/UPDATE OF category_key on event_vendors: a category_key naming '
  'a merged tile is rewritten to its replacement, so a code constant that still '
  'names an old tile can never re-strand an event on a tombstone.';

DROP TRIGGER IF EXISTS event_vendors_forward_merged_tile ON public.event_vendors;
CREATE TRIGGER event_vendors_forward_merged_tile
  BEFORE INSERT OR UPDATE OF category_key ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.event_vendors_forward_merged_tile();
