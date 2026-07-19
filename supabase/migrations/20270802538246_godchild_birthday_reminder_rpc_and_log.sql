-- ============================================================================
-- 20270802538246_godchild_birthday_reminder_rpc_and_log.sql
--
-- Godchild BIRTHDAY REMINDER (date-anchor · Phase 3 family graph · cron-FREE ·
-- COUNSEL-GATED). A ninong/ninang with reminders_enabled + an email gets a
-- heads-up ~2 weeks before their godchild's birthday so they can greet / prepare
-- a gift. Two moving parts:
--
--   1. godchildren_with_birthday_soon(p_today, p_within) — returns each eligible
--      (godparent → godchild) pair whose NEXT birthday lands in [today, today+within].
--   2. godchild_reminder_log — per-(godparent, year) idempotency lock so the
--      cron-free runner (runGodchildBirthdayReminders in lib/daily-email-jobs.ts,
--      fired from public-page after() traffic) can never double-send.
--
-- Reads a THIRD PARTY's email (the godparent) + a MINOR's birthday (the
-- godchild). The runner is gated behind dependentPeopleEnabled(); the underlying
-- godparents/dependents tables are EMPTY in prod until the DPO clears counsel +
-- flips the flag, so this returns nothing until then.
--
-- Idempotent. Feb-29 birthdays clamp to Feb-28 via Postgres interval arithmetic.
-- ============================================================================

BEGIN;

-- ── Idempotency lock ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.godchild_reminder_log (
  godparent_id  UUID        NOT NULL REFERENCES public.godparents(godparent_id) ON DELETE CASCADE,
  reminder_year INT         NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_id     TEXT,
  PRIMARY KEY (godparent_id, reminder_year)
);

ALTER TABLE public.godchild_reminder_log ENABLE ROW LEVEL SECURITY;

-- Service/admin only (the cron-free job writes via the service role, bypassing
-- RLS; admins may read for support). No couple/guest/public access.
DROP POLICY IF EXISTS godchild_reminder_log_admin_all ON public.godchild_reminder_log;
CREATE POLICY godchild_reminder_log_admin_all
  ON public.godchild_reminder_log
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Candidate finder ─────────────────────────────────────────────────────────
-- Returns each eligible (godparent → godchild) pair whose next birthday is
-- within p_within days of p_today. STABLE; runs as the caller (the runner uses
-- the service role, which bypasses RLS and sees all rows).
CREATE OR REPLACE FUNCTION public.godchildren_with_birthday_soon(
  p_today  DATE,
  p_within INT
)
RETURNS TABLE (
  godparent_id     UUID,
  godparent_name   TEXT,
  godparent_email  TEXT,
  role             TEXT,
  godchild_name    TEXT,
  next_birthday    DATE,
  turning_age      INT
)
LANGUAGE sql
STABLE
AS $$
  WITH nb AS (
    SELECT
      g.godparent_id,
      g.godparent_name,
      g.godparent_email,
      g.role,
      d.name AS godchild_name,
      d.birth_date,
      -- this year's birthday (Feb-29 clamps to Feb-28 via interval add), rolled
      -- forward a year if it already passed today.
      CASE
        WHEN (d.birth_date + make_interval(years => date_part('year', age(p_today, d.birth_date))::int))::date < p_today
        THEN (d.birth_date + make_interval(years => date_part('year', age(p_today, d.birth_date))::int + 1))::date
        ELSE (d.birth_date + make_interval(years => date_part('year', age(p_today, d.birth_date))::int))::date
      END AS next_birthday
    FROM public.godparents g
    JOIN public.dependents d ON d.dependent_id = g.dependent_id
    WHERE g.reminders_enabled = TRUE
      AND g.godparent_email IS NOT NULL
      AND btrim(g.godparent_email) <> ''
      AND d.birth_date IS NOT NULL
  )
  SELECT
    nb.godparent_id,
    nb.godparent_name,
    nb.godparent_email,
    nb.role,
    nb.godchild_name,
    nb.next_birthday,
    date_part('year', age(nb.next_birthday, nb.birth_date))::int AS turning_age
  FROM nb
  WHERE nb.next_birthday >= p_today
    AND nb.next_birthday <= (p_today + make_interval(days => p_within))::date;
$$;

COMMENT ON FUNCTION public.godchildren_with_birthday_soon(DATE, INT) IS
  'Godchild birthday-reminder candidates (Phase 3 family graph, cron-free, counsel-gated). Returns (godparent → godchild) pairs whose next birthday is within p_within days. Empty in prod until the dependent flag flips.';

COMMIT;
