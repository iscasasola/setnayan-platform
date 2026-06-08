-- ============================================================================
-- 20260928000000_vendor_service_time_slots.sql
-- Vendor tier feature #3 — Enterprise-only TIME-BOUND booking slots.
-- Canonical: Vendor_Tier_Capability_Matrix_2026-06-07.md. Delivers the
-- "separate time-of-day model on top" that 20260925000001_vendor_services_
-- daily_capacity.sql (#2) deferred.
--
-- An Enterprise vendor plots named per-service time windows ("AM Ceremony",
-- "Grand Ballroom"), each with its own per-day capacity. When a service has
-- >=1 active slot, finalizeVendor enforces PER-SLOT same-date counts and
-- SKIPS vendor_services.daily_capacity (#2). Services with zero slots keep #2.
--
-- COUPLE PICKS THE SLOT (owner 2026-06-09 — overrides the auto-assign-first-
-- open draft). At lock/finalize the couple chooses a named slot; the chosen
-- slot id is passed into acquire_service_time_slot which validates capacity and
-- consumes it atomically.
--
-- Tier gate (slotsPerDay === Infinity = Enterprise) enforced APP-SIDE on
-- plot/edit (mirrors daily_capacity's app-side tier cap). SQL owns structural
-- CHECKs + RLS only.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_service_time_slots (
  slot_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  vendor_service_id  UUID NOT NULL
                       REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  slot_label         TEXT NOT NULL
                       CHECK (length(slot_label) > 0 AND length(slot_label) <= 80),
  -- TIME, not TIMESTAMPTZ: a slot is a recurring window-of-day reused every date.
  start_time         TIME NOT NULL,
  end_time           TIME NOT NULL,
  slot_capacity      INT  NOT NULL DEFAULT 1
                       CHECK (slot_capacity > 0 AND slot_capacity <= 50),
  display_order      INT  NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT vsts_window_ordered CHECK (end_time > start_time),
  CONSTRAINT vsts_start_granularity
    CHECK (EXTRACT(MINUTE FROM start_time) IN (0,30) AND EXTRACT(SECOND FROM start_time) = 0),
  CONSTRAINT vsts_end_granularity
    CHECK (EXTRACT(MINUTE FROM end_time)   IN (0,30) AND EXTRACT(SECOND FROM end_time)   = 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS vsts_service_label_uniq
  ON public.vendor_service_time_slots (vendor_service_id, lower(slot_label))
  WHERE is_active;

CREATE INDEX IF NOT EXISTS vsts_service_active_idx
  ON public.vendor_service_time_slots (vendor_service_id, display_order, start_time)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS vsts_owner_idx
  ON public.vendor_service_time_slots (vendor_profile_id);

COMMENT ON TABLE public.vendor_service_time_slots IS
  'Vendor tier feature #3 (Enterprise-only · owner 2026-06-07). Named per-service time windows, each with its own per-day capacity. When a service has >=1 active row, finalizeVendor enforces per-slot same-date counts and ignores vendor_services.daily_capacity (#2). The couple PICKS the slot at lock (owner 2026-06-09). Tier gate (slotsPerDay Infinity) enforced app-side. Time-of-day is the vendor''s operational partition; the wedding event itself is date-granular (events.event_date DATE, gated on event_date_precision=''day'').';

-- Booking -> slot binding (nullable; only set for slot-bearing services).
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS service_time_slot_id UUID NULL
    REFERENCES public.vendor_service_time_slots(slot_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_vendors.service_time_slot_id IS
  'Tier #3: the time-bound slot this confirmed booking occupies. NULL for date-only / #2 bookings. ON DELETE SET NULL so deleting a slot degrades the booking to date-only, never orphans it.';

CREATE INDEX IF NOT EXISTS event_vendors_slot_status_idx
  ON public.event_vendors (service_time_slot_id, status)
  WHERE service_time_slot_id IS NOT NULL AND archived_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS at CREATE — same idiom as vendor_branches (20260530010000_iteration_0006
-- _v2_1_amendment_2.sql:264-279), but keyed on the LOCAL vendor_profile_id
-- (vendor_branches keys parent_vendor_profile_id; this table denormalizes
-- vendor_profile_id, so the column differs — NOT a verbatim copy).
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendor_service_time_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vsts_vendor_access ON public.vendor_service_time_slots;
CREATE POLICY vsts_vendor_access
  ON public.vendor_service_time_slots FOR ALL
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vsts_admin_read ON public.vendor_service_time_slots;
CREATE POLICY vsts_admin_read
  ON public.vendor_service_time_slots FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Couple read — the couple picks the slot at lock + renders its label on a
-- booking they own. Scoped to current_couple_event_ids() (member_type='couple'
-- ONLY — matches the event_vendors couple-write boundary; deliberately NOT the
-- guest-inclusive current_event_ids(), verifier C2). Covers BOTH:
--   (a) slots already bound to one of the couple's bookings, AND
--   (b) the candidate slots of a service the couple is about to lock (so the
--       picker can list them). Both gate on a marketplace booking the couple
--       owns referencing the slot's service.
DROP POLICY IF EXISTS vsts_couple_read ON public.vendor_service_time_slots;
CREATE POLICY vsts_couple_read
  ON public.vendor_service_time_slots FOR SELECT
  TO authenticated
  USING (
    vendor_service_id IN (
      SELECT ev.service_id
      FROM public.event_vendors ev
      WHERE ev.event_id IN (SELECT public.current_couple_event_ids())
        AND ev.service_id IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- Atomic acquire RPC — the couple passes the chosen slot_id; the RPC locks
-- THAT slot row (FOR UPDATE), counts the FULL confirmed set on the event's
-- date, and — under the same lock — performs the capacity-consuming
-- event_vendors write (status -> 'contracted' + service_time_slot_id). Doing
-- the consuming write INSIDE the locked region is what actually closes the
-- TOCTOU (verifier C3): the read-then-write is one transaction, the lock is
-- held until COMMIT. SECURITY DEFINER so it can lock + count across events;
-- auth is checked explicitly against current_couple_event_ids() (verifier C2).
--
-- Returns a JSONB envelope:
--   { "status": "ok",   "slot_id": "<uuid>" }   -> consumed; row updated
--   { "status": "full" }                          -> chosen slot at capacity
--   { "status": "not_authorized" }                -> caller is not the couple
--   { "status": "slot_not_found" }                -> slot inactive / wrong svc
--   { "status": "no_date" }                       -> degrade open (caller falls back)
-- 'ok' counts include the full CONFIRMED_VENDOR_STATUSES set (verifier C1/C5).
-- Only engages when event_date_precision = 'day' (verifier C4) — caller checks
-- precision before invoking, the RPC degrades open ('no_date') otherwise.
-- ---------------------------------------------------------------------------
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
  UPDATE public.event_vendors
     SET status = 'contracted',
         service_time_slot_id = p_slot_id,
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
  'Tier #3 atomic slot acquire (owner 2026-06-09 · couple picks slot). Locks the chosen slot row FOR UPDATE, counts the full CONFIRMED_VENDOR_STATUSES set on events.event_date (precision=day), and consumes capacity by updating the couple''s event_vendors row (status->contracted + service_time_slot_id) inside the same lock. Couple-only auth via current_couple_event_ids(). Returns a JSONB status envelope (ok/full/not_authorized/slot_not_found/no_date).';

COMMIT;

-- =============================================================================
-- VERIFICATION:
--   \d public.vendor_service_time_slots
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.vendor_service_time_slots'::regclass;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='event_vendors' AND column_name='service_time_slot_id';
--   SELECT proname FROM pg_proc WHERE proname='acquire_service_time_slot';
-- =============================================================================
