-- ============================================================================
-- 20261204000000_social_autopublish.sql
--
-- SOCIAL AUTO-PUBLISH PIPELINE (Phase A — Facebook) — schema.
-- Canonical: corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md`
-- § 8 (compose-once-fan-out auto-posting) + § 8.3b (cadence governor:
-- FB ≤3/day · IG ≤2 · TT ≤1 later, ≥3h spacing, PH prime windows
-- 11:00–13:00 & 18:00–21:00 Asia/Manila; couple-creation posts get a
-- 48-hour pull window; vendor features / milestones / announcements /
-- evergreen publish at the next slot without hold).
--
-- Builds on the 20261130000000_social_sharing_program consent substrate:
-- consents stay the SOURCE of truth; this adds the compose→schedule→publish
-- machinery. Dispatch is CRON-FREE ([[project_setnayan_cron_free]]) — the
-- flush engine (apps/web/lib/social/flush.ts) piggybacks on organic traffic
-- via Next 15 `after()`, throttled by social_publish_settings.last_flush_at.
--
-- Four tables, all admin-only RLS (the flush engine itself runs on the
-- service-role client and bypasses RLS; couples/vendors never touch these):
--   1. social_posts            — the queue: one row per composed post.
--   2. social_milestones       — watermark of celebrated count thresholds.
--   3. social_evergreen_items  — admin-curated evergreen content pool.
--   4. social_publish_settings — single row: master switch + per-platform
--                                toggles + the flush-throttle timestamp.
--                                autopublish_enabled ships FALSE — nothing
--                                posts until the owner pastes the Meta env
--                                vars and flips it on from the admin queue.
--
-- Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS. RLS at CREATE TABLE time.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. social_posts — the auto-publish queue. Composed by the flush engine's
--    sweep (and by admin announcements), scheduled by the cadence governor,
--    dispatched to the platform APIs when the master switch is on.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_posts (
  post_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type      TEXT NOT NULL
                   CHECK (source_type IN
                     ('couple_creation', 'vendor_feature', 'milestone',
                      'announcement', 'evergreen')),
  -- What composed this post: consent_id (couple_creation) ·
  -- vendor_profile_id (vendor_feature) · 'metric:threshold' (milestone) ·
  -- evergreen item_id (evergreen) · a fresh UUID (announcement — keeps the
  -- partial-unique index below from colliding repeat announcements).
  source_ref       TEXT NOT NULL DEFAULT '',
  title            TEXT NOT NULL DEFAULT '',
  -- The Facebook message (later: the shared cross-platform body).
  body             TEXT NOT NULL DEFAULT '',
  media_url        TEXT,
  link_url         TEXT,
  -- CONTENT gate — earliest instant the content is allowed in public
  -- (e.g. event_date + 7d for couple creations). NULL = immediately eligible.
  publish_after    TIMESTAMPTZ,
  -- PULL window end — couple-creation posts hold for 48h so the team (or
  -- the couple, via revoke) can pull them before they go out. NULL = no hold.
  hold_until       TIMESTAMPTZ,
  -- The governor-assigned slot (PH prime window · cap · spacing).
  scheduled_for    TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN
                     ('scheduled', 'publishing', 'published', 'pulled', 'failed')),
  -- Per-platform outcome, e.g.
  -- {"facebook":{"status":"published","external_id":"…","posted_at":"…","error":null}}
  platform_results JSONB NOT NULL DEFAULT '{}',
  created_by       UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.social_posts IS
  'Auto-publish queue (Social Sharing Program § 8). Composed by the cron-free flush sweep (lib/social/flush.ts) + admin announcements; scheduled by the cadence governor (§ 8.3b: FB ≤3/day · ≥3h spacing · PH prime windows); dispatched only while social_publish_settings.autopublish_enabled.';

-- Sweep-compose idempotency: one live post per source. Evergreen is exempt
-- (the same item legitimately reposts); 'pulled' rows don't block a fresh
-- compose (e.g. a pulled milestone the team wants re-drafted by hand).
CREATE UNIQUE INDEX IF NOT EXISTS social_posts_source_unique
  ON public.social_posts (source_type, source_ref)
  WHERE source_type != 'evergreen' AND status != 'pulled';

-- Dispatch scan: status='scheduled' AND scheduled_for <= now.
CREATE INDEX IF NOT EXISTS social_posts_status_scheduled_idx
  ON public.social_posts (status, scheduled_for);

-- Source lookups (take-down awareness joins consents back to their posts).
CREATE INDEX IF NOT EXISTS social_posts_source_idx
  ON public.social_posts (source_type, source_ref);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_posts_admin ON public.social_posts;
CREATE POLICY social_posts_admin
  ON public.social_posts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. social_milestones — watermark of which (metric, threshold) pairs have
--    already been celebrated, so the sweep never double-posts a milestone.
--    Counts are real COUNT(*) snapshots taken at compose time — aggregate
--    numbers only, never names.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_milestones (
  metric     TEXT NOT NULL,
  threshold  INT NOT NULL,
  post_id    UUID REFERENCES public.social_posts(post_id) ON DELETE SET NULL,
  crossed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metric, threshold)
);

COMMENT ON TABLE public.social_milestones IS
  'Celebrated milestone watermarks (Social Sharing Program § 8) — one row per (metric, threshold) the sweep has already composed a post for. Aggregate counts only, never names.';

ALTER TABLE public.social_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_milestones_admin ON public.social_milestones;
CREATE POLICY social_milestones_admin
  ON public.social_milestones FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. social_evergreen_items — admin-curated pool of always-relevant content
--    (planning tips, feature spotlights). The sweep's content floor reposts
--    the least-recently-used active item when the page has gone quiet
--    (no post published/scheduled in 3 days) and the item hasn't been used
--    in 60+ days.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_evergreen_items (
  item_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  media_url    TEXT,
  link_url     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  times_used   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.social_evergreen_items IS
  'Admin-curated evergreen content pool (Social Sharing Program § 8) — the sweep''s content floor reposts the least-recently-used active item when the page has gone quiet.';

ALTER TABLE public.social_evergreen_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_evergreen_items_admin ON public.social_evergreen_items;
CREATE POLICY social_evergreen_items_admin
  ON public.social_evergreen_items FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. social_publish_settings — SINGLE ROW (id BOOLEAN PK + CHECK (id) is the
--    canonical single-row trick). The master switch ships OFF: the sweep
--    still composes + schedules (so the admin queue shows what WOULD post),
--    but nothing dispatches until the owner pastes META_PAGE_ID +
--    META_PAGE_ACCESS_TOKEN into the env and flips autopublish_enabled.
--    last_flush_at doubles as the cron-free flush throttle + concurrency
--    claim (single-row conditional UPDATE in lib/social/flush.ts).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_publish_settings (
  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  autopublish_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  facebook_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  instagram_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  tiktok_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  last_flush_at       TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.social_publish_settings IS
  'Single-row auto-publish switchboard (Social Sharing Program § 8). autopublish_enabled is the MASTER switch — ships FALSE until the owner supplies Meta env vars and flips it from the admin Social Queue. last_flush_at is the cron-free flush throttle/claim.';

ALTER TABLE public.social_publish_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_publish_settings_admin ON public.social_publish_settings;
CREATE POLICY social_publish_settings_admin
  ON public.social_publish_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.social_publish_settings (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

COMMIT;
