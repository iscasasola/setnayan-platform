-- ============================================================================
-- SEC-5 — a host must not be able to RE-PRICE Setnayan AI by editing their own
-- event's `event_type` after the money is committed.
--
-- ROOT CAUSE (three facts that only bite together):
--
--   1. Setnayan AI is priced BY EVENT TYPE (owner-locked 2026-07-22, the
--      load-based ladder A ₱1,499 / B ₱999 / C ₱499 / D ₱99 / E ₱0 —
--      lib/setnayan-ai-type-pricing.ts). This is DELIBERATE product design and
--      is NOT what this migration changes.
--
--   2. The charge is resolved from `events.event_type` read LIVE at checkout
--      (lib/setnayan-ai-event-pricing.ts · resolveSetnayanAiTypeChargeCentavos),
--      and the DELIVERED tier — which vendor categories Setnayan AI reaches —
--      is likewise re-derived from the live `event_type` on every read. The
--      entitlement itself (`events.setnayan_ai_active`) is a bare BOOLEAN: it
--      records THAT the couple bought AI, never WHICH TIER they bought.
--
--   3. `event_type` is column-GRANTed to `authenticated` (and `anon`) by
--      20271005100000 — correctly so: the creation wizard writes it and a host
--      fixing a mis-picked type before paying anything is normal, supported
--      behaviour. But that means a host can PATCH it straight through PostgREST
--      with the public anon key, bypassing every server action.
--
--   ⇒ ATTACK: set event_type to a cheap tier → buy Setnayan AI at ₱99 → set it
--     back to `wedding` → keep wedding-tier AI (₱1,499 of reach) forever. Under
--     apply-then-pay the window is wide open: the order sits in `submitted` /
--     `awaiting_payment` for up to the 24-hr manual-reconciliation SLA, so the
--     type can be flipped back BEFORE the admin ever approves it.
--
-- WHAT THIS MIGRATION DOES *NOT* DO: it does not flatten the ladder, remove the
-- tier map, or make Setnayan AI one price. Per-event-type pricing is the
-- business model and it stays. The defect is narrower — the BUYER controls the
-- input to the price and can keep changing it after paying — and that is all
-- that is fixed here.
--
-- THE FIX — two halves, both at the DATA layer (a server action is bypassed by
-- a direct PATCH, so a server-side check would be theatre):
--
--   (A) SNAPSHOT the tier at purchase. `events.setnayan_ai_tier_at_purchase`
--       is stamped by a trigger the moment the paid entitlement turns on, so
--       the entitlement finally records WHICH tier was bought instead of
--       silently inheriting whatever the live type says today.
--
--   (B) FREEZE the pricing input across a tier boundary once money is
--       committed. A non-privileged writer may not change `event_type` to a
--       type in a DIFFERENT price tier while the event holds a paid — or an
--       in-flight, not-yet-reconciled — Setnayan AI order.
--
--       • SAME-tier changes stay ALLOWED (birthday → celebration, both C):
--         nothing about the money moves, and blocking them would be a tax on a
--         legitimate correction.
--       • Type changes BEFORE any AI order stay ALLOWED — untouched. Onboarding
--         and "I picked the wrong type" are unaffected; this trigger no-ops for
--         every event that has never bought Setnayan AI.
--       • CHEAPER → DEARER (a genuine upgrade) is refused CLEANLY rather than
--         charged. TODO(owner): an upgrade-charge flow — quote the tier delta,
--         take payment, then let the admin/service path move the type — is
--         legitimate product behaviour, but billing for it is deliberately NOT
--         built here.
--
-- Together, (A) + (B) make the live re-derivation in fact 2 SAFE: while the
-- input cannot cross a tier boundary after purchase, "the tier we deliver
-- today" is provably still "the tier they paid for". (A) is what makes that
-- auditable, and what a future upgrade-charge flow needs to compute a delta.
--
-- PRIVILEGE MODEL — mirrors 20270920020000_entitlement_write_guard.sql exactly:
-- the trigger is SECURITY INVOKER, so `current_user` is the EFFECTIVE Postgres
-- role. A raw PostgREST PATCH from a browser is 'authenticated'/'anon' → guarded.
-- The service-role admin client, SECURITY DEFINER RPCs, and an admin acting from
-- their own session (public.is_admin()) are all ALLOWED — admins must stay able
-- to correct a mis-typed event, and that is the documented escape hatch for the
-- upgrade case until the charge flow exists.
--
-- ⚠ TIER-MAP PARITY: public.setnayan_ai_price_tier() below is a MIRROR of
-- AI_TIER_BY_EVENT_TYPE in apps/web/lib/setnayan-ai-type-pricing.ts. The two
-- must never drift — a DB test
-- (apps/web/tests/db/setnayan-ai-tier-lock.db.test.ts) asserts key-by-key that
-- they agree, including the default for an unmapped type.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The tier ladder, in SQL. Pure classification (type → tier), never a price:
--    the AMOUNTS live in platform_retail_catalog_v2 (admin-managed, owner rule
--    "prices are catalog-authoritative, never hardcoded"). Only the tier
--    ASSIGNMENT — product config — lives in code, and it must exist in SQL too
--    because the guard runs in the database.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.setnayan_ai_price_tier(p_event_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_event_type
    WHEN 'wedding'       THEN 'A'  -- ₱1,499
    WHEN 'debut'         THEN 'B'  -- ₱999
    WHEN 'corporate'     THEN 'B'
    WHEN 'gala_night'    THEN 'B'  -- 84% reach is Debut-level (owner 2026-07-22)
    WHEN 'christening'   THEN 'C'  -- ₱499
    WHEN 'birthday'      THEN 'C'
    WHEN 'celebration'   THEN 'C'
    WHEN 'travel'        THEN 'C'  -- kept at C for the itinerary engine
    WHEN 'anniversary'   THEN 'C'
    WHEN 'graduation'    THEN 'C'
    WHEN 'reunion'       THEN 'C'
    WHEN 'tournament'    THEN 'D'  -- ₱99 (dropped C→D, owner 2026-07-22)
    WHEN 'gender_reveal' THEN 'D'
    WHEN 'date'          THEN 'D'
    WHEN 'hangout'       THEN 'D'
    WHEN 'simple_event'  THEN 'E'  -- ₱0 · no vendors → Setnayan AI isn't present
    -- Unmapped / NULL → 'C', the safe middle (matches AI_TIER_DEFAULT). A
    -- brand-new event type is then neither over- nor under-charged, and — the
    -- part that matters here — a couple can never dodge the guard by moving to
    -- a type nobody has tiered yet.
    ELSE 'C'
  END;
$$;

COMMENT ON FUNCTION public.setnayan_ai_price_tier(TEXT) IS
  'Setnayan AI price tier (A-E) for an event type. SQL mirror of '
  'AI_TIER_BY_EVENT_TYPE in apps/web/lib/setnayan-ai-type-pricing.ts; parity is '
  'asserted by tests/db/setnayan-ai-tier-lock.db.test.ts. Classification only - '
  'the amounts live in platform_retail_catalog_v2.';

-- ----------------------------------------------------------------------------
-- 2. The purchase-time tier SNAPSHOT.
--
--    No GRANT is issued for this column, and 20271005100000 revoked table-level
--    UPDATE/INSERT on public.events from authenticated + anon — so a column
--    added AFTER that migration is un-writable by those roles by construction
--    (Postgres column privileges are enumerated at GRANT time; a new column
--    inherits nothing). The trigger in §3b still refuses a non-privileged write
--    explicitly, so the protection does not rest on that subtlety alone.
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS setnayan_ai_tier_at_purchase TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_setnayan_ai_tier_at_purchase_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_setnayan_ai_tier_at_purchase_check
      CHECK (setnayan_ai_tier_at_purchase IS NULL
             OR setnayan_ai_tier_at_purchase IN ('A','B','C','D','E'));
  END IF;
END $$;

-- Explicit and idempotent. A column added after 20271005100000 inherits no
-- privilege anyway (that migration revoked table-level UPDATE/INSERT from the
-- API roles), so this is belt-and-braces — it states the intent in the file that
-- introduces the column rather than leaving it implied by another migration.
REVOKE UPDATE (setnayan_ai_tier_at_purchase), INSERT (setnayan_ai_tier_at_purchase)
  ON public.events FROM authenticated, anon;

COMMENT ON COLUMN public.events.setnayan_ai_tier_at_purchase IS
  'SEC-5: the Setnayan AI price tier (A-E) this event''s entitlement was BOUGHT '
  'at, stamped by trg_stamp_events_ai_tier_at_purchase when setnayan_ai_active '
  'first turns true. The entitlement boolean alone records THAT AI was bought, '
  'never at which tier - without this the delivered tier is whatever the live '
  'event_type happens to say. Not writable by authenticated/anon.';

-- ----------------------------------------------------------------------------
-- 3a. THE GUARD — refuse a tier-crossing event_type change once an AI order
--     exists.
--
--     "An AI order exists" deliberately includes IN-FLIGHT orders (submitted /
--     awaiting_payment), not just paid/fulfilled ones. Under apply-then-pay the
--     reconciliation window IS the attack window: charge locks in when the order
--     is created, activation happens up to 24 hrs later. A guard that waited for
--     'paid' would leave the whole window open. 'draft' is excluded — nothing is
--     committed. cancelled / refunded / lapsed release the lock, so a couple
--     whose order fell through is free again.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_events_ai_price_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_tier TEXT;
  v_new_tier TEXT;
  v_has_ai   BOOLEAN;
BEGIN
  -- Only a real type change matters, and only for non-privileged writers.
  IF NEW.event_type IS NOT DISTINCT FROM OLD.event_type THEN
    RETURN NEW;
  END IF;
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Does this event hold a Setnayan AI entitlement, or money in flight for one?
  --
  -- The order must have been placed by someone who actually BELONGS to the
  -- event. `orders_owner_write` is only `WITH CHECK (user_id = auth.uid())` —
  -- it never checks that `event_id` is yours — so without this any
  -- authenticated stranger could POST a SETNAYAN_AI order pointed at a victim's
  -- event and freeze their event type. (The underlying orders-INSERT hole is
  -- SEC-4's deferred item; this keeps the SEC-5 guard from becoming a lever for
  -- it.) A real checkout always satisfies this: the buyer is the host or a
  -- co-host. A non-member buyer simply does not arm the in-flight lock — the
  -- entitlement branch above still locks the moment the order is activated.
  v_has_ai := COALESCE(OLD.setnayan_ai_active, FALSE);
  IF NOT v_has_ai THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.orders o
        JOIN public.event_members m
          ON m.event_id = o.event_id
         AND m.user_id  = o.user_id
       WHERE o.event_id = OLD.event_id
         AND o.service_key = 'SETNAYAN_AI'
         AND o.status::TEXT IN ('submitted', 'awaiting_payment', 'paid', 'fulfilled')
    ) INTO v_has_ai;
  END IF;

  IF NOT v_has_ai THEN
    -- The common case: no AI purchased, no AI in flight. Re-typing an event is
    -- a normal, supported correction — pass straight through.
    RETURN NEW;
  END IF;

  -- The tier the entitlement was BOUGHT at. Prefer the stamped snapshot; fall
  -- back to the tier of the type the event is leaving, which is the type the
  -- charge was resolved from (this guard is what keeps that true — the type
  -- cannot have crossed a tier since the order was created).
  v_old_tier := COALESCE(
    OLD.setnayan_ai_tier_at_purchase,
    public.setnayan_ai_price_tier(OLD.event_type)
  );
  v_new_tier := public.setnayan_ai_price_tier(NEW.event_type);

  IF v_new_tier IS DISTINCT FROM v_old_tier THEN
    RAISE EXCEPTION
      'event_type cannot move from Setnayan AI price tier % to tier % — this event has a paid or in-flight Setnayan AI order (event %)',
      v_old_tier, v_new_tier, OLD.event_id
      USING ERRCODE = 'insufficient_privilege',
            HINT = 'Setnayan AI is priced by event type. Changing type across a price tier after buying would re-price what was already sold. A same-tier change is allowed; anything else needs Setnayan support (an upgrade is quoted and charged, not switched).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_events_ai_price_tier ON public.events;
