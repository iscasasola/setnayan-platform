-- ============================================================================
-- 20261012000000_vendor_lifetime_token_bundle.sql
--
-- Owner 2026-06-09: subscription bundle tokens "run lifetime and all tokens
-- are available upon purchase." Until now the bundle was granted via
-- grant_admin_direct_tokens → an EXPIRING earned_token_vouchers row (TTL capped
-- at 1-365 days; monthly bundles would vanish in 28 days). This moves the
-- bundle to the NEVER-EXPIRE bucket vendor_wallets.purchased_tokens (the same
-- bucket the buy-token flow credits), granted in full immediately.
--
-- (1) New reusable idempotent lifetime-grant RPC grant_vendor_lifetime_tokens
--     (credits purchased_tokens, logs to token_grants_log for idempotency).
-- (2) _apply_subscription_credit switched to call it (was grant_admin_direct_
--     tokens). Amounts unchanged (Pro 5/50 · Ent 10/100 from 20261011000000);
--     only the bucket + expiry change.
--
-- The burn path consume_vendor_assets_per_voucher() spends earned vouchers
-- FIFO and THEN drains purchased_tokens, so these lifetime bundle tokens are
-- fully spendable on the inquiry-answer burn.
-- ============================================================================

BEGIN;

-- ── 1 · reusable idempotent lifetime (never-expire) token grant ─────────────
-- Credits vendor_wallets.purchased_tokens (no expiry). Idempotent via the
-- UNIQUE token_grants_log.idempotency_key — a replay with the same key is a
-- no-op (no wallet credit). related_voucher_id stays NULL (purchased tokens
-- are not voucher-backed). grant_source must satisfy the table CHECK
-- (pilot_grant|telemetry_reward|manpower_handshake|admin_grant|referral_reward).
CREATE OR REPLACE FUNCTION public.grant_vendor_lifetime_tokens(
  p_vendor_id           UUID,
  p_token_count         INT,
  p_grant_source        TEXT,
  p_granted_by_admin_id UUID,
  p_rationale           TEXT,
  p_idempotency_key     TEXT
)
RETURNS VOID AS $$
BEGIN
  IF p_token_count IS NULL OR p_token_count <= 0 THEN
    RETURN;
  END IF;

  -- Idempotency anchor first: if the key already exists, do nothing (no credit).
  INSERT INTO public.token_grants_log
    (vendor_id, grant_source, tokens_granted, related_voucher_id,
     granted_by_admin_id, rationale, idempotency_key)
  VALUES
    (p_vendor_id, p_grant_source, p_token_count, NULL,
     p_granted_by_admin_id, p_rationale, p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF NOT FOUND THEN
    RETURN; -- already granted under this key → idempotent no-op
  END IF;

  -- Credit the NEVER-EXPIRE bucket.
  INSERT INTO public.vendor_wallets (vendor_id, purchased_tokens, earned_tokens)
  VALUES (p_vendor_id, p_token_count, 0)
  ON CONFLICT (vendor_id) DO UPDATE
    SET purchased_tokens = public.vendor_wallets.purchased_tokens + EXCLUDED.purchased_tokens,
        updated_at       = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.grant_vendor_lifetime_tokens(UUID, INT, TEXT, UUID, TEXT, TEXT) IS
  'Idempotent (token_grants_log.idempotency_key) grant of NEVER-EXPIRE tokens to vendor_wallets.purchased_tokens. Used for subscription bundles (lifetime per owner 2026-06-09) + admin tier-set comp bundles. Spendable via consume_vendor_assets_per_voucher (drains purchased_tokens after earned vouchers).';

-- Internal/admin only — a vendor must never self-grant lifetime tokens.
-- _apply_subscription_credit calls it as SECURITY DEFINER (owner, no grant
-- needed); setVendorTier calls it via the service-role admin client.
REVOKE ALL ON FUNCTION public.grant_vendor_lifetime_tokens(UUID, INT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_vendor_lifetime_tokens(UUID, INT, TEXT, UUID, TEXT, TEXT) TO service_role;

-- ── 2 · subscription credit core → lifetime bundle ──────────────────────────
-- Only the bundle-grant call changes (grant_admin_direct_tokens →
-- grant_vendor_lifetime_tokens). Tier activation, stacking renewal, the
-- FOR UPDATE + status='paid' idempotency guard, and the REVOKE posture are all
-- unchanged. Bundle amounts (Pro 5/50 · Ent 10/100) carried from 20261011.
CREATE OR REPLACE FUNCTION public._apply_subscription_credit(
  p_purchase_id UUID,
  p_reviewed_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_s        public.vendor_subscriptions;
  v_expires  TIMESTAMPTZ;
  v_bundle   INT;
BEGIN
  SELECT * INTO v_s FROM public.vendor_subscriptions
    WHERE purchase_id = p_purchase_id FOR UPDATE;
  IF v_s.purchase_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_s.status = 'paid' THEN
    RETURN jsonb_build_object('already', true, 'tier', v_s.tier,
                              'vendor_id', v_s.vendor_id);
  END IF;
  IF v_s.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'NOT_PENDING: %', v_s.status;
  END IF;

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
  -- 2026-06-09) — credited to the never-expire purchased_tokens bucket and
  -- available in full immediately. Idempotent per purchase via the key
  -- 'sub_bundle:<purchase_id>' (and double-guarded by the status flip above).
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

  UPDATE public.vendor_subscriptions
     SET status       = 'paid',
         activated_at = now(),
         expires_at   = v_expires,
         paid_at      = now(),
         reviewed_by  = p_reviewed_by
   WHERE purchase_id = p_purchase_id;

  RETURN jsonb_build_object('paid', true, 'tier', v_s.tier, 'bundle', v_bundle,
                            'expires_at', v_expires, 'vendor_id', v_s.vendor_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public._apply_subscription_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;

COMMIT;
