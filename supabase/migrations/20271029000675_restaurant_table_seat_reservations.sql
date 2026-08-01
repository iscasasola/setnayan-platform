-- ============================================================================
-- 20271029000675_restaurant_table_seat_reservations.sql
--
-- "SETNAYAN HOLDS THE RESERVATION" (owner 2026-08-01).
-- Asked whether to link out to the restaurant's own booking page or to hold the
-- reservation ourselves, the owner chose to hold it: real availability, real
-- confirmations, real cancellations.
--
-- Canonical: Setnayan_AI_Gap_Leaves_Travel_Dinner_Date_2026-07-17.md Part C-ter
--   "NEW CAPABILITY — restaurant table reservation. Book a table by restaurant x
--    meal-timeslot x party-size, with confirm-back from the restaurant. Settle
--    on-site, 0% commission, Setnayan holds no money."
--
-- ---------------------------------------------------------------------------
-- WHAT ALREADY EXISTS — AND IS DELIBERATELY NOT REBUILT
-- ---------------------------------------------------------------------------
--   * public.vendor_service_time_slots (20260928000000) — named per-service
--     windows ("AM Ceremony", "7PM Seating") with start/end TIME and a
--     slot_capacity. This IS the supply primitive. Reused as-is.
--   * public.event_vendors.service_time_slot_id — booking -> slot binding.
--   * public.acquire_service_time_slot(...) — the tier-#3 atomic acquire.
--   * public.vendor_schedule_pool_bookings — DAY-granular whole-day pool. A
--     different primitive (a photographer books your whole wedding day); a
--     table at 7pm is not that, and the two are NOT conflated here.
--
-- ---------------------------------------------------------------------------
-- THE GAP THIS MIGRATION CLOSES (established against prod, not against specs)
-- ---------------------------------------------------------------------------
-- 1. CAPACITY IS COUNTED IN BOOKINGS, NOT IN PEOPLE. acquire_service_time_slot
--    does `count(*)` of confirmed event_vendors rows. A restaurant's 7pm
--    seating that holds 40 COVERS would therefore admit 40 PARTIES. Party size
--    is the entire point of a table reservation and has nowhere to live.
-- 2. THE RESERVATION HAS NO DATE OF ITS OWN. The tier-#3 acquire derives the
--    date from events.event_date. A dining date on a travel itinerary, or the
--    rehearsal dinner the night BEFORE the wedding, cannot be expressed.
-- 3. THERE IS NO RESERVATION RECORD TO CANCEL. Release is implicit in a status
--    filter over event_vendors, and vendor_status has no 'cancelled' label at
--    all (considering|shortlisted|contracted|deposit_paid|delivered|complete).
-- 4. ONE event_vendors ROW PER (event, vendor) — so a couple cannot hold two
--    tables at the same restaurant on two dates.
--
-- ---------------------------------------------------------------------------
-- HOW DOUBLE-BOOKING IS MADE IMPOSSIBLE
-- ---------------------------------------------------------------------------
-- Capacity is a SUM (seats), not a count, so a unique index cannot express it.
-- The guard is a per-(slot x date) ledger row plus a CHECK:
--
--     CHECK (seats_taken >= 0 AND seats_taken <= seats_capacity)
--
-- and a single conditional UPDATE that both locks and consumes:
--
--     UPDATE ... SET seats_taken = seats_taken + n
--      WHERE slot_id = ? AND reserved_date = ?
--        AND seats_taken + n <= seats_capacity
--
-- Under READ COMMITTED a concurrent transaction BLOCKS on that row lock and
-- then RE-EVALUATES the WHERE against the newly committed row (EvalPlanQual),
-- so the seats_taken it adds to is always the latest. There is no
-- read-then-write in application code, and the CHECK is a second, independent
-- belt: even a future caller that writes the UPDATE wrong cannot push the
-- ledger past capacity — the transaction aborts.
--
-- The lock domain is exactly (slot x date), NOT the slot: a reservation for
-- 5 Aug never contends with one for 25 Dec on the same 7pm seating.
--
-- ALL WRITES GO THROUGH THE SECURITY DEFINER RPCs. authenticated is granted
-- SELECT ONLY on both tables, so seats_taken cannot drift from the reservations
-- that justify it — the denormalised counter has exactly one writer.
--
-- ---------------------------------------------------------------------------
-- WHY A NEW seat_capacity COLUMN INSTEAD OF REUSING slot_capacity
-- ---------------------------------------------------------------------------
-- slot_capacity ALREADY MEANS "bookings" to acquire_service_time_slot. Making
-- the same column mean "covers" in a second code path is precisely the
-- two-vocabularies-that-never-match defect that made all three specialization
-- desks unreachable in prod. It is also literally too small: slot_capacity is
-- CHECKed <= 50 and a single restaurant seating can be 120 covers.
--
-- So seat_capacity is a SEPARATE, NULLABLE column, and its NULL-ness is the
-- discriminator with no extra flag:
--     seat_capacity IS NULL     -> a tier-#3 booking slot (unchanged behaviour)
--     seat_capacity IS NOT NULL -> a seated slot open to table reservations
-- The reserve RPC FAILS CLOSED on NULL. Nothing that ships today changes.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Supply — seats on an existing named window.
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendor_service_time_slots
  ADD COLUMN IF NOT EXISTS seat_capacity INT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.vendor_service_time_slots'::regclass
       AND conname  = 'vsts_seat_capacity_bounds'
  ) THEN
    ALTER TABLE public.vendor_service_time_slots
      ADD CONSTRAINT vsts_seat_capacity_bounds
      CHECK (seat_capacity IS NULL OR (seat_capacity > 0 AND seat_capacity <= 2000));
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_service_time_slots.seat_capacity IS
  'Table-reservation covers for this window. NULL = not a seated slot (tier-#3 booking slot; slot_capacity governs and counts BOOKINGS). NOT NULL = reservable by the seat, and slot_capacity is irrelevant to that path. Deliberately a separate column from slot_capacity: reusing one column for two units is how the tile-vs-category vocabulary defect happened, and slot_capacity is CHECKed <= 50 which cannot express a 120-cover seating.';

