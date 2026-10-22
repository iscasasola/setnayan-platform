-- ============================================================================
-- 20271282829207_site_visits_daily.sql
-- VISITS — site traffic in our own admin (owner 2026-10-22: the traffic stats
-- belong in Admin › App Performance, not in Vercel; no cookies, no banner).
--
-- The same privacy pattern as the suppliers' shop-page views
-- (20270323312048_vendor_profile_views_funnel.sql) — first-party Postgres only,
-- the viewer stored only as a salted hash, captured fire-and-forget through
-- Next after(), written by the service role only — made stricter in three ways:
--
--   1. NO COOKIE, NO BROWSER ID. The visitor key is sha256(IP | user-agent),
--      computed in the middleware; the raw IP and user-agent never leave it.
--   2. THE SALT ROTATES DAILY AND IS THROWN AWAY. The database hashes the key
--      again with a random salt minted for the Manila day
--      (site_visit_salts). The first visit of the next day deletes the old salt
--      and every hash made with it — after that, nothing (not even someone with
--      the whole database) can tell whether two days' visitors were the same
--      person. A day can never be joined to another day.
--   3. NO PER-VIEW ROWS. A view goes straight into a DAILY AGGREGATE row
--      (site_visit_days: day · page pattern · source domain · utm_source ·
--      device · country · signed-in) as +1 view, and +1 visitor when it is that
--      visitor's FIRST view of the day. The only per-person thing kept is
--      today's salted hash in site_visit_seen, which exists solely to answer
--      "seen today?" and is deleted with its salt.
--
--   site_visit_days    the aggregate the admin reads. `visitors` on a row =
--                      the visitors whose first view of the day landed in that
--                      row, so summing a day's rows gives that day's distinct
--                      visitors exactly, and the source/device/country of a
--                      visitor is the one they ARRIVED with.
--   site_visit_seen    (day, salted hash) — today's only. Purged on write.
--   site_visit_salts   (day, random salt) — today's only. Purged on write.
--
-- RETENTION, CRON-FREE (this repo has no scheduler, by design): every
-- record_site_visit() call deletes salts + hashes older than today — an index
-- range scan that finds nothing except on the first call after Manila
-- midnight. The daily aggregates are kept (they hold no per-person data).
--
-- PERSONAL DATA: NONE STORED. `path` is a ROUTE PATTERN (/v/[slug], never
-- /v/bituin-catering) — matched to the app's own route list in the
-- middleware, and the CHECK below is the last line: no digit run of 4+, no
-- uuid, no S89 id, no '@', '?', '#', no segment over 40 characters. `source`
-- is a bare referrer DOMAIN (never a URL), `country` a two-letter code from
-- the platform's geo header.
--
-- RLS AT CREATE TIME. site_visit_days: read-only for admins (is_admin()), no
-- write grant to any browser role. site_visit_seen / site_visit_salts: RLS on,
-- no policy, no grant — only the two SECURITY DEFINER / service-role
-- functions below touch them.
-- ============================================================================

BEGIN;

