-- orders_exclude_vendor_payer_from_event_reads
-- ============================================================================
-- PRIVACY FIX: a couple/co-host could SEE the vendor's booking-fee order.
-- ============================================================================
-- The vendor Booking Fee (lib/booking-fee-lock.server.ts) mints a VENDOR-PAYER
-- order stamped with the COUPLE'S event_id so the vendor's own pay screen can
-- scope it:
--     user_id     = the VENDOR's user account (NOT an event member)
--     event_id    = the couple's event
--     service_key = 'vendor_booking_fee__{chargeId}'
--
-- The event-scoped read branch admits ANY order carrying the event's id —
-- including the vendor-payer fee order. So via that policy (and the
-- couple-facing event-order reads: lib/orders.fetchOrdersForEvent, the budget
-- page's paid/fulfilled sum, the event dashboard Services card, …) the couple
-- could read what their vendor is charged: the fee amount, reference code and
-- status. That must never be visible to the couple.
--
-- VERIFIED LIVE IN PROD 2026-08-04 before writing this:
--     orders_owner_read USING (
--       (user_id = auth.uid())
--       OR (event_id IN (SELECT current_couple_or_coordinator_event_ids()))
--       OR is_admin())
--
-- ⚠⚠ WHY THIS MIGRATION WAS REWRITTEN (supersedes 20270930140000)
-- The original draft of this fix was authored in July against an OLDER shape of
-- the policy, which used `current_event_ids()`. Since then the policy was
-- NARROWED to `current_couple_or_coordinator_event_ids()`. Re-issuing the old
-- text verbatim would have DROPped the narrow policy and recreated the BROAD
-- one — silently re-admitting every event member, GUESTS INCLUDED, to the
-- couple's whole order history while fixing the vendor leak. A privacy fix that
-- opens a bigger hole than it closes.
--     current_event_ids()                        -> every event_members row
--     current_couple_or_coordinator_event_ids()  -> member_type IN (couple, coordinator)
-- This version composes WITH the narrow helper instead of replacing it.
--
-- The original file also carried prefix 20270930140000, which sits BELOW 114
-- already-applied migrations (head 20271102113000). Re-allocated so it actually
-- runs rather than merging green and creating nothing.
--
-- FIX (the real guard): keep the existing couple/coordinator branch, and admit
-- only orders whose PAYER is themselves a member of that event. Couple
-- purchasers + co-hosts are event_members, so their own shared-planning orders
-- stay fully visible; the vendor is NOT an event_member, so the vendor-payer fee
-- order is excluded from every event-scoped read at the row level. Keyed on
-- membership, not on parsing the service_key string.
--
-- Access preserved:
--   • the VENDOR still reads their own fee order via `user_id = auth.uid()`
--     (the /vendor-dashboard/booking-fees screen reads by user_id) — untouched;
--   • admins still see everything via public.is_admin();
--   • the couple/coordinator still sees all of THEIR OWN + their co-hosts'
--     SKU/service orders (those payers are event members).
--
-- Known, accepted edge: if a vendor's user account is ALSO an event_member of
-- that same event (e.g. they are separately a guest), their fee order becomes
-- visible to the couple again. Membership is the honest key here; parsing
-- service_key strings is the brittle alternative we are deliberately avoiding.
--
-- The WRITE policy (orders_owner_write, buyer-only) is not touched. The
-- fee-charge lane (finalizeVendor / collectBookingFeeAtLock, which writes the
-- order with the SERVICE-ROLE client that bypasses RLS) is not touched.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS + CREATE.

BEGIN;

-- SECURITY DEFINER so the membership lookup runs as the function owner and is
-- not itself re-filtered by event_members' own RLS (mirrors current_event_ids).
-- STABLE + pinned search_path per the canonical helper convention.
CREATE OR REPLACE FUNCTION public.is_event_member(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_members
    WHERE event_id = p_event_id
      AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_event_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS orders_owner_read ON public.orders;
CREATE POLICY orders_owner_read
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    -- The payer always reads their own order (this is how the VENDOR reads the
    -- fee order — vendor is the payer/user_id).
    user_id = auth.uid()
    -- Admins see everything.
    OR public.is_admin()
    -- Couple / coordinator see the event's orders — but not the vendor's.
    --
    -- ⚠ `user_id IS NULL` is LOAD-BEARING, not defensive. An ACCOUNT-LESS GUEST
    -- purchase (Papic pool top-ups / own-camera reloads, owner-locked
    -- 2026-07-29: "the host is NOTIFIED, not asked") is written with
    -- user_id = NULL. A membership-only test returns FALSE for those and takes
    -- host visibility away — papic-guest-orders.db.test.ts pins exactly that
    -- and caught it. The vendor fee order always carries a real vendor
    -- user_id, so NULL never re-admits it.
    --
    -- NOTE: the narrow helper is deliberate. Do NOT widen this to
    -- current_event_ids() — that admits guests.
    OR (
      event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
      AND (user_id IS NULL OR public.is_event_member(event_id, user_id))
    )
  );

COMMIT;
