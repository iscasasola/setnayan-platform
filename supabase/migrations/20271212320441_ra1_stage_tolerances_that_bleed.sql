-- ============================================================================
-- 20271212320441_ra1_stage_tolerances_that_bleed.sql
-- RA1 · THREE OF THE FIVE LIVE STAGE TOLERANCES REPAINT THE ROOM. FIX THEM.
--
-- `20271211370331` (PR #5270, merged 2026-09-06 11:07Z) shipped the stage zone
-- with five seeded ranges. Three of them are too wide, and the couples seeing
-- them today are getting their palette on the wall panelling, the chair
-- outlines and the plate rims — not only on the cloth.
--
-- ── MEASURED, ON THE SERVED FILES, THROUGH THE REAL ENGINE ──────────────────
-- Rasterised at the component's own MAX_PREVIEW_PX (520) with `sharp`
-- (`fit: 'contain'`), pushed through the REAL `recolorRGBA` against four
-- unrelated targets (#7A1F2B, #D4AF37, #0F766E, #1E3A8A), counting every opaque
-- pixel that changes OUTSIDE a 2px dilation of the tagged region — no area
-- floor, so a hairline counts exactly like a wall.
--
--   family                      shipped   bleed at shipped        clean max   ACTION
--   bridgerton · regal             12     2572 px  (1.67%)            8       12 → 8
--   editorial cream                15      628 px  (0.41%)           12       15 → 12
--   tropical heritage              15     1480 px  (0.96%)            1       range DELETED
--   elegant · simple · classic      9        0 px  (0.00%)            9       unchanged ✅
--   modern minimalist              15       15 px  (0.01%)            2*      unchanged ✅
--
-- * modern minimalist's 15 px are the antialiased join where the bench and arch
--   are drawn ON TOP of the plum block — they sit just outside the dilation and
--   are rasteriser noise, not a bleed. Its only neutral with pixels is the cream
--   wall at 70.07; the nearest fill DECLARED in its SVG is the arch/bench stroke
--   #867576 at 22.63. 15 is inside that with room to spare. Left alone: this
--   migration corrects what bleeds, it does not re-tune what does not.
--
-- ── 🔑 WHY `tropical heritage` GETS NO TOLERANCE AT ALL ─────────────────────
-- Two independent reasons, either one fatal:
--
--   1. Its nearest neutral is the chair/foliage grey #A7A99D at **3.60** in the
--      engine metric. `moodboard_asset_color_ranges` CHECKs
--      `tolerance_de BETWEEN 5 AND 30`, so the tightest LEGAL value is 5 — and
--      at 5 that grey already turns. There is no legal value that separates
--      them. This is MB23's bride and MB28's beach driftwood exactly.
--   2. Its tablecloth is drawn in TWO tones — the skirt #9CB29A (15.6% of the
--      frame, the tagged one) and the tabletop plane #B0FED8 (2.95%) — 24.65
--      apart, with the cream background at 20.48 BETWEEN them. So no tolerance
--      moves the tabletop without repainting three quarters of the frame.
--      Recoloured, the skirt turns the couple's colour and the tabletop stays
--      mint green: the palette lands on everything except the part you look at.
--
-- Three regenerations on the pilot's own finding 3 (one colour in Recraft's
-- `colors`, neutrals named in words) all failed a THIRD way — the model painted
-- the wall, the floor and the riser sage and left the cloth cream or mint.
-- Four generations, zero keepers, past the plan's stop rule. Prompts recorded in
-- `apps/web/scripts/reception-decor-pilot-prompts.ts`.
--
-- ⚠ DELETING THE RANGE DOES NOT LEAVE THE DRAWING ON SCREEN IN ITS STOCK SAGE.
-- `fetchDecorLayerCatalog` does `if (!slot1) continue` — "no tagged region,
-- skip rather than composite untinted" — so the asset drops out of the catalog,
-- `resolveDecorLayer` returns `{kind:'svg'}`, and the cell renders the FLAT
-- stage layer, which does follow the couple's palette. That is the better of
-- the two outcomes and it is worth stating plainly, because "the row stays live
-- and the runner stays the artist's sage" is the natural reading and it is not
-- what the code does. The asset row is left in place, approved and un-retired,
-- so a later session that re-cuts the artwork only has to re-seed a range.
--
-- ── 🪤 WHY THIS WAS NOT CAUGHT BY THE TEST THAT SHIPPED WITH IT ─────────────
-- A census with a "fills ≥0.2% of the opaque area" floor. Every region these
-- three tolerances repaint — chair outlines, plate rims, wall mouldings — is
-- HAIRLINE and never reaches 0.2%, so the guard could not see any of it. The
-- replacement assertion in `the-background-never-wears-the-palette.test.ts`
-- asks the spatial question instead and has no area floor at all.
--
-- ⚠ AND A HUE-BASED FILTER IS NOT THE FIX. Exempting "same-hue" pixels as
-- antialiasing was measured on these five files and fails in BOTH directions:
-- `modern minimalist`'s slot #4A3B45 has HSL saturation 0.113, so a
-- near-grey cutoff of 0.12 classifies the SLOT ITSELF as off-hue and reports
-- its own 77,650 recoloured pixels as a 50% bleed on a correct file; and
-- `elegant`'s cream background #F3ECE0 sits at hue 37.9° against a slot at
-- 38.0°, so it is exempted as "same hue" and the same filter reports a clean
-- max of 30 for a file whose real clean max is 9 — it would bless widening the
-- one tolerance that is already right. Position is the honest test: a pixel is
-- either part of the tagged object or it is not.
--
-- Cross-references:
--   * 20271211370331 — the migration this corrects
--   * 20271209690679 — MB28b, the last time a seeded tolerance was re-measured
--   * build-sessions/RECEPTION-ART-PLAN.md — Part 2, the measurement procedure
--
-- Idempotent: the UPDATEs are no-ops on a second run (the values already match),
-- the DELETE matches nothing the second time, and the guard counts the
-- destination shape so a re-Apply passes exactly as the first run does.
-- ============================================================================

