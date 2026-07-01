-- ============================================================================
-- 20270425213000_vendor_subscription_token_addon.sql
-- Unified vendor billing · ONE payment for a plan + a token pack.
--
-- Owner 2026-07-01: "keep subscription and tokens in one place. so they can make
-- 1 purchase for both." A Pro/Enterprise order may optionally carry a token-pack
-- ADD-ON folded into the SAME apply-then-pay order (one SUB- reference, one
-- amount, one admin approval activates BOTH the tier and the tokens). Standalone
-- token-pack purchases (vendor_token_purchases) are unchanged.
--
-- ⚠ THIS MIGRATION EXTENDS THE *CURRENT* FUNCTION BODIES — it does NOT revert to
-- the original 20261010000000 versions. create_vendor_subscription is taken from
-- its latest definition 20270403095563 (admin-resolution via current_vendor_ids
-- ('admin') + NOT_VENDOR_ADMIN, and the owner-locked NOT_VERIFIED gate), and
-- _apply_subscription_credit from its latest definition 20261012000000 (LIFETIME
-- bundle Pro 5/50 · Ent 10/100 via grant_vendor_lifetime_tokens into the
-- never-expire purchased_tokens bucket). Only the add-on logic is layered on top.
--
-- WHY piggyback on the subscription order rather than build a cart: the approval
-- already grants tokens (the per-period bundle), so "a subscription order that
-- also delivers tokens" is a solved, idempotent pattern — we extend it. No new
-- order_items table, no second reference namespace, no touch to the couple-side
-- orders spine. One row, one reference, one payment, one review.
--
-- amount_php becomes the GRAND TOTAL (plan + COALESCE(addon,0)); the add-on peso
-- portion is stored separately in addon_amount_php so plan-only spend is
-- recoverable (see the peso-per-lead scorecard fix in §4). Legacy rows have
-- addon_amount_php NULL → amount_php still equals the plan price.
-- ============================================================================

BEGIN;

-- ── 1 · add-on + holder columns on the subscription order ───────────────────
ALTER TABLE public.vendor_subscriptions
  ADD COLUMN IF NOT EXISTS holder_user_id       UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS addon_token_pack_sku TEXT,
  ADD COLUMN IF NOT EXISTS addon_token_count    INT,
  ADD COLUMN IF NOT EXISTS addon_amount_php     NUMERIC(10,2);

COMMENT ON COLUMN public.vendor_subscriptions.holder_user_id IS
  'The buying admin (auth.uid() at create) who receives the add-on tokens: founder → store wallet, co-admin → personal wallet. NULL legacy rows credit the founder.';
COMMENT ON COLUMN public.vendor_subscriptions.addon_token_pack_sku IS
  'Optional token-pack SKU bought in the SAME order as the plan. NULL = plan only.';
COMMENT ON COLUMN public.vendor_subscriptions.addon_token_count IS
  'Never-expire purchased tokens the add-on pack grants (from vendor_billing_catalog.token_grant_count). NULL = plan only.';
COMMENT ON COLUMN public.vendor_subscriptions.addon_amount_php IS
  'Peso price of the add-on pack. amount_php = plan price + COALESCE(addon_amount_php, 0) = the grand total the vendor pays.';

-- ── 2 · create: plan + optional token-pack add-on, ONE order ────────────────
-- Body = the CURRENT definition (20270403095563): admin-resolution +
-- verification gate, PLUS the optional add-on. DROP the 1-arg version so
-- PostgREST resolves the new 2-arg signature without overload ambiguity.
DROP FUNCTION IF EXISTS public.create_vendor_subscription(TEXT);
CREATE OR REPLACE FUNCTION public.create_vendor_subscription(
  p_sku_code             TEXT,
  p_addon_token_pack_sku TEXT DEFAULT NULL
)
RETURNS public.vendor_subscriptions AS $$
DECLARE
  v_vendor_id   UUID;
  v_price       NUMERIC(10,2);
  v_offering    TEXT;
  v_cycle       TEXT;
  v_period      INT;
  v_tier        public.vendor_tier_state;
  v_ref         TEXT;
  v_addon_sku   TEXT := NULL;
  v_addon_price NUMERIC(10,2) := NULL;
  v_addon_count INT := NULL;
  v_total       NUMERIC(10,2);
  v_row         public.vendor_subscriptions;
