-- events_std_media
--
-- Save-the-Date Step-3 "Video / Gallery Photo" (iteration 0024 · 2026-06-19).
-- The couple's media choice for the film's closing beat, as a small JSONB:
--   { "type": "gallery" | "video", "videoKey": "<r2 ref>", "nsfw": "pending"|"approved"|"rejected" }
--   - gallery → use the couple's existing photos (events.our_photos) as the
--               closing gallery (the current behaviour). videoKey absent.
--   - video   → the couple uploaded a video (videoKey = R2 ref). It plays as a
--               locked real-time island in the film. NSFW-screened before it goes
--               live (platform lock — see PR-B); `nsfw` tracks that gate.
-- NULL = not chosen → gallery (the existing closing beat). Resolution +
-- validation lives in lib/save-the-date-content.ts.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS std_media JSONB;

COMMENT ON COLUMN public.events.std_media IS
  'STD Step-3 media: {type: gallery|video, videoKey?, nsfw?}. Video is NSFW-gated before live. Iteration 0024.';
