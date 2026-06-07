-- ============================================================================
-- 20260902000000_app_telemetry_logs.sql
-- Connection Logs · client-side fault tracker (admin observability surface).
--
-- WHY · This is the substrate behind /admin/connection-logs — a real-time
--       admin dashboard that captures *front-end* faults the rest of our
--       observability stack doesn't surface to operators:
--         • BUTTON_FAIL        — a button handler threw / never fired
--         • SUPABASE_SAVE_ERROR — a client write to Supabase failed
--         • BLANK_FALLBACK     — a surface rendered an empty/fallback state
--       Sentry (iteration 0035) is the *engineer*-facing error monitor and
--       `telemetry_events` (V2 Phase E) tracks *backend service* checkpoints.
--       This table is distinct: an operator-facing, auto-clearing fault log
--       with a resolve lifecycle. Owner-confirmed standalone surface
--       (2026-06-07).
--
-- SECURITY POSTURE
-- ----------------
-- Rows are written from PUBLIC, possibly-unauthenticated pages, so we do NOT
-- expose an anon INSERT policy (an anon-writable jsonb table is a spam / DoS /
-- injection surface). Instead the client `trackFailure()` helper POSTs to
-- /api/telemetry/client-fault, which inserts with the service-role key
-- (bypasses RLS · validates + size-caps first). This matches the existing
-- lib/telemetry/insert.ts posture. Owner-confirmed mechanism (2026-06-07).
--
-- RLS · SELECT + UPDATE are limited to the admin set (account_type='admin'
--       OR is_internal OR is_team_member — the exact set app/admin/layout.tsx
--       gates on, so Realtime delivers to every operator who can open the
--       page). No INSERT/DELETE policy → only the service-role can write.
--
-- Realtime · table is added to the supabase_realtime publication so the
--            dashboard streams new faults in without a reload. Realtime honors
--            RLS, so only admins receive change events.
--
-- Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS / guarded ALTER
-- PUBLICATION so re-running is a no-op.
--
-- Authored 2026-06-07; versioned 20260902000000 to sort after the current max
-- migration (20260901000000) for a clean `supabase db push`.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_telemetry_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Fault classification. 'OTHER' is the catch-all so the ingest endpoint can
  -- coerce an unrecognised type rather than rejecting (and silently dropping) a
  -- real fault report.
  event_type       TEXT NOT NULL DEFAULT 'OTHER',
  element_name     TEXT,
  file_path        TEXT,
  error_message    TEXT,
  payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status           TEXT NOT NULL DEFAULT 'active',
  resolved_at      TIMESTAMPTZ,
  CONSTRAINT app_telemetry_logs_event_type_chk
    CHECK (event_type IN ('BUTTON_FAIL', 'SUPABASE_SAVE_ERROR', 'BLANK_FALLBACK', 'OTHER')),
  CONSTRAINT app_telemetry_logs_status_chk
    CHECK (status IN ('active', 'resolved', 'ignored'))
);

COMMENT ON TABLE public.app_telemetry_logs IS
  'Client-side fault tracker feeding /admin/connection-logs. Written via service-role only (see /api/telemetry/client-fault). Auto-clears via /api/telemetry/auto-resolve.';

-- Tab queries hit (status, created_at DESC) — Active and Resolved Archive both
-- order newest-first within a status.
CREATE INDEX IF NOT EXISTS idx_app_telemetry_logs_status_created
  ON public.app_telemetry_logs (status, created_at DESC);

-- Filter pills narrow Active by event_type — partial index keeps the hot
-- (active) path cheap.
CREATE INDEX IF NOT EXISTS idx_app_telemetry_logs_active_type
  ON public.app_telemetry_logs (event_type, created_at DESC)
  WHERE status = 'active';

-- Code-level auto-clear sweeps by file_path among active rows only.
CREATE INDEX IF NOT EXISTS idx_app_telemetry_logs_active_file
  ON public.app_telemetry_logs (file_path)
  WHERE status = 'active';

ALTER TABLE public.app_telemetry_logs ENABLE ROW LEVEL SECURITY;

-- Admin read — matches the app/admin/layout.tsx admin set exactly so Realtime
-- streams to every operator who can open the dashboard.
DROP POLICY IF EXISTS "app_telemetry_logs: admin reads all" ON public.app_telemetry_logs;
CREATE POLICY "app_telemetry_logs: admin reads all"
  ON public.app_telemetry_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.account_type = 'admin' OR u.is_internal OR u.is_team_member)
    )
  );

-- Admin update — resolve/ignore mutations go through server actions on the
-- service-role client (bypasses RLS), but this policy lets an authenticated
-- admin session flip status inline too, and keeps the surface consistent.
DROP POLICY IF EXISTS "app_telemetry_logs: admin updates" ON public.app_telemetry_logs;
CREATE POLICY "app_telemetry_logs: admin updates"
  ON public.app_telemetry_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.account_type = 'admin' OR u.is_internal OR u.is_team_member)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.account_type = 'admin' OR u.is_internal OR u.is_team_member)
    )
  );

-- No INSERT / DELETE policy: only the service-role key writes (ingest endpoint)
-- and removes rows. Anon + authenticated clients cannot INSERT.

-- Stream new faults to the dashboard without a reload. Guarded so re-running
-- the migration is a no-op (matches 20260514140000_enable_realtime_chat.sql).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_telemetry_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_telemetry_logs;
  END IF;
END $$;

COMMIT;
