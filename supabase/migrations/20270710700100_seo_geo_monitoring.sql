-- SEO / GEO monitoring spine (owner Q 2026-07-10: "an admin page that
-- auto-updates our SEO and GEO daily").
--
-- Three internal, admin-only tables that back the /admin/seo surface and the
-- daily crons:
--   • seo_health_snapshots — one row per /api/cron/seo-health run. The daily
--     drift + coverage audit, so a stale price or a dead route in the AI-crawler
--     surface (public/llms.txt) can never sit unnoticed. This is the automated
--     form of the manual reconciliation in SEO_GEO_UPDATE_2026-07-10.md §3.
--   • seo_metrics — daily Google Search Console / Bing pull (clicks, impressions,
--     avg position, top queries) for the dashboard trend. Written by
--     /api/cron/seo-gsc when creds are configured; the cron no-ops otherwise.
--   • seo_suggestions — the (follow-up) weekly AI meta/FAQ review queue. Table
--     lands now; the weekly Claude draft cron + admin approve/reject is a later
--     PR, flag-off by default. AI never publishes unattended — a human approves.
--
-- All three are ops-internal: RLS on at CREATE, admin-only via public.is_admin().
-- The crons + the /admin/seo page reach them through the service-role client
-- (which bypasses RLS) behind requireAdmin(); the policies below simply deny
-- everyone who is not an admin.

-- ---------------------------------------------------------------------------
-- 1. seo_health_snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_health_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Roll-up counts across all checks in this run (cheap to sort/scan on).
  ok_count      INTEGER NOT NULL DEFAULT 0 CHECK (ok_count >= 0),
  warn_count    INTEGER NOT NULL DEFAULT 0 CHECK (warn_count >= 0),
  fail_count    INTEGER NOT NULL DEFAULT 0 CHECK (fail_count >= 0),
  -- Array of { check, status: 'ok'|'warn'|'fail', detail } — every check the
  -- run performed (route coverage, verification tokens, sameAs, etc.).
  findings      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of { sku, catalog_php, llms_php } for every price the AI-crawler
  -- surface disagrees with the live service_catalog on. Empty = no drift.
  price_drift   JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_by  TEXT NOT NULL DEFAULT 'cron' CHECK (generated_by IN ('cron', 'manual')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seo_health_snapshots_checked_at_idx
  ON public.seo_health_snapshots (checked_at DESC);

ALTER TABLE public.seo_health_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seo_health_snapshots_admin_all ON public.seo_health_snapshots;
CREATE POLICY seo_health_snapshots_admin_all
  ON public.seo_health_snapshots FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. seo_metrics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_metrics (
  id            BIGSERIAL PRIMARY KEY,
  source        TEXT NOT NULL CHECK (source IN ('gsc', 'bing')),
  metric_date   DATE NOT NULL,
  clicks        INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  impressions   INTEGER NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  ctr           NUMERIC(6, 4) NOT NULL DEFAULT 0 CHECK (ctr >= 0),
  avg_position  NUMERIC(7, 2) NOT NULL DEFAULT 0 CHECK (avg_position >= 0),
  -- Array of { query, clicks, impressions } — the day's top search queries.
  top_queries   JSONB NOT NULL DEFAULT '[]'::jsonb,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One canonical row per (source, day); the pull upserts on re-run because
  -- GSC backfills the last ~2 days as data finalizes.
  UNIQUE (source, metric_date)
);

CREATE INDEX IF NOT EXISTS seo_metrics_source_date_idx
  ON public.seo_metrics (source, metric_date DESC);

ALTER TABLE public.seo_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seo_metrics_admin_all ON public.seo_metrics;
CREATE POLICY seo_metrics_admin_all
  ON public.seo_metrics FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. seo_suggestions  (follow-up: weekly AI meta/FAQ review queue)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_suggestions (
  id              BIGSERIAL PRIMARY KEY,
  route           TEXT NOT NULL,
  field           TEXT NOT NULL CHECK (field IN ('title', 'description', 'faq', 'llms_price_line')),
  current_value   TEXT,
  suggested_value TEXT NOT NULL,
  rationale       TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS seo_suggestions_status_idx
  ON public.seo_suggestions (status, created_at DESC);

ALTER TABLE public.seo_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seo_suggestions_admin_all ON public.seo_suggestions;
CREATE POLICY seo_suggestions_admin_all
  ON public.seo_suggestions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
