-- vendor_conversion_analytics_rpcs
-- ============================================================================
-- My Performance · Phase B family 2 — "Conversion & deals" analytics (Pro tier).
--
-- Four own-business, ownership-gated readers for the vendor's quote→booking
-- economics. Column set schema-discovery-mapped and adversarially verified
-- against the shipped migrations. All SECURITY DEFINER + STABLE, gated to the
-- caller's own org exactly like the other My Performance RPCs:
--   p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
--   OR public.is_console_admin()
--
-- OWN-BUSINESS ONLY: every table filtered to the caller's own vendor.
--
--   1. vendor_quote_stats  — quote acceptance rate + time-to-quote (inquiry
--        open → proposal sent, joined on the shared (event_id, vendor) pair).
--   2. vendor_deal_size    — avg accepted-quote value (vendor_proposals.
--        total_centavos) + avg/total confirmed contract value
--        (event_vendors.total_cost_php). Peso figures are PARTIAL by design
--        (total_cost_php nullable, off-platform settlement).
--   3. vendor_lead_time    — booking lead time = events.event_date −
--        booking-row created_at (Asia/Manila). avg + median days.
--   4. vendor_win_loss     — transparent counts: bookings won (distinct booked
--        events) vs inquiries declined vs quotes lost (declined/expired), and a
--        win rate over DECIDED inquiries only (won ÷ (won + declined)).
--
-- HONESTY (carried from discovery):
--   • event_vendors has NO contracted_at/booked_at — created_at is the
--     booking-record date (a proxy), and total_cost_php is nullable.
--   • "Lost" has no single flag; the silent-loss class (accepted inquiry never
--     booked, quote left 'sent') is NOT counted as a loss — hence win rate is
--     "of decided inquiries", surfaced as such in the UI.
--
-- "Booked" = contracted / deposit_paid / delivered / complete (the event_vendors
-- vendor_status enum has no 'paid' value — matches the series RPCs).
--
-- Idempotent: CREATE OR REPLACE + REVOKE/GRANT. No tables, no policies.
-- ============================================================================

BEGIN;

