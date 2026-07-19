-- ============================================================================
-- Personal (per-member) token wallets — multi-admin org model, PR2 of 2
-- ============================================================================
-- Owner-locked 2026-07-01: "keep tokens personal. admin can purchase for other
-- position but no transferring. whoever holds the tokens stays to them."
-- Founder-default (owner "founder default go"): store-EARNED / admin-GRANTED /
-- telemetry-REWARDED / voucher tokens all stay on the FOUNDER's existing
-- `vendor_wallets` row. Only PURCHASED tokens are personal-per-holder.
--
-- DESIGN — minimal blast radius on a live revenue table:
--   • `vendor_wallets` (PK vendor_id) is UNCHANGED — it is now, semantically,
--     the FOUNDER's wallet. The entire earned/voucher/telemetry/grant/bundle
--     subsystem keeps operating on it untouched. Zero migration of live balances.
--   • New `vendor_member_token_wallets(vendor_id, user_id)` holds NON-founder
--     members' personal purchased balances.
--   • Burn (`unlock_vendor_event`) now (a) admits any answering member
--     (admin/agent), not just the founder, and (b) debits the ANSWERING
--     member's own balance: founder → store wallet (existing voucher+purchased
--     FIFO), member → their personal purchased balance.
--   • Token-pack purchase carries a `holder_user_id` (buyer by default; an
--     ADMIN may buy FOR a teammate). Credit lands on that holder's wallet.
--     Tokens are non-transferable once credited — there is no move/gift path.
--
-- Founder/existing flows are behavior-PRESERVED (founder is an admin → passes
-- the new gate; founder holder → same store-wallet credit/debit). Everything
-- else is additive.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Per-member personal purchased-token wallet.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_member_token_wallets (
  vendor_id        UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchased_tokens INT NOT NULL DEFAULT 0 CHECK (purchased_tokens >= 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vendor_id, user_id)
);

COMMENT ON TABLE public.vendor_member_token_wallets IS
  'Per-member PERSONAL purchased-token balances (multi-admin org model 2026-07-01). Non-transferable. The FOUNDER''s balance stays in vendor_wallets; this table holds every other member''s purchased tokens. Written only by SECURITY DEFINER RPCs (purchase approve + burn).';

ALTER TABLE public.vendor_member_token_wallets ENABLE ROW LEVEL SECURITY;

-- A member reads their OWN balance; an admin reads the whole team's balances.
-- No write policy — all mutations go through the DEFINER RPCs below.
DROP POLICY IF EXISTS vmtw_self_read ON public.vendor_member_token_wallets;
CREATE POLICY vmtw_self_read
  ON public.vendor_member_token_wallets FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR vendor_id IN (SELECT public.current_vendor_ids('admin'))
  );

