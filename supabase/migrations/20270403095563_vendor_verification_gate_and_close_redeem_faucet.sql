-- ============================================================================
-- Vendor money integrity — verification gate on buy-tokens + subscribe
-- (owner 2026-07-01: "they can only purchase tokens and subscribe when they
--  are verified").
--
-- Reverses the stale 2026-06-07 "FREE may buy tokens" override (`canBuyTokens`
-- returned true for all tiers). Its original justification — "let FREE buy
-- tokens to import their clients" — is dead since customer import went free
-- (#2448). An unverified store now has no way to acquire tokens or a paid tier
-- until it verifies.
--
-- Both RPCs are redefined VERBATIM from their current definitions
-- (create_vendor_token_purchase → 20270401611377 member-aware (TEXT,UUID);
--  create_vendor_subscription → 20270401574089 multi-admin (TEXT)) with ONLY a
-- verification guard added. The guard is null-safe (COALESCE + ::text) so a
-- NULL / unverified / pending_review store is blocked; only 'verified' passes.
-- This closes the "gate the buy path but leave a free-token faucet open" hole
-- when paired with the subscription-bundle + redeem-code removals in the same
-- PR (an unverified store can otherwise never obtain tokens).
-- ============================================================================

-- ── tokens: any member may buy for themselves; an admin may buy for a teammate;
--    the STORE must be verified ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_vendor_token_purchase(
  p_pack_sku_code  TEXT,
  p_holder_user_id UUID DEFAULT NULL
)
RETURNS public.vendor_token_purchases AS $$
DECLARE
  v_vendor_id UUID;
  v_holder    UUID;
  v_price     NUMERIC(10,2);
  v_tokens    INT;
  v_ref       TEXT;
  v_row       public.vendor_token_purchases;
BEGIN
  -- Resolve the caller's store via membership (any member may buy their own).
  SELECT vendor_profile_id INTO v_vendor_id
    FROM public.vendor_team_members
   WHERE user_id = auth.uid()
   ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'owner' THEN 0 WHEN 'agent' THEN 1 ELSE 2 END,
            created_at ASC
   LIMIT 1;
  IF v_vendor_id IS NULL THEN
    SELECT vendor_profile_id INTO v_vendor_id
      FROM public.vendor_profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;
  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'NO_VENDOR_PROFILE: caller has no vendor profile';
  END IF;

  -- Verification gate (owner 2026-07-01): only a VERIFIED store may buy tokens.
  IF COALESCE(
       (SELECT verification_state::text FROM public.vendor_profiles
         WHERE vendor_profile_id = v_vendor_id), '') <> 'verified' THEN
    RAISE EXCEPTION 'NOT_VERIFIED: verify your shop before buying tokens';
  END IF;

  -- Determine the holder. Default = the buyer. Buying FOR someone else is an
  -- ADMIN-only action and the target must be a member of the same store.
  IF p_holder_user_id IS NULL OR p_holder_user_id = auth.uid() THEN
    v_holder := auth.uid();
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.vendor_team_members
       WHERE vendor_profile_id = v_vendor_id AND user_id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'NOT_VENDOR_ADMIN: only an admin can buy tokens for a teammate';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.vendor_team_members
       WHERE vendor_profile_id = v_vendor_id AND user_id = p_holder_user_id
    ) THEN
      RAISE EXCEPTION 'NOT_A_MEMBER: the recipient is not on this team';
    END IF;
    v_holder := p_holder_user_id;
  END IF;

  SELECT price_php, token_grant_count INTO v_price, v_tokens
    FROM public.vendor_billing_catalog
    WHERE sku_code = p_pack_sku_code
      AND offering_type = 'token_pack'
      AND is_active = TRUE;
  IF v_tokens IS NULL OR v_tokens <= 0 THEN
    RAISE EXCEPTION 'INVALID_PACK: %', p_pack_sku_code;
  END IF;

  v_ref := 'TKN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.vendor_token_purchases
    (vendor_id, pack_sku_code, token_count, amount_php, reference_code, holder_user_id)
  VALUES (v_vendor_id, p_pack_sku_code, v_tokens, v_price, v_ref, v_holder)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.create_vendor_token_purchase(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_vendor_token_purchase(TEXT, UUID) TO authenticated;

-- ── subscription: admin-only + the STORE must be verified ───────────────────
CREATE OR REPLACE FUNCTION public.create_vendor_subscription(p_sku_code TEXT)
RETURNS public.vendor_subscriptions AS $$
DECLARE
  v_vendor_id UUID;
  v_price     NUMERIC(10,2);
  v_offering  TEXT;
  v_cycle     TEXT;
  v_period    INT;
  v_tier      public.vendor_tier_state;
  v_ref       TEXT;
  v_row       public.vendor_subscriptions;
BEGIN
  -- Admin-only: resolve the store where the caller is an admin.
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

  v_ref := 'SUB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO public.vendor_subscriptions
    (vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code, period_days)
  VALUES (v_vendor_id, p_sku_code, v_tier, v_cycle, v_price, v_ref, v_period)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.create_vendor_subscription(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_vendor_subscription(TEXT) TO authenticated;

-- ── close the redeem-code free-token faucet at the source ───────────────────
-- The vendor self-serve voucher-redeem surface (/vendor-dashboard/redeem-code)
-- is hard-deleted in this PR (owner 2026-07-01 "no free tokens"). Also revoke
-- EXECUTE on its RPC so the faucet can't be reached by a crafted API call
-- either — the route 404 alone would leave the SECURITY DEFINER function
-- callable. `redeem_vendor_token_voucher` is used ONLY by that deleted route
-- (no couple-checkout / admin path calls it), so revoking is self-contained.
-- Admins can still CREATE vouchers via /admin/discount-codes; whether to also
-- retire that admin-side ability is a separate owner decision (D2) — flagged,
-- not touched here.
REVOKE EXECUTE ON FUNCTION public.redeem_vendor_token_voucher(UUID, UUID, TEXT)
  FROM authenticated, PUBLIC;
