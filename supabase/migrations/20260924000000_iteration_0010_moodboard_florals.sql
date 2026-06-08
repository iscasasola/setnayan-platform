-- ============================================================================
-- 20260924000000_iteration_0010_moodboard_florals.sql
-- Iteration 0010 Mood Board redesign — Flowers chapter + couple-facing recolor.
--
-- Owner directive 2026-06-08 ("fully redesign the mood board ... color range
-- selector ... alter hue/contrast/brightness or pick from the palette ...
-- Flower? Attires? Reception? Church?"). The redesign promotes the
-- Color Range Manipulator to a couple-facing Recolor Studio and adds a
-- fourth chapter — Flowers — alongside Church, Reception, and Attire.
--
-- This migration is the ONLY schema change the redesign needs. It is small
-- and additive:
--   1. moodboard_library_assets.asset_type  → allow 'florals'
--   2. event_moodboard_saves.pillar         → allow 'florals'
--
-- No change to event_moodboard_saves.palette_snapshot: it is JSONB and now
-- carries a richer per-region shape ({ "<slot>": {mode:'palette'|'adjust', ...} })
-- read backward-compatibly alongside the legacy { "<slot>": "#RRGGBB" } shape.
--
-- RLS unchanged (the existing admin-all + public-read-approved policies on
-- moodboard_library_assets / moodboard_asset_color_ranges already cover
-- florals rows since they key off asset_type-agnostic columns).
--
-- Florals asset_subtype values (free-text, no CHECK): 'bridal_bouquet' |
-- 'entourage_bouquet' | 'ceremony_florals' | 'centerpiece' | 'boutonniere'.
--
-- Idempotent — drops the (re-)named constraints with IF EXISTS before adding.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. moodboard_library_assets.asset_type — add 'florals'
--    The original inline CHECK is named moodboard_library_assets_asset_type_check
--    (Postgres convention for an inline column CHECK). Drop both the original
--    and our re-named constraint so this is safe to re-run.
-- ----------------------------------------------------------------------------
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_asset_type_check;
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_asset_type_check_v2;
ALTER TABLE public.moodboard_library_assets
  ADD CONSTRAINT moodboard_library_assets_asset_type_check_v2
  CHECK (asset_type IN ('venue_scene', 'figure_attire', 'florals'));

-- ----------------------------------------------------------------------------
-- 2. event_moodboard_saves.pillar — add 'florals'
--    Original inline CHECK: event_moodboard_saves_pillar_check.
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_moodboard_saves
  DROP CONSTRAINT IF EXISTS event_moodboard_saves_pillar_check;
ALTER TABLE public.event_moodboard_saves
  DROP CONSTRAINT IF EXISTS event_moodboard_saves_pillar_check_v2;
ALTER TABLE public.event_moodboard_saves
  ADD CONSTRAINT event_moodboard_saves_pillar_check_v2
  CHECK (pillar IN ('location_feel', 'dress_codes', 'florals'));

COMMIT;
