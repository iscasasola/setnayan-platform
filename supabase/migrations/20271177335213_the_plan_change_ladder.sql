-- ============================================================================
-- CHANGING PLANS: UP IS PRORATED AND IMMEDIATE, DOWN IS DEFERRED AND FREE.
--
-- Owner, 2026-08-27, verbatim:
--   "if the plan is lower (solo) to pro then we prorate. if the original plan is
--    higher pro then downgrade to (solo) then we finish that subscription then
--    the new lower plan start after that pro ends."
-- And: a credit larger than the bill CARRIES FORWARD until it runs out — it is
-- never capped and never refunded.
--
-- ── THE TWO DIRECTIONS ──────────────────────────────────────────────────────
--   UPGRADE  (dearer plan)  → the unused value of the plan being replaced is
--                             credited against the new charge, the new tier is
--                             live TODAY, and a FRESH term starts today.
--   DOWNGRADE(cheaper plan) → nothing changes today. The current plan runs to
--                             the end of its paid term; the cheaper plan begins
--                             when that term ends.
--
-- 🔑 DIRECTION IS BY PLAN, NEVER BY THE AMOUNT ON THE ORDER. `vendor_tier_rank`
-- is the ladder (free 1 · verified 2 · solo 3 · pro 4 · enterprise 5 · custom 6)
-- and it already exists — no second ranking is invented here. An annual Solo
-- (10,400) costs more today than a 28-day Pro (2,500); it is still an UPGRADE to
-- move to Pro, because Pro is the higher plan.
--
-- ── THE APPLIER IS THE LOAD-BEARING HALF ────────────────────────────────────
-- Storing "becomes Solo on 19 Oct" is the easy part. The thing that ACTS on it
-- when the term ends is what makes it real. `sweep_vendor_tier_expiry` — the
-- login-driven, cron-free lapse sweep this project already runs on every vendor
-- dashboard load — used to do exactly one thing to an expired plan: drop it to
-- verified/free. Left alone, a shop that scheduled and PAID FOR Solo would have
-- landed on FREE on the day their Pro ended. A pending change with nothing that
-- applies it is a gate with no handle; the sweep is now that handle.
--
-- ── WHERE THE CREDIT COMES FROM (all of it server-side) ─────────────────────
-- `vendor_unused_plan_value_php` DERIVES the unused money from rows that already
-- exist. Every paid `vendor_subscriptions` row records `amount_php`,
-- `period_days` and the `expires_at` it pushed the plan out to — so its term ran
-- [expires_at - period_days, expires_at], and its unused share is the part of
-- that window still in the future. Summing over the rows handles STACKED
-- purchases exactly (this project's renewals stack via GREATEST) and can never
-- return more than was actually paid, because each row contributes at most its
-- own amount. Measured against production while writing this: two stacked 1,000
-- 28-day Solo blocks tile end-to-end and reconcile to the profile's own
-- `tier_expires_at` to the day.
--
-- ⚠ THE QUOTE IS HONOURED, AND THAT IS WHY A NUMBER IS STORED. Unused value
-- decays every hour. The figure a shop is quoted when they start the change is
-- the figure they pay when they get round to paying it, so `credit_applied_php`
-- and `credit_carry_forward_php` are written onto the purchase at ORDER time and
-- read back at activation. This is the same shape `vendor_custom_plans.
-- quoted_28d_php` already has: a QUOTE is a historical fact, not a duplicated
-- derivation. The live figure has exactly one source -- the function above --
-- and nothing else recomputes it.
--
-- 🔑 CREDIT IS CONSUMED AT ACTIVATION, NEVER RESERVED AT ORDER TIME. That is
-- deliberate: a reserve needs an unwind, two call sites and one give-back is how
-- this codebase has leaked value before, and an abandoned order would strand a
-- shop's money behind a purchase they never completed. Nothing is deducted until
-- the money is confirmed, so a rejected or ignored plan change costs the shop
-- nothing and needs no repair. The double-spend that would otherwise open -- two
-- unpaid changes both quoting the same balance -- is closed by refusing a second
-- open plan change instead (ONE_PLAN_CHANGE_PENDING).
--
-- ── WHAT IS DELIBERATELY NOT TOUCHED ────────────────────────────────────────
-- RENEWAL MATHS. `GREATEST(now(), tier_expires_at) + period_days` is correct and
-- stays exactly as it is for every same-tier renewal and every purchase made by
-- a shop with no live plan. Only the UPGRADE branch starts a fresh term, and it
-- must: the old term's remaining days were just converted into money and handed
-- back, so keeping them as well would pay the shop twice for the same days.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The pending change, and the carried credit, on the profile.
--
-- NO `pending_tier_effective_at` COLUMN, ON PURPOSE. The date the change lands
-- IS `tier_expires_at` -- a stored copy would be a second answer to one
-- question, and it would go wrong the first time a shop renewed their current
-- plan while a downgrade was waiting (the real expiry moves out, the copy does
-- not, and the applier fires early on a plan the shop is still paying for).
-- Every reader derives the date from `tier_expires_at`.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS pending_tier public.vendor_tier_state,
  ADD COLUMN IF NOT EXISTS pending_tier_billing_cycle TEXT,
  ADD COLUMN IF NOT EXISTS pending_tier_period_days INT,
  ADD COLUMN IF NOT EXISTS pending_tier_sku_code TEXT,
  ADD COLUMN IF NOT EXISTS pending_tier_purchase_id UUID,
  ADD COLUMN IF NOT EXISTS pending_tier_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_credit_php NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.vendor_profiles.pending_tier IS
  'The plan that begins when the CURRENT term ends (a scheduled downgrade). NULL when nothing is scheduled. Applied by sweep_vendor_tier_expiry once tier_expires_at passes AND the purchase naming it has been paid. There is deliberately no stored effective date: the date is tier_expires_at.';
COMMENT ON COLUMN public.vendor_profiles.pending_tier_purchase_id IS
  'The PAID vendor_subscriptions purchase that bought the pending plan. The applier refuses to grant a pending tier without one -- a scheduled plan nobody paid for must lapse like any other, never switch itself on.';
COMMENT ON COLUMN public.vendor_profiles.subscription_credit_php IS
  'Carried-forward subscription credit in PHP. Money the shop has already paid that outlived the bill it was credited against; it is spent automatically against later plan charges until it runs out. Never capped, never refunded, and NOT cleared when a plan lapses -- see sweep_vendor_tier_expiry.';

-- ----------------------------------------------------------------------------
-- 2. The three terms of the bill, recorded on the purchase.
--
-- `amount_php` (what the shop pays) already exists. These make the arithmetic
-- behind it auditable: list - credit = amount, all three written together at
-- order time by the one function that prices anything.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_subscriptions
  ADD COLUMN IF NOT EXISTS plan_change_kind TEXT,
  ADD COLUMN IF NOT EXISTS list_price_php NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS credit_applied_php NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS credit_carry_forward_php NUMERIC(12,2);

COMMENT ON COLUMN public.vendor_subscriptions.plan_change_kind IS
  'How this purchase relates to the plan the shop was already on: upgrade | downgrade | renewal | new. Decided server-side from vendor_tier_rank at order time and stored, so activation cannot re-derive a different answer weeks later from a profile that has since moved.';
COMMENT ON COLUMN public.vendor_subscriptions.credit_carry_forward_php IS
  'What the shop credit balance BECOMES when this purchase activates. Stored as the answer rather than as arithmetic to apply, so activation is a plain assignment and a replayed approval cannot double-count.';

DROP INDEX IF EXISTS public.vendor_profiles_pending_tier_idx;
CREATE INDEX vendor_profiles_pending_tier_idx
  ON public.vendor_profiles (tier_expires_at)
  WHERE pending_tier IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. The unused value of the plan a shop is on, in pesos. DERIVED, never stored.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_unused_plan_value_php(p_vendor_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- Each paid purchase bought the window [expires_at - period_days, expires_at].
  -- Its unused share is however much of that window is still in the future,
  -- clamped at both ends: GREATEST(now(), start) can never credit a day already
  -- spent, and the fraction can never exceed 1, so a row can never give back
  -- more than it took.
  SELECT COALESCE(ROUND(SUM(
           s.amount_php
           * ( EXTRACT(EPOCH FROM (
                 s.expires_at
                 - GREATEST(now(), s.expires_at - make_interval(days => s.period_days))
               ))
               / EXTRACT(EPOCH FROM make_interval(days => s.period_days)) )
         ), 2), 0)
    FROM public.vendor_subscriptions s
   WHERE s.vendor_id = p_vendor_id
     AND s.status = 'paid'
     AND s.amount_php IS NOT NULL
     AND s.period_days > 0
     -- A term already finished is worth nothing. A DEFERRED downgrade that has
     -- been paid for but has not started yet carries no expires_at at all, so it
     -- is excluded here too -- it is not part of the plan being replaced.
     AND s.expires_at IS NOT NULL
     AND s.expires_at > now();
$$;

COMMENT ON FUNCTION public.vendor_unused_plan_value_php(UUID) IS
  'The unused pesos left in a shop current plan, derived from the paid purchases that bought it. THE ONLY SOURCE of that figure; a quoted credit is stored on the purchase, but the live value is never duplicated anywhere.';

-- ----------------------------------------------------------------------------
-- 4. Which way a move goes. By PLAN, via the existing ladder.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_plan_change_kind(
  p_vendor_id UUID,
  p_new_tier  public.vendor_tier_state
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
           -- Not on a live paid plan: there is nothing to prorate and nothing to
           -- defer. An ordinary purchase, exactly as it behaves today.
           WHEN p.tier_expires_at IS NULL OR p.tier_expires_at <= now() THEN 'new'
           WHEN public.vendor_tier_rank(p_new_tier)
              > public.vendor_tier_rank(p.tier_state)                    THEN 'upgrade'
           WHEN public.vendor_tier_rank(p_new_tier)
              < public.vendor_tier_rank(p.tier_state)                    THEN 'downgrade'
           ELSE 'renewal'
         END
    FROM public.vendor_profiles p
   WHERE p.vendor_profile_id = p_vendor_id;
$$;

COMMENT ON FUNCTION public.vendor_plan_change_kind(UUID, public.vendor_tier_state) IS
  'upgrade | downgrade | renewal | new -- decided from vendor_tier_rank, never from the price. Moving to a dearer PLAN is an upgrade even when this month bill happens to be smaller.';

-- ----------------------------------------------------------------------------
-- 5. Starting a purchase -- now aware of which way the shop is moving.
--
-- Everything above the plan-change block is byte-for-byte the shipped function:
-- the same two authorisation gates in the same order, the same retired-token
-- refusal, the same catalog read, the same cycle/period/tier mapping. The new
-- work happens only after the price is known, and a 'renewal' or 'new' purchase
-- comes out of it identical to what shipped except that it may now spend a
-- credit the shop is already holding.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_vendor_subscription(
  p_sku_code TEXT,
  p_addon_token_pack_sku TEXT DEFAULT NULL::TEXT
)
RETURNS public.vendor_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_vendor_id UUID;
  v_price     NUMERIC(10,2);
  v_offering  TEXT;
  v_cycle     TEXT;
  v_period    INT;
  v_tier      public.vendor_tier_state;
  v_ref       TEXT;
  v_row       public.vendor_subscriptions;
  v_kind      TEXT;
  v_unused    NUMERIC(12,2);
  v_balance   NUMERIC(12,2);
  v_available NUMERIC(12,2);
  v_applied   NUMERIC(12,2);
  v_carry     NUMERIC(12,2);
  v_amount    NUMERIC(12,2);
BEGIN
  -- Admin-only: resolve the store where the caller is an admin (multi-admin org
  -- model -- NOT founder-only). Preserved from 20270401574089 / 20270403095563.
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

  -- Token packs cannot be charged for (2026-08-07 retirement). Unchanged, and
  -- still placed after both authorisation gates so an unauthorised caller learns
  -- nothing about this function.
  IF p_addon_token_pack_sku IS NOT NULL AND btrim(p_addon_token_pack_sku) <> '' THEN
    RAISE EXCEPTION
      'INVALID_PACK: token packs were retired 2026-08-07 and nothing grants them — % cannot be purchased',
      p_addon_token_pack_sku;
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

  -- ── THE PLAN CHANGE ──────────────────────────────────────────────────────
  v_kind := public.vendor_plan_change_kind(v_vendor_id, v_tier);

  -- ONE OPEN CHANGE AT A TIME. Without this, two unpaid purchases could each be
  -- quoted against the same credit balance and each be honoured -- the balance
  -- would be spent twice. Refusing the second is a far smaller mechanism than
  -- reserving the money and having to give it back, and it is the honest thing
  -- to say to a shop that already has a change waiting.
  -- The condition names BOTH shapes on purpose. Keying it on "carries a credit"
  -- alone would let two downgrades queue up — a downgrade earns no credit, so it
  -- would slip through — and the second one to be paid would silently overwrite
  -- the first shop's schedule. Any open plan change blocks another.
  IF EXISTS (
    SELECT 1 FROM public.vendor_subscriptions
     WHERE vendor_id = v_vendor_id
       AND status = 'pending_payment'
       AND (COALESCE(credit_applied_php, 0) > 0
            OR plan_change_kind IN ('upgrade', 'downgrade'))
  ) THEN
    RAISE EXCEPTION
      'ONE_PLAN_CHANGE_PENDING: this shop already has a plan change waiting to be paid';
  END IF;

  -- The unused value of the plan being REPLACED is credited only when the shop
  -- is moving UP. A downgrade is deferred instead of prorated, which is the
  -- owner rule: they finish the term they paid for.
  v_unused  := CASE WHEN v_kind = 'upgrade'
                    THEN public.vendor_unused_plan_value_php(v_vendor_id)
                    ELSE 0 END;
  v_balance := COALESCE((SELECT subscription_credit_php FROM public.vendor_profiles
                          WHERE vendor_profile_id = v_vendor_id), 0);

  -- A carried balance is spendable against ANY later charge, not only an
  -- upgrade -- that is what "carries forward until it runs out" means.
  v_available := v_unused + v_balance;
  v_applied   := LEAST(v_available, v_price);
  IF v_applied < 0 THEN v_applied := 0; END IF;
  v_carry     := v_available - v_applied;   -- what the balance BECOMES on activation
  v_amount    := v_price - v_applied;

  v_ref := 'SUB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO public.vendor_subscriptions
    (vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code, period_days,
     holder_user_id, addon_token_pack_sku, addon_token_count, addon_amount_php,
     plan_change_kind, list_price_php, credit_applied_php, credit_carry_forward_php)
  VALUES
    (v_vendor_id, p_sku_code, v_tier, v_cycle, v_amount, v_ref, v_period,
     auth.uid(), NULL, NULL, NULL,
     v_kind, v_price, v_applied, v_carry)
  RETURNING * INTO v_row;

  -- NOTHING LEFT TO PAY. When the credit covers the whole bill there is no money
  -- to reconcile and no admin decision to wait for, so the purchase is applied
  -- here. Holding a zero-peso order open would leave a shop staring at payment
  -- instructions for an amount of nothing.
  IF v_amount <= 0 THEN
    PERFORM public._apply_subscription_credit(v_row.purchase_id, NULL);
    SELECT * INTO v_row FROM public.vendor_subscriptions
      WHERE purchase_id = v_row.purchase_id;
  END IF;

  RETURN v_row;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 6. Activation -- three branches where there used to be one.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_subscription_credit(
  p_purchase_id UUID,
  p_reviewed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_s       public.vendor_subscriptions;
  v_expires TIMESTAMPTZ;
  v_kind    TEXT;
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

  v_kind := COALESCE(v_s.plan_change_kind, 'renewal');

  -- ── A SCHEDULED DOWNGRADE CHANGES NOTHING TODAY ──────────────────────────
  -- The shop keeps every day of the dearer plan they already paid for. All this
  -- records is which plan begins when that runs out, and which paid purchase
  -- bought it -- the applier refuses to grant a pending tier without that link.
  --
  -- RE-CHECKED HERE, NOT TRUSTED FROM ORDER TIME. If the dearer plan lapsed
  -- while this purchase sat unpaid, there is no longer anything to wait for and
  -- deferring would leave the shop on free with a plan they have paid for. In
  -- that case it falls through and activates immediately, like any other
  -- purchase by a shop with no live plan.
  IF v_kind = 'downgrade'
     AND EXISTS (SELECT 1 FROM public.vendor_profiles
                  WHERE vendor_profile_id = v_s.vendor_id
                    AND tier_expires_at IS NOT NULL
                    AND tier_expires_at > now())
  THEN
    UPDATE public.vendor_profiles
       SET pending_tier               = v_s.tier,
           pending_tier_billing_cycle = v_s.billing_cycle,
           pending_tier_period_days   = v_s.period_days,
           pending_tier_sku_code      = v_s.sku_code,
           pending_tier_purchase_id   = v_s.purchase_id,
           pending_tier_scheduled_at  = now(),
           subscription_credit_php    = COALESCE(v_s.credit_carry_forward_php,
                                                 subscription_credit_php)
     WHERE vendor_profile_id = v_s.vendor_id;

    UPDATE public.vendor_subscriptions
       SET status       = 'paid',
           activated_at = now(),
           paid_at      = now(),
           reviewed_by  = p_reviewed_by
           -- expires_at stays NULL: this term has not started. The applier
           -- stamps it on the day the dearer plan runs out.
     WHERE purchase_id = p_purchase_id;

    RETURN jsonb_build_object(
      'paid', true, 'tier', v_s.tier, 'bundle', 0, 'addon_tokens', 0,
      'deferred', true, 'vendor_id', v_s.vendor_id,
      'starts_after', (SELECT tier_expires_at FROM public.vendor_profiles
                        WHERE vendor_profile_id = v_s.vendor_id));
  END IF;

  -- ── EXPIRY ───────────────────────────────────────────────────────────────
  -- Renewals and first purchases STACK on any remaining time, exactly as they
  -- always have. An UPGRADE starts a fresh term instead, because the remaining
  -- days of the old plan were just turned into money and handed back as credit --
  -- keeping them too would pay the shop twice for the same days.
  IF v_kind = 'upgrade' THEN
    v_expires := now() + (v_s.period_days || ' days')::interval;
  ELSE
    v_expires := GREATEST(now(), COALESCE(
      (SELECT tier_expires_at FROM public.vendor_profiles
         WHERE vendor_profile_id = v_s.vendor_id),
      now()
    )) + (v_s.period_days || ' days')::interval;
  END IF;

  UPDATE public.vendor_profiles
     SET tier_state         = v_s.tier,
         tier_expires_at    = v_expires,
         tier_billing_cycle = v_s.billing_cycle,
         -- The balance BECOMES the figure quoted on this purchase. A plain
         -- assignment, so a replayed approval cannot subtract twice.
         subscription_credit_php = COALESCE(v_s.credit_carry_forward_php,
                                            subscription_credit_php),
         -- Moving plans now supersedes anything that was scheduled before.
         pending_tier               = NULL,
         pending_tier_billing_cycle = NULL,
         pending_tier_period_days   = NULL,
         pending_tier_sku_code      = NULL,
         pending_tier_purchase_id   = NULL,
         pending_tier_scheduled_at  = NULL
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
  RETURN jsonb_build_object('paid', true, 'tier', v_s.tier, 'bundle', 0,
                            'addon_tokens', 0,
                            'expires_at', v_expires, 'vendor_id', v_s.vendor_id);
END;
$function$;

-- ----------------------------------------------------------------------------
-- 7. THE APPLIER. Without this, everything above is a promise nobody keeps.
--
-- The pending branch is checked FIRST and returns, so the existing lapse
-- behaviour below it is reached only when nothing is scheduled -- a shop with no
-- pending change lapses today exactly as it lapsed yesterday.
--
-- The pending branch is deliberately NOT restricted to the sweepable tier list
-- ('pro','enterprise','custom'). A scheduled plan must land whatever the shop is
-- standing on when the term runs out; tying it to that list would have made the
-- applier silently skip anybody sitting on Solo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_vendor_tier_expiry(p_vendor_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_was_custom BOOLEAN := FALSE;
  v_p          public.vendor_profiles;
BEGIN
  -- ── A SCHEDULED PLAN THAT IS NOW DUE ─────────────────────────────────────
  SELECT * INTO v_p FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_id
     AND pending_tier IS NOT NULL
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at <= now()
   FOR UPDATE;

  IF FOUND THEN
    -- A PENDING TIER IS NOT AN ENTITLEMENT UNTIL SOMEBODY PAID FOR IT. Without
    -- this the schedule would be a free plan: stamp an intention, wait, receive
    -- the tier. The purchase must exist, name this shop, name this plan, and be
    -- paid.
    IF EXISTS (
      SELECT 1 FROM public.vendor_subscriptions s
       WHERE s.purchase_id = v_p.pending_tier_purchase_id
         AND s.vendor_id   = p_vendor_id
         AND s.tier        = v_p.pending_tier
         AND s.status      = 'paid'
    ) THEN
      -- The dearer plan has run out, so the no-silent-downgrade trigger's own
      -- lapsed-tier branch lets this through: the shop is not holding the higher
      -- plan any more, and this is a genuine activation of a plan they bought.
      UPDATE public.vendor_profiles
         SET tier_state         = v_p.pending_tier,
             tier_expires_at    = now()
                                  + (COALESCE(v_p.pending_tier_period_days, 28)
                                     || ' days')::interval,
             tier_billing_cycle = v_p.pending_tier_billing_cycle,
             pending_tier               = NULL,
             pending_tier_billing_cycle = NULL,
             pending_tier_period_days   = NULL,
             pending_tier_sku_code      = NULL,
             pending_tier_purchase_id   = NULL,
             pending_tier_scheduled_at  = NULL
       WHERE vendor_profile_id = p_vendor_id;

      UPDATE public.vendor_subscriptions
         SET expires_at = (SELECT tier_expires_at FROM public.vendor_profiles
                            WHERE vendor_profile_id = p_vendor_id)
       WHERE purchase_id = v_p.pending_tier_purchase_id
         AND expires_at IS NULL;

      -- A shop moving Custom -> a listed plan loses the Custom overlay with it.
      IF v_p.tier_state = 'custom' THEN
        UPDATE public.vendor_custom_plans
           SET status = 'lapsed', updated_at = now()
         WHERE vendor_profile_id = p_vendor_id
           AND status = 'active';
      END IF;

      RETURN;
    END IF;

    -- Scheduled but never paid for. Clear the schedule and fall through to the
    -- ordinary lapse -- the unpaid purchase stays payable, and paying it later
    -- activates it immediately, because by then there is no live plan to wait
    -- for. Self-healing, with nothing given away.
    UPDATE public.vendor_profiles
       SET pending_tier               = NULL,
           pending_tier_billing_cycle = NULL,
           pending_tier_period_days   = NULL,
           pending_tier_sku_code      = NULL,
           pending_tier_purchase_id   = NULL,
           pending_tier_scheduled_at  = NULL
     WHERE vendor_profile_id = p_vendor_id;
  END IF;

  -- ── THE ORIGINAL LAPSE, UNCHANGED ────────────────────────────────────────
  -- `subscription_credit_php` IS NOT CLEARED HERE. It is money the shop has
  -- already paid us. Whether a lapse should ever consume it has NOT been ruled
  -- on by the owner; keeping it is the reversible choice, and expiring somebody
  -- money in silence is not a default anyone should pick on their behalf.
  SELECT (tier_state = 'custom')
    INTO v_was_custom
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_id
     AND tier_state IN ('pro', 'enterprise', 'custom')
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at < now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE public.vendor_profiles
     SET tier_state = (
           CASE WHEN verification_state = 'verified'
                THEN 'verified' ELSE 'free' END
         )::public.vendor_tier_state,
         tier_expires_at    = NULL,
         tier_billing_cycle = NULL
   WHERE vendor_profile_id = p_vendor_id
     AND tier_state IN ('pro', 'enterprise', 'custom')
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at < now();
  IF v_was_custom THEN
    UPDATE public.vendor_custom_plans
       SET status = 'lapsed', updated_at = now()
     WHERE vendor_profile_id = p_vendor_id
       AND status = 'active';
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.sweep_vendor_tier_expiry(UUID) IS
  'Login-driven, cron-free. Applies a PAID scheduled plan change the moment the current term runs out, and otherwise reverts an expired pro/enterprise/custom tier to verified/free. A scheduled plan with no paid purchase behind it is dropped, never granted. Carried subscription credit is deliberately left alone on a lapse.';

-- ----------------------------------------------------------------------------
-- 8. Changing your mind. A forward primitive with no inverse is how a shop ends
--    up trapped in a decision it made once -- cancelling a scheduled change is
--    part of the feature, not a follow-up.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_vendor_plan_change()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
-- PINNED. A SECURITY DEFINER function with an unpinned search_path runs its
-- unqualified names through whatever the CALLER put in front of `public` — the
-- classic definer-escalation shape. Every reference in this body is already
-- schema-qualified, so pinning costs nothing here. (The three functions it sits
-- beside are unpinned; that is inherited, and is not a reason for a new one to
-- be.)
SET search_path = ''
AS $function$
DECLARE
  v_vendor_id UUID;
  v_p         public.vendor_profiles;
BEGIN
  SELECT vid INTO v_vendor_id FROM public.current_vendor_ids('admin') AS vid LIMIT 1;
  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'NOT_VENDOR_ADMIN: only a store admin can change the plan';
  END IF;

  SELECT * INTO v_p FROM public.vendor_profiles
   WHERE vendor_profile_id = v_vendor_id FOR UPDATE;
  IF v_p.pending_tier IS NULL THEN
    RETURN jsonb_build_object('cancelled', false, 'reason', 'NOTHING_SCHEDULED');
  END IF;

  -- THE MONEY GOES BACK TO THE BALANCE, IT IS NOT LOST. They paid for the
  -- cheaper plan and then decided against starting it, so what they paid becomes
  -- credit against whatever they buy next. Same rule as everywhere else here:
  -- money already paid is never destroyed by a change of mind.
  UPDATE public.vendor_profiles
     SET subscription_credit_php = subscription_credit_php + COALESCE(
           (SELECT s.amount_php FROM public.vendor_subscriptions s
             WHERE s.purchase_id = v_p.pending_tier_purchase_id
               AND s.status = 'paid'), 0),
         pending_tier               = NULL,
         pending_tier_billing_cycle = NULL,
         pending_tier_period_days   = NULL,
         pending_tier_sku_code      = NULL,
         pending_tier_purchase_id   = NULL,
         pending_tier_scheduled_at  = NULL
   WHERE vendor_profile_id = v_vendor_id;

  -- 'superseded', NOT 'cancelled'. The status CHECK on this table admits exactly
  -- pending_payment | paid | rejected | superseded, and a value outside that set
  -- is REFUSED by the constraint rather than stored -- the phantom-enum-value
  -- trap this codebase has already paid for more than once. Read the constraint,
  -- do not reach for the word that reads best in English.
  UPDATE public.vendor_subscriptions
     SET status = 'superseded'
   WHERE purchase_id = v_p.pending_tier_purchase_id
     AND status = 'paid';

  RETURN jsonb_build_object('cancelled', true, 'vendor_id', v_vendor_id);
END;
$function$;

-- The shop's own undo. Takes NO ARGUMENT and resolves the shop from
-- `auth.uid()` inside the function, so there is nothing for a caller to point
-- somewhere else.
REVOKE ALL ON FUNCTION public.cancel_vendor_plan_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_vendor_plan_change() TO authenticated;

-- 🚨 THESE TWO ARE NOT GRANTED TO ANYBODY, AND THAT IS THE POINT.
--
-- The first cut of this migration granted both to `authenticated`, out of habit,
-- and the exposure-freeze guard caught it. Both take a vendor id as an ARGUMENT
-- and both are SECURITY DEFINER, so the grant would have let ANY signed-in
-- person aim them at ANY shop:
--   • `vendor_unused_plan_value_php` returns PESOS — a competitor could read how
--     much unused plan any shop is sitting on.
--   • `vendor_plan_change_kind` discloses which plan a shop is on, by probing
--     tiers until the answer stops being 'upgrade'.
-- Neither has a client caller. `create_vendor_subscription` is itself SECURITY
-- DEFINER and calls them as its owner, which needs no grant at all.
--
-- 🔑 A SECURITY DEFINER FUNCTION TAKING AN ID IS A READ OF SOMEBODY ELSE'S ROW
-- WEARING A FUNCTION'S CLOTHES. Grant it only when a client genuinely calls it,
-- and only when it resolves its own subject from the session.
REVOKE ALL ON FUNCTION public.vendor_unused_plan_value_php(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_plan_change_kind(UUID, public.vendor_tier_state) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 9. THE ROW IS YOURS, THE FIELD IS NOT.
--
-- `authenticated` holds a TABLE-level grant on vendor_profiles -- read out of
-- production, not assumed -- so UPDATE reaches every column the table will ever
-- have, including the six added above. The RLS policy is FOR ALL on
-- `user_id = auth.uid()`, which authenticates the owner of the row and says
-- nothing whatsoever about what is in it. The write-guard trigger is therefore
-- the ONLY control standing between a shop and a self-granted plan.
--
-- `subscription_credit_php` is the worst of the new columns to leave open: it is
-- literally pesos, and an unguarded PATCH would let a shop write itself as much
-- credit as it liked and then spend it on Enterprise. `pending_tier` is the
-- second: with the applier in place, an unguarded pending tier is a plan that
-- switches itself on for free the moment the current term ends.
-- ----------------------------------------------------------------------------
-- 🪤 THIS BODY IS THE LIVE ONE READ OUT OF PRODUCTION WITH `pg_get_functiondef`,
-- WITH THE NEW COLUMNS ADDED. It is NOT the body from the migration that first
-- created this function.
--
-- The first cut of this migration rebuilt the guard from 20270920020000 — the
-- ORIGINAL — and `CREATE OR REPLACE` then silently reverted every later
-- addition: five add-on columns, `verification_state`, `public_visibility`, all
-- three trust-stamp columns, and the year-change auto-unverify that clears an
-- experience badge when the shop edits the year it was checked against. Fifteen
-- db tests went red and named it. Had they not existed this would have shipped
-- as a security regression wearing the clothes of a security improvement.
--
-- 🔑 A FUNCTION IS NOT ITS FIRST MIGRATION. When you `CREATE OR REPLACE`
-- anything in this schema, read the CURRENT body out of the database first.
CREATE OR REPLACE FUNCTION public.guard_vendor_profiles_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_level TEXT := to_jsonb(NEW) ->> 'ai_addon_level';
  old_level TEXT := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ->> 'ai_addon_level' END;
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.tier_state IS DISTINCT FROM 'free'::public.vendor_tier_state
         OR NEW.tier_expires_at IS NOT NULL
         OR NEW.extra_agent_seats IS DISTINCT FROM 0
         OR NEW.ai_addon_expires_at IS NOT NULL
         OR NEW.ai_addon_trial_used_at IS NOT NULL
         OR NEW.booth_addon_expires_at IS NOT NULL
         OR NEW.booth_addon_trial_used_at IS NOT NULL
         OR (new_level IS NOT NULL AND new_level <> 'basic')
         -- Trust columns: a self-created profile may never arrive pre-verified
         -- or pre-visible. Both are admin-granted only. The literals below are
         -- the COLUMN DEFAULTS verbatim — 'unverified' (20260516050000:83-84)
         -- and 'hidden' (20271013500000 step 2; WAS 'coming_soon' from
         -- 20260515005000 until the owner retired that state on 2026-07-27) —
         -- and both are ENUMs, so they are cast explicitly. Getting either wrong
         -- would reject ordinary vendor registration.
         OR NEW.verification_state
              IS DISTINCT FROM 'unverified'::public.vendor_verification_state
         OR NEW.public_visibility
              IS DISTINCT FROM 'hidden'::public.vendor_public_visibility
         -- Trust columns, added 20271134103060. A shop cannot be BORN carrying
         -- the mark that says Setnayan checked it, any more than it can be born
         -- verified. All three are stamped only by /admin/verify (service-role).
         OR NEW.experience_verified_at IS NOT NULL
         OR NEW.experience_verified_by IS NOT NULL
         OR NEW.last_verified_at IS NOT NULL
         -- ── ADDED HERE ──────────────────────────────────────────────────────
         -- A shop cannot be born holding money, or born with a plan queued up
         -- behind the one it is on. With the applier live, an unguarded
         -- `pending_tier` is a plan that switches itself on for free the moment
         -- the current term runs out.
         OR NEW.pending_tier IS NOT NULL
         OR NEW.pending_tier_purchase_id IS NOT NULL
         OR COALESCE(NEW.subscription_credit_php, 0) <> 0
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seats, paid add-ons, scheduled plan changes, account credit, verification, public visibility and the experience check are granted by the admin console or the paid activation path (service_role).';
      END IF;
    ELSE  -- UPDATE
      -- Enforce the year-change auto-unverify that the app performs as a
      -- courtesy. Done BEFORE the refusal check so the forced NULLs are what
      -- the check below sees — and so a vendor who PATCHes the year directly,
      -- never naming the stamp columns, still loses the mark. The admin's
      -- check was against a specific number; change the number and the check
      -- no longer means anything.
      IF NEW.in_business_since_year IS DISTINCT FROM OLD.in_business_since_year THEN
        NEW.experience_verified_at := NULL;
        NEW.experience_verified_by := NULL;
      END IF;

      IF NEW.tier_state IS DISTINCT FROM OLD.tier_state
         OR NEW.tier_expires_at IS DISTINCT FROM OLD.tier_expires_at
         OR NEW.extra_agent_seats IS DISTINCT FROM OLD.extra_agent_seats
         OR NEW.ai_addon_expires_at IS DISTINCT FROM OLD.ai_addon_expires_at
         OR NEW.ai_addon_trial_used_at IS DISTINCT FROM OLD.ai_addon_trial_used_at
         OR NEW.booth_addon_expires_at IS DISTINCT FROM OLD.booth_addon_expires_at
         OR NEW.booth_addon_trial_used_at IS DISTINCT FROM OLD.booth_addon_trial_used_at
         OR new_level IS DISTINCT FROM old_level
         -- Trust columns: self-verification, and reversing an admin visibility
         -- freeze on a suspended vendor.
         OR NEW.verification_state IS DISTINCT FROM OLD.verification_state
         OR NEW.public_visibility IS DISTINCT FROM OLD.public_visibility
         -- When the shop was last verified is the admin's record, never the
         -- vendor's — not even to clear it.
         OR NEW.last_verified_at IS DISTINCT FROM OLD.last_verified_at
         -- The experience mark may be CLEARED by the vendor (that is the
         -- year-change unverify, and giving up your own badge harms nobody) but
         -- never SET or moved to another value. Written as "changed AND the new
         -- value is not null" so the allowed direction stays one-way.
         OR (NEW.experience_verified_at IS DISTINCT FROM OLD.experience_verified_at
             AND NEW.experience_verified_at IS NOT NULL)
         OR (NEW.experience_verified_by IS DISTINCT FROM OLD.experience_verified_by
             AND NEW.experience_verified_by IS NOT NULL)
         -- ── ADDED HERE ──────────────────────────────────────────────────────
         -- Every part of a scheduled plan change, and the money balance. All six
         -- are named: the applier reads the cycle, the period and the purchase
         -- id as well as the tier, so guarding only `pending_tier` would leave a
         -- shop able to stretch a 28-day plan into 3,650 days.
         OR NEW.pending_tier IS DISTINCT FROM OLD.pending_tier
         OR NEW.pending_tier_period_days IS DISTINCT FROM OLD.pending_tier_period_days
         OR NEW.pending_tier_purchase_id IS DISTINCT FROM OLD.pending_tier_purchase_id
         OR NEW.pending_tier_billing_cycle IS DISTINCT FROM OLD.pending_tier_billing_cycle
         OR NEW.pending_tier_sku_code IS DISTINCT FROM OLD.pending_tier_sku_code
         OR NEW.subscription_credit_php IS DISTINCT FROM OLD.subscription_credit_php
      THEN
        RAISE EXCEPTION
          'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier, paid seats, paid add-ons, scheduled plan changes, account credit, verification, public visibility and the experience check are granted by the admin console or the paid activation path (service_role).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Post-conditions -- fail loudly rather than half-apply.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='vendor_profiles'
       AND column_name='subscription_credit_php'
  ) THEN v_missing := array_append(v_missing, 'vendor_profiles.subscription_credit_php'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='vendor_subscriptions'
       AND column_name='credit_carry_forward_php'
  ) THEN v_missing := array_append(v_missing, 'vendor_subscriptions.credit_carry_forward_php'); END IF;

  -- The applier must actually be in the sweep. A migration that dropped this
  -- half would leave every scheduled downgrade landing on free.
  IF position('pending_tier_purchase_id' IN
        pg_get_functiondef('public.sweep_vendor_tier_expiry(uuid)'::regprocedure)) = 0
  THEN v_missing := array_append(v_missing, 'sweep_vendor_tier_expiry has no applier'); END IF;

  -- The write guard must know about the money column.
  IF position('subscription_credit_php' IN
        pg_get_functiondef('public.guard_vendor_profiles_entitlement()'::regprocedure)) = 0
  THEN v_missing := array_append(v_missing, 'entitlement guard does not cover the credit'); END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'plan-change migration half-applied: %', array_to_string(v_missing, ', ');
  END IF;
END $$;

COMMIT;
