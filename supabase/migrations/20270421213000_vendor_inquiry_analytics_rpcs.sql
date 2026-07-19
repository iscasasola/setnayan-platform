-- vendor_inquiry_analytics_rpcs
-- ============================================================================
-- My Performance · Phase B family 1 — "Inquiry handling" analytics (Pro tier).
--
-- Four own-business, ownership-gated readers for the vendor's own inquiry flow.
-- Every column + status referenced here was confirmed to exist against the
-- shipped migrations (schema-discovery pass 2026-07-01). All four are
-- SECURITY DEFINER + STABLE and gate the caller to their own org exactly like
-- vendor_booking_monthly_series / vendor_source_attribution:
--   p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
--   OR public.is_console_admin()
-- They return only pre-aggregated counts/percentiles — never a couple identity.
--
-- OWN-BUSINESS ONLY (My Performance tiering rule): every table filtered to the
-- caller's own vendor_profile_id. No cross-business data, no market rollup.
--
--   1. vendor_inquiry_reply_stats  — first-reply latency distribution
--        (answered count + p50/p90/avg minutes) over chat_threads where the
--        vendor has replied (vendor_first_reply_at IS NOT NULL).
--   2. vendor_inquiry_missed       — leads that slipped: explicit declines,
--        unanswered past an SLA window, self-reported no-response
--        (inquiry_outcomes), and lost-to-date-conflict (vendor_date_waitlist).
--   3. vendor_inquiry_heatmap      — inquiry arrival by weekday × hour
--        (Asia/Manila), so the vendor can staff replies when couples message.
--   4. vendor_token_efficiency     — tokens burned vs bookings won: SUM of
--        vendor_event_unlocks.tokens_burned and how many of those unlocked
--        events became a booked event_vendors row (the ROI on token spend).
--
-- "Booked" uses the same status set as the series RPCs:
--   contracted / deposit_paid / delivered / complete.
--
-- Idempotent: CREATE OR REPLACE + REVOKE/GRANT. No tables, no policies.
-- ============================================================================

BEGIN;