BEGIN;

-- ── the two that come down ──────────────────────────────────────────────────

UPDATE public.moodboard_asset_color_ranges c
   SET tolerance_de = 8::NUMERIC
  FROM public.moodboard_library_assets a
 WHERE a.asset_id = c.asset_id
   AND a.storage_path = '/moodboard-seed/venue_scene/stage/bridgerton-regal.svg'
   AND c.slot_id = 1;

UPDATE public.moodboard_asset_color_ranges c
   SET tolerance_de = 12::NUMERIC
  FROM public.moodboard_library_assets a
 WHERE a.asset_id = c.asset_id
   AND a.storage_path = '/moodboard-seed/venue_scene/stage/editorial-cream.svg'
   AND c.slot_id = 1;

-- ── the one that has no legal value ─────────────────────────────────────────
-- The asset row itself is deliberately untouched: still approved, still
-- un-retired, still pointing at its file. Only the range goes.

DELETE FROM public.moodboard_asset_color_ranges c
 USING public.moodboard_library_assets a
 WHERE a.asset_id = c.asset_id
   AND a.storage_path = '/moodboard-seed/venue_scene/stage/tropical-heritage.svg'
   AND c.slot_id = 1;

-- ── the guard ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  bad text;
  n   int;
BEGIN
  -- Every surviving stage range is one of the four measured pairs. Anything
  -- else means a value was changed under this migration and nobody re-measured
  -- it against the served file.
  SELECT string_agg(a.storage_path || ' slot ' || c.slot_id || ' = ' ||
                    c.sampled_hex || ' ± ' || c.tolerance_de, ', ' ORDER BY a.storage_path)
    INTO bad
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.asset_type = 'venue_scene'
     AND a.asset_subtype = 'stage'
     AND NOT (
       (a.storage_path = '/moodboard-seed/venue_scene/stage/bridgerton-regal.svg'
          AND c.sampled_hex = '#8C6BA6' AND c.tolerance_de = 8)
       OR (a.storage_path = '/moodboard-seed/venue_scene/stage/editorial-cream.svg'
          AND c.sampled_hex = '#D98BA6' AND c.tolerance_de = 12)
       OR (a.storage_path = '/moodboard-seed/venue_scene/stage/elegant-simple-classic.svg'
          AND c.sampled_hex = '#C9A059' AND c.tolerance_de = 9)
       OR (a.storage_path = '/moodboard-seed/venue_scene/stage/modern-minimalist.svg'
          AND c.sampled_hex = '#4A3B45' AND c.tolerance_de = 15)
     );

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      'RA1: a stage colour range is not one of the four measured pairs — %. Every one of these '
      'numbers is a separate measurement against a different neighbour in the drawing. If a value '
      'changed on purpose, re-measure it through the real recolorRGBA at 520px against the SERVED '
      'file before editing this guard.',
      bad;
  END IF;

  -- And tropical heritage carries none.
  SELECT count(*) INTO n
    FROM public.moodboard_asset_color_ranges c
    JOIN public.moodboard_library_assets a ON a.asset_id = c.asset_id
   WHERE a.storage_path = '/moodboard-seed/venue_scene/stage/tropical-heritage.svg';

  IF n <> 0 THEN
    RAISE EXCEPTION
      'RA1: tropical heritage still carries % colour range(s). Its nearest neutral is 3.60 away '
      'in the engine metric and the table CHECK floor is 5, so there is NO legal tolerance for '
      'this drawing. Re-cut the artwork before seeding one; never widen and never lower the CHECK.',
      n;
  END IF;
END $$;

COMMIT;
