-- hub music tracks
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (IF NOT EXISTS · DROP POLICY IF EXISTS).
--
-- ⚖ OWNER 2026-10-08 (DECISION_LOG "EVENT HUB MUSIC — 'OUR MUSIC' IS A LIST THE
-- ADMIN UPLOADS"): *"background music. where can we upload via admin to add music
-- they can pick?"* The Look restudy's Music tab offers two sources — "Your music"
-- (the couple's own upload, shipped) and "Our music" (this list).
--
-- ── WHY A NEW TABLE AND NOT `reel_music_tracks` ───────────────────────────
-- `reel_music_tracks` (born `patiktok_music_tracks`) is the only other
-- Setnayan-owned track list, and it means something else:
--   · every reel reader (`pickOwnedReelMusic`, lib/guest-stories.ts) takes ANY
--     row with is_active = true as backing music for a rendered video, so a
--     guest-page instrumental filed there would start landing under Patiktok
--     and Guest Story reels;
--   · its `category` CHECK is a dance-genre list (bridgerton · pop · hip_hop ·
--     jazz · acoustic · filipino_pop), not these moods, and `duration_sec` is
--     capped at 240 for a reel;
--   · its rows are seeded by migration with a beat grid — it has no upload.
-- Reusing it would bend one flag (`is_active`) into two meanings.
--
-- ── THE SHAPE ─────────────────────────────────────────────────────────────
-- One row per track. `mood` is a CLOSED list (the nine the owner is making);
-- the label lives in code (apps/web/lib/hub-music.ts). A track may sit with NO
-- mood while the admin reviews a bulk upload — the title is free text ("Velvet
-- Court" matches no mood) — but it cannot be PUBLISHED without one, because the
-- couple's picker lists tracks by mood.
--
-- `r2_key` is the object key in the public media bucket, under `hub-music/`.
-- UNIQUE so two rows can never share a file (removing one would otherwise have
-- to guess whether the other still needs it).
--
-- `duration_seconds` and `file_bytes` are MEASURED on the server from the stored
-- file when the row is written (never typed, never the browser's claim).
-- duration is nullable: a file whose length cannot be read says so, as "—".

CREATE TABLE IF NOT EXISTS public.hub_music_tracks (
  track_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id         TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('M'),
  title             TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  mood              TEXT CHECK (mood IN (
                      'classic_romantic', 'harana', 'garden_rustic',
                      'modern_minimal', 'grand_cinematic', 'beach_sunset',
                      'soft_jazz_reception', 'playful_joyful', 'warm_intimate'
                    )),
  r2_key            TEXT NOT NULL UNIQUE CHECK (r2_key LIKE 'hub-music/%'),
  duration_seconds  INTEGER CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 3600),
  file_bytes        BIGINT NOT NULL CHECK (file_bytes > 0),
  is_published      BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  -- Who added it. A stamp, not ownership: the track outlives the admin's account.
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The picker lists by mood, so a track with no mood has nowhere to appear.
  CONSTRAINT hub_music_tracks_published_has_a_mood
    CHECK (NOT is_published OR mood IS NOT NULL)
);

-- The couple's picker reads the published tracks in mood, then hand order.
CREATE INDEX IF NOT EXISTS hub_music_tracks_published_idx
  ON public.hub_music_tracks (mood, sort_order, title)
  WHERE is_published;

-- RLS AT CREATE TABLE.
ALTER TABLE public.hub_music_tracks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.hub_music_tracks IS
  'Event Hub "Our music" — the instrumental tracks a Setnayan admin uploads at '
  '/admin/hub-music and a couple picks in Look > Music (owner 2026-10-08). One row per '
  'track; the file sits in the public media bucket under hub-music/. Only a published '
  'row (which must carry a mood) is offered to couples. Not reel_music_tracks: that '
  'list backs rendered videos and has its own genre vocabulary.';

-- ── WHO MAY READ AND WRITE IT — Pattern H (static reference data) ──────────
-- RLS_Policy_Pattern.md § 3 H, as `reel_music_tracks` already applies it:
-- signed-in people read the live rows, an admin writes. NOT anon — a guest's
-- page is rendered by the server, which resolves the one track an event picked.
--
-- `created_by` is NOT in the SELECT grant: a couple browsing music has no
-- business reading which staff account uploaded a track. The admin page reads
-- with the service role.
REVOKE ALL ON public.hub_music_tracks FROM PUBLIC;
REVOKE ALL ON public.hub_music_tracks FROM anon;
REVOKE ALL ON public.hub_music_tracks FROM authenticated;
GRANT SELECT (
  track_id, public_id, title, mood, r2_key, duration_seconds, file_bytes,
  is_published, sort_order, created_at, updated_at
) ON public.hub_music_tracks TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hub_music_tracks TO authenticated;
GRANT ALL ON public.hub_music_tracks TO service_role;

DROP POLICY IF EXISTS hub_music_tracks_read_published ON public.hub_music_tracks;
CREATE POLICY hub_music_tracks_read_published ON public.hub_music_tracks
  FOR SELECT TO authenticated
  USING (is_published = TRUE);

DROP POLICY IF EXISTS hub_music_tracks_admin_write ON public.hub_music_tracks;
CREATE POLICY hub_music_tracks_admin_write ON public.hub_music_tracks
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
