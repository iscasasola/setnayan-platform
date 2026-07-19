-- ============================================================================
-- peso_per_lead_scorecard · Wave 6 vendor benefit · "Peso-Per-Lead Scorecard"
-- (unit economics). Read-only — adds two SECURITY DEFINER reporting functions,
-- no tables. KEEP IDEMPOTENT (CREATE OR REPLACE FUNCTION).
--
-- WHAT THIS ADDS:
--   1. vendor_peso_per_lead(p_vendor_profile_id, p_period_days) — a vendor's OWN
--      unit-economics for a trailing window: token-burn spend (in TOKENS — the
--      caller's TS layer multiplies by the admin-managed ₱/token; see note
--      below), paid-subscription PHP spend, leads answered, and the lifetime
--      finalized-booking denominator → cost-per-booked-couple + cost-per-lead.
--      Ownership-gated EXACTLY like unlock_vendor_event / confirm_vendor_payment
--      (vendor_profiles.user_id = auth.uid()).
--   2. admin_peso_per_lead_overview(p_period_days) — platform-wide ROW PER
--      VENDOR with the same primitives, for the /admin/insights card.
--      is_console_admin()-gated.
--
-- WHY THE ₱/TOKEN PRICE IS *NOT* IN THIS SQL
-- ------------------------------------------
-- The flat vendor-token price is owner-locked + ADMIN-MANAGED in code as
-- `TOKEN_PRICE_PHP` (apps/web/lib/v2/region-token-burn.ts, ₱100). These
-- functions return token COUNTS and leave the × ₱/token multiply to
-- lib/vendor-peso.ts, so the price has ONE source of truth and is never
-- duplicated (drift-prone) here. Subscription spend is already stored as real
-- PHP in vendor_subscriptions.amount_php, so that we return directly.
--
-- BEHAVIORAL HONESTY — "economically inert in pilot"
-- --------------------------------------------------
-- The burn-on-answer path (region-token-burn.ts · unlock_vendor_event) is NOT
-- charged in the pilot: every fresh unlock writes tokens_burned but the consume
-- call is a deliberate post-pilot activation. In prod today SUM(tokens_burned)=0
-- so token spend = ₱0 and cost-per-lead = ₱0 until burn activates. These
-- functions report that 0 honestly — they NEVER fabricate spend. Both UIs
-- annotate ₱0 as "burn is inert in the pilot," not "free leads."
--
-- SECURITY: both functions are SECURITY DEFINER (they read across RLS-protected
-- aggregate tables) but each gates its own caller — the vendor fn checks
-- ownership, the admin fn checks is_console_admin(). REVOKE ALL FROM PUBLIC;
-- GRANT EXECUTE TO authenticated only.
-- ============================================================================

-- ── 1 · Vendor's own scorecard ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_peso_per_lead(
  p_vendor_profile_id UUID,
  p_period_days       INT DEFAULT 28
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since               TIMESTAMPTZ;
  v_clamped_days        INT;
  v_tokens_burned_total BIGINT;
  v_leads_answered      INT;
  v_subscription_php    NUMERIC(12,2);
  v_finalized_bookings  INT;
