-- ============================================================================
-- 20270830256997_taxonomy_ceremony_reception_venue_leaves.sql
--
-- DEAD-TILE DATA FIX — `ceremony_venue` (0 canonicals) and the semantically
-- broken `reception` tile (1 canonical, and it was `accommodation`/lodging).
-- Owner-approved 2026-07-21 ("yes"), scoped by the owner correction:
--
--   "ceremony venue are the religious locations for different religions.
--    if the venue is same as reception venue, then it must be identified."
--
-- The FIRST half is implemented here: ceremony_venue is seeded with places of
-- worship, one leaf per `faith_vocab` key, plus a faith-NULL anchor. It is NOT
-- a generic venue list. The SECOND half ("same venue serves both") is a
-- MODELLING change, not a taxonomy change — it is written up as a follow-up in
-- the PR body and deliberately not forced in here.
--
-- Sources: Taxonomy_Expo_Gap_Verdict_2026-07-21.md §2/§5.
-- Parity entries land in apps/web/lib/taxonomy.ts in the SAME PR — both halves
-- must ship together or the dashboard category search (code-backed) and the
-- marketplace / vendor coverage picker (DB-backed) disagree.
--
-- ⚠ ADDITIVE ONLY. Do NOT regenerate the seed via scripts/gen-taxonomy-seed.ts:
-- it re-emits all 84 nodes + 244 mappings with ON CONFLICT … DO UPDATE SET on
-- label_en / label_short / slug / sort_order and canonical marketplace_hidden,
-- which would clobber live admin hand-edits in prod.
--
-- ⚠ `applicable_event_types` is deliberately OMITTED from both column lists.
-- Owner decision 3 ("allocate services on what event they cover") is NOT
-- implemented here: a tile-grain write is read live by /explore, the Shortlist
-- and category-search and would un-publish every vendor under the tile for the
-- excluded event types, with no vendor action. NULL = universal = fail-open.
-- The real target of decision 3 is the separate live defect where
-- vendor_profiles.event_types is stuck at ['wedding'].
--
-- Idempotent (ON CONFLICT DO NOTHING). No ALTER TYPE — vendor_services.category
-- is TEXT, and `venue` / `religious_venue` already exist on vendor_category.
-- ============================================================================

BEGIN;

-- ── 1. Schema stubs (vendor onboarding + admin tree presence) ──────────────
-- display_name_en on every row: getCoverageTaxonomy falls back to humanize()
-- only when it is blank. display_name_tl / _ceb stay NULL like 228 of the 243
-- existing rows.
INSERT INTO public.canonical_service_schemas
  (canonical_service, schema_version, display_name_en, shared_attribute_groups,
   category_specific_attributes, filter_facets, required_for_visibility, ranking_signal_weights)
