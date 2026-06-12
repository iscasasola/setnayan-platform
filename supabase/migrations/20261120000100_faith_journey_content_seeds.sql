-- ============================================================================
-- 20261120000100_faith_journey_content_seeds.sql
--
-- Content seeds closing every journey gap from the completeness audit + the
-- owner-approved catalog seeds (2026-06-11). Pattern per canonical = a
-- canonical_service_schemas stub (vendor onboarding + admin tree) + a
-- canonical_service_taxonomy placement (marketplace bucketing, faith tag,
-- event scope). lib/taxonomy.ts gets parity entries in the SAME PR (fallback
-- + typecheck source). Officiants follow the born_again_pastor shape:
-- folder=venue, marketplace_hidden, phase V1.2. Visible specialists follow
-- the muslim_modest_bridal shape: phase V1.1.1 (live → "Recruiting" tiles).
-- Idempotent (ON CONFLICT DO NOTHING).
-- ============================================================================

BEGIN;

-- 1. New tile: Trophies & Awards under Prints — scoped to non-wedding events
-- (invisible to wedding couples now; live the day tournament/corporate/
-- graduation launch).
INSERT INTO public.service_categories (id, parent_id, tier, label_en, slug, sort_order, applicable_event_types)
VALUES ('trophies_awards', 'prints', 2, 'Trophies & Awards', 'trophies-awards', 51,
        ARRAY['tournament','corporate','graduation']::text[])
ON CONFLICT (id) DO NOTHING;

-- 2. Schema stubs (vendor-onboarding + admin tree presence).
INSERT INTO public.canonical_service_schemas
  (canonical_service, schema_version, display_name_en, shared_attribute_groups,
   category_specific_attributes, filter_facets, required_for_visibility, ranking_signal_weights)
VALUES
  -- Officiants (one per new faith + the Jewish dead-end fix)
  ('jewish_rabbi',            1, 'Rabbi',                          '{}', '{}', '[]', '{}', '{}'),
  ('aglipayan_priest',        1, 'Aglipayan Priest (IFI)',         '{}', '{}', '[]', '{}', '{}'),
  ('lds_officiant',           1, 'LDS Bishop / Officiant',         '{}', '{}', '[]', '{}', '{}'),
  ('sda_pastor',              1, 'Adventist Pastor',               '{}', '{}', '[]', '{}', '{}'),
  ('jw_elder',                1, 'Kingdom Hall Elder',             '{}', '{}', '[]', '{}', '{}'),
  ('hindu_pandit',            1, 'Hindu Pandit / Priest',          '{}', '{}', '[]', '{}', '{}'),
  ('sikh_granthi',            1, 'Sikh Granthi',                   '{}', '{}', '[]', '{}', '{}'),
  ('buddhist_monk',           1, 'Buddhist Monk / Officiant',      '{}', '{}', '[]', '{}', '{}'),
  ('orthodox_priest',         1, 'Orthodox Priest',                '{}', '{}', '[]', '{}', '{}'),
  -- Counseling (the Christian gap)
  ('christian_premarital_counseling', 1, 'Christian Pre-Marital Counseling', '{}', '{}', '[]', '{}', '{}'),
  -- Chinese (tsinoy) journey
  ('tea_ceremony_master',     1, 'Chinese Tea Ceremony Master',    '{}', '{}', '[]', '{}', '{}'),
  ('qipao_cheongsam_attire',  1, 'Qipao / Cheongsam Bridal',       '{}', '{}', '[]', '{}', '{}'),
  ('double_happiness_decor',  1, 'Double Happiness Decor',         '{}', '{}', '[]', '{}', '{}'),
  -- Jewish visible
  ('chuppah_rental',          1, 'Chuppah Rental & Styling',       '{}', '{}', '[]', '{}', '{}'),
  -- Hindu / Sikh visible
  ('sari_lehenga_bridal',     1, 'Sari / Lehenga Bridal',          '{}', '{}', '[]', '{}', '{}'),
  ('sherwani_groom',          1, 'Sherwani / Groom Attire',        '{}', '{}', '[]', '{}', '{}'),
  ('mehndi_artist',           1, 'Mehndi Artist (bridal henna)',   '{}', '{}', '[]', '{}', '{}'),
  ('mandap_decor',            1, 'Mandap Design & Decor',          '{}', '{}', '[]', '{}', '{}'),
  -- Muslim groom-side fix
  ('muslim_groom_attire',     1, 'Modest Muslim Groom Attire',     '{}', '{}', '[]', '{}', '{}'),
  ('maranao_groom_attire',    1, 'Maranao Men''s Wedding Attire',  '{}', '{}', '[]', '{}', '{}'),
  -- Debut seeds (event-scoped)
  ('debutante_gown',          1, 'Debutante Ball Gown',            '{}', '{}', '[]', '{}', '{}'),
  ('eighteen_roses_attire',   1, '18 Roses / Escort Attire',       '{}', '{}', '[]', '{}', '{}'),
  -- Trophies & Awards seeds
  ('trophy_supplier',         1, 'Trophies & Awards Supplier',     '{}', '{}', '[]', '{}', '{}'),
  ('medals_plaques',          1, 'Medals & Plaques',               '{}', '{}', '[]', '{}', '{}')
ON CONFLICT (canonical_service) DO NOTHING;

-- 3. Taxonomy placements.
INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan, is_rental,
   is_tradition, marketplace_hidden, secondary_tiles, applicable_event_types)
