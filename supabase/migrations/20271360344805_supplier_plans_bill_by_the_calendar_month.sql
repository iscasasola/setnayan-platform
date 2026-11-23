-- supplier_plans_bill_by_the_calendar_month
-- Created via `pnpm migration:new` (scripts/new-migration.mjs). Idempotent: CREATE OR REPLACE FUNCTION · REVOKE ·
-- an UPDATE that touches only titles not already final · a read-only post-condition. No table, column, policy or
-- grant on any existing object changes.
--
-- ============================================================================
-- 🗓 A SUPPLIER PLAN BILLS BY THE CALENDAR MONTH, NOT EVERY 28 DAYS.
-- ============================================================================
-- DECISION_LOG 2026-11-22 "SUPPLIER AND COORDINATOR PLANS AND THE ULTRA PACK BILL MONTHLY EVERYWHERE … REPLACES
-- 'EVERY 4 WEEKS'" (3): *renewals move from +28 days to +1 month … A shop already paying keeps its current period
-- until it ends, then renews monthly.* Owner again, 23 Nov: *"the plan is not per 4 weeks. it is now monthly"*.
-- The iPhone app already sells these plans as Apple monthly subscriptions, so Apple bills by the calendar month and
-- the web now matches it.
--
--   1 · `vendor_plan_term_end(start, billing_cycle, period_days)` — THE ONE PLACE a plan term's end is worked out.
--       Monthly = start + 1 calendar month, counted on the Manila calendar (Jan 31 → Feb 28, or Feb 29 in a leap
--       year; Mar 15 → Apr 15). Postgres clamps a day the next month lacks to its last day. A yearly row (no yearly
--       SKU is on sale since 20271360321657) keeps its day count. Internal: not granted to any user role.
--   2 · `create_vendor_subscription` — the "a purchase must cover the time you already have" rule now asks whether a
--       term started today would end before the plan the shop already has. Same rule, month-shaped term.
--   3 · `_apply_subscription_credit` — every first purchase, renewal and upgrade ends 1 calendar month after it
--       starts, and the purchase row's `period_days` is rewritten to the days that month actually holds (28–31).
--       `vendor_unused_plan_value_php` reads a term back as [expires_at - period_days, expires_at], so the unused
--       credit of an upgrade stays exact for a month of any length without that function changing. An Apple row
--       ('app_store') keeps Apple's own day count, as before.
--   4 · `sweep_vendor_tier_expiry` — a paid scheduled plan that lands at term end runs 1 calendar month (was
--       `COALESCE(pending_tier_period_days, 28)` days) and stamps the days it holds on its purchase.
--   5 · The three monthly SKUs' titles read "Plus (monthly)" · "Pro (monthly)" · "Ultra (monthly)" (were "(4 weeks)").
--
-- ── WHAT A SHOP ALREADY PAYING SEES ──────────────────────────────────────────
--   Nothing changes on a running term: `tier_expires_at` and each paid row's `expires_at` / `period_days` (28) are
--   left exactly as they are, so the 28-day period it bought ends on the day it was sold. Its NEXT renewal adds a
--   month. A purchase ordered before this ran and approved after it is a renewal too, and gets a month (its price is
--   already the monthly price, 20271360321657).
--
-- ── WHAT IS DELIBERATELY LEFT ────────────────────────────────────────────────
--   · Setnayan plan gifts (`setnayan_shop_gifts.plan_days` 28), badge rewards, add-ons (Papic challenge, 3D booth,
--     AI, specialized tools) and the Founders offer keep their day counts: not in this ruling.
--   · Apple (`app_store_supplier_plan_apply`) already takes its period end from Apple; no 28 lives there.
--   · Chained renewals follow Postgres month maths from the previous end (Jan 31 → Feb 28 → Mar 28), not an anchor
--     day. Apple anchors (Jan 31 → Feb 28 → Mar 31); a web shop renewing every month drifts to the 28th at most once.
--
-- Never applied by hand: the pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1 · The one term rule.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_plan_term_end(
  p_start         TIMESTAMPTZ,
  p_billing_cycle TEXT,
  p_period_days   INT
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
           WHEN p_start IS NULL THEN NULL
           -- A month on the shop's own calendar. Manila keeps no daylight saving, so the time of day is kept too.
           WHEN COALESCE(p_billing_cycle, 'monthly') = 'monthly'
             THEN ((p_start AT TIME ZONE 'Asia/Manila') + INTERVAL '1 month') AT TIME ZONE 'Asia/Manila'
           -- A yearly row bought before yearly retired keeps the day count it was sold with.
           ELSE p_start + make_interval(days => COALESCE(p_period_days, 365))
         END;
$$;

COMMENT ON FUNCTION public.vendor_plan_term_end(TIMESTAMPTZ, TEXT, INT) IS
  'THE ONE PLACE a supplier plan term''s end is worked out (owner 2026-11-22/23: plans bill MONTHLY, not every 4 weeks). Monthly = start + 1 calendar month on the Manila calendar (Jan 31 -> Feb 28/29). A yearly row keeps its day count. Called by create_vendor_subscription, _apply_subscription_credit and sweep_vendor_tier_expiry; internal, not granted to any user role.';

REVOKE ALL ON FUNCTION public.vendor_plan_term_end(TIMESTAMPTZ, TEXT, INT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2 · Starting a purchase. The body of 20271177335213 §5; only the term lines change.
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
  v_expires_at TIMESTAMPTZ;
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
    -- 🗓 A CALENDAR MONTH (owner 2026-11-22/23), not 28 days. This is the days in the month that starts today, for
    -- the order row; activation rewrites it to the days the term it lands on actually holds.
    v_period := GREATEST(1, ROUND(EXTRACT(EPOCH FROM (
                  public.vendor_plan_term_end(now(), 'monthly', NULL) - now())) / 86400.0))::INT;
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

  -- ── A PURCHASE MUST COVER THE TIME YOU ALREADY HAVE ──────────────────────
  -- Owner, 2026-08-27, verbatim: *"they cannot purchase a smaller timeline. if
  -- they paid for a year. their purchase must cover the same timeline. this
  -- means, they cannot purchase a months worth if what they have now is more
  -- than a months worth of subscription."*
  --
  -- The test is TERM LENGTH against TIME REMAINING. Not the tier, not the price,
  -- and it applies going up and going down alike. 300 days of Solo annual left
  -- means the only Pro you can buy is Pro annual.
  --
  -- ⚖ THIS IS A DELIBERATE DIVERGENCE FROM THE INDUSTRY NORM AND IT WAS CHOSEN
  -- KNOWINGLY. The standard behaviour is to allow the switch and turn the unused
  -- annual time into carried credit; the owner was shown that and picked the
  -- stricter rule. It is better HERE because it DELETES the large-credit case
  -- instead of managing it: an upgrade must now buy a term at least as long as
  -- the one it replaces, and at equal terms the dearer plan always costs more
  -- than the unused value of the cheaper one — so the credit is fully absorbed
  -- by the bill and PRORATION CAN NO LONGER LEAVE A STANDING BALANCE AT ALL.
  -- A db test asserts that as a property rather than leaving it as a claim here.
  -- ⛔ DO NOT "FIX" THIS TOWARD THE NORM. Relaxing it silently re-creates the
  -- very balance the gate exists to prevent.
  --
  -- ⚠ IT DOES NOT MAKE EVERY BALANCE SMALL, AND SAYING SO WOULD BE FALSE. A
  -- scheduled change that was paid for and then called off still returns a whole
  -- term's price to the account (realistically 10,400 for Solo annual). That is
  -- money the shop handed over and got no service for, so it has to go back to
  -- them — but it means "what happens to credit when a shop lapses" is still an
  -- open question with real money behind it, not a rounding detail.
  --
  -- 🔑 STRICTLY SHORTER, NEVER SHORTER-OR-EQUAL. A term exactly matching the
  -- time left is legal — that is a straight renewal of the same length, which is
  -- the commonest purchase there is, and refusing it would be absurd.
  --
  -- A LAPSED OR NEVER-SUBSCRIBED SHOP HAS NO REMAINING TIME, so every term is
  -- legal for them. That falls out of the condition rather than needing a case
  -- of its own.
  --
  -- ⚖ `v_expires_at > now()` IS DELIBERATELY REDUNDANT AND IS KEPT ANYWAY.
  -- Measured, not assumed: a mutation deleting it stayed GREEN, because a lapsed
  -- expiry makes `(v_expires_at - now())` NEGATIVE and no positive term is ever
  -- shorter than a negative interval — the comparison below already refuses to
  -- fire. It stays because it states the lapsed case to a reader at a glance and
  -- keeps the guard correct if that comparison is ever rewritten.
  -- 🔑 IT IS WRITTEN DOWN HERE SO NOBODY LATER "DISCOVERS" IT AS DEAD CODE and
  -- deletes it believing it was an oversight. No test covers it in isolation and
  -- none can, which is exactly why the reason is recorded instead of asserted.
  SELECT tier_expires_at INTO v_expires_at
    FROM public.vendor_profiles WHERE vendor_profile_id = v_vendor_id;

  IF v_expires_at IS NOT NULL
     AND v_expires_at > now()
     -- 🗓 Month-shaped since 20271360344805: would a term started today END before the plan already held? The
     -- same "strictly shorter" test as before (now + 28 days < expiry), asked of the one term rule.
     AND public.vendor_plan_term_end(now(), v_cycle, v_period) < v_expires_at
  THEN
    -- The date rides in the message so the screen can say it back without
    -- re-querying. The app turns this into a sentence naming the day; nobody is
    -- ever shown this string.
    RAISE EXCEPTION 'TERM_TOO_SHORT: paid up until %',
      to_char(v_expires_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD');
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
-- 3 · Activation. The body of 20271177335213 §6; only the expiry block changes.
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
  v_start   TIMESTAMPTZ;
  v_days    INT;
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
    v_start := now();
  ELSE
    v_start := GREATEST(now(), COALESCE(
      (SELECT tier_expires_at FROM public.vendor_profiles
         WHERE vendor_profile_id = v_s.vendor_id),
      now()
    ));
  END IF;
  -- 🗓 ONE CALENDAR MONTH from the start (20271360344805), not period_days days. A 28-day term already running keeps
  -- its end: a renewal starts from it, and nothing here touches a row already paid.
  v_expires := public.vendor_plan_term_end(v_start, v_s.billing_cycle, v_s.period_days);
  -- The row records the days its month actually holds (28–31), because vendor_unused_plan_value_php reads the term
  -- back as [expires_at - period_days, expires_at]. Apple's row keeps the day count Apple's period gave it.
  v_days := CASE WHEN v_kind = 'app_store' THEN v_s.period_days
                 ELSE GREATEST(1, ROUND(EXTRACT(EPOCH FROM (v_expires - v_start)) / 86400.0))::INT END;

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
         period_days  = v_days,
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

REVOKE ALL ON FUNCTION public._apply_subscription_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4 · The applier. The body of 20271352202109; only the scheduled plan's term changes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_vendor_tier_expiry(p_vendor_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_p          public.vendor_profiles;
BEGIN
  -- ── 🎁 A SETNAYAN PLAN GIFT THAT HAS RUN ITS DAYS (20271352202109) ───────
  -- Hands the shop back the plan it paused, with the days it had left, BEFORE
  -- anything below can read the gift's end day as the shop's own term ending.
  -- 'returned' = the shop is on its own plan again (nothing more to do here).
  -- Anything else ('none' · 'running' · 'superseded' · 'stayed') falls through:
  -- a plan the shop paid for while on the gift is applied by the branch below.
  IF public.setnayan_plan_gift_return(p_vendor_id, 'ended') = 'returned' THEN
    RETURN;
  END IF;

  -- ── A SCHEDULED PLAN THAT IS NOW DUE ─────────────────────────────────────
  SELECT * INTO v_p FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_id
     AND pending_tier IS NOT NULL
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at <= now()
   FOR UPDATE;

  IF FOUND THEN
    -- A PENDING TIER IS NOT AN ENTITLEMENT UNTIL SOMEBODY PAID FOR IT.
    IF EXISTS (
      SELECT 1 FROM public.vendor_subscriptions s
       WHERE s.purchase_id = v_p.pending_tier_purchase_id
         AND s.vendor_id   = p_vendor_id
         AND s.tier        = v_p.pending_tier
         AND s.status      = 'paid'
    ) THEN
      -- 🚨 THIS SHOP IS CONTINUING, NOT LAPSING. `subscription_credit_php` is
      -- deliberately ABSENT from this UPDATE: they are moving onto a plan they
      -- paid for, and taking their balance here would be theft dressed as
      -- policy. The RETURN below is what stops the lapse also running.
      UPDATE public.vendor_profiles
         SET tier_state         = v_p.pending_tier,
             -- 🗓 ONE CALENDAR MONTH (20271360344805), not the 28 days it used to add.
             tier_expires_at    = public.vendor_plan_term_end(now(), v_p.pending_tier_billing_cycle,
                                                              v_p.pending_tier_period_days),
             tier_billing_cycle = v_p.pending_tier_billing_cycle,
             pending_tier               = NULL,
             pending_tier_billing_cycle = NULL,
             pending_tier_period_days   = NULL,
             pending_tier_sku_code      = NULL,
             pending_tier_purchase_id   = NULL,
             pending_tier_scheduled_at  = NULL
       WHERE vendor_profile_id = p_vendor_id;

      -- The purchase gets the window it bought, and the days that month holds, so the credit maths read it exactly.
      UPDATE public.vendor_subscriptions s
         SET expires_at  = p.tier_expires_at,
             period_days = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (p.tier_expires_at - now())) / 86400.0))::INT
        FROM public.vendor_profiles p
       WHERE p.vendor_profile_id = p_vendor_id
         AND s.purchase_id = v_p.pending_tier_purchase_id
         AND s.expires_at IS NULL;

      -- ⚖ THIS `RETURN` IS BELT-AND-BRACES, AND IS KEPT ANYWAY. Measured, not
      -- assumed: a mutation deleting it stayed GREEN, because the UPDATE above
      -- has already pushed `tier_expires_at` into the FUTURE and moved the tier
      -- off the lapse's ('solo','pro','enterprise') list — so the lapse below
      -- cannot match this row by either test. Two coincidences standing between a
      -- shop and its money is not a design; this line is what makes the boundary
      -- obviously correct, and it stays correct if either of those changes.
      -- 🔑 Written down so nobody later deletes it as unreachable.
      RETURN;
    END IF;

    -- Scheduled but never paid for. Clear the schedule and fall through to the
    -- ordinary lapse — which now takes the balance too, because this shop IS
    -- going away. Otherwise stamping an intention nobody paid for would be a way
    -- to keep money alive indefinitely.
    UPDATE public.vendor_profiles
       SET pending_tier               = NULL,
           pending_tier_billing_cycle = NULL,
           pending_tier_period_days   = NULL,
           pending_tier_sku_code      = NULL,
           pending_tier_purchase_id   = NULL,
           pending_tier_scheduled_at  = NULL
     WHERE vendor_profile_id = p_vendor_id;
  END IF;

  -- ── 🎁 A HELD SETNAYAN PLAN GIFT STARTS WHEN THE SHOP'S OWN PLAN ENDS ────
  -- ("Start it when my plan ends", 20271352202109.) Runs after a PAID
  -- scheduled plan had its chance above — a shop that is continuing is not
  -- ending — and in place of the lapse's tier change: the gift's days are the
  -- shop's plan now. Its credit still goes, as a lapse (inside the helper).
  IF public.setnayan_plan_gift_start_held(p_vendor_id) THEN
    RETURN;
  END IF;

  -- ── THE LAPSE ────────────────────────────────────────────────────────────
  PERFORM 1
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_id
     AND tier_state IN ('solo', 'pro', 'enterprise')
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at < now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Name the reason before the money moves. `set_config(..., true)` is
  -- transaction-local, so it cannot leak into a caller doing more work after
  -- this function returns.
  PERFORM set_config('setnayan.credit_reason', 'lapse', true);

  UPDATE public.vendor_profiles
     SET tier_state = (
           CASE WHEN verification_state = 'verified'
                THEN 'verified' ELSE 'free' END
         )::public.vendor_tier_state,
         tier_expires_at    = NULL,
         tier_billing_cycle = NULL,
         -- ⚖ OWNER 2026-08-28: the credit goes with the plan. The trigger on
         -- this column writes the ledger row; nothing here has to remember to.
         subscription_credit_php = 0
   WHERE vendor_profile_id = p_vendor_id
     AND tier_state IN ('solo', 'pro', 'enterprise')
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at < now();
END;
$function$;


