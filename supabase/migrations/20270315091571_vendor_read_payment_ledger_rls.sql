-- ============================================================================
-- 20270315091571_vendor_read_payment_ledger_rls.sql
-- Scoped vendor READ on the couple's payment ledger — enables the realtime
-- vendor payment card.
--
-- event_vendor_payments + event_vendor_line_items are the COUPLE's tables
-- (couple-RLS, iteration 0007). Until now a vendor couldn't read them directly;
-- the vendor thread admin-reads them after an ownership gate. That works for
-- server render but blocks Supabase Realtime, which only delivers row changes a
-- client is RLS-authorized to SELECT. To let a vendor's browser receive live
-- payment updates for THEIR OWN bookings, we add a read-only policy scoped to
-- exactly the rows they already see server-side — no new data exposure, just a
-- live channel for it.
--
-- Pattern: a SECURITY DEFINER membership resolver (mirrors
-- agent_customer_event_ids() / current_vendor_ids() in
-- 20260821000000_vendor_role_aware_rls.sql) returns the event_vendors.vendor_id
-- set the current user owns — owner/admin via marketplace_vendor_id, agents via
-- their assigned services. The two SELECT policies just check membership in that
-- set. Writes stay couple-only + the SECURITY DEFINER guards
-- (confirm_vendor_payment etc.) — this is READ-only.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS / CREATE POLICY.
-- ============================================================================

BEGIN;

-- Resolve the event_vendors.vendor_id rows the current user's vendor org owns.
-- SECURITY DEFINER so the inner event_vendors read isn't itself gated by
-- event_vendors RLS (the vendor has no direct couple-table read). STABLE +
-- pinned search_path per the existing helper conventions.
CREATE OR REPLACE FUNCTION public.current_vendor_event_vendor_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- owner/admin: bookings linked to a vendor_profile the user owns/admins.
  SELECT ev.vendor_id
  FROM public.event_vendors ev
  WHERE ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
  UNION
  -- agents: bookings whose booked service is assigned to the user.
  SELECT ev.vendor_id
  FROM public.event_vendors ev
  WHERE ev.service_id IN (SELECT public.agent_assigned_service_ids());
$$;

GRANT EXECUTE ON FUNCTION public.current_vendor_event_vendor_ids() TO authenticated;

-- Read-only vendor SELECT on couple-logged payments for the vendor's bookings.
-- Couple read/write policies (event_vendor_payments_couple_*) are untouched.
DROP POLICY IF EXISTS event_vendor_payments_vendor_read ON public.event_vendor_payments;
CREATE POLICY event_vendor_payments_vendor_read
  ON public.event_vendor_payments FOR SELECT
  TO authenticated
  USING (vendor_id IN (SELECT public.current_vendor_event_vendor_ids()));

-- Read-only vendor SELECT on the couple's milestones for the vendor's bookings.
DROP POLICY IF EXISTS event_vendor_line_items_vendor_read ON public.event_vendor_line_items;
CREATE POLICY event_vendor_line_items_vendor_read
  ON public.event_vendor_line_items FOR SELECT
  TO authenticated
  USING (vendor_id IN (SELECT public.current_vendor_event_vendor_ids()));

COMMIT;
