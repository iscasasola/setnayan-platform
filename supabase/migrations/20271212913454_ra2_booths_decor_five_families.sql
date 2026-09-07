-- ============================================================================
-- 20271212913454_ra2_booths_decor_five_families.sql
-- RA2 · PART B · THE BOOTH ROW GETS ITS DRAWINGS — ALL FIVE FAMILIES.
--
-- `booths` becomes the seventh of `renderVenueSvg`'s thirteen zones to carry
-- generated artwork, after `backdrop` + `ceiling` (MB14b), `stage`
-- (`20271211370331`), `tables` (`20271211440288`), `feast` (`20271212409881`)
-- and `program` (`20271212747087`). Unlike `program` this one covers all five
-- families — including `modern minimalist`, which `program` could not solve.
--
-- ── THE FIVE FILES, WITH THEIR HASHES ───────────────────────────────────────
-- Recraft V4.1 vectors (`model_type: 'vector'`, `resolution: '2k'`,
-- `aspect_ratio: '16:9'`), served from `apps/web/public/moodboard-seed/`.
-- Shipped as generated, not run through an optimiser: an optimiser that merges
-- fills is exactly the hazard the colour guard exists to catch.
--
--   sha256                                                            bytes  file
--   fa7cba97ae2cb41f1522c106dcb48f3550b4219e6bdb17b4736af2083acec0f3   47858  bridgerton-regal.svg
--   af3b674b894d40079980e8886c407daf2bee9c65892f150b716e7218bba0efe3   25644  editorial-cream.svg
--   5e4d2bb5f92cc159193c6e50b0a313abf056f77bf419aaed554fb689c029db73   31060  elegant-simple-classic.svg
--   4472fa0ea75176a590e089cf741d24ae8f7246c8123a8a7057b30004c02720e2   33260  modern-minimalist.svg
--   618457f4a349cc711a912f12bd2976bcdbb277e4f6267383d1fd03d6858df6ba   63454  tropical-heritage.svg
--
-- ── YIELD: 5 KEEPERS / 7 GENERATIONS (1 per 1.4) ────────────────────────────
-- The tagged surface is the booths' AWNING CANOPY — the plan's "draped or
-- flat-clad surface". Composition is `tables`' object-on-plain-background,
-- confirmed on a fourth zone. Prompts in
-- `apps/web/scripts/reception-decor-pilot-prompts.ts`.
--
-- ── 🔎 THE FINDING THAT UNBLOCKED THIS ZONE: SWAP THE NEUTRALS, NOT THE SLOT ─
-- `modern minimalist` was UNSEEDABLE on `program` three times running (nearest
-- neutral 3.01, 3.08, 3.01) because its deep plum sits inside the CHECK floor of
-- 5 from the GREYS a drawing uses for line work and equipment. Two levers
-- failed there: removing outlines, and moving the seed to a mid tone.
--
-- 🔑 THE THIRD LEVER WORKS, AND IT IS THE OPPOSITE OF THE OBVIOUS ONE. Do not
-- change the slot colour — change the NEUTRALS OUT OF GREY ENTIRELY:
--
--     "…drawn in WARM CREAM, oatmeal and pale sand only. There are NO GREYS
--      anywhere in the picture, no black, no charcoal, no silver."
--
-- `modern minimalist` landed FIRST ATTEMPT here at tolerance 14, nearest neutral
-- 4.51 — from 3.01 to 4.51 by recolouring everything the slot is NOT. A grey and
-- a desaturated plum are near-neighbours in `colorDistance` by construction; a
-- warm cream and a desaturated plum are not. The same lever rescued
-- `bridgerton · regal` and `tropical heritage` here on their second attempts.
-- ➡ FOR ANY DESATURATED OR DARK FAMILY, ASK FOR WARM-CREAM NEUTRALS IN THE
--   FIRST PROMPT. It costs nothing and it is what separates 3.01 from 4.51.
--
-- ⚠ IT DOES NOT RESCUE EVERY ZONE, AND THAT WAS MEASURED TOO. Re-run on
-- `program` with this exact wording, it still came back 3.01: that drawing's
-- subject IS grey equipment, and Recraft keeps the musicians' outlines and
-- instrument bodies dark whatever the surround is asked to be. `program`'s
-- `modern minimalist` cell stays uncovered.
--
-- ── THE TOLERANCES, MEASURED WITH NO AREA FLOOR ─────────────────────────────
-- Rasterised at the component's own MAX_PREVIEW_PX (520) with `sharp`
-- (`fit: 'contain'`), pushed through the REAL `recolorRGBA` against four
-- unrelated targets (#7A1F2B, #D4AF37, #0F766E, #1E3A8A), counting every opaque
-- pixel that changes OUTSIDE a 2px dilation of the tagged canopy.
--
--   family                       slot      tol   nearest neutral   outside@tol   @tol+1
--   elegant · simple · classic   #C9A059    11       11.07               0 px      485 px
--   bridgerton · regal           #7356FE    20       19.88               0 px     1198 px
--   editorial cream              #D98BA6    12       12.97               0 px       48 px
--   tropical heritage            #9CB29A     5        5.27               0 px      633 px
--   modern minimalist            #4A3B45    14        4.51 (own edge)    26 px       39 px
--
-- 🔑 FOUR OF THE FIVE MOVE **ZERO** PIXELS OUTSIDE THE CANOPY AT THE SEEDED
-- VALUE — not "under budget", zero — and every one of the five turns a measured
-- field one step up. That is the cleanest set this session has measured, and it
-- is what a picture with no grey in it buys. All five sit inside
-- `tolerance_de BETWEEN 5 AND 30`; nothing was widened.
--
-- ── 🪤 THE REJECT THAT NO NUMBER CAUGHT — LOOK AT THE RECOLOUR ──────────────
-- `bridgerton · regal`'s FIRST generation measured clean at tolerance 13: zero
-- pixels outside the canopy, a cliff at 14. It is a reject. Its canopy is drawn
-- as TWO stacked panels — a flat top in `#7A60FC` and a scalloped valance under
-- it in `#5C43BB`, 13.76 apart — so the recolour turned the tops teal and left
-- three purple valances hanging beneath them. Every assertion passed because the
-- valance is genuinely OUTSIDE the tagged region: it is a second object of the
-- same colour family, not a bleed.
--
-- ⚠ AND A DEDICATED "IS THIS CLOTH BI-TONAL" CHECK, WRITTEN THIS SESSION AND
-- RUN ON THIS FILE, ALSO PASSED IT (0.07%) — because the second tone forms its
-- own connected region rather than sitting inside the first one's silhouette.
-- That check is NOT shipped, for this reason and one other; see
-- `build-sessions/RECEPTION-ART-PLAN.md`. The thing that caught this was
-- rendering the recolour and looking at it, which is the plan's own instruction
-- and remains the only reliable test for this failure.
--
-- ── 🪤 THE GEOMETRY, AND WHAT THE IMAGE COSTS THE COUPLE ────────────────────
-- The flat `boothsFloorItem` draws a ROW of 84x108 bays at x = 28 + i*96, y 132,
-- one per booth kind ticked, grounded by a shadow ellipse at y 241. `DECOR_SLOTS`
-- gets 20..320 x 120..250, which covers a row of three — the common case.
--
-- 🔑 THE IMAGE REPLACES THE WHOLE ROW, AND THAT IS DELIBERATE, UNLIKE `feast`
-- AND `program`. Those two zones each hold objects chosen through SEPARATE
-- attributes — a service line and, independently, a cake table; a band and,
-- independently, an emcee — so replacing the group there dropped a supplier the
-- couple booked, and both now gate on one object and draw the other on top.
-- `booths` is not that shape: every bay comes from the SAME multi-select
-- attribute, so the row is one object drawn N times, exactly like `tables`'
-- four tables. What a couple does lose is WHICH booths they ticked — a photo
-- booth and an arcade become three generic stalls.
--
-- ⚠ THAT IS A REAL COST AND IT IS FLAGGED, NOT HIDDEN: it is the same trade
-- `tables` already ships (a couple's chairs, linen and centrepiece choices do
-- not survive its image either), and the zone rail, the finalization screen and
-- the paid-render brief all still carry the exact kinds they chose. If the owner
-- would rather see their own booth kinds than a styled row, the fix is per-kind
-- artwork, which is a different piece of work and a much larger one.
--
-- 🔑 `booths` IS ALSO A SCENE ZONE. Its drawing is a row of stalls on a plain
-- field, so its background is knocked out before compositing, or it lays an
-- opaque slab across the couple's floor and wall.
--
-- ── WIRING ──────────────────────────────────────────────────────────────────
-- Rows alone are dead, and a zone needs THREE permissions, not one:
--   1. `PILOT_DECOR_ZONES`  — the resolver will look for an asset
--   2. `DECOR_SLOTS`        — the geometry ("the geometry IS the permission")
--   3. a `decorImage(zone, decor) ??` call site in `renderVenueSvg`
-- Missing 2 or 3 is invisible: no error, no null, no log. All three land here,
-- plus `SCENE_DECOR_ZONES` as a fourth.
--
-- Cross-references:
--   * 20271212747087 — `program`, and the family this zone finally solved
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
SELECT 'venue_scene', 'booths', v.label, v.path, 'higgsfield_generated', v.style_theme, NOW()
  FROM (VALUES
    ('Booth row · Elegant · Simple · Classic (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/booths/elegant-simple-classic.svg', 'elegant · simple · classic'),
    ('Booth row · Bridgerton · Regal (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/booths/bridgerton-regal.svg', 'bridgerton · regal'),
    ('Booth row · Editorial Cream (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/booths/editorial-cream.svg', 'editorial cream'),
    ('Booth row · Tropical Heritage (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/booths/tropical-heritage.svg', 'tropical heritage'),
    ('Booth row · Modern Minimalist (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/booths/modern-minimalist.svg', 'modern minimalist')
  ) AS v(label, path, style_theme)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.moodboard_library_assets a WHERE a.storage_path = v.path
 );

