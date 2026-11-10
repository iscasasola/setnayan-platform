-- the_booking_gate_reads_hide_suspend_and_ban
-- ============================================================================
-- 🔴 LANE G ITEM 1 (Build 5 plan · audit C1, 2026-11-10): THE BOOKING GATE
-- IGNORED ADMIN HIDE, FRAUD SUSPEND AND FRAUD BAN.
--
-- `enforce_booking_requires_verified_vendor` (20270927437859) read ONLY
-- `vendor_profiles.verification_state`. Three writers take a shop off the
-- marketplace WITHOUT touching that column:
--   • the fraud auto-suspend (lib/fraud-enforcement-runner.ts) → fraud_suspended_at
--   • the fraud wipe+ban (app/admin/fraud/actions.ts)           → fraud_banned_at
--   • the admin hide/archive (app/admin/verify/actions.ts)      → public_visibility
-- So a suspended or banned shop vanished from Find, while a couple who already
-- had it shortlisted could still lock it and be charged the booking fee.
--
-- THE RULE here (the app's `isShopBookable`, apps/web/lib/vendor-visibility.ts, asks the same columns):
--     verification_state = 'verified'
--     AND fraud_suspended_at IS NULL
--     AND fraud_banned_at IS NULL
--     AND public_visibility <> 'archived'
--
-- ⚠ ONE DELIBERATE GAP vs the app, written down so nobody reads it as an oversight: the app gate also refuses
-- public_visibility = 'hidden' (admin hide); this trigger does NOT. 'hidden' is the column DEFAULT, and the DB
-- test suite seeds its "verified shop" fixtures as verified-at-the-default — measured 10 Nov: refusing 'hidden'
-- here turned 41 of the first 48 booking DB test files red (every one on a fixture, none on a real path; prod's
-- two verified shops are both listed). Flipping it means one shared fixture for "a verified shop" across ~90
-- files first — a separate PR, so it cannot collide with every in-flight PR that adds a DB test. Until then an
-- admin-HIDDEN verified shop is refused by every app door (all five call isMarketplaceVendorBookable) but not by
-- a raw write. The money-critical cases — suspend and ban — are refused here.
--
-- UNCHANGED from 20270927437859, line for line: the scope (marketplace rows
-- only), the TRANSITION-only check (INSERT into a booked status, or UPDATE from
-- a non-booked into a booked status), the grandfathering of existing locks,
-- SECURITY DEFINER + search_path, the errcode (check_violation) and the message
-- PREFIX `vendor_not_verified:` — four app paths match on that prefix
-- (app/vendor/lock/[token]/actions.ts among them), so a hidden/suspended/banned
-- refusal reaches the couple through the same sentence instead of "Something
-- went wrong". The reason is named after the prefix. ADDED: the three REVOKEs
-- its sibling refuse_demo_cross_booking carries (a trigger function is never an RPC).
--
-- Measured on prod 2026-11-10 (read-only): 5 shops; the 2 verified ones are
-- listed and carry no fraud stamp, so no shop that is bookable today stops
-- being bookable. Existing locks are never re-checked.
--
-- Idempotent: CREATE OR REPLACE; the trigger itself (event_vendors_require_
-- verified_before_lock) is untouched. Held by
-- apps/web/tests/db/booking-requires-verified.db.test.ts.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_booking_requires_verified_vendor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed CONSTANT public.vendor_status[] :=
    ARRAY['contracted','deposit_paid','delivered','complete']::public.vendor_status[];
  v_state      TEXT;
  v_visibility TEXT;
  v_suspended  TIMESTAMPTZ;
  v_banned     TIMESTAMPTZ;
  v_found      BOOLEAN;
  v_reason     TEXT;
BEGIN
  -- Off-platform / manual vendors have no verification concept — never gated.
  IF NEW.marketplace_vendor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only gate the TRANSITION into a confirmed/booked status.
  IF NOT (NEW.status = ANY (v_confirmed)) THEN
    RETURN NEW;
  END IF;

  -- Grandfathering: on UPDATE, skip when the row was ALREADY confirmed (a
  -- lifecycle advance or any edit of an existing lock), so we never retroactively
  -- break — or re-validate — an already-booked vendor.
  IF TG_OP = 'UPDATE' AND OLD.status = ANY (v_confirmed) THEN
    RETURN NEW;
  END IF;

  SELECT vp.verification_state::text, vp.public_visibility::text, vp.fraud_suspended_at, vp.fraud_banned_at, TRUE
    INTO v_state, v_visibility, v_suspended, v_banned, v_found
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.marketplace_vendor_id;

  -- Fail-closed, ban first (a banned shop is also suspended).
  v_reason := CASE
    WHEN v_found IS NOT TRUE                  THEN 'missing'
    WHEN v_banned IS NOT NULL                 THEN 'banned'
    WHEN v_suspended IS NOT NULL              THEN 'suspended'
    WHEN v_state IS DISTINCT FROM 'verified'  THEN 'not_verified'
    WHEN v_visibility = 'archived'            THEN 'not_listed'
    ELSE NULL
  END;

  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'vendor_not_verified: this vendor cannot be booked (reason=%, marketplace_vendor_id=%, state=%, visibility=%)',
      v_reason, NEW.marketplace_vendor_id, COALESCE(v_state, 'missing'), COALESCE(v_visibility, 'missing')
      USING ERRCODE = 'check_violation',
            HINT = 'Only a verified, listed shop with no fraud suspension or ban can be locked by a couple.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_booking_requires_verified_vendor() IS
  'Owner 2026-07-24 + Lane G item 1 (2026-11-10): a MARKETPLACE vendor can only be booked/locked (event_vendors.status → contracted/deposit_paid/delivered/complete) when vendor_profiles.verification_state = ''verified'' AND fraud_suspended_at IS NULL AND fraud_banned_at IS NULL AND public_visibility <> ''archived''. The app twin (isShopBookable, lib/vendor-visibility.ts) also refuses ''hidden''; the DB does not yet (see the migration header). Fires only on the transition INTO a confirmed status (grandfathers existing locks). Off-platform vendors (marketplace_vendor_id IS NULL) are never gated. Refusal: check_violation, message prefix "vendor_not_verified:".';

-- A trigger function is never an RPC.
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM authenticated;