VALUES
  -- Ceremony — religious locations (+ the faith-NULL anchor and civil)
  ('ceremony_venue_booking',   1, 'Ceremony Venue',                      '{}', '{}', '[]', '{}', '{}'),
  ('catholic_church_venue',    1, 'Catholic Church / Chapel',            '{}', '{}', '[]', '{}', '{}'),
  ('christian_church_venue',   1, 'Christian Church',                    '{}', '{}', '[]', '{}', '{}'),
  ('born_again_church_venue',  1, 'Born Again Church',                   '{}', '{}', '[]', '{}', '{}'),
  ('inc_kapilya_venue',        1, 'Iglesia ni Cristo Kapilya',           '{}', '{}', '[]', '{}', '{}'),
  ('aglipayan_church_venue',   1, 'Aglipayan Church (IFI)',              '{}', '{}', '[]', '{}', '{}'),
  ('orthodox_church_venue',    1, 'Orthodox Church',                     '{}', '{}', '[]', '{}', '{}'),
  ('sda_church_venue',         1, 'Seventh-day Adventist Church',        '{}', '{}', '[]', '{}', '{}'),
  ('kingdom_hall_venue',       1, 'Kingdom Hall',                        '{}', '{}', '[]', '{}', '{}'),
  ('lds_temple_venue',         1, 'LDS Temple / Meetinghouse',           '{}', '{}', '[]', '{}', '{}'),
  ('mosque_venue',             1, 'Mosque',                              '{}', '{}', '[]', '{}', '{}'),
  ('synagogue_venue',          1, 'Synagogue',                           '{}', '{}', '[]', '{}', '{}'),
  ('hindu_temple_venue',       1, 'Hindu Temple / Mandir',               '{}', '{}', '[]', '{}', '{}'),
  ('gurdwara_venue',           1, 'Gurdwara',                            '{}', '{}', '[]', '{}', '{}'),
  ('buddhist_temple_venue',    1, 'Buddhist Temple',                     '{}', '{}', '[]', '{}', '{}'),
  ('cultural_ceremony_site',   1, 'Cultural / Ancestral Ceremony Site',  '{}', '{}', '[]', '{}', '{}'),
  ('civil_ceremony_venue',     1, 'Civil Ceremony Venue',                '{}', '{}', '[]', '{}', '{}'),
  -- Reception — the hall family that had to mis-tag itself as `accommodation`
  ('reception_venue',          1, 'Reception Venue',                     '{}', '{}', '[]', '{}', '{}'),
  ('function_hall',            1, 'Function Hall',                       '{}', '{}', '[]', '{}', '{}'),
  ('events_place',             1, 'Events Place',                        '{}', '{}', '[]', '{}', '{}'),
  ('hotel_ballroom',           1, 'Hotel Ballroom',                      '{}', '{}', '[]', '{}', '{}'),
  ('garden_reception_venue',   1, 'Garden Reception Venue',              '{}', '{}', '[]', '{}', '{}'),
  ('resort_reception_venue',   1, 'Resort Reception Venue',              '{}', '{}', '[]', '{}', '{}')
ON CONFLICT (canonical_service) DO NOTHING;

-- ── 2. Taxonomy placements ─────────────────────────────────────────────────
-- Faith tagging note: this WIDENS the de-faith carve-out (documented as
-- "officiants / seminars / counseling") to places of worship. Justified
-- because a mosque's faith is intrinsic to the building, not a preference
-- imposed on a neutral service. passesFaithFilter is INCLUDE-only, so the
-- faith-NULL `ceremony_venue_booking` anchor is what guarantees the tile can
-- never present as empty — to an anonymous visitor, to a non-wedding event
-- (empty faith set), or to a couple whose ceremony_type has no seeded room.
INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan,
   is_rental, is_tradition, marketplace_hidden, secondary_tiles)
