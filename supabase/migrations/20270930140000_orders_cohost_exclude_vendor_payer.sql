-- orders_cohost_exclude_vendor_payer
-- ============================================================================
-- PRIVACY FIX: a couple/co-host could SEE the vendor's booking-fee order.
-- ============================================================================
-- The vendor Booking Fee (lib/booking-fee-lock.server.ts) mints a VENDOR-PAYER
-- order stamped with the COUPLE'S event_id so the vendor's own pay screen can
-- scope it:
--     user_id     = the VENDOR's user account (NOT an event member)
--     event_id    = the couple's event
--     service_key = 'vendor_booking_fee__{chargeId}'   (vendor_-prefixed)
--
-- The co-host read policy shipped by 20270129279924_orders_cohost_read.sql
-- broadened SELECT to every event member:
--     USING ( user_id = auth.uid()
--             OR event_id IN (SELECT public.current_event_ids())
--             OR public.is_admin() )
-- The middle branch admits ANY order carrying the event's id — including the
-- vendor-payer fee order. So via that policy (and the couple-facing event-order
-- reads: lib/orders.fetchOrdersForEvent, the budget page's paid/fulfilled sum,
-- the event dashboard Services card, …) the couple could read what their vendor
-- is charged: the fee amount, reference code, status. That must never be
-- visible to the couple.
--
-- FIX (the real guard): tighten the co-host branch so it only admits orders
-- whose PAYER is themselves a member of that event. Couple purchasers + co-hosts
-- are event_members, so their own shared-planning orders stay fully visible; the
-- vendor is NOT an event_member, so the vendor-payer fee order is excluded from
-- every event-scoped read at the row level. Non-brittle: keyed on membership,
-- not on parsing the service_key string.
--
-- Access preserved:
--   • the VENDOR still reads their own fee order via `user_id = auth.uid()`
--     (the /vendor-dashboard/booking-fees screen reads by user_id) — untouched;
--   • admins still see everything via public.is_admin();
--   • the couple still sees all of THEIR OWN + their co-hosts' SKU/service
--     orders (those payers are event members).
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
    -- Co-hosts / couple members see the event's orders — but ONLY those whose
    -- payer is a member of that event. Excludes the vendor-payer fee order
    -- (vendor is not an event_member) while keeping every couple-side order.
    OR (
      event_id IN (SELECT public.current_event_ids())
      AND public.is_event_member(event_id, user_id)
    )
  );

COMMIT;
