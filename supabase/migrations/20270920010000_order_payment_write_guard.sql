-- ============================================================================
-- 20270920010000_order_payment_write_guard.sql
--
-- MONEY SECURITY FIX — self-minted paid orders / self-matched payments.
--
-- Root cause (migration 20260513150000_iteration_0034_payments.sql):
--   • orders_owner_write  is  FOR ALL ... WITH CHECK (user_id = auth.uid())
--     with NO status guard. An authenticated couple can PATCH
--     /rest/v1/orders {status:'paid'} straight from the browser and
--     self-provision a SKU without paying — the apply-then-pay lock says
--     admin/payments/actions.ts (service-role) is the ONLY legitimate writer
--     of 'paid'.
--   • payments_owner_insert is WITH CHECK (user_id = auth.uid()) with no
--     status guard. A buyer can self-INSERT status='matched' to satisfy the
--     admin shortfall/promote guard's matched-total arithmetic.
--
-- Fix: add RESTRICTIVE policies that AND on top of the existing permissive
-- owner policies, so a non-admin, non-service-role `authenticated` writer can
-- only ever set a NEW-row status to the self-serve, non-money-final values.
-- service_role (the admin/service client in lib/supabase/admin.ts) and
-- is_admin() authenticated sessions pass through unrestricted.
--
-- Allowed self-serve order statuses (enumerated from the real writers, NOT
-- the enum surface): the authed client only ever writes 'submitted'
-- (createOrder + checkout) and 'cancelled' (cancelOrder). 'draft' and
-- 'awaiting_payment' are additionally admitted because they are unpaid,
-- non-provisioning states (draft = pre-submission; awaiting_payment = admin
-- quote a couple might still touch) and admitting them cannot provision a
-- SKU. The privileged set BLOCKED for authed non-admins is exactly the
-- money-final / entitlement-bearing statuses: paid · fulfilled · refunded ·
-- lapsed. (All papic free-order 'fulfilled' inserts and the vendor self-comp
-- 'paid' insert already run through createAdminClient() = service_role, so
-- they are unaffected.)
--
-- order_status enum on prod (base 20260513150000 + 'lapsed' from
-- 20260602000000): draft · submitted · awaiting_payment · paid · fulfilled ·
-- cancelled · refunded · lapsed.
--
-- Allowed self-serve payment statuses: the only authed payments INSERT
-- (logPayment) writes the DEFAULT 'pending'. matched / rejected /
-- resubmit_requested are admin transitions on service-role. So a non-admin
-- may only insert status='pending'.
--
-- payment_status enum on prod (base 20260513150000 + 'resubmit_requested'
-- from 20260529010000): pending · matched · rejected · resubmit_requested.
--
-- RLS stays ENABLED on both tables (they already are); this migration only
-- ADDS restrictive policies — it drops/redefines nothing and introduces no
-- USING (true). A restrictive policy can only narrow, never widen.
--
-- Idempotent (DROP POLICY IF EXISTS → CREATE).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- orders — restrict the NEW-row status a non-admin authed writer may set.
-- Split INSERT / UPDATE so the guard only ever evaluates WITH CHECK (the row
-- being written). It deliberately does NOT restrict SELECT or DELETE, so the
-- couple keeps reading their own 'paid'/'refunded' orders (orders_owner_read).
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS orders_insert_status_guard ON public.orders;
CREATE POLICY orders_insert_status_guard
  ON public.orders
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR status = ANY (ARRAY[
      'draft',
      'submitted',
      'awaiting_payment',
      'cancelled'
    ]::public.order_status[])
  );

DROP POLICY IF EXISTS orders_update_status_guard ON public.orders;
CREATE POLICY orders_update_status_guard
  ON public.orders
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR status = ANY (ARRAY[
      'draft',
      'submitted',
      'awaiting_payment',
      'cancelled'
    ]::public.order_status[])
  );

-- ----------------------------------------------------------------------------
-- payments — a non-admin authed writer may only INSERT status='pending'.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS payments_insert_status_guard ON public.payments;
CREATE POLICY payments_insert_status_guard
  ON public.payments
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR status = 'pending'
  );

-- ----------------------------------------------------------------------------
-- Post-condition asserts — prove the guard actually landed as RESTRICTIVE and
-- that RLS remains enabled on both tables. Mirrors the assert style in
-- 20270828140000_papic_one_tiers.sql (guardrails asserted, not just written).
-- (This migration adds status-write guards; it does not touch current_event_ids
-- — nothing here should reference it, and none of these three policies do.)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_orders_rls   BOOLEAN;
  v_payments_rls BOOLEAN;
  v_missing      TEXT;
BEGIN
  SELECT relrowsecurity INTO v_orders_rls
  FROM pg_class WHERE oid = 'public.orders'::regclass;
  IF NOT COALESCE(v_orders_rls, FALSE) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.orders — refusing to leave it open';
  END IF;

  SELECT relrowsecurity INTO v_payments_rls
  FROM pg_class WHERE oid = 'public.payments'::regclass;
  IF NOT COALESCE(v_payments_rls, FALSE) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.payments — refusing to leave it open';
  END IF;

  -- Every guard must exist AND be RESTRICTIVE (permissive = 'RESTRICTIVE' in
  -- pg_policies). A permissive policy of the same name would silently WIDEN
  -- access instead of narrowing it, so assert the kind too.
  SELECT string_agg(want.polname, ', ')
    INTO v_missing
  FROM (VALUES
    ('orders',   'orders_insert_status_guard'),
    ('orders',   'orders_update_status_guard'),
    ('payments', 'payments_insert_status_guard')
  ) AS want(tablename, polname)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = want.tablename
      AND p.policyname = want.polname
      AND p.permissive = 'RESTRICTIVE'
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'expected RESTRICTIVE status-write guards missing/mis-kinded: %', v_missing;
  END IF;
END $$;

COMMIT;
