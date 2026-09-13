-- ============================================================================
-- 20271208519468_mb28_ceremony_settings_eight_venue_scenes.sql
-- MB28 · THE CEREMONY CARD LEARNS WHERE THE WEDDING ACTUALLY IS.
--
-- MB25 (`20271206413595`) gave the Ceremony card ONE drawing — a church aisle —
-- and every couple saw it, whether they were marrying in a mosque, on a beach,
-- or at a civil registrar's desk. `events.ceremony_venue_setting` has carried
-- the couple's real answer since `20271197508087`, CHECK-constrained to nine
-- values, and nothing read it. This migration seeds the other eight so
-- `findVenue` in page.tsx can select by equality on that column.
--
-- THE EIGHT ASSETS · sha256 of the bytes committed under apps/web/public/,
-- verified equal to build-sessions/assets/mb28/MANIFEST.md:
--
--   ancestral_house  8acdb230e518804b53e5acdf42c4224a34c6c5a4abb86b7f9a0dbc64d9fd6a40
--   beach            db70aa2de38fc568291f87966afa429786c5a650f6261cd62e24bd35e1b57842
--   chapel           ea2b6d017e3d81d7b4d215f412d23329d720c2ef0035715d40beacdec1ea9dd4
--   civil_registrar  5ff75ae2614bbbdcbc9022645530fa0a67378dd01bc05190754e174837052dca
--   garden           be1ed433815c1c2a81a929ce38964893fbdf5645336330448404328e8e8fff4a
--   hotel_venue      7767cea45a6ed57585aa94b9d1c87585e391a19664341eec46d3840155e9ab53
--   mosque           2a0c1867b633cd35f71cc48cdbb9f4d457ffa346d2a40cfe8f326887daaf2874
--   temple           fe3ac620874b39f01cd01c2ae6493db4054eb44716f731e53d0fef54cda38728
--
--   Recraft V4.1 `vector`, same pipeline as the church and the 75 attire
--   figures — hence `source = 'higgsfield_generated'`. App-served from
--   `public/moodboard-seed/venue_scene/<setting>/ceremony-aisle.svg`, so
--   `lib/moodboard-library-placeholder.ts` reads no host. Each carries the
--   generator's <metadata> C2PA provenance block; LEAVE IT.
--
--   `asset_subtype` is the `events.ceremony_venue_setting` string VERBATIM.
--   The card selects by equality, so a near-miss subtype is a silent "no
--   drawing" — the couple falls back to the church and nothing reports it.
--
-- ── 🔑 EVERY TOLERANCE BELOW WAS MEASURED THROUGH `recolorRGBA`, AND EVERY
--    ONE OF THEM CAME OUT TIGHTER THAN THE BRIEF'S CIELAB FIGURE ─────────────
--
-- MB25 already recorded that `colorDistance` is NOT CIELAB ΔE — it is
-- sqrt(0.3dr² + 0.59dg² + 0.11db²)/2.55, a weighted-RGB proxy — and that the
-- church's fabric slot had to be seeded at 5 where the ΔE reading said 10 was
-- safe. MB28's brief carried per-file ceilings from the same CIELAB
-- measurement (manifest column "fabric tolerance ceiling": 8..15). Re-measured
-- by pixel at the component's own MAX_PREVIEW_PX (520), through the real
-- engine, EVERY ONE of those ceilings is too wide:
--
--   setting          nearest neutral → fabric      manifest ΔE ceiling   seeded
--   ancestral_house  #D6D1C7  5.1  (CIELAB 14.4)          ≤ 11              5
--   chapel           #D6D1C7  5.1  (CIELAB 14.4)          ≤ 11              5
--   civil_registrar  #D6D1C7  5.1  (CIELAB 14.4)          ≤ 11              5
--   hotel_venue      #CFCBC2  7.0  (CIELAB 15.6)          ≤ 12              7
--   mosque           #CFCBC2  7.0  (CIELAB 15.6)          ≤ 12              7
--   garden           #E3EBEE  9.2  (CIELAB 18.9)          ≤ 15              9
--   temple           #F4F1EA 10.3  (CIELAB 17.9)          ≤ 14             10
--   beach            #DDD6C8  3.5  (CIELAB 11.9)          ≤  8         NOT SEEDED
--
-- Each seeded value is the LARGEST integer at which no neutral moves: one step
-- higher and a measured field turns. Verified by pixel, all eight files, both
-- slots applied together (burgundy #7A1F2B + gold #D4AF37): every exact
-- florals pixel and every exact fabric pixel recolours, and every exact
-- neutral pixel — walls, floor, chairs, sky, sea, grass, sand, driftwood,
-- pews — moves by ZERO. Pinned by
-- `_components/the-background-never-wears-the-palette.test.ts`, which PARSES
-- these rows out of this file rather than restating them.
--
-- Slot 1 (florals, #D98BA6) is seeded at 10 on all eight — the value MB25
-- measured for the church. The nearest neutral to that slot is 12.8 away on
-- the tightest file (hotel_venue #A9A49B), so 10 keeps a ≥2.8 margin
-- everywhere; the per-file safe maxima run 12..30 and were deliberately not
-- taken, because a wide range on a shaded vector swallows the blend along the
-- region's own edge and reads as a halo.
--
-- ── ⚠ FIFTEEN RANGES, NOT SIXTEEN — THE BEACH FABRIC CANNOT BE SEEDED ───────
--
-- 🔑 THIS IS MB23'S BRIDE, ON A VENUE SCENE, AND IT IS AN OWNER DECISION.
--
-- The beach drawing's ARCH IS DRIFTWOOD, painted #DDD6C8 (24 paths, 1.29% of
-- the opaque area, 2,275 px at 520). That colour sits **3.5** from the fabric
-- slot in the engine's metric. `moodboard_asset_color_ranges` has CHECKed
-- `tolerance_de BETWEEN 5 AND 30` since `20260525000000`, so the tightest
-- LEGAL tolerance is 5 — and at 5, measured, all 2,275 driftwood pixels turn
-- the couple's second ceremony colour. There is no legal value that separates
-- the drapes from the trees.
--
-- ⚠ THE BRIEF NAMED THIS COLOUR "sand" AND IT IS NOT. The manifest's ΔE 11.9
-- is exactly this pair (#DDD6C8 → #E8D9B5), but the region is the arch, not
-- the ground: the actual grey sand is #B8B2A6 (13.07%), a comfortable 15.8
-- away. The masked render that settles it is described in the report; the
-- 2026-09-06 oversight round could not have caught it, because it judged every
-- candidate on a simulated recolour done by EXACT FILL SWAP, and a fill swap
-- structurally cannot show a tolerance bleed into a neighbouring colour.
--
-- So, following MB23 exactly — which DELETED the modern-minimalist bride's
-- false range rather than inventing a tolerance for it, and left the asset
-- live — the beach ships with slot 1 only. Its flowers recolour; its drapes
-- stay at the artist's cream. That is strictly better than the alternatives: a
-- beach couple still gets a beach, and no tree turns gold.
--
-- 🔑 THE OWNER DECISION THIS SURFACES, NOT RESOLVED HERE: whether to re-cut
-- the beach driftwood to a colour further from #E8D9B5 and seed its slot 2 in
-- a follow-up. Do NOT "fix" it by widening a tolerance, and do NOT lower the
-- table's CHECK floor for one drawing.
--
-- ── SLOT ORDER IS THE COUPLE'S COLOUR ORDER ─────────────────────────────────
-- `moodboard-board.tsx` maps `out[r.slotId] = palette[i % palette.length]`, so
-- slot 1 = their FIRST ceremony colour (the flowers) and slot 2 their second
-- (the fabric). A couple with one ceremony colour gets both regions in it.
--
-- Idempotent: WHERE NOT EXISTS on storage_path; ranges keyed off the row.
-- ============================================================================

BEGIN;

-- ── the eight scenes ────────────────────────────────────────────────────────
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT
  'venue_scene',
  v.setting,
  'Ceremony aisle · ' || v.title || ' (Recraft V4.1 vector)',
  '/moodboard-seed/venue_scene/' || v.setting || '/ceremony-aisle.svg',
  'higgsfield_generated',
  'elegant · simple · classic',
  NOW()
FROM (VALUES
  ('ancestral_house', 'Ancestral House'),
  ('beach',           'Beach'),
  ('chapel',          'Chapel'),
  ('civil_registrar', 'Civil Registrar'),
  ('garden',          'Garden'),
  ('hotel_venue',     'Hotel Venue'),
  ('mosque',          'Mosque'),
  ('temple',          'Temple')
) AS v(setting, title)
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets a
   WHERE a.storage_path = '/moodboard-seed/venue_scene/' || v.setting || '/ceremony-aisle.svg'
);

-- ── the fifteen colour ranges · MEASURED, not converted — see header ────────
INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, v.slot_id, v.sampled_hex, v.tolerance_de, v.region_label
  FROM public.moodboard_library_assets a
  CROSS JOIN (VALUES
    -- (setting, slot, sampled_hex, tolerance_de, region)
    ('ancestral_house', 1::SMALLINT, '#D98BA6', 10::NUMERIC, 'florals'),
    ('ancestral_house', 2::SMALLINT, '#E8D9B5',  5::NUMERIC, 'fabric'),
    -- beach slot 2 is deliberately absent: driftwood #DDD6C8 is 3.5 from the
    -- fabric slot and the table's CHECK floor is 5. See the header.
    ('beach',           1::SMALLINT, '#D98BA6', 10::NUMERIC, 'florals'),
    ('chapel',          1::SMALLINT, '#D98BA6', 10::NUMERIC, 'florals'),
    ('chapel',          2::SMALLINT, '#E8D9B5',  5::NUMERIC, 'fabric'),
    ('civil_registrar', 1::SMALLINT, '#D98BA6', 10::NUMERIC, 'florals'),
    ('civil_registrar', 2::SMALLINT, '#E8D9B5',  5::NUMERIC, 'fabric'),
    ('garden',          1::SMALLINT, '#D98BA6', 10::NUMERIC, 'florals'),
    ('garden',          2::SMALLINT, '#E8D9B5',  9::NUMERIC, 'fabric'),
    ('hotel_venue',     1::SMALLINT, '#D98BA6', 10::NUMERIC, 'florals'),
    ('hotel_venue',     2::SMALLINT, '#E8D9B5',  7::NUMERIC, 'fabric'),
    ('mosque',          1::SMALLINT, '#D98BA6', 10::NUMERIC, 'florals'),
    ('mosque',          2::SMALLINT, '#E8D9B5',  7::NUMERIC, 'fabric'),
    ('temple',          1::SMALLINT, '#D98BA6', 10::NUMERIC, 'florals'),
    ('temple',          2::SMALLINT, '#E8D9B5', 10::NUMERIC, 'fabric')
  ) AS v(setting, slot_id, sampled_hex, tolerance_de, region_label)
 WHERE a.storage_path = '/moodboard-seed/venue_scene/' || v.setting || '/ceremony-aisle.svg'
   AND NOT EXISTS (
     SELECT 1 FROM public.moodboard_asset_color_ranges c
      WHERE c.asset_id = a.asset_id AND c.slot_id = v.slot_id
   );

-- ── the count this migration is allowed to leave behind ─────────────────────
-- Nine ceremony settings (MB25's church + these eight) and MB14b's ten decor
-- layers. Nineteen. If this fires, either a setting failed to insert (the card
-- silently falls back to the church for that couple) or something else
-- published a venue_scene the Ceremony card can now never show.
DO $$
DECLARE
  n_live      INTEGER;
  n_ceremony  INTEGER;
  n_ranges    INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_live
    FROM public.moodboard_library_assets
   WHERE asset_type = 'venue_scene' AND approved_at IS NOT NULL AND retired_at IS NULL;

  SELECT COUNT(*) INTO n_ceremony
    FROM public.moodboard_library_assets
   WHERE asset_type = 'venue_scene' AND approved_at IS NOT NULL AND retired_at IS NULL
     AND asset_subtype IN ('church','chapel','mosque','temple','civil_registrar',
                           'garden','beach','ancestral_house','hotel_venue');

  SELECT COUNT(*) INTO n_ranges
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.storage_path LIKE '/moodboard-seed/venue_scene/%/ceremony-aisle.svg';

  IF n_ceremony <> 9 THEN
    RAISE EXCEPTION
      'MB28: expected 9 live ceremony venue_scene rows (one per events.ceremony_venue_setting value), found %. A setting with no live drawing silently falls back to the church.',
      n_ceremony;
  END IF;

  IF n_live <> 19 THEN
    RAISE EXCEPTION
      'MB28: expected 19 live venue_scene rows (9 ceremony settings + MB14b''s 10 decor layers), found %. findVenue selects by exact subtype, so an unexpected venue_scene is not a ceremony and must not be one.',
      n_live;
  END IF;

  -- 17 = MB25's church (2) + these fifteen. Sixteen would mean someone seeded
  -- the beach fabric slot; read the header before you do.
  IF n_ranges <> 17 THEN
    RAISE EXCEPTION
      'MB28: expected 17 colour ranges across the nine ceremony drawings (church 2 + MB28 15; the beach fabric slot is unseedable, see header), found %.',
      n_ranges;
  END IF;
END $$;

COMMIT;
