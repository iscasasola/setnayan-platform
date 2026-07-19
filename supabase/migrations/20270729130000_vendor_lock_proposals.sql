-- ============================================================================
-- 20270729130000_vendor_lock_proposals.sql
--
-- Coordinator "propose a lock" — money-adjacent guard.
-- Spec: corpus Coordinator_Role_Feature_Spec_2026-07-18.md § 0 / § 4
-- (propose-not-execute for money-adjacent actions).
--
-- WHY: today a coordinator (event_moderators wedding_planner_external with
-- COORDINATOR_AREAS.vendors='edit') can write event_vendors via the
-- event_vendors_moderator_write RLS policy — including flipping status to
-- 'contracted', i.e. LOCKING a vendor. Locking commits the couple to a vendor
-- and seeds the payment schedule, so per the owner's "propose-not-execute /
-- money wall" principle the lock must be couple-confirmed. This table is the
-- proposal a coordinator raises; the couple confirms it (which fires the normal
-- finalizeVendor lock as the couple).
--
-- ENFORCEMENT is app-level and flag-gated
-- (NEXT_PUBLIC_COORDINATOR_PROPOSE_LOCK_ENABLED, default OFF) in
-- finalizeVendor. Flag OFF = coordinators still lock directly (current
-- behavior). This migration ships the table regardless — harmless until the
-- flag flips. A DB-level trigger blocking coordinator status→contracted writes
-- is a deferred hardening (would break flag-off = current behavior if added
-- unconditionally).
--
-- Idempotent: CREATE TABLE / INDEX / POLICY all IF NOT EXISTS / DROP-then-CREATE.
-- Reversible by DROP TABLE public.vendor_lock_proposals.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_lock_proposals (
  id                    BIGSERIAL PRIMARY KEY,
  event_id              UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  event_vendor_id       UUID NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  proposed_by_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ,
  resolved_by_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- One live proposal per vendor — re-proposing is a no-op (upsert target).
CREATE UNIQUE INDEX IF NOT EXISTS vendor_lock_proposals_one_pending_uniq
  ON public.vendor_lock_proposals (event_vendor_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS vendor_lock_proposals_event_idx
  ON public.vendor_lock_proposals (event_id);

ALTER TABLE public.vendor_lock_proposals ENABLE ROW LEVEL SECURITY;

-- Read: couple + coordinator on the event (both need to see the proposal).
DROP POLICY IF EXISTS vendor_lock_proposals_host_select ON public.vendor_lock_proposals;
CREATE POLICY vendor_lock_proposals_host_select
  ON public.vendor_lock_proposals FOR SELECT
  TO authenticated
  USING ( event_id IN (SELECT public.current_couple_or_coordinator_event_ids()) OR public.is_admin() );

-- Propose (INSERT): couple OR coordinator on the event; can only file as self.
DROP POLICY IF EXISTS vendor_lock_proposals_host_insert ON public.vendor_lock_proposals;
CREATE POLICY vendor_lock_proposals_host_insert
  ON public.vendor_lock_proposals FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    AND proposed_by_user_id = auth.uid()
  );

-- Resolve (UPDATE = confirm/dismiss): the COUPLE only — the confirm is the
-- couple's money-adjacent decision.
DROP POLICY IF EXISTS vendor_lock_proposals_couple_update ON public.vendor_lock_proposals;
CREATE POLICY vendor_lock_proposals_couple_update
  ON public.vendor_lock_proposals FOR UPDATE
  TO authenticated
  USING  ( event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin() )
  WITH CHECK ( event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin() );

COMMENT ON TABLE public.vendor_lock_proposals IS
  'Coordinator "propose a lock" (corpus spec § 4): a coordinator raises a proposal to lock a vendor; the couple confirms (fires the normal finalizeVendor lock). Enforcement app-level + flag-gated (NEXT_PUBLIC_COORDINATOR_PROPOSE_LOCK_ENABLED, default OFF). Read = couple+coordinator; insert = either host as self; resolve = couple only.';

COMMIT;
