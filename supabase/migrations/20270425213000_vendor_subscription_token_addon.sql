-- ============================================================================
-- 20270425213000_vendor_subscription_token_addon.sql
-- Unified vendor billing · ONE payment for a plan + a token pack.
--
-- Owner 2026-07-01: "keep subscription and tokens in one place. so they can make
-- 1 purchase for both." The vendor billing hub now lets a Pro/Enterprise order
-- optionally carry a token-pack ADD-ON — folded into the SAME apply-then-pay
-- order (one SUB- reference, one amount, one admin approval activates BOTH the
-- tier and the tokens). Standalone token-pack purchases (vendor_token_purchases)
-- are unchanged and still available for top-ups without a plan change.
--
-- WHY piggyback on the subscription order rather than build a cart:
--   • The subscription approval already grants tokens (the per-period bundle via
--     grant_admin_direct_tokens), so "a subscription order that also delivers
--     tokens" is a solved, idempotent pattern — we extend it, not reinvent it.
--   • No new order_items table, no second reference namespace, no touch to the
--     couple-side orders spine. One row, one reference, one payment, one review.
--
-- THREE changes, all additive / backward-compatible:
--   1. vendor_subscriptions gains addon columns + holder_user_id (defaulted NULL
--      → legacy + plan-only orders are untouched; amount_php becomes the GRAND
--      TOTAL = plan + COALESCE(addon,0), which equals the plan price when no
--      add-on, so existing rows keep their meaning).
--   2. create_vendor_subscription(p_sku_code, p_addon_token_pack_sku DEFAULT NULL)
--      resolves the add-on price + token count from vendor_billing_catalog
--      (DB-authoritative, never client-supplied) and folds it into amount_php.
--   3. _apply_subscription_credit also credits the add-on's NEVER-EXPIRE
--      purchased tokens to the holder (founder → vendor_wallets · member →
--      vendor_member_token_wallets), reusing the exact credit shape from
--      approve_vendor_token_purchase. Idempotent via the existing status='paid'
--      guard (runs once, on activation).
--
-- SECURITY POSTURE (unchanged): create_ + approve_ are the only vendor/admin
-- entry points; _apply_subscription_credit stays internal (REVOKE anon +
-- authenticated). The add-on price/count are read from the catalog inside the
-- SECURITY DEFINER function, never trusted from the client (mirrors the plan
-- price + the token-pack flow). create_vendor_subscription remains founder-only
-- (resolves vendor via vendor_profiles.user_id = auth.uid()), so the add-on
-- holder is always the founder today; the member-wallet branch is kept for
-- forward-compatibility if subscription creation is later widened to co-admins.
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
  'Member who receives the add-on tokens (the buyer). Founder today (create_ is founder-only); NULL legacy/plan-only rows credit the founder.';
COMMENT ON COLUMN public.vendor_subscriptions.addon_token_pack_sku IS
  'Optional token-pack SKU bought in the SAME order as the plan. NULL = plan only.';
COMMENT ON COLUMN public.vendor_subscriptions.addon_token_count IS
  'Never-expire purchased tokens the add-on pack grants (from vendor_billing_catalog.token_grant_count). NULL = plan only.';
COMMENT ON COLUMN public.vendor_subscriptions.addon_amount_php IS
  'Peso price of the add-on pack. amount_php = plan price + COALESCE(addon_amount_php, 0) = the grand total the vendor pays.';

-- ── 2 · create: plan + optional token-pack add-on, ONE order ────────────────
-- DROP the 1-arg version so PostgREST resolves the new 2-arg signature without
-- overload ambiguity (mirrors 20270401611377 for create_vendor_token_purchase).
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
  SELECT vendor_profile_id INTO v_vendor_id
    FROM public.vendor_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'NO_VENDOR_PROFILE: caller has no vendor profile';
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

-- ── 3 · credit core: tier + bundle + PAID token add-on ──────────────────────
-- Extends the existing function: after the tier flip + per-period free bundle,
-- credit the add-on's NEVER-EXPIRE purchased tokens to the holder. Idempotent
-- via the status='paid' early-return at the top (the whole body runs once).
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

  -- Per-period FREE token bundle (mirrors TIER_SUBSCRIPTION_BUNDLE_TOKENS).
  v_bundle := CASE
    WHEN v_s.tier = 'pro'        AND v_s.billing_cycle = 'monthly' THEN 30
    WHEN v_s.tier = 'pro'        AND v_s.billing_cycle = 'annual'  THEN 300
    WHEN v_s.tier = 'enterprise' AND v_s.billing_cycle = 'monthly' THEN 100
    WHEN v_s.tier = 'enterprise' AND v_s.billing_cycle = 'annual'  THEN 1000
    ELSE 0
  END;

  IF v_bundle > 0 THEN
    PERFORM public.grant_admin_direct_tokens(
      v_s.vendor_id,
      v_bundle,
      v_s.period_days,
      'admin_grant',
      p_reviewed_by,
      'Subscription bundle: ' || v_s.sku_code,
      'sub_bundle:' || p_purchase_id::text
    );
  END IF;

  -- PAID token-pack ADD-ON bought in this same order → never-expire purchased
  -- tokens credited to the holder (founder → store wallet · member → personal
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

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase Studio SQL editor):
--
-- -- (1) Add-on columns exist:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='vendor_subscriptions'
--     AND column_name IN ('holder_user_id','addon_token_pack_sku',
--                         'addon_token_count','addon_amount_php');
-- -- Expected: 4 rows
--
-- -- (2) create_ now takes 2 args (1-arg dropped):
-- SELECT pg_get_function_identity_arguments(oid) FROM pg_proc
--   WHERE proname='create_vendor_subscription';
-- -- Expected: 'p_sku_code text, p_addon_token_pack_sku text'
--
-- -- (3) End-to-end combined order (replace SKUs / UUIDs):
-- -- as the vendor:
-- --   SELECT public.create_vendor_subscription('pro_vendor_monthly',
-- --                                             'vendor_token_pack_10');
-- -- amount_php should equal plan ₱2,499 + pack ₱1,000 = ₱3,499.
-- -- as an admin:  SELECT public.approve_vendor_subscription('<purchase_id>');
-- -- SELECT purchased_tokens FROM vendor_wallets WHERE vendor_id='<vendor_id>';
-- -- Expected: +10 never-expire purchased tokens (on top of the bundle grant).
-- ============================================================================
