-- ─────────────────────────────────────────────────────────────────────────────
-- A BAND CAN SHOW YOU THEM PLAYING IT
--
-- Owner, 2026-08-18: *"we have a song bank of all music. bands/musicians can
-- pick the song they can do. and they can link videos of them performing that
-- song via youtube link."*
--
-- The first half shipped: `vendor_songs` is a band's pick-list against the
-- shared bank. The second half had nowhere to live — a band could say "I can
-- play this" and could not show it, so a couple choosing between three bands who
-- all claim Forevermore had nothing to compare.
--
-- 🔑 STORED ON THE PICK, NOT ON THE SONG. The video belongs to (this band, this
-- song) — two bands playing Forevermore have two different videos, and the
-- shared bank row must stay neutral. Putting it on `songs` would have let one
-- band's recording become every band's.
--
-- ⛔ NO CHECK CONSTRAINT ON THE URL SHAPE, deliberately. The app validates with
-- `lib/video-embed.ts parseVideoLink` — which already accepts YouTube, Vimeo,
-- Facebook, TikTok and Instagram — and a database CHECK that encoded today's
-- platform list would refuse tomorrow's, loudly, to a band who did nothing
-- wrong. NOT NULL is not wanted either: most picks will never have a video, and
-- that is the normal state, not a missing one.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.vendor_songs
  ADD COLUMN IF NOT EXISTS performance_url text;

COMMENT ON COLUMN public.vendor_songs.performance_url IS
  'Optional link to THIS band performing THIS song (YouTube and the other hosts '
  'lib/video-embed.ts accepts). Belongs to the pick, not the song: two bands '
  'playing the same song have two different recordings. NULL is the normal '
  'resting state — most picks never have one.';

-- The band owns its own picks; the column follows the row's existing policies.
-- Explicit so a later table-level revoke cannot silently strip it (this repo has
-- paid for that: a table-level REVOKE drops column grants).
GRANT UPDATE (performance_url) ON public.vendor_songs TO authenticated;