-- ── 1 · the daily aggregate ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_visit_days (
  day         DATE    NOT NULL,
  path        TEXT    NOT NULL,
  -- the referrer's bare domain ('facebook.com'), '' = direct / typed / internal
  source      TEXT    NOT NULL DEFAULT '',
  -- utm_source from the landing URL, '' when absent
  utm_source  TEXT    NOT NULL DEFAULT '',
  device      TEXT    NOT NULL,
  -- ISO 3166-1 alpha-2 from the platform geo header, '' when unknown
  country     TEXT    NOT NULL DEFAULT '',
  signed_in   BOOLEAN NOT NULL DEFAULT FALSE,
  views       INTEGER NOT NULL DEFAULT 0,
  visitors    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, source, utm_source, device, country, signed_in),
  CONSTRAINT site_visit_days_device_chk CHECK (device IN ('phone', 'tablet', 'desktop')),
  CONSTRAINT site_visit_days_counts_chk CHECK (views >= 0 AND visitors >= 0 AND visitors <= views),
  CONSTRAINT site_visit_days_source_chk CHECK (source ~ '^[a-z0-9.-]{0,80}$'),
  CONSTRAINT site_visit_days_utm_chk CHECK (utm_source ~ '^[a-z0-9._-]{0,40}$'),
  CONSTRAINT site_visit_days_country_chk CHECK (country ~ '^([A-Z]{2})?$'),
  -- 🔒 A ROUTE PATTERN, NEVER A URL — the load-time log's rule
  -- (20271270180398 app_load_timings_route_chk), word for word.
  CONSTRAINT site_visit_days_path_chk CHECK (
    char_length(path) BETWEEN 1 AND 200
    AND path ~ '^/[A-Za-z0-9._\[\]/…-]*$'
    AND path !~ '[0-9]{4,}'
    AND path !~* '[0-9a-f]{8}-[0-9a-f]{4}-'
    AND path !~* 'S89[A-Z]{1,4}-'
    AND path !~ '[^/]{41,}'
  )
);

ALTER TABLE public.site_visit_days ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.site_visit_days IS
  'Site visits, one row per (Manila day · route pattern · referrer domain · utm_source · device · country · signed-in). views = page views; visitors = visitors whose first view that day landed in this row (a day''s rows sum to its distinct visitors). Written only by record_site_visit(); read on /admin/app-performance?tab=visits. No personal data.';

CREATE INDEX IF NOT EXISTS idx_site_visit_days_day ON public.site_visit_days (day);

REVOKE ALL ON TABLE public.site_visit_days FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.site_visit_days TO authenticated;

DROP POLICY IF EXISTS site_visit_days_admin_read ON public.site_visit_days;
CREATE POLICY site_visit_days_admin_read
  ON public.site_visit_days FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── 2 · today's salted hashes + today's salt ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_visit_seen (
  day      DATE NOT NULL,
  visitor  TEXT NOT NULL,
  PRIMARY KEY (day, visitor),
  CONSTRAINT site_visit_seen_visitor_chk CHECK (visitor ~ '^[0-9a-f]{64}$')
);
ALTER TABLE public.site_visit_seen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.site_visit_seen FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.site_visit_seen IS
  'Today''s visitors as sha256(today''s salt || sha256(ip|ua)) — only to tell a first view of the day from a repeat. Deleted with the salt by the first record_site_visit() of the next Manila day.';

CREATE TABLE IF NOT EXISTS public.site_visit_salts (
  day   DATE PRIMARY KEY,
  salt  TEXT NOT NULL
);
ALTER TABLE public.site_visit_salts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.site_visit_salts FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.site_visit_salts IS
  'One random salt per Manila day for site_visit_seen. Deleted by the first record_site_visit() of the next day, so no two days'' hashes can ever be joined.';

