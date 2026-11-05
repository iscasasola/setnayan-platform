-- retire_the_custom_supplier_plan
-- Created via `pnpm migration:new`. Idempotent: guarded preconditions · DROP/ADD CONSTRAINT · a COALESCE'd retire ·
-- CREATE OR REPLACE FUNCTION · DROP FUNCTION IF EXISTS · read-only post-conditions. RLS untouched: no policy, no grant.
--
-- ============================================================================
-- ⛔ THE CUSTOM SUPPLIER PLAN IS RETIRED FROM THE APP — DELETED, NOT HIDDEN.
-- ============================================================================
-- Owner, 2026-11-06 (DECISION_LOG), asked "Is the Custom plan gone only from this page, or from the app too?":
--   *"from the app"*
-- This REVERSES the 2026-08-27 "hide, not retire" ruling (apps/web/lib/custom-tier-offered.ts, deleted in the same
-- change). In its place Ultra shows its existing add-ons (extra branch, extra seat) — nothing new is invented here.
--
-- The code half (same PR) deletes the tier key, its caps row, label, price fallbacks, the supplier configurator, the
-- admin composer + pricing tab, and the activation hook that set `tier_state = 'custom'`. This file is the database
-- half, so nothing can quietly put it back:
--
--   1 · PRECONDITION. Refuse to run while ANY row still carries the tier. Measured on production 2026-11-06
--       (read-only, before this was written): ZERO vendor_profiles at tier_state = 'custom' (2 free, 2 solo) and
--       vendor_subscriptions holds only solo rows — so nobody is stranded. If that changed before this applies, the
--       migration stops here, loudly, and the owner decides; it never demotes a paying shop by itself.
--   2 · CHECK constraints: the three columns typed `vendor_tier_state` (vendor_profiles.tier_state,
--       vendor_profiles.pending_tier, vendor_subscriptions.tier) refuse 'custom'.
--       ⚠ The ENUM LABEL STAYS. Postgres cannot drop one label from an enum; it would mean rebuilding the type
--       through every column, function signature and cast that names it. A CHECK makes the value unwritable, which
--       is the part that matters. Do not "finish the job" with a type rebuild without the owner.
--   3 · The five `vendor_custom_*` catalogue rows are RETIRED (off sale + retired_at + retirement_reason), never
--       deleted: an order may already name one, and `orders.service_key` has no FK to protect it. Their code readers
--       (lib/vendor-custom-catalog.ts and its hard-coded fallback) are deleted in the same change — which is the
--       part that makes this a retirement rather than the is_active flip the old file warned about.
--       ⛔ `vendor_additional_branch` and `vendor_extra_seat` are UNTOUCHED: they are Ultra's add-ons and stay.
--   4 · `vendor_tier_rank` and `vendor_tier_limit` lose their 'custom' arms (copied from their LATEST definitions —
--       20271121655918 and 20271307996183 — with only those arms removed). A stray 'custom' now ranks 0 (fails
--       closed: moving to it reads as a downgrade) and reads the ELSE of every limit.
--   5 · The ₱2,500 "no limit" axis was Custom-only. `vendor_pipeline_is_unlimited` read
--       `vendor_custom_plans.composition`; it is DROPPED, and its three callers are re-created from their LATEST
--       bodies with only the "bought the ceiling away" arm removed:
--         enforce_vendor_whitelist_per_date · vendor_whitelist_pressure   (20271224170958)
--         clamp_vendor_waitlist_to_tier                                    (20271182869585)
--   6 · `sweep_vendor_tier_expiry` (latest: 20271286893359) loses its two Custom branches — the 'custom' entries in
--       both tier lists and the two `vendor_custom_plans` demotions. Everything else is byte-identical, including the
--       credit rule and the paid-scheduled-change applier.
--
-- ── WHAT IS DELIBERATELY LEFT ────────────────────────────────────────────────
--   · The `vendor_custom_plans` TABLE, its RLS and its write guard: kept for any rows it may already hold (a
--     commercial record; export-completeness lists it). Nothing in the app reads or writes it any more. Dropping it
--     is an owner call (PR body, "Needs the owner").
--   · 'custom' inside OLD function bodies that only test `tier NOT IN ('solo','pro','enterprise','custom')` (the
--     Papic-challenge and creator RPCs): with the CHECK above the value can never be read, so the word is inert.
--     Re-creating six large RPCs to delete one dead word each is more risk than it removes.
--
-- Never applied by hand: the pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

