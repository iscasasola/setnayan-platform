-- vendor_capacity_analytics_rpcs
-- ============================================================================
-- My Performance · Phase B family 4 — "Capacity" analytics (Pro tier).
--
-- Two own-business, ownership-gated readers. Column set schema-discovery-mapped
-- + adversarially verified. SECURITY DEFINER + STABLE, gated like the others.
-- OWN-BUSINESS ONLY.
--
--   1. vendor_waitlist_depth — unmet demand: upcoming dates a couple queued on
--        (vendor_date_waitlist, status pending|notified, future-dated) + count.
--   2. vendor_upcoming_load  — how booked-ahead the vendor is: distinct upcoming
--        days with a LIVE schedule-pool booking (released_at IS NULL) + totals,
--        windowed to next 30 / 90 days. Raw counts only — NOT a utilization
--        ratio (the "available-day" denominator is a deliberate owner policy
--        choice, surfaced separately; a guessed ratio would drift from what
--        couples see in acquire_schedule_pools).
--
-- Idempotent: CREATE OR REPLACE + REVOKE/GRANT. No tables, no policies.
-- ============================================================================

BEGIN;

-- 1 ── Waitlist depth (unmet demand) ----------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_waitlist_depth(
  p_vendor_profile_id UUID
)
RETURNS TABLE(
  requested_date DATE,
  waiting        INTEGER
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
  SELECT w.requested_date, COUNT(*)::INTEGER
  FROM public.vendor_date_waitlist w
  WHERE w.vendor_profile_id = p_vendor_profile_id
    AND w.status IN ('pending', 'notified')  -- both are live unmet demand
    AND w.requested_date >= (now() AT TIME ZONE 'Asia/Manila')::date
  GROUP BY w.requested_date
  ORDER BY w.requested_date;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_waitlist_depth(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_waitlist_depth(UUID) TO authenticated;

-- 2 ── Upcoming booked load (raw, no contested ratio) -----------------------
CREATE OR REPLACE FUNCTION public.vendor_upcoming_load(
  p_vendor_profile_id UUID
)
RETURNS TABLE(
  upcoming_booked_days INTEGER,  -- distinct future days with a live booking
  upcoming_bookings    INTEGER,  -- total live future bookings (capacity>1 → many/day)
  next_30_days_booked  INTEGER,  -- distinct booked days in the next 30
  next_90_days_booked  INTEGER   -- distinct booked days in the next 90
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH live AS (
    SELECT pb.booked_date
    FROM public.vendor_schedule_pool_bookings pb
    WHERE pb.vendor_profile_id = p_vendor_profile_id
      AND pb.released_at IS NULL
      AND pb.booked_date >= v_today
  )
  SELECT
    COUNT(DISTINCT booked_date)::INTEGER,
    COUNT(*)::INTEGER,
    COUNT(DISTINCT booked_date) FILTER (WHERE booked_date < v_today + 30)::INTEGER,
    COUNT(DISTINCT booked_date) FILTER (WHERE booked_date < v_today + 90)::INTEGER
  FROM live;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_upcoming_load(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_upcoming_load(UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_waitlist_depth(UUID) IS
  'My Performance · Capacity. Upcoming dates a couple joined the waitlist on (vendor_date_waitlist, pending|notified, future-dated) + per-date count = unmet demand beyond capacity. SECURITY DEFINER, ownership-gated. Own-business only.';
COMMENT ON FUNCTION public.vendor_upcoming_load(UUID) IS
  'My Performance · Capacity. Distinct upcoming days with a live schedule-pool booking + totals (next 30/90). Raw counts, not a utilization ratio (the available-day denominator is an owner policy choice). SECURITY DEFINER, ownership-gated. Own-business only.';

COMMIT;
