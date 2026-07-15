-- ============================================================================
-- 20270731821239_anniversary_reminder_anchor_date_source.sql
--
-- Date-anchor model · PR-A — make the daily anniversary reminder fire off the
-- ANCHOR DATE too, so memorable-date anniversaries (owner: "place memorable
-- dates we want to celebrate every year as anniversary") get the same annual
-- email that on-platform weddings already get.
--
-- The existing couples_with_anniversary_today() (migration 20270219853101)
-- matched a WEDDING's own events.event_date to today. This CREATE OR REPLACE
-- generalizes the date source without changing wedding behavior: an event's
-- effective "anniversary date" is its anchor_date WHEN it is a recurring
-- anniversary (event_type='anniversary' AND recurs=TRUE AND anchor_date IS NOT
-- NULL), else its event_date. Weddings have recurs=FALSE by default, so they
-- still match on event_date exactly as before — behavior-preserving.
--
-- Return signature is UNCHANGED (the `event_date` column now carries the
-- effective anniversary date so the email builder + years_ago stay consistent).
-- Idempotent (CREATE OR REPLACE). Grants re-asserted (service_role only — the
-- function returns couple emails).
-- ============================================================================

BEGIN;

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
  WITH ev AS (
    SELECT
      e.*,
      -- Effective anniversary date: a recurring anniversary celebrates its
      -- anchor_date; every other event (incl. weddings) uses event_date.
      CASE
        WHEN e.event_type = 'anniversary' AND e.recurs = TRUE AND e.anchor_date IS NOT NULL
          THEN e.anchor_date
        ELSE e.event_date
      END AS anniv_date
    FROM public.events e
  )
  SELECT
    e.event_id,
    e.display_name,
    e.slug,
    e.anniv_date AS event_date,
    (EXTRACT(YEAR FROM p_today)::INT - EXTRACT(YEAR FROM e.anniv_date)::INT) AS years_ago,
    u.user_id        AS couple_user_id,
    u.email          AS couple_email,
    COALESCE(NULLIF(TRIM(u.display_name), ''), e.display_name) AS couple_name
  FROM ev e
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
  WHERE e.anniv_date IS NOT NULL
    AND e.archived = FALSE
    -- Same calendar month/day as today …
    AND EXTRACT(MONTH FROM e.anniv_date) = EXTRACT(MONTH FROM p_today)
    AND EXTRACT(DAY   FROM e.anniv_date) = EXTRACT(DAY   FROM p_today)
    -- … and strictly in the past, so years_ago >= 1 (no same-year / future).
    AND e.anniv_date < p_today
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

-- Re-assert the lock-down (Supabase default-grants anon/authenticated EXECUTE
-- on REPLACE; this function returns couple EMAILS — service_role only).
REVOKE ALL ON FUNCTION public.couples_with_anniversary_today(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.couples_with_anniversary_today(DATE) TO service_role;

COMMIT;
