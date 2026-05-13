-- ============================================================================
-- 20260513080000_iteration_0010_mood_board.sql
-- Iteration 0010 Mood Board MVP — per-role palette only.
--
-- Adds events.role_palette (JSONB) and events.mood_board_updated_at. The
-- JSONB stores an object keyed by role group with a hex color value:
--   { "wedding_party": "#C97B4B", "principal_sponsors": "#7C3AED", ... }
--
-- The 20-theme library and Setnayan Guide rule engine remain deferred —
-- see CHANGELOG SPEC IMPACT for what is intentionally not in V1.0.
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS role_palette JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mood_board_updated_at TIMESTAMPTZ;

COMMIT;