CREATE TRIGGER trg_guard_events_ai_price_tier
  BEFORE UPDATE OF event_type ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_events_ai_price_tier();

-- ----------------------------------------------------------------------------
-- 3b. THE SNAPSHOT STAMP — record the purchased tier when the entitlement turns
--     on, and refuse a non-privileged write of the snapshot column itself.
--
--     Runs for EVERY role (the activation path is service_role, and that is
--     precisely the write we want to observe), so the stamp can never be
--     forgotten by a code path that flips the flag some other way.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stamp_events_ai_tier_at_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- The snapshot is a derived audit fact, never end-user input.
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.setnayan_ai_tier_at_purchase IS NOT NULL THEN
        RAISE EXCEPTION
          'events.setnayan_ai_tier_at_purchase is derived at purchase and is not writable by the couple'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSIF NEW.setnayan_ai_tier_at_purchase IS DISTINCT FROM OLD.setnayan_ai_tier_at_purchase THEN
      RAISE EXCEPTION
        'events.setnayan_ai_tier_at_purchase is derived at purchase and is not writable by the couple'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- Stamp on the false → true transition of the paid entitlement, once. Never
  -- overwrite an existing snapshot: a re-activation (a renewal, a re-approval)
  -- must not silently re-baseline the tier to whatever the type says now.
  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.setnayan_ai_active, FALSE)
     AND NOT COALESCE(OLD.setnayan_ai_active, FALSE)
     AND NEW.setnayan_ai_tier_at_purchase IS NULL
  THEN
    NEW.setnayan_ai_tier_at_purchase := public.setnayan_ai_price_tier(NEW.event_type);
  END IF;

  RETURN NEW;
