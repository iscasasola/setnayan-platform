-- vendor_booking_monthly_series_rpc
-- ============================================================================
-- Per-month booked-business time series for the vendor "My Performance" page
-- Momentum card (charts: monthly bookings bars + earnings sparkline).
--
-- WHY: The shipped vendor_source_attribution() RPC answers "how much, since
-- when?" as a single aggregate window — it cannot draw a month-over-month
-- trend. The Momentum card wants a real series (a bar per month + an earnings
-- sparkline), so it needs one row PER MONTH, including months with zero
-- bookings (a gap in the bars is meaningful — do not collapse empty months).
--
-- HOW (no new column, same "booked" definition as everywhere else):
--   • Counts the caller's own event_vendors rows whose status is a real
--     commercial commitment — IDENTICAL to BOOKED_EVENT_VENDOR_STATUSES in
--     lib/vendor-funnel.ts and the vendor_source_attribution() RPC
--     (contracted / deposit_paid / delivered / complete).
--   • revenue_php = SUM(total_cost_php) over priced rows in that month. As with
--     the attribution RPC this is PARTIAL by nature — total_cost_php is nullable
--     and vendors settle off-platform — so the UI labels it honestly and never
--     fabricates the unpriced remainder.
--   • generate_series() emits a full contiguous month spine so the chart has a
--     stable x-axis; a LEFT JOIN zero-fills months with no bookings.
--   • Month bucketing is done in Asia/Manila local time (created_at is
--     timestamptz) so a booking made at 11pm Manila lands in the right month.
--
-- OWNERSHIP + SECURITY: event_vendors has no vendor-facing SELECT RLS (it's a
-- couple table). So, exactly like vendor_source_attribution() and
-- demand_radar_for_vendor(), this is SECURITY DEFINER and gates the caller to
-- their own org via current_vendor_profile_ids() (or a console admin). It
-- returns ONLY pre-aggregated per-month counts — never a couple identity.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + REVOKE/GRANT. No table, no policy.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_booking_monthly_series(
  p_vendor_profile_id UUID,
  p_months            INTEGER DEFAULT 12
)
RETURNS TABLE(
  month_start   DATE,     -- first-of-month (Asia/Manila) for the bucket
  booking_count INTEGER,  -- # of booked event_vendors rows created that month
  revenue_php   NUMERIC   -- SUM(total_cost_php) over priced rows that month
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  -- Clamp the window to a sane 1..24 months (default 12). Guards against a
  -- caller asking for a 10,000-row series.
  v_months INTEGER := GREATEST(1, LEAST(COALESCE(p_months, 12), 24));
  v_first  DATE    := (date_trunc('month', (now() AT TIME ZONE 'Asia/Manila'))
                      - ((v_months - 1) || ' months')::interval)::date;
BEGIN
  -- Ownership gate — only the vendor's own org (or a console admin) may read.
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      v_first,
      date_trunc('month', (now() AT TIME ZONE 'Asia/Manila'))::date,
      '1 month'::interval
    )::date AS m
  ),
  booked AS (
    SELECT
      date_trunc('month', (ev.created_at AT TIME ZONE 'Asia/Manila'))::date AS m,
      ev.total_cost_php
    FROM public.event_vendors ev
    WHERE ev.marketplace_vendor_id = p_vendor_profile_id
      AND COALESCE(ev.status::text, '') IN (
        'contracted', 'deposit_paid', 'delivered', 'complete'
      )
      -- Lower-bound the scan on created_at so the index is usable; the month
      -- join then places each row in its Manila-local bucket.
      AND ev.created_at >= (v_first::timestamp AT TIME ZONE 'Asia/Manila')
  )
  SELECT
    months.m,
    COUNT(b.m)::INTEGER,
    COALESCE(SUM(b.total_cost_php), 0)::NUMERIC
  FROM months
  LEFT JOIN booked b ON b.m = months.m
  GROUP BY months.m
  ORDER BY months.m;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_booking_monthly_series(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_booking_monthly_series(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.vendor_booking_monthly_series(UUID, INTEGER) IS
  'Per-month booked-business series for the vendor My Performance Momentum chart. SECURITY DEFINER, ownership-gated to current_vendor_profile_ids() (or a console admin). Returns one row per month (zero-filled via generate_series) with booking_count + SUM(total_cost_php) over the caller''s BOOKED event_vendors rows (contracted/deposit_paid/delivered/complete), bucketed in Asia/Manila local time. Peso figures are partial by nature (total_cost_php nullable, off-platform settlement). Never exposes couple identity.';

COMMIT;
