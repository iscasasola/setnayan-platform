-- Pakanta song-delivery pipeline (iteration 0036 · the delivery half).
--
-- Pakanta is a custom song written for the couple. The buy + intake + Suno-brief
-- back-office already exist (20260626000000_iteration_0036_pakanta_intake_drafts);
-- this migration adds the DELIVERY columns the music team writes when the finished
-- song is uploaded, and the auto-adopt flag that makes that song play on the
-- couple's wedding site the moment it lands — with ZERO manual couple step, but
-- WITHOUT ever clobbering a couple who already chose their own site song.
--
-- All columns are ADDITIVE + NULLABLE + backfill-free + IDEMPOTENT. events already
-- has RLS enabled with policies that cover the whole row, so an ALTER ADD COLUMN
-- needs no new policy. Existing rows keep NULL delivery state / adopted=false —
-- harmless (a not-delivered Pakanta).
--
--   pakanta_song_r2_key — the finished song's r2:// ref, uploaded by the music
--     team on a paid + admin-approved PAKANTA order. Read via
--     displayUrlForStoredAsset. NULL = not delivered yet.
--   pakanta_song_status — 'in_production' | 'ready'. Drives the couple Studio
--     owned-states (in-production vs delivered). NULL = no production started.
--   pakanta_song_filename — the original filename, for the "Delivered ✓ {name}"
--     label + the audio preview.
--   pakanta_song_delivered_at — when the music team uploaded it.
--   pakanta_song_adopted_as_site_music — TRUE once this song became the site's
--     background music. The guard against clobbering a couple's own song: if
--     site_bg_music_r2_key is set AND this flag is FALSE, the music is the
--     couple's own and the auto-adopt is SKIPPED.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS pakanta_song_r2_key text,
  ADD COLUMN IF NOT EXISTS pakanta_song_status text
    CHECK (pakanta_song_status IS NULL OR pakanta_song_status IN ('in_production','ready')),
  ADD COLUMN IF NOT EXISTS pakanta_song_filename text,
  ADD COLUMN IF NOT EXISTS pakanta_song_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS pakanta_song_adopted_as_site_music boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.pakanta_song_r2_key IS 'Finished Pakanta song (r2:// ref), uploaded by the music team on a paid/approved PAKANTA order. Read via displayUrlForStoredAsset.';
COMMENT ON COLUMN public.events.pakanta_song_status IS 'Pakanta production state: in_production | ready. Drives the couple Studio owned-states.';
COMMENT ON COLUMN public.events.pakanta_song_filename IS 'Original filename of the delivered Pakanta song — for the Delivered label + audio preview.';
COMMENT ON COLUMN public.events.pakanta_song_delivered_at IS 'When the music team uploaded the finished Pakanta song.';
COMMENT ON COLUMN public.events.pakanta_song_adopted_as_site_music IS 'TRUE once the Pakanta song became the site background music. Guards against clobbering a couple''s own song: site_bg_music set + this FALSE = the couple chose their own.';
