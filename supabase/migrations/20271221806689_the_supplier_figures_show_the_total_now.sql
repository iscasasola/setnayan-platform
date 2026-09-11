-- ============================================================================
-- THE SUPPLIER'S OWN FIGURES SHOW THE AGREED TOTAL NOW
-- ============================================================================
--
-- Owner, 2026-09-11, shown ₱100,000 agreed and locked → a −₱15,000 Deal locked
-- later → the budget reading "Agreed price before changes ₱100,000 · New deal
-- agreed in chat (price lowered) −₱15,000 · Agreed total now ₱85,000", and
-- asked what every OTHER screen should say — the couple's supplier list, the
-- event home, the Decisions payments line, the supplier-dashboard figures:
--
--     "Show the total now"
--
-- Since 20271218458148 a price change after a lock no longer moves
-- `event_vendors.total_cost_php`; it is written beside it as an
-- `event_vendor_line_items` row with `is_change_delta = TRUE`. The supplier's
-- My Performance figures read `total_cost_php` alone, so a supplier who cut a
-- ₱100,000 booking to ₱85,000 would still see ₱100,000 in their revenue.
--
-- The four readers behind those figures are re-signed here with ONE change
-- each: every `ev.total_cost_php` that is SUMMED or AVERAGED becomes the agreed
-- total now —
--
--     (ev.total_cost_php
--        + COALESCE((SELECT SUM(li.amount_php)
--                      FROM public.event_vendor_line_items li
--                     WHERE li.vendor_id = ev.vendor_id
--                       AND li.is_change_delta), 0))
--
-- — the same change-line subquery the two booking-fee functions carry since
-- 20271218458148 (so the fee and the supplier's revenue move with the same
-- number), and the SQL twin of `agreedTotalNow` in
-- apps/web/lib/agreed-total-and-its-changes.ts, which every app screen uses.
-- `agreed-total-and-its-changes.test.ts` pins the subquery text in all six
-- bodies to one form.
--
-- What is deliberately NOT changed:
--   · The `IS NOT NULL` filters and the priced COUNTs keep reading the
--     headline. `NULL + x` is NULL, so a booking with no agreed price stays
--     unpriced here exactly as before — a change is never mistaken for a price.
--   · Ownership gates, IDOR guards, windows, grants, comments: byte-identical to
--     the LIVE `pg_get_functiondef` (read 2026-09-11). CREATE OR REPLACE keeps
--     the ACL and COMMENT as they are; no REVOKE/GRANT is issued, so the
--     exposure baseline does not move.
--
-- Idempotent: CREATE OR REPLACE only. Inert until a change line exists
-- (production holds 0 change orders and 0 locked deals, 2026-09-11).
-- ============================================================================

-- ── 1 · Monthly booked revenue (My Performance · momentum) ───────────────────
CREATE OR REPLACE FUNCTION public.vendor_booking_monthly_series(p_vendor_profile_id uuid, p_months integer DEFAULT 12, p_service_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(month_start date, booking_count integer, revenue_php numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- THE ONE CHANGE: the agreed total NOW (lock price + changes since).
      (ev.total_cost_php
         + COALESCE((SELECT SUM(li.amount_php)
                       FROM public.event_vendor_line_items li
                      WHERE li.vendor_id = ev.vendor_id
                        AND li.is_change_delta), 0)) AS total_cost_php
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
$function$;

-- ── 2 · Daily booked revenue (My Performance · momentum, short range) ───────
CREATE OR REPLACE FUNCTION public.vendor_booking_daily_series(p_vendor_profile_id uuid, p_days integer DEFAULT 30, p_service_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(day_start date, booking_count integer, revenue_php numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- THE ONE CHANGE: the agreed total NOW (lock price + changes since).
      (ev.total_cost_php
         + COALESCE((SELECT SUM(li.amount_php)
                       FROM public.event_vendor_line_items li
                      WHERE li.vendor_id = ev.vendor_id
                        AND li.is_change_delta), 0)) AS total_cost_php
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
$function$;

-- ── 3 · Revenue by where the booking came from (My Performance · ROI) ───────
CREATE OR REPLACE FUNCTION public.vendor_source_attribution(p_vendor_profile_id uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_service_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(attribution text, booking_count integer, priced_count integer, revenue_php numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- THE ONE CHANGE: the agreed total NOW (lock price + changes since).
      -- NULL stays NULL, so `priced_count` below counts exactly what it did.
      (ev.total_cost_php
         + COALESCE((SELECT SUM(li.amount_php)
                       FROM public.event_vendor_line_items li
                      WHERE li.vendor_id = ev.vendor_id
                        AND li.is_change_delta), 0)) AS total_cost_php
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
$function$;

-- ── 4 · Deal size (My Performance · conversion & deals) ─────────────────────
-- The AVG and the SUM are the agreed total now; the priced COUNT and the
-- `IS NOT NULL` filters keep reading the headline (unchanged meaning).
CREATE OR REPLACE FUNCTION public.vendor_deal_size(p_vendor_profile_id uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(accepted_proposal_count integer, avg_quoted_php numeric, booked_priced_count integer, avg_contract_php numeric, total_contract_php numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM public.vendor_proposals vp
      WHERE vp.vendor_profile_id = p_vendor_profile_id
        AND vp.status = 'accepted'
        AND (p_since IS NULL OR vp.created_at >= p_since)),
    (SELECT AVG(vp.total_centavos / 100.0)::NUMERIC FROM public.vendor_proposals vp
      WHERE vp.vendor_profile_id = p_vendor_profile_id
        AND vp.status = 'accepted'
        AND vp.total_centavos > 0
        AND (p_since IS NULL OR vp.created_at >= p_since)),
    (SELECT COUNT(*)::INTEGER FROM public.event_vendors ev
      WHERE ev.marketplace_vendor_id = p_vendor_profile_id
        AND COALESCE(ev.status::text, '') IN ('contracted', 'deposit_paid', 'delivered', 'complete')
        AND ev.total_cost_php IS NOT NULL
        AND (p_since IS NULL OR ev.created_at >= p_since)),
    (SELECT AVG(ev.total_cost_php
                  + COALESCE((SELECT SUM(li.amount_php)
                                FROM public.event_vendor_line_items li
                               WHERE li.vendor_id = ev.vendor_id
                                 AND li.is_change_delta), 0))::NUMERIC
       FROM public.event_vendors ev
      WHERE ev.marketplace_vendor_id = p_vendor_profile_id
        AND COALESCE(ev.status::text, '') IN ('contracted', 'deposit_paid', 'delivered', 'complete')
        AND ev.total_cost_php IS NOT NULL
        AND (p_since IS NULL OR ev.created_at >= p_since)),
    (SELECT COALESCE(SUM(ev.total_cost_php
                           + COALESCE((SELECT SUM(li.amount_php)
                                         FROM public.event_vendor_line_items li
                                        WHERE li.vendor_id = ev.vendor_id
                                          AND li.is_change_delta), 0)), 0)::NUMERIC
       FROM public.event_vendors ev
      WHERE ev.marketplace_vendor_id = p_vendor_profile_id
        AND COALESCE(ev.status::text, '') IN ('contracted', 'deposit_paid', 'delivered', 'complete')
        AND ev.total_cost_php IS NOT NULL
        AND (p_since IS NULL OR ev.created_at >= p_since));
END;
$function$;
