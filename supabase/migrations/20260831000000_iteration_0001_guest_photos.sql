-- ============================================================================
-- 20260831000000_iteration_0001_guest_photos.sql
-- Iteration 0001 — Guest photos (grid display layer).
--
-- The couple's guest list moves to a photo-card grid. Guests get a DISPLAY
-- photo sourced from their Gmail-login avatar (captured at join) or an RSVP
-- selfie. These columns hold only the display layer.
--
-- The face-recognition asset + biometric consent live in a SEPARATE table
-- (see 20260901000000_iteration_0012_guest_face_enrollments.sql) because a
-- Gmail avatar is display-only and is never face-recognition grade — only a
-- real selfie enrolls.
--
-- Photo priority is enforced in the application writers (no DB trigger):
--   selfie > couple_upload > oauth_google > NULL (initials fallback)
-- Each writer guards with a WHERE clause on photo_source.
-- ============================================================================

BEGIN;

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS photo_url            TEXT,
  ADD COLUMN IF NOT EXISTS photo_source         TEXT,
  ADD COLUMN IF NOT EXISTS photo_updated_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photo_set_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Constrain photo_source to the known set. Added separately (not inline on
-- ADD COLUMN) so a re-run that finds the column already present still lands
-- the constraint exactly once.
DO $$ BEGIN
  ALTER TABLE public.guests
    ADD CONSTRAINT guests_photo_source_check
    CHECK (photo_source IS NULL OR photo_source IN ('oauth_google', 'selfie', 'couple_upload'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.guests.photo_url IS
  'Display photo: r2://setnayan-media/... ref, OR a raw Google avatar URL (when photo_source=oauth_google), OR NULL -> initials fallback in the grid.';
COMMENT ON COLUMN public.guests.photo_source IS
  'oauth_google (Gmail avatar, display-only) | selfie (RSVP, face-rec grade) | couple_upload. Priority: selfie > couple_upload > oauth_google.';
COMMENT ON COLUMN public.guests.photo_set_by_user_id IS
  'Audit: the authenticated user who set the current photo (NULL for QR-only guests / system writes).';

COMMIT;
