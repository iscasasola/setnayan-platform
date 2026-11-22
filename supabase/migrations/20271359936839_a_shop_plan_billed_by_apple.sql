-- ============================================================================
-- A SHOP'S PLAN, BILLED BY APPLE — and a plan whose money went back drops at once.
--
-- Spec: corpus SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md, items D + E (the late-22-Nov build list),
-- and §5 "One entitlement, one channel". Owner-locked 22 Nov.
--
-- ── ONE ENTITLEMENT ─────────────────────────────────────────────────────────
-- A shop's plan is `vendor_profiles.tier_state` + `tier_expires_at`, and every paid term is a
-- `vendor_subscriptions` row. The web (Maya / bank) grants through `_apply_subscription_credit`
-- (its service-role door is `confirm_vendor_subscription_by_reference`) and ends through
-- `sweep_vendor_tier_expiry`. Apple uses THOSE TWO, not a copy of them:
--
--   · a paid Apple period is a `vendor_subscriptions` row (reference `APL-<transactionId>`,
--     `app_store_original_transaction_id` set) switched on by `_apply_subscription_credit`;
--   · its END is Apple's `expiresDate`. Apple runs the clock of an Apple-billed month (a sandbox
--     month is five minutes), so after the shared applier switches the tier on, the clock it
--     stacked is replaced by Apple's. That is the one place the two channels differ;
--   · an expiry or a reversal ends the clock and hands the shop to the shared sweep, which drops it
--     to Verified (or Free) exactly as a lapsed web plan drops.
--
-- ── ONE CHANNEL ─────────────────────────────────────────────────────────────
-- `vendor_plan_billing_channel` answers who bills the shop's live plan: 'app_store', 'web' or NULL.
-- A web purchase on an Apple-billed shop is refused by a trigger on `vendor_subscriptions` (so
-- `create_vendor_subscription` is not redefined here); an Apple grant on a web-billed shop is
-- refused inside `app_store_supplier_plan_apply`. The app draws no buy button in either case.
--
-- ── ONE SUBSCRIPTION = ONE SHOP ─────────────────────────────────────────────
-- `vendor_app_store_subscriptions` maps Apple's `originalTransactionId` to the shop its first
-- transaction's `appAccountToken` named. Every later transaction of that subscription (renewal,
-- upgrade, restore on any phone, any shop) lands on THAT shop or nowhere.
--
-- ── THE GRACE HOOK (not built here) ─────────────────────────────────────────
-- DID_FAIL_TO_RENEW records `status = 'billing_retry'` and `billing_failed_at` (the FIRST failed
-- renewal; cleared when Apple recovers). The earned-grace rule (7 days per paid month, max 30) is
-- another builder's PR: it reads `billing_failed_at`, never re-derives it.
--
-- ── E · A REVERSED PLAN DROPS AT ONCE ───────────────────────────────────────
-- `vendor_plan_money_reversed` is the one door for "this plan's money went back": an admin's
-- refund / Maya reversal / recorded chargeback of a plan order (lib/sku-activation.ts
-- `deactivateOrderSku`) and Apple's REFUND / REVOKE. The purchase becomes 'refunded' and, when it
-- belongs to the channel billing the live plan, the plan ends now through the shared sweep. Uploads
-- are then held by the storage allowance of the plan the shop drops to (`enforce_supplier_storage_
-- allowance` + `/api/upload`'s presign check) — the existing lock, not a second one.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 'refunded' is a purchase status, and a purchase can name its Apple subscription.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_subscriptions
  DROP CONSTRAINT IF EXISTS vendor_subscriptions_status_check;
ALTER TABLE public.vendor_subscriptions
  ADD CONSTRAINT vendor_subscriptions_status_check
  CHECK (status IN ('pending_payment', 'paid', 'rejected', 'superseded', 'refunded'));

ALTER TABLE public.vendor_subscriptions
  ADD COLUMN IF NOT EXISTS app_store_original_transaction_id TEXT;

COMMENT ON COLUMN public.vendor_subscriptions.app_store_original_transaction_id IS
  'Set on a paid period Apple billed (reference APL-<transactionId>): the subscription it belongs to (vendor_app_store_subscriptions). NULL = a web (Maya / bank) or admin purchase. Read by vendor_plan_billing_channel.';

CREATE INDEX IF NOT EXISTS vendor_subscriptions_app_store_sub_idx
  ON public.vendor_subscriptions (app_store_original_transaction_id)
  WHERE app_store_original_transaction_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. The map: one Apple subscription → one shop.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_app_store_subscriptions (
  original_transaction_id TEXT PRIMARY KEY,
  vendor_profile_id       UUID NOT NULL
                            REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  product_id              TEXT NOT NULL,
  tier                    public.vendor_tier_state NOT NULL,
  environment             TEXT NOT NULL CHECK (environment IN ('Production', 'Sandbox')),
  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'billing_retry', 'expired', 'refunded', 'revoked')),
  expires_at              TIMESTAMPTZ,
  auto_renew              BOOLEAN,
  auto_renew_product_id   TEXT,
  billing_failed_at       TIMESTAMPTZ,
  grace_period_expires_at TIMESTAMPTZ,
  last_transaction_id     TEXT,
  last_notification       TEXT,
  last_notification_at    TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_app_store_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vendor_app_store_subscriptions_vendor_idx
  ON public.vendor_app_store_subscriptions (vendor_profile_id);