VALUES
  ('ceremony_venue_booking',  'venue', 'ceremony_venue', 'V1.1 base', NULL,        FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('catholic_church_venue',   'venue', 'ceremony_venue', 'V1.1 base', 'Catholic',  FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('christian_church_venue',  'venue', 'ceremony_venue', 'V1.2',      'Christian', FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('born_again_church_venue', 'venue', 'ceremony_venue', 'V1.2',      'Born Again',FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('inc_kapilya_venue',       'venue', 'ceremony_venue', 'V1.3',      'INC',       TRUE,  FALSE, FALSE, FALSE, FALSE, '{}'),
  ('aglipayan_church_venue',  'venue', 'ceremony_venue', 'V1.2',      'Aglipayan', TRUE,  FALSE, FALSE, FALSE, FALSE, '{}'),
  ('orthodox_church_venue',   'venue', 'ceremony_venue', 'V1.2',      'Orthodox',  FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('sda_church_venue',        'venue', 'ceremony_venue', 'V1.2',      'SDA',       FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('kingdom_hall_venue',      'venue', 'ceremony_venue', 'V1.2',      'JW',        FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('lds_temple_venue',        'venue', 'ceremony_venue', 'V1.2',      'LDS',       FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('mosque_venue',            'venue', 'ceremony_venue', 'V1.4',      'Muslim',    FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('synagogue_venue',         'venue', 'ceremony_venue', 'V1.2',      'Jewish',    FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('hindu_temple_venue',      'venue', 'ceremony_venue', 'V1.2',      'Hindu',     FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('gurdwara_venue',          'venue', 'ceremony_venue', 'V1.2',      'Sikh',      FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('buddhist_temple_venue',   'venue', 'ceremony_venue', 'V1.2',      'Buddhist',  FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('cultural_ceremony_site',  'venue', 'ceremony_venue', 'V1.5+',     'Cultural',  TRUE,  FALSE, FALSE, FALSE, FALSE, '{}'),
  ('civil_ceremony_venue',    'venue', 'ceremony_venue', 'V1.1 base', 'Civil',     FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  -- Reception. `accommodation` is NOT touched — it keeps tile_id='reception'
  -- and secondary_tiles={catering} (hotel room-block case, owner 2026-05-22).
  -- No new cross-listing into `catering` here: that is its own owner call.
  ('reception_venue',         'venue', 'reception',      'V1.1 base', NULL, FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('function_hall',           'venue', 'reception',      'V1.1 base', NULL, TRUE,  FALSE, FALSE, FALSE, FALSE, '{}'),
  ('events_place',            'venue', 'reception',      'V1.1 base', NULL, TRUE,  FALSE, FALSE, FALSE, FALSE, '{}'),
  ('hotel_ballroom',          'venue', 'reception',      'V1.1 base', NULL, FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('garden_reception_venue',  'venue', 'reception',      'V1.1 base', NULL, FALSE, FALSE, FALSE, FALSE, FALSE, '{}'),
  ('resort_reception_venue',  'venue', 'reception',      'V1.1 base', NULL, FALSE, FALSE, FALSE, FALSE, FALSE, '{}')
ON CONFLICT (canonical_service) DO NOTHING;

-- ── 3. Fail loud ───────────────────────────────────────────────────────────
DO $$
DECLARE
  n INT;
  bad TEXT;
BEGIN
  -- (a) The two target tiles must now stock a visible shelf.
  SELECT count(*) INTO n FROM public.canonical_service_taxonomy
   WHERE tile_id = 'ceremony_venue' AND marketplace_hidden = FALSE;
  IF n < 1 THEN RAISE EXCEPTION 'ceremony_venue still resolves to zero visible canonicals'; END IF;

  SELECT count(*) INTO n FROM public.canonical_service_taxonomy
   WHERE tile_id = 'reception' AND marketplace_hidden = FALSE;
  IF n < 2 THEN RAISE EXCEPTION 'reception still resolves to fewer than 2 visible canonicals (was 1: accommodation)'; END IF;

  -- (b) The faith-NULL anchor MUST exist, or the include-only faith filter can
  --     empty the tile for anyone whose rite has no seeded room.
  PERFORM 1 FROM public.canonical_service_taxonomy
   WHERE canonical_service = 'ceremony_venue_booking'
     AND tile_id = 'ceremony_venue' AND faith IS NULL AND marketplace_hidden = FALSE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ceremony_venue_booking anchor missing or faith-tagged'; END IF;

  -- (c) accommodation is untouched.
  PERFORM 1 FROM public.canonical_service_taxonomy
   WHERE canonical_service = 'accommodation'
     AND tile_id = 'reception' AND 'catering' = ANY(secondary_tiles);
  IF NOT FOUND THEN RAISE EXCEPTION 'accommodation lost its reception tile or catering cross-list'; END IF;

  -- (d) Every new row has a real English display name.
  SELECT string_agg(s.canonical_service, ', ') INTO bad
    FROM public.canonical_service_schemas s
    JOIN public.canonical_service_taxonomy t USING (canonical_service)
   WHERE t.tile_id IN ('ceremony_venue', 'reception')
     AND (s.display_name_en IS NULL OR btrim(s.display_name_en) = '');
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'blank display_name_en: %', bad; END IF;

  -- (e) NONE of the new rows may carry an event-type scope (owner decision 3
  --     is explicitly out of scope — writing it here un-publishes vendors).
  SELECT string_agg(canonical_service, ', ') INTO bad
    FROM public.canonical_service_taxonomy
   WHERE tile_id IN ('ceremony_venue', 'reception')
     AND applicable_event_types IS NOT NULL
     AND cardinality(applicable_event_types) > 0;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'new venue rows must stay event-type universal: %', bad; END IF;

  -- (f) Every faith used must be a live faith_vocab key.
  SELECT string_agg(DISTINCT t.faith, ', ') INTO bad
    FROM public.canonical_service_taxonomy t
   WHERE t.tile_id = 'ceremony_venue' AND t.faith IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.faith_vocab v
        WHERE v.faith_key = t.faith AND v.status = 'active');
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'unknown or inactive faith keys: %', bad; END IF;
END $$;

COMMIT;
