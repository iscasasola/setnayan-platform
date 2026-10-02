-- ============================================================================
-- 20271260713505_every_failure_is_recorded.sql
-- SPOT PROBLEMS BEFORE USERS REPORT THEM — every action that fails is
-- recorded, traced and listed (DECISION_LOG 2026-10-02).
--
-- EXTENDS the Connection Logs skeleton (20260902000000_app_telemetry_logs.sql);
-- it is NOT a second system. app_telemetry_logs stays the per-occurrence TRACE
-- table and gains two columns; two small tables sit beside it:
--
--   app_fault_issues         ONE row per distinct failure. Identical failures
--                            (same kind + action/route + normalised message)
--                            share a fingerprint and become one issue with a
--                            hit count and first/last seen. It closes itself
--                            when a newer build is live and it has not recurred
--                            for 48 h, and reopens the moment it recurs.
--   app_action_daily_counts  a COUNTER per (day, action): successes and
--                            failures. NO ROW IS EVER STORED FOR A SUCCESS — a
--                            success only increments a number, so a failure
--                            RATE can be shown. Bounded by (#actions × #days).
--                            Guided-flow steps ride the same counter
--                            ('flow:<flow>:<step>' keys) — still counts, never
--                            a per-person row.
--
-- WRITES go only through three SECURITY DEFINER functions that only the
-- service role may execute (the ingest route + server code use the service-role
-- client). No INSERT / UPDATE / DELETE policy exists on either table.
--
-- TRACE SAMPLING keeps the trace table small under a flood: a trace row is
-- written when an issue is new, reopened, or its last trace is >10 min old.
-- The issue's own hit_count still counts EVERY occurrence.
--
-- PERSONAL DATA: callers pass messages already run through
-- lib/telemetry/fault-normalize.ts (emails, phones, quoted values, names,
-- ids scrubbed) and payloads through lib/telemetry/redact.ts. The database
-- does not re-scrub; it caps sizes.
--
-- RLS (enabled at CREATE): SELECT only, for the admin set app/admin/layout.tsx
-- gates on — the exact predicate app_telemetry_logs already uses.
-- ============================================================================

BEGIN;

-- ── 1 · app_telemetry_logs gains a fingerprint + build SHA, and the new kinds ──
ALTER TABLE public.app_telemetry_logs ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE public.app_telemetry_logs ADD COLUMN IF NOT EXISTS build_sha   TEXT;

ALTER TABLE public.app_telemetry_logs DROP CONSTRAINT IF EXISTS app_telemetry_logs_event_type_chk;
ALTER TABLE public.app_telemetry_logs
  ADD CONSTRAINT app_telemetry_logs_event_type_chk CHECK (event_type IN (
    -- the four original kinds (20260902000000) — kept verbatim
    'BUTTON_FAIL', 'SUPABASE_SAVE_ERROR', 'BLANK_FALLBACK', 'OTHER',
    -- server
    'SERVER_THROWN', 'ACTION_RETURNED_ERROR',
    'DB_WRITE_REFUSED', 'DB_READ_REFUSED', 'DB_ZERO_ROW', 'DB_UNREACHABLE',
    -- browser
    'BUTTON_TIMEOUT', 'UPLOAD_STALLED', 'PAGE_CRASH', 'DEAD_END',
    'DEAD_TAP', 'RAGE_TAP', 'DROP_OFF'
  ));

CREATE INDEX IF NOT EXISTS idx_app_telemetry_logs_fingerprint
  ON public.app_telemetry_logs (fingerprint, created_at DESC)
  WHERE fingerprint IS NOT NULL;

-- ── 2 · app_fault_issues — one row per distinct failure ────────────────────────
CREATE TABLE IF NOT EXISTS public.app_fault_issues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint      TEXT NOT NULL UNIQUE,
  kind             TEXT NOT NULL,
  action           TEXT NOT NULL,
  message          TEXT NOT NULL DEFAULT '',
  -- what a person pressed / where — for the one plain line on the Problems list
  -- ("Send my reply button on the guest invitation — no answer"). Latest wins.
  label            TEXT,
  page             TEXT,
  hit_count        BIGINT NOT NULL DEFAULT 1,
  -- "N times today" without a per-hit row: a counter that resets on a new day
  -- (Asia/Manila).
  day_date         DATE,
  day_count        INTEGER NOT NULL DEFAULT 0,
  first_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_build_sha  TEXT,
  last_build_sha   TEXT,
  status           TEXT NOT NULL DEFAULT 'open',
  closed_at        TIMESTAMPTZ,
  reopened_count   INTEGER NOT NULL DEFAULT 0,
  last_trace       JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_trace_at    TIMESTAMPTZ,
  CONSTRAINT app_fault_issues_status_chk CHECK (status IN ('open', 'closed', 'ignored'))
);

ALTER TABLE public.app_fault_issues ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.app_fault_issues IS
  'Grouped failures (kind + action/route + normalised message → fingerprint). Written only by record_app_fault(); listed on /admin/app-performance?tab=connection-logs and by lib/telemetry/fault-issues.server.ts.';

