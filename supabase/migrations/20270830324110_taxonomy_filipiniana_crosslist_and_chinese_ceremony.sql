-- ============================================================================
-- 20270830324110_taxonomy_filipiniana_crosslist_and_chinese_ceremony.sql
--
-- FOLLOW-UP to 20270830256997 (PR #3477). Two data fixes:
--
--   (1) THE THIRD DEAD TILE — `filipiniana_barongs`.
--       It reported 10 canonicals ONLY because `apps/web/lib/vendor-counts.ts`
--       hard-coded `map.set('filipiniana_barongs', […])`. ZERO rows in
--       `canonical_service_taxonomy` (and zero in TAXONOMY_MAP) named the tile
--       — verified against prod 2026-07-21: 0 rows with tile_id or
--       secondary_tiles naming it. So the marketplace advertised the tile while
--       `getCoverageTaxonomy()` pruned the branch: advertised to couples,
--       undeclarable by vendors — the exact bug class the reachability guard
--       exists to stop, and the override made the guard count it as healthy.
--       Fix: the cross-view rides `secondary_tiles`, like `accommodation` →
--       `catering` and every other cross-listing. The 10 canonicals KEEP their
--       primary attire tile — nothing is re-homed, no vendor is re-bucketed.
--       The TS override is deleted in the same PR.
--
--   (2) THE MISSING FAITH — `Chinese`.
--       20270830256997's header claims "one leaf per faith_vocab key" but
--       seeded 16 of the 17 ACTIVE keys (9 from 20261109000000 + 8 from
--       20261120000000). `Chinese` was the omission, despite already having 5
--       Tsinoy specialist leaves (20270310764093) and its own
--       `ceremony_type='chinese'`. The Tsinoy rite is held at a Taoist /
--       Buddhist temple or the clan ancestral hall — a real room, distinct
--       from `buddhist_temple_venue`.
--
-- ⚠ ADDITIVE ONLY, same rule as its predecessor: do NOT regenerate via
-- scripts/gen-taxonomy-seed.ts (it re-emits all nodes with
-- ON CONFLICT … DO UPDATE and would clobber live admin hand-edits).
-- The one UPDATE below is an idempotent array_append guarded by NOT ANY(...),
-- so it can never duplicate an entry or drop an admin-added one.
--
-- ⚠ `applicable_event_types` is NOT written here either (owner decision 3
-- remains deliberately unimplemented — a tile-grain write un-publishes live
-- vendors). NULL semantics: universal to vendors/admin/Explore, wedding-only
-- to the suggestion ranker — pinned in apps/web/lib/taxonomy-event-scope.ts.
-- ============================================================================

BEGIN;

-- ── 1. Chinese ceremony room — schema stub ────────────────────────────────
INSERT INTO public.canonical_service_schemas
  (canonical_service, schema_version, display_name_en, shared_attribute_groups,
   category_specific_attributes, filter_facets, required_for_visibility, ranking_signal_weights)
VALUES
  ('chinese_temple_venue', 1, 'Chinese Temple / Ancestral Hall', '{}', '{}', '[]', '{}', '{}')
ON CONFLICT (canonical_service) DO NOTHING;

-- ── 2. Chinese ceremony room — taxonomy placement ─────────────────────────
-- faith='Chinese' matches the 4 faith-tagged Tsinoy specialist leaves from
-- 20270310764093. passesFaithFilter is INCLUDE-only, so this routes to Chinese
-- couples (primary or secondary rite) and to nobody else; the faith-NULL
-- `ceremony_venue_booking` anchor still guarantees the tile is never empty.
INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan,
   is_rental, is_tradition, marketplace_hidden, secondary_tiles)
VALUES
  ('chinese_temple_venue', 'venue', 'ceremony_venue', 'V1.1.1', 'Chinese', TRUE, FALSE, FALSE, FALSE, FALSE, '{}')
ON CONFLICT (canonical_service) DO NOTHING;

