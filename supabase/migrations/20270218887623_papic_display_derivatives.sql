-- 0012 Papic — display + thumbnail DERIVATIVES for cheap, fast galleries.
--
-- Until now every Papic gallery tile presigned the FULL-RES original (or, for
-- clips, the poster). A 250-tile gallery therefore shipped 250 multi-MB
-- originals over the wire — slow to load and expensive to keep as the couple's
-- long-term "memory home". This adds two nullable columns per capture table for
-- server-generated derivatives:
--
--   display_r2_key  — a compressed long-edge-1280 JPEG (q~80) for the lightbox /
--                     full view. For CLIPS this is the poster ref (no transcode).
--   thumb_r2_key    — a long-edge-320 JPEG (q~70) for grid tiles.
--
-- Both store the `r2://bucket/key` ref of the derivative (same bucket as the
-- original). NULL = no derivative yet (legacy rows, generation failure / R2
-- hiccup) — every read site falls back to display_r2_key, then the existing
-- poster/original, so pre-migration rows keep rendering exactly as before.
--
-- Generated best-effort in the capture after() hook (lib/papic-derivatives.ts),
-- AFTER the NSFW screen. A failure is swallowed and leaves the columns NULL — a
-- capture must never break over a missing thumbnail.
--
-- No RLS change: both columns ride each table's existing policies (claimer-own
-- insert/select, couple read via event membership).

ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS display_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS thumb_r2_key TEXT;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS display_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS thumb_r2_key TEXT;

COMMENT ON COLUMN public.papic_photos.display_r2_key IS
  'r2:// ref of the compressed display derivative (long-edge 1280 JPEG q~80). For clips = the poster ref. NULL = not generated yet; readers fall back to r2_object_key.';
COMMENT ON COLUMN public.papic_photos.thumb_r2_key IS
  'r2:// ref of the thumbnail derivative (long-edge 320 JPEG q~70) used for grid tiles. NULL = not generated yet; readers fall back to display_r2_key then the original.';
COMMENT ON COLUMN public.papic_guest_captures.display_r2_key IS
  'r2:// ref of the compressed display derivative (long-edge 1280 JPEG q~80). For clips = the poster ref. NULL = not generated yet; readers fall back to r2_object_key.';
COMMENT ON COLUMN public.papic_guest_captures.thumb_r2_key IS
  'r2:// ref of the thumbnail derivative (long-edge 320 JPEG q~70) used for grid tiles. NULL = not generated yet; readers fall back to display_r2_key then the original.';