-- The list: open first, most-hit, newest.
CREATE INDEX IF NOT EXISTS idx_app_fault_issues_list
  ON public.app_fault_issues (status, hit_count DESC, last_seen DESC);

DROP POLICY IF EXISTS "app_fault_issues: admin reads all" ON public.app_fault_issues;
CREATE POLICY "app_fault_issues: admin reads all"
  ON public.app_fault_issues FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.account_type = 'admin' OR u.is_internal OR u.is_team_member)
    )
  );

REVOKE ALL ON TABLE public.app_fault_issues FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.app_fault_issues TO authenticated;

-- ── 3 · app_action_daily_counts — the success COUNT (never a success row) ──────
CREATE TABLE IF NOT EXISTS public.app_action_daily_counts (
  day         DATE   NOT NULL,
  action      TEXT   NOT NULL,
  ok_count    BIGINT NOT NULL DEFAULT 0,
  fail_count  BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (day, action)
);

ALTER TABLE public.app_action_daily_counts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.app_action_daily_counts IS
  'Per-day, per-action success/failure COUNTERS (and flow:<flow>:<step> reach counts). No row per action — a success only increments a number.';

DROP POLICY IF EXISTS "app_action_daily_counts: admin reads all" ON public.app_action_daily_counts;
CREATE POLICY "app_action_daily_counts: admin reads all"
  ON public.app_action_daily_counts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.account_type = 'admin' OR u.is_internal OR u.is_team_member)
    )
  );

REVOKE ALL ON TABLE public.app_action_daily_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.app_action_daily_counts TO authenticated;

