-- Retire the LAST token-minting path in the product.
--
-- Owner lock 2026-07-21, verbatim: "token can retire, there should be nothing
-- that needs token anymore." The app-side surfaces went in this same PR; this
-- migration closes the half that lives in the database.
--
-- WHAT STILL MINTED, AND WHY IT WAS INVISIBLE
--   `_apply_subscription_credit` runs when an admin confirms a vendor's
--   Pro/Enterprise payment. It did three things beyond activating the tier:
--     1. granted a per-period "free bundle" (Pro 5/50 · Enterprise 10/100) via
--        grant_vendor_lifetime_tokens;
--     2. credited a token-pack ADD-ON folded into the same order, to the
--        founder's store wallet; or
--     3. credited that add-on to a co-admin's personal wallet.
--   Nothing in the app said so — the copy advertising the bundle was removed on
--   2026-08-07 (#4216) while the grant itself kept running. Retiring the
--   currency in the UI and leaving this in place would have gone on minting a
--   currency with nothing to spend it on, silently, on every confirmed plan.
--
-- 🔑 TRACE TO THE WRITE, NOT THE FLAG. The verification bonus was already
--    retired (20270110320020) and every token pack is is_active=false, which
--    made the currency LOOK dormant. It was not: this function had no flag, no
--    copy and no UI — only a caller.
--
-- MEASURED BEFORE WRITING (prod, 2026-08-07):
--   vendor_token_purchases 0 · token_redemptions_log 0 · lead_token_holds 0 ·
--   vendor_token_boosters 0 · vendor_member_token_wallets 0 · couple_briefs 0.
--   Non-zero: token_grants_log 6 · token_rewards_log 5 · earned_token_vouchers
--   5 (100 each, all unspent) · vendor_wallets 5 rows holding 500 tokens.
--   Nobody ever bought or spent one.
--
-- WHAT THIS MIGRATION DOES NOT DO — deliberately:
--   · It does NOT drop grant_vendor_lifetime_tokens or any token table. The 500
--     granted tokens and their audit rows are a record of what happened; the
--     point is that nothing NEW is created, not that history is erased.
--   · It does NOT touch vendor_billing_catalog. Every token pack is already
--     inactive, and the one ACTIVE token row — 'vendor_custom_included_token',
--     the Custom plan's PHP 100/cycle line — is locked-SKU territory awaiting an
--     owner decision. Changing a live price is never a side effect.
--
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public._apply_subscription_credit(
  p_purchase_id uuid,
  p_reviewed_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_s       public.vendor_subscriptions;
  v_expires TIMESTAMPTZ;
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

  -- The token bundle and the add-on credit were REMOVED here (2026-08-07).
  -- Activating a plan now activates a plan. Nothing else.

  UPDATE public.vendor_subscriptions
     SET status       = 'paid',
         activated_at = now(),
         expires_at   = v_expires,
         paid_at      = now(),
         reviewed_by  = p_reviewed_by
   WHERE purchase_id = p_purchase_id;

  -- `bundle` and `addon_tokens` stay in the return shape as a constant 0 so any
  -- caller still reading them gets a truthful zero rather than a missing key.
  -- Both are unread in the app as of this migration.
  RETURN jsonb_build_object('paid', true, 'tier', v_s.tier, 'bundle', 0,
                            'addon_tokens', 0,
                            'expires_at', v_expires, 'vendor_id', v_s.vendor_id);
END;
$function$;

COMMENT ON FUNCTION public._apply_subscription_credit(uuid, uuid) IS
  'Activate a paid vendor subscription. Token bundle + add-on credit removed 2026-08-07 with the token retirement (owner lock 2026-07-21) - this was the last path that minted tokens.';