-- ---------------------------------------------------------------------------
-- 2. The (slot x date) ledger — where atomicity lives.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_slot_day_state (
  slot_id        UUID NOT NULL
                   REFERENCES public.vendor_service_time_slots(slot_id) ON DELETE CASCADE,
  reserved_date  DATE NOT NULL,
  -- SNAPSHOT of seat_capacity taken when the date first opened. A restaurant
  -- that shrinks its 7pm seating tomorrow must NOT retroactively invalidate
  -- tables already held for next Friday.
  seats_capacity INT  NOT NULL,
  seats_taken    INT  NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sscds_pkey PRIMARY KEY (slot_id, reserved_date),
  CONSTRAINT sscds_capacity_nonneg CHECK (seats_capacity >= 0),
  -- THE BELT. Overselling is not merely "not done" — it is not representable.
  CONSTRAINT sscds_within_capacity  CHECK (seats_taken >= 0 AND seats_taken <= seats_capacity)
);

COMMENT ON TABLE public.service_slot_day_state IS
  'Per-(time-slot x calendar-date) seat ledger for table reservations. seats_taken is the SUM of party_size over reservations in an occupying status (held|confirmed) for that slot+date. Denormalised on purpose: a sum cannot be enforced by a unique index, so the row is the lock and CHECK (seats_taken <= seats_capacity) is the hard guard. Exactly one writer exists (the SECURITY DEFINER reserve/cancel/capacity RPCs) — authenticated holds SELECT only — so the counter cannot drift from the reservations behind it. seats_capacity is snapshotted per date so a later capacity edit never invalidates a date already holding reservations; set it to 0 to close a date.';

