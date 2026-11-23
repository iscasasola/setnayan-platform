-- ============================================================================
-- APPLE-BILLED SHOP PLANS: THE SERVER NAMES THE SHOP, AND AN EARLY REFUND STICKS.
--
-- Follow-up to #8166 (migration 20271359936839), two faults found in Ship's review.
--
-- ── 1 · ORDER OF DELIVERY ───────────────────────────────────────────────────
-- Apple does not promise to deliver notifications in order. A REFUND or REVOKE that arrived before its
-- SUBSCRIBED found no subscription row, answered 200 "never granted" and kept nothing, so the SUBSCRIBED that
-- arrived (or was retried) after it granted a plan whose money had already gone back.
-- Now every REFUND / REVOKE is kept in `vendor_app_store_reversals`, granted or not, and
-- `app_store_supplier_plan_apply` grants nothing for a transaction that ledger names:
--   · a REFUND names one transaction: that transaction never grants;
--   · a REVOKE names the whole subscription: no transaction bought at or before the revoke grants.
--     A purchase made after it is new money and grants as usual.
--
-- ── 2 · WHICH SHOP ──────────────────────────────────────────────────────────
-- The phone used to send the shop's own id as Apple's `appAccountToken`, and a notification granted to whatever
-- shop that token named. A payer could put another shop's id there and tie a plan, and its Apple billing, to it.
-- Now the server issues the token when a purchase starts (`startAppStorePurchase`, lib/iap/iap-actions.ts), only for
-- a shop the signed-in person manages, and keeps the pairing in `vendor_app_store_plan_tokens`. A notification
-- grants only to the shop its token was issued for. An unknown token grants nothing and is logged for a person
-- (lib/iap/supplier-subscription.server.ts). The pairing is read in the server code; this migration holds it.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The token the server issued, and the shop it was issued for.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_app_store_plan_tokens (
  app_account_token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_app_store_plan_tokens ENABLE ROW LEVEL SECURITY;

-- Reach: written and read only by the server (service role). A shop's admins and Setnayan admins may read; no client
-- ever writes, so the default grants are taken back.
REVOKE ALL ON public.vendor_app_store_plan_tokens FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.vendor_app_store_plan_tokens FROM authenticated;

CREATE INDEX IF NOT EXISTS vendor_app_store_plan_tokens_vendor_idx
  ON public.vendor_app_store_plan_tokens (vendor_profile_id);

COMMENT ON TABLE public.vendor_app_store_plan_tokens IS
  'The appAccountToken the server issued when a supplier plan purchase started in the iPhone app (startAppStorePurchase), and the ONE shop it was issued for (the signed-in person manages it). App Store notifications grant a new subscription only to this pairing; an unknown token grants nothing.';

DROP POLICY IF EXISTS vendor_app_store_plan_tokens_shop_read ON public.vendor_app_store_plan_tokens;
CREATE POLICY vendor_app_store_plan_tokens_shop_read
  ON public.vendor_app_store_plan_tokens FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_app_store_plan_tokens_admin_read ON public.vendor_app_store_plan_tokens;
CREATE POLICY vendor_app_store_plan_tokens_admin_read
  ON public.vendor_app_store_plan_tokens FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- 2. Every REFUND and REVOKE Apple sent, granted or not.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_app_store_reversals (
  reversal_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_transaction_id TEXT NOT NULL,
  -- The refunded transaction. NULL = a REVOKE of the whole subscription.
  transaction_id          TEXT,
  status                  TEXT NOT NULL CHECK (status IN ('refunded', 'revoked')),
  notification            TEXT,
  recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_app_store_reversals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.vendor_app_store_reversals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.vendor_app_store_reversals FROM authenticated;

-- Apple retries a notification until it hears 200: the same reversal twice is one row.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_app_store_reversals_once_idx
  ON public.vendor_app_store_reversals (original_transaction_id, COALESCE(transaction_id, ''), status);

COMMENT ON TABLE public.vendor_app_store_reversals IS
  'Every App Store REFUND (one transaction) and REVOKE (transaction_id NULL = the whole subscription) of a supplier plan, kept even when it arrived before the subscription was granted. app_store_supplier_plan_apply grants nothing for a transaction named here. Written only by app_store_supplier_plan_end.';

-- Not a shop's to read: an early reversal names no shop yet. Setnayan admins only.
DROP POLICY IF EXISTS vendor_app_store_reversals_admin_read ON public.vendor_app_store_reversals;
CREATE POLICY vendor_app_store_reversals_admin_read
  ON public.vendor_app_store_reversals FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- 3. A paid period lands, unless Apple already took its money back.
--    The body of 20271359936839 §6, plus the reversal check before anything is written.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_store_supplier_plan_apply(
  p_vendor_id      UUID,
  p_original_tx    TEXT,
  p_tx_id          TEXT,
  p_product_id     TEXT,
  p_tier           public.vendor_tier_state,
  p_sku_code       TEXT,
  p_purchase_at    TIMESTAMPTZ,
  p_expires_at     TIMESTAMPTZ,
  p_amount_php     NUMERIC,
  p_environment    TEXT,
  p_notification   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map      public.vendor_app_store_subscriptions;
  v_existing public.vendor_subscriptions;
  v_purchase UUID;
  v_start    TIMESTAMPTZ;
BEGIN
  IF p_original_tx IS NULL OR p_tx_id IS NULL OR p_expires_at IS NULL
     OR p_tier NOT IN ('solo', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'BAD_INPUT';
  END IF;

  -- ORDER OF DELIVERY: a REFUND of this transaction, or a REVOKE of its subscription made after it was bought,
  -- may have arrived first. Its money is gone, so nothing is granted, and no shop is tied to the subscription.
  IF EXISTS (SELECT 1 FROM public.vendor_app_store_reversals r
              WHERE r.original_transaction_id = p_original_tx
                AND (r.transaction_id = p_tx_id
                     OR (r.transaction_id IS NULL
                         AND COALESCE(p_purchase_at, '-infinity'::TIMESTAMPTZ) <= r.recorded_at))) THEN
    UPDATE public.vendor_app_store_subscriptions
       SET last_notification = p_notification, last_notification_at = now(), updated_at = now()
     WHERE original_transaction_id = p_original_tx;
    RETURN jsonb_build_object('refused', 'reversed', 'vendor_id', NULL);
  END IF;

  PERFORM 1 FROM public.vendor_profiles WHERE vendor_profile_id = p_vendor_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('refused', 'no_shop');
  END IF;

  SELECT * INTO v_map FROM public.vendor_app_store_subscriptions
   WHERE original_transaction_id = p_original_tx FOR UPDATE;

  IF FOUND THEN
    -- ONE SUBSCRIPTION = ONE SHOP. A restore, a renewal or a plan change on another shop never moves it.
    IF v_map.vendor_profile_id <> p_vendor_id THEN
      RETURN jsonb_build_object('refused', 'other_shop', 'vendor_id', v_map.vendor_profile_id);
    END IF;
    -- A month refunded earlier does not refuse the next one: a new paid period is new money.
  ELSE
    -- One Apple subscription per shop at a time.
    IF EXISTS (SELECT 1 FROM public.vendor_app_store_subscriptions a
                WHERE a.vendor_profile_id = p_vendor_id
                  AND a.status IN ('active', 'billing_retry')
                  AND a.expires_at > now()) THEN
      RETURN jsonb_build_object('refused', 'other_subscription', 'vendor_id', p_vendor_id);
    END IF;
    -- ONE CHANNEL: a shop the web bills is not billed by Apple as well.
    IF public.vendor_plan_billing_channel(p_vendor_id) = 'web' THEN
      RETURN jsonb_build_object('refused', 'web_billed', 'vendor_id', p_vendor_id);
    END IF;
    INSERT INTO public.vendor_app_store_subscriptions
      (original_transaction_id, vendor_profile_id, product_id, tier, environment, status, expires_at)
    VALUES (p_original_tx, p_vendor_id, p_product_id, p_tier, p_environment, 'active', p_expires_at)
    RETURNING * INTO v_map;
  END IF;

  -- The same transaction twice (the app's confirm AND Apple's notification) lands once.
  SELECT * INTO v_existing FROM public.vendor_subscriptions WHERE reference_code = 'APL-' || p_tx_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'already', true, 'status', v_existing.status, 'tier', v_existing.tier, 'vendor_id', p_vendor_id);
  END IF;

  -- A period that has already ended (a late notification, an old transaction in a restore) is history, not a grant.
  IF p_expires_at <= now() THEN
    UPDATE public.vendor_app_store_subscriptions
       SET last_notification = p_notification, last_notification_at = now(), updated_at = now()
     WHERE original_transaction_id = p_original_tx;
    RETURN jsonb_build_object('stale', true, 'vendor_id', p_vendor_id);
  END IF;

  v_start := LEAST(COALESCE(p_purchase_at, now()), now());

  INSERT INTO public.vendor_subscriptions
    (vendor_id, sku_code, tier, billing_cycle, amount_php, list_price_php, reference_code, period_days,
     status, plan_change_kind, app_store_original_transaction_id)
  VALUES
    (p_vendor_id, p_sku_code, p_tier, 'monthly', p_amount_php, p_amount_php, 'APL-' || p_tx_id,
     GREATEST(1, CEIL(EXTRACT(EPOCH FROM (p_expires_at - v_start)) / 86400.0))::INT,
     -- 'app_store': Apple decided the direction and prorated it itself (an upgrade starts now; a lower plan
     -- only arrives at the renewal), so the shared applier neither defers nor starts a fresh web term.
     'pending_payment', 'app_store', p_original_tx)
  RETURNING purchase_id INTO v_purchase;

  -- Apple's transaction IS the shop's plan from now: a lower plan arriving at Apple's renewal is not a stale
  -- request, so the silent-downgrade guard is told so for this statement only.
  PERFORM set_config('setnayan.allow_tier_downgrade', 'on', true);
  PERFORM public._apply_subscription_credit(v_purchase, NULL);
  PERFORM set_config('setnayan.allow_tier_downgrade', '', true);

  -- Apple runs the clock of an Apple-billed month.
  UPDATE public.vendor_profiles
     SET tier_expires_at    = p_expires_at,
         tier_billing_cycle = 'monthly'
   WHERE vendor_profile_id = p_vendor_id;
  UPDATE public.vendor_subscriptions
     SET expires_at = p_expires_at
   WHERE purchase_id = v_purchase;

  UPDATE public.vendor_app_store_subscriptions
     SET product_id              = p_product_id,
         tier                    = p_tier,
         status                  = 'active',
         expires_at              = p_expires_at,
         billing_failed_at       = NULL,
         grace_period_expires_at = NULL,
         last_transaction_id     = p_tx_id,
         last_notification       = p_notification,
         last_notification_at    = now(),
         updated_at              = now()
   WHERE original_transaction_id = p_original_tx;

  RETURN jsonb_build_object('on', true, 'tier', p_tier, 'expires_at', p_expires_at,
                            'purchase_id', v_purchase, 'vendor_id', p_vendor_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. The subscription ends. A REFUND or REVOKE is kept first, whether or not anything was granted yet.
--    The body of 20271359936839 §8, plus the ledger write; an early reversal now answers `recorded`.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_store_supplier_plan_end(
  p_original_tx  TEXT,
  p_status       TEXT,
  p_tx_id        TEXT,
  p_notification TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map     public.vendor_app_store_subscriptions;
  v_row     RECORD;
  v_dropped BOOLEAN := FALSE;
  v_out     JSONB;
BEGIN
  IF p_status NOT IN ('expired', 'refunded', 'revoked') OR p_original_tx IS NULL THEN
    RAISE EXCEPTION 'BAD_INPUT';
  END IF;

  -- ORDER OF DELIVERY: keep the reversal before looking for the subscription, so a SUBSCRIBED that arrives later
  -- (app_store_supplier_plan_apply) finds it and grants nothing.
  IF p_status IN ('refunded', 'revoked') THEN
    INSERT INTO public.vendor_app_store_reversals (original_transaction_id, transaction_id, status, notification)
    VALUES (p_original_tx, CASE WHEN p_status = 'revoked' THEN NULL ELSE p_tx_id END, p_status, p_notification)
    ON CONFLICT (original_transaction_id, COALESCE(transaction_id, ''), status) DO NOTHING;
  END IF;

  SELECT * INTO v_map FROM public.vendor_app_store_subscriptions
   WHERE original_transaction_id = p_original_tx FOR UPDATE;
  IF NOT FOUND THEN
    IF p_status IN ('refunded', 'revoked') THEN
      RETURN jsonb_build_object('recorded', p_status, 'granted', false);
    END IF;
    RETURN jsonb_build_object('unknown', true);
  END IF;

  IF p_status IN ('refunded', 'revoked') THEN
    -- Every paid period of this subscription that the reversal names (a REFUND names one transaction; a REVOKE
    -- the whole subscription) goes back through the ONE reversal door. The first live one drops the plan.
    FOR v_row IN
      SELECT purchase_id FROM public.vendor_subscriptions
       WHERE app_store_original_transaction_id = p_original_tx
         AND status = 'paid'
         AND (p_status = 'revoked' OR p_tx_id IS NULL OR reference_code = 'APL-' || p_tx_id)
       ORDER BY created_at
    LOOP
      v_out := public.vendor_plan_money_reversed(v_row.purchase_id, 'app_store_' || p_status);
      v_dropped := v_dropped OR COALESCE((v_out ->> 'dropped')::BOOLEAN, FALSE);
    END LOOP;
  ELSIF v_map.status IN ('active', 'billing_retry')
        AND public.vendor_plan_billing_channel(v_map.vendor_profile_id) IS DISTINCT FROM 'web'
        AND EXISTS (SELECT 1 FROM public.vendor_profiles p
                     WHERE p.vendor_profile_id = v_map.vendor_profile_id AND p.tier_state = v_map.tier) THEN
    -- A lapse: the clock ends now and the shared sweep drops the shop, like any lapsed plan.
    UPDATE public.vendor_profiles
       SET tier_expires_at = now() - interval '1 second'
     WHERE vendor_profile_id = v_map.vendor_profile_id
       AND tier_expires_at IS NOT NULL
       AND tier_expires_at >= now() - interval '1 second';
    UPDATE public.vendor_subscriptions
       SET expires_at = LEAST(expires_at, now())
     WHERE app_store_original_transaction_id = p_original_tx
       AND status = 'paid'
       AND expires_at > now();
    PERFORM public.sweep_vendor_tier_expiry(v_map.vendor_profile_id);
    v_dropped := TRUE;
  END IF;

  UPDATE public.vendor_app_store_subscriptions
     SET status = CASE
           -- a refund of ONE past month leaves a still-running subscription running unless it dropped the plan
           WHEN p_status = 'refunded' AND NOT v_dropped AND status IN ('active', 'billing_retry') THEN status
           WHEN p_status = 'expired' AND status IN ('refunded', 'revoked') THEN status
           ELSE p_status END,
         will_auto_renew      = CASE WHEN p_status = 'refunded' AND NOT v_dropped THEN will_auto_renew ELSE FALSE END,
         last_notification    = p_notification,
         last_notification_at = now(),
         updated_at           = now()
   WHERE original_transaction_id = p_original_tx;

  RETURN jsonb_build_object('ended', p_status, 'dropped', v_dropped, 'vendor_id', v_map.vendor_profile_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Service role only (CREATE OR REPLACE keeps the grants; restated so this file stands on its own).
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.app_store_supplier_plan_apply(UUID, TEXT, TEXT, TEXT, public.vendor_tier_state, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_store_supplier_plan_end(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_store_supplier_plan_apply(UUID, TEXT, TEXT, TEXT, public.vendor_tier_state, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_store_supplier_plan_end(TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