BEGIN
  -- Admin-only: resolve the store where the caller is an admin (multi-admin org
  -- model — NOT founder-only). Preserved from 20270401574089 / 20270403095563.
  SELECT vid INTO v_vendor_id FROM public.current_vendor_ids('admin') AS vid LIMIT 1;
  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'NOT_VENDOR_ADMIN: only a store admin can purchase a subscription';
  END IF;

  -- Verification gate (owner 2026-07-01): only a VERIFIED store may subscribe.
  IF COALESCE(
       (SELECT verification_state::text FROM public.vendor_profiles
         WHERE vendor_profile_id = v_vendor_id), '') <> 'verified' THEN
    RAISE EXCEPTION 'NOT_VERIFIED: verify your shop before subscribing';
  END IF;

  -- Plan price + offering from the catalog (subscriptions only).
  SELECT price_php, offering_type INTO v_price, v_offering
    FROM public.vendor_billing_catalog
    WHERE sku_code = p_sku_code
      AND offering_type IN ('subscription_monthly', 'subscription_annual')
      AND is_active = TRUE;
  IF v_offering IS NULL THEN
    RAISE EXCEPTION 'INVALID_SKU: %', p_sku_code;
  END IF;

  IF v_offering = 'subscription_annual' THEN
    v_cycle := 'annual';
    v_period := 365;
  ELSE
    v_cycle := 'monthly';
    v_period := 28;
  END IF;

  IF p_sku_code LIKE 'pro\_vendor\_%' THEN
    v_tier := 'pro';
  ELSIF p_sku_code LIKE 'enterprise\_vendor\_%' THEN
    v_tier := 'enterprise';
  ELSE
    RAISE EXCEPTION 'UNMAPPED_SKU_TIER: %', p_sku_code;
  END IF;

  -- Optional token-pack ADD-ON folded into this same order. Price + count are
  -- read from the DB catalog (never client-supplied), same as the plan.
  IF p_addon_token_pack_sku IS NOT NULL AND btrim(p_addon_token_pack_sku) <> '' THEN
    SELECT price_php, token_grant_count INTO v_addon_price, v_addon_count
      FROM public.vendor_billing_catalog
      WHERE sku_code = p_addon_token_pack_sku
        AND offering_type = 'token_pack'
        AND is_active = TRUE;
    IF v_addon_count IS NULL OR v_addon_count <= 0 THEN
      RAISE EXCEPTION 'INVALID_PACK: %', p_addon_token_pack_sku;
    END IF;
    v_addon_sku := p_addon_token_pack_sku;
  END IF;

  -- amount_php = the grand total the vendor pays (plan + add-on).
  v_total := v_price + COALESCE(v_addon_price, 0);
  v_ref := 'SUB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO public.vendor_subscriptions
    (vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code, period_days,
     holder_user_id, addon_token_pack_sku, addon_token_count, addon_amount_php)
  VALUES
    (v_vendor_id, p_sku_code, v_tier, v_cycle, v_total, v_ref, v_period,
     auth.uid(), v_addon_sku, v_addon_count, v_addon_price)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.create_vendor_subscription(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_vendor_subscription(TEXT, TEXT) TO authenticated;

-- ── 3 · credit core: tier + LIFETIME bundle + PAID token add-on ─────────────
-- Body = the CURRENT definition (20261012000000): LIFETIME bundle (Pro 5/50 ·
-- Ent 10/100) via grant_vendor_lifetime_tokens into the never-expire
-- purchased_tokens bucket, PLUS the add-on credit. Idempotent via the existing
-- status='paid' early-return (the whole body runs once, on activation).
CREATE OR REPLACE FUNCTION public._apply_subscription_credit(
  p_purchase_id UUID,
  p_reviewed_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_s       public.vendor_subscriptions;
  v_expires TIMESTAMPTZ;
  v_bundle  INT;
  v_founder UUID;
  v_holder  UUID;
BEGIN
  SELECT * INTO v_s FROM public.vendor_subscriptions
    WHERE purchase_id = p_purchase_id FOR UPDATE;
  IF v_s.purchase_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  -- Idempotent: a replayed webhook (or admin double-click) is a no-op.
  IF v_s.status = 'paid' THEN
    RETURN jsonb_build_object('already', true, 'tier', v_s.tier,
                              'vendor_id', v_s.vendor_id);
  END IF;
  IF v_s.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'NOT_PENDING: %', v_s.status;
  END IF;

  -- Renewal stacks on top of any remaining time (else from now()).
  v_expires := GREATEST(now(), COALESCE(
    (SELECT tier_expires_at FROM public.vendor_profiles
       WHERE vendor_profile_id = v_s.vendor_id),
    now()
  )) + (v_s.period_days || ' days')::interval;

  UPDATE public.vendor_profiles
     SET tier_state         = v_s.tier,
         tier_expires_at    = v_expires,
         tier_billing_cycle = v_s.billing_cycle
   WHERE vendor_profile_id = v_s.vendor_id;

  -- Per-period FREE token bundle (Pro 5/50 · Ent 10/100). LIFETIME (owner
  -- 2026-06-09) — credited to the never-expire purchased_tokens bucket.
  -- Idempotent per purchase via key 'sub_bundle:<purchase_id>'.
  v_bundle := CASE
    WHEN v_s.tier = 'pro'        AND v_s.billing_cycle = 'monthly' THEN 5
    WHEN v_s.tier = 'pro'        AND v_s.billing_cycle = 'annual'  THEN 50
    WHEN v_s.tier = 'enterprise' AND v_s.billing_cycle = 'monthly' THEN 10
    WHEN v_s.tier = 'enterprise' AND v_s.billing_cycle = 'annual'  THEN 100
    ELSE 0
  END;

  IF v_bundle > 0 THEN
    PERFORM public.grant_vendor_lifetime_tokens(
      v_s.vendor_id,
      v_bundle,
      'admin_grant',
      p_reviewed_by,
      'Subscription bundle (lifetime): ' || v_s.sku_code,
      'sub_bundle:' || p_purchase_id::text
    );
  END IF;

  -- PAID token-pack ADD-ON bought in this same order → never-expire purchased
  -- tokens credited to the HOLDER (founder → store wallet · co-admin → personal
  -- wallet), reusing approve_vendor_token_purchase's credit shape exactly.
  IF v_s.addon_token_pack_sku IS NOT NULL AND COALESCE(v_s.addon_token_count, 0) > 0 THEN
    SELECT user_id INTO v_founder FROM public.vendor_profiles
      WHERE vendor_profile_id = v_s.vendor_id;
    v_holder := COALESCE(v_s.holder_user_id, v_founder);

    IF v_holder = v_founder THEN
      INSERT INTO public.vendor_wallets (vendor_id, purchased_tokens, earned_tokens)
      VALUES (v_s.vendor_id, v_s.addon_token_count, 0)
      ON CONFLICT (vendor_id) DO UPDATE
        SET purchased_tokens = vendor_wallets.purchased_tokens + EXCLUDED.purchased_tokens,
            updated_at = NOW();
    ELSE
      INSERT INTO public.vendor_member_token_wallets (vendor_id, user_id, purchased_tokens)
      VALUES (v_s.vendor_id, v_holder, v_s.addon_token_count)
      ON CONFLICT (vendor_id, user_id) DO UPDATE
        SET purchased_tokens = vendor_member_token_wallets.purchased_tokens + EXCLUDED.purchased_tokens,
            updated_at = NOW();
    END IF;
  END IF;

  UPDATE public.vendor_subscriptions
     SET status       = 'paid',
         activated_at = now(),
         expires_at   = v_expires,
         paid_at      = now(),
         reviewed_by  = p_reviewed_by
   WHERE purchase_id = p_purchase_id;

  RETURN jsonb_build_object('paid', true, 'tier', v_s.tier, 'bundle', v_bundle,
                            'addon_tokens', COALESCE(v_s.addon_token_count, 0),
                            'expires_at', v_expires, 'vendor_id', v_s.vendor_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Internal-only (unchanged posture): only the DEFINER wrappers may call it.
REVOKE ALL ON FUNCTION public._apply_subscription_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ── 4 · peso-per-lead scorecard: count only the PLAN portion as sub spend ───
-- amount_php now includes the token add-on. The scorecard's "subscription spend"
-- must stay plan-only, so subtract addon_amount_php (NULL on legacy/plan-only
-- rows → unchanged). Bodies are otherwise verbatim from 20270322391018.
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
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.vendor_profile_id = p_vendor_profile_id
      AND vp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not own this vendor profile';
  END IF;

  v_clamped_days := LEAST(GREATEST(COALESCE(p_period_days, 28), 1), 730);
  v_since := NOW() - (v_clamped_days || ' days')::INTERVAL;

  SELECT COALESCE(SUM(u.tokens_burned), 0)::BIGINT, COUNT(*)::INT
    INTO v_tokens_burned_total, v_leads_answered
    FROM public.vendor_event_unlocks u
   WHERE u.vendor_profile_id = p_vendor_profile_id
     AND u.unlocked_at >= v_since;

  -- Plan-only PHP (exclude any token add-on folded into the order).
  SELECT COALESCE(SUM(s.amount_php - COALESCE(s.addon_amount_php, 0)), 0)::NUMERIC(12,2)
    INTO v_subscription_php
    FROM public.vendor_subscriptions s
   WHERE s.vendor_id = p_vendor_profile_id
     AND s.status = 'paid'
     AND COALESCE(s.paid_at, s.created_at) >= v_since;

  SELECT COALESCE(a.finalized_booking_count, 0)
    INTO v_finalized_bookings
    FROM public.vendor_activity_stats a
   WHERE a.vendor_profile_id = p_vendor_profile_id;

  RETURN jsonb_build_object(
    'period_days',         v_clamped_days,
    'since',               v_since,
    'tokens_burned_total', v_tokens_burned_total,
    'leads_answered',      v_leads_answered,
    'subscription_php',    v_subscription_php,
    'finalized_bookings',  COALESCE(v_finalized_bookings, 0)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_peso_per_lead(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_peso_per_lead(UUID, INT) TO authenticated;

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
           SUM(vs.amount_php - COALESCE(vs.addon_amount_php, 0))::NUMERIC(12,2) AS subscription_php
      FROM public.vendor_subscriptions vs
     WHERE vs.status = 'paid'
       AND COALESCE(vs.paid_at, vs.created_at) >= v_since
     GROUP BY vs.vendor_id
  ) s ON s.vendor_id = vp.vendor_profile_id
  LEFT JOIN public.vendor_activity_stats a
         ON a.vendor_profile_id = vp.vendor_profile_id
  WHERE COALESCE(u.leads_answered, 0) > 0
     OR COALESCE(s.subscription_php, 0) > 0
     OR COALESCE(a.finalized_booking_count, 0) > 0
  ORDER BY COALESCE(a.finalized_booking_count, 0) DESC,
           COALESCE(u.leads_answered, 0) DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_peso_per_lead_overview(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_peso_per_lead_overview(INT) TO authenticated;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase Studio SQL editor):
--
-- -- (1) Add-on columns exist:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='vendor_subscriptions'
--     AND column_name IN ('holder_user_id','addon_token_pack_sku',
--                         'addon_token_count','addon_amount_php');  -- Expected: 4
--
-- -- (2) create_ takes 2 args; the verification + admin gates survive:
-- SELECT pg_get_functiondef('public.create_vendor_subscription(text,text)'::regprocedure)
--   ~ 'NOT_VERIFIED' AS has_verify_gate,
--        pg_get_functiondef('public.create_vendor_subscription(text,text)'::regprocedure)
--   ~ 'current_vendor_ids' AS has_admin_gate;  -- Expected: t, t
--
-- -- (3) Bundle stays LIFETIME 5/50/10/100 (grant_vendor_lifetime_tokens):
-- SELECT pg_get_functiondef('public._apply_subscription_credit(uuid,uuid)'::regprocedure)
--   ~ 'grant_vendor_lifetime_tokens' AS lifetime_bundle;  -- Expected: t
--
-- -- (4) End-to-end combined order (VERIFIED admin, replace SKUs/UUIDs):
-- --   SELECT public.create_vendor_subscription('pro_vendor_monthly','vendor_token_pack_10');
-- --   -- amount_php = ₱2,499 + ₱1,000 = ₱3,499; addon_amount_php = ₱1,000.
-- --   SELECT public.approve_vendor_subscription('<purchase_id>');
-- --   -- vendor_wallets.purchased_tokens += 5 (Pro-monthly bundle) + 10 (add-on) = +15.
-- ============================================================================
