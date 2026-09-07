-- ============================================================================
-- 20271211440288_ra1_tables_decor_five_families.sql
-- RA1 · PART B · THE GUEST TABLES GET THEIR DRAWINGS — ALL FIVE FAMILIES.
--
-- `tables` becomes the fourth of `renderVenueSvg`'s thirteen zones to carry
-- generated artwork, after `backdrop` + `ceiling` (MB14b) and `stage`
-- (`20271211370331`). Unlike the stage, this one covers every one of the five
-- original style families — including `tropical heritage`, which the stage
-- could not solve in four generations.
--
-- ── THE FIVE FILES, WITH THEIR HASHES ───────────────────────────────────────
-- Recraft V4.1 vectors (`model_type: 'vector'`, `resolution: '2k'`,
-- `aspect_ratio: '16:9'`), served from `apps/web/public/moodboard-seed/`.
-- Shipped as generated, not run through an optimiser: an optimiser that merges
-- fills is exactly the hazard the colour guard exists to catch.
--
--   sha256                                                            bytes  file
--   016c011ec6e2dcd5cd4787b2b67fcb8df18028a54c42897bce2e740898411413  168841  bridgerton-regal.svg
--   08641437e77e8ade4c7deb4ff97954fef94bc236e15d99a7b469d662fa5de2b5  148518  editorial-cream.svg
--   2597782c7fdddbf958afd500802f46b83684aa56b0682719c0c1f7d095cb06b7   36885  elegant-simple-classic.svg
--   0364708abc0ffd7919dd06501c5eedaf66630e20c0238099590a9b00bd6ff25d   61681  modern-minimalist.svg
--   cc1efb897736894c41564b7280a955af9087955deabe920a8cb49d0ab68c87c1  154401  tropical-heritage.svg
--
-- ── 🔑 FIVE KEEPERS FROM FIVE GENERATIONS, AND THE REASON IS THE COMPOSITION ─
-- The stage's yield was 1 keeper per 2.25 generations, and its `tropical
-- heritage` cell was never solved — across four attempts Recraft kept spending
-- the sage seed on the WALL, the FLOOR and the RISER and leaving the cloth
-- cream or mint. Every one of those failures needed a room to put the colour
-- in.
--
-- These five are composed as OBJECTS ON A PLAIN EMPTY BACKGROUND — "no floor,
-- no wall, no room, no horizon line", with the tables in a horizontal band and
-- empty margins above and below. That was done for a rendering reason (see the
-- geometry note below), and it removed the failure mode as a side effect:
-- there is no wall left to mis-paint. `tropical heritage` landed on the first
-- attempt. **Prefer the object-on-plain-background composition for every
-- remaining zone** — it is cheaper to generate AND it composites correctly.
-- Prompts recorded in `apps/web/scripts/reception-decor-pilot-prompts.ts`.
--
-- ── THE TOLERANCES, MEASURED WITH NO AREA FLOOR ─────────────────────────────
-- Rasterised at the component's own MAX_PREVIEW_PX (520) with `sharp`
-- (`fit: 'contain'`), pushed through the REAL `recolorRGBA` against four
-- unrelated targets (#7A1F2B, #D4AF37, #0F766E, #1E3A8A), counting every opaque
-- pixel that changes OUTSIDE a 2px dilation of the tagged cloth.
--
--   family                       slot      tol   outside@tol   outside@tol+1
--   elegant · simple · classic   #C9A059     9        17 px          77 px
--   bridgerton · regal           #8C6BA6     8         6 px         593 px  ← sharp
--   editorial cream              #D98BA6     7        28 px          34 px
--   tropical heritage            #9CB29A     5         4 px         351 px  ← sharp
--   modern minimalist            #4A3B45     6        28 px          43 px
--
-- Each is the largest integer at which the outside count stays under 0.02% of
-- the opaque area (31 px) — a MEASURED allowance for antialiasing where a chair
-- leg or a plate rim crosses the cloth's edge, not a concession. All five
-- recolour their cloth COMPLETELY at the seeded value (every exact slot pixel
-- moves, under all four targets). All five sit inside
-- `tolerance_de BETWEEN 5 AND 30`; nothing was widened and the CHECK was not
-- touched.
--
-- ⚠ TWO OF THE FIVE HAVE A SHARP BOUNDARY AND THREE DO NOT, AND THAT IS STATED
-- RATHER THAN SMOOTHED. `bridgerton · regal` (6 → 593 px at 9) and `tropical
-- heritage` (4 → 351 px at 6) turn a measured field one step up; the guard
-- asserts that. `elegant`, `editorial cream` and `modern minimalist` climb
-- gradually — their genuine neutrals sit further out (the chair/plate greys at
-- 13.19, ~10 and ~14 respectively) — so for those three the seeded value is
-- bounded by the antialiasing budget, not by a cliff, and the guard says so
-- instead of pretending otherwise.
--
-- ── 🪤 THE GEOMETRY IS THE UNUSUAL PART OF THIS ZONE ────────────────────────
-- `tables` is not one object. `renderVenueSvg` draws FOUR guest tables at
-- (150,520,r60) (810,520,r60) (240,432,r44) (720,432,r44) — scattered across
-- the lower half of the frame with the aisle running between them. Every other
-- decor zone so far has been a single contiguous panel, and `DECOR_SLOTS` takes
-- exactly one rect per zone.
--
-- 🔑 ONE WIDE RECT WORKS *ONLY BECAUSE* `tables` IS ALSO A SCENE ZONE. Its
-- drawing's background is knocked out before compositing, so the floor, the
-- aisle runner and the dance floor all show through BETWEEN the tables.
-- Composited opaque, this same rect would blank the entire lower half of the
-- couple's room. `tables` is added to `SCENE_DECOR_ZONES` in the same change,
-- and the guard asserts that membership — dropping it does not fail loudly, it
-- silently paints a rectangle over the room.
--
-- ── WIRING ──────────────────────────────────────────────────────────────────
-- Rows alone are dead, and a zone needs THREE permissions, not one:
--   1. `PILOT_DECOR_ZONES`  — the resolver will look for an asset
--   2. `DECOR_SLOTS`        — the geometry ("the geometry IS the permission")
--   3. a `decorImage(zone, decor) ??` call site in `renderVenueSvg`
-- Missing 2 or 3 is invisible: no error, no null, no log, and the room simply
-- looks the way it did before. All three land in this change, plus
-- `SCENE_DECOR_ZONES` as a fourth.
--
-- Cross-references:
--   * 20271211370331 — the stage zone, the same shape one zone earlier
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
SELECT 'venue_scene', 'tables', v.label, v.path, 'higgsfield_generated', v.style_theme, NOW()
  FROM (VALUES
    ('Guest tables · Elegant · Simple · Classic (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/tables/elegant-simple-classic.svg', 'elegant · simple · classic'),
    ('Guest tables · Bridgerton · Regal (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/tables/bridgerton-regal.svg', 'bridgerton · regal'),
    ('Guest tables · Editorial Cream (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/tables/editorial-cream.svg', 'editorial cream'),
    ('Guest tables · Tropical Heritage (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/tables/tropical-heritage.svg', 'tropical heritage'),
    ('Guest tables · Modern Minimalist (Recraft V4.1 vector)',
     '/moodboard-seed/venue_scene/tables/modern-minimalist.svg', 'modern minimalist')
  ) AS v(label, path, style_theme)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.moodboard_library_assets a WHERE a.storage_path = v.path
 );

-- One measured range each, slot 1. slot 1 is the couple's FIRST reception
-- colour (`moodboard-board.tsx` maps slot N to `palette[(N-1) % length]`),
-- matching every other decor zone. Each drawing has exactly one isolable
-- dominant region: the tablecloth.
INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1::SMALLINT, v.sampled_hex, v.tolerance_de, 'draped fabric'
  FROM (VALUES
    ('/moodboard-seed/venue_scene/tables/elegant-simple-classic.svg', '#C9A059',  9::NUMERIC),
    ('/moodboard-seed/venue_scene/tables/bridgerton-regal.svg',       '#8C6BA6',  8::NUMERIC),
    ('/moodboard-seed/venue_scene/tables/editorial-cream.svg',        '#D98BA6',  7::NUMERIC),
    ('/moodboard-seed/venue_scene/tables/tropical-heritage.svg',      '#9CB29A',  5::NUMERIC),
    ('/moodboard-seed/venue_scene/tables/modern-minimalist.svg',      '#4A3B45',  6::NUMERIC)
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
     AND asset_subtype = 'tables'
     AND storage_path ~ '^/moodboard-seed/venue_scene/tables/[a-z0-9-]+\.svg$'
     AND approved_at IS NOT NULL
     AND retired_at IS NULL;

  IF n_assets <> 5 THEN
    SELECT string_agg(storage_path, ', ' ORDER BY storage_path) INTO bad
      FROM public.moodboard_library_assets
     WHERE asset_type = 'venue_scene' AND asset_subtype = 'tables';
    RAISE EXCEPTION
      'RA1: expected exactly 5 live app-served venue_scene tables rows, found %. Paths are: %.',
      n_assets, COALESCE(bad, '(none)');
  END IF;

  -- One range each. An asset with no range is skipped entirely by
  -- fetchDecorLayerCatalog (`if (!slot1) continue`), so the cell silently falls
  -- back to the flat SVG and nobody is told the drawing is unreachable.
  SELECT count(*) INTO n_ranges
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.asset_type = 'venue_scene' AND a.asset_subtype = 'tables';

  IF n_ranges <> 5 THEN
    RAISE EXCEPTION
      'RA1: expected exactly 5 colour ranges across the guest-table drawings (slot 1 each), '
      'found %. A second range on one of these files is a region nobody measured.',
      n_ranges;
  END IF;
END $$;

COMMIT;