BEGIN
  -- Ownership gate — mirror unlock_vendor_event / confirm_vendor_payment.
  -- SECURITY DEFINER bypasses RLS, so without this any signed-in user could
  -- read another vendor's unit economics.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not own this vendor profile';
  END IF;

  -- Clamp the window (1 day … 2 years) so a hostile/huge value can't surprise.
  -- Default 28d = one billing cycle.
  v_clamped_days := LEAST(GREATEST(COALESCE(p_period_days, 28), 1), 730);
  v_since := NOW() - (v_clamped_days || ' days')::INTERVAL;

  -- Token-burn spend (in TOKENS) + leads answered, from the per-(vendor,event)
  -- unlock ledger within the window. tokens_burned is 0 in the pilot (inert).
  SELECT COALESCE(SUM(u.tokens_burned), 0)::BIGINT, COUNT(*)::INT
    INTO v_tokens_burned_total, v_leads_answered
    FROM public.vendor_event_unlocks u
   WHERE u.vendor_profile_id = p_vendor_profile_id
     AND u.unlocked_at >= v_since;

  -- Paid-subscription PHP spend within the window (real pesos on the row).
  SELECT COALESCE(SUM(s.amount_php), 0)::NUMERIC(12,2)
    INTO v_subscription_php
    FROM public.vendor_subscriptions s
   WHERE s.vendor_id = p_vendor_profile_id
     AND s.status = 'paid'
     AND COALESCE(s.paid_at, s.created_at) >= v_since;

  -- Lifetime finalized-booking denominator (the activity-stats rollup is not
  -- period-windowed; the UI labels it "lifetime bookings" so the ratio is honest).
  SELECT COALESCE(a.finalized_booking_count, 0)
    INTO v_finalized_bookings
    FROM public.vendor_activity_stats a
   WHERE a.vendor_profile_id = p_vendor_profile_id;

  RETURN jsonb_build_object(
    'period_days',         v_clamped_days,
    'since',               v_since,
    'tokens_burned_total', v_tokens_burned_total,        -- × ₱/token in TS
    'leads_answered',      v_leads_answered,
    'subscription_php',    v_subscription_php,            -- already PHP
    'finalized_bookings',  COALESCE(v_finalized_bookings, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.vendor_peso_per_lead(UUID, INT) IS
  'Peso-Per-Lead Scorecard (Wave 6) · a vendor''s OWN unit economics for a trailing window: SUM(tokens_burned) (×₱/token in TS), leads answered (count of vendor_event_unlocks), paid-subscription PHP, and lifetime finalized_booking_count. Ownership-gated (vendor_profiles.user_id=auth.uid()). Token-burn is inert in pilot → tokens_burned_total=0 → ₱0/lead until burn activates. Returns counts, never fabricates spend.';

REVOKE ALL ON FUNCTION public.vendor_peso_per_lead(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_peso_per_lead(UUID, INT) TO authenticated;

-- ── 2 · Admin platform-wide overview (one row per active vendor) ────────────
CREATE OR REPLACE FUNCTION public.admin_peso_per_lead_overview(
  p_period_days INT DEFAULT 28
) RETURNS TABLE (
  vendor_profile_id    UUID,
  business_name        TEXT,
  tier_state           TEXT,
  tokens_burned_total  BIGINT,
  leads_answered       INT,
  subscription_php     NUMERIC(12,2),
  finalized_bookings   INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ;
BEGIN
  -- Admin gate — console-aligned. Without this, SECURITY DEFINER would leak
  -- every vendor's economics to any authenticated caller.
  IF NOT public.is_console_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only';
  END IF;

  v_since := NOW() - (LEAST(GREATEST(COALESCE(p_period_days, 28), 1), 730)
                      || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    vp.vendor_profile_id,
    vp.business_name,
    vp.tier_state::TEXT,
    COALESCE(u.tokens_burned_total, 0)::BIGINT,
    COALESCE(u.leads_answered, 0)::INT,
    COALESCE(s.subscription_php, 0)::NUMERIC(12,2),
    COALESCE(a.finalized_booking_count, 0)::INT
  FROM public.vendor_profiles vp
  LEFT JOIN (
    SELECT eu.vendor_profile_id,
           SUM(eu.tokens_burned)::BIGINT AS tokens_burned_total,
           COUNT(*)::INT                 AS leads_answered
      FROM public.vendor_event_unlocks eu
     WHERE eu.unlocked_at >= v_since
     GROUP BY eu.vendor_profile_id
  ) u ON u.vendor_profile_id = vp.vendor_profile_id
  LEFT JOIN (
    SELECT vs.vendor_id,
           SUM(vs.amount_php)::NUMERIC(12,2) AS subscription_php
      FROM public.vendor_subscriptions vs
     WHERE vs.status = 'paid'
       AND COALESCE(vs.paid_at, vs.created_at) >= v_since
     GROUP BY vs.vendor_id
  ) s ON s.vendor_id = vp.vendor_profile_id
  LEFT JOIN public.vendor_activity_stats a
         ON a.vendor_profile_id = vp.vendor_profile_id
  -- Only vendors with economics worth watching: ≥1 answered lead, some paid
  -- subscription spend, or a finalized booking.
  WHERE COALESCE(u.leads_answered, 0) > 0
     OR COALESCE(s.subscription_php, 0) > 0
     OR COALESCE(a.finalized_booking_count, 0) > 0
  ORDER BY COALESCE(a.finalized_booking_count, 0) DESC,
           COALESCE(u.leads_answered, 0) DESC;
END;
$$;

COMMENT ON FUNCTION public.admin_peso_per_lead_overview(INT) IS
  'Peso-Per-Lead Scorecard (Wave 6) · admin platform-wide unit economics, one row per active vendor (tokens burned, leads answered, paid-subscription PHP, lifetime finalized bookings) for a trailing window. is_console_admin()-gated. tokens × ₱/token happens in TS (admin-managed price single-source). Token-burn inert in pilot → tokens_burned_total=0.';

REVOKE ALL ON FUNCTION public.admin_peso_per_lead_overview(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_peso_per_lead_overview(INT) TO authenticated;

