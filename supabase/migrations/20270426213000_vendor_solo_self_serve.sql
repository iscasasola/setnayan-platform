-- ============================================================================
-- 20270426213000_vendor_solo_self_serve.sql
-- Make the Solo tier self-serve buyable on /vendor-dashboard/subscription.
--
-- Owner 2026-07-02: "i do not see solo." Solo (₱999/28d · ₱9,999/yr, Ladder B)
-- is the entry-level PAID tier and the seed migration 20270221294989 always
-- intended vendors to SUBSCRIBE to Solo/Pro/Enterprise. But two pieces were
-- never wired, so the subscription page had to hide Solo (a self-serve Solo card
-- would hard-error at checkout):
--   1. `solo_vendor_annual` was never seeded — only `solo_vendor_monthly`
--      exists (the Ladder-B reprice UPDATE for the annual row was a no-op).
--   2. `create_vendor_subscription` maps only pro_/enterprise_ SKUs → any
--      solo_vendor_% SKU RAISEs UNMAPPED_SKU_TIER.
--
-- This migration closes both — additively. It does NOT change any other tier's
-- price, any cap, or the add-on / bundle logic:
--   • Seed `solo_vendor_annual` at ₱9,999 (Ladder B · 10× the ₱999 monthly →
--     3 of 13 cycles free = "save 12 weeks"), same capability shape as
--     `solo_vendor_monthly` (1 category · 0 sub-seats · truly solo).
--   • Re-create `create_vendor_subscription(TEXT, TEXT)` with a leading
--     `solo_vendor_%` → 'solo' branch. Body is otherwise VERBATIM from its
--     current definition (20270425213000): admin-resolution via
--     current_vendor_ids('admin') + NOT_VENDOR_ADMIN, the owner-locked
--     NOT_VERIFIED gate, and the optional token-pack add-on.
--
-- Solo grants NO bundle tokens: `_apply_subscription_credit`'s CASE already
-- returns 0 for any tier that isn't pro/enterprise, and Solo burns tokens per
-- answered inquiry exactly like Pro/Enterprise (inAppGated=true). So NO change
-- to _apply_subscription_credit / approve_vendor_subscription is needed — 'solo'
-- is already a valid vendor_tier_state and flows through activation unchanged.
-- ============================================================================

BEGIN;

-- ── 1 · Seed the missing Solo ANNUAL SKU (Ladder B ₱9,999/yr) ────────────────
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('solo_vendor_annual', 'Solo Vendor (Annual · save 12 weeks)', 9999.00, 'subscription_annual', NULL, 1, 0, 6)
ON CONFLICT (sku_code) DO UPDATE SET
  title          = EXCLUDED.title,
  price_php      = EXCLUDED.price_php,
  offering_type  = EXCLUDED.offering_type,
  max_categories = EXCLUDED.max_categories,
  max_sub_seats  = EXCLUDED.max_sub_seats,
  display_order  = EXCLUDED.display_order,
  is_active      = TRUE,
  updated_at     = NOW();

-- ── 2 · create_vendor_subscription: add the solo_vendor_% → 'solo' branch ────
-- Full body cloned from 20270425213000 (the add-on version); ONLY the tier-map
-- gains a leading solo branch. 2-arg signature preserved.
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

  IF p_sku_code LIKE 'solo\_vendor\_%' THEN
    v_tier := 'solo';
  ELSIF p_sku_code LIKE 'pro\_vendor\_%' THEN
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

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase Studio SQL editor):
--
-- -- (1) Solo annual SKU is live at ₱9,999:
-- SELECT sku_code, price_php, offering_type, is_active
--   FROM public.vendor_billing_catalog
--   WHERE sku_code IN ('solo_vendor_monthly','solo_vendor_annual');  -- Expect 2 rows
--
-- -- (2) The RPC now maps solo (and still gates verify + admin):
-- SELECT pg_get_functiondef('public.create_vendor_subscription(text,text)'::regprocedure)
--          ~ 'solo\\_vendor'   AS has_solo_branch,
--        pg_get_functiondef('public.create_vendor_subscription(text,text)'::regprocedure)
--          ~ 'NOT_VERIFIED'    AS has_verify_gate;  -- Expected: t, t
--
-- -- (3) End-to-end (VERIFIED admin): a Solo order mints a SUB- ref, tier 'solo':
-- --   SELECT public.create_vendor_subscription('solo_vendor_monthly');
-- --   -- amount_php = ₱999 · tier = 'solo' · billing_cycle = 'monthly'.
-- ============================================================================
