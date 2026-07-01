-- vendor_gapfix_partnership_immutable_and_slot_daystate_gate
--
-- Three idempotent corrective fixes from the vendor-dashboard reorg gap-check:
--
--   C1 — vendor_partnerships_lock_immutable_cols() referenced NEW.target_id /
--        OLD.target_id, but vendor_partnerships has NO target_id column (that
--        column lives on admin_approval_requests). The BEFORE UPDATE trigger
--        therefore RAISEd 42703 "record new has no field target_id" on EVERY
--        non-admin partnership UPDATE — bricking accept / decline / withdraw.
--        We re-define the function WITHOUT the two target_id lines; the other
--        pinned columns still close the forged-endorsement hole.
--
--   H1 — acquire_service_time_slot() (the couple slot-booking RPC) never read
--        vendor_calendar_day_states, so a couple could book a LOCKED (hard
--        hold) or WHITELIST (approve-first) date straight through — the exact
--        double-booking the 6-state taxonomy (20270403356945) was meant to stop
--        for the pool path. We re-define it to honor the SAME precedence
--        (closure block already gates via capacity elsewhere → LOCKED →
--        WHITELIST → capacity) BEFORE it consumes the slot, returning
--        status='locked' | 'whitelist'. The slot path has no pool, so it checks
--        the vendor's ORG-WIDE + slot-scoped-null day states (pool_id IS NULL).
--
--   L5 — drop the stale ungated 1-arg create_vendor_token_purchase(TEXT)
--        overload (defensive: 20270401611377 already dropped it before adding
--        the member-aware 2-arg form, but re-issuing DROP ... IF EXISTS
--        guarantees no ungated path can co-exist on any DB regardless of
--        migration-apply order). No caller uses the 1-arg form (app passes
--        p_pack_sku_code + p_holder_user_id).
--
-- KEEP IDEMPOTENT: CREATE OR REPLACE FUNCTION · DROP FUNCTION IF EXISTS.

BEGIN;

-- ============================================================================
-- C1 · vendor_partnerships_lock_immutable_cols — remove the target_id lines.
-- Byte-identical to 20270405045663 EXCEPT the two `target_id` comparisons are
-- gone (that column does not exist on this table). The remaining pins still
-- prevent a recipient from repointing the counterparty / relationship type /
-- commercial terms and self-publishing a forged endorsement.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.vendor_partnerships_lock_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Admins own the "admins manage vendor partnerships" policy; let them correct.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.recommending_vendor_id  IS DISTINCT FROM OLD.recommending_vendor_id
     OR NEW.recommended_vendor_id   IS DISTINCT FROM OLD.recommended_vendor_id
     OR NEW.relationship_type       IS DISTINCT FROM OLD.relationship_type
     OR NEW.additional_fee_centavos IS DISTINCT FROM OLD.additional_fee_centavos
     OR NEW.discount_pct            IS DISTINCT FROM OLD.discount_pct
     OR NEW.covered_plan_groups     IS DISTINCT FROM OLD.covered_plan_groups
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_PARTNERSHIP_FIELDS: only status may change after a partnership is created (the counterparty, relationship type, and terms are locked to prevent forged endorsements)';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists (20270405045663); re-assert idempotently in case this
-- migration runs on a DB where the trigger was never created.
DROP TRIGGER IF EXISTS trg_vendor_partnerships_lock_immutable ON public.vendor_partnerships;
CREATE TRIGGER trg_vendor_partnerships_lock_immutable
  BEFORE UPDATE ON public.vendor_partnerships
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_partnerships_lock_immutable_cols();

