-- an_unverified_shop_is_found_only_once_verified_and_booked_by_its_page
--
-- DECISION_LOG 2026-11-15 "🌐 AN UNVERIFIED SHOP HAS THE SAME WEBSITE AS A VERIFIED ONE — SERVICE CARDS, PRICES,
-- INQUIRE, ADD TO EVENT AND BOOKING (WITH THE BOOKING FEE); THE ONLY REACH DIFFERENCE IS DISCOVER AND SUPPLIERS › FIND",
-- and the owner's answers of 15 Nov to the two questions that row left open (relayed by the controller):
--   · "Verified only" — 15 Nov SUPERSEDES 2026-11-07 "findable until its first inquiry": a shop Setnayan has not
--     verified is NOT in Discover or Suppliers › Find. People reach it only by its own link or QR.
--   · "We allow booking. Since they can get bookings on their website" · "Yes, build booking" — a not-yet-decided
--     shop CAN be asked and booked, with the booking fee, exactly as a verified one.
--
-- Two changes, no data written:
--   1. vendor_profiles.is_findable — the ONE listing rule — keeps only its verified half. Redefined IN PLACE
--      (PostgreSQL 17 `ALTER COLUMN … SET EXPRESSION`), so vendor_market_stats, vendor_profiles_self, the partial
--      index and the column grant stay exactly as they are. find_locked_at stays (it still records the first
--      inquiry); it simply no longer decides anything.
--   2. enforce_booking_requires_verified_vendor() — the database half of the booking gate — lets a NEW ask or booking
--      through for a not-yet-decided shop (unverified / pending_review) that is not archived and not fraud-frozen:
--      the same shops whose own page opens (lib/findable-shop.ts `ownLinkOpensUnverified`). Verified shops keep the
--      listed check; rejected and demoted shops are still refused. The app's half is `shopBookingRefusal`
--      (lib/vendor-visibility.ts), which asks the same columns in the same order.
--      CREATE OR REPLACE against the LATEST definition (20271346561709), changed only in the CASE.

-- ── 1 · is_findable: verified only ──────────────────────────────────────────
ALTER TABLE public.vendor_profiles
  ALTER COLUMN is_findable SET EXPRESSION AS (
    COALESCE(public_visibility = 'verified' AND verification_state = 'verified', FALSE)
  );

COMMENT ON COLUMN public.vendor_profiles.is_findable IS
  'THE ONE RULE for every couple-facing list (search, Discover, Suppliers › Find, category pages, suggestions) — DECISION_LOG 2026-11-15 (supersedes 2026-11-07 "findable until its first inquiry"). TRUE = verified (public_visibility AND verification_state verified). A not-yet-verified shop is reached only by its own link or QR. Generated: nothing writes it. Demo shops are filtered separately by is_demo; lapsed papers by papers_current. The app reads it only through apps/web/lib/findable-shop.ts.';

-- ── 2 · the booking gate: a not-yet-decided shop can be asked and booked ─────
CREATE OR REPLACE FUNCTION public.enforce_booking_requires_verified_vendor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed CONSTANT public.vendor_status[] :=
    ARRAY['contracted','deposit_paid','delivered','complete']::public.vendor_status[];
  v_booking    BOOLEAN;
  v_asking     BOOLEAN;
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

  -- A NEW booking: the transition INTO a confirmed status. A row that was ALREADY confirmed is grandfathered.
  v_booking := NEW.status = ANY (v_confirmed)
               AND NOT (TG_OP = 'UPDATE' AND OLD.status = ANY (v_confirmed));

  -- A NEW ask: the transition INTO a pending request. A row already pending stays as it is.
  v_asking := NEW.lock_request_state IS NOT DISTINCT FROM 'pending'
              AND NOT (TG_OP = 'UPDATE' AND OLD.lock_request_state IS NOT DISTINCT FROM 'pending');

  IF NOT (v_booking OR v_asking) THEN
    RETURN NEW;
  END IF;

  SELECT vp.verification_state::text, vp.public_visibility::text, vp.fraud_suspended_at, vp.fraud_banned_at, TRUE
    INTO v_state, v_visibility, v_suspended, v_banned, v_found
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.marketplace_vendor_id;

  -- Fail-closed, ban first (a banned shop is also suspended) — the app's `shopBookingRefusal` order.
  v_reason := CASE
    WHEN v_found IS NOT TRUE                                THEN 'missing'
    WHEN v_banned IS NOT NULL                               THEN 'banned'
    WHEN v_suspended IS NOT NULL                            THEN 'suspended'
    -- 15 Nov: a shop Setnayan has not decided yet is booked through its own page — unless it is closed.
    WHEN v_state IN ('unverified', 'pending_review')
         AND v_visibility IS NOT DISTINCT FROM 'archived'   THEN 'not_listed'
    WHEN v_state IN ('unverified', 'pending_review')        THEN NULL
    WHEN v_state IS DISTINCT FROM 'verified'                THEN 'not_verified'
    WHEN v_visibility IS DISTINCT FROM 'verified'           THEN 'not_listed'
    ELSE NULL
  END;

  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'vendor_not_verified: this vendor cannot be booked (reason=%, marketplace_vendor_id=%, state=%, visibility=%)',
      v_reason, NEW.marketplace_vendor_id, COALESCE(v_state, 'missing'), COALESCE(v_visibility, 'missing')
      USING ERRCODE = 'check_violation',
            HINT = 'A shop can be asked or booked when it is verified and listed, or not yet decided and not closed — and never while fraud-suspended or banned.';
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.enforce_booking_requires_verified_vendor() IS
  'Owner 2026-07-24 + Lane G item 1 (2026-11-10) + 2026-11-14 ("Yes, block them") + 2026-11-15 ("We allow booking. Since they can get bookings on their website"): a MARKETPLACE vendor can be ASKED (event_vendors.lock_request_state → ''pending'') or BOOKED (status → contracted/deposit_paid/delivered/complete) when it has no fraud suspension or ban AND either (verification_state = ''verified'' AND public_visibility = ''verified'') or (verification_state IN (''unverified'',''pending_review'') AND public_visibility <> ''archived'') — the app''s shopBookingRefusal (lib/vendor-visibility.ts). Rejected and demoted shops are refused. Fires only on the transition INTO an ask or a booking: existing bookings and existing asks are never re-checked. Off-platform vendors (marketplace_vendor_id IS NULL) are never gated. Refusal: check_violation, message prefix "vendor_not_verified:".';

-- A trigger function is never an RPC.
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM authenticated;
