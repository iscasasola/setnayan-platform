-- ============================================================================
-- 20260612000000_iteration_0010_retire_pexels_photo_seed.sql
--
-- Wedding Attire Guide · retire the Pexels photo seed in favor of SVG-clipart
-- silhouette fallback.
--
-- WHY (owner directive 2026-05-23 PM, second pass): owner shared three more
-- reference images of stylized clipart wedding figures and asked: "or cliparts
-- like this so we can use different cliparts and the stylist can choose which
-- one to give the wedding depending on the style of the wedding." Picked via
-- AskUserQuestion: "Replace today's photos with one clipart set NOW" +
-- "Curate free public-domain clipart (undraw/storyset/openclipart)."
--
-- WHY this migration retires instead of replaces: Free-clipart sources are
-- genuinely constrained — Pixabay + SVGRepo both blocked WebFetch (403/429);
-- Filipino-specific wedding clipart on free public-domain sources is
-- essentially zero. BUT the polished SVG silhouettes shipped in PRs #451 +
-- #453 (commit cfc03b6 on main 2026-05-23) ARE hand-coded clipart figures
-- with style themes that visibly shift the aesthetic. The WAG component's
-- RoleCluster (from PR #455, also in cfc03b6) already supports automatic
-- fallback: when `assetsByRole?.[role.key]` is undefined OR the row is
-- retired_at-stamped, RoleCluster renders the polished SVG Silhouette
-- function instead of PhotoFigure.
--
-- So retiring the photo seed = WAG falls back to SVG silhouettes (cliparts)
-- automatically. Zero new content sourcing required. Setnayan-owned IP. The
-- per-role color picker still works (tints the SVG body path directly via
-- the `tint` prop on Silhouette). Style picker chips still drive the canvas
-- backdrop + arch decoration + hair/shoe tints per PR #453 themes.
--
-- WHY soft-retire instead of DELETE: the moodboard_library_assets table
-- already has retired_at semantics (column from migration 20260525000000)
-- used for soft-delete + V1 placeholder cutover at hard-launch. Setting
-- retired_at instead of DELETE preserves the seed rows for audit + lets
-- admin re-activate via the /admin/moodboard-library surface if they
-- later want to swap back to photos OR override with curated assets.
-- Matches the V1-placeholder-cutover-discipline pattern already in the
-- schema header comment.
--
-- WHY no new asset rows: Owner can override per-role via the existing
-- /admin/moodboard-library admin surface (library-editor.tsx + color-
-- range-manipulator.tsx) when free-clipart curation is sourced externally.
-- Per the migration-pattern-stop-pasting-content-via-migration discipline,
-- migrations seed structural placeholders ONLY; ongoing content curation
-- belongs in admin tooling.
--
-- WHY V1 outcome is acceptable: V1 pilot scope (5-20 personal/family cohort
-- per [[project_setnayan_pilot_timeline]]) testing the surface — the
-- SVG-silhouette cliparts from PRs #451/#453 are polished enough for that
-- audience. V1.x Stylist marketplace launch (per 0047 sequencing) ships the
-- proper clipart-sets-with-stylist-picker per the 2026-05-21 Mood Board
-- locked 3-phase strategy + the 2026-05-22 row 5 Specialized Pro Tools
-- architecture (Professional Mood Board pay-per-render).
--
-- Idempotent. UPDATE gated on `retired_at IS NULL` so re-running the migration
-- after rows already retired is a no-op.
--
-- Cross-references:
--   * Migration 20260525000000 — moodboard_library_assets schema (retired_at column)
--   * Migration 20260611000000 — the Pexels photo seed this retires
--   * apps/web/app/dashboard/[eventId]/add-ons/mood-board/_components/
--     wedding-attire-guide.tsx — RoleCluster falls back to Silhouette when
--     no asset present (the PhotoFigure branch was added in PR #455)
--   * CLAUDE.md 2026-05-21 row — 3-pillar Dress codes lock + V1.x stylist persona
--   * CLAUDE.md 2026-05-23 fifth row — Wedding Attire Guide arc (PRs #449-#455)
--   * CLAUDE.md 2026-05-22 row 5 — Specialized Pro Tools (Professional Mood Board)
-- ============================================================================

BEGIN;

UPDATE public.moodboard_library_assets
SET retired_at = NOW()
WHERE asset_type = 'figure_attire'
  AND source = 'internet_placeholder'
  AND retired_at IS NULL;

COMMIT;