-- ============================================================================
-- H1 · acquire_service_time_slot — honor the 6-state day taxonomy before
-- consuming the slot. Same precedence + couple-privacy posture as
-- acquire_schedule_pools (20270403356945). Everything else is byte-identical to
-- 20270129232225 (couple auth, canonical date read, FOR UPDATE slot lock,
-- occupancy math, atomic status→contracted + selection_match_rank=1 +
-- linked_vendor_profile_id write, backfill semantics).
-- ============================================================================
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
  v_date       DATE;
  v_precision  TEXT;
  v_event_ids  UUID[];
  v_capacity   INT;
  v_used       INT;
  v_vendor_pid UUID;
  v_locked     BOOLEAN;
  v_whitelist  BOOLEAN;
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
  -- Also read the owning vendor_profile_id for the day-state gate below.
  SELECT slot_capacity, vendor_profile_id
    INTO v_capacity, v_vendor_pid
    FROM public.vendor_service_time_slots
   WHERE slot_id = p_slot_id
     AND vendor_service_id = p_service_id
     AND is_active
   FOR UPDATE;

  IF v_capacity IS NULL THEN
    RETURN jsonb_build_object('status', 'slot_not_found');
  END IF;

  -- NET-NEW day-state gate (H1). The slot path has no pool, so an org-wide OR
  -- unscoped (pool_id IS NULL) vendor-set state applies. Precedence mirrors
  -- acquire_schedule_pools: LOCKED (hard hold, cannot book) → WHITELIST
  -- (approve-first, held for the vendor). Returned BEFORE consuming the slot so
  -- a locked/whitelist date can never slip through. Couples see only a generic
  -- "unavailable" copy in the app (never who / why / which state).
  SELECT
    bool_or(ds.day_state = 'locked'),
    bool_or(ds.day_state = 'whitelist')
    INTO v_locked, v_whitelist
    FROM public.vendor_calendar_day_states ds
   WHERE ds.vendor_profile_id = v_vendor_pid
     AND ds.state_date = v_date
     AND ds.pool_id IS NULL;
  IF COALESCE(v_locked, FALSE) THEN
    RETURN jsonb_build_object('status', 'locked', 'slot_id', p_slot_id);
  END IF;
  IF COALESCE(v_whitelist, FALSE) THEN
    RETURN jsonb_build_object('status', 'whitelist', 'slot_id', p_slot_id);
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
  -- is atomic. Scoped to the couple's own booking row. selection_match_rank=1 +
  -- linked_vendor_profile_id stamped atomically (QA fix 2026-06-19).
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
  'Tier #3 atomic slot acquire (owner 2026-06-09 · couple picks slot). PHASE 5 gapfix: now also honors vendor-set day states — precedence LOCKED (hard hold) → WHITELIST (approve-first hold) → capacity — read from vendor_calendar_day_states (org-wide / pool_id IS NULL) BEFORE consuming the slot, so a held date can never be double-booked. Locks the chosen slot row FOR UPDATE, counts confirmed bookings on events.event_date (precision=day), consumes capacity by updating the couple''s event_vendors row atomically. Couple-only auth via current_couple_event_ids(). Returns a JSONB status envelope (ok/full/locked/whitelist/not_authorized/slot_not_found/no_date).';

-- ============================================================================
-- L5 · drop the stale ungated 1-arg create_vendor_token_purchase(TEXT) overload
-- (defensive; no-op if already dropped). The verification-gated member-aware
-- 2-arg (TEXT, UUID) form — the only one the app calls — is untouched.
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_vendor_token_purchase(TEXT);

COMMIT;

-- ============================================================================
-- VERIFICATION:
--   -- C1: a non-admin recipient can accept a proposed row; cannot mutate
--   --     relationship_type / recommending_vendor_id in the same UPDATE.
--   -- H1: SELECT public.set_vendor_calendar_day_state('<vendor>', NULL,
--   --       '2026-12-25', 'locked', 'hold'); then a couple acquire on a slot
--   --       whose service belongs to that vendor on 2026-12-25 must return
--   --       {"status":"locked"}.
--   -- L5: SELECT count(*) FROM pg_proc WHERE proname='create_vendor_token_purchase';
--   --       expect only the (TEXT, UUID) overload to remain.
-- ============================================================================
