-- papic clip web copy at capture
--
-- Storage PR-1 (Papic_One_Pool_Model_Spec §0 · clip-web-copy-at-capture): a
-- small (~0.5 MB) H.264 "web copy" of every clip is produced client-side at
-- capture and uploaded alongside the raw. Play surfaces then serve the small
-- copy (resolvePlayRef prefers clip_web_r2_key), and a later PR (the full-res
-- drop, PR-2) can retire the heavy raw clip once a durable web copy exists.
--
-- This migration only ADDS the two nullable columns to BOTH capture tables.
-- NULL is the normal transitional / failed-transcode state (the raw stays the
-- only playable copy). No RLS change — new columns on existing tables inherit
-- each table's policies. Additive + idempotent (ADD COLUMN IF NOT EXISTS), safe
-- to auto-apply ahead of the code that populates them.
--
--   clip_web_r2_key — r2://bucket/key of the compressed, playable web copy.
--   clip_web_bytes  — the web copy's real object size (drives PR-2 cost
--                     telemetry + its byte-floor / HEAD-size custody check).

ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS clip_web_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS clip_web_bytes  bigint;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS clip_web_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS clip_web_bytes  bigint;
