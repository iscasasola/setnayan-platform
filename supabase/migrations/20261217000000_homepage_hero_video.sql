-- ============================================================================
-- 20261217000000_homepage_hero_video.sql
-- Admin-uploaded homepage HERO VIDEO, stored as a scroll-scrub image sequence.
--
-- The owner uploads a short video in /admin/hero-video. The admin's BROWSER
-- extracts frames (Vercel can't run ffmpeg) and uploads them to R2; this row
-- holds the resulting frame URLs + publish flag. The public homepage reads
-- the single published row and renders <HeroVideoScrub> (a frame-by-frame
-- scroll-scrub) in place of the default hero. Falls back to the default hero
-- whenever no row is published.
--
-- Single-row enforcement via CHECK (id = 1), mirroring platform_settings.
-- Read-all RLS (the URLs are public marketing assets, not secrets); writes go
-- through the service-role admin client after an application-level is_admin
-- check (same posture as platform_settings).
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.homepage_hero_config (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),

  -- the original uploaded video (kept for re-extraction / reference)
  video_url            TEXT,
  video_r2_key         TEXT,
  video_mime_type      TEXT,

  -- the extracted scroll-scrub frame sequence (ordered list of public R2 URLs)
  frame_urls           JSONB NOT NULL DEFAULT '[]'::jsonb,
  frame_count          INTEGER NOT NULL DEFAULT 0,
  frame_width          INTEGER,
  frame_height         INTEGER,

  -- end-of-scroll call to action (over the final frame)
  cta_text             TEXT NOT NULL DEFAULT 'Start your wedding planning here — free',
  cta_href             TEXT NOT NULL DEFAULT '/onboarding/wedding',

  -- only a published row with frames is shown on the homepage
  is_published         BOOLEAN NOT NULL DEFAULT FALSE,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_admin_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

INSERT INTO public.homepage_hero_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.homepage_hero_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read — these are public homepage marketing assets, not secrets.
-- Writes are admin-only via the service-role client (see lib/hero-video.ts).
DROP POLICY IF EXISTS homepage_hero_config_read_all ON public.homepage_hero_config;
CREATE POLICY homepage_hero_config_read_all
  ON public.homepage_hero_config FOR SELECT
  TO anon, authenticated
  USING (true);

COMMIT;
