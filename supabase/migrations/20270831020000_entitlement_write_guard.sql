-- ============================================================================
-- Entitlement write-guard triggers — a paying party must never self-grant a
-- paid tier (AUTHZ hardening).
--
-- ROOT CAUSE: three entitlement columns sit behind FOR-ALL / permissive RLS
-- policies scoped to the ENTITLED party, so the owner can grant their own paid
-- flag through a plain PostgREST write — RLS lets the row through, and nothing
-- checked the column. Both the UPDATE and the INSERT path are reachable:
--   • vendor_profiles.tier_state / tier_expires_at
--        (policy vendor_profiles_owner · migration 20260513120000 · FOR ALL,
--         USING/CHECK user_id = auth.uid(), no column/tier constraint). tier_state
--         is the whole subscription ladder; a self-write = a free
--         Enterprise/Custom tier. INSERT vector: DELETE the (UNIQUE user_id) row
--         and re-INSERT it with an elevated tier_state.
--   • vendor_custom_plans.status / composition
--        (policy vendor_custom_plans_vendor_access · migration 20270512705572 ·
--         FOR ALL, USING/CHECK vendor owns the row, no status constraint).
--         Moving a row to 'active' with a self-authored composition unlocks
--         arbitrary caps + paid /api/v1 (lib/vendor-effective-caps.ts +
--         lib/enterprise-vendor-gate.ts gate on an ACTIVE plan). INSERT vector:
--         POST a fresh row already at status='active' (the one-active partial
--         unique index does not block a vendor with no active plan yet).
--   • events.setnayan_ai_active
--        (UPDATE policy couple_can_update_event · migration 20260512000000 · FOR
--         UPDATE to couple|admin; INSERT policy authenticated_can_create_event ·
--         same migration · FOR INSERT WITH CHECK (TRUE)). The boolean IS the paid
--         Setnayan AI entitlement; a couple PATCH — or a couple POST of a fresh
--         event with the flag true — = free AI (read gate lib/setnayan-ai.ts
--         trusts the boolean, no paid-order cross-check).
--
-- FIX: BEFORE INSERT OR UPDATE row triggers that RAISE when a DIRECT end-user
-- write sets/changes a guarded column. INSERT coverage is load-bearing: every
-- guarded column sits behind a FOR-ALL (or WITH CHECK(TRUE)) RLS policy, so an
-- UPDATE-only guard is trivially bypassed by writing the entitlement at INSERT
-- time instead — e.g. a couple POSTing a fresh event with setnayan_ai_active=true
-- (authenticated_can_create_event · WITH CHECK(TRUE)), a vendor POSTing a
-- vendor_custom_plans row already at status='active', or a vendor
-- DELETE+re-INSERTing their vendor_profiles row with an elevated tier_state.
-- The triggers are SECURITY INVOKER (the default) so `current_user` reflects the
-- EFFECTIVE Postgres role of the write:
--
--   • Direct PostgREST PATCH from a browser  → current_user = 'authenticated'
--     (or 'anon')                            → BLOCKED (unless is_admin()).
--   • Service-role admin client
--     (lib/supabase/admin.ts · the paid       → current_user = 'service_role'
--     activation path lib/sku-activation.ts)  → ALLOWED.
--   • SECURITY DEFINER server RPCs that       → current_user = the function
--     legitimately move the tier — e.g.          owner (NOT a PostgREST role)
--     public.sweep_vendor_tier_expiry (the    → ALLOWED.
--     login-driven lapse sweep, invoked by
--     an AUTHENTICATED vendor from
--     app/vendor-dashboard/layout.tsx) and
--     public._apply_subscription_credit
--     (subscription checkout family,
--     migration 20261010000000).
--   • An admin acting from their own          → is_admin() = TRUE → ALLOWED.
--     authenticated session.
--
-- WHY current_user AND NOT auth.role(): auth.role() reads the JWT `role` claim,
-- which STAYS 'authenticated' inside a SECURITY DEFINER function — so gating on
-- auth.role() would break sweep_vendor_tier_expiry (a live authenticated-invoked
-- SECURITY DEFINER writer of tier_state, called on every vendor dashboard load)
-- and lock vendors out of the auto-lapse. current_user is elevated to the
-- function owner under SECURITY DEFINER, so it distinguishes "raw end-user
-- PATCH" from "vetted server path" exactly. Verified: every legitimate writer of
-- these columns is either the service-role client, a SECURITY DEFINER RPC, or an
-- admin — see the WHY block above and the code audit in the PR.
--
-- vendor_custom_plans is TRANSITION-AWARE, not a blanket block: the vendor path
-- app/vendor-dashboard/subscription/custom/actions.ts (requestCustomPlan)
-- LEGITIMATELY updates its OWN non-active row's composition + status to
-- 'pending_payment' via the authenticated client. Only two moves are forbidden
-- to a non-privileged writer: (1) moving a plan INTO 'active' (the entitlement
-- grant), and (2) mutating the composition/status of an ALREADY-active plan (the
-- live caps overlay). Both are admin/service/definer-only.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_profiles.tier_state / tier_expires_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_vendor_profiles_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      -- A non-privileged writer may only create a row at the 'free' default with
      -- no expiry. Legitimate registration (app/open-shop/actions.ts) inserts
      -- {user_id} only via the service-role admin client, so this never fires on
      -- the real path; it closes the DELETE+re-INSERT self-elevation vector.
      IF NEW.tier_state IS DISTINCT FROM 'free'::public.vendor_tier_state
         OR NEW.tier_expires_at IS NOT NULL
      THEN
        RAISE EXCEPTION
          'vendor_profiles.tier_state/tier_expires_at is not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier changes go through the admin console or the paid activation path (service_role).';
      END IF;
    ELSE  -- UPDATE
      IF NEW.tier_state IS DISTINCT FROM OLD.tier_state
         OR NEW.tier_expires_at IS DISTINCT FROM OLD.tier_expires_at
      THEN
        RAISE EXCEPTION
          'vendor_profiles.tier_state/tier_expires_at is not writable by the vendor (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Tier changes go through the admin console or the paid activation path (service_role).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vendor_profiles_entitlement ON public.vendor_profiles;
