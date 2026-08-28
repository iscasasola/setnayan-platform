-- ============================================================================
-- CREDIT EXPIRES WHEN A SHOP LAPSES — and never without a record.
--
-- Owner ruling, 2026-08-28: *"it expires when they lapse"*, chosen over keeping
-- it. This REVERSES the default shipped in 20271177335213, which deliberately
-- persisted the balance because the question was open at the time. It is not a
-- correction of a mistake; it is a decision that had not been made yet.
--
-- ── THE MOMENT OF EXPIRY IS THE SWEEP, NOT THE CLOCK ────────────────────────
-- `tier_expires_at` passing does nothing on its own. `sweep_vendor_tier_expiry`
-- is LOGIN-DRIVEN AND CRON-FREE — it runs when somebody loads the vendor
-- dashboard — and it is the only thing in this system that actually runs. So
-- expiry is attached to the sweep, and the consequence is stated plainly rather
-- than hidden: A SHOP WHOSE OWNER NEVER SIGNS IN KEEPS ITS BALANCE UNTIL
-- SOMEBODY DOES. That is a property of a cron-free design, not an oversight.
-- Attaching it to the clock instead would mean the money is "gone" at a moment
-- no code observes, so two readers would disagree about the balance depending on
-- whether anything had swept — and the screen would be one of them.
--
-- ── A LAPSE AND A PLAN CHANGE ARE NOT THE SAME EVENT ────────────────────────
-- 🚨 THE MOST DANGEROUS THING ABOUT THIS CHANGE. The applier and the lapse live
-- in the SAME function and are reached by the SAME condition — `tier_expires_at`
-- in the past. Only one of them is a shop going away. A shop moving onto the
-- Solo plan it scheduled AND PAID FOR is CONTINUING, and taking its balance
-- there would be theft dressed as policy. The applier branch RETURNS before the
-- lapse is reached, and tests pin both directions: a landing scheduled change
-- keeps the balance; an unpaid schedule lapses and loses it.
--
-- ── NEVER DESTROY A BALANCE SILENTLY ────────────────────────────────────────
-- `vendor_credit_ledger` records every movement of `subscription_credit_php`,
-- and it is written by a TRIGGER ON THE COLUMN rather than by the sweep.
-- 🔑 THAT IS THE WHOLE POINT: a ledger written by the paths somebody remembered
-- is a ledger that misses the next path. This one cannot be bypassed — the
-- activation assignment, the cancellation refund, the expiry, and anything added
-- later all move through the same column and are all recorded. It is the
-- "enumerate from the COLUMN, never from the remembered list of writers" rule,
-- pointed at money.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The movement log.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_credit_ledger (
  ledger_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id)
                      ON DELETE CASCADE,
  -- Signed: negative takes money away, positive gives it. The DELTA and the
  -- RESULT are stored together so a row is readable on its own, without
  -- replaying every row before it.
  delta_php          NUMERIC(12,2) NOT NULL,
  balance_before_php NUMERIC(12,2) NOT NULL,
  balance_after_php  NUMERIC(12,2) NOT NULL,
  -- Why the money moved. Free text rather than an enum ON PURPOSE: a new reason
  -- must never be REFUSED by a constraint at the moment somebody's balance is
  -- changing. A refused audit row would abort the money movement — or, if it
  -- were ever made non-fatal, lose the record of it — and this table's only job
  -- is to never lose the record. An unrecognised reason reads as 'unspecified'.
  reason             TEXT NOT NULL DEFAULT 'unspecified',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_credit_ledger ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.vendor_credit_ledger IS
  'Append-only record of every change to vendor_profiles.subscription_credit_php. Written by a trigger on the column, not by its callers, so a path nobody remembered is still recorded. Exists because credit now EXPIRES on lapse (owner 2026-08-28) and money must never vanish without a trace.';

CREATE INDEX IF NOT EXISTS vendor_credit_ledger_vendor_idx
  ON public.vendor_credit_ledger (vendor_profile_id, created_at DESC);