-- One measured range each, slot 1 — the couple's FIRST reception colour
-- (`moodboard-board.tsx` maps slot N to `palette[(N-1) % length]`), matching
-- every other decor zone. Each drawing has exactly one isolable dominant
-- region: the booths' awning canopy.
INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1::SMALLINT, v.sampled_hex, v.tolerance_de, 'awning canopy'
  FROM (VALUES
    ('/moodboard-seed/venue_scene/booths/elegant-simple-classic.svg', '#C9A059', 11::NUMERIC),
    ('/moodboard-seed/venue_scene/booths/bridgerton-regal.svg',       '#7356FE', 20::NUMERIC),
    ('/moodboard-seed/venue_scene/booths/editorial-cream.svg',        '#D98BA6', 12::NUMERIC),
    ('/moodboard-seed/venue_scene/booths/tropical-heritage.svg',      '#9CB29A',  5::NUMERIC),
    ('/moodboard-seed/venue_scene/booths/modern-minimalist.svg',      '#4A3B45', 14::NUMERIC)
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
     AND asset_subtype = 'booths'
     AND storage_path ~ '^/moodboard-seed/venue_scene/booths/[a-z0-9-]+\.svg$'
     AND approved_at IS NOT NULL
     AND retired_at IS NULL;

  IF n_assets <> 5 THEN
    SELECT string_agg(storage_path, ', ' ORDER BY storage_path) INTO bad
      FROM public.moodboard_library_assets
     WHERE asset_type = 'venue_scene' AND asset_subtype = 'booths';
    RAISE EXCEPTION
      'RA2: expected exactly 5 live app-served venue_scene booths rows, found %. Paths are: %.',
      n_assets, COALESCE(bad, '(none)');
  END IF;

  -- One range each. An asset with no range is skipped entirely by
  -- fetchDecorLayerCatalog (`if (!slot1) continue`), so the cell silently falls
  -- back to the flat SVG and nobody is told the drawing is unreachable.
  SELECT count(*) INTO n_ranges
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.asset_type = 'venue_scene' AND a.asset_subtype = 'booths';

  IF n_ranges <> 5 THEN
    RAISE EXCEPTION
      'RA2: expected exactly 5 colour ranges across the booth-row drawings (slot 1 each), '
      'found %. A second range on one of these files is a region nobody measured.',
      n_ranges;
  END IF;
END $$;

COMMIT;
