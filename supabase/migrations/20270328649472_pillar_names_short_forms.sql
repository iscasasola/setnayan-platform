-- ============================================================================
-- 20270328649472_pillar_names_short_forms.sql
-- Pillar display names reverted to SHORT forms (owner 2026-06-30 "fix the
-- naming accordingly"): Likhaan→Likha · Planuhan→Plano · Surian→Suri.
-- (Ala Ala + Tiangge unchanged.) Reverses the 2026-06-29 "-an = place" rename.
--
-- Realigns the homepage_background_videos dock-slot labels + pillar_key seeded
-- by 20270328031951 (which seeded the long forms). The prod rows were already
-- updated via MCP on 2026-06-30; this migration keeps fresh installs + the repo
-- history in sync. Idempotent — re-running is a no-op once the labels match.
-- ============================================================================

BEGIN;

UPDATE public.homepage_background_videos
  SET pillar_key = 'likha', label = 'Likha · Creative Studio'
  WHERE slot = 2 AND pillar_key = 'likhaan';

UPDATE public.homepage_background_videos
  SET pillar_key = 'plano', label = 'Plano · Planner'
  WHERE slot = 3 AND pillar_key = 'planuhan';

UPDATE public.homepage_background_videos
  SET pillar_key = 'suri', label = 'Suri · Setnayan AI'
  WHERE slot = 4 AND pillar_key = 'surian';

COMMIT;
