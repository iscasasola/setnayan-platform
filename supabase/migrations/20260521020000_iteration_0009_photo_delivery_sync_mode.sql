-- Iteration 0009 — per-event sync mode for Photo Delivery to Google Drive.
-- Added 2026-05-20 per owner clarification (see CLAUDE.md decision log row 446).
--
-- The 0009 R2 → couple's Drive pipeline supports two timing models, set per event:
--
--   'manual_release' (default) — Couple clicks "Release to Drive" via the
--     0009 setup panel after the existing 7-day review window. Background job
--     pushes the archive (photos, videos, Auto-Recap, XMP/EXIF metadata) in
--     batches. Matches the original 0009 spec workflow; backward-compatible
--     for existing events.
--
--   'auto_sync' (opt-in) — Every photo that lands in R2 streams to the
--     couple's Drive in real-time throughout the event. Papic captures from
--     iteration 0012 (in R2-default storage mode) and photographer uploads
--     alike. Couple sees archive grow live; no release gate.
--
-- The Photo Delivery background job (still pending — see App_Build_Status
-- row 0009 + API_Integration_Checklist #19g) branches on this column to
-- decide whether to wait for events.photos_released_at or fire per-photo
-- upload jobs on `photos` INSERT events.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS photo_delivery_sync_mode TEXT NOT NULL DEFAULT 'manual_release'
  CHECK (photo_delivery_sync_mode IN ('manual_release', 'auto_sync'));

COMMENT ON COLUMN events.photo_delivery_sync_mode IS
  'Iteration 0009: per-event sync mode for R2 -> couple''s Drive pipeline. ''manual_release'' (default) = couple clicks Release after review; ''auto_sync'' = photos stream to Drive in real-time as they land in R2. Background job branches on this column to choose between release-trigger and per-photo-insert-trigger.';