-- ── 3 · record_site_visit — the ONE write path ──────────────────────────────
-- p_key is sha256(ip | user-agent) as 64 hex characters, made in the
-- middleware (lib/visits/record-visit.ts). A malformed field drops the view on
-- its own (never an error to the caller — the page has already been served).
CREATE OR REPLACE FUNCTION public.record_site_visit(
  p_path       TEXT,
  p_source     TEXT,
  p_utm_source TEXT,
  p_device     TEXT,
  p_country    TEXT,
  p_signed_in  BOOLEAN,
  p_key        TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day  DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
  v_salt TEXT;
  v_new  INTEGER := 0;
BEGIN
  -- Retention first: yesterday's salt and every hash made with it go.
  DELETE FROM public.site_visit_salts WHERE day < v_day;
  DELETE FROM public.site_visit_seen
   WHERE (day, visitor) IN (
     SELECT day, visitor FROM public.site_visit_seen WHERE day < v_day LIMIT 5000
   );

  IF p_key IS NOT NULL AND p_key ~ '^[0-9a-f]{64}$' THEN
    INSERT INTO public.site_visit_salts (day, salt)
    VALUES (v_day, encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex'))
    ON CONFLICT (day) DO NOTHING;
    SELECT salt INTO v_salt FROM public.site_visit_salts WHERE day = v_day;

    INSERT INTO public.site_visit_seen (day, visitor)
    VALUES (v_day, encode(sha256(convert_to(v_salt || p_key, 'UTF8')), 'hex'))
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_new = ROW_COUNT;
  END IF;

  BEGIN
    INSERT INTO public.site_visit_days AS d
      (day, path, source, utm_source, device, country, signed_in, views, visitors)
    VALUES (
      v_day,
      p_path,
      coalesce(p_source, ''),
      coalesce(p_utm_source, ''),
      p_device,
      coalesce(p_country, ''),
      coalesce(p_signed_in, FALSE),
      1,
      CASE WHEN v_new = 1 THEN 1 ELSE 0 END
    )
    ON CONFLICT (day, path, source, utm_source, device, country, signed_in)
    DO UPDATE SET views = d.views + 1, visitors = d.visitors + EXCLUDED.visitors;
  EXCEPTION
    WHEN check_violation OR not_null_violation THEN
      RETURN FALSE;
  END;
  RETURN TRUE;
END;
$$;

-- ⚠ Name the roles: Supabase's default privileges grant anon + authenticated
-- their own EXECUTE, which `FROM PUBLIC` alone does not remove.
REVOKE ALL ON FUNCTION public.record_site_visit(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_site_visit(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;

-- ── 4 · site_visit_summary — the ONE read (aggregates only) ─────────────────
-- Called through the service role behind requireAdmin() by
-- lib/visits/visit-stats.server.ts. Returns only sums; never a row-level read.
CREATE OR REPLACE FUNCTION public.site_visit_summary(p_since DATE, p_until DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH w AS (
    SELECT * FROM public.site_visit_days WHERE day BETWEEN p_since AND p_until
  )
  SELECT jsonb_build_object(
    'first_day', (SELECT min(day) FROM public.site_visit_days),
    'days', coalesce((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'views', v, 'visitors', u) ORDER BY day)
        FROM (SELECT day, sum(views)::int AS v, sum(visitors)::int AS u FROM w GROUP BY day) x
    ), '[]'::jsonb),
    'pages', coalesce((
      SELECT jsonb_agg(jsonb_build_object('path', path, 'views', v, 'visitors', u) ORDER BY v DESC, path)
        FROM (SELECT path, sum(views)::int AS v, sum(visitors)::int AS u FROM w GROUP BY path ORDER BY 2 DESC, path LIMIT 20) x
    ), '[]'::jsonb),
    'sources', coalesce((
      SELECT jsonb_agg(jsonb_build_object('source', source, 'utm_source', utm_source, 'visitors', u) ORDER BY u DESC, source, utm_source)
        FROM (SELECT source, utm_source, sum(visitors)::int AS u FROM w GROUP BY source, utm_source HAVING sum(visitors) > 0 ORDER BY 3 DESC, source, utm_source LIMIT 15) x
    ), '[]'::jsonb),
    'devices', coalesce((
      SELECT jsonb_agg(jsonb_build_object('device', device, 'views', v, 'visitors', u) ORDER BY u DESC, device)
        FROM (SELECT device, sum(views)::int AS v, sum(visitors)::int AS u FROM w GROUP BY device) x
    ), '[]'::jsonb),
    'countries', coalesce((
      SELECT jsonb_agg(jsonb_build_object('country', country, 'visitors', u) ORDER BY u DESC, country)
        FROM (SELECT country, sum(visitors)::int AS u FROM w GROUP BY country HAVING sum(visitors) > 0 ORDER BY 2 DESC, country LIMIT 12) x
    ), '[]'::jsonb),
    'signed_in_views', coalesce((SELECT sum(views)::int FROM w WHERE signed_in), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.site_visit_summary(DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_visit_summary(DATE, DATE) TO service_role;

COMMIT;
