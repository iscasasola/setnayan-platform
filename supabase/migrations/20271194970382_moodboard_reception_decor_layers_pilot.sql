-- ============================================================================
-- 20271194970382_moodboard_reception_decor_layers_pilot.sql
--
-- Reception decor AI-image-layer PILOT · 2 zones × 5 style families = 10
-- venue_scene assets + 10 slot-1 color ranges.
--
-- WHY: the reception live preview (`renderVenueSvg` in
-- apps/web/lib/reception-scene.ts) is a flat, hand-coded SVG illustration
-- recolored via simple fill substitution. The owner wants it upgraded to
-- composite real AI-generated decor images per zone, retinted to the
-- couple's palette using the EXISTING Color Range Manipulator engine
-- (apps/web/lib/color-recolor.ts) — the same mechanism figure_attire assets
-- already use, NOT a new blend-mode/filter approach. This migration is
-- explicitly a PILOT capped at 2 zones (Backdrop, Ceiling — the two most
-- visually dominant zones in the composited scene) × the 5 existing style
-- families, to prove the pipeline end-to-end before expanding coverage.
--
-- Schema decision (no new migration needed for the columns themselves):
--   - asset_type    = 'venue_scene'      (already a valid CHECK value)
--   - asset_subtype = 'backdrop' | 'ceiling'   (matches PartId in reception-scene.ts)
--   - style_theme   = one of the 5 MOODBOARD_STYLE_FAMILIES strings — migration
--     20260613000000 made this column nullable *for venue_scene rows that don't
--     have a style* ("venue_scene assets don't have a style theme"), but its
--     CHECK constraint is NOT type-gated: `style_theme IS NULL OR style_theme IN
--     (...)` allows ANY asset_type to carry one of the 5 strings. These pilot
--     rows are the first venue_scene rows to actually populate it — no
--     constraint change required, confirmed by reading the constraint text
--     directly rather than assuming.
--
-- ⚠ HONEST STATUS — GENERATION ONLY, NOT UPLOADED TO R2, NOT YET LIVE:
--   The 10 SVGs were generated this session via the Higgsfield MCP image tool
--   (model recraft_v4_1, model_type=vector, 2k) — the same Recraft V4.1 family
--   already used for the figure_attire library, just invoked through the
--   platform's hosted API rather than apps/web/lib/recraft.ts (no
--   RECRAFT_API_KEY was present in this environment to call that client
--   directly). This environment ALSO has no R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
--   R2_SECRET_ACCESS_KEY — so, unlike the figure_attire seed
--   (20260614000000, which uploaded before writing its seed SQL), these files
--   could NOT be uploaded to the real `setnayan-media` R2 bucket from here.
--
--   The 10 raw SVGs are saved locally in this worktree, untracked, at
--   apps/web/scripts/decor-pilot-output/{zone}/{style-slug}.svg — NOT
--   committed (repo convention keeps generated binaries out of git history;
--   see apps/web/scripts/generate-attire-guide-figures.ts's own /tmp/
--   output-then-upload pattern, which this mirrors).
--
--   storage_path below is the REAL key the files must land at once uploaded
--   (mirrors the figure_attire URL shape: `{R2_PUBLIC_URL}/moodboard-library/
--   venue_scene/{zone}/{style_slug}.svg`) — NOT yet a live URL. To finish:
--     1. Upload the 10 files (aws s3 cp / apps/web/scripts/reupload-attire-
--        figures.ts is a ready-made template for the S3 PutObjectCommand call)
--        to setnayan-media at the exact keys used below.
--     2. Once confirmed live, flip `approved_at` to NOW() on these 10 rows —
--        that's the SAME "draft vs published" gate the schema already uses for
--        every other library asset (moodboard_library_assets_public_read
--        policy requires approved_at IS NOT NULL). No new flag invented.
--
--   Until that upload happens, approved_at is left NULL on purpose: these rows
--   are DRAFT and invisible to the public-read RLS policy + every query this
--   PR adds (getReceptionDecorLayerCatalog filters approved_at IS NOT NULL),
--   so merging this migration cannot break the live app with broken image
--   URLs — the compositing code always falls back to the existing flat SVG
--   until a human completes the upload + approval step above.
--
-- Color-range tagging (Step 3): sampled programmatically, NOT by hand — a
-- one-off Node+sharp script rasterized each SVG and found the largest
-- non-background color cluster (excluding pixels near the exact
-- background_color passed to the generator, and near-white/near-black
-- line-art strokes). toleranceDe = 15, matching the exact value the
-- figure_attire seed (20260614000000) already uses for its slot-1 tags —
-- reused for consistency, not reinvented.
--
-- Cross-references:
--   * apps/web/lib/color-recolor.ts — recolorRGBA / ColorRangeSlot (reused, not reimplemented)
--   * apps/web/lib/reception-decor-layers.ts — the new pure fallback-selection
--     + retint-wrapper module this PR adds
--   * apps/web/app/dashboard/[eventId]/studio/mood-board/actions.ts —
--     getReceptionDecorLayerCatalog() query added in this PR
--   * Migration 20260525000000 — moodboard_library_assets / moodboard_asset_color_ranges base schema
--   * Migration 20260613000000 — style_theme column + its NOT-type-gated CHECK
--   * changelog.d/moodboard-ai-decor-layers-pilot.md
--
-- Idempotent: INSERTs gated on WHERE NOT EXISTS (asset_subtype, style_theme).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Backdrop × 5 styles
-- ---------------------------------------------------------------------------

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'backdrop', 'Backdrop · Elegant · Simple · Classic (Recraft V4.1 vector pilot)',
       'https://media.setnayan.com/moodboard-library/venue_scene/backdrop/elegant-simple-classic.svg', 'higgsfield_generated', 'elegant · simple · classic', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'backdrop' AND style_theme = 'elegant · simple · classic'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'backdrop', 'Backdrop · Bridgerton · Regal (Recraft V4.1 vector pilot)',
       'https://media.setnayan.com/moodboard-library/venue_scene/backdrop/bridgerton-regal.svg', 'higgsfield_generated', 'bridgerton · regal', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'backdrop' AND style_theme = 'bridgerton · regal'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'backdrop', 'Backdrop · Editorial Cream (Recraft V4.1 vector pilot)',
       'https://media.setnayan.com/moodboard-library/venue_scene/backdrop/editorial-cream.svg', 'higgsfield_generated', 'editorial cream', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'backdrop' AND style_theme = 'editorial cream'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'backdrop', 'Backdrop · Tropical Heritage (Recraft V4.1 vector pilot)',
       'https://media.setnayan.com/moodboard-library/venue_scene/backdrop/tropical-heritage.svg', 'higgsfield_generated', 'tropical heritage', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'backdrop' AND style_theme = 'tropical heritage'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'backdrop', 'Backdrop · Modern Minimalist (Recraft V4.1 vector pilot)',
       'https://media.setnayan.com/moodboard-library/venue_scene/backdrop/modern-minimalist.svg', 'higgsfield_generated', 'modern minimalist', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'backdrop' AND style_theme = 'modern minimalist'
);

