-- a_hidden_shop_takes_no_new_ask_or_booking
-- Created via `pnpm migration:new`. Idempotent: CREATE OR REPLACE FUNCTION only. Writes NO data.
-- ============================================================================
-- 🚫 A HIDDEN SHOP TAKES NO NEW BOOKINGS — ENFORCED IN THE DATABASE, NOT ONLY THE APP.
-- Owner, 2026-11-14 (DECISION_LOG, same title): *"Yes, block them"*.
--
-- `enforce_booking_requires_verified_vendor` (last defined 20271335513615) refused a booking to a shop that is
-- not verified, fraud-suspended, fraud-banned or archived — but NOT one at public_visibility = 'hidden', and it
-- did not look at a couple's ASK at all (`lock_request_state = 'pending'`). Both were the app's alone
-- (`isMarketplaceVendorBookable` → `shopBookingRefusal`, apps/web/lib/vendor-visibility.ts), so a raw write past
-- the app could ask, and a supplier's yes could book, a hidden shop.
--
-- THE RULE NOW, the app's own rule (`shopBookingRefusal`) in the database:
--     bookable = verified AND not suspended AND not banned AND public_visibility = 'verified'
--   checked on two TRANSITIONS of a marketplace row, and nothing else:
--     · INTO a booked status (contracted · deposit_paid · delivered · complete) — as before;
--     · INTO a pending ask (lock_request_state → 'pending') — NEW. A pending ask is a booking request.
--
-- 🔒 NEW REQUESTS ONLY. Nothing that already exists is re-checked:
--     · a row ALREADY booked is never re-validated (any edit, any lifecycle advance) — grandfathered as before;
--     · a row ALREADY pending is not re-checked while it stays pending (a nudge, a note, a price);
--     · chats are a different table (chat_threads / chat_messages) — untouched;
--     · a LAPSED shop (papers past their date) is not hidden: the lapse takes the badge off and the shop stays
--       public_visibility = 'verified' (apps/web/lib/verified-badge-sweep.ts, owner 2026-09-11), so it keeps
--       working with the events that inquired. Held by the db test.
--   The supplier's YES on an ask is the transition into 'contracted', so it is refused if the shop went hidden
--   after the couple asked — "a hidden shop takes no NEW bookings".
--
-- ⚖ 'hidden' is the column DEFAULT and the resting state of every shop not yet approved — so this also refuses a
-- not-yet-listed verified shop, exactly as every app door already did. Prod at the ruling: 3 hidden, 2 verified,
-- none fraud; a hidden shop has no live booking path through the app today, so no booking that works stops working.
--
-- UNCHANGED, line for line: the scope (marketplace rows only), the grandfathering, SECURITY DEFINER + search_path,
-- the errcode (check_violation) and the message PREFIX `vendor_not_verified:` — four app paths match on it, so a
-- refusal reaches the couple as the friendly "still verifying" sentence. The reason names `not_listed` for hidden
-- and archived alike, as the app's `shopBookingRefusal` does. The trigger (event_vendors_require_verified_before_lock,
-- BEFORE INSERT OR UPDATE) is untouched. Held by apps/web/tests/db/a-hidden-shop-takes-no-new-ask-or-booking.db.test.ts.
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
    WHEN v_found IS NOT TRUE                       THEN 'missing'
    WHEN v_banned IS NOT NULL                      THEN 'banned'
    WHEN v_suspended IS NOT NULL                   THEN 'suspended'
    WHEN v_state IS DISTINCT FROM 'verified'       THEN 'not_verified'
    WHEN v_visibility IS DISTINCT FROM 'verified'  THEN 'not_listed'
    ELSE NULL
  END;

  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'vendor_not_verified: this vendor cannot be booked (reason=%, marketplace_vendor_id=%, state=%, visibility=%)',
      v_reason, NEW.marketplace_vendor_id, COALESCE(v_state, 'missing'), COALESCE(v_visibility, 'missing')
      USING ERRCODE = 'check_violation',
            HINT = 'Only a verified, listed shop with no fraud suspension or ban can be asked or booked by a couple.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_booking_requires_verified_vendor() IS
  'Owner 2026-07-24 + Lane G item 1 (2026-11-10) + 2026-11-14 ("Yes, block them"): a MARKETPLACE vendor can only be ASKED (event_vendors.lock_request_state → ''pending'') or BOOKED (status → contracted/deposit_paid/delivered/complete) when vendor_profiles.verification_state = ''verified'' AND fraud_suspended_at IS NULL AND fraud_banned_at IS NULL AND public_visibility = ''verified'' — the app''s shopBookingRefusal (lib/vendor-visibility.ts). Fires only on the transition INTO an ask or a booking: existing bookings and existing asks are never re-checked. Off-platform vendors (marketplace_vendor_id IS NULL) are never gated. Refusal: check_violation, message prefix "vendor_not_verified:".';

-- A trigger function is never an RPC.
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_booking_requires_verified_vendor() FROM authenticated;
