-- contract booking link
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- WHAT THIS DOES — closes the booking↔contract flywheel gap.
--
-- Until now `vendor_contracts` and `event_vendors` (the couple's per-event
-- vendor BOOKING ledger) ran as parallel, disconnected subsystems. A contract
-- keyed off (event_id, vendor_profile_id) with NO link back to the booking it
-- belongs to, so a booking could never show "does this vendor have a contract,
-- and how far along is it?".
--
-- This migration:
--   1. Adds a nullable FK  vendor_contracts.event_vendor_id → event_vendors,
--      so each contract can point at the exact booking row it covers.
--   2. Backfills it for existing contracts by matching on
--      (event_id, marketplace_vendor_id == vendor_profile_id).
--   3. Adds an ORTHOGONAL derived marker on the booking —
--      event_vendors.contract_signed_at — set when a linked contract reaches a
--      terminal/active state, and a trigger on vendor_contracts that maintains
--      it. This is deliberately NOT a change to event_vendors.status.
--
-- WHY NOT flip event_vendors.status → 'contracted' on sign?
--   'contracted' is ALREADY a load-bearing value of the LOCKED booking state
--   machine — it's written by finalizeVendor() the moment the couple BOOKS a
--   vendor (a soft hold, booked-but-unpaid), and it gates the hard-single
--   conflict guard, the per-date soft-hold limit, the schedule-pool "white vs
--   locked" capacity doctrine, and the plan-locked UI set. By the time a
--   contract is signed the booking is typically already at 'contracted' or
--   beyond ('deposit_paid'/'delivered'), so writing 'contracted' back would be
--   a no-op at best and a DESTRUCTIVE DOWNGRADE at worst (e.g. dropping a
--   'deposit_paid' row back to 'contracted', corrupting the soft-hold count and
--   schedule-pool occupancy). The owner rule is explicit: never rename/repurpose
--   event_vendors.status. So contract progress is surfaced as an ORTHOGONAL
--   derived marker, not a status transition.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Booking-side derived contract marker.
--    event_vendors.contract_signed_at is a nullable timestamp set when a linked
--    contract first reaches a terminal/active state. It is purely additive and
--    independent of the status enum, so no booking logic is disturbed.
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_vendors.contract_signed_at IS
  'Derived marker: timestamp a linked vendor_contracts row first reached a '
  'signed/active state (fully_signed, or sent_for_signature under the '
  'upload-only scope). Orthogonal to status — maintained by the '
  'vendor_contract_sync_booking trigger. NEVER drives the booking state machine.';

-- ----------------------------------------------------------------------------
-- 2. Contract-side FK back to the booking it covers.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_contracts
  ADD COLUMN IF NOT EXISTS event_vendor_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'vendor_contracts_event_vendor_id_fkey'
  ) THEN
    ALTER TABLE public.vendor_contracts
      ADD CONSTRAINT vendor_contracts_event_vendor_id_fkey
      FOREIGN KEY (event_vendor_id)
      REFERENCES public.event_vendors(vendor_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS vendor_contracts_event_vendor_idx
  ON public.vendor_contracts (event_vendor_id)
  WHERE event_vendor_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_contracts.event_vendor_id IS
  'Nullable FK to the event_vendors booking this contract covers, resolved on '
  'create by matching event_id + vendor_profile_id (= event_vendors.'
  'marketplace_vendor_id). NULL when no matching booking exists (e.g. a '
  'contract uploaded before the couple booked the vendor).';

-- ----------------------------------------------------------------------------
-- 3. Resolver — find the booking row for an (event, vendor_profile) pair.
--    Prefers a still-active (non-archived) booking; falls back to the most
--    recent. Returns NULL when the couple hasn't booked this vendor.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_event_vendor_for_contract(
  p_event_id UUID,
  p_vendor_profile_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ev.vendor_id
    FROM public.event_vendors ev
   WHERE ev.event_id = p_event_id
     AND ev.marketplace_vendor_id = p_vendor_profile_id
     AND ev.archived_at IS NULL
   ORDER BY ev.created_at DESC
   LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- 4. Backfill event_vendor_id for existing contracts.
-- ----------------------------------------------------------------------------

UPDATE public.vendor_contracts vc
   SET event_vendor_id = ev.vendor_id
  FROM public.event_vendors ev
 WHERE vc.event_vendor_id IS NULL
   AND ev.event_id = vc.event_id
   AND ev.marketplace_vendor_id = vc.vendor_profile_id
   AND ev.archived_at IS NULL;

-- ----------------------------------------------------------------------------
-- 5. Sign-back trigger — keep event_vendors.contract_signed_at in sync.
--    Fires on contract insert and on relevant column changes. When a linked
--    contract is in a signed/active state, stamp the booking (idempotent —
--    keeps the earliest stamp). When the contract is cancelled and no other
--    linked contract is still active, clear the marker. NEVER touches status.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_contract_sync_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_active BOOLEAN;
BEGIN
  IF NEW.event_vendor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- "Active" = visible to the couple and not pulled back. Under the upload-only
  -- scope 'sent_for_signature' is the live state; 'fully_signed' is the
  -- forward-compat terminal. Either marks the booking as under a live contract.
  IF NEW.status IN ('sent_for_signature', 'fully_signed') THEN
    UPDATE public.event_vendors
       SET contract_signed_at = COALESCE(
             contract_signed_at,
             COALESCE(NEW.fully_signed_at, NEW.sent_for_signature_at, NOW())
           ),
           updated_at = NOW()
     WHERE vendor_id = NEW.event_vendor_id;
  ELSIF NEW.status = 'cancelled' THEN
    -- Clear only if no OTHER linked contract on the same booking is still active.
    SELECT EXISTS (
      SELECT 1 FROM public.vendor_contracts other
       WHERE other.event_vendor_id = NEW.event_vendor_id
         AND other.contract_id <> NEW.contract_id
         AND other.status IN ('sent_for_signature', 'fully_signed')
    ) INTO v_other_active;
    IF NOT v_other_active THEN
      UPDATE public.event_vendors
         SET contract_signed_at = NULL,
             updated_at = NOW()
       WHERE vendor_id = NEW.event_vendor_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_contract_sync_booking_t ON public.vendor_contracts;
CREATE TRIGGER vendor_contract_sync_booking_t
  AFTER INSERT OR UPDATE OF status, event_vendor_id, fully_signed_at, sent_for_signature_at
  ON public.vendor_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_contract_sync_booking();

-- ----------------------------------------------------------------------------
-- 6. Backfill the booking marker for already-active linked contracts.
-- ----------------------------------------------------------------------------

UPDATE public.event_vendors ev
   SET contract_signed_at = sub.first_active_at
  FROM (
    SELECT vc.event_vendor_id,
           MIN(COALESCE(vc.fully_signed_at, vc.sent_for_signature_at, vc.created_at)) AS first_active_at
      FROM public.vendor_contracts vc
     WHERE vc.event_vendor_id IS NOT NULL
       AND vc.status IN ('sent_for_signature', 'fully_signed')
     GROUP BY vc.event_vendor_id
  ) sub
 WHERE ev.vendor_id = sub.event_vendor_id
   AND ev.contract_signed_at IS NULL;

COMMIT;