-- ----------------------------------------------------------------------------
-- 2. Personal-balance burn — debits a single member's purchased balance.
--    Mirrors the audit-row write of consume_vendor_assets_per_voucher.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_member_purchased_tokens(
  p_vendor_id       UUID,
  p_holder_user_id  UUID,
  p_tokens_required INT,
  p_service_code    TEXT DEFAULT NULL,
  p_event_id        UUID DEFAULT NULL,
  p_metadata        JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
  v_bal INT;
BEGIN
  IF p_tokens_required <= 0 THEN
    RAISE EXCEPTION 'INVALID_TOKEN_AMOUNT: tokens_required must be positive';
  END IF;

  SELECT purchased_tokens INTO v_bal
    FROM public.vendor_member_token_wallets
   WHERE vendor_id = p_vendor_id AND user_id = p_holder_user_id
     FOR UPDATE;

  IF v_bal IS NULL OR v_bal < p_tokens_required THEN
    RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCES: member needs % tokens · available %',
      p_tokens_required, COALESCE(v_bal, 0);
  END IF;

  UPDATE public.vendor_member_token_wallets
     SET purchased_tokens = purchased_tokens - p_tokens_required,
         updated_at = now()
   WHERE vendor_id = p_vendor_id AND user_id = p_holder_user_id;

  INSERT INTO public.token_redemptions_log
    (vendor_id, tokens_spent, service_code, related_event_id, metadata)
  VALUES
    (p_vendor_id, p_tokens_required, p_service_code, p_event_id,
     COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('holder_user_id', p_holder_user_id));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.consume_member_purchased_tokens(UUID, UUID, INT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. unlock_vendor_event — VERBATIM live body (20270331100000) with TWO changes:
--    (a) gate widened from founder-only to any answering member (admin/agent);
--    (b) the burn debits the ANSWERING member's own balance (founder → store
--        wallet via the existing voucher path; member → personal wallet).
--    Everything else (idempotency, tier gates, weekly cap, region→band) is
--    preserved byte-for-byte.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_vendor_event(
  p_vendor_profile_id UUID,
  p_event_id          UUID
) RETURNS JSONB AS $$
DECLARE
  v_region     TEXT;
  v_tokens     INT;
  v_band       SMALLINT;
  v_tier       TEXT;
  v_already    BOOLEAN;
  v_week_count INT;
  v_rowcount   INT;
  v_paid       BOOLEAN;
  v_actor      UUID := auth.uid();
  v_founder    UUID;
BEGIN
  -- (a) Answering member gate: founder + co-admins + assigned agents may answer
  -- and burn; viewers / non-members are blocked. (Was: founder-only via
  -- vendor_profiles.user_id = auth.uid().)
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_team_members tm
    WHERE tm.vendor_profile_id = p_vendor_profile_id
      AND tm.user_id = v_actor
      AND tm.role IN ('owner', 'admin', 'agent')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: caller is not an answering member of this vendor';
  END IF;

  SELECT user_id INTO v_founder FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;

  SELECT EXISTS (
    SELECT 1 FROM public.vendor_event_unlocks
    WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id
  ) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  SELECT tier_state INTO v_tier FROM public.vendor_profiles
    WHERE vendor_profile_id = p_vendor_profile_id;

  IF v_tier IS NULL OR v_tier = 'free' THEN
    RAISE EXCEPTION 'TIER_FREE_NO_INAPP: free vendors cannot accept in-app inquiries';
  END IF;

  IF v_tier = 'verified' THEN
    SELECT COUNT(*) INTO v_week_count
      FROM public.vendor_event_unlocks
     WHERE vendor_profile_id = p_vendor_profile_id
       AND unlocked_at > NOW() - INTERVAL '7 days';
    IF v_week_count >= 10 THEN
      RAISE EXCEPTION 'VERIFIED_WEEKLY_LIMIT: verified vendors can answer up to 10 in-app inquiries per week';
    END IF;
  END IF;

  v_paid := (v_tier IN ('verified', 'solo', 'pro', 'enterprise'));

  SELECT region INTO v_region FROM public.events WHERE event_id = p_event_id;
  IF v_paid THEN
    -- Region → burn_band single source (regions, alias-resolved). Unchanged.
    SELECT r.burn_band
      INTO v_band
      FROM public.regions r
     WHERE lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.slug)
        OR lower(COALESCE(NULLIF(v_region, ''), '')) = lower(r.psgc_code)
        OR r.aliases @> ARRAY[lower(COALESCE(NULLIF(v_region, ''), ''))]
     LIMIT 1;
    IF v_band IS NULL THEN
      v_band := 1;
    END IF;
    v_tokens := v_band;
  ELSE
    v_tokens := 0;
    v_band := NULL;
  END IF;

  INSERT INTO public.vendor_event_unlocks
    (vendor_profile_id, event_id, tokens_burned, region_slug, band)
  VALUES
    (p_vendor_profile_id, p_event_id, v_tokens, v_region, v_band)
  ON CONFLICT (vendor_profile_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RETURN jsonb_build_object('charged', false, 'already', true, 'tokens', 0);
  END IF;

  IF v_paid THEN
    -- (b) Debit the ANSWERING member's own balance. Founder draws from the
    -- store wallet (earned vouchers FIFO → purchased); any other member draws
    -- from their personal purchased balance.
    IF v_actor = v_founder THEN
      PERFORM public.consume_vendor_assets_per_voucher(
        p_vendor_profile_id, v_tokens, 'INQUIRY_UNLOCK', p_event_id,
        jsonb_build_object('region', v_region, 'band', v_band, 'tier', v_tier)
      );
    ELSE
      PERFORM public.consume_member_purchased_tokens(
        p_vendor_profile_id, v_actor, v_tokens, 'INQUIRY_UNLOCK', p_event_id,
        jsonb_build_object('region', v_region, 'band', v_band, 'tier', v_tier)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'charged', v_paid, 'already', false, 'tokens', v_tokens,
    'region', v_region, 'band', v_band, 'tier', v_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.unlock_vendor_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_vendor_event(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Token-pack purchases carry a holder (who receives the credited tokens).
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_token_purchases
  ADD COLUMN IF NOT EXISTS holder_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_token_purchases.holder_user_id IS
  'Member who receives the credited tokens (buyer by default; an admin may buy FOR a teammate). NULL legacy rows = the founder (back-credited on approve).';

-- Backfill legacy orders to the founder so they credit the store wallet as before.
UPDATE public.vendor_token_purchases vtp
   SET holder_user_id = vp.user_id
  FROM public.vendor_profiles vp
 WHERE vp.vendor_profile_id = vtp.vendor_id
   AND vtp.holder_user_id IS NULL;

-- create: any member may buy (for themselves); an ADMIN may buy FOR a teammate.
DROP FUNCTION IF EXISTS public.create_vendor_token_purchase(TEXT);
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

-- approve: credit the HOLDER (founder → store wallet; member → personal wallet).
CREATE OR REPLACE FUNCTION public.approve_vendor_token_purchase(p_purchase_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_p       public.vendor_token_purchases;
  v_admin   UUID := auth.uid();
  v_founder UUID;
  v_holder  UUID;
BEGIN
  IF NOT public.is_console_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only';
  END IF;

  SELECT * INTO v_p FROM public.vendor_token_purchases
    WHERE purchase_id = p_purchase_id FOR UPDATE;
  IF v_p.purchase_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_p.status = 'paid' THEN
    RETURN jsonb_build_object('already', true, 'tokens', v_p.token_count);
  END IF;
  IF v_p.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'NOT_PENDING: %', v_p.status;
  END IF;

  SELECT user_id INTO v_founder FROM public.vendor_profiles
    WHERE vendor_profile_id = v_p.vendor_id;
  v_holder := COALESCE(v_p.holder_user_id, v_founder);

  -- Purchased tokens NEVER expire. Idempotency = status guard + FOR UPDATE lock.
  IF v_holder = v_founder THEN
    INSERT INTO public.vendor_wallets (vendor_id, purchased_tokens, earned_tokens)
    VALUES (v_p.vendor_id, v_p.token_count, 0)
    ON CONFLICT (vendor_id) DO UPDATE
      SET purchased_tokens = vendor_wallets.purchased_tokens + EXCLUDED.purchased_tokens,
          updated_at = NOW();
  ELSE
    INSERT INTO public.vendor_member_token_wallets (vendor_id, user_id, purchased_tokens)
    VALUES (v_p.vendor_id, v_holder, v_p.token_count)
    ON CONFLICT (vendor_id, user_id) DO UPDATE
      SET purchased_tokens = vendor_member_token_wallets.purchased_tokens + EXCLUDED.purchased_tokens,
          updated_at = NOW();
  END IF;

  UPDATE public.vendor_token_purchases
    SET status = 'paid', paid_at = now(), reviewed_by = v_admin
    WHERE purchase_id = p_purchase_id;

  RETURN jsonb_build_object('paid', true, 'tokens', v_p.token_count, 'holder', v_holder);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.approve_vendor_token_purchase(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_vendor_token_purchase(UUID) TO authenticated;

COMMENT ON TABLE public.vendor_token_purchases IS
  'Apply-then-pay vendor token-pack orders. create_ → pending_payment (holder = buyer, or an admin-chosen teammate) · approve_ credits the HOLDER (founder → vendor_wallets.purchased_tokens · member → vendor_member_token_wallets) + flips to paid (idempotent) · reject_ marks rejected. Personal tokens are non-transferable once credited.';