COMMENT ON TABLE public.vendor_app_store_subscriptions IS
  'One Apple "Supplier plans" subscription (originalTransactionId) → the ONE shop its first transaction named by appAccountToken. Written only by the app_store_supplier_plan_* functions (service role, from App Store Server Notifications and the app''s own confirm). A restore on another shop never moves it.';
COMMENT ON COLUMN public.vendor_app_store_subscriptions.billing_failed_at IS
  'THE GRACE HOOK: when Apple FIRST failed to renew (DID_FAIL_TO_RENEW), cleared when a renewal lands. The earned-grace rule (7 days per paid month, max 30) reads this; it is not implemented here.';
COMMENT ON COLUMN public.vendor_app_store_subscriptions.auto_renew_product_id IS
  'The plan Apple renews into. Differs from product_id after a downgrade at Apple (DID_CHANGE_RENEWAL_PREF / DOWNGRADE): the lower plan starts at the next renewal, never today.';

-- The shop's own admins read their row (the app's plan door); writes go through the functions below only.
DROP POLICY IF EXISTS vendor_app_store_subscriptions_shop_read ON public.vendor_app_store_subscriptions;
CREATE POLICY vendor_app_store_subscriptions_shop_read
  ON public.vendor_app_store_subscriptions FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')));

DROP POLICY IF EXISTS vendor_app_store_subscriptions_admin_read ON public.vendor_app_store_subscriptions;
CREATE POLICY vendor_app_store_subscriptions_admin_read
  ON public.vendor_app_store_subscriptions FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- 3. Who bills the shop's live plan.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_plan_billing_channel(p_vendor_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    -- Apple: a subscription still running, or one Apple is still trying to renew (Apple retries for up to
    -- 60 days; past that it has given up even if its EXPIRED never reached us).
    WHEN EXISTS (
      SELECT 1 FROM public.vendor_app_store_subscriptions a
       WHERE a.vendor_profile_id = p_vendor_id
         AND ((a.status = 'active' AND a.expires_at > now())
           OR (a.status = 'billing_retry' AND a.expires_at > now() - interval '60 days'))
    ) THEN 'app_store'
    -- The web: a paid web purchase whose term still runs, or the paid lower plan waiting behind it.
    WHEN EXISTS (
      SELECT 1 FROM public.vendor_subscriptions s
       WHERE s.vendor_id = p_vendor_id
         AND s.status = 'paid'
         AND s.app_store_original_transaction_id IS NULL
         AND (s.expires_at > now()
           OR (s.expires_at IS NULL AND s.purchase_id = (
                 SELECT p.pending_tier_purchase_id FROM public.vendor_profiles p
                  WHERE p.vendor_profile_id = p_vendor_id)))
    ) THEN 'web'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.vendor_plan_billing_channel(UUID) IS
  'app_store | web | NULL — the ONE channel billing a shop''s live plan (spec §5: one shop is billed by one channel at a time). A plan Setnayan gave or an admin comp has no channel.';

