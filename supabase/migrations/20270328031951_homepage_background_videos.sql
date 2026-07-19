-- ============================================================================
-- 20270328031951_homepage_background_videos.sql
-- Admin-uploaded homepage BACKGROUND VIDEOS — six plain looping clips.
--
-- The owner uploads up to six short background videos in
-- /admin/background-videos:
--   • slot 0  — the MAIN homepage background video (the looping hero).
--   • slots 1-5 — the five PILLAR "icon" videos shown in the bottom dock
--                 (Ala Ala · Likhaan · Planuhan · Surian · Tiangge).
--
-- Unlike homepage_hero_config (a scroll-scrub stored as an extracted JPEG
-- frame sequence), these are PLAIN looping <video> files: we store only the
-- uploaded clip's R2 key + mime, and the read path (lib/background-videos.ts)
-- resolves a browser-loadable URL per render (presigned today, clean public
-- URL once R2_PUBLIC_URL points at the media bucket's public domain) — the
-- same posture as the hero frames.
--
-- One row PER SLOT, seeded 0-5 (CHECK pins the slot range). Read-all RLS (the
-- URLs are public marketing assets, not secrets); writes go through the
-- service-role admin client after an application-level is_admin check — the
-- same posture as homepage_hero_config / platform_settings.
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.homepage_background_videos (
  slot                 SMALLINT PRIMARY KEY CHECK (slot BETWEEN 0 AND 5),

  -- Stable identity for the slot's role. NULL for the main (slot 0) hero;
  -- a kebab pillar key for the five dock icons. Drives the homepage dock label
  -- + ordering, independent of the human label below.
  pillar_key           TEXT,

  -- Human label shown under a pillar icon in the dock (and in the admin editor).
  label                TEXT NOT NULL,

  -- Optional click-through for a pillar icon (NULL = render a non-linked tile).
  href                 TEXT,

  -- the uploaded looping clip
  video_url            TEXT,            -- reference public URL (display URL is rebuilt from the key)
  video_r2_key         TEXT,            -- source of truth for the read path
  video_mime_type      TEXT,

  -- only a published row WITH a clip is shown on the homepage
  is_published         BOOLEAN NOT NULL DEFAULT FALSE,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_admin_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

-- Seed the six slots. The main hero is slot 0; the five pillars follow in
-- their canonical homepage order (Ala Ala · Likhaan · Planuhan · Surian ·
-- Tiangge — see project_setnayan_five_pillar_names). ON CONFLICT keeps an
-- existing row's uploaded clip + publish state intact on re-run.
INSERT INTO public.homepage_background_videos (slot, pillar_key, label, href) VALUES
  (0, NULL,        'Main background video',     NULL),
  (1, 'ala-ala',   'Ala Ala · Memory Hub',      NULL),
  (2, 'likhaan',   'Likhaan · Creative Studio', NULL),
  (3, 'planuhan',  'Planuhan · Planner',        NULL),
  (4, 'surian',    'Surian · Setnayan AI',      NULL),
  (5, 'tiangge',   'Tiangge · Marketplace',     NULL)
ON CONFLICT (slot) DO NOTHING;

ALTER TABLE public.homepage_background_videos ENABLE ROW LEVEL SECURITY;

-- Everyone can read — these are public homepage marketing assets, not secrets.
-- Writes are admin-only via the service-role client (see lib/background-videos.ts
-- + app/admin/background-videos/actions.ts).
DROP POLICY IF EXISTS homepage_background_videos_read_all ON public.homepage_background_videos;
CREATE POLICY homepage_background_videos_read_all
  ON public.homepage_background_videos FOR SELECT
  TO anon, authenticated
  USING (true);

COMMIT;
