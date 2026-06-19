-- vendor_editorial_credit_slot_and_backfill
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- =============================================================================
-- Vendor editorial-credit + #1-pick wiring fix (owner-approved 2026-06-19)
-- -----------------------------------------------------------------------------
-- Two cross-account bugs are fixed here + in the companion app change
-- (app/dashboard/[eventId]/vendors/actions.ts):
--
--   (A) event_vendors.linked_vendor_profile_id was NEVER written by the lock
--       path. That FK is what the public stats view + editorial credit join on
--       (20260515020000_public_stats_exclusion.sql: ev.linked_vendor_profile_id
--       = vp.vendor_profile_id), so the public completed-events count stayed
--       permanently 0 and the Pro/Enterprise "From Your Vendors" editorial
--       credit never fired. The app now stamps it on the generic (date/#2-path)
--       lock write; THIS migration fixes the Enterprise (#3) slot path below.
--
--   (M2) selection_match_rank = 1 + linked_vendor_profile_id were only stamped
--        on the date-path lock write. The Enterprise time-slot path commits the
--        lock atomically INSIDE acquire_service_time_slot's slot lock and never
--        touched either column, so a slot-booked vendor was never flagged as
--        the #1 pick and never earned editorial credit. We CREATE OR REPLACE
--        the function so its consuming UPDATE sets status + slot +
--        selection_match_rank=1 + linked_vendor_profile_id ATOMICALLY, all
--        inside the same FOR UPDATE lock. linked_vendor_profile_id is set to
--        the row's own marketplace_vendor_id (same FK target:
--        vendor_profiles.vendor_profile_id) — a self-column reference in the
--        SET clause reads the pre-UPDATE row value, which is correct.
--
--   (backfill) One-time, idempotent: any already-locked/paid/delivered/complete
--        booking that has a marketplace_vendor_id but a NULL
--        linked_vendor_profile_id gets back-attributed so historical completed
--        events finally count toward each vendor's public stat.
--
-- Idempotent: CREATE OR REPLACE is re-runnable; the backfill UPDATE is scoped
-- to rows where linked_vendor_profile_id IS NULL so re-applying is a no-op.
-- Backward-compatible: the app behaves correctly whether or not this migration
-- has been applied (the generic-path write already stamps both columns; this
-- only repairs the slot path + history).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- (M2) Enterprise slot path — stamp #1-pick + editorial credit atomically.
-- Verbatim copy of 20260928000000_vendor_service_time_slots.sql's function,
-- preserving ALL existing behavior; only the consuming UPDATE's SET list grows.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acquire_service_time_slot(
  p_event_id   UUID,
  p_vendor_id  UUID,   -- event_vendors.vendor_id (the booking row PK)
  p_service_id UUID,
  p_slot_id    UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date      DATE;
  v_precision TEXT;
  v_event_ids UUID[];
  v_capacity  INT;
  v_used      INT;
BEGIN
  -- Couple-only authorization (RLS is bypassed under DEFINER, so check here).
  IF p_event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  -- Canonical date + precision (read event_date, NOT the wedding_date mirror).
  SELECT event_date, event_date_precision
    INTO v_date, v_precision
    FROM public.events
   WHERE event_id = p_event_id;

  -- No usable calendar day -> degrade open (caller booking proceeds date-only).
  IF v_date IS NULL OR v_precision IS DISTINCT FROM 'day' THEN
    RETURN jsonb_build_object('status', 'no_date');
  END IF;

  -- Lock the chosen slot row. FOR UPDATE serializes concurrent acquires of the
  -- SAME slot; the consuming event_vendors write below stays inside this lock.
  SELECT slot_capacity
    INTO v_capacity
    FROM public.vendor_service_time_slots
   WHERE slot_id = p_slot_id
     AND vendor_service_id = p_service_id
     AND is_active
   FOR UPDATE;

  IF v_capacity IS NULL THEN
    RETURN jsonb_build_object('status', 'slot_not_found');
  END IF;

  -- Same-date events (date-only collision space).
  SELECT array_agg(event_id) INTO v_event_ids
    FROM public.events
   WHERE event_date = v_date
     AND event_date_precision = 'day';

  -- Occupancy = OTHER confirmed bookings on THIS slot, same date.
  SELECT count(*) INTO v_used
    FROM public.event_vendors
   WHERE service_time_slot_id = p_slot_id
     AND status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND archived_at IS NULL
     AND event_id = ANY (v_event_ids)
     AND vendor_id <> p_vendor_id;

  IF v_used >= v_capacity THEN
    RETURN jsonb_build_object('status', 'full');
  END IF;

  -- Capacity available -> consume it under the held lock. This is the
  -- capacity-consuming write; it MUST live here (not in the app) so the guard
  -- is atomic. Scoped to the couple's own booking row.
  --
  -- selection_match_rank = 1 + linked_vendor_profile_id (QA fix 2026-06-19):
  -- the slot-booked vendor IS the couple's #1 pick and must earn marketplace
  -- editorial credit, exactly like the date-path lock write in the app. Both
  -- are set inside this same lock so the slot booking is fully attributed
  -- atomically. linked_vendor_profile_id <- the row's own marketplace_vendor_id
  -- (same FK target vendor_profiles.vendor_profile_id); a SET self-reference
  -- reads the pre-UPDATE value. NULL for off-platform rows (no profile), which
  -- is correct — slots only exist for marketplace vendors anyway.
  UPDATE public.event_vendors
     SET status = 'contracted',
         service_time_slot_id = p_slot_id,
         selection_match_rank = 1,
         linked_vendor_profile_id = marketplace_vendor_id,
         updated_at = NOW()
   WHERE vendor_id = p_vendor_id
     AND event_id = p_event_id;

  IF NOT FOUND THEN
    -- Booking row vanished / not on this event — treat as not found.
    RETURN jsonb_build_object('status', 'slot_not_found');
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'slot_id', p_slot_id);
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_service_time_slot(UUID,UUID,UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_service_time_slot(UUID,UUID,UUID,UUID) TO authenticated;

COMMENT ON FUNCTION public.acquire_service_time_slot(UUID,UUID,UUID,UUID) IS
  'Tier #3 atomic slot acquire (owner 2026-06-09 · couple picks slot). Locks the chosen slot row FOR UPDATE, counts the full CONFIRMED_VENDOR_STATUSES set on events.event_date (precision=day), and consumes capacity by updating the couple''s event_vendors row (status->contracted + service_time_slot_id + selection_match_rank=1 + linked_vendor_profile_id<-marketplace_vendor_id, QA fix 2026-06-19) inside the same lock. Couple-only auth via current_couple_event_ids(). Returns a JSONB status envelope (ok/full/not_authorized/slot_not_found/no_date).';

-- -----------------------------------------------------------------------------
-- (backfill) Back-attribute already-confirmed marketplace bookings whose
-- linked_vendor_profile_id was never written (every lock before this fix).
-- Idempotent: only touches rows where the FK is still NULL.
-- -----------------------------------------------------------------------------
UPDATE public.event_vendors
   SET linked_vendor_profile_id = marketplace_vendor_id
 WHERE linked_vendor_profile_id IS NULL
   AND marketplace_vendor_id IS NOT NULL
   AND status IN ('contracted', 'deposit_paid', 'delivered', 'complete');

COMMIT;

-- =============================================================================
-- VERIFICATION:
--   SELECT proname FROM pg_proc WHERE proname='acquire_service_time_slot';
--   -- function body should now SET selection_match_rank + linked_vendor_profile_id
--   SELECT count(*) FROM public.event_vendors
--     WHERE linked_vendor_profile_id IS NULL
--       AND marketplace_vendor_id IS NOT NULL
--       AND status IN ('contracted','deposit_paid','delivered','complete');
--   -- expect 0 after this migration
-- =============================================================================