VALUES
  -- Officiants: hidden, faith-tagged (auto-resolve/paperwork surfaces)
  ('jewish_rabbi',      'venue', NULL, 'V1.2', 'Jewish',    FALSE, FALSE, FALSE, FALSE, TRUE, '{}', NULL),
  ('aglipayan_priest',  'venue', NULL, 'V1.2', 'Aglipayan', TRUE,  FALSE, FALSE, FALSE, TRUE, '{}', NULL),
  ('lds_officiant',     'venue', NULL, 'V1.2', 'LDS',       FALSE, FALSE, FALSE, FALSE, TRUE, '{}', NULL),
  ('sda_pastor',        'venue', NULL, 'V1.2', 'SDA',       FALSE, FALSE, FALSE, FALSE, TRUE, '{}', NULL),
  ('jw_elder',          'venue', NULL, 'V1.2', 'JW',        FALSE, FALSE, FALSE, FALSE, TRUE, '{}', NULL),
  ('hindu_pandit',      'venue', NULL, 'V1.2', 'Hindu',     FALSE, FALSE, FALSE, FALSE, TRUE, '{}', NULL),
  ('sikh_granthi',      'venue', NULL, 'V1.2', 'Sikh',      FALSE, FALSE, FALSE, FALSE, TRUE, '{}', NULL),
  ('buddhist_monk',     'venue', NULL, 'V1.2', 'Buddhist',  FALSE, FALSE, FALSE, FALSE, TRUE, '{}', NULL),
  ('orthodox_priest',   'venue', NULL, 'V1.2', 'Orthodox',  FALSE, FALSE, FALSE, FALSE, TRUE, '{}', NULL),
  ('christian_premarital_counseling', 'venue', NULL, 'V1.2', 'Christian', FALSE, FALSE, FALSE, FALSE, TRUE, '{}', NULL),
  -- Chinese journey (visible, live phase)
  ('tea_ceremony_master',    'program', 'host_mc',           'V1.1.1', 'Chinese', TRUE,  FALSE, FALSE, TRUE,  FALSE, '{}', NULL),
  ('qipao_cheongsam_attire', 'look',    'brides_attire',     'V1.1.1', 'Chinese', FALSE, FALSE, FALSE, TRUE,  FALSE, '{}', NULL),
  ('double_happiness_decor', 'design',  'stylist_decorator', 'V1.1.1', 'Chinese', FALSE, FALSE, FALSE, TRUE,  FALSE, '{}', NULL),
  -- Jewish visible
  ('chuppah_rental',         'design',  'stylist_decorator', 'V1.1.1', 'Jewish',  FALSE, FALSE, TRUE,  TRUE,  FALSE, '{}', NULL),
  -- Hindu visible
  ('sari_lehenga_bridal',    'look',    'brides_attire',     'V1.1.1', 'Hindu',   FALSE, FALSE, FALSE, TRUE,  FALSE, '{}', NULL),
  ('sherwani_groom',         'look',    'grooms_attire',     'V1.1.1', 'Hindu',   FALSE, FALSE, FALSE, TRUE,  FALSE, '{}', NULL),
  ('mehndi_artist',          'booths',  'henna_tattoo',      'V1.1.1', 'Hindu',   FALSE, FALSE, FALSE, TRUE,  FALSE, '{}', NULL),
  ('mandap_decor',           'design',  'stylist_decorator', 'V1.1.1', 'Hindu',   FALSE, FALSE, FALSE, TRUE,  FALSE, '{}', NULL),
  -- Muslim groom-side (visible)
  ('muslim_groom_attire',    'look',    'grooms_attire',     'V1.1.1', 'Muslim',  FALSE, FALSE, FALSE, TRUE,  FALSE, '{}', NULL),
  ('maranao_groom_attire',   'look',    'grooms_attire',     'V1.1.1', 'Muslim',  TRUE,  FALSE, FALSE, TRUE,  FALSE, '{}', NULL),
  -- Debut (universal faith, scoped to the debut event type)
  ('debutante_gown',         'look',    'womens_attire',     'V1.1.1', NULL,      TRUE,  FALSE, TRUE,  FALSE, FALSE, '{}', ARRAY['debut']::text[]),
  ('eighteen_roses_attire',  'look',    'mens_attire',       'V1.1.1', NULL,      TRUE,  FALSE, TRUE,  FALSE, FALSE, '{}', ARRAY['debut']::text[]),
  -- Trophies & Awards (tile itself is event-scoped)
  ('trophy_supplier',        'prints',  'trophies_awards',   'V1.1.1', NULL,      FALSE, FALSE, FALSE, FALSE, FALSE, '{}', NULL),
  ('medals_plaques',         'prints',  'trophies_awards',   'V1.1.1', NULL,      FALSE, FALSE, FALSE, FALSE, FALSE, '{}', NULL)
ON CONFLICT (canonical_service) DO NOTHING;

-- 4. Fail loud: every new faith key must now have >=1 tagged service, and no
-- dietary row may be faith-tagged (the de-faith lock).
DO $$
DECLARE missing TEXT; bad TEXT;
BEGIN
  SELECT string_agg(v.faith_key, ', ') INTO missing
    FROM public.faith_vocab v
   WHERE v.faith_key NOT IN ('Civil')
     AND NOT EXISTS (SELECT 1 FROM public.canonical_service_taxonomy t WHERE t.faith = v.faith_key);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'faith keys with zero tagged services: %', missing;
  END IF;
  SELECT string_agg(canonical_service, ', ') INTO bad
    FROM public.canonical_service_taxonomy WHERE dietary IS NOT NULL AND faith IS NOT NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'dietary rows must never be faith-tagged: %', bad;
  END IF;
END $$;

COMMIT;