-- 1 ── Quote acceptance + time-to-quote -------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_quote_stats(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  sent_count               INTEGER,  -- proposals that left draft
  accepted_count           INTEGER,
  acceptance_pct           NUMERIC,  -- accepted / sent, 0..100
  quoted_with_inquiry_count INTEGER, -- proposals matched to an inquiry thread
  avg_hours_to_quote       NUMERIC   -- avg (proposal sent − inquiry opened)
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
  WITH p AS (
    SELECT vp.status, vp.event_id
    FROM public.vendor_proposals vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND (p_since IS NULL OR vp.created_at >= p_since)
  ),
  ttq AS (
    SELECT EXTRACT(EPOCH FROM (vp.sent_at - ct.created_at)) / 3600.0 AS hrs
    FROM public.vendor_proposals vp
    JOIN public.chat_threads ct
      ON ct.event_id = vp.event_id
     AND ct.vendor_profile_id = vp.vendor_profile_id
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.sent_at IS NOT NULL
      AND vp.sent_at >= ct.created_at
      AND (p_since IS NULL OR vp.created_at >= p_since)
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM p
       WHERE status IN ('sent', 'viewed', 'accepted', 'declined', 'expired')),
    (SELECT COUNT(*)::INTEGER FROM p WHERE status = 'accepted'),
    (100.0 * (SELECT COUNT(*) FROM p WHERE status = 'accepted')
      / NULLIF((SELECT COUNT(*) FROM p
                 WHERE status IN ('sent', 'viewed', 'accepted', 'declined', 'expired')), 0))::NUMERIC,
    (SELECT COUNT(*)::INTEGER FROM ttq),
    (SELECT AVG(hrs) FROM ttq)::NUMERIC;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_quote_stats(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_quote_stats(UUID, TIMESTAMPTZ) TO authenticated;

-- 2 ── Deal size (quoted + confirmed contract) ------------------------------
CREATE OR REPLACE FUNCTION public.vendor_deal_size(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  accepted_proposal_count INTEGER,
  avg_quoted_php          NUMERIC,  -- avg accepted vendor_proposals.total_centavos/100
  booked_priced_count     INTEGER,  -- booked event_vendors with a price
  avg_contract_php        NUMERIC,  -- avg event_vendors.total_cost_php over those
  total_contract_php      NUMERIC   -- sum over all booked (priced) rows
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
    (SELECT AVG(ev.total_cost_php)::NUMERIC FROM public.event_vendors ev
      WHERE ev.marketplace_vendor_id = p_vendor_profile_id
        AND COALESCE(ev.status::text, '') IN ('contracted', 'deposit_paid', 'delivered', 'complete')
        AND ev.total_cost_php IS NOT NULL
        AND (p_since IS NULL OR ev.created_at >= p_since)),
    (SELECT COALESCE(SUM(ev.total_cost_php), 0)::NUMERIC FROM public.event_vendors ev
      WHERE ev.marketplace_vendor_id = p_vendor_profile_id
        AND COALESCE(ev.status::text, '') IN ('contracted', 'deposit_paid', 'delivered', 'complete')
        AND ev.total_cost_php IS NOT NULL
        AND (p_since IS NULL OR ev.created_at >= p_since));
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_deal_size(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_deal_size(UUID, TIMESTAMPTZ) TO authenticated;

-- 3 ── Booking lead time (booking-row date → event date) --------------------
CREATE OR REPLACE FUNCTION public.vendor_lead_time(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  booked_with_date_count INTEGER,
  avg_lead_days          NUMERIC,
  median_lead_days       NUMERIC
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
  WITH lt AS (
    SELECT (e.event_date - (ev.created_at AT TIME ZONE 'Asia/Manila')::date) AS days
    FROM public.event_vendors ev
    JOIN public.events e ON e.event_id = ev.event_id
    WHERE ev.marketplace_vendor_id = p_vendor_profile_id
      AND COALESCE(ev.status::text, '') IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      AND e.event_date IS NOT NULL
      AND (p_since IS NULL OR ev.created_at >= p_since)
  )
  SELECT
    COUNT(*)::INTEGER,
    AVG(lt.days)::NUMERIC,
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY lt.days))::NUMERIC
  FROM lt
  WHERE lt.days >= 0;  -- drop vendors added after the event (negative lead)
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_lead_time(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_lead_time(UUID, TIMESTAMPTZ) TO authenticated;

-- 4 ── Win / loss (transparent counts + decided-win-rate) -------------------
CREATE OR REPLACE FUNCTION public.vendor_win_loss(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  bookings_won        INTEGER,  -- distinct booked events
  inquiries_declined  INTEGER,  -- chat_threads.inquiry_status='declined'
  quotes_lost         INTEGER,  -- vendor_proposals declined/expired
  win_rate_of_decided NUMERIC   -- won / (won + inquiries_declined), 0..100
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
  WITH won AS (
    SELECT DISTINCT ev.event_id
    FROM public.event_vendors ev
    WHERE ev.marketplace_vendor_id = p_vendor_profile_id
      AND COALESCE(ev.status::text, '') IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      AND (p_since IS NULL OR ev.created_at >= p_since)
  ),
  declined AS (
    SELECT COUNT(*)::INTEGER AS c
    FROM public.chat_threads ct
    WHERE ct.vendor_profile_id = p_vendor_profile_id
      AND ct.inquiry_status = 'declined'
      AND (p_since IS NULL OR ct.created_at >= p_since)
  ),
  lostq AS (
    SELECT COUNT(*)::INTEGER AS c
    FROM public.vendor_proposals vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.status IN ('declined', 'expired')
      AND (p_since IS NULL OR vp.created_at >= p_since)
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM won),
    (SELECT c FROM declined),
    (SELECT c FROM lostq),
    (100.0 * (SELECT COUNT(*) FROM won)
      / NULLIF((SELECT COUNT(*) FROM won) + (SELECT c FROM declined), 0))::NUMERIC;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_win_loss(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_win_loss(UUID, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.vendor_quote_stats(UUID, TIMESTAMPTZ) IS
  'My Performance · Conversion. Quote acceptance rate + avg time-to-quote (inquiry open→proposal sent). SECURITY DEFINER, ownership-gated. Own-business only.';
COMMENT ON FUNCTION public.vendor_deal_size(UUID, TIMESTAMPTZ) IS
  'My Performance · Conversion. Avg accepted-quote value (vendor_proposals.total_centavos) + avg/total confirmed contract value (event_vendors.total_cost_php, partial by design). SECURITY DEFINER, ownership-gated.';
COMMENT ON FUNCTION public.vendor_lead_time(UUID, TIMESTAMPTZ) IS
  'My Performance · Conversion. Booking lead time = events.event_date − booking-row created_at (Asia/Manila), avg + median days over booked rows with a set date. SECURITY DEFINER, ownership-gated.';
COMMENT ON FUNCTION public.vendor_win_loss(UUID, TIMESTAMPTZ) IS
  'My Performance · Conversion. Transparent counts: bookings won vs inquiries declined vs quotes lost, plus win rate over DECIDED inquiries (won/(won+declined)). Silent-loss class not counted. SECURITY DEFINER, ownership-gated.';

COMMIT;
