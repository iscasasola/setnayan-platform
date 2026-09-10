-- ============================================================================
-- 20271212747087_ra2_program_decor_four_families.sql
-- RA2 · PART B · THE PROGRAM ZONE GETS ITS DRAWINGS — FOUR OF FIVE FAMILIES.
--
-- `program` becomes the sixth of `renderVenueSvg`'s thirteen zones to carry
-- generated artwork, after `backdrop` + `ceiling` (MB14b), `stage`
-- (`20271211370331`), `tables` (`20271211440288`) and `feast`
-- (`20271212409881`).
--
-- ⚠ FOUR ROWS, NOT FIVE. `modern minimalist` is UNSEEDABLE on this zone and
-- ships UNCOVERED — see the section below. The cell renders as the flat SVG,
-- byte for byte, exactly as all of `program` did yesterday and as `stage`'s
-- own uncovered cell does today. The room degrades gracefully; that is the
-- design, not a shortfall being papered over.
--
-- ── THE FOUR FILES, WITH THEIR HASHES ───────────────────────────────────────
-- Recraft V4.1 vectors (`model_type: 'vector'`, `resolution: '2k'`,
-- `aspect_ratio: '16:9'`), served from `apps/web/public/moodboard-seed/`.
-- Shipped as generated, not run through an optimiser: an optimiser that merges
-- fills is exactly the hazard the colour guard exists to catch.
--
--   sha256                                                            bytes  file
--   88949a8f82bde2024c409e5f5855885e157eef64b263ea9362106b0f71f109d1   54937  bridgerton-regal.svg
--   b16522cc5e4806de891f852c350d320f13976e60fab62a7ac9f536424ac5722f  123211  editorial-cream.svg
--   fa9eee7670163634d9b9eff8f32b0176be8d50b75733a5f3b2bc267a011e5f89   67646  elegant-simple-classic.svg
--   afa7c2db59be4017e73d56aa18a7c42c2087002a153d79fd44af0d8629ea4b0e   65480  tropical-heritage.svg
--
-- ── YIELD: 4 KEEPERS / 7 GENERATIONS (1 per 1.75) ───────────────────────────
-- The tagged surface is the performance riser's floor-length DRAPED SKIRT — the
-- plan's "draped or flat-clad surface, never ornate furniture", and the same
-- shape as the stage's clad riser. Composition is `tables`' object-on-plain-
-- background, now confirmed on a third zone. Prompts in
-- `apps/web/scripts/reception-decor-pilot-prompts.ts`.
--
-- ── 🔴 WHY `modern minimalist` HAS NO ROW, IN THE NUMBERS ───────────────────
-- `tolerance_de` is CHECKed `BETWEEN 5 AND 30`, so a slot whose nearest neutral
-- sits under 5 in the engine's metric cannot be isolated at ANY legal value.
-- Two generations, two ways, both under it:
--
--   attempt 1  deep charcoal plum `#4A3B45`  nearest neutral 3.01  (grey line work)
--   attempt 2  mid slate plum     `#6E5A68`  nearest neutral 3.08  (mid greys)
--
-- 🔑 THE DIAGNOSIS GENERALISES, AND IT IS ABOUT THE ZONE, NOT THE PROMPT. This
-- drawing is a band: musicians, instruments, amplifiers, cymbals, mic stands —
-- all of which Recraft draws in GREY, at every value from near-black to
-- near-white, however the neutrals are named. A family whose colour IS a
-- desaturated grey-violet therefore has no gap to sit in. Asking for lighter
-- neutrals moved the collision from the dark greys to the mid greys; asking for
-- no outlines at all (which solved the identical problem on `feast`) did not
-- work here, because on this zone the greys are the SUBJECT, not the line work.
-- The four families that landed are all SATURATED hues — gold, purple, pink,
-- mint — which sit far from every grey in the picture.
--
-- ➡ A desaturated slot colour is unseedable on any zone whose subject is
--   equipment. Ship the cell uncovered rather than widening anything. NEVER
--   lower the table CHECK for one file (MB23's bride, MB28's beach, both).
--
-- ── THE TOLERANCES, MEASURED WITH NO AREA FLOOR ─────────────────────────────
-- Rasterised at the component's own MAX_PREVIEW_PX (520) with `sharp`
-- (`fit: 'contain'`), pushed through the REAL `recolorRGBA` against four
-- unrelated targets (#7A1F2B, #D4AF37, #0F766E, #1E3A8A), counting every opaque
-- pixel that changes OUTSIDE a 2px dilation of the tagged skirt.
--
--   family                       slot      tol   nearest neutral   outside@tol   @tol+1
--   elegant · simple · classic   #C9A059    11        11.09              0 px      325 px  ← cliff
--   bridgerton · regal           #8C6BA6     8         5.54             22 px      268 px  ← cliff
--   editorial cream              #D98BA6    12         4.85 (own edge)   25 px       99 px  ← cliff
--   tropical heritage            #66DEBA    18        18.10              0 px       68 px  ← cliff
--
-- Each is the largest integer at which the outside count stays under 0.02% of
-- the opaque area (31 px of 154,440). All four are bounded by a genuine cliff.
-- All four recolour their skirt COMPLETELY at the seeded value under all four
-- targets, and all four sit inside the CHECK; nothing was widened.
--
-- 🪤 `tropical heritage`'s SAMPLED HEX IS `#66DEBA`, NOT THE `#9CB29A` SAGE
-- PASSED AS THE SEED — and that is the pilot's finding 3, measured again.
-- Recraft invented its own dominant (a bright mint, 39% of the frame) and left
-- the passed sage as a MINOR fill 18.10 away. Tagging the seed would have
-- tagged almost nothing and left the visible skirt stock. RE-SAMPLE THE PIXELS;
-- the `colors` array is a hint, never a promise. The sage's 18.10 is also what
-- bounds this file's tolerance at 18 — the two facts are the same fact.
--
-- ── 🪤 THE WIRING LESSON THIS ZONE INHERITS, ALREADY APPLIED ────────────────
-- `program` draws TWO independently chosen objects: the BAND on its riser, and
-- the HOST's spot (a podium, a standing mic, a dressed table) — chosen in a
-- separate attribute. That is the same shape as `feast`, where gating the image
-- on "is the whole flat group empty?" put a generated buffet line into the room
-- of a couple who chose plated service and dropped the cake table they ticked
-- (corrected in the same session). So here, from the start:
--
--   * the image is gated on THE BAND, not on the group — a couple who booked
--     only an emcee has no riser, and must not be given a generated band;
--   * the HOST SPOT is drawn AFTER the image, standing in front of the riser,
--     never replaced by it.
--
-- Both are asserted on bytes in `reception-decor-layers.test.ts`.
--
-- ── WIRING ──────────────────────────────────────────────────────────────────
-- Rows alone are dead, and a zone needs THREE permissions, not one:
--   1. `PILOT_DECOR_ZONES`  — the resolver will look for an asset
--   2. `DECOR_SLOTS`        — the geometry ("the geometry IS the permission")
--   3. a `decorImage(zone, decor) ??` call site in `renderVenueSvg`
-- Missing 2 or 3 is invisible: no error, no null, no log. All three land here,
-- plus `SCENE_DECOR_ZONES` as a fourth — the drawing is an object on a plain
-- field, so its background is knocked out before compositing, or it lays an
-- opaque slab across the couple's floor and the guest tables beside it.
--
-- Cross-references:
--   * 20271212409881 — `feast`, the zone whose gate this one learns from
--   * build-sessions/RECEPTION-ART-PLAN.md — Part 2, the measurement procedure
--   * apps/web/lib/color-recolor.ts — `colorDistance`, the metric above
--
-- Idempotent: every INSERT is gated on `WHERE NOT EXISTS` keyed on the row's own
-- `storage_path` (assets) and `(asset_id, slot_id)` (ranges), so a re-Apply is a
-- no-op and the count guard passes on the second run exactly as on the first.
-- ============================================================================

BEGIN;

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'program', v.label, v.path, 'higgsfield_generated', v.style_theme, NOW()
  FROM (VALUES
    ('Band riser · Elegant · Simple · Classic (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/program/elegant-simple-classic.svg', 'elegant · simple · classic'),
    ('Band riser · Bridgerton · Regal (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/program/bridgerton-regal.svg', 'bridgerton · regal'),
    ('Band riser · Editorial Cream (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/program/editorial-cream.svg', 'editorial cream'),
    ('Band riser · Tropical Heritage (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/program/tropical-heritage.svg', 'tropical heritage')
  ) AS v(label, path, style_theme)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.moodboard_library_assets a WHERE a.storage_path = v.path
 );

