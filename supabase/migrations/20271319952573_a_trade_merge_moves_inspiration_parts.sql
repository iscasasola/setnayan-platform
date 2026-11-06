-- A TRADE MERGE MOVES INSPIRATION PARTS — 2026-11-06.
--
-- `merge_canonical_service()` (20271176753752, August) moves the twelve columns
-- that held a trade key THEN. Two more exist now, found by re-sweeping prod by
-- the column before applying the owner's approved 2026-11-06 taxonomy merge:
--
--   · inspiration_part_services.canonical_service — shipped 20271291224109,
--     RESTRICT FK to canonical_service_taxonomy, PK (slot_key, canonical_service).
--     2,145 prod rows sit on trades the approved map folds away.
--   · taxonomy_category_requests.mapped_to_canonical — 0 prod rows today.
--
-- Ruled out, with the reason recorded in lib/taxonomy-merge-holders.ts:
--   · canonical_service_aliases.canonical_service — its own header says the
--     application resolves it through the merge forward AT READ TIME.
--
-- This is the August function body verbatim plus the two moves; nothing else
-- changes (validation, tombstone, re-chain, grants).

CREATE OR REPLACE FUNCTION public.merge_canonical_service(
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
  v_moved JSONB := '{}'::jsonb;
  v_n     INT;
BEGIN
  IF p_source IS NULL OR p_dest IS NULL OR btrim(p_source) = '' OR btrim(p_dest) = '' THEN
    RAISE EXCEPTION 'merge_canonical_service: source and destination are both required';
  END IF;
  IF p_source = p_dest THEN
    RAISE EXCEPTION 'merge_canonical_service: a trade cannot be merged into itself';
  END IF;

  -- Both ends must be real trades, and the destination must be LIVE. Merging
  -- into an already-merged trade would build a chain the readers have to walk;
  -- point at the end of the chain instead.
  IF NOT EXISTS (SELECT 1 FROM canonical_service_taxonomy WHERE canonical_service = p_source) THEN
    RAISE EXCEPTION 'merge_canonical_service: source trade % does not exist', p_source;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM canonical_service_taxonomy WHERE canonical_service = p_dest) THEN
    RAISE EXCEPTION 'merge_canonical_service: destination trade % does not exist', p_dest;
  END IF;
  IF EXISTS (SELECT 1 FROM canonical_service_taxonomy
              WHERE canonical_service = p_dest AND merged_into IS NOT NULL) THEN
    RAISE EXCEPTION
      'merge_canonical_service: destination % was itself merged away — merge into its replacement instead',
      p_dest;
  END IF;
  IF EXISTS (SELECT 1 FROM canonical_service_taxonomy
              WHERE canonical_service = p_source AND merged_into IS NOT NULL) THEN
    RAISE EXCEPTION 'merge_canonical_service: source % has already been merged', p_source;
  END IF;

  -- ── The six holders under a UNIQUE constraint that includes the key ───────
  -- Each drops the colliding SOURCE row (the owner already holds the
  -- destination) and then moves the rest. Order matters only in that the
  -- delete must precede the update on the SAME table.

  DELETE FROM vendor_coverages a
   WHERE a.canonical_service = p_source
     AND EXISTS (SELECT 1 FROM vendor_coverages b
                  WHERE b.vendor_profile_id = a.vendor_profile_id
                    AND b.canonical_service = p_dest);
  UPDATE vendor_coverages SET canonical_service = p_dest
   WHERE canonical_service = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_coverages.canonical_service', v_n);

  DELETE FROM vendor_service_attributes a
   WHERE a.canonical_service = p_source
     AND EXISTS (SELECT 1 FROM vendor_service_attributes b
                  WHERE b.vendor_profile_id = a.vendor_profile_id
                    AND b.canonical_service = p_dest);
  UPDATE vendor_service_attributes SET canonical_service = p_dest
   WHERE canonical_service = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_service_attributes.canonical_service', v_n);

  DELETE FROM event_vendor_preferences a
   WHERE a.canonical_service = p_source
     AND EXISTS (SELECT 1 FROM event_vendor_preferences b
                  WHERE b.event_id = a.event_id
                    AND b.canonical_service = p_dest);
  UPDATE event_vendor_preferences SET canonical_service = p_dest
   WHERE canonical_service = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('event_vendor_preferences.canonical_service', v_n);

  DELETE FROM vendor_screen_name_sequences a
   WHERE a.canonical_service = p_source
     AND EXISTS (SELECT 1 FROM vendor_screen_name_sequences b
                  WHERE b.city = a.city AND b.canonical_service = p_dest);
  UPDATE vendor_screen_name_sequences SET canonical_service = p_dest
   WHERE canonical_service = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_screen_name_sequences.canonical_service', v_n);

  DELETE FROM vendor_schedule_pool_categories a
   WHERE a.category_key = p_source
     AND EXISTS (SELECT 1 FROM vendor_schedule_pool_categories b
                  WHERE b.vendor_profile_id = a.vendor_profile_id
                    AND b.category_key = p_dest);
  UPDATE vendor_schedule_pool_categories SET category_key = p_dest
   WHERE category_key = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_schedule_pool_categories.category_key', v_n);

  DELETE FROM vendor_service_links a
   WHERE a.linked_canonical_service = p_source
     AND EXISTS (SELECT 1 FROM vendor_service_links b
                  WHERE b.vendor_service_id = a.vendor_service_id
                    AND b.linked_canonical_service = p_dest);
  UPDATE vendor_service_links SET linked_canonical_service = p_dest
   WHERE linked_canonical_service = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_service_links.linked_canonical_service', v_n);

  -- ── The plain scalar holders ─────────────────────────────────────────────
  UPDATE vendor_services SET category = p_dest WHERE category = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_services.category', v_n);

  UPDATE vendor_packages SET primary_canonical_service = p_dest
   WHERE primary_canonical_service = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_packages.primary_canonical_service', v_n);

  UPDATE vendor_package_items SET canonical_service = p_dest
   WHERE canonical_service = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_package_items.canonical_service', v_n);

  UPDATE budget_allocation_decisions SET canonical_service = p_dest
   WHERE canonical_service = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('budget_allocation_decisions.canonical_service', v_n);

  UPDATE thread_service_interests SET category_key = p_dest
   WHERE category_key = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('thread_service_interests.category_key', v_n);

  -- ── The ARRAY holder — swap, then DEDUPE ─────────────────────────────────
  -- A shop that listed both trades would otherwise hold the destination twice,
  -- which shows as a duplicate chip on its own public page. array_agg(DISTINCT)
  -- collapses it; the sort is a side effect of DISTINCT and is harmless (this
  -- column is a membership set, read with .contains / .overlaps, never in order).
  UPDATE vendor_profiles p
     SET services = sub.new_services
    FROM (
      SELECT vp.vendor_profile_id AS vid,
             COALESCE((
               SELECT array_agg(DISTINCT CASE WHEN u.s = p_source THEN p_dest ELSE u.s END
                                ORDER BY CASE WHEN u.s = p_source THEN p_dest ELSE u.s END)
                 FROM unnest(vp.services) AS u(s)
             ), ARRAY[]::text[]) AS new_services
        FROM vendor_profiles vp
       WHERE vp.services @> ARRAY[p_source]::text[]
    ) AS sub
   WHERE p.vendor_profile_id = sub.vid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('vendor_profiles.services', v_n);

  -- ── Added 2026-11-06 (20271319952573): two holders the August list missed ──
  -- inspiration_part_services shipped AFTER this function (20271291224109) and
  -- holds a RESTRICT FK to canonical_service_taxonomy — 2,145 prod rows sat on
  -- trades the approved 2026-11-06 map folds away. Not moving them left an
  -- inspiration part crediting a trade no picker shows. PK (slot_key,
  -- canonical_service) ⇒ drop the colliding source row first.
  DELETE FROM inspiration_part_services a
   WHERE a.canonical_service = p_source
     AND EXISTS (SELECT 1 FROM inspiration_part_services b
                  WHERE b.slot_key = a.slot_key
                    AND b.canonical_service = p_dest);
  UPDATE inspiration_part_services SET canonical_service = p_dest
   WHERE canonical_service = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('inspiration_part_services.canonical_service', v_n);

  -- A supplier's "add my category" request the admin resolved to a trade.
  UPDATE taxonomy_category_requests SET mapped_to_canonical = p_dest
   WHERE mapped_to_canonical = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('taxonomy_category_requests.mapped_to_canonical', v_n);

  -- ── The tombstone: the row STAYS so the old key still resolves ───────────
  UPDATE canonical_service_taxonomy
     SET merged_into        = p_dest,
         marketplace_hidden = TRUE,
         updated_at         = NOW()
   WHERE canonical_service = p_source;

  -- Anything that was already forwarding to the source now forwards straight
  -- to the destination, so no reader ever has to walk a chain.
  UPDATE canonical_service_taxonomy
     SET merged_into = p_dest, updated_at = NOW()
   WHERE merged_into = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_moved := v_moved || jsonb_build_object('canonical_service_taxonomy.merged_into_rechained', v_n);

  RETURN jsonb_build_object(
    'source', p_source,
    'dest',   p_dest,
    'actor',  p_actor,
    'moved',  v_moved
  );
END $$;

COMMENT ON FUNCTION public.merge_canonical_service(TEXT, TEXT, UUID) IS
  'Fold trade A into trade B in ONE transaction. Moves every one of the fourteen '
  'columns that hold a canonical trade key (registry: lib/taxonomy-merge-holders.ts), '
  'dropping the colliding source row first on the seven that sit under a UNIQUE '
  'constraint including the key, de-duplicating the vendor_profiles.services array, '
  'then leaving the source row as a tombstone carrying merged_into so an old key '
  'still resolves. Returns a per-holder count of rows moved. Admin-gated in the '
  'app (mergeCanonicalService); EXECUTE is NOT granted to anon or authenticated.';

REVOKE ALL ON FUNCTION public.merge_canonical_service(TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_canonical_service(TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.merge_canonical_service(TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.merge_canonical_service(TEXT, TEXT, UUID) TO service_role;

