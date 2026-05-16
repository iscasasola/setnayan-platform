-- ============================================================================
-- Iteration 0017 — Patiktok · Phase 5 · Music catalogue
-- ============================================================================
-- Seeds the Setnayan-owned AI music catalogue table that powers the music-
-- selection UX on the Patiktok template detail page. The spec calls for
-- ~400 tracks across 6 categories (Bridgerton · Pop · Hip-hop · Jazz ·
-- Acoustic · TBD); this migration seeds 5 representative tracks per category
-- = 25 rows. The remaining ~375 tracks land via a separate seed script when
-- the Suno Premier catalogue is licensed.
--
-- Adds `music_track_slug` to `patiktok_render_jobs` so the render worker
-- knows which loop to use when compiling the vertical reel.

-- ----------------------------------------------------------------------------
-- 1) patiktok_music_tracks — Setnayan-owned AI music catalogue
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patiktok_music_tracks (
  track_slug      TEXT PRIMARY KEY,
  category        TEXT NOT NULL CHECK (category IN
                    ('bridgerton','pop','hip_hop','jazz','acoustic','filipino_pop')),
  display_name    TEXT NOT NULL,
  description     TEXT,
  bpm             INTEGER NOT NULL CHECK (bpm BETWEEN 40 AND 220),
  duration_sec    INTEGER NOT NULL CHECK (duration_sec BETWEEN 5 AND 240),
  -- Source URL on Suno Premier (or wherever the Setnayan-owned masters live).
  -- Null until the licensed file is ingested.
  source_url      TEXT,
  is_premium      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.patiktok_music_tracks IS
  'Iteration 0017 Phase 5 — Setnayan-owned AI music catalogue used by Patiktok render worker. Spec target: ~400 tracks across 6 categories; this seed has 25 representative rows. Real Suno Premier ingest fills the rest. Loops are 30-60s; render worker stitches into longer compilations.';

ALTER TABLE public.patiktok_music_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anyone_reads_active_tracks ON public.patiktok_music_tracks;
CREATE POLICY anyone_reads_active_tracks ON public.patiktok_music_tracks
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS admin_writes_tracks ON public.patiktok_music_tracks;
CREATE POLICY admin_writes_tracks ON public.patiktok_music_tracks
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2) Music selection on render jobs
-- ----------------------------------------------------------------------------

ALTER TABLE public.patiktok_render_jobs
  ADD COLUMN IF NOT EXISTS music_track_slug TEXT
  REFERENCES public.patiktok_music_tracks(track_slug) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3) Seed — 5 categories × 5 tracks = 25 representative rows
-- ----------------------------------------------------------------------------
-- Categories per spec (0017_patiktok.md § Music selection):
--   Bridgerton / Pop / Hip-hop / Jazz / Acoustic
-- + Filipino Pop added per iteration's PH-first audience.

INSERT INTO public.patiktok_music_tracks
  (track_slug, category, display_name, description, bpm, duration_sec, is_premium, is_active)