BEGIN;

-- ── 1 · nobody is on it ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_profiles INT;
  v_pending  INT;
  v_subs     INT;
BEGIN
  SELECT count(*) INTO v_profiles FROM public.vendor_profiles WHERE tier_state::text = 'custom';
  SELECT count(*) INTO v_pending  FROM public.vendor_profiles WHERE pending_tier::text = 'custom';
  SELECT count(*) INTO v_subs     FROM public.vendor_subscriptions WHERE tier::text = 'custom';
  IF v_profiles + v_pending + v_subs > 0 THEN
    RAISE EXCEPTION
      'retire_the_custom_supplier_plan: % shop(s) on Custom, % scheduled to move to it, % Custom subscription row(s). '
      'Nothing was changed. Ask the owner what each of them moves to, then re-run.',
      v_profiles, v_pending, v_subs;
  END IF;
END $$;

-- ── 2 · the value can no longer be written ───────────────────────────────────
ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_tier_state_not_custom;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_tier_state_not_custom CHECK (tier_state::text <> 'custom');

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_pending_tier_not_custom;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_pending_tier_not_custom CHECK (pending_tier IS NULL OR pending_tier::text <> 'custom');

ALTER TABLE public.vendor_subscriptions DROP CONSTRAINT IF EXISTS vendor_subscriptions_tier_not_custom;
ALTER TABLE public.vendor_subscriptions
  ADD CONSTRAINT vendor_subscriptions_tier_not_custom CHECK (tier::text <> 'custom');

COMMENT ON CONSTRAINT vendor_profiles_tier_state_not_custom ON public.vendor_profiles IS
  'The Custom supplier plan was retired from the app 2026-11-06 (owner: "from the app"). The enum label stays — Postgres cannot drop one — so this CHECK is what makes it unwritable. Do not drop it to "restore" Custom without the owner.';

-- ── 3 · the five Custom catalogue rows go off sale, for good ─────────────────
UPDATE public.vendor_billing_catalog
   SET is_active         = FALSE,
       retired_at        = COALESCE(retired_at, now()),
       retirement_reason = COALESCE(
         retirement_reason,
         'The Custom supplier plan was retired from the app 2026-11-06 (owner: "from the app"). Ultra''s add-ons replace it.'
       )
 WHERE sku_code IN (
     'vendor_custom_base',
     'vendor_custom_domain',
     'vendor_custom_event_slot',
     'vendor_custom_pipeline_unlimited',
     'vendor_custom_reach_nationwide'
   );

-- ── 4 · the ladder and the grid lose their Custom arms ───────────────────────
CREATE OR REPLACE FUNCTION public.vendor_tier_rank(p_tier public.vendor_tier_state)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  -- Mirrors TIER_RANK in apps/web/lib/vendor-tier-caps.ts (free 0 … enterprise 4),
  -- shifted by one so 0 stays reserved for "unrecognised". ELSE is for a value the
  -- ladder does not name — which now includes the retired Custom plan (2026-11-06) —
  -- and it ranks lowest, so it fails CLOSED (moving to it reads as a downgrade).
  SELECT CASE p_tier
           WHEN 'free'       THEN 1
           WHEN 'verified'   THEN 2
           WHEN 'solo'       THEN 3
           WHEN 'pro'        THEN 4
           WHEN 'enterprise' THEN 5
           ELSE 0
         END;
$$;

COMMENT ON FUNCTION public.vendor_tier_rank(public.vendor_tier_state) IS
  'Vendor value ladder, mirroring TIER_RANK in apps/web/lib/vendor-tier-caps.ts. Fixed 2026-08-09: solo and custom were absent and fell to ELSE 0, ranking them BELOW free — which made guard_vendor_tier_no_silent_downgrade refuse the free→solo upgrade outright. 2026-11-06: custom removed with the retired Custom plan; it now falls to ELSE 0 on purpose (and a CHECK refuses it anyway). Held in step with the TypeScript ladder by tests/db/vendor-tier-pipeline-caps.db.test.ts.';

CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_key
    WHEN 'whitelist_per_date' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 5   -- owner 2026-10-23: the same on every plan (was 1)
        WHEN 'verified'   THEN 5   -- (was 2)
        WHEN 'solo'       THEN 5   -- (was 3)
        WHEN 'pro'        THEN 5
        WHEN 'enterprise' THEN 5   -- (was 10)
        ELSE 5                     -- unknown tier reads as free (asVendorTier)
      END
    WHEN 'waitlist_acceptances' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0
        WHEN 'verified'   THEN 0   -- owner 2026-11-04 "waitlist 0,0,1,5" (was 1)
        WHEN 'solo'       THEN 0   -- (was 1)
        WHEN 'pro'        THEN 1   -- (was 3)
        WHEN 'enterprise' THEN 3   -- Ultra trimmed 2026-11-04 (was 5)
        ELSE 0
      END
    WHEN 'branches_included' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0   -- owner 2026-11-04 "branches 0,0,3,10"
        WHEN 'verified'   THEN 0
        WHEN 'solo'       THEN 0
        WHEN 'pro'        THEN 3
        WHEN 'enterprise' THEN 6   -- Ultra trimmed 2026-11-04 ("branches 0,0,3,10" said 10)
        ELSE 0
      END
    ELSE NULL                      -- unknown key: NULL, never a silent 0
  END;
$$;
COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Owner-set per-tier limits. Keys: whitelist_per_date (accepted-but-not-yet-locked customers a vendor may hold for ONE date — 5 on EVERY plan since 2026-10-23) · waitlist_acceptances (couples they may accept off the waitlist for one date — 0/0/0/1/3 since 2026-11-04, Ultra trimmed to 3) · branches_included (fee-free branches beyond the main shop — 0/0/0/3/6 since 2026-11-04, Ultra trimmed to 6). The retired Custom plan''s arms were removed 2026-11-06; an unknown TIER reads as Free. Mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts; held in step by tests/db/vendor-tier-pipeline-caps.db.test.ts and tests/db/vendor-plan-allowances.db.test.ts, which derive from the TS side. An unknown KEY returns NULL on purpose so a typo cannot read as an unlimited/zero cap.';

-- ── 5 · the Custom-only "no limit" axis goes, and its three callers stop asking ──
CREATE OR REPLACE FUNCTION public.enforce_vendor_whitelist_per_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled   BOOLEAN;
  v_tier      TEXT;
  v_cap       INT;
  v_date      DATE;
  v_precision TEXT;
  v_count     INT;
