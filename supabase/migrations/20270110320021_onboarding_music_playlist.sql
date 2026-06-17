-- ============================================================================
-- 20261014000000_onboarding_music_playlist.sql
--
-- Onboarding background music → PLAYLIST (owner 2026-06-09). The wedding
-- onboarding's background music was a single track (20260925000001's
-- onboarding_bg_music_r2_key). The owner wants to add a couple of songs so that
-- when one ends the next plays (and the set loops). This adds an ORDERED list
-- column and backfills the existing single track into it.
--
--   onboarding_bg_music_r2_keys text[]  — ordered playlist of r2:// refs.
--   Position in the array IS the play order; the player advances on `ended` and
--   wraps to the first track. Empty array = no music (player never mounts).
--
-- The legacy singular column (onboarding_bg_music_r2_key) is kept and still
-- written as the FIRST track for backward compatibility / rollback safety — the
-- read path prefers the array and falls back to the singular when the array is
-- empty. The _enabled master toggle is unchanged. Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS onboarding_bg_music_r2_keys TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: lift the existing single track into the new ordered list so the
-- onboarding keeps its current music the moment this lands (before the owner
-- touches the admin form).
UPDATE public.platform_settings
   SET onboarding_bg_music_r2_keys = ARRAY[onboarding_bg_music_r2_key]
 WHERE onboarding_bg_music_r2_key IS NOT NULL
   AND onboarding_bg_music_r2_key <> ''
   AND COALESCE(array_length(onboarding_bg_music_r2_keys, 1), 0) = 0;

COMMENT ON COLUMN public.platform_settings.onboarding_bg_music_r2_keys IS
  'Ordered playlist of r2:// refs for the onboarding background music (owned / AI-generated only). Array order = play order; the player advances on track end and loops the set. Empty = no music. Supersedes the singular onboarding_bg_music_r2_key (kept as the first track for back-compat).';

COMMIT;