-- ---------------------------------------------------------------------------
-- 3. The reservation record.
--    'held' is a REAL hold: it consumes capacity the moment the couple books.
--    That is what "Setnayan holds the reservation" means, as opposed to linking
--    out. The restaurant then confirms (held -> confirmed, capacity unchanged)
--    or cancels (-> cancelled, capacity released). A pending state that did NOT
--    consume capacity would let the table be sold twice while it was pending.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_slot_reservations (
  reservation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id            UUID NOT NULL
                       REFERENCES public.vendor_service_time_slots(slot_id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  vendor_service_id  UUID NOT NULL
                       REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  event_id           UUID NOT NULL
                       REFERENCES public.events(event_id) ON DELETE CASCADE,
  reserved_date      DATE NOT NULL,
  party_size         INT  NOT NULL CHECK (party_size > 0 AND party_size <= 2000),
  status             TEXT NOT NULL DEFAULT 'held'
                       CHECK (status IN ('held', 'confirmed', 'cancelled')),
  guest_note         TEXT NULL CHECK (guest_note IS NULL OR length(guest_note) <= 500),
  created_by         UUID NULL,
  confirmed_at       TIMESTAMPTZ NULL,
  cancelled_at       TIMESTAMPTZ NULL,
  cancelled_by       UUID NULL,
  cancel_reason      TEXT NULL CHECK (cancel_reason IS NULL OR length(cancel_reason) <= 300),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A cancelled row must carry its timestamp, and a live row must not.
  CONSTRAINT sssr_cancel_stamp CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR (status <> 'cancelled' AND cancelled_at IS NULL)
  ),
  CONSTRAINT sssr_confirm_stamp CHECK (
    status <> 'confirmed' OR confirmed_at IS NOT NULL
  )
);

-- One live table per event per (slot x date). A second attempt is a mistake,
-- not a second table; the couple should raise party_size instead.
CREATE UNIQUE INDEX IF NOT EXISTS sssr_one_live_per_event_slot_date
  ON public.service_slot_reservations (slot_id, reserved_date, event_id)
  WHERE status IN ('held', 'confirmed');

-- The restaurant's book for a service day.
CREATE INDEX IF NOT EXISTS sssr_vendor_date_idx
  ON public.service_slot_reservations (vendor_profile_id, reserved_date)
  WHERE status IN ('held', 'confirmed');

CREATE INDEX IF NOT EXISTS sssr_event_idx
  ON public.service_slot_reservations (event_id);

CREATE INDEX IF NOT EXISTS sssr_slot_date_idx
  ON public.service_slot_reservations (slot_id, reserved_date);

COMMENT ON TABLE public.service_slot_reservations IS
  'A held table at a vendor time slot on a specific calendar date, for a specific party size. Its own reserved_date deliberately does NOT come from events.event_date: a dining date on a travel itinerary, or a rehearsal dinner the night before the wedding, has a date the event row cannot express. Statuses held|confirmed OCCUPY capacity; cancelled does not. Money is never held — settle on-site, 0% commission (owner, Part C-ter).';

COMMENT ON COLUMN public.service_slot_reservations.status IS
  'held = the couple booked and the seats are consumed NOW (this is the point of holding the reservation rather than linking out). confirmed = the restaurant confirmed back; capacity unchanged. cancelled = seats released. Only held|confirmed count against service_slot_day_state.seats_taken.';

-- ---------------------------------------------------------------------------
-- 4. RLS at CREATE TABLE time + the REVOKE every relation in public needs.
--    authenticated gets SELECT ONLY — every mutation is an RPC, which is what
--    keeps the ledger and the reservations from ever disagreeing.
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_slot_day_state     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_slot_reservations  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.service_slot_day_state    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.service_slot_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.service_slot_day_state    TO authenticated;
GRANT SELECT ON TABLE public.service_slot_reservations TO authenticated;

