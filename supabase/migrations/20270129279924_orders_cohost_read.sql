-- orders_cohost_read
-- ============================================================================
-- Fix: co-hosts (non-purchaser event members) were denied every couple-SKU gate.
-- ============================================================================
-- The `orders` table (iteration 0034) shipped two RLS policies, both keyed to
-- the single buyer:
--   orders_owner_read  (SELECT) USING (user_id = auth.uid())
--   orders_owner_write (ALL)    USING (user_id = auth.uid())
--
-- But an event is multi-member: `event_members` is UNIQUE(event_id, user_id),
-- and couples + co-hosts join one event via the 0000 QR-join flow. The
-- entitlement reader (lib/entitlements.ts) queries orders by event_id under the
-- RLS-enforced anon client — so a co-host who didn't click "buy" reads ZERO
-- order rows, and every paid-SKU gate (Studio, Papic live wall, Setnayan AI,
-- budget ledger, launch/live surfaces, animated monogram) goes dark or shows
-- wrong data for them.
--
-- Fix: broaden the SELECT policy to admit all event members (+ admins) so a
-- co-host sees the event's shared SKU ownership. The WRITE policy is left
-- UNTOUCHED (still buyer-only) — a co-host can READ an order but can never
-- edit / cancel / refund it or insert one as someone else.
--
-- ⚠ PRIVACY: this intentionally exposes one member's order line-items (amount,
-- service_key, reference_code, voucher/discount, status, admin_notes) to every
-- co-host on the event. That is the intended shared-planning behavior (shared
-- budget + shared SKU ownership) but is a deliberate widening — see the PR for
-- the owner sign-off note. The separate `payments` table (screenshots) is NOT
-- touched here.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE.

BEGIN;

DROP POLICY IF EXISTS orders_owner_read ON public.orders;
CREATE POLICY orders_owner_read
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

COMMIT;
