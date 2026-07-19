-- anniversary_email_log
-- Anniversary "on this day" re-engagement emails (PR-G).
--
-- A daily cron (POST /api/cron/anniversary-digest) finds couples whose wedding
-- anniversary falls TODAY (Asia/Manila) and emails them an "N years ago today —
-- relive your day" recap. This one-row-per-(event, anniversary-year) table is the
-- idempotency lock: the PK prevents a second cron run on the same day (or a retry)
-- from re-sending. The candidate query + idempotency + consent gate all collapse
-- into the SECURITY DEFINER helper public.couples_with_anniversary_today() below.
--
-- KEEP IDEMPOTENT (may be re-applied):
--   • CREATE TABLE IF NOT EXISTS … + ENABLE ROW LEVEL SECURITY in the SAME migration
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. anniversary_email_log — idempotency lock + audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.anniversary_email_log (
  event_id         UUID        NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  anniversary_year INT         NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_id        TEXT,
  PRIMARY KEY (event_id, anniversary_year)
);

ALTER TABLE public.anniversary_email_log ENABLE ROW LEVEL SECURITY;

-- Written only by the service/admin client (the cron route bypasses RLS via the
-- service role); admins may read it for support. No couple/guest/public access.
-- Mirrors papic_sampler_email_log's RLS shape.
DROP POLICY IF EXISTS anniversary_email_log_admin_all ON public.anniversary_email_log;
CREATE POLICY anniversary_email_log_admin_all
  ON public.anniversary_email_log
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. couples_with_anniversary_today(p_today date)
--    One clean call = candidate query + idempotency + reachability gate.
--    SECURITY DEFINER so the service-role cron can read across event_members /
--    users without per-row RLS; STABLE since it only reads.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.couples_with_anniversary_today(p_today DATE)
RETURNS TABLE (
  event_id        UUID,
  display_name    TEXT,
  slug            TEXT,
  event_date      DATE,
  years_ago       INT,
  couple_user_id  UUID,
  couple_email    TEXT,
  couple_name     TEXT
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    e.event_id,
    e.display_name,
    e.slug,
    e.event_date,
    (EXTRACT(YEAR FROM p_today)::INT - EXTRACT(YEAR FROM e.event_date)::INT) AS years_ago,
    u.user_id        AS couple_user_id,
    u.email          AS couple_email,
    COALESCE(NULLIF(TRIM(u.display_name), ''), e.display_name) AS couple_name
  FROM public.events e
  -- The couple member is the recipient. The lateral pick collapses the rare
  -- two-couple-member event to a single email (oldest membership wins).
  JOIN LATERAL (
    SELECT em.user_id
    FROM public.event_members em
    WHERE em.event_id = e.event_id
      AND em.member_type = 'couple'
    ORDER BY em.joined_at ASC, em.id ASC
    LIMIT 1
  ) cm ON TRUE
  JOIN public.users u ON u.user_id = cm.user_id
  WHERE e.event_date IS NOT NULL
    AND e.archived = FALSE
    -- Same calendar month/day as today …
    AND EXTRACT(MONTH FROM e.event_date) = EXTRACT(MONTH FROM p_today)
    AND EXTRACT(DAY   FROM e.event_date) = EXTRACT(DAY   FROM p_today)
    -- … and strictly in the past, so years_ago >= 1 (no same-year / future).
    AND e.event_date < p_today
    -- Reachable + not soft-deleted.
    AND u.email IS NOT NULL
    AND u.deleted_at IS NULL
    -- Idempotency / consent gate: not already sent for THIS anniversary year.
    AND NOT EXISTS (
      SELECT 1
      FROM public.anniversary_email_log l
      WHERE l.event_id = e.event_id
        AND l.anniversary_year = EXTRACT(YEAR FROM p_today)::INT
    );
$$;

-- Supabase grants anon/authenticated EXECUTE on new public functions via DEFAULT
-- PRIVILEGES (directly, NOT via PUBLIC), so `REVOKE … FROM PUBLIC` alone leaves
-- this SECURITY DEFINER function — which returns couple EMAILS — callable by
-- anyone over /rest/v1/rpc (flagged by the Supabase security advisor). Revoke
-- from all three; only the service_role the cron uses may execute it.
REVOKE ALL ON FUNCTION public.couples_with_anniversary_today(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.couples_with_anniversary_today(DATE) TO service_role;

COMMIT;
