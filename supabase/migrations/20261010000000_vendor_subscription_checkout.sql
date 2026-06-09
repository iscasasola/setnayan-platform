-- ============================================================================
-- 20261010000000_vendor_subscription_checkout.sql
-- Vendor Tier #5 · self-serve subscription checkout (Phase D).
--
-- Apply-then-pay vendor subscription upgrade to Pro / Enterprise, CLONED from
-- the token-pack purchase flow (20260916000000 + 20260918000001):
--   1. create_vendor_subscription(sku) — vendor starts an order; price + tier +
--      billing cycle + period are read from vendor_billing_catalog (DB, never
--      client-supplied). Mints a SUB- reference, inserts pending_payment.
--   2. vendor pays externally with the reference code in the note.
--   3. approve_vendor_subscription(id) — admin (or future Maya/PayMongo webhook
--      via confirm_..._by_reference) confirms the payment, which:
--        (a) sets vendor_profiles.tier_state = the SKU's tier,
--        (b) stacks tier_expires_at by the period (28d monthly / 365d annual),
--        (c) grants the per-period FREE token bundle (Pro 30/300 · Ent 100/1000)
--            via grant_admin_direct_tokens (grant_source='admin_grant', because
--            its CHECK enum does NOT include 'subscription_bundle'), idempotent
--            per purchase via key 'sub_bundle:<purchase_id>'.
--   Login-driven lapse (no cron · [[project_setnayan_cron_free]]):
--     sweep_vendor_tier_expiry(vendor) downgrades an expired Pro/Enterprise back
--     to 'verified' (if still verified) else 'free'. Wired into the vendor
--     dashboard load next to the existing sweepLapsedSubscriptions call.
--
-- DECISIONS (owner-locked):
--   • grant_source = 'admin_grant' for the bundle (the function's CHECK only
--     allows pilot_grant|telemetry_reward|manpower_handshake|admin_grant|
--     referral_reward). 'subscription_bundle' would RAISE.
--   • Bundle TTL = the subscription period (28 / 365) · ONE-SHOT on activation
--     (no monthly drip in V1).
--   • Renewal STACKS: v_expires := GREATEST(now(), COALESCE(tier_expires_at,
--     now())) + period.
--   • Lapse target = 'verified' if verification_state='verified' else 'free'
--     (never grant verified perks to a never-verified vendor). Over-cap data
--     (extra agents/photos/categories) is LEFT INTACT in V1 — no reconciliation.
--   • Multiple pending orders allowed (each independently idempotent on approve,
--     matching the token-pack precedent — NO one-open-order guard).
--   • Bundle token amounts mirror lib/vendor-tier-caps.ts
--     TIER_SUBSCRIPTION_BUNDLE_TOKENS — they live only in TS today, so they are
--     hardcoded below (pro 30/300 · enterprise 100/1000). Keep both in sync.
--
-- SECURITY POSTURE (highest-severity): the webhook confirm + the shared credit
-- core are service-role / internal ONLY — REVOKE ALL FROM PUBLIC, anon,
-- authenticated; NOT granted to authenticated. A vendor must NEVER self-confirm
-- their own subscription as paid. Only service_role (webhook) and the
-- admin-approve RPC (is_console_admin-gated, called by an authed admin) credit.
-- Mirrors 20260918000001_vendor_token_purchase_webhook.sql exactly.
-- ============================================================================

BEGIN;

-- ── 1 · vendor_profiles tier-billing columns ────────────────────────────────
-- No tier_auto_downgrade_to column: the lapse target is computed from
-- verification_state at sweep time (simpler · always correct after a vendor is
-- verified/de-verified between activation and expiry).
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS tier_expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tier_billing_cycle TEXT
    CHECK (tier_billing_cycle IN ('monthly', 'annual'));

COMMENT ON COLUMN public.vendor_profiles.tier_expires_at IS
  'When the current paid (pro/enterprise) tier lapses. NULL for free/verified or never-subscribed. Set by _apply_subscription_credit (stacking); cleared by sweep_vendor_tier_expiry on lapse.';
COMMENT ON COLUMN public.vendor_profiles.tier_billing_cycle IS
  'Billing cadence of the active paid subscription (monthly=28d / annual=365d). NULL when not on a paid tier.';

