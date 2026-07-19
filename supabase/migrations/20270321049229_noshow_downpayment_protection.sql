-- ============================================================================
-- 20270321049229_noshow_downpayment_protection.sql
--
-- No-Show Downpayment Protection · Wave 3 of the "Soon" vendor benefits.
--
-- WHAT THIS IS (and is NOT)
-- -------------------------
-- A POLICY + couple-ACKNOWLEDGEMENT + frozen-EVIDENCE layer. Setnayan NEVER
-- holds the downpayment — couples pay vendors off-platform; event_vendor_payments
-- are couple-logged proofs the vendor confirms. This migration adds:
--   1. a vendor's RESERVATION POLICY on the downpayment template row
--      (cancellation terms + non-refundable / refund-window / no-show-forfeit
--      flags), and
--   2. an immutable per-booking ACKNOWLEDGEMENT that freezes that policy text at
--      LOCK time, so a later edit to the vendor's policy can NEVER rewrite the
--      history a forfeit dispute relies on.
-- It moves NO money, executes NO refund, charges NO forfeit, runs NO gateway.
-- It is the defensible PAPER TRAIL only.
--
-- (1) POLICY FIELDS live on `vendor_service_payment_schedules` — the per-service
-- payment TEMPLATE where seq 0 IS the downpayment (migration 20270202160004).
-- That is the canonical home of the downpayment row, so the reservation policy
-- belongs there (it is a property of THAT installment, set by the vendor when
-- they define the downpayment). The vendor editor writes these only on the seq-0
-- row. The new columns inherit the table's EXISTING owner-write/public-read RLS
-- (vendor_service_payment_schedules_owner_write / _public_read) — column ALTERs
-- do not need their own policies, and we add NONE that would conflict.
--
-- (2) ACK TABLE `event_vendor_policy_acknowledgements` — write-once evidence,
-- one row per (event, event_vendor) snapshotted by finalizeVendor at lock.
-- RLS at CREATE: host/couple read+insert via current_event_ids(); admin via
-- is_admin(). NO UPDATE policy → the snapshot is immutable (an edit to the
-- vendor's template can't retroactively change what the couple acknowledged).
--
-- Idempotent + re-run safe.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Reservation-policy fields on the downpayment template row.
--    These describe the vendor's no-show / cancellation terms for the
--    downpayment. Set by the vendor editor on the seq-0 row only; snapshotted
--    into the ack at lock. They inherit the table's owner-write / public-read
--    RLS — no new policies (confirmed: the existing FOR ALL owner-write +
--    public-read SELECT already cover every column).
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_service_payment_schedules
  ADD COLUMN IF NOT EXISTS cancellation_terms TEXT;

ALTER TABLE public.vendor_service_payment_schedules
  ADD COLUMN IF NOT EXISTS downpayment_non_refundable BOOLEAN NOT NULL DEFAULT FALSE;

-- Days after lock during which the downpayment is still refundable (NULL = no
-- explicit window; only meaningful alongside downpayment_non_refundable=false
-- or as a "refundable up to N days" disclosure).
ALTER TABLE public.vendor_service_payment_schedules
  ADD COLUMN IF NOT EXISTS refund_window_days INT
    CHECK (refund_window_days IS NULL OR refund_window_days >= 0);

ALTER TABLE public.vendor_service_payment_schedules
  ADD COLUMN IF NOT EXISTS no_show_forfeit BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.vendor_service_payment_schedules.cancellation_terms IS
  'No-Show Downpayment Protection — free-text reservation/cancellation terms for the downpayment (seq 0). Snapshotted into event_vendor_policy_acknowledgements at lock.';
COMMENT ON COLUMN public.vendor_service_payment_schedules.downpayment_non_refundable IS
  'No-Show Downpayment Protection — when true, the downpayment is non-refundable. Couple must acknowledge before lock.';
COMMENT ON COLUMN public.vendor_service_payment_schedules.refund_window_days IS
  'No-Show Downpayment Protection — days after lock the downpayment remains refundable (disclosure only; no money movement). NULL = unset.';