END;
$$;

-- Named so it sorts AFTER trg_guard_events_ai_price_tier: same-timing triggers
-- fire in name order, and the guard must read the PRE-stamp state.
DROP TRIGGER IF EXISTS trg_stamp_events_ai_tier_at_purchase ON public.events;
CREATE TRIGGER trg_stamp_events_ai_tier_at_purchase
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_events_ai_tier_at_purchase();

-- ----------------------------------------------------------------------------
-- 4. Backfill — stamp the tier for events that ALREADY hold the entitlement.
--    Their type has not been guarded until now, so the best available evidence
--    is the current type; recording it at least freezes them from here on
--    instead of leaving the snapshot NULL forever.
-- ----------------------------------------------------------------------------
UPDATE public.events
   SET setnayan_ai_tier_at_purchase = public.setnayan_ai_price_tier(event_type)
 WHERE setnayan_ai_active IS TRUE
   AND setnayan_ai_tier_at_purchase IS NULL;

-- ----------------------------------------------------------------------------
-- 5. Post-conditions — fail loudly rather than half-apply.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_problems TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE NOT tgisinternal
       AND tgname = 'trg_guard_events_ai_price_tier'
       AND tgrelid = 'public.events'::regclass
  ) THEN
    v_problems := array_append(v_problems, 'trg_guard_events_ai_price_tier did not attach');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE NOT tgisinternal
       AND tgname = 'trg_stamp_events_ai_tier_at_purchase'
       AND tgrelid = 'public.events'::regclass
  ) THEN
    v_problems := array_append(v_problems, 'trg_stamp_events_ai_tier_at_purchase did not attach');
  END IF;

  -- The ladder itself — if these ever stop holding, the guard is comparing
  -- tiers nobody agreed to.
  IF public.setnayan_ai_price_tier('wedding') <> 'A'
     OR public.setnayan_ai_price_tier('debut') <> 'B'
     OR public.setnayan_ai_price_tier('birthday') <> 'C'
     OR public.setnayan_ai_price_tier('gender_reveal') <> 'D'
     OR public.setnayan_ai_price_tier('simple_event') <> 'E'
     OR public.setnayan_ai_price_tier('a_type_that_does_not_exist') <> 'C'
     OR public.setnayan_ai_price_tier(NULL) <> 'C'
  THEN
    v_problems := array_append(v_problems, 'setnayan_ai_price_tier does not match the locked ladder');
  END IF;

  -- The snapshot column must NOT be column-GRANTed to the API roles.
  --
  -- Guarded by the table-level check: Postgres cannot subtract a column from a
  -- TABLE-level grant, so where authenticated still holds table-wide UPDATE
  -- (the PGlite replay harness issues a blanket GRANT ALL to emulate Supabase
  -- default privileges) a column assertion is meaningless and would fail for
  -- the wrong reason. In prod 20271005100000 revoked table-level UPDATE, so the
  -- assertion is live and this catches a future stray column GRANT. Either way
  -- the §3b trigger — which no grant can bypass — is the real enforcement.
  IF NOT has_table_privilege('authenticated', 'public.events', 'UPDATE')
     AND (has_column_privilege('authenticated', 'public.events', 'setnayan_ai_tier_at_purchase', 'UPDATE')
          OR has_column_privilege('anon', 'public.events', 'setnayan_ai_tier_at_purchase', 'UPDATE'))
  THEN
    v_problems := array_append(v_problems, 'setnayan_ai_tier_at_purchase is UPDATE-grantable to an API role');
  END IF;

  IF array_length(v_problems, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'SEC-5 tier lock failed: %', array_to_string(v_problems, '; ');
  END IF;
END $$;

COMMIT;