CREATE TRIGGER trg_guard_vendor_profiles_entitlement
  BEFORE INSERT OR UPDATE ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_vendor_profiles_entitlement();

-- ----------------------------------------------------------------------------
-- 2. vendor_custom_plans.status / composition  (transition-aware)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_vendor_custom_plans_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      -- A non-privileged writer may never CREATE an already-active plan — that is
      -- the same paid-tier grant as an active-transition, just via INSERT. The
      -- one-active partial-unique index does NOT block a vendor who holds no
      -- active plan yet, so it cannot substitute for this guard. Legitimate
      -- requestCustomPlan (subscription/custom/actions.ts) inserts
      -- status='pending_payment', never 'active', so this never fires on the real
      -- path.
      IF NEW.status = 'active' THEN
        RAISE EXCEPTION
          'vendor_custom_plans cannot be self-activated (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'A Custom plan goes active only via the admin activation / paid approval path.';
      END IF;
    ELSE  -- UPDATE
      -- (1) Self-activation: a non-privileged writer may never move a plan INTO
      --     'active' (that is the paid-tier grant read by the caps overlay + the
      --     /api/v1 gate).
      IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION
          'vendor_custom_plans cannot be self-activated (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'A Custom plan goes active only via the admin activation / paid approval path.';
      END IF;
      -- (2) Tampering with a LIVE plan: never mutate the composition or status of
      --     an already-active plan (would rewrite live caps or silently demote it).
      IF OLD.status = 'active'
         AND (NEW.composition IS DISTINCT FROM OLD.composition
               OR NEW.status IS DISTINCT FROM OLD.status)
      THEN
        RAISE EXCEPTION
          'an active vendor_custom_plan is not vendor-writable (composition/status locked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Adjust a Custom plan by requesting a NEW plan; the admin re-quotes and re-activates.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vendor_custom_plans_entitlement ON public.vendor_custom_plans;
CREATE TRIGGER trg_guard_vendor_custom_plans_entitlement
  BEFORE INSERT OR UPDATE ON public.vendor_custom_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_vendor_custom_plans_entitlement();

-- ----------------------------------------------------------------------------
-- 3. events.setnayan_ai_active
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_events_ai_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    -- On INSERT (OLD is NULL) the flag must arrive false — only a set-to-TRUE is
    -- a self-grant. On UPDATE, any change is blocked. Normal authenticated event
    -- creation (create-event / onboarding) never sets this column, so an ordinary
    -- POST (flag defaults false) passes; the paid activation path writes it as
    -- service_role and is unaffected.
    IF TG_OP = 'INSERT' THEN
      IF NEW.setnayan_ai_active THEN
        RAISE EXCEPTION
          'events.setnayan_ai_active is a paid entitlement and is not writable by the couple (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'The flag is set only by the paid SETNAYAN_AI activation path (service_role).';
      END IF;
    ELSE  -- UPDATE
      IF NEW.setnayan_ai_active IS DISTINCT FROM OLD.setnayan_ai_active THEN
        RAISE EXCEPTION
          'events.setnayan_ai_active is a paid entitlement and is not writable by the couple (self-grant blocked)'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'The flag is set only by the paid SETNAYAN_AI activation path (service_role).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_events_ai_entitlement ON public.events;
CREATE TRIGGER trg_guard_events_ai_entitlement
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_events_ai_entitlement();

-- ----------------------------------------------------------------------------
-- 4. Post-conditions — assert the guard actually attached (fail loudly rather
--    than half-apply, mirroring 20270828140000_papic_one_tiers.sql).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname = 'trg_guard_vendor_profiles_entitlement'
      AND tgrelid = 'public.vendor_profiles'::regclass
  ) THEN
    v_missing := array_append(v_missing, 'vendor_profiles');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname = 'trg_guard_vendor_custom_plans_entitlement'
      AND tgrelid = 'public.vendor_custom_plans'::regclass
  ) THEN
    v_missing := array_append(v_missing, 'vendor_custom_plans');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname = 'trg_guard_events_ai_entitlement'
      AND tgrelid = 'public.events'::regclass
  ) THEN
    v_missing := array_append(v_missing, 'events');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'entitlement write-guard failed to attach on: %', array_to_string(v_missing, ', ');
  END IF;
END $$;

COMMIT;
