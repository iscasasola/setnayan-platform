-- Same-Day Edit (SDE) deliverable on the day-of/recap surfaces. Mirrors
-- 20261122000000_panood_watch_url.sql. R2-hosted MP4 we serve, stored as a
-- stored-asset ref (encodeR2Ref) + poster + a published-at timestamp.
-- RLS: no new policies — events UPDATE is host-scoped; the public page reads
-- via the admin client like every other landing column. Additive + idempotent.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS sde_video_r2_key   TEXT,
  ADD COLUMN IF NOT EXISTS sde_poster_r2_key  TEXT,
  ADD COLUMN IF NOT EXISTS sde_published_at   TIMESTAMPTZ;
COMMENT ON COLUMN public.events.sde_video_r2_key IS 'R2 stored-asset ref (encodeR2Ref) for the finished Same-Day Edit film. NULL = not yet delivered.';
COMMENT ON COLUMN public.events.sde_poster_r2_key IS 'R2 stored-asset ref for the SDE film poster frame. NULL = video first-frame used.';
COMMENT ON COLUMN public.events.sde_published_at IS 'Timestamp the SDE film was delivered/auto-published. Set by the admin upload action.';
