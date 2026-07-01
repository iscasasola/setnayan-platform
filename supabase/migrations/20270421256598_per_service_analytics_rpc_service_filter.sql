-- per_service_analytics_rpc_service_filter
-- ============================================================================
-- PER-SERVICE segmentation for the vendor "My Performance" page.
--
-- WHY: A vendor with several service listings (e.g. "Classic Booth" vs
-- "360 Booth") wants to know how each one performs on its own, not just the
-- shop-level total. The two bookings-derived RPCs already aggregate the
-- caller's BOOKED event_vendors rows; event_vendors.service_id points at the
-- exact vendor_services row the couple booked (nullable — off-platform / legacy
-- rows carry NULL, ON DELETE SET NULL). So a single nullable service filter on
-- those two RPCs is all that's needed to segment on REAL data — no fabrication.
--
-- Only bookings-derived cards can segment honestly. Views / inquiries / quotes
-- are NOT tied to a service_id on their source tables, so the funnel (and the
-- health / growth / demand cards) stay shop-level; the UI shows a visible
-- "across all services" note when a service is selected.
--
-- WHAT CHANGES (all three are CREATE OR REPLACE with an APPENDED optional arg —
-- the shipped bodies are replicated verbatim, only the guard + WHERE clause
-- added):
--   (a) vendor_source_attribution    → +p_service_id UUID DEFAULT NULL
--   (b) vendor_booking_monthly_series → +p_service_id UUID DEFAULT NULL
--   (c) vendor_booking_daily_series   → +p_service_id UUID DEFAULT NULL
-- The DEFAULT NULL preserves the existing 2-arg callers unchanged.
--
-- OVERLOAD HYGIENE: adding a 3rd arg via CREATE OR REPLACE does NOT remove the
-- old 2-arg signature — Postgres treats them as two distinct overloads, and a
-- 2-arg call would become ambiguous. So we DROP the 2-arg signature FIRST, then
-- re-create the single 3-arg form; existing 2-arg callers resolve through the
-- DEFAULT NULL, so nothing breaks and only ONE overload survives.
--
-- IDOR DEFENSE-IN-DEPTH: when p_service_id is provided, we RAISE unless it is a
-- vendor_services row owned by p_vendor_profile_id. The caller (page.tsx) also
-- only ever lists the caller's own services, but the guard stops a spoofed id
-- from leaking another org's booked count via this ownership-gated RPC.
--
-- Idempotent: DROP … IF EXISTS + CREATE OR REPLACE FUNCTION + REVOKE/GRANT. No
-- table, no policy.
-- ============================================================================

BEGIN;

