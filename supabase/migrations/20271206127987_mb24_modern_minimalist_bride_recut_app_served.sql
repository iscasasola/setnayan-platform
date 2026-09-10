-- MB24 · the modern-minimalist bride gets her gown back.
--
-- MB23 (`20271205919528`) DELETED this asset's colour range, and was right to.
-- Its gown was filled `#ECEBE7` — byte-identical to a full-canvas backdrop
-- `<path>` in the same file, ΔE 0.0 — so to `recolorRGBA` the dress and the page
-- behind her were one region. Every (sampled_hex, tolerance) pair caught both or
-- neither. That is an ARTWORK defect, and MB23 correctly refused to paper over
-- it with a number.
--
-- The artwork has now been re-cut, so the range can come back.
--
-- ── WHAT CHANGED IN THE FILE ────────────────────────────────────────────────
-- Exactly one edit: the full-canvas backdrop path
--   `M 0 0 L 2048 0 L 2048 2048 L 0 2048 z` filled `rgb(236,235,231)`
-- was removed and an XML comment left in its place saying why. 276 `<path>`s
-- became 275; no `<rect>`, no raster, nothing else touched. The surround is now
-- genuinely transparent, which is the shape the other 30 backdrop-free figures
-- already have.
--
--   apps/web/public/moodboard-seed/figure_attire/modern-minimalist/bride.svg
--   sha256 5535e693a9e31d7b4ecc8c2dafb1a708fc3b41d690224a9f795386f234059fd0
--
-- ── PART A · app-served, like the florals ───────────────────────────────────
-- The row still points at the R2 bucket. It moves to a path this app serves
-- itself, matching the live `/moodboard-seed/florals/*.webp` precedent seeded by
-- `20260927000000` — same-origin, canvas-recolourable with no CORS negotiation,
-- and versioned with the code that reads it.
--
-- 🔑 DELIBERATELY NOT AN R2 RE-UPLOAD. Overwriting the same key on `r2.dev`
-- would be served stale from browser caches for as long as they hold it, and it
-- would leave the new artwork outside the repo — which is the debt MB14 still
-- carries. A file in `public/` is reviewable in the diff that changes it.
--
-- ⚠ THE UPDATE ASSERTS ITS OWN BLAST RADIUS. Addressed by storage_path suffix
-- (stable, and identical in prod and in the PGlite replay, which has no prod
-- UUIDs) rather than by asset_id. A suffix match is only safe if it is UNIQUE,
-- so this refuses to apply on 0 rows (the asset moved or was renamed — a silent
-- no-op would leave the couple on the old R2 file forever) and on 2+ rows (the
-- suffix caught a sibling; `bride_royal.svg` and `bridesmaids.svg` are real rows
-- one character away). Neither is a migration that should merge green.
--
-- Idempotent: the new path ALSO ends in the matched suffix, so a re-run matches
-- the same single row and sets the same value.

DO $$
DECLARE
  matched INTEGER;
BEGIN
  SELECT count(*) INTO matched
    FROM public.moodboard_library_assets
   WHERE asset_type = 'figure_attire'
     AND storage_path LIKE '%figure_attire/modern-minimalist/bride.svg';

  IF matched <> 1 THEN
    RAISE EXCEPTION
      'MB24 expected exactly ONE figure_attire asset whose storage_path ends in '
      '"figure_attire/modern-minimalist/bride.svg", found %. On 0 the asset was renamed or '
      'removed and this migration would silently leave the couple on the stale R2 file; on '
      '2+ the suffix is catching a sibling row and this would repoint more than the bride. '
      'Fix the match, do not widen it.', matched;
  END IF;

  UPDATE public.moodboard_library_assets
     SET storage_path = '/moodboard-seed/figure_attire/modern-minimalist/bride.svg'
   WHERE asset_type = 'figure_attire'
     AND storage_path LIKE '%figure_attire/modern-minimalist/bride.svg';
END $$;

-- ── PART B · the colour range comes back, MEASURED ──────────────────────────
-- Re-measured 2026-09-05 on a 520px raster of the re-cut file (the component's
-- own MAX_PREVIEW_PX), through the real `recolorRGBA`. Opaque coverage 32.21% of
-- the frame; the other 67.79% is alpha 0, so no tolerance can repaint it —
-- `recolorRGBA` never writes the alpha channel.
--
-- Distance from `#ECEBE7`, by opaque pixel population:
--
--   ΔE 0.0    #ECEBE7   20.80% of frame   the gown body
--   ΔE 9.7    #D3D2D1    3.23%            its main shading
--   ΔE 12.0   #CDCCCC    0.04%            deeper folds
--   ΔE 15.6   #C6C2C0    0.14%            the deepest folds
--   ── the gown and every tone of its shading end here, at ΔE 19 ──
--   ΔE 20.8   #CEB19F    2.66%            SKIN — shoulders, arms, face
--   ΔE 31.1   #B79680    0.11%            skin in shadow
--   ΔE 72.8+  #3B2E29 …  0.47%            hair
--
-- 🔑 THE BAND IS (19, 20.8), AND IT IS A CLIFF, NOT A SLOPE. Matched skin pixels
-- as a share of all skin, by tolerance: 0.67% at 16 · 1.31% at 19 · 1.64% at 20 ·
-- 67.49% at 22. Below 21 the only warm pixels caught are the anti-aliased seam
-- where gown meets arm; at 21 the flat skin fill itself enters and her shoulders
-- turn the palette colour.
--
-- TOLERANCE 16, chosen with the margin on the side that matters:
--   • it catches 92.30% of the gown INCLUDING all three shading tones, so the
--     folds recolour with the body rather than staying stock white — the
--     "white dress with pink trim" MB23 warned about is what a too-tight
--     tolerance produces, and 10–12 (MB23's retuned values, the brief's starting
--     point) measurably drops the #C6C2C0 folds at ΔE 15.6.
--   • it sits 4.8 ΔE below the skin fill, so the cliff at 21 is not near.
-- Not inherited from another asset; measured on this one.
--
-- (`tolerance_de` is CHECKed 5–30 at the table, so a runaway value is refused by
-- the schema as well as by the pixel guard.)

DO $$
DECLARE
  touched INTEGER;
BEGIN
  INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
  SELECT a.asset_id, 1, '#ECEBE7', 16, 'attire'
    FROM public.moodboard_library_assets a
   WHERE a.asset_type = 'figure_attire'
     AND a.storage_path = '/moodboard-seed/figure_attire/modern-minimalist/bride.svg'
      ON CONFLICT (asset_id, slot_id)
      DO UPDATE SET sampled_hex  = EXCLUDED.sampled_hex,
                    tolerance_de = EXCLUDED.tolerance_de,
                    region_label = EXCLUDED.region_label;

  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched <> 1 THEN
    RAISE EXCEPTION
      'MB24 expected to write exactly ONE colour range for the modern-minimalist bride, '
      'wrote %. Part A above guarantees the row exists and is unique, so this can only mean '
      'the served path and the matched suffix have drifted apart.', touched;
  END IF;
END $$;

-- The veil shares the gown's fill and recolours with it. That is correct: it is
-- attire, and a veil that stayed stock white while the gown turned burgundy
-- would read as a rendering fault. Her skin and hair are outside the band by
-- measurement, not by luck.
--
-- Pinned by
-- `app/dashboard/[eventId]/studio/mood-board/_components/the-background-never-wears-the-palette.test.ts`,
-- which rasterises the file THIS migration names, at the tolerance THIS
-- migration writes — both parsed out of this file rather than retyped, so
-- editing either number re-runs the guard against it.
