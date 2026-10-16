-- ============================================================================
-- 20271270180398_real_user_load_time_log.sql
-- THE LOAD-TIME LOG — how long real people wait for a page (owner 2026-10-16:
-- "can we make a page on admin that will log the loading time of each load
-- done? or when a loading takes more than 1.5 seconds … or when it loads longer
-- than its target loading time?").
--
-- Wires the App Performance plan's "Later · p95 wiring · web-vitals RUM" row
-- (corpus 0023_admin_console/App_Performance_Plan_2026-07-03.md §5). It is NOT
-- a second observability system: it follows the Problems list's pattern
-- (20271260713505_every_failure_is_recorded.sql) — the same ingest door
-- (/api/telemetry/client-fault, a third body shape), the same build SHA, the
-- same "never store anything personal", the same write-through-one-RPC shape.
--
--   app_load_timings   one row per MEASURED load that was SENT. A browser
--                      always sends a load that took ≥ 1 s (every admin target
--                      is ≥ 1 s, so every load over its target arrives) and
--                      ~1 in 10 of the rest; each row carries the WEIGHT it
--                      stands for (1, or 10 for a sampled fast load), so the
--                      percentiles the admin reads are unbiased.
--                      Kept 30 days — record_load_timings trims as it writes
--                      (this repo has no scheduler, by design).
--
--   platform_settings.load_time_targets
--                      { "<route pattern>": <ms>, … } — the per-page target an
--                      admin edits on the Slow loads tab. A page with no entry
--                      uses the 1.5 s default, which lives in the app
--                      (lib/telemetry/load-timing.ts DEFAULT_TARGET_MS) and is
--                      held there by a test.
--
-- PERSONAL DATA: NONE. `route` is a route PATTERN (/dashboard/[eventId]/guests)
-- — ids are blanked in the browser before sending and the pattern is matched
-- against the app's own route list at the ingest. The CHECK on `route` is the
-- last line: no digit run of 4+, no '@', no '?', no '#', no segment over 40
-- characters, only route characters — a raw URL with an id or a token cannot
-- be stored even if every layer above failed. No user id, no IP, no address.
--
-- RLS (enabled at CREATE) with NO policy and NO grant to anon or authenticated
-- — exactly app_fault_issues' posture: only the service role reads or writes.
-- The admin reads through the service role behind requireAdmin()
-- (lib/telemetry/load-timing.server.ts → app/admin/app-performance), so the
-- ADMIN-ONLY read is enforced where the page is and no browser session — not
-- even an admin's — holds a PostgREST door to the rows.
--
-- platform_settings gains one column. Its existing grant (authenticated: S) is
-- re-stated as every platform_settings migration since 20271014400000 does, so
-- a signed-in browser can read the targets map — page names and milliseconds,
-- nothing else — and the exposure baseline records that one line deliberately.
-- ============================================================================

BEGIN;

-- ── 1 · app_load_timings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_load_timings (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 'page' = a full page load (the browser fetched a document);
  -- 'nav'  = an in-app move (a tap → the new page's content painted).
  kind          TEXT NOT NULL,
  route         TEXT NOT NULL,
  -- The wait itself: navigation start → the main content painted.
  total_ms      INTEGER NOT NULL,
  -- The breakdown shown on the Slow loads tab: waiting for the server · the
  -- bytes arriving · the browser drawing. NULL when the browser could not tell.
  server_ms     INTEGER,
  download_ms   INTEGER,
  render_ms     INTEGER,
  -- Full page loads only (Navigation Timing + Largest Contentful Paint).
  ttfb_ms       INTEGER,
  dcl_ms        INTEGER,
  load_ms       INTEGER,
  lcp_ms        INTEGER,
  -- The slowest interaction and the longest main-thread task while the page
  -- was open (Chromium only; NULL elsewhere).
  inp_ms        INTEGER,
  long_task_ms  INTEGER,
  -- 'painted' = the content arrived · 'left' = the person moved on before it
  -- did (total is how long they waited) · 'cap' = still not there after 20 s.
  outcome       TEXT NOT NULL DEFAULT 'painted',
  device        TEXT NOT NULL,
  connection    TEXT,
  signed_in     BOOLEAN NOT NULL DEFAULT FALSE,
  build_sha     TEXT,
  weight        SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT app_load_timings_kind_chk CHECK (kind IN ('page', 'nav')),
  CONSTRAINT app_load_timings_outcome_chk CHECK (outcome IN ('painted', 'left', 'cap')),
  CONSTRAINT app_load_timings_device_chk CHECK (device IN ('phone', 'tablet', 'desktop')),
  CONSTRAINT app_load_timings_connection_chk CHECK (connection IS NULL OR connection IN ('slow-2g', '2g', '3g', '4g')),
  CONSTRAINT app_load_timings_weight_chk CHECK (weight BETWEEN 1 AND 100),
  CONSTRAINT app_load_timings_sha_chk CHECK (build_sha IS NULL OR build_sha ~ '^[0-9a-f]{7,40}$'),
  CONSTRAINT app_load_timings_ms_chk CHECK (
    total_ms BETWEEN 0 AND 120000
    AND coalesce(server_ms, 0)    BETWEEN 0 AND 120000
    AND coalesce(download_ms, 0)  BETWEEN 0 AND 120000
    AND coalesce(render_ms, 0)    BETWEEN 0 AND 120000
    AND coalesce(ttfb_ms, 0)      BETWEEN 0 AND 120000
    AND coalesce(dcl_ms, 0)       BETWEEN 0 AND 120000
    AND coalesce(load_ms, 0)      BETWEEN 0 AND 120000
    AND coalesce(lcp_ms, 0)       BETWEEN 0 AND 120000
    AND coalesce(inp_ms, 0)       BETWEEN 0 AND 120000
    AND coalesce(long_task_ms, 0) BETWEEN 0 AND 120000
  ),
  -- 🔒 A ROUTE PATTERN, NEVER A URL. Route characters only (letters, digits,
  -- . _ - [ ] / and the … of a blanked segment); no digit run of 4+ (an id, a
  -- phone, a date), no segment over 40 characters (a token).
  CONSTRAINT app_load_timings_route_chk CHECK (
    char_length(route) BETWEEN 1 AND 200
    AND route ~ '^/[A-Za-z0-9._\[\]/…-]*$'
    AND route !~ '[0-9]{4,}'
    AND route !~ '[^/]{41,}'
  )
);

ALTER TABLE public.app_load_timings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.app_load_timings IS
  'Real-user load times (route pattern, ms, device class, build). Written only by record_load_timings(); read behind requireAdmin() on /admin/app-performance?tab=slow-loads. Kept 30 days. No personal data.';

-- The two reads: newest first (the Slow loads list, the 30-day window) and
-- per page over time.
CREATE INDEX IF NOT EXISTS idx_app_load_timings_created
  ON public.app_load_timings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_load_timings_route
  ON public.app_load_timings (route, created_at DESC);

REVOKE ALL ON TABLE public.app_load_timings FROM PUBLIC, anon, authenticated;

-- ── 2 · record_load_timings — the ONE write path ─────────────────────────────
-- p_rows: [{ kind, route, total_ms, … }, …] already shaped by the ingest
-- (lib/telemetry/load-timing.ts loadsFromWire). At most 20 rows per call; a row
-- the table refuses is skipped, never the batch. Trims rows older than 30 days,
-- at most 500 per call, so the trim can never become the slow part.
CREATE OR REPLACE FUNCTION public.record_load_timings(
  p_rows      JSONB,
  p_build_sha TEXT,
  p_signed_in BOOLEAN
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n   INTEGER := 0;
  v_sha TEXT := CASE WHEN p_build_sha ~ '^[0-9a-f]{7,40}$' THEN p_build_sha ELSE NULL END;
  r     JSONB;
BEGIN
  IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' THEN
    FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LIMIT 20 LOOP
      CONTINUE WHEN jsonb_typeof(r) <> 'object';
      BEGIN
        INSERT INTO public.app_load_timings
          (kind, route, total_ms, server_ms, download_ms, render_ms,
           ttfb_ms, dcl_ms, load_ms, lcp_ms, inp_ms, long_task_ms,
           outcome, device, connection, signed_in, build_sha, weight)
        VALUES (
          r->>'kind',
          r->>'route',
          (r->>'total_ms')::integer,
          (r->>'server_ms')::integer,
          (r->>'download_ms')::integer,
          (r->>'render_ms')::integer,
          (r->>'ttfb_ms')::integer,
          (r->>'dcl_ms')::integer,
          (r->>'load_ms')::integer,
          (r->>'lcp_ms')::integer,
          (r->>'inp_ms')::integer,
          (r->>'long_task_ms')::integer,
          coalesce(r->>'outcome', 'painted'),
          r->>'device',
          r->>'connection',
          coalesce(p_signed_in, FALSE),
          v_sha,
          coalesce((r->>'weight')::smallint, 1)
        );
        v_n := v_n + 1;
      EXCEPTION
        WHEN check_violation OR not_null_violation OR invalid_text_representation
          OR numeric_value_out_of_range THEN
          -- A malformed row is dropped on its own; the rest of the batch lands.
          NULL;
      END;
    END LOOP;
  END IF;

  DELETE FROM public.app_load_timings
   WHERE id IN (
     SELECT id FROM public.app_load_timings
      WHERE created_at < NOW() - INTERVAL '30 days'
      ORDER BY created_at
      LIMIT 500
   );

  RETURN v_n;
END;
$$;

-- ⚠ Name the roles: Supabase's default privileges grant anon + authenticated
-- their own EXECUTE, which `FROM PUBLIC` alone does not remove.
REVOKE ALL ON FUNCTION public.record_load_timings(JSONB, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_load_timings(JSONB, TEXT, BOOLEAN) TO service_role;

-- ── 3 · the per-page targets (admin-edited) ──────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS load_time_targets JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_load_time_targets_chk;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_load_time_targets_chk CHECK (jsonb_typeof(load_time_targets) = 'object');

COMMENT ON COLUMN public.platform_settings.load_time_targets IS
  'Per-page load-time targets in ms, keyed by route pattern ({"/dashboard/[eventId]/guests": 2000}). A page with no entry uses the 1.5 s default (lib/telemetry/load-timing.ts). Edited on /admin/app-performance?tab=slow-loads.';

-- Re-stated after the ADD COLUMN, as every platform_settings migration since
-- 20271014400000 does: anon holds nothing on this table.
REVOKE ALL ON TABLE public.platform_settings FROM anon;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

COMMIT;
