-- 0012 Papic — NSFW screening for video CLIPS via a poster frame.
--
-- The always-on NSFW screen (lib/nsfw-screen.ts, PR #1244) classifies still
-- images only; papic_photos rows with photo_type='clip' were skipped and
-- stayed 'unscreened' forever. Clips now ship a client-extracted poster JPEG
-- (first decoded frame) alongside the video bytes; the background screen
-- classifies the POSTER and lands the verdict in the clip row's existing
-- moderation_state column ('unscreened' → 'clean' | 'nsfw_blocked').
--
-- poster_r2_key stores the `r2://bucket/key` ref of that poster frame. NULL
-- means no poster was available (legacy clips, extraction failure) — those
-- clips remain 'unscreened', and every guest-facing surface already excludes
-- clips structurally (wall_ingest gate, guest-live-gallery photo_type filter,
-- editorial hero filter), so unscreened clips are never guest-visible.
--
-- No RLS change: poster_r2_key rides papic_photos' existing policies
-- (claimer-own insert/select, couple read via event membership).

ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS poster_r2_key TEXT;

COMMENT ON COLUMN public.papic_photos.poster_r2_key IS
  'r2:// ref of the client-extracted poster frame for photo_type=''clip'' rows. The NSFW screen classifies this frame as the clip''s proxy; NULL = no poster (clip stays unscreened and off all guest surfaces).';