-- ── 3. Filipiniana & Barongs cross-listing ────────────────────────────────
-- Exactly the 10 ids in FILIPINIANA_BARONG_CANONICALS (apps/web/lib/taxonomy.ts).
-- Guarded so re-running is a no-op and an admin-added secondary tile survives.
UPDATE public.canonical_service_taxonomy
   SET secondary_tiles = array_append(COALESCE(secondary_tiles, '{}'), 'filipiniana_barongs'),
       updated_at = now()
 WHERE canonical_service IN (
         'filipiniana_terno', 'filipiniana_maria_clara', 'filipiniana_balintawak',
         'barong_tagalog_custom', 'barong_tagalog_rental',
         'maranao_wedding_attire', 'tausug_wedding_attire', 'yakan_wedding_attire',
         'muslim_modest_bridal', 'inc_modest_bridal')
   AND NOT ('filipiniana_barongs' = ANY(COALESCE(secondary_tiles, '{}')));

-- ── 4. Fail loud ──────────────────────────────────────────────────────────
DO $$
DECLARE
  n INT;
  bad TEXT;
  fb_ids TEXT[] := ARRAY[
    'filipiniana_terno', 'filipiniana_maria_clara', 'filipiniana_balintawak',
    'barong_tagalog_custom', 'barong_tagalog_rental',
    'maranao_wedding_attire', 'tausug_wedding_attire', 'yakan_wedding_attire',
    'muslim_modest_bridal', 'inc_modest_bridal'
  ];
BEGIN
  -- (a) The third dead tile now resolves from DATA, not from a TS override.
  SELECT count(*) INTO n FROM public.canonical_service_taxonomy
   WHERE 'filipiniana_barongs' = ANY(COALESCE(secondary_tiles, '{}'))
     AND marketplace_hidden = FALSE;
  IF n < 1 THEN RAISE EXCEPTION 'filipiniana_barongs still resolves to zero visible canonicals'; END IF;

  -- (b) All 10 cross-listed, and each exactly once.
  SELECT string_agg(canonical_service, ', ') INTO bad
    FROM public.canonical_service_taxonomy
   WHERE canonical_service = ANY(fb_ids)
     AND NOT ('filipiniana_barongs' = ANY(COALESCE(secondary_tiles, '{}')));
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'filipiniana cross-list missing on: %', bad; END IF;

  SELECT string_agg(canonical_service, ', ') INTO bad
    FROM public.canonical_service_taxonomy
   WHERE canonical_service = ANY(fb_ids)
     AND (SELECT count(*) FROM unnest(secondary_tiles) t WHERE t = 'filipiniana_barongs') > 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'duplicate filipiniana_barongs entry on: %', bad; END IF;

  -- (c) Nothing was re-homed — the 10 keep their primary attire tile.
  SELECT string_agg(canonical_service || '→' || COALESCE(tile_id, 'NULL'), ', ') INTO bad
    FROM public.canonical_service_taxonomy
   WHERE canonical_service = ANY(fb_ids)
     AND tile_id NOT IN ('brides_attire', 'grooms_attire');
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'attire leaves lost their primary tile: %', bad; END IF;

  -- (d) The Chinese room exists, is visible, and closes faith parity: every
  --     ACTIVE faith_vocab key now has ≥1 ceremony_venue leaf.
  PERFORM 1 FROM public.canonical_service_taxonomy
   WHERE canonical_service = 'chinese_temple_venue'
     AND tile_id = 'ceremony_venue' AND faith = 'Chinese' AND marketplace_hidden = FALSE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chinese_temple_venue missing or mis-tagged'; END IF;

  SELECT string_agg(v.faith_key, ', ') INTO bad
    FROM public.faith_vocab v
   WHERE v.status = 'active'
     AND NOT EXISTS (
       SELECT 1 FROM public.canonical_service_taxonomy t
        WHERE t.tile_id = 'ceremony_venue' AND t.faith = v.faith_key);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'active faith keys with no ceremony room: %', bad; END IF;

  -- (e) This migration writes no event-type scope (owner decision 3 out of scope).
  PERFORM 1 FROM public.canonical_service_taxonomy
   WHERE canonical_service = 'chinese_temple_venue' AND applicable_event_types IS NOT NULL;
  IF FOUND THEN RAISE EXCEPTION 'chinese_temple_venue must stay event-type universal'; END IF;

  -- (f) Blank-label guard, scoped to what this migration inserted.
  PERFORM 1 FROM public.canonical_service_schemas
   WHERE canonical_service = 'chinese_temple_venue'
     AND (display_name_en IS NULL OR btrim(display_name_en) = '');
  IF FOUND THEN RAISE EXCEPTION 'chinese_temple_venue has a blank display_name_en'; END IF;
END $$;

COMMIT;