-- ----------------------------------------------------------------------------
-- 4. A web purchase on an Apple-billed shop is refused — at the table, so every writer is covered.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_vendor_subscription_one_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.app_store_original_transaction_id IS NULL
     AND public.vendor_plan_billing_channel(NEW.vendor_id) = 'app_store' THEN
    RAISE EXCEPTION
      'APP_STORE_BILLED: this shop''s plan is billed by the App Store. Change or cancel it there; it can be paid here once it ends.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_subscription_one_channel ON public.vendor_subscriptions;
CREATE TRIGGER vendor_subscription_one_channel
  BEFORE INSERT ON public.vendor_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_vendor_subscription_one_channel();

-- ----------------------------------------------------------------------------
-- 5. A plan whose money went back drops at once (E). The ONE door, both channels.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_plan_money_reversed(p_purchase_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s       public.vendor_subscriptions;
  v_channel TEXT;
  v_live    BOOLEAN;
BEGIN
  SELECT * INTO v_s FROM public.vendor_subscriptions WHERE purchase_id = p_purchase_id FOR UPDATE;
  IF v_s.purchase_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_s.status = 'refunded' THEN
    RETURN jsonb_build_object('already', true, 'vendor_id', v_s.vendor_id);
  END IF;
  -- An unpaid order granted nothing; there is nothing to take back.
  IF v_s.status <> 'paid' THEN
    RETURN jsonb_build_object('skipped', v_s.status, 'vendor_id', v_s.vendor_id);
  END IF;

  -- Read BEFORE the row changes: is the shop's live plan billed by the channel this money came through?
  v_channel := public.vendor_plan_billing_channel(v_s.vendor_id);
  v_live := (v_channel = 'app_store' AND v_s.app_store_original_transaction_id IS NOT NULL)
         OR (v_channel = 'web' AND v_s.app_store_original_transaction_id IS NULL);

  UPDATE public.vendor_subscriptions
     SET status           = 'refunded',
         rejection_reason = left('refunded: ' || COALESCE(p_reason, 'money returned'), 200),
         expires_at       = LEAST(COALESCE(expires_at, now()), now())
   WHERE purchase_id = p_purchase_id;

  -- A scheduled lower plan this money paid for never starts.
  UPDATE public.vendor_profiles
     SET pending_tier               = NULL,
         pending_tier_billing_cycle = NULL,
         pending_tier_period_days   = NULL,
         pending_tier_sku_code      = NULL,
         pending_tier_purchase_id   = NULL,
         pending_tier_scheduled_at  = NULL
   WHERE vendor_profile_id = v_s.vendor_id
     AND pending_tier_purchase_id = p_purchase_id;

  IF v_live THEN
    -- End the clock, then the SAME sweep a lapsed plan goes through (Verified, or Free if unverified;
    -- the carried credit goes with it). The tier guard lets a lowered tier through once the clock has run out.
    UPDATE public.vendor_profiles
       SET tier_expires_at = now() - interval '1 second'
     WHERE vendor_profile_id = v_s.vendor_id
       AND tier_expires_at IS NOT NULL
       AND tier_expires_at >= now() - interval '1 second';
    PERFORM public.sweep_vendor_tier_expiry(v_s.vendor_id);
  END IF;

  RETURN jsonb_build_object('reversed', true, 'dropped', v_live, 'vendor_id', v_s.vendor_id);
END;
$$;

COMMENT ON FUNCTION public.vendor_plan_money_reversed(UUID, TEXT) IS
  'E (owner 22 Nov): a plan purchase whose money went back — an admin refund, a Maya reversal or recorded chargeback, an Apple REFUND/REVOKE — becomes refunded, and when it belongs to the channel billing the live plan the plan drops AT ONCE through sweep_vendor_tier_expiry. Idempotent.';

-- ----------------------------------------------------------------------------
-- 6. Apple: a paid period lands (SUBSCRIBED · DID_RENEW · an upgrade · a recovered renewal · the app's confirm).
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
-- 7. Apple: what changed without a payment (a failed renewal, a renewal preference, auto-renew on/off).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_store_supplier_plan_note(
  p_original_tx           TEXT,
  p_status                TEXT,
  p_billing_failed_at     TIMESTAMPTZ,
  p_grace_expires_at      TIMESTAMPTZ,
  p_auto_renew            BOOLEAN,
  p_auto_renew_product_id TEXT,
  p_notification          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_map public.vendor_app_store_subscriptions;
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN ('active', 'billing_retry') THEN
    RAISE EXCEPTION 'BAD_INPUT';
  END IF;
  SELECT * INTO v_map FROM public.vendor_app_store_subscriptions
   WHERE original_transaction_id = p_original_tx FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('unknown', true);
  END IF;

  UPDATE public.vendor_app_store_subscriptions
     SET -- an ended subscription is never brought back by a note; only a paid period (apply) does that
         status = CASE WHEN status IN ('active', 'billing_retry') THEN COALESCE(p_status, status) ELSE status END,
         billing_failed_at = CASE
           WHEN status NOT IN ('active', 'billing_retry') THEN billing_failed_at
           WHEN p_status = 'billing_retry' THEN COALESCE(billing_failed_at, p_billing_failed_at, now())
           WHEN p_status = 'active' THEN NULL
           ELSE billing_failed_at END,
         grace_period_expires_at = CASE
           WHEN p_status = 'active' THEN NULL
           ELSE COALESCE(p_grace_expires_at, grace_period_expires_at) END,
         auto_renew            = COALESCE(p_auto_renew, auto_renew),
         auto_renew_product_id = COALESCE(p_auto_renew_product_id, auto_renew_product_id),
         last_notification     = p_notification,
         last_notification_at  = now(),
         updated_at            = now()
   WHERE original_transaction_id = p_original_tx;

  RETURN jsonb_build_object('noted', true, 'vendor_id', v_map.vendor_profile_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Apple: the subscription ends — EXPIRED · GRACE_PERIOD_EXPIRED (lapse) · REFUND · REVOKE (money back: E).
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
  IF p_status NOT IN ('expired', 'refunded', 'revoked') THEN
    RAISE EXCEPTION 'BAD_INPUT';
  END IF;
  SELECT * INTO v_map FROM public.vendor_app_store_subscriptions
   WHERE original_transaction_id = p_original_tx FOR UPDATE;
  IF NOT FOUND THEN
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
         auto_renew           = CASE WHEN p_status = 'refunded' AND NOT v_dropped THEN auto_renew ELSE FALSE END,
         last_notification    = p_notification,
         last_notification_at = now(),
         updated_at           = now()
   WHERE original_transaction_id = p_original_tx;

  RETURN jsonb_build_object('ended', p_status, 'dropped', v_dropped, 'vendor_id', v_map.vendor_profile_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Service role only. None of these is a client's to call.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.vendor_plan_billing_channel(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_vendor_subscription_one_channel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vendor_plan_money_reversed(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_store_supplier_plan_apply(UUID, TEXT, TEXT, TEXT, public.vendor_tier_state, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_store_supplier_plan_note(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_store_supplier_plan_end(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.vendor_plan_billing_channel(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.vendor_plan_money_reversed(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_store_supplier_plan_apply(UUID, TEXT, TEXT, TEXT, public.vendor_tier_state, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_store_supplier_plan_note(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_store_supplier_plan_end(TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