-- ── 2 · vendor_subscriptions order table ────────────────────────────────────
-- Cloned from vendor_token_purchases shape. tier uses the vendor_tier_state
-- enum. status adds 'superseded' (reserved for a future "newer order replaced
-- this one" path; unused by the RPCs below — kept in the CHECK so the column is
-- forward-compatible without another ALTER).
CREATE TABLE IF NOT EXISTS public.vendor_subscriptions (
  purchase_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id        UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  sku_code         TEXT NOT NULL,
  tier             public.vendor_tier_state NOT NULL,
  billing_cycle    TEXT CHECK (billing_cycle IN ('monthly', 'annual')),
  amount_php       NUMERIC(10,2),
  reference_code   TEXT UNIQUE,
  period_days      INT,
  status           TEXT NOT NULL DEFAULT 'pending_payment'
                     CHECK (status IN ('pending_payment', 'paid', 'rejected', 'superseded')),
  activated_at     TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,
  reviewed_by      UUID,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vsub_vendor
  ON public.vendor_subscriptions (vendor_id, created_at DESC);
-- Non-unique partial index for the admin pending queue (multiple pending orders
-- per vendor are allowed by design — matches the token-pack precedent).
CREATE INDEX IF NOT EXISTS idx_vsub_pending
  ON public.vendor_subscriptions (vendor_id)
  WHERE status = 'pending_payment';

-- RLS — vendor reads own (match vendor_token_purchases pattern exactly) +
-- admin reads all (is_console_admin, the console-aligned gate). All WRITES go
-- through the SECURITY DEFINER RPCs below (no direct insert/update policy).
DROP POLICY IF EXISTS vsub_vendor_select ON public.vendor_subscriptions;
CREATE POLICY vsub_vendor_select ON public.vendor_subscriptions FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vsub_admin_select ON public.vendor_subscriptions;
CREATE POLICY vsub_admin_select ON public.vendor_subscriptions FOR SELECT
  USING (public.is_console_admin());

COMMENT ON TABLE public.vendor_subscriptions IS
  'Apply-then-pay vendor Pro/Enterprise subscription orders. create_ → pending_payment · approve_ / confirm_by_reference set tier_state + tier_expires_at (stacking) + grant the per-period token bundle, idempotent per purchase · reject_ marks rejected. Multiple pending orders allowed.';

-- ── 3 · create: vendor starts a subscription order ──────────────────────────
-- period_days + tier + billing_cycle are DERIVED here:
--   • billing_cycle / period_days from offering_type (monthly=28 / annual=365).
--   • tier from sku_code prefix (pro_vendor_* → pro · enterprise_vendor_* → ent)
--     because vendor_billing_catalog has no tier column.
-- Price is read straight from the catalog (never client-supplied).
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
  SELECT vendor_profile_id INTO v_vendor_id
    FROM public.vendor_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'NO_VENDOR_PROFILE: caller has no vendor profile';
  END IF;

  -- Resolve price + offering_type from the DB catalog (subscriptions only).
  SELECT price_php, offering_type INTO v_price, v_offering
    FROM public.vendor_billing_catalog
    WHERE sku_code = p_sku_code
      AND offering_type IN ('subscription_monthly', 'subscription_annual')
      AND is_active = TRUE;
  IF v_offering IS NULL THEN
    RAISE EXCEPTION 'INVALID_SKU: %', p_sku_code;
  END IF;

  -- Cadence + period from offering_type.
  IF v_offering = 'subscription_annual' THEN
    v_cycle := 'annual';
    v_period := 365;
  ELSE
    v_cycle := 'monthly';
    v_period := 28;
  END IF;

  -- Tier from sku_code (catalog has no tier column).
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

-- ── 4 · shared credit core (internal only) ──────────────────────────────────
-- Locks the row, sets tier_state + tier_expires_at (stacking) + tier_billing_
-- cycle, grants the per-period token bundle, flips to paid. Idempotent.
--
-- Bundle amounts MIRROR lib/vendor-tier-caps.ts TIER_SUBSCRIPTION_BUNDLE_TOKENS
-- (TS-only today): pro {monthly:30, annual:300} · enterprise {monthly:100,
-- annual:1000}. Keep both in sync if the owner reprices the bundle.
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

  -- Per-period FREE token bundle (mirrors TIER_SUBSCRIPTION_BUNDLE_TOKENS).
  v_bundle := CASE
    WHEN v_s.tier = 'pro'        AND v_s.billing_cycle = 'monthly' THEN 30
    WHEN v_s.tier = 'pro'        AND v_s.billing_cycle = 'annual'  THEN 300
    WHEN v_s.tier = 'enterprise' AND v_s.billing_cycle = 'monthly' THEN 100
    WHEN v_s.tier = 'enterprise' AND v_s.billing_cycle = 'annual'  THEN 1000
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
-- Internal-only. Supabase grants EXECUTE on new functions to anon +
-- authenticated by default, so REVOKE FROM PUBLIC alone leaves them open — a
-- vendor could otherwise self-credit an arbitrary purchase. Revoke every
-- external role; only the SECURITY DEFINER wrappers (running as owner) call it.
REVOKE ALL ON FUNCTION public._apply_subscription_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ── 5 · approve (admin path) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_vendor_subscription(p_purchase_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF NOT public.is_console_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only';
  END IF;
  RETURN public._apply_subscription_credit(p_purchase_id, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.approve_vendor_subscription(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_vendor_subscription(UUID) TO authenticated;

-- ── 6 · confirm by reference (webhook path · service-role ONLY) ─────────────
-- Resolve the order by its SUB- reference, then credit. NOT granted to
-- authenticated (a vendor must NEVER self-confirm by reference) — only
-- service_role, i.e. the webhook route's admin client, may call it.
CREATE OR REPLACE FUNCTION public.confirm_vendor_subscription_by_reference(
  p_ref TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT purchase_id INTO v_id FROM public.vendor_subscriptions
    WHERE reference_code = p_ref;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: %', p_ref;
  END IF;
  RETURN public._apply_subscription_credit(v_id, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Service-role ONLY (the webhook's admin client). Explicitly strip anon +
-- authenticated (Supabase grants them by default) so a vendor can NEVER
-- self-confirm a subscription by reference without paying.
REVOKE ALL ON FUNCTION public.confirm_vendor_subscription_by_reference(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_vendor_subscription_by_reference(TEXT) TO service_role;

COMMENT ON FUNCTION public.confirm_vendor_subscription_by_reference(TEXT) IS
  'Webhook/service-role entry point: confirm a vendor subscription by its SUB- reference and activate the tier + grant the bundle (idempotent). reviewed_by stays NULL = automated/system confirmation. NOT callable by vendors.';

-- ── 7 · reject (admin path) ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_vendor_subscription(
  p_purchase_id UUID,
  p_reason      TEXT
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_console_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only';
  END IF;
  UPDATE public.vendor_subscriptions
     SET status = 'rejected', reviewed_by = auth.uid(), rejection_reason = p_reason
   WHERE purchase_id = p_purchase_id AND status = 'pending_payment';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.reject_vendor_subscription(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_vendor_subscription(UUID, TEXT) TO authenticated;

-- ── 8 · login-driven lapse sweep ────────────────────────────────────────────
-- Idempotent, safe, downgrade-only. Flips an EXPIRED paid tier back to
-- 'verified' (if still verification_state='verified') else 'free'. Flips
-- tier_state ONLY — over-cap data (extra agents / portfolio photos / categories
-- a downgraded vendor accumulated) is intentionally LEFT INTACT in V1 (no
-- reconciliation). Granted to authenticated: it only ever downgrades the
-- caller-visible row when past-due, can't grant perks, and matches the lazy
-- sweep pattern (sweepLapsedSubscriptions).
CREATE OR REPLACE FUNCTION public.sweep_vendor_tier_expiry(p_vendor_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.vendor_profiles
     SET tier_state = (
           CASE WHEN verification_state = 'verified'
                THEN 'verified' ELSE 'free' END
         )::public.vendor_tier_state,
         tier_expires_at    = NULL,
         tier_billing_cycle = NULL
   WHERE vendor_profile_id = p_vendor_id
     AND tier_state IN ('pro', 'enterprise')
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.sweep_vendor_tier_expiry(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_vendor_tier_expiry(UUID) TO authenticated;

COMMENT ON FUNCTION public.sweep_vendor_tier_expiry(UUID) IS
  'Login-driven (cron-free) lapse downgrade: an expired pro/enterprise tier reverts to verified (if still verified) else free, clearing tier_expires_at + tier_billing_cycle. Over-cap data left intact in V1. Idempotent + downgrade-only.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase Studio SQL editor):
--
-- -- (1) Columns added:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='vendor_profiles'
--     AND column_name IN ('tier_expires_at','tier_billing_cycle');
-- -- Expected: 2 rows
--
-- -- (2) RPCs exist:
-- SELECT proname FROM pg_proc
--   WHERE pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')
--     AND proname IN ('create_vendor_subscription','_apply_subscription_credit',
--                     'approve_vendor_subscription',
--                     'confirm_vendor_subscription_by_reference',
--                     'reject_vendor_subscription','sweep_vendor_tier_expiry')
--   ORDER BY proname;
-- -- Expected: 6 rows
--
-- -- (3) GRANT posture — confirm_by_reference NOT on authenticated:
-- SELECT grantee FROM information_schema.routine_privileges
--   WHERE routine_name='confirm_vendor_subscription_by_reference';
-- -- Expected: service_role only (no anon / authenticated)
--
-- -- (4) End-to-end (replace UUIDs):
-- -- as the vendor:  SELECT public.create_vendor_subscription('pro_vendor_monthly');
-- -- as an admin:    SELECT public.approve_vendor_subscription('<purchase_id>');
-- -- SELECT tier_state, tier_expires_at, tier_billing_cycle
-- --   FROM vendor_profiles WHERE vendor_profile_id='<vendor_id>';
-- -- Expected: tier_state='pro', tier_expires_at≈now()+28d, cycle='monthly'
-- -- SELECT earned_tokens FROM vendor_wallets WHERE vendor_id='<vendor_id>';
-- -- Expected: +30 (Pro monthly bundle)
-- ============================================================================
