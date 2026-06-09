-- ============================================================================
-- 20261011000000_vendor_subscription_bundle_reprice.sql
--
-- Reprice the per-period FREE token bundle granted with a paid vendor
-- subscription (owner 2026-06-09):
--   Pro        monthly 30 → 5    · annual 300  → 50
--   Enterprise monthly 100 → 10  · annual 1000 → 100
--
-- The amounts live in TWO places that MUST stay in sync:
--   (1) lib/vendor-tier-caps.ts TIER_SUBSCRIPTION_BUNDLE_TOKENS (display +
--       the interim admin tier-set grant in setVendorTier), and
--   (2) the SQL CASE inside _apply_subscription_credit (the money-path RPC).
-- This migration updates (2); (1) is updated in the same PR. CREATE OR REPLACE
-- only touches the function body — the CASE constants — leaving the table,
-- RLS, the REVOKE posture, the stacking-renewal math, the idempotent
-- 'sub_bundle:<id>' grant key, and every other RPC unchanged. Idempotent:
-- re-running just re-asserts the same body. (20261010000000 created this
-- function with the old amounts; this is the active version.)
-- ============================================================================

BEGIN;

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

  -- Activate / extend the paid tier.
  UPDATE public.vendor_profiles
     SET tier_state         = v_s.tier,
         tier_expires_at    = v_expires,
         tier_billing_cycle = v_s.billing_cycle
   WHERE vendor_profile_id = v_s.vendor_id;

  -- Per-period FREE token bundle. REPRICED 2026-06-09 (owner):
  -- Pro 5/50 · Enterprise 10/100. MIRRORS lib/vendor-tier-caps.ts
  -- TIER_SUBSCRIPTION_BUNDLE_TOKENS — keep both in sync on any reprice.
  v_bundle := CASE
    WHEN v_s.tier = 'pro'        AND v_s.billing_cycle = 'monthly' THEN 5
    WHEN v_s.tier = 'pro'        AND v_s.billing_cycle = 'annual'  THEN 50
    WHEN v_s.tier = 'enterprise' AND v_s.billing_cycle = 'monthly' THEN 10
    WHEN v_s.tier = 'enterprise' AND v_s.billing_cycle = 'annual'  THEN 100
    ELSE 0
  END;

  IF v_bundle > 0 THEN
    -- grant_source MUST be 'admin_grant' — the helper's CHECK does not allow
    -- 'subscription_bundle'. TTL = the subscription period (one-shot grant).
    -- p_reviewed_by is the approving admin (NULL on the webhook path).
    -- Idempotent per purchase via key 'sub_bundle:<purchase_id>'.
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
-- Re-assert internal-only posture (CREATE OR REPLACE preserves grants, but be
-- explicit so a fresh apply never leaves it open to anon/authenticated).
REVOKE ALL ON FUNCTION public._apply_subscription_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;

COMMIT;
