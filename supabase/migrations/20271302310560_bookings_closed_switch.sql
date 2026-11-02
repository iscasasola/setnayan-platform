-- bookings_closed_switch
-- ============================================================================
-- BOOKINGS ARE CLOSED AT LAUNCH — one DB switch, the admin flips it.
--
-- OWNER (2026-11-02, supplier gate): *"for now, they cannot add bookings. just
-- create their websites and cater our event if they are part of the event"*.
--
-- Until this file the only wall in front of a booking was verification
-- (`enforce_booking_requires_verified_vendor`, 20270927437859): the moment an
-- admin approved a shop, all eight booking doors opened for it and fees were
-- minted. There was no "closed for launch".
--
-- ── THE SWITCH ──────────────────────────────────────────────────────────────
-- `platform_settings.bookings_open` — a non-secret feature switch on the
-- world-readable singleton, shaped like `setnayan_ai_paywall_enabled`
-- (nullable BOOLEAN), so "go" is a flip and never a redeploy:
--   • NULL  → CLOSED. The launch default; an untouched install is closed.
--   • FALSE → CLOSED (the admin closed it on purpose).
--   • TRUE  → OPEN — today's behaviour exactly (verified shops are bookable).
-- `public.bookings_are_open()` is the one SQL reading of it. The app reads the
-- same column through `lib/bookings-open.server.ts`, fail-closed.
--
-- ── THE BACKSTOP ────────────────────────────────────────────────────────────
-- A second BEFORE trigger on event_vendors with EXACTLY the verified trigger's
-- scope, so nothing that trigger grandfathers is newly refused:
--   • marketplace rows only (an off-platform / hand-added row is the couple's
--     own tracker and never a supplier booking);
--   • only the TRANSITION into a booked status (INSERT booked, or UPDATE from
--     not-booked to booked). An already-booked row — and so the couple's claim
--     approval, which books the hand-added row while it is still off-platform
--     and links the shop afterwards — is never re-checked.
-- While closed, that transition raises `bookings_closed` (check_violation),
-- whatever app door it came through: the five couple doors, the supplier's
-- yes (`vendor_agree_to_lock`), a Locked-QR claim (`vendor_claim_locked_qr`)
-- and a payment acknowledgement that would have booked a row.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS bookings_open BOOLEAN;

COMMENT ON COLUMN public.platform_settings.bookings_open IS
  'Owner 2026-11-02 "for now, they cannot add bookings". NULL = closed (launch default) · FALSE = closed · TRUE = open (verified shops bookable, fees minted). Read by public.bookings_are_open() and lib/bookings-open.server.ts (fail-closed). Flipped from /admin/booking-fees.';

CREATE OR REPLACE FUNCTION public.bookings_are_open()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT ps.bookings_open FROM public.platform_settings ps WHERE ps.id = 1), FALSE);
$$;

COMMENT ON FUNCTION public.bookings_are_open() IS
  'TRUE only when platform_settings.bookings_open is TRUE. NULL / FALSE / no row = closed (fail-closed).';

-- Called by the trigger below (SECURITY DEFINER, so as its owner) and by the service role; nobody else needs it.
REVOKE ALL ON FUNCTION public.bookings_are_open() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bookings_are_open() TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_bookings_open()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed CONSTANT public.vendor_status[] :=
    ARRAY['contracted','deposit_paid','delivered','complete']::public.vendor_status[];
BEGIN
  -- Off-platform / hand-added rows are never a supplier booking.
  IF NEW.marketplace_vendor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only the transition INTO a booked status.
  IF NOT (NEW.status = ANY (v_confirmed)) THEN
    RETURN NEW;
  END IF;

  -- Grandfathering, identical to enforce_booking_requires_verified_vendor: an
  -- already-booked row (a lifecycle step, a link stamped onto a booked row by a
  -- claim approval) is never re-checked.
  IF TG_OP = 'UPDATE' AND OLD.status = ANY (v_confirmed) THEN
    RETURN NEW;
  END IF;

  IF NOT public.bookings_are_open() THEN
    RAISE EXCEPTION
      'bookings_closed: bookings are not open on Setnayan yet (marketplace_vendor_id=%)',
      NEW.marketplace_vendor_id
      USING ERRCODE = 'check_violation',
            HINT = 'An admin opens bookings from /admin/booking-fees.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_bookings_open() IS
  'Owner 2026-11-02: while platform_settings.bookings_open is not TRUE, no marketplace event_vendors row may move INTO a booked status. Same scope and grandfathering as enforce_booking_requires_verified_vendor.';

REVOKE ALL ON FUNCTION public.enforce_bookings_open() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendors_require_bookings_open ON public.event_vendors;

CREATE TRIGGER event_vendors_require_bookings_open
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_bookings_open();