-- Restate the column's own comment from HERE, not only in the migration that
-- created it. 20271177335213 described the balance as never cleared on a lapse,
-- which was true of the ruling that existed when it was written and is false
-- now. Its text is corrected too (it has never been applied), but this
-- re-statement is what guarantees the DEPLOYED comment is right whichever order
-- the two are read in — a reader queries the object, not the file.
COMMENT ON COLUMN public.vendor_profiles.subscription_credit_php IS
  'Carried-forward subscription credit in PHP. Money the shop has already paid that outlived the bill it was credited against; spent automatically against later plan charges until it runs out. Never capped and never refunded. EXPIRES when the shop lapses (owner 2026-08-28), recorded in vendor_credit_ledger. Applying a scheduled plan change is NOT a lapse and never touches it.';

-- A shop may READ its own money history. Nobody writes it through PostgREST:
-- there is no INSERT/UPDATE/DELETE policy, and RLS with no policy for a command
-- refuses that command outright — so the trigger, which runs as the table owner,
-- is the only writer that exists.
-- ⚠ `TO authenticated`, NOT the default PUBLIC. A policy defaults to PUBLIC,
-- which includes `anon` — and `anon` has no grant on this table, so such a policy
-- names a role that can never reach it. A guard caught exactly that
-- ("a revoke never orphans a policy that was written FOR anon"): the rule would
-- have survived in the catalog, unreachable, looking like anonymous access was
-- intended here. Scoping it to the role that can actually use it says what is
-- true.
DROP POLICY IF EXISTS vendor_credit_ledger_owner_read ON public.vendor_credit_ledger;
CREATE POLICY vendor_credit_ledger_owner_read
  ON public.vendor_credit_ledger
  FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
       WHERE user_id = auth.uid()
    )
    OR public.is_console_admin()
  );

-- 🚨 REVOKED FROM THE ROLES BY NAME, NOT ONLY FROM `PUBLIC`. A new table in this
-- schema is born OPEN: Supabase's default privileges hand `anon` and
-- `authenticated` full SELECT/INSERT/UPDATE/DELETE the moment it is created, and
-- `REVOKE ... FROM PUBLIC` does NOT remove a grant made to a role directly. The
-- first cut of this migration did exactly that and the exposure-freeze guard
-- caught `anon` holding SIUD on a table of shop money movements.
--
-- RLS would still have filtered the rows — the read policy matches `auth.uid()`
-- or an admin, and `anon` is neither — but table privileges are the only defence
-- in depth behind RLS, and a money log is the last place to lean on a single
-- layer. `anon` gets nothing at all: a shop's money history is not marketplace
-- data. `authenticated` gets SELECT only; the trigger is the sole writer.
REVOKE ALL ON TABLE public.vendor_credit_ledger FROM PUBLIC;
REVOKE ALL ON TABLE public.vendor_credit_ledger FROM anon;
REVOKE ALL ON TABLE public.vendor_credit_ledger FROM authenticated;
GRANT SELECT ON TABLE public.vendor_credit_ledger TO authenticated;
GRANT SELECT, INSERT ON TABLE public.vendor_credit_ledger TO service_role;

-- ----------------------------------------------------------------------------
-- 2. The recorder. A trigger on the COLUMN, so no writer can skip it.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_vendor_credit_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before NUMERIC(12,2) := COALESCE(OLD.subscription_credit_php, 0);
  v_after  NUMERIC(12,2) := COALESCE(NEW.subscription_credit_php, 0);
BEGIN
  -- Only real movements. The lapse sweep touches this row on every visit, and a
  -- log that records non-movements is a log nobody can read.
  IF v_after IS NOT DISTINCT FROM v_before THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.vendor_credit_ledger
    (vendor_profile_id, delta_php, balance_before_php, balance_after_php, reason)
  VALUES
    (NEW.vendor_profile_id, v_after - v_before, v_before, v_after,
     -- The mover says why, through a session setting. When nothing set one the
     -- row is STILL written — an unexplained movement is far better than an
     -- unrecorded one, and 'unspecified' is a finding rather than a crash.
     COALESCE(NULLIF(current_setting('setnayan.credit_reason', true), ''), 'unspecified'));

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.record_vendor_credit_movement() IS
  'Writes vendor_credit_ledger for every change to subscription_credit_php. Attached to the column rather than called by each writer, so a path added later is recorded without anybody remembering to. Reads its reason from setnayan.credit_reason and falls back to unspecified rather than failing.';

