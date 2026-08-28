-- ============================================================================
-- A TRADE CAN BE MERGED — and an old key still lands on its replacement.
--
-- Owner, 2026-08-28: "if ever a category added a new one, are we capable of
-- rerouting them, combining them to an existing, or renaming the category in
-- the future?"
--
-- Measured answer before this migration:
--   ✅ RENAME is safe already (`renameTaxonomyNode` writes label_en only).
--   ✅ MOVING a trade between branches ships (`remapCanonical`).
--   ✅ COMBINING TWO BRANCHES ships (`deleteTileWithDestination`).
--   🔴 COMBINING TWO TRADES did not exist. No leaf merge, no leaf delete.
--   🔴 Nothing forwarded an old trade key anywhere.
--
-- 🛑 A CORRECTION THIS MIGRATION IS THE ANSWER TO, recorded because the brief
--    that asked for it pointed at the wrong object, and the corpus repeated it:
--    `service_categories.merged_into_category_id` (added 2026-08-03, 0 writers,
--    0 readers, 0 values) is on a table that holds ONLY tier-1 folders (16) and
--    tier-2 tiles (78) — read out of prod, no tier 3 exists. TRADES live in
--    `canonical_service_taxonomy` (288 rows). That column can therefore forward
--    a BRANCH and can never forward a TRADE. Wiring it would have produced a
--    forwarder for the one case that already had a merge, and left the case
--    that has none. The trade forwarder is `canonical_service_taxonomy.merged_into`,
--    added below. The tile column is deliberately left alone — giving it a
--    writer means turning a shipped hard delete into a tombstone, which is its
--    own change with its own blast radius across 78 tiles.
--
-- 🚨 WHY THIS IS ONE SQL FUNCTION AND NOT A SEQUENCE OF WRITES IN THE ACTION.
--    TWELVE columns hold a trade key (enumerated out of prod BY THE COLUMN —
--    a remembered list had THREE), and SIX of them sit under a UNIQUE
--    constraint that includes the key:
--      vendor_coverages          UNIQUE (vendor_profile_id, canonical_service)
--      vendor_service_attributes PK     (vendor_profile_id, canonical_service)
--      event_vendor_preferences  PK     (event_id, canonical_service)
--      vendor_screen_name_seq..  PK     (city, canonical_service)
--      vendor_schedule_pool_cat. PK     (vendor_profile_id, category_key)
--      vendor_service_links      UNIQUE (vendor_service_id, linked_canonical_service)
--    So a plain `UPDATE … SET col = dest WHERE col = source` THROWS the moment
--    one owner holds both trades — which is the ordinary case for a merge, not
--    an edge case. Each of the six drops the colliding source row first, then
--    updates the rest. Doing that across twelve tables with compensating
--    rollback would leave shops half-moved on any failure; a single function is
--    ONE TRANSACTION, so the merge either lands whole or not at all.
--
-- 🔑 `vendor_profiles.services` is a TEXT[] — array surgery, not a scalar swap,
--    and a shop that listed BOTH trades ends up holding the destination twice,
--    so it is de-duplicated in the same statement.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1 · The forwarding pointer on the TRADE ─────────────────────────────────
ALTER TABLE public.canonical_service_taxonomy
  ADD COLUMN IF NOT EXISTS merged_into TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.canonical_service_taxonomy'::regclass
      AND conname  = 'canonical_service_taxonomy_merged_into_fkey'
  ) THEN
    ALTER TABLE public.canonical_service_taxonomy
      ADD CONSTRAINT canonical_service_taxonomy_merged_into_fkey
      FOREIGN KEY (merged_into)
      REFERENCES public.canonical_service_taxonomy(canonical_service)
      ON DELETE SET NULL;
  END IF;

  -- A trade may not forward to itself: that is an infinite hop for every reader.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.canonical_service_taxonomy'::regclass
      AND conname  = 'canonical_service_taxonomy_merged_into_not_self'
  ) THEN
    ALTER TABLE public.canonical_service_taxonomy
      ADD CONSTRAINT canonical_service_taxonomy_merged_into_not_self
      CHECK (merged_into IS NULL OR merged_into <> canonical_service);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS canonical_service_taxonomy_merged_into_idx
  ON public.canonical_service_taxonomy (merged_into)
  WHERE merged_into IS NOT NULL;

COMMENT ON COLUMN public.canonical_service_taxonomy.merged_into IS
  'Trade forwarding pointer. NULL = a live trade. Non-NULL = this trade was '
  'merged into that one: every stored key was moved by merge_canonical_service(), '
  'the row is kept ONLY so an old key still resolves (a printed QR, a bookmarked '
  '/explore?category= link, an emitted URL). Readers follow it via '
  'lib/service-merge-forward.ts. A merged trade also carries marketplace_hidden '
  '= TRUE so it leaves every picker. NEVER hard-delete a merged row — the '
  'forward dies with it and the old link goes back to an empty result.';

-- ── 2 · The merge itself — one transaction, twelve holders ──────────────────
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
  'Fold trade A into trade B in ONE transaction. Moves every one of the twelve '
  'columns that hold a canonical trade key (registry: lib/taxonomy-merge-holders.ts), '
  'dropping the colliding source row first on the six that sit under a UNIQUE '
  'constraint including the key, de-duplicating the vendor_profiles.services array, '
  'then leaving the source row as a tombstone carrying merged_into so an old key '
  'still resolves. Returns a per-holder count of rows moved. Admin-gated in the '
  'app (mergeCanonicalService); EXECUTE is NOT granted to anon or authenticated.';

REVOKE ALL ON FUNCTION public.merge_canonical_service(TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_canonical_service(TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.merge_canonical_service(TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.merge_canonical_service(TEXT, TEXT, UUID) TO service_role;