-- ---------------------------------------------------------------------------
-- Ceiling × 5 styles
-- ---------------------------------------------------------------------------

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'ceiling', 'Ceiling · Elegant · Simple · Classic (Recraft V4.1 vector pilot)',
       'https://media.setnayan.com/moodboard-library/venue_scene/ceiling/elegant-simple-classic.svg', 'higgsfield_generated', 'elegant · simple · classic', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'ceiling' AND style_theme = 'elegant · simple · classic'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'ceiling', 'Ceiling · Bridgerton · Regal (Recraft V4.1 vector pilot)',
       'https://media.setnayan.com/moodboard-library/venue_scene/ceiling/bridgerton-regal.svg', 'higgsfield_generated', 'bridgerton · regal', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'ceiling' AND style_theme = 'bridgerton · regal'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'ceiling', 'Ceiling · Editorial Cream (Recraft V4.1 vector pilot)',
       'https://media.setnayan.com/moodboard-library/venue_scene/ceiling/editorial-cream.svg', 'higgsfield_generated', 'editorial cream', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'ceiling' AND style_theme = 'editorial cream'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'ceiling', 'Ceiling · Tropical Heritage (Recraft V4.1 vector pilot)',
       'https://media.setnayan.com/moodboard-library/venue_scene/ceiling/tropical-heritage.svg', 'higgsfield_generated', 'tropical heritage', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'ceiling' AND style_theme = 'tropical heritage'
);

INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)
SELECT 'venue_scene', 'ceiling', 'Ceiling · Modern Minimalist (Recraft V4.1 vector pilot)',
       'https://media.setnayan.com/moodboard-library/venue_scene/ceiling/modern-minimalist.svg', 'higgsfield_generated', 'modern minimalist', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'ceiling' AND style_theme = 'modern minimalist'
);

-- ---------------------------------------------------------------------------
-- Slot-1 color ranges — the single dominant retintable region per asset,
-- sampled from the actual generated pixels (see script comment above).
-- ---------------------------------------------------------------------------

INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#f7c680', 15, 'draped fabric'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'backdrop' AND a.style_theme = 'elegant · simple · classic'
  AND NOT EXISTS (SELECT 1 FROM public.moodboard_asset_color_ranges r WHERE r.asset_id = a.asset_id AND r.slot_id = 1);

INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#a92193', 15, 'floral wall'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'backdrop' AND a.style_theme = 'bridgerton · regal'
  AND NOT EXISTS (SELECT 1 FROM public.moodboard_asset_color_ranges r WHERE r.asset_id = a.asset_id AND r.slot_id = 1);

INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#d98ba6', 15, 'draped fabric'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'backdrop' AND a.style_theme = 'editorial cream'
  AND NOT EXISTS (SELECT 1 FROM public.moodboard_asset_color_ranges r WHERE r.asset_id = a.asset_id AND r.slot_id = 1);

INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#9cb29a', 15, 'fabric swag'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'backdrop' AND a.style_theme = 'tropical heritage'
  AND NOT EXISTS (SELECT 1 FROM public.moodboard_asset_color_ranges r WHERE r.asset_id = a.asset_id AND r.slot_id = 1);

INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#4a3b45', 15, 'color block'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'backdrop' AND a.style_theme = 'modern minimalist'
  AND NOT EXISTS (SELECT 1 FROM public.moodboard_asset_color_ranges r WHERE r.asset_id = a.asset_id AND r.slot_id = 1);

INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#c9a059', 15, 'draped canopy'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'ceiling' AND a.style_theme = 'elegant · simple · classic'
  AND NOT EXISTS (SELECT 1 FROM public.moodboard_asset_color_ranges r WHERE r.asset_id = a.asset_id AND r.slot_id = 1);

INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#8c6ba6', 15, 'draped canopy'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'ceiling' AND a.style_theme = 'bridgerton · regal'
  AND NOT EXISTS (SELECT 1 FROM public.moodboard_asset_color_ranges r WHERE r.asset_id = a.asset_id AND r.slot_id = 1);

INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#d98ba6', 15, 'draped canopy'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'ceiling' AND a.style_theme = 'editorial cream'
  AND NOT EXISTS (SELECT 1 FROM public.moodboard_asset_color_ranges r WHERE r.asset_id = a.asset_id AND r.slot_id = 1);

INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#9cb29a', 15, 'monstera canopy'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'ceiling' AND a.style_theme = 'tropical heritage'
  AND NOT EXISTS (SELECT 1 FROM public.moodboard_asset_color_ranges r WHERE r.asset_id = a.asset_id AND r.slot_id = 1);

INSERT INTO public.moodboard_asset_color_ranges (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#4a3b45', 15, 'geometric installation'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'ceiling' AND a.style_theme = 'modern minimalist'
  AND NOT EXISTS (SELECT 1 FROM public.moodboard_asset_color_ranges r WHERE r.asset_id = a.asset_id AND r.slot_id = 1);

COMMIT;