-- 🔑 REVOKED, NOT BASELINED. A new function is granted EXECUTE to PUBLIC by
-- default, so this SECURITY DEFINER body was callable by any holder of the
-- publishable key — which a guard caught and offered to let me declare in a
-- baseline instead. **A baseline is a bill, not a decision.** A trigger function
-- needs no EXECUTE grant at all: the trigger fires as the table owner, so taking
-- the grant away costs nothing and closes the door rather than documenting it.
REVOKE ALL ON FUNCTION public.record_vendor_credit_movement() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_record_vendor_credit_movement ON public.vendor_profiles;
CREATE TRIGGER trg_record_vendor_credit_movement
  AFTER UPDATE OF subscription_credit_php ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.record_vendor_credit_movement();

-- ----------------------------------------------------------------------------
-- 3. The sweep, with the lapse now taking the balance with it.
--
-- Everything except the lapse UPDATE is byte-identical to 20271177335213 —
-- including the applier branch, which still RETURNS before the lapse is reached.
-- That ordering is what keeps a landing plan change from being read as a shop
-- going away.
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
     AND tier_state IN ('pro', 'enterprise', 'custom')
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
  'Login-driven, cron-free. Applies a PAID scheduled plan change the moment the current term runs out and RETURNS; otherwise reverts an expired pro/enterprise/custom tier to verified/free and EXPIRES any carried credit with it (owner 2026-08-28), leaving a vendor_credit_ledger row. A scheduled plan with no paid purchase behind it is dropped, never granted. Applying a scheduled change is NOT a lapse and never touches the balance.';

-- ----------------------------------------------------------------------------
-- 4. Name the reason on the other path that moves credit, so the ledger reads as
--    sentences rather than a column of 'unspecified'.
--
--    The body is re-declared in full because `CREATE OR REPLACE` replaces a
--    whole body; everything but the `set_config` line is byte-identical to
--    20271177335213, which is the current definition of this function and has
--    not been applied anywhere yet.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_vendor_plan_change()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  PERFORM set_config('setnayan.credit_reason', 'cancelled_plan_change', true);

  -- THE MONEY GOES BACK TO THE BALANCE, IT IS NOT LOST. They paid for the
  -- cheaper plan and then decided against starting it, so what they paid becomes
  -- credit against whatever they buy next.
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
  -- is REFUSED by the constraint rather than stored.
  UPDATE public.vendor_subscriptions
     SET status = 'superseded'
   WHERE purchase_id = v_p.pending_tier_purchase_id
     AND status = 'paid';

  RETURN jsonb_build_object('cancelled', true, 'vendor_id', v_vendor_id);
END;
$function$;

-- ----------------------------------------------------------------------------
-- 5. Post-conditions — fail loudly rather than half-apply.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_sweep   TEXT   := pg_get_functiondef('public.sweep_vendor_tier_expiry(uuid)'::regprocedure);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE NOT tgisinternal
       AND tgname = 'trg_record_vendor_credit_movement'
       AND tgrelid = 'public.vendor_profiles'::regclass
  ) THEN v_missing := array_append(v_missing, 'the credit ledger trigger is not attached'); END IF;

  -- The lapse must actually zero the balance. A migration that dropped this half
  -- would leave the owner's ruling unimplemented, and silently so.
  IF position('subscription_credit_php = 0' IN v_sweep) = 0
  THEN v_missing := array_append(v_missing, 'the lapse does not expire the credit'); END IF;

  -- ...and the applier must still return before it, or a CONTINUING shop loses
  -- its money.
  IF position('RETURN;' IN v_sweep) = 0
  THEN v_missing := array_append(v_missing, 'the applier no longer returns before the lapse'); END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'credit-expiry migration half-applied: %', array_to_string(v_missing, ', ');
  END IF;
END $$;

COMMIT;