-- ── (a) vendor_source_attribution — +service filter ─────────────────────────
-- Drop the old 2-arg overload first so only the 3-arg form survives (a 2-arg
-- call then resolves via the DEFAULT NULL).
DROP FUNCTION IF EXISTS public.vendor_source_attribution(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.vendor_source_attribution(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ DEFAULT NULL,
  p_service_id        UUID DEFAULT NULL
)
RETURNS TABLE(
  attribution      TEXT,     -- 'setnayan' | 'off_platform' | 'unattributed'
  booking_count    INTEGER,  -- # of booked event_vendors rows in this class
  priced_count     INTEGER,  -- # of those rows that carry a total_cost_php
  revenue_php      NUMERIC   -- SUM(total_cost_php) over priced rows (NULLs skipped)
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Ownership gate — only the vendor's own org (or a console admin) may read.
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- IDOR guard — a provided service must belong to this vendor. Defense in
  -- depth: the page only lists the caller's own services, but a spoofed id
  -- must not segment another org's rows through this ownership-gated reader.
  IF p_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendor_services vs
    WHERE vs.vendor_service_id = p_service_id
      AND vs.vendor_profile_id = p_vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: service not owned';
  END IF;

  RETURN QUERY
  WITH booked AS (
    SELECT
      -- Null-safe source classification. Setnayan-attributed = the platform
      -- created the discovery (marketplace search) or the up-sell (cascade).
      -- Everything else the couple/admin brought in themselves = off-platform.
      CASE
        WHEN COALESCE(ev.source, '') IN (
          'host_marketplace_search',
          'auto_cascade_from_finalize'
        ) THEN 'setnayan'
        WHEN COALESCE(ev.source, '') IN (
          'host_manual',
          'admin'
        ) THEN 'off_platform'
        ELSE 'unattributed'
      END AS attribution,
      ev.total_cost_php
    FROM public.event_vendors ev
    WHERE ev.marketplace_vendor_id = p_vendor_profile_id
      -- "Booked" = a real commercial commitment (mirrors
      -- BOOKED_EVENT_VENDOR_STATUSES in lib/vendor-funnel.ts, intersected with
      -- the live vendor_status enum: contracted/deposit_paid/delivered/complete).
      AND COALESCE(ev.status::text, '') IN (
        'contracted', 'deposit_paid', 'delivered', 'complete'
      )
      AND (p_since IS NULL OR ev.created_at >= p_since)
      -- Per-service segment (NULL = shop-level, unchanged for 2-arg callers).
      AND (p_service_id IS NULL OR ev.service_id = p_service_id)
  )
  SELECT
    b.attribution,
    COUNT(*)::INTEGER,
    COUNT(b.total_cost_php)::INTEGER,
    COALESCE(SUM(b.total_cost_php), 0)::NUMERIC
  FROM booked b
  GROUP BY b.attribution;
END;
$$;

-- Grant the NEW 3-arg signature. (The old 2-arg signature is unchanged — the
-- DEFAULT makes the same function serve both; there is only one function.)
REVOKE ALL ON FUNCTION public.vendor_source_attribution(UUID, TIMESTAMPTZ, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_source_attribution(UUID, TIMESTAMPTZ, UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_source_attribution(UUID, TIMESTAMPTZ, UUID) IS
  'App-vs-Import ROI for the vendor My Performance page. SECURITY DEFINER, ownership-gated to current_vendor_profile_ids() (or a console admin). p_service_id (nullable, DEFAULT NULL) segments to one owned vendor_services row (IDOR-guarded — RAISE unless the service belongs to the vendor); NULL = shop-level. Classifies the caller''s BOOKED event_vendors rows into setnayan (host_marketplace_search / auto_cascade_from_finalize) vs off_platform (host_manual / admin) vs unattributed (NULL/legacy source), returning per-class booking_count, priced_count, and SUM(total_cost_php). Peso figures are partial by nature — total_cost_php is nullable and vendors settle payment off-platform. Never exposes couple identity.';

-- ── (b) vendor_booking_monthly_series — +service filter ─────────────────────
-- Drop the old 2-arg overload first (see the note above).
DROP FUNCTION IF EXISTS public.vendor_booking_monthly_series(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.vendor_booking_monthly_series(
  p_vendor_profile_id UUID,
  p_months            INTEGER DEFAULT 12,
  p_service_id        UUID DEFAULT NULL
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

  -- IDOR guard — a provided service must belong to this vendor.
  IF p_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendor_services vs
    WHERE vs.vendor_service_id = p_service_id
      AND vs.vendor_profile_id = p_vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: service not owned';
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
      -- Per-service segment (NULL = shop-level, unchanged for 2-arg callers).
      AND (p_service_id IS NULL OR ev.service_id = p_service_id)
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

REVOKE ALL ON FUNCTION public.vendor_booking_monthly_series(UUID, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_booking_monthly_series(UUID, INTEGER, UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_booking_monthly_series(UUID, INTEGER, UUID) IS
  'Per-month booked-business series for the vendor My Performance Momentum chart. SECURITY DEFINER, ownership-gated to current_vendor_profile_ids() (or a console admin). p_service_id (nullable, DEFAULT NULL) segments to one owned vendor_services row (IDOR-guarded); NULL = shop-level. Returns one row per month (zero-filled via generate_series) with booking_count + SUM(total_cost_php) over the caller''s BOOKED event_vendors rows (contracted/deposit_paid/delivered/complete), bucketed in Asia/Manila local time. Peso figures are partial by nature (total_cost_php nullable, off-platform settlement). Never exposes couple identity.';

-- ── (c) vendor_booking_daily_series — +service filter ───────────────────────
-- The Momentum DAILY chart must segment per-service just like the monthly chart
-- (owner gap-check 2026-07-01). Shipped body (20270420213000) replicated
-- verbatim; only the appended p_service_id arg, the IDOR guard, and the booked
-- CTE WHERE clause are added. Drop the old 2-arg overload first (see note above).
DROP FUNCTION IF EXISTS public.vendor_booking_daily_series(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.vendor_booking_daily_series(
  p_vendor_profile_id UUID,
  p_days              INTEGER DEFAULT 30,
  p_service_id        UUID DEFAULT NULL
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

  -- IDOR guard — a provided service must belong to this vendor.
  IF p_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendor_services vs
    WHERE vs.vendor_service_id = p_service_id
      AND vs.vendor_profile_id = p_vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: service not owned';
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
      -- Per-service segment (NULL = shop-level, unchanged for 2-arg callers).
      AND (p_service_id IS NULL OR ev.service_id = p_service_id)
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

REVOKE ALL ON FUNCTION public.vendor_booking_daily_series(UUID, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_booking_daily_series(UUID, INTEGER, UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_booking_daily_series(UUID, INTEGER, UUID) IS
  'Per-day booked-business series for the vendor My Performance Momentum Daily view (owner 2026-07-01 "also plot daily"; per-service segment added 2026-07-01 gap-check). SECURITY DEFINER, ownership-gated to current_vendor_profile_ids() (or a console admin). p_service_id (nullable, DEFAULT NULL) segments to one owned vendor_services row (IDOR-guarded); NULL = shop-level. One row per day (zero-filled via generate_series, clamped 1..90) with booking_count + SUM(total_cost_php) over the caller''s BOOKED event_vendors rows, bucketed in Asia/Manila. Peso figures partial by nature. Own-business only — never the cross-business market-intel surface, so daily granularity is privacy-safe here.';

COMMIT;
