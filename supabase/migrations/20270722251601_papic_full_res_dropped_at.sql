-- 3-month full-res drop — retention marker (owner 2026-07-11)
-- (Pricing.md § 2.1 retention model · DECISION_LOG 2026-07-10/11 · build plan WS2)
--
-- After the free full-res window (default 90 days), the sweep deletes OUR R2
-- copy of the full-res ORIGINAL and stamps `full_res_dropped_at`. The couple's
-- Google Drive copy is NEVER touched (core invariant); the forever web copy
-- (display/thumb AVIF) is kept, so the gallery is unaffected. This column is the
-- idempotency + audit marker: a stamped row is skipped by the sweep and readers
-- know the on-us original is gone (fall back to the web copy / the couple's Drive).
--
-- ⚠ PHOTOS ONLY. A CLIP's r2_object_key IS the playable video (no compressed
-- video web copy exists), so the sweep must never drop clips — that's enforced
-- in the app (lib/papic-fullres-drop.ts), not here. Additive + idempotent.

ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS full_res_dropped_at TIMESTAMPTZ;
ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS full_res_dropped_at TIMESTAMPTZ;

COMMENT ON COLUMN public.papic_photos.full_res_dropped_at IS
  'When we deleted OUR R2 full-res original after the free window (3-month drop, owner 2026-07-11). NULL = original still on R2. NEVER touches the couple''s Drive copy; the web copy (display/thumb) is kept. Photos only.';
COMMENT ON COLUMN public.papic_guest_captures.full_res_dropped_at IS
  'When we deleted OUR R2 full-res original after the free window (3-month drop). NULL = still on R2. Photos only — clips are never dropped (r2_object_key is the video).';

-- Sweep-support partial indexes: the not-yet-dropped photos ordered by capture
-- age (the sweep scans oldest-first for eligibility).
CREATE INDEX IF NOT EXISTS papic_photos_fullres_sweep_idx
  ON public.papic_photos (captured_at)
  WHERE full_res_dropped_at IS NULL AND photo_type = 'photo';
CREATE INDEX IF NOT EXISTS papic_guest_captures_fullres_sweep_idx
  ON public.papic_guest_captures (captured_at)
  WHERE full_res_dropped_at IS NULL;
