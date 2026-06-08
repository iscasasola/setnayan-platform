-- ============================================================================
-- 20260925000001_platform_settings_onboarding_music.sql
--
-- Onboarding background music (owner 2026-06-08). Instead of committing an
-- audio file, the owner uploads an OWNED / AI-generated track (e.g. a Suno
-- Premier instrumental) through /admin/settings; the wedding onboarding
-- (/onboarding/wedding) streams it as a low-volume, tap-to-start, mute-able
-- background soundtrack. Stored on the platform_settings singleton (id=1).
--
-- The music rule still holds — Setnayan serves whatever is uploaded, so the
-- admin uploader's helper text instructs an owned/licensed track only. NULL
-- key = no music (the player simply never mounts). Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS onboarding_bg_music_r2_key  TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_bg_music_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.platform_settings.onboarding_bg_music_r2_key IS
  'r2:// ref to the owner-uploaded onboarding background-music track (owned / AI-generated only). NULL = no music.';
COMMENT ON COLUMN public.platform_settings.onboarding_bg_music_enabled IS
  'Master toggle for the onboarding background-music player. Plays only when TRUE AND a track is set.';

COMMIT;