BEGIN
  SELECT COALESCE(ps.vendor_tier_pipeline_caps_enabled, FALSE)
    INTO v_enabled FROM public.platform_settings ps WHERE ps.id = 1;
  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN NEW;
  END IF;

  IF NEW.inquiry_status IS DISTINCT FROM 'accepted'::public.chat_inquiry_status THEN
    RETURN NEW;
  END IF;
  -- Only the transition INTO accepted; re-saving an accepted thread is not a
  -- new candidate and must never be refused. This is also why the whitelist
  -- half needs no grandfather clause: a customer already being chased is never
  -- re-counted, so switching the ceilings on cannot disturb work in flight.
  IF TG_OP = 'UPDATE'
     AND OLD.inquiry_status = 'accepted'::public.chat_inquiry_status THEN
    RETURN NEW;
  END IF;
  IF NEW.vendor_profile_id IS NULL OR NEW.event_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.event_date, e.event_date_precision INTO v_date, v_precision FROM public.events e WHERE e.event_id = NEW.event_id;
  -- No date chosen yet => nothing to scope a per-date cap to. Accept freely; the
  -- cap re-applies to any later accept once the couple picks their day.
  IF v_date IS NULL OR v_precision IS DISTINCT FROM 'day' THEN
    RETURN NEW;
  END IF;

  SELECT vp.tier_state::text INTO v_tier
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.vendor_profile_id;
  v_cap := public.vendor_tier_limit(v_tier, 'whitelist_per_date');
  IF v_cap IS NULL THEN
    RETURN NEW;  -- unknown key can never silently block a vendor inbox
  END IF;

  v_count := public.vendor_whitelist_used_for_date(
    NEW.vendor_profile_id, v_date, NEW.thread_id
  );

  IF v_count >= v_cap THEN
    RAISE EXCEPTION
      'WHITELIST_DATE_LIMIT: this plan lets you pursue % client(s) at a time for % (currently %)',
      v_cap, to_char(v_date, 'DD Mon YYYY'), v_count
      USING ERRCODE = 'check_violation',
            HINT = 'Lock one of them in, or decline someone, to free a slot - or upgrade for more.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vendor_whitelist_pressure(p_thread_id uuid)
 RETURNS TABLE(used integer, cap integer, event_date date, enforced boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_ids UUID[];
  v_vendor      UUID;
  v_event       UUID;
  v_date        DATE;
  v_precision   TEXT;
  v_tier        TEXT;
  v_cap         INT;
  v_enabled     BOOLEAN;
BEGIN
  SELECT array_agg(v) INTO v_profile_ids FROM public.current_vendor_profile_ids() AS v;
  IF v_profile_ids IS NULL OR array_length(v_profile_ids, 1) IS NULL THEN
    RETURN;  -- not a vendor -> no rows, and the caller draws nothing
  END IF;

  SELECT t.vendor_profile_id, t.event_id
    INTO v_vendor, v_event
    FROM public.chat_threads t
   WHERE t.thread_id = p_thread_id
     AND t.vendor_profile_id = ANY(v_profile_ids);
  IF v_vendor IS NULL OR v_event IS NULL THEN
    RETURN;  -- not this caller thread -> no rows
  END IF;

  SELECT e.event_date, e.event_date_precision INTO v_date, v_precision FROM public.events e WHERE e.event_id = v_event;
  IF v_date IS NULL OR v_precision IS DISTINCT FROM 'day' THEN
    RETURN;  -- no date chosen yet: the ceiling has nothing to scope to, and the
             -- trigger accepts freely, so the screen must promise nothing.
  END IF;

  SELECT vp.tier_state::text INTO v_tier
    FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_vendor;
  v_cap := public.vendor_tier_limit(v_tier, 'whitelist_per_date');
  IF v_cap IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(ps.vendor_tier_pipeline_caps_enabled, FALSE)
    INTO v_enabled FROM public.platform_settings ps WHERE ps.id = 1;

  RETURN QUERY SELECT
    public.vendor_whitelist_used_for_date(v_vendor, v_date, p_thread_id),
    v_cap,
    v_date,
    COALESCE(v_enabled, FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.clamp_vendor_waitlist_to_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled   BOOLEAN;
  v_cap       INT;
  v_touched   BOOLEAN;
BEGIN
  SELECT COALESCE(ps.vendor_tier_pipeline_caps_enabled, FALSE)
    INTO v_enabled FROM public.platform_settings ps WHERE ps.id = 1;
  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN NEW;
  END IF;

  v_cap := public.vendor_tier_limit(NEW.tier_state::text, 'waitlist_acceptances');
  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_cap = 0 THEN
    -- No waitlist on this plan AT ALL: not a number, a feature. Unconditional —
    -- grandfathering protects a number a supplier chose, never an allowance
    -- they have stopped paying for. The switch cannot be left on, and the
    -- number goes to 0 so nothing downstream reads a stale 1..3 and offers a
    -- CTA the vendor's plan does not include.
    NEW.waitlist_enabled := FALSE;
    NEW.max_waitlist_acceptances := 0;
    RETURN NEW;
  END IF;

  -- GRANDFATHER: only bind the ceiling to a number somebody is actually
  -- setting. TG_OP='UPDATE' with the column untouched leaves an above-ceiling
  -- value exactly as the supplier chose it.
  v_touched := (TG_OP <> 'UPDATE')
    OR (NEW.max_waitlist_acceptances IS DISTINCT FROM OLD.max_waitlist_acceptances);
  IF NOT v_touched THEN
    RETURN NEW;
  END IF;

  IF NEW.max_waitlist_acceptances > v_cap THEN
    NEW.max_waitlist_acceptances := v_cap;
  ELSIF NEW.max_waitlist_acceptances < 1 THEN
    -- A plan that HAS a waitlist always accepts at least one.
    NEW.max_waitlist_acceptances := 1;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.clamp_vendor_waitlist_to_tier() IS
  'Holds vendor_profiles.max_waitlist_acceptances inside the tier ceiling from vendor_tier_limit(). GRANDFATHERED 2026-08-29: the ceiling binds on INSERT and on an UPDATE that actually changes the number. The zero-allowance arm is unconditional: grandfathering protects a number, never a feature. (The Custom-only "no limit" arm was removed 2026-11-06 with the Custom plan.) Inert until platform_settings.vendor_tier_pipeline_caps_enabled.';

DROP FUNCTION IF EXISTS public.vendor_pipeline_is_unlimited(UUID);

-- ── 6 · the lapse forgets Custom ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sweep_vendor_tier_expiry(p_vendor_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
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
  'Login-driven, cron-free. Applies a PAID scheduled plan change the moment the current term runs out and RETURNS; otherwise reverts an expired solo/pro/enterprise tier to verified/free and EXPIRES any carried credit with it (owner 2026-08-28), leaving a vendor_credit_ledger row. A scheduled plan with no paid purchase behind it is dropped, never granted. Applying a scheduled change is NOT a lapse and never touches the balance. (Its Custom branches went 2026-11-06 with the Custom plan.)';

-- ── post-conditions — fail loudly rather than half-apply ─────────────────────
DO $$
DECLARE
  v_live  INT;
  v_body  TEXT;
BEGIN
  SELECT count(*) INTO v_live
    FROM public.vendor_billing_catalog
   WHERE sku_code LIKE 'vendor\_custom\_%' AND (is_active OR retired_at IS NULL);
  IF v_live <> 0 THEN
    RAISE EXCEPTION 'retire_the_custom_supplier_plan: % vendor_custom_* row(s) still on sale or not marked retired', v_live;
  END IF;

  IF to_regprocedure('public.vendor_pipeline_is_unlimited(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'retire_the_custom_supplier_plan: vendor_pipeline_is_unlimited still exists';
  END IF;

  FOREACH v_body IN ARRAY ARRAY[
    pg_get_functiondef('public.sweep_vendor_tier_expiry(uuid)'::regprocedure),
    pg_get_functiondef('public.vendor_tier_limit(text,text)'::regprocedure),
    pg_get_functiondef('public.vendor_tier_rank(public.vendor_tier_state)'::regprocedure),
    pg_get_functiondef('public.enforce_vendor_whitelist_per_date()'::regprocedure),
    pg_get_functiondef('public.vendor_whitelist_pressure(uuid)'::regprocedure),
    pg_get_functiondef('public.clamp_vendor_waitlist_to_tier()'::regprocedure)
  ] LOOP
    IF v_body ~ '''custom''' OR position('vendor_custom_plans' IN v_body) > 0 OR position('vendor_pipeline_is_unlimited' IN v_body) > 0 THEN
      RAISE EXCEPTION 'retire_the_custom_supplier_plan: a re-created function still reads the Custom plan: %', left(v_body, 120);
    END IF;
  END LOOP;

  -- The sweep must still expire the credit and still return before the lapse (20271286893359's own post-conditions).
  v_body := pg_get_functiondef('public.sweep_vendor_tier_expiry(uuid)'::regprocedure);
  IF position('subscription_credit_php = 0' IN v_body) = 0 OR position('RETURN;' IN v_body) = 0 THEN
    RAISE EXCEPTION 'retire_the_custom_supplier_plan: the lapse lost its credit rule or its early RETURN';
  END IF;
END $$;

COMMIT;