COMMENT ON COLUMN public.vendor_service_payment_schedules.no_show_forfeit IS
  'No-Show Downpayment Protection — when true, a no-show forfeits the downpayment per the cancellation terms. Couple must acknowledge before lock.';

-- ----------------------------------------------------------------------------
-- 2. event_vendor_policy_acknowledgements — write-once frozen evidence.
--    One row per locked booking that carried a protected reservation policy.
--    policy_snapshot_json freezes the seq-0 policy fields + terms text at lock
--    so later template edits can't rewrite forfeit-dispute history.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_vendor_policy_acknowledgements (
  ack_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The event the booking belongs to — the couple-RLS anchor.
  event_id            UUID NOT NULL
                      REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The booked event_vendors row (its vendor_id PK). Not FK'd — additive +
  -- decoupled from event_vendors' evolving shape, same as
  -- event_vendor_payment_plan.event_vendor_id.
  event_vendor_id     UUID NOT NULL,
  -- Denormalized marketplace vendor (event_vendors.marketplace_vendor_id) so the
  -- admin dispute surface can join evidence by vendor_profile_id in a single
  -- lookup — the dispute row is keyed on vendor_profile_id, not event_vendor_id.
  vendor_profile_id   UUID,
  -- The frozen policy at lock-time:
  --   { cancellation_terms, downpayment_non_refundable, refund_window_days,
  --     no_show_forfeit, downpayment_label, acknowledged_terms_version? ... }
  policy_snapshot_json JSONB NOT NULL,
  -- The acknowledging couple user (the acting host at lock).
  acknowledged_by     UUID,
  acknowledged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One acknowledgement per booking — a re-lock refreshes the snapshot via
  -- the host insert path? NO: evidence is write-once. The snapshot inserts
  -- only when absent (the finalizeVendor path checks first), so a re-lock does
  -- NOT silently overwrite the original acknowledgement. The unique key guards
  -- against accidental duplicates.
  UNIQUE (event_id, event_vendor_id)
);

CREATE INDEX IF NOT EXISTS event_vendor_policy_acknowledgements_event_vendor_idx
  ON public.event_vendor_policy_acknowledgements (event_vendor_id);

CREATE INDEX IF NOT EXISTS event_vendor_policy_acknowledgements_vendor_profile_idx
  ON public.event_vendor_policy_acknowledgements (vendor_profile_id);

-- RLS AT CREATE TIME (canonical couple event-child pattern). Enable + policies
-- in the SAME migration.
ALTER TABLE public.event_vendor_policy_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Host/couple read their own booking's acknowledgement; admins all. Mirrors
-- event_vendor_payment_plan_host_select.
DROP POLICY IF EXISTS event_vendor_policy_acknowledgements_host_select
  ON public.event_vendor_policy_acknowledgements;
CREATE POLICY event_vendor_policy_acknowledgements_host_select
  ON public.event_vendor_policy_acknowledgements FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

-- Host/couple INSERT only (NOT a FOR ALL) — the snapshot is write-once
-- evidence. There is deliberately NO UPDATE and NO DELETE policy, so the
-- acknowledgement is immutable for authenticated callers (the service-role
-- lock path bypasses RLS; admins read but do not edit the snapshot). Admins
-- included on insert for symmetry / tooling.
DROP POLICY IF EXISTS event_vendor_policy_acknowledgements_host_insert
  ON public.event_vendor_policy_acknowledgements;
CREATE POLICY event_vendor_policy_acknowledgements_host_insert
  ON public.event_vendor_policy_acknowledgements FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

COMMENT ON TABLE public.event_vendor_policy_acknowledgements IS
  'No-Show Downpayment Protection — write-once frozen EVIDENCE. One immutable row per locked booking that carried a protected reservation policy; policy_snapshot_json freezes the seq-0 downpayment policy text at lock so later template edits cannot rewrite forfeit-dispute history. RLS: host read+insert via current_event_ids(); admin via is_admin(); NO update/delete policy (immutable). Setnayan holds no money — this is the paper trail only.';

COMMIT;