-- ── 4 · record_app_fault — the ONE write path for a failure ────────────────────
-- Upserts the issue (reopening a closed one), samples a trace row, and counts
-- one failure against the action for today (Asia/Manila).
CREATE OR REPLACE FUNCTION public.record_app_fault(
  p_kind       TEXT,
  p_action     TEXT,
  p_message    TEXT,
  p_detail     TEXT,
  p_element    TEXT,
  p_file_path  TEXT,
  p_build_sha  TEXT,
  p_trace      JSONB
)
RETURNS TABLE (issue_id UUID, log_id UUID, is_new BOOLEAN, reopened BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind     TEXT;
  v_action   TEXT;
  v_message  TEXT;
  v_fp       TEXT;
  v_trace    JSONB;
  v_sha      TEXT;
  v_id       UUID;
  v_status   TEXT;
  v_last_tr  TIMESTAMPTZ;
  v_new      BOOLEAN := FALSE;
  v_reopen   BOOLEAN := FALSE;
  v_log      UUID := NULL;
  v_today    DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
  v_label    TEXT;
  v_page     TEXT;
BEGIN
  v_kind := CASE WHEN p_kind IN (
      'BUTTON_FAIL', 'SUPABASE_SAVE_ERROR', 'BLANK_FALLBACK', 'OTHER',
      'SERVER_THROWN', 'ACTION_RETURNED_ERROR',
      'DB_WRITE_REFUSED', 'DB_READ_REFUSED', 'DB_ZERO_ROW', 'DB_UNREACHABLE',
      'BUTTON_TIMEOUT', 'UPLOAD_STALLED', 'PAGE_CRASH', 'DEAD_END',
      'DEAD_TAP', 'RAGE_TAP', 'DROP_OFF')
    THEN p_kind ELSE 'OTHER' END;
  v_action  := left(coalesce(nullif(btrim(p_action), ''), '(unknown)'), 300);
  v_message := left(coalesce(p_message, ''), 1000);
  v_sha     := nullif(left(coalesce(p_build_sha, ''), 64), '');
  v_trace   := CASE
                 WHEN p_trace IS NULL OR jsonb_typeof(p_trace) <> 'object' THEN '{}'::jsonb
                 WHEN pg_column_size(p_trace) > 16384 THEN jsonb_build_object('_capped', true)
                 ELSE p_trace
               END;
  v_fp := md5(v_kind || '|' || v_action || '|' || v_message);
  v_label := nullif(left(btrim(coalesce(p_element, '')), 200), '');
  v_page  := nullif(left(btrim(coalesce(v_trace->>'page', '')), 300), '');

  LOOP
    SELECT i.id, i.status, i.last_trace_at
      INTO v_id, v_status, v_last_tr
      FROM public.app_fault_issues i
     WHERE i.fingerprint = v_fp
     FOR UPDATE;

    IF FOUND THEN
      v_reopen := (v_status = 'closed');
      UPDATE public.app_fault_issues i
         SET hit_count      = i.hit_count + 1,
             last_seen      = NOW(),
             last_build_sha = coalesce(v_sha, i.last_build_sha),
             status         = CASE WHEN i.status = 'closed' THEN 'open' ELSE i.status END,
             closed_at      = CASE WHEN i.status = 'closed' THEN NULL ELSE i.closed_at END,
             reopened_count = i.reopened_count + CASE WHEN i.status = 'closed' THEN 1 ELSE 0 END,
             last_trace     = v_trace,
             label          = coalesce(v_label, i.label),
             page           = coalesce(v_page, i.page),
             day_count      = CASE WHEN i.day_date = v_today THEN i.day_count + 1 ELSE 1 END,
             day_date       = v_today
       WHERE i.id = v_id;
      EXIT;
    END IF;

    BEGIN
      INSERT INTO public.app_fault_issues
        (fingerprint, kind, action, message, label, page, day_date, day_count,
         first_build_sha, last_build_sha, last_trace)
      VALUES (v_fp, v_kind, v_action, v_message, v_label, v_page, v_today, 1,
              v_sha, v_sha, v_trace)
      RETURNING id INTO v_id;
      v_new := TRUE;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- A concurrent first occurrence won the insert; loop and update it.
    END;
  END LOOP;

  -- Trace sampling: a flood of one failure must not become a flood of rows.
  IF v_new OR v_reopen OR v_last_tr IS NULL OR v_last_tr < NOW() - INTERVAL '10 minutes' THEN
    INSERT INTO public.app_telemetry_logs
      (event_type, element_name, file_path, error_message, payload_snapshot, fingerprint, build_sha)
    VALUES (
      v_kind,
      left(coalesce(p_element, v_action), 256),
      left(p_file_path, 512),
      left(coalesce(nullif(p_detail, ''), v_message), 4000),
      v_trace,
      v_fp,
      v_sha
    )
    RETURNING id INTO v_log;
    UPDATE public.app_fault_issues SET last_trace_at = NOW() WHERE id = v_id;
  END IF;

  INSERT INTO public.app_action_daily_counts (day, action, ok_count, fail_count)
  VALUES (v_today, v_action, 0, 1)
  ON CONFLICT (day, action) DO UPDATE
    SET fail_count = public.app_action_daily_counts.fail_count + 1;

  RETURN QUERY SELECT v_id, v_log, v_new, v_reopen;
END;
$$;

REVOKE ALL ON FUNCTION public.record_app_fault(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_app_fault(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)
  TO service_role;

-- ── 5 · bump_app_action_counts — batched success / step counts ─────────────────
-- p_counts: [{ "a": "<action>", "ok": n, "fail": n }, …]. At most 200 entries
-- per call and 10,000 per counter per call, so one caller cannot inflate a day.
CREATE OR REPLACE FUNCTION public.bump_app_action_counts(p_counts JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day  DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
  v_n    INTEGER := 0;
  r      JSONB;
  v_a    TEXT;
  v_ok   BIGINT;
  v_fail BIGINT;
BEGIN
  IF p_counts IS NULL OR jsonb_typeof(p_counts) <> 'array' THEN
    RETURN 0;
  END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_counts) LIMIT 200 LOOP
    CONTINUE WHEN jsonb_typeof(r) <> 'object';
    v_a := left(btrim(coalesce(r->>'a', '')), 300);
    CONTINUE WHEN v_a = '';
    v_ok   := least(greatest(coalesce((r->>'ok')::numeric, 0), 0), 10000)::bigint;
    v_fail := least(greatest(coalesce((r->>'fail')::numeric, 0), 0), 10000)::bigint;
    CONTINUE WHEN v_ok = 0 AND v_fail = 0;
    INSERT INTO public.app_action_daily_counts (day, action, ok_count, fail_count)
    VALUES (v_day, v_a, v_ok, v_fail)
    ON CONFLICT (day, action) DO UPDATE
      SET ok_count   = public.app_action_daily_counts.ok_count + EXCLUDED.ok_count,
          fail_count = public.app_action_daily_counts.fail_count + EXCLUDED.fail_count;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_app_action_counts(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_app_action_counts(JSONB) TO service_role;

-- ── 6 · close_quiet_fault_issues — the self-closing rule ───────────────────────
-- An open issue closes when the LIVE build (p_current_sha) is not the build it
-- last happened on AND it has not recurred for 48 hours. record_app_fault
-- reopens it on the next occurrence. Called by the list read — this repo has no
-- scheduler by design, so the list closes what is quiet each time it is read.
CREATE OR REPLACE FUNCTION public.close_quiet_fault_issues(p_current_sha TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n INTEGER;
BEGIN
  IF nullif(btrim(coalesce(p_current_sha, '')), '') IS NULL THEN
    RETURN 0; -- no known live build → "a newer build is deployed" is unknowable
  END IF;
  UPDATE public.app_fault_issues
     SET status = 'closed', closed_at = NOW()
   WHERE status = 'open'
     AND last_build_sha IS DISTINCT FROM p_current_sha
     AND last_seen < NOW() - INTERVAL '48 hours';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.close_quiet_fault_issues(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_quiet_fault_issues(TEXT) TO service_role;

COMMIT;