-- 1 ── First-reply latency distribution ------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_inquiry_reply_stats(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  answered_count INTEGER,
  p50_minutes    NUMERIC,
  p90_minutes    NUMERIC,
  avg_minutes    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH lat AS (
    SELECT EXTRACT(EPOCH FROM (ct.vendor_first_reply_at - ct.created_at)) / 60.0 AS m
    FROM public.chat_threads ct
    WHERE ct.vendor_profile_id = p_vendor_profile_id
      AND ct.vendor_first_reply_at IS NOT NULL
      AND ct.vendor_first_reply_at >= ct.created_at         -- guard clock skew
      AND (p_since IS NULL OR ct.created_at >= p_since)
  )
  SELECT
    COUNT(*)::INTEGER,
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY lat.m))::NUMERIC,
    (percentile_cont(0.9) WITHIN GROUP (ORDER BY lat.m))::NUMERIC,
    (AVG(lat.m))::NUMERIC
  FROM lat;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_inquiry_reply_stats(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_inquiry_reply_stats(UUID, TIMESTAMPTZ) TO authenticated;

-- 2 ── Missed / lost inquiries ---------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_inquiry_missed(
  p_vendor_profile_id UUID,
  p_sla_hours         INTEGER DEFAULT 48,
  p_since             TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  declined                   INTEGER,  -- vendor explicitly declined
  unanswered_over_sla        INTEGER,  -- still pending, no reply, past SLA
  self_reported_no_response  INTEGER,  -- inquiry_outcomes.outcome='no_response'
  waitlisted                 INTEGER   -- couple queued on a date conflict
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_sla INTEGER := GREATEST(1, LEAST(COALESCE(p_sla_hours, 48), 720)); -- 1h..30d
BEGIN
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER
       FROM public.chat_threads ct
      WHERE ct.vendor_profile_id = p_vendor_profile_id
        AND ct.inquiry_status = 'declined'
        AND (p_since IS NULL OR ct.created_at >= p_since)),
    (SELECT COUNT(*)::INTEGER
       FROM public.chat_threads ct
      WHERE ct.vendor_profile_id = p_vendor_profile_id
        AND ct.inquiry_status = 'pending'
        AND ct.vendor_first_reply_at IS NULL
        AND ct.created_at < (now() - make_interval(hours => v_sla))
        AND (p_since IS NULL OR ct.created_at >= p_since)),
    (SELECT COUNT(*)::INTEGER
       FROM public.inquiry_outcomes io
      WHERE io.vendor_profile_id = p_vendor_profile_id
        AND io.outcome = 'no_response'
        AND (p_since IS NULL OR io.recorded_at >= p_since)),
    (SELECT COUNT(*)::INTEGER
       FROM public.vendor_date_waitlist w
      WHERE w.vendor_profile_id = p_vendor_profile_id
        AND w.status IN ('pending', 'notified')
        AND (p_since IS NULL OR w.created_at >= p_since));
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_inquiry_missed(UUID, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_inquiry_missed(UUID, INTEGER, TIMESTAMPTZ) TO authenticated;

-- 3 ── Inquiry arrival heatmap (weekday × hour, Asia/Manila) ----------------
CREATE OR REPLACE FUNCTION public.vendor_inquiry_heatmap(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  dow           INTEGER,  -- 0=Sunday .. 6=Saturday (Manila local)
  hr            INTEGER,  -- 0..23 (Manila local)
  inquiry_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    EXTRACT(DOW  FROM (ct.created_at AT TIME ZONE 'Asia/Manila'))::INTEGER,
    EXTRACT(HOUR FROM (ct.created_at AT TIME ZONE 'Asia/Manila'))::INTEGER,
    COUNT(*)::INTEGER
  FROM public.chat_threads ct
  WHERE ct.vendor_profile_id = p_vendor_profile_id
    AND (p_since IS NULL OR ct.created_at >= p_since)
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_inquiry_heatmap(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_inquiry_heatmap(UUID, TIMESTAMPTZ) TO authenticated;

-- 4 ── Token efficiency (burned vs bookings won) ----------------------------
-- Uses vendor_event_unlocks as the single burn source (NOT token_redemptions_log
-- too — that would double-count, since consume_* writes both). A "won" event is
-- an unlocked event that later became a booked event_vendors row for the same
-- (vendor, event) pair. COUNT(DISTINCT event_id) — a vendor may have several
-- per-service event_vendors rows for one event.
CREATE OR REPLACE FUNCTION public.vendor_token_efficiency(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  tokens_burned   NUMERIC,
  unlocked_events INTEGER,
  won_events      INTEGER,
  tokens_per_won  NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH unlocks AS (
    SELECT u.event_id, u.tokens_burned
    FROM public.vendor_event_unlocks u
    WHERE u.vendor_profile_id = p_vendor_profile_id
      AND (p_since IS NULL OR u.unlocked_at >= p_since)
  ),
  won AS (
    SELECT DISTINCT un.event_id
    FROM unlocks un
    WHERE EXISTS (
      SELECT 1
      FROM public.event_vendors ev
      WHERE ev.event_id = un.event_id
        AND ev.marketplace_vendor_id = p_vendor_profile_id
        AND COALESCE(ev.status::text, '') IN
            ('contracted', 'deposit_paid', 'delivered', 'complete')
    )
  )
  SELECT
    COALESCE(SUM(un.tokens_burned), 0)::NUMERIC,
    COUNT(DISTINCT un.event_id)::INTEGER,
    (SELECT COUNT(*)::INTEGER FROM won),
    (COALESCE(SUM(un.tokens_burned), 0)::NUMERIC
      / NULLIF((SELECT COUNT(*) FROM won), 0))
  FROM unlocks un;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_token_efficiency(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_token_efficiency(UUID, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.vendor_inquiry_reply_stats(UUID, TIMESTAMPTZ) IS
  'My Performance · Inquiry handling. First-reply latency distribution (answered count + p50/p90/avg minutes) over the caller''s own chat_threads. SECURITY DEFINER, ownership-gated. Own-business only.';
COMMENT ON FUNCTION public.vendor_inquiry_missed(UUID, INTEGER, TIMESTAMPTZ) IS
  'My Performance · Inquiry handling. Slipped-lead counts: declined + unanswered-past-SLA + self-reported no_response (inquiry_outcomes) + date-conflict waitlist. SECURITY DEFINER, ownership-gated. SLA is an app threshold, not a stored state.';
COMMENT ON FUNCTION public.vendor_inquiry_heatmap(UUID, TIMESTAMPTZ) IS
  'My Performance · Inquiry handling. Inquiry arrival by weekday × hour (Asia/Manila) over the caller''s own chat_threads. SECURITY DEFINER, ownership-gated. Own-business only.';
COMMENT ON FUNCTION public.vendor_token_efficiency(UUID, TIMESTAMPTZ) IS
  'My Performance · Inquiry handling. Tokens burned (vendor_event_unlocks) vs bookings won (unlocked events that became booked event_vendors). tokens_per_won = burned / distinct won events. SECURITY DEFINER, ownership-gated. Own-business only.';

COMMIT;
