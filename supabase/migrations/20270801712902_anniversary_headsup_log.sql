-- ============================================================================
-- 20270801712902_anniversary_headsup_log.sql
--
-- Idempotency lock for the FIRST-ANNIVERSARY HEADS-UP reminder (date-anchor
-- planning-timing, cron-FREE — runAnniversaryHeadsup in lib/daily-email-jobs.ts,
-- fired from public-page after() traffic). Separate from anniversary_email_log
-- (the day-of digest) so the heads-up (~6 weeks before) and the day-of email
-- can't collide — each has its own per-(event, year) lock. Mirrors
-- anniversary_email_log's shape + RLS exactly.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + ENABLE RLS + DROP/CREATE POLICY.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.anniversary_headsup_log (
  event_id         UUID        NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  anniversary_year INT         NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_id        TEXT,
  PRIMARY KEY (event_id, anniversary_year)
);

ALTER TABLE public.anniversary_headsup_log ENABLE ROW LEVEL SECURITY;

-- Service/admin only (the cron-free job writes via the service role, bypassing
-- RLS; admins may read for support). No couple/guest/public access.
DROP POLICY IF EXISTS anniversary_headsup_log_admin_all ON public.anniversary_headsup_log;
CREATE POLICY anniversary_headsup_log_admin_all
  ON public.anniversary_headsup_log
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
