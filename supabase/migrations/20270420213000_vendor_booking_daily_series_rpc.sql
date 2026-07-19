-- vendor_booking_daily_series_rpc
-- ============================================================================
-- Per-DAY booked-business time series for the vendor "My Performance" page
-- Momentum card's Daily view (owner 2026-07-01: "also plot daily").
--
-- WHY: The Momentum card ships with Monthly (28-day) + Annual (365-day) windows
-- backed by vendor_booking_monthly_series(). The owner asked for a finer Daily
-- plot. Daily granularity is SAFE here because this is the vendor's OWN
-- business (ownership-gated below) — it is NOT the cross-business market-intel
-- surface, where a single-day bucket could re-identify one couple and is
-- therefore deliberately kept at month granularity + a min-N floor.
--
-- HOW (identical shape to the monthly RPC, day buckets):
--   • Same "booked" definition as everywhere else (BOOKED_EVENT_VENDOR_STATUSES
--     in lib/vendor-funnel.ts + vendor_source_attribution()):
--     contracted / deposit_paid / delivered / complete.
--   • revenue_php = SUM(total_cost_php) over priced rows that day — PARTIAL by
--     nature (nullable, off-platform settlement); the UI labels it honestly.
--   • generate_series() emits a contiguous day spine so the chart has a stable
--     x-axis; a LEFT JOIN zero-fills days with no bookings.
--   • Day bucketing in Asia/Manila local time (created_at is timestamptz).
--
-- OWNERSHIP + SECURITY: event_vendors has no vendor-facing SELECT RLS, so — like
-- vendor_source_attribution() and vendor_booking_monthly_series() — this is
-- SECURITY DEFINER and gates the caller to their own org via
-- current_vendor_profile_ids() (or a console admin). It returns ONLY
-- pre-aggregated per-day counts — never a couple identity.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + REVOKE/GRANT. No table, no policy.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_booking_daily_series(
  p_vendor_profile_id UUID,
  p_days              INTEGER DEFAULT 30
)
RETURNS TABLE(
  day_start     DATE,     -- day bucket (Asia/Manila)
  booking_count INTEGER,  -- # of booked event_vendors rows created that day
  revenue_php   NUMERIC   -- SUM(total_cost_php) over priced rows that day
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  -- Clamp the window to a sane 1..90 days (default 30). Guards against a caller
  -- asking for a multi-thousand-row series.
  v_days  INTEGER := GREATEST(1, LEAST(COALESCE(p_days, 30), 90));
  v_first DATE    := ((now() AT TIME ZONE 'Asia/Manila')::date - (v_days - 1));
BEGIN
  -- Ownership gate — only the vendor's own org (or a console admin) may read.
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      v_first,
      (now() AT TIME ZONE 'Asia/Manila')::date,
      '1 day'::interval
    )::date AS d
  ),
  booked AS (
    SELECT
      (ev.created_at AT TIME ZONE 'Asia/Manila')::date AS d,
      ev.total_cost_php
    FROM public.event_vendors ev
    WHERE ev.marketplace_vendor_id = p_vendor_profile_id
      AND COALESCE(ev.status::text, '') IN (
        'contracted', 'deposit_paid', 'delivered', 'complete'
      )
      -- Lower-bound the scan on created_at so the index is usable; the day join
      -- then places each row in its Manila-local bucket.
      AND ev.created_at >= (v_first::timestamp AT TIME ZONE 'Asia/Manila')
  )
  SELECT
    days.d,
    COUNT(b.d)::INTEGER,
    COALESCE(SUM(b.total_cost_php), 0)::NUMERIC
  FROM days
  LEFT JOIN booked b ON b.d = days.d
  GROUP BY days.d
  ORDER BY days.d;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_booking_daily_series(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_booking_daily_series(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.vendor_booking_daily_series(UUID, INTEGER) IS
  'Per-day booked-business series for the vendor My Performance Momentum Daily view (owner 2026-07-01 "also plot daily"). SECURITY DEFINER, ownership-gated to current_vendor_profile_ids() (or a console admin). One row per day (zero-filled via generate_series, clamped 1..90) with booking_count + SUM(total_cost_php) over the caller''s BOOKED event_vendors rows, bucketed in Asia/Manila. Peso figures partial by nature. Own-business only — never the cross-business market-intel surface, so daily granularity is privacy-safe here.';

COMMIT;
