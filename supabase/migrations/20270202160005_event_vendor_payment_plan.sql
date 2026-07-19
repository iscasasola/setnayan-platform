-- ============================================================================
-- 20270202160005_event_vendor_payment_plan.sql
--
-- Vendor Transaction Lifecycle · Phase 2 · PR-B — the per-booking PAYMENT PLAN
-- snapshotted when a couple LOCKS a marketplace vendor.
--
-- PR-A landed the reusable SCHEDULE TEMPLATE on a vendor_services row
-- (vendor_service_payment_schedules: a downpayment + payment 1…X, each a % of
-- the total OR a fixed PHP figure, each anchored on_lock / before_event). That
-- template describes HOW a couple WOULD pay.
--
-- This table is the CONCRETE plan for ONE booking: at lock time finalizeVendor
-- resolves the booked service's schedule against the booking's real total +
-- dates and freezes a snapshot here (one plan row per (event, event_vendor)).
-- The couple reads it on their per-vendor workspace alongside the existing
-- "how to pay" (VendorDirectPay). The pay-confirm flow (vendor marks an
-- installment confirmed / cleared) is PR-C/D — this migration stores the plan
-- only.
--
-- instances_json — the frozen installments. An array of:
--   { seq, label, amount_php | null, due_date | null, percent_bps?, amount_kind? }
-- amount_php / due_date are resolved at lock when the inputs exist; when the
-- booking total or event date isn't set yet they snapshot NULL + retain enough
-- of the template (percent_bps / amount_kind) to resolve later. Empty array =
-- the service carried no schedule → the couple just pays the vendor directly.
--
-- RLS — host-scoped, mirroring event_vendor_preferences (20260721000000)
-- exactly (the canonical couple-RLS event-child pattern):
--   • SELECT + ALL gated on event_id IN (SELECT public.current_event_ids())
--     OR public.is_admin(), with the matching WITH CHECK on the write policy.
-- The snapshot itself is written via the service-role admin client in
-- finalizeVendor (best-effort, never rolls back the lock), so the host write
-- policy exists for symmetry / admin tooling rather than the snapshot path.
--
-- Also registers the 4 new notification_type enum values up front so PR-B's
-- payment_info_sent emit — and PR-C/D's payment_logged / payment_confirmed /
-- payment_cleared emits — are safe the moment their code lands.
--
-- ADD VALUE cannot run inside an explicit transaction block, so this migration
-- is intentionally BARE (no BEGIN/COMMIT) — same pattern as
-- 20270129155743_add_notification_types.sql and
-- 20260907000000_notification_types_cross_actor_signals.sql. Each statement
-- auto-commits; CREATE TABLE / CREATE POLICY are safe without an explicit txn.
-- Idempotent + re-run safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. notification_type enum — the 4 payment-lifecycle signals.
--    Registered now (PR-B only emits payment_info_sent; the other three land in
--    PR-C/D), so every later emit is DB-safe the moment it ships.
--      • payment_info_sent  → couple: the booking locked + their payment plan is ready
--      • payment_logged     → vendor: the couple logged a payment against an installment
--      • payment_confirmed  → couple: the vendor confirmed a logged payment
--      • payment_cleared    → couple: the full plan is settled / cleared
-- ----------------------------------------------------------------------------
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_info_sent';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_logged';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_confirmed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_cleared';

-- ----------------------------------------------------------------------------
-- 2. event_vendor_payment_plan — one frozen plan per locked booking.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_vendor_payment_plan (
  plan_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The event the booking belongs to — the couple-RLS anchor.
  event_id        UUID NOT NULL
                  REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The booked event_vendors row (its vendor_id PK). Not FK'd to keep this
  -- additive + decoupled from event_vendors' own evolving shape; the UNIQUE
  -- below + the event_id FK are the integrity guards that matter here.
  event_vendor_id UUID NOT NULL,
  -- The frozen installments (see header). Default [] = no schedule / direct-pay.
  instances_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Set when the whole plan is settled (PR-D). NULL while still owed.
  cleared_at      TIMESTAMPTZ,
  cleared_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One plan per booking — the snapshot upserts on this key at lock.
  UNIQUE (event_id, event_vendor_id)
);

CREATE INDEX IF NOT EXISTS event_vendor_payment_plan_event_vendor_idx
  ON public.event_vendor_payment_plan (event_vendor_id);

ALTER TABLE public.event_vendor_payment_plan ENABLE ROW LEVEL SECURITY;

-- Hosts of the event read their own booking's plan; admins all. Uses the
-- canonical public.current_event_ids() helper + public.is_admin() — identical
-- to event_vendor_preferences_host_select / event_vendor_payments' couple RLS.
DROP POLICY IF EXISTS event_vendor_payment_plan_host_select
  ON public.event_vendor_payment_plan;
CREATE POLICY event_vendor_payment_plan_host_select
  ON public.event_vendor_payment_plan FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

-- Host + admin write (admin client / service role bypasses RLS for the lock
-- snapshot; this policy exists for symmetry + any host/admin tooling).
DROP POLICY IF EXISTS event_vendor_payment_plan_host_write
  ON public.event_vendor_payment_plan;
CREATE POLICY event_vendor_payment_plan_host_write
  ON public.event_vendor_payment_plan FOR ALL
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

COMMENT ON TABLE public.event_vendor_payment_plan IS
  'Vendor Transaction Lifecycle Phase 2 PR-B — per-booking PAYMENT PLAN frozen at lock from the booked service''s vendor_service_payment_schedules template. instances_json = [{seq,label,amount_php,due_date,percent_bps?,amount_kind?}]; empty = no schedule (pay vendor directly). cleared_at/by set in PR-D. Host-scoped RLS via current_event_ids().';