VALUES
  -- bridgerton (5)
  ('br_quartet_sunset',       'bridgerton',   'Quartet Sunset',         'Strings + harpsichord · 4/4 swell',         108, 45, FALSE, TRUE),
  ('br_promenade',            'bridgerton',   'Promenade',              'Cello-led waltz · ballroom warm-up',         96, 50, FALSE, TRUE),
  ('br_court_dance',          'bridgerton',   'Court Dance',            'Light pizzicato · upbeat allegro',          118, 40, FALSE, TRUE),
  ('br_first_look',           'bridgerton',   'First Look',             'Solo violin reveal · romantic',              82, 55, TRUE,  TRUE),
  ('br_ballroom_finale',      'bridgerton',   'Ballroom Finale',        'Full ensemble swell · cinematic',           120, 60, TRUE,  TRUE),
  -- pop (5)
  ('pop_summer_glow',         'pop',          'Summer Glow',            'Synthwave + handclaps · 4-on-the-floor',    112, 45, FALSE, TRUE),
  ('pop_neon_hearts',         'pop',          'Neon Hearts',            'Dance-pop with vocal chops',                124, 40, FALSE, TRUE),
  ('pop_starlight',           'pop',          'Starlight',              'Cinematic pop · big drop',                  118, 50, FALSE, TRUE),
  ('pop_skyline',             'pop',          'Skyline',                'Indie-pop · mid-tempo',                     104, 50, FALSE, TRUE),
  ('pop_velvet_drive',        'pop',          'Velvet Drive',           'Synthy mid-tempo cruise',                   106, 55, TRUE,  TRUE),
  -- hip_hop (5)
  ('hh_boom_bap',             'hip_hop',      'Boom Bap',               'Classic 4/4 kick-snare · sample loop',       92, 45, FALSE, TRUE),
  ('hh_trap_celebrate',       'hip_hop',      'Trap Celebrate',         '808 + hi-hat rolls · celebratory',          140, 40, FALSE, TRUE),
  ('hh_old_school_groove',    'hip_hop',      'Old-School Groove',      'Funk-sampled break · syncopated',            96, 50, FALSE, TRUE),
  ('hh_drift',                'hip_hop',      'Drift',                  'Lo-fi hip-hop · chilled',                    80, 60, FALSE, TRUE),
  ('hh_rooftop',              'hip_hop',      'Rooftop',                'Triumphant horns + 808s',                   128, 55, TRUE,  TRUE),
  -- jazz (5)
  ('jz_lounge_swing',         'jazz',         'Lounge Swing',           'Walking bass + brush kit · 4/4 swing',      108, 50, FALSE, TRUE),
  ('jz_velvet_room',          'jazz',         'Velvet Room',            'Sultry piano trio · midnight mood',          84, 60, FALSE, TRUE),
  ('jz_uptown',               'jazz',         'Uptown',                 'Big-band brass · celebration',              132, 45, FALSE, TRUE),
  ('jz_first_dance',          'jazz',         'First Dance',            'Slow piano ballad · romantic',               72, 60, TRUE,  TRUE),
  ('jz_after_hours',          'jazz',         'After Hours',            'Smoky sax · late-night',                     92, 55, FALSE, TRUE),
  -- acoustic (5)
  ('ac_garden_loop',          'acoustic',     'Garden Loop',            'Nylon guitar arpeggio · daytime',           100, 50, FALSE, TRUE),
  ('ac_hand_in_hand',          'acoustic',     'Hand in Hand',           'Acoustic strum + soft kick',                108, 45, FALSE, TRUE),
  ('ac_island_breeze',        'acoustic',     'Island Breeze',          'Ukulele + claps · beach vibe',              112, 45, FALSE, TRUE),
  ('ac_porch_song',           'acoustic',     'Porch Song',             'Slow folk · campfire feel',                  76, 55, FALSE, TRUE),
  ('ac_walking_down',         'acoustic',     'Walking Down',           'Steady fingerpicked guitar · processional', 96, 60, TRUE,  TRUE),
  -- filipino_pop (5)
  ('fp_kundiman_modern',      'filipino_pop', 'Kundiman Modern',        'Modern OPM ballad · warm',                   88, 60, FALSE, TRUE),
  ('fp_manila_lights',        'filipino_pop', 'Manila Lights',          'Synthy P-pop · vibrant',                    118, 50, FALSE, TRUE),
  ('fp_pasundayag',           'filipino_pop', 'Pasundayag',             'Festival OPM · brass accents',              126, 50, FALSE, TRUE),
  ('fp_alay',                 'filipino_pop', 'Alay',                   'Acoustic OPM · tender',                      72, 60, FALSE, TRUE),
  ('fp_pista_celebration',    'filipino_pop', 'Pista Celebration',      'Drumlines + bandurria · energetic',         132, 55, TRUE,  TRUE)
ON CONFLICT (track_slug) DO UPDATE SET
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  bpm = EXCLUDED.bpm,
  duration_sec = EXCLUDED.duration_sec,
  is_premium = EXCLUDED.is_premium,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