-- One measured range each, slot 1 — the couple's FIRST reception colour
-- (`moodboard-board.tsx` maps slot N to `palette[(N-1) % length]`), matching
-- every other decor zone. Each drawing has exactly one isolable dominant
-- region: the riser's draped skirt.
INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1::SMALLINT, v.sampled_hex, v.tolerance_de, 'draped fabric'
  FROM (VALUES
    ('/moodboard-seed/venue_scene/program/elegant-simple-classic.svg', '#C9A059', 11::NUMERIC),
    ('/moodboard-seed/venue_scene/program/bridgerton-regal.svg',       '#8C6BA6',  8::NUMERIC),
    ('/moodboard-seed/venue_scene/program/editorial-cream.svg',        '#D98BA6', 12::NUMERIC),
    ('/moodboard-seed/venue_scene/program/tropical-heritage.svg',      '#66DEBA', 18::NUMERIC)
  ) AS v(path, sampled_hex, tolerance_de)
  JOIN public.moodboard_library_assets a ON a.storage_path = v.path
 WHERE NOT EXISTS (
   SELECT 1 FROM public.moodboard_asset_color_ranges c
    WHERE c.asset_id = a.asset_id AND c.slot_id = 1
 );

-- ── the count guard ─────────────────────────────────────────────────────────
DO $$
DECLARE
  n_assets int;
  n_ranges int;
  bad      text;
