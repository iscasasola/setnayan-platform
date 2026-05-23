-- ============================================================================
-- 20260613000000_iteration_0010_attire_guide_style_theme_column.sql
--
-- Wedding Attire Guide · add `style_theme` column to moodboard_library_assets
-- so the 5-style × 10-role figure library can be queried per active style.
--
-- WHY (owner directive 2026-05-23 PM, third pass): owner committed to Recraft
-- V3 + full 5-themed-set library (50 figures: 5 styles × 10 RoleKey entries).
-- The WAG style picker (PR #453) toggles between 5 STYLE_OPTIONS: elegant·
-- simple·classic / bridgerton·regal / editorial cream / tropical heritage /
-- modern minimalist. When the host clicks a chip, the figure SET should swap
-- too — not just the canvas backdrop + arch decoration. This column buckets
-- each figure_attire row into one of the 5 styles so RoleCluster can resolve
-- (role, current_style) → asset lookup at render time.
--
-- WHY nullable + CHECK (vs NOT NULL): venue_scene assets don't have a style
-- theme (they're location-feel-pillar assets, not figure-attire-pillar). The
-- column is nullable so existing venue_scene rows aren't forced into a
-- meaningless style bucket. The CHECK constraint allows NULL OR one of the
-- 5 allowed style strings — strict for figure_attire, NULL-permissive for
-- venue_scene. Application-layer code enforces NOT NULL for figure_attire
-- rows at INSERT time (the Recraft generation script in apps/web/scripts/
-- generate-attire-guide-figures.ts will always pass a style_theme).
--
-- WHY the 5 specific strings: they match the STYLE_OPTIONS const in
-- wedding-attire-guide.tsx exactly so the client-side picker's `style`
-- state value can be used directly as the lookup key. Matching strings
-- avoids a translation layer between UI label and DB enum.
--
-- WHY index on (asset_subtype, style_theme): the WAG query pattern is
-- "fetch all figure_attire rows for this event, group by (subtype, style)"
-- so the page server-component can build the assetsByRoleAndStyle nested
-- map in a single query. The partial index gates on `asset_type =
-- 'figure_attire'` so venue_scene rows don't bloat the index.
--
-- Idempotent. ALTER TABLE ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF
-- EXISTS + ADD CONSTRAINT for the CHECK so re-running is safe.
--
-- Cross-references:
--   * Migration 20260525000000 — moodboard_library_assets base schema
--   * Migration 20260611000000 — Pexels photo seed (retired by 20260612000000)
--   * Migration 20260612000000 — retire-pexels migration that freed the slot
--     for the new Recraft seed
--   * apps/web/lib/recraft.ts — Recraft API client (lands in same PR)
--   * apps/web/scripts/generate-attire-guide-figures.ts — generation script
--     that populates this column when the Recraft key is in hand
--   * CLAUDE.md 2026-05-23 row "Wedding Attire Guide arc" — full PR lineage
-- ============================================================================

BEGIN;

ALTER TABLE public.moodboard_library_assets
  ADD COLUMN IF NOT EXISTS style_theme TEXT;

ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_style_theme_check;

ALTER TABLE public.moodboard_library_assets
  ADD CONSTRAINT moodboard_library_assets_style_theme_check
  CHECK (
    style_theme IS NULL
    OR style_theme IN (
      'elegant · simple · classic',
      'bridgerton · regal',
      'editorial cream',
      'tropical heritage',
      'modern minimalist'
    )
  );

-- Partial index — only figure_attire rows are buckted by style; venue_scene
-- rows are scanned without the index because they don't have a style_theme.
CREATE INDEX IF NOT EXISTS idx_moodboard_library_assets_style_theme
  ON public.moodboard_library_assets(asset_subtype, style_theme)
  WHERE asset_type = 'figure_attire'
    AND approved_at IS NOT NULL
    AND retired_at IS NULL;

COMMIT;
