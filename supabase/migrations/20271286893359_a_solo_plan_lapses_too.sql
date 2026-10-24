-- a_solo_plan_lapses_too
-- Created via `pnpm migration:new`. Idempotent: CREATE OR REPLACE FUNCTION ·
-- COMMENT · a read-only post-condition. No table, column, grant or policy.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- `sweep_vendor_tier_expiry` — the login-driven lapse — ends an expired plan
-- only when it is ('pro','enterprise','custom'). That list predates Solo
-- (20270720243717); Solo was added later and the list was never widened. So a
-- Solo plan whose day has passed STAYS 'solo' in the row forever. The app's
-- own gates mostly re-check `tier_expires_at` (vendorHoldsActivePaidSub), but
-- the row — and everything that reads `tier_state` alone — keeps saying Solo.
--
-- The personal invite (20271286262047) gives "Solo free until <day>", which is
-- exactly this case: proven by
-- tests/db/the-personal-invite-carries-its-offer.db.test.ts ("the 100 photos …
-- still there after the plan gift has ended"), which failed with 'solo' !==
-- 'free' until this file.
--
-- Measured on production 2026-10-23 (read-only): 2 Solo shops, both admin
-- comps, ₱0 credit between them; ONE is already past its day and still Solo.
-- That shop is the only row this changes today: on its next dashboard visit it
-- lapses to verified/free, as an ended comp should.
--
-- ── WHAT CHANGES ────────────────────────────────────────────────────────────
-- 'solo' joins the lapse's tier list, in BOTH places it is written (the FOR
-- UPDATE probe and the UPDATE). Everything else is byte-identical to
-- 20271178284709, the current definition — including the credit rule (owner
-- 2026-08-28: the credit goes with the plan) and the scheduled-change applier,
-- which already returned before the lapse for Solo (20271177335213 widened
-- that half on purpose).

BEGIN;

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

      -- ⚖ THIS `RETURN` IS BELT-AND-BRACES, AND IS KEPT ANYWAY. Measured, not
      -- assumed: a mutation deleting it stayed GREEN, because the UPDATE above
      -- has already pushed `tier_expires_at` into the FUTURE and moved the tier
      -- off the lapse's ('pro','enterprise','custom') list — so the lapse below
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

  -- ── THE LAPSE ────────────────────────────────────────────────────────────
  SELECT (tier_state = 'custom')
    INTO v_was_custom
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_id
     AND tier_state IN ('solo', 'pro', 'enterprise', 'custom')
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
     AND tier_state IN ('solo', 'pro', 'enterprise', 'custom')
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
  'Login-driven, cron-free. Applies a PAID scheduled plan change the moment the current term runs out and RETURNS; otherwise reverts an expired solo/pro/enterprise/custom tier to verified/free and EXPIRES any carried credit with it (owner 2026-08-28), leaving a vendor_credit_ledger row. A scheduled plan with no paid purchase behind it is dropped, never granted. Applying a scheduled change is NOT a lapse and never touches the balance.';

-- Post-conditions — fail loudly rather than half-apply.
DO $$
DECLARE
  v_sweep TEXT := pg_get_functiondef('public.sweep_vendor_tier_expiry(uuid)'::regprocedure);
BEGIN
  IF (length(v_sweep) - length(replace(v_sweep, 'tier_state IN (''solo'', ''pro'', ''enterprise'', ''custom'')', '')))
     / length('tier_state IN (''solo'', ''pro'', ''enterprise'', ''custom'')') <> 2 THEN
    RAISE EXCEPTION 'a_solo_plan_lapses_too: the lapse does not name Solo in both places';
  END IF;
  IF position('subscription_credit_php = 0' IN v_sweep) = 0 THEN
    RAISE EXCEPTION 'a_solo_plan_lapses_too: the lapse no longer expires the credit';
  END IF;
  IF position('RETURN;' IN v_sweep) = 0 THEN
    RAISE EXCEPTION 'a_solo_plan_lapses_too: the applier no longer returns before the lapse';
  END IF;
END $$;

COMMIT;