BEGIN
  SELECT count(*) INTO n_assets
    FROM public.moodboard_library_assets
   WHERE asset_type = 'venue_scene'
     AND asset_subtype = 'program'
     AND storage_path ~ '^/moodboard-seed/venue_scene/program/[a-z0-9-]+\.svg$'
     AND approved_at IS NOT NULL
     AND retired_at IS NULL;

  -- FOUR, deliberately. `modern minimalist` is unseedable on this zone (nearest
  -- neutral 3.01 then 3.08, both under the CHECK floor of 5) and ships
  -- uncovered. If a fifth row ever appears here, someone seeded that cell —
  -- re-measure it before trusting it, and do not assume this number was a typo.
  IF n_assets <> 4 THEN
    SELECT string_agg(storage_path, ', ' ORDER BY storage_path) INTO bad
      FROM public.moodboard_library_assets
     WHERE asset_type = 'venue_scene' AND asset_subtype = 'program';
    RAISE EXCEPTION
      'RA2: expected exactly 4 live app-served venue_scene program rows, found %. Paths are: %.',
      n_assets, COALESCE(bad, '(none)');
  END IF;

  -- One range each. An asset with no range is skipped entirely by
  -- fetchDecorLayerCatalog (`if (!slot1) continue`), so the cell silently falls
  -- back to the flat SVG and nobody is told the drawing is unreachable.
  SELECT count(*) INTO n_ranges
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.asset_type = 'venue_scene' AND a.asset_subtype = 'program';

  IF n_ranges <> 4 THEN
    RAISE EXCEPTION
      'RA2: expected exactly 4 colour ranges across the band-riser drawings (slot 1 each), '
      'found %. A second range on one of these files is a region nobody measured.',
      n_ranges;
  END IF;
END $$;

COMMIT;