-- Vendor reads its own slots' availability + its own book.
DROP POLICY IF EXISTS sscds_vendor_read ON public.service_slot_day_state;
CREATE POLICY sscds_vendor_read
  ON public.service_slot_day_state FOR SELECT
  TO authenticated
  USING (
    slot_id IN (
      SELECT s.slot_id FROM public.vendor_service_time_slots s
       WHERE s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

-- Couple reads availability for services it has a booking row against — the
-- SAME predicate shape as the shipped vsts_couple_read policy, so this adds no
-- new class of readable row beyond the slot rows they can already see.
DROP POLICY IF EXISTS sscds_couple_read ON public.service_slot_day_state;
CREATE POLICY sscds_couple_read
  ON public.service_slot_day_state FOR SELECT
  TO authenticated
  USING (
    slot_id IN (
      SELECT s.slot_id FROM public.vendor_service_time_slots s
       WHERE s.vendor_service_id IN (
         SELECT ev.service_id FROM public.event_vendors ev
          WHERE ev.event_id IN (SELECT public.current_couple_event_ids())
            AND ev.service_id IS NOT NULL
       )
    )
  );

DROP POLICY IF EXISTS sscds_admin_read ON public.service_slot_day_state;
CREATE POLICY sscds_admin_read
  ON public.service_slot_day_state FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS sssr_couple_read ON public.service_slot_reservations;
CREATE POLICY sssr_couple_read
  ON public.service_slot_reservations FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS sssr_vendor_read ON public.service_slot_reservations;
CREATE POLICY sssr_vendor_read
  ON public.service_slot_reservations FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS sssr_admin_read ON public.service_slot_reservations;
CREATE POLICY sssr_admin_read
  ON public.service_slot_reservations FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. reserve_service_slot_seats — the atomic hold.
--     ok | full | already_reserved | not_reservable | slot_not_found
--     | not_authorized | date_in_past | invalid_party_size | invalid_input
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_service_slot_seats(
  p_event_id      UUID,
  p_slot_id       UUID,
  p_reserved_date DATE,
  p_party_size    INT,
  p_guest_note    TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat_capacity INT;
  v_vendor_id     UUID;
  v_service_id    UUID;
  v_reservation   UUID;
  v_taken         INT;
  v_capacity      INT;
BEGIN
  IF p_event_id IS NULL OR p_slot_id IS NULL OR p_reserved_date IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 2000 THEN
    RETURN jsonb_build_object('status', 'invalid_party_size');
  END IF;

  -- RLS is bypassed under DEFINER, so authorization is explicit. Couple-only,
  -- matching the acquire_service_time_slot boundary (member_type='couple';
  -- deliberately NOT the guest-inclusive current_event_ids()).
  IF p_event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  IF p_reserved_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('status', 'date_in_past');
  END IF;

  SELECT s.seat_capacity, s.vendor_profile_id, s.vendor_service_id
    INTO v_seat_capacity, v_vendor_id, v_service_id
    FROM public.vendor_service_time_slots s
   WHERE s.slot_id = p_slot_id
     AND s.is_active;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'slot_not_found');
  END IF;

  -- FAIL CLOSED: a slot the vendor never opened for seating is not reservable.
  IF v_seat_capacity IS NULL THEN
    RETURN jsonb_build_object('status', 'not_reservable');
  END IF;

  -- Clean message for the common case; the partial unique index below is the
  -- actual guard, and the outer handler catches the race.
  IF EXISTS (
    SELECT 1 FROM public.service_slot_reservations r
     WHERE r.slot_id = p_slot_id
       AND r.reserved_date = p_reserved_date
       AND r.event_id = p_event_id
       AND r.status IN ('held', 'confirmed')
  ) THEN
    RETURN jsonb_build_object('status', 'already_reserved');
  END IF;

  -- Open the date if this is its first reservation, snapshotting capacity.
  INSERT INTO public.service_slot_day_state (slot_id, reserved_date, seats_capacity, seats_taken)
  VALUES (p_slot_id, p_reserved_date, v_seat_capacity, 0)
  ON CONFLICT (slot_id, reserved_date) DO NOTHING;

  -- THE ATOMIC CONSUME. Lock + capacity test + write are one statement; a
  -- concurrent caller blocks on this row and re-evaluates the predicate against
  -- the committed value. Never split this into a read and a write.
  UPDATE public.service_slot_day_state d
     SET seats_taken = d.seats_taken + p_party_size,
         updated_at  = NOW()
   WHERE d.slot_id = p_slot_id
     AND d.reserved_date = p_reserved_date
     AND d.seats_taken + p_party_size <= d.seats_capacity
  RETURNING d.seats_taken, d.seats_capacity INTO v_taken, v_capacity;

  IF NOT FOUND THEN
    SELECT d.seats_capacity - d.seats_taken
      INTO v_taken
      FROM public.service_slot_day_state d
     WHERE d.slot_id = p_slot_id AND d.reserved_date = p_reserved_date;
    RETURN jsonb_build_object(
      'status', 'full',
      'seats_remaining', GREATEST(COALESCE(v_taken, 0), 0)
    );
  END IF;

  INSERT INTO public.service_slot_reservations (
    slot_id, vendor_profile_id, vendor_service_id, event_id,
    reserved_date, party_size, status, guest_note, created_by
  ) VALUES (
    p_slot_id, v_vendor_id, v_service_id, p_event_id,
    p_reserved_date, p_party_size, 'held',
    NULLIF(btrim(COALESCE(p_guest_note, '')), ''), auth.uid()
  )
  RETURNING reservation_id INTO v_reservation;

  RETURN jsonb_build_object(
    'status',             'ok',
    'reservation_id',     v_reservation,
    'reservation_status', 'held',
    'seats_taken',        v_taken,
    'seats_remaining',    v_capacity - v_taken
  );

EXCEPTION
  -- The partial unique index fired: a concurrent request for the same
  -- (event, slot, date) won. The handler is on the OUTER block on purpose —
  -- it rolls back the seats_taken increment along with the failed INSERT, so a
  -- lost race can never leak seats. A nested handler would strand them.
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'already_reserved');
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_service_slot_seats(UUID,UUID,DATE,INT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_service_slot_seats(UUID,UUID,DATE,INT,TEXT) TO authenticated;

COMMENT ON FUNCTION public.reserve_service_slot_seats(UUID,UUID,DATE,INT,TEXT) IS
  'Atomically hold seats at a vendor time slot on a date (owner 2026-08-01 "Setnayan holds the reservation"). Couple-only. Consumes capacity immediately via a single conditional UPDATE on the (slot x date) ledger row, then records a held reservation. Returns a JSONB envelope: ok/full/already_reserved/not_reservable/slot_not_found/not_authorized/date_in_past/invalid_party_size/invalid_input.';

-- ---------------------------------------------------------------------------
-- 6. cancel_service_slot_reservation — and the seat actually comes back.
--     ok | already_cancelled | not_found
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_service_slot_reservation(
  p_reservation_id UUID,
  p_reason         TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot  UUID;
  v_date  DATE;
  v_party INT;
BEGIN
  IF p_reservation_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Flip the reservation FIRST, and only from an occupying status. This single
  -- conditional UPDATE is what makes a double release impossible: the second
  -- caller matches no row, returns early, and never reaches the decrement. A
  -- seat is therefore released exactly once, no matter how many cancels land.
  -- Either side may cancel — the couple changing plans, or the restaurant
  -- releasing the table.
  UPDATE public.service_slot_reservations r
     SET status        = 'cancelled',
         cancelled_at  = NOW(),
         cancelled_by  = auth.uid(),
         cancel_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
         updated_at    = NOW()
   WHERE r.reservation_id = p_reservation_id
     AND r.status IN ('held', 'confirmed')
     AND (
       r.event_id IN (SELECT public.current_couple_event_ids())
       OR r.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
     )
  RETURNING r.slot_id, r.reserved_date, r.party_size
       INTO v_slot, v_date, v_party;

  IF NOT FOUND THEN
    -- Not theirs, absent, or already cancelled. Decrement in NONE of these.
    IF EXISTS (
      SELECT 1 FROM public.service_slot_reservations r
       WHERE r.reservation_id = p_reservation_id
         AND (
           r.event_id IN (SELECT public.current_couple_event_ids())
           OR r.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
         )
    ) THEN
      RETURN jsonb_build_object('status', 'already_cancelled');
    END IF;
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- GREATEST(...,0) is defence in depth, not the mechanism: the conditional
  -- UPDATE above is what guarantees this runs once per reservation.
  UPDATE public.service_slot_day_state d
     SET seats_taken = GREATEST(d.seats_taken - v_party, 0),
         updated_at  = NOW()
   WHERE d.slot_id = v_slot
     AND d.reserved_date = v_date;

  RETURN jsonb_build_object(
    'status',         'ok',
    'reservation_id', p_reservation_id,
    'seats_released', v_party
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_service_slot_reservation(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_service_slot_reservation(UUID,TEXT) TO authenticated;

COMMENT ON FUNCTION public.cancel_service_slot_reservation(UUID,TEXT) IS
  'Cancel a held/confirmed table reservation and RELEASE its seats. Callable by the owning couple or by the restaurant that owns the slot. Idempotent: the status flip is a conditional UPDATE, so a second cancel returns already_cancelled without decrementing again — a seat is released exactly once.';

-- ---------------------------------------------------------------------------
-- 7. confirm_service_slot_reservation — the restaurant's confirm-back.
--    Capacity is NOT touched: the seats were already consumed at hold time.
--     ok | not_found | not_held
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_service_slot_reservation(
  p_reservation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status TEXT;
BEGIN
  IF p_reservation_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  UPDATE public.service_slot_reservations r
     SET status       = 'confirmed',
         confirmed_at = NOW(),
         updated_at   = NOW()
   WHERE r.reservation_id = p_reservation_id
     AND r.status = 'held'
     AND r.vendor_profile_id IN (SELECT public.current_vendor_profile_ids());

  IF FOUND THEN
    RETURN jsonb_build_object('status', 'ok', 'reservation_id', p_reservation_id);
  END IF;

  SELECT r.status INTO v_status
    FROM public.service_slot_reservations r
   WHERE r.reservation_id = p_reservation_id
     AND r.vendor_profile_id IN (SELECT public.current_vendor_profile_ids());

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN jsonb_build_object('status', 'not_held', 'reservation_status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_service_slot_reservation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_service_slot_reservation(UUID) TO authenticated;

COMMENT ON FUNCTION public.confirm_service_slot_reservation(UUID) IS
  'Restaurant confirm-back: held -> confirmed. Capacity is deliberately NOT touched — the seats were consumed when the couple held them, which is what stops the table being sold twice while a confirmation is outstanding.';

-- ---------------------------------------------------------------------------
-- 8. set_service_slot_day_capacity — real availability needs a way to close a
--    date (holiday, private buyout) or open extra covers for one date.
--    Refuses to strand reservations already held: capacity can never be set
--    below seats already taken.
--     ok | below_taken | not_reservable | not_authorized | invalid_capacity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_service_slot_day_capacity(
  p_slot_id       UUID,
  p_reserved_date DATE,
  p_seats         INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat_capacity INT;
  v_taken         INT;
  v_found         BOOLEAN;
BEGIN
  IF p_slot_id IS NULL OR p_reserved_date IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  IF p_seats IS NULL OR p_seats < 0 OR p_seats > 2000 THEN
    RETURN jsonb_build_object('status', 'invalid_capacity');
  END IF;

  SELECT s.seat_capacity, TRUE INTO v_seat_capacity, v_found
    FROM public.vendor_service_time_slots s
   WHERE s.slot_id = p_slot_id
     AND s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids());

  IF v_found IS NOT TRUE THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  IF v_seat_capacity IS NULL THEN
    RETURN jsonb_build_object('status', 'not_reservable');
  END IF;

  INSERT INTO public.service_slot_day_state (slot_id, reserved_date, seats_capacity, seats_taken)
  VALUES (p_slot_id, p_reserved_date, p_seats, 0)
  ON CONFLICT (slot_id, reserved_date) DO NOTHING;

  -- Only ever set to >= seats already taken. Refusing here (rather than letting
  -- the CHECK abort the transaction) turns a would-be 500 into an honest answer.
  UPDATE public.service_slot_day_state d
     SET seats_capacity = p_seats,
         updated_at     = NOW()
   WHERE d.slot_id = p_slot_id
     AND d.reserved_date = p_reserved_date
     AND p_seats >= d.seats_taken;

  IF NOT FOUND THEN
    SELECT d.seats_taken INTO v_taken
      FROM public.service_slot_day_state d
     WHERE d.slot_id = p_slot_id AND d.reserved_date = p_reserved_date;
    RETURN jsonb_build_object('status', 'below_taken', 'seats_taken', COALESCE(v_taken, 0));
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'seats_capacity', p_seats);
END;
$$;

REVOKE ALL ON FUNCTION public.set_service_slot_day_capacity(UUID,DATE,INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_service_slot_day_capacity(UUID,DATE,INT) TO authenticated;

COMMENT ON FUNCTION public.set_service_slot_day_capacity(UUID,DATE,INT) IS
  'Vendor-only per-date capacity override: close a date (0 seats) or open extra covers for one date. Never sets capacity below seats already taken — held tables are not stranded by an edit.';

-- ---------------------------------------------------------------------------
-- 9. Post-conditions. Assert the ROLE, not the PUBLIC pseudo-role: REVOKE ...
--    FROM PUBLIC does not remove anon's own explicit default-ACL grant, and a
--    sibling has shipped that exact mistake with anon still able to execute.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_priv TEXT;
  v_tbl  TEXT;
  v_fn   TEXT;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['service_slot_day_state', 'service_slot_reservations'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = ('public.' || v_tbl)::regclass AND relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS not enabled on %', v_tbl;
    END IF;

    FOREACH v_priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF has_table_privilege('anon', 'public.' || v_tbl, v_priv) THEN
        RAISE EXCEPTION 'anon holds % on %', v_priv, v_tbl;
      END IF;
    END LOOP;

    -- authenticated must hold SELECT and NOTHING else: the single-writer
    -- property is the only reason seats_taken can be trusted.
    IF NOT has_table_privilege('authenticated', 'public.' || v_tbl, 'SELECT') THEN
      RAISE EXCEPTION 'authenticated cannot SELECT %', v_tbl;
    END IF;
    FOREACH v_priv IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      IF has_table_privilege('authenticated', 'public.' || v_tbl, v_priv) THEN
        RAISE EXCEPTION 'authenticated holds % on % — the ledger must have exactly one writer', v_priv, v_tbl;
      END IF;
    END LOOP;
  END LOOP;

  FOREACH v_fn IN ARRAY ARRAY[
    'reserve_service_slot_seats(uuid,uuid,date,integer,text)',
    'cancel_service_slot_reservation(uuid,text)',
    'confirm_service_slot_reservation(uuid)',
    'set_service_slot_day_capacity(uuid,date,integer)'
  ] LOOP
    IF has_function_privilege('anon', 'public.' || v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon can EXECUTE %', v_fn;
    END IF;
    IF NOT has_function_privilege('authenticated', 'public.' || v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated cannot EXECUTE %', v_fn;
    END IF;
  END LOOP;

  -- The guard that makes overselling unrepresentable must exist by name.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.service_slot_day_state'::regclass
       AND conname  = 'sscds_within_capacity'
  ) THEN
    RAISE EXCEPTION 'sscds_within_capacity CHECK is missing — capacity would be advisory only';
  END IF;

  -- And the index that stops one event holding the same table twice.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname  = 'sssr_one_live_per_event_slot_date'
  ) THEN
    RAISE EXCEPTION 'sssr_one_live_per_event_slot_date is missing';
  END IF;

  -- seat_capacity must stay SEPARATE from slot_capacity.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vendor_service_time_slots'
       AND column_name = 'seat_capacity' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'vendor_service_time_slots.seat_capacity must exist and be NULLABLE (NULL = not a seated slot)';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- VERIFICATION:
--   \d public.service_slot_day_state
--   \d public.service_slot_reservations
--   SELECT polname FROM pg_policy WHERE polrelid='public.service_slot_reservations'::regclass;
--   -- the ledger must always equal the reservations behind it:
--   SELECT d.slot_id, d.reserved_date, d.seats_taken, COALESCE(SUM(r.party_size),0) AS from_rows
--     FROM public.service_slot_day_state d
--     LEFT JOIN public.service_slot_reservations r
--       ON r.slot_id = d.slot_id AND r.reserved_date = d.reserved_date
--      AND r.status IN ('held','confirmed')
--    GROUP BY d.slot_id, d.reserved_date, d.seats_taken
--   HAVING d.seats_taken <> COALESCE(SUM(r.party_size),0);   -- must return 0 rows
-- =============================================================================