COMMENT ON FUNCTION public.sweep_vendor_tier_expiry(UUID) IS
  'Login-driven, cron-free. First hands a shop whose Setnayan plan gift has run its days back to the plan the gift paused, with the days it had left (setnayan_plan_gift_return, 20271352202109). Applies a PAID scheduled plan change the moment the current term runs out and RETURNS; starts a held Setnayan plan gift instead of a lapse; otherwise reverts an expired solo/pro/enterprise tier to verified/free and EXPIRES any carried credit with it (owner 2026-08-28), leaving a vendor_credit_ledger row. A scheduled plan with no paid purchase behind it is dropped, never granted. Applying a scheduled change is NOT a lapse and never touches the balance.';

-- ----------------------------------------------------------------------------
-- 5 · The plan names a shop reads on its order, its receipt and the admin desks say "monthly", not "4 weeks".
--     Titles only: price_php, is_active and every other column are left as 20271360321657 set them.
-- ----------------------------------------------------------------------------
UPDATE public.vendor_billing_catalog
   SET title      = v.title,
       updated_at = NOW()
  FROM (VALUES
          ('solo_vendor_monthly',       'Plus (monthly)'),
          ('pro_vendor_monthly',        'Pro (monthly)'),
          ('enterprise_vendor_monthly', 'Ultra (monthly)')
       ) AS v(sku_code, title)
 WHERE vendor_billing_catalog.sku_code = v.sku_code
   AND vendor_billing_catalog.title IS DISTINCT FROM v.title;

