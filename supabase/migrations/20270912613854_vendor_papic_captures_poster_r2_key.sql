-- Vendor documentation clips → gallery tiling. The vendor capture route already
-- EXTRACTS a clip's poster frame, uploads it to R2 (…-poster.jpg), and NSFW-screens
-- it — but there was no column to persist the poster's key, so a vendor clip had no
-- still to tile in the event gallery (compile v1 was photos-only). This adds the
-- column; the route now stores the key, and fetchPapicGallery uses it as the clip
-- tile (playback stays the clip original). Counsel-gated lane (unchanged).

BEGIN;

ALTER TABLE public.vendor_papic_captures
  ADD COLUMN IF NOT EXISTS poster_r2_key TEXT;

COMMENT ON COLUMN public.vendor_papic_captures.poster_r2_key IS
  'The clip poster frame (r2://… JPEG) — the still tile for a vendor clip in the gallery, and the NSFW-screen proxy. NULL for photos and for any posterless clip (which never surfaces — nsfw_checked stays false).';

COMMIT;
