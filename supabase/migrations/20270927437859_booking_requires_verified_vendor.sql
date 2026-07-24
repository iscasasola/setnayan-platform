-- ============================================================================
-- 20270927437859_booking_requires_verified_vendor.sql
-- Booking requires a VERIFIED vendor — DB-level hard guard (owner 2026-07-24).
--
-- OWNER RULE (2026-07-24): "they can only book customers if they are verified."
-- A couple may only BOOK / LOCK a marketplace vendor once that vendor's
-- vendor_profiles.verification_state = 'verified'. This is the gate that makes
-- the "first N booked customers free → then 5%" model apply only to real,
-- verified businesses (verification now requires DTI + business permit — the
-- registration-number work in 20270925937630).
--
-- WHY A DB TRIGGER (defense-in-depth): the app has SEVERAL write paths that flip
-- an event_vendors row into a confirmed status —
--   • finalizeVendor (the compare-drawer lock · UPDATE + the slot-acquire RPC)
--   • completeVendorPickFromMarketplace / lockBoothToEvent (wizard · INSERT)
--   • lockPackage (package cascade · INSERT)
--   • the vendor_service_time_slots acquire RPC (UPDATE inside its own lock)
-- Each app path also carries a friendly pre-check, but this trigger is the ONE
-- choke point that no path (present or future) can bypass.
--
-- WHAT COUNTS AS A BOOKING: status ∈ CONFIRMED_VENDOR_STATUSES
-- ('contracted','deposit_paid','delivered','complete') — mirrors lib/events.ts.
--
-- SCOPE / GRANDFATHERING (critical):
--   • Only MARKETPLACE vendors are gated (marketplace_vendor_id IS NOT NULL).
--     Off-platform / manual vendors carry no verification concept → never gated.
--   • Only the TRANSITION INTO a confirmed status is checked:
--       INSERT → NEW.status is confirmed
--       UPDATE → NEW.status is confirmed AND OLD.status was NOT confirmed
--     So an already-locked row (contracted → deposit_paid → delivered → …), or
--     any other edit of an already-confirmed row, is NEVER re-checked. Existing
--     contracted rows whose vendor is (or later becomes) unverified are left
--     untouched — the guard only blocks NEW locks.
--
-- RACE: the check reads verification_state in the SAME transaction as the write,
-- so a verified→demoted flip that lands before the lock commits blocks it (fresh
-- read); a demotion AFTER the lock is grandfathered (no re-check). No TOCTOU.
--
-- SECURITY DEFINER: public RLS on vendor_profiles is verified-only, so a couple
-- can't read a non-verified profile's row directly. The function reads the true
-- state regardless (locked search_path). It only READS vendor_profiles.
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
  v_state TEXT;
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

  SELECT vp.verification_state::text
    INTO v_state
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.marketplace_vendor_id;

  -- Missing profile or any non-verified state → block (fail-closed).
  IF v_state IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION
      'vendor_not_verified: this vendor must be verified before it can be booked (marketplace_vendor_id=%, state=%)',
      NEW.marketplace_vendor_id, COALESCE(v_state, 'missing')
      USING ERRCODE = 'check_violation',
            HINT = 'The vendor must complete verification (DTI + business permit) before a couple can lock them.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_booking_requires_verified_vendor() IS
  'Owner 2026-07-24: a MARKETPLACE vendor can only be booked/locked (event_vendors.status → contracted/deposit_paid/delivered/complete) once vendor_profiles.verification_state = ''verified''. Fires only on the transition INTO a confirmed status (grandfathers existing locks). Off-platform vendors (marketplace_vendor_id IS NULL) are never gated.';

DROP TRIGGER IF EXISTS event_vendors_require_verified_before_lock ON public.event_vendors;

CREATE TRIGGER event_vendors_require_verified_before_lock
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_requires_verified_vendor();