-- ----------------------------------------------------------------------------
-- 6 · Post-conditions (read-only). The month is a calendar month, and no plan path still adds 28 days.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_fn TEXT;
BEGIN
  IF public.vendor_plan_term_end('2027-01-31 10:00:00+08'::timestamptz, 'monthly', 28)
       <> '2027-02-28 10:00:00+08'::timestamptz
     OR public.vendor_plan_term_end('2028-01-31 10:00:00+08'::timestamptz, 'monthly', 28)
       <> '2028-02-29 10:00:00+08'::timestamptz
     OR public.vendor_plan_term_end('2027-03-15 09:30:00+08'::timestamptz, 'monthly', NULL)
       <> '2027-04-15 09:30:00+08'::timestamptz
     -- Manila's calendar, not UTC's: 1 Feb 03:00 in Manila is still 31 Jan in UTC.
     OR public.vendor_plan_term_end('2027-02-01 03:00:00+08'::timestamptz, 'monthly', NULL)
       <> '2027-03-01 03:00:00+08'::timestamptz THEN
    RAISE EXCEPTION 'POSTCONDITION: vendor_plan_term_end is not one calendar month on the Manila calendar';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY['public.create_vendor_subscription(text,text)',
                              'public._apply_subscription_credit(uuid,uuid)',
                              'public.sweep_vendor_tier_expiry(uuid)'] LOOP
    IF position('vendor_plan_term_end' IN pg_get_functiondef(v_fn::regprocedure)) = 0 THEN
      RAISE EXCEPTION 'POSTCONDITION: % does not read the one term rule', v_fn;
    END IF;
    IF pg_get_functiondef(v_fn::regprocedure) ~ '(period_days, 28\)|v_period := 28|period_days \|\| '' days'')' THEN
      RAISE EXCEPTION 'POSTCONDITION: % still adds a 28-day term', v_fn;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
