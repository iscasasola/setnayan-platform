-- 20271352068061_a_booking_takes_its_pieces_all_or_nothing
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- AVAILABILITY PLAN, STEP 4 — A BOOKING CARRIES HOW MANY PIECES IT TAKES, AND NOTHING IS DOUBLE BOOKED (owner "ok" to
-- every pick on prototypes/availability_steps_3_4_2026-11-19.html, DECISION_LOG 2026-11-19 "AVAILABILITY STEPS 3 AND 4
-- APPROVED").
--
-- 1 · event_vendors.booked_quantity — how many pieces a Rented by the piece booking takes ("200 chairs"). The SUPPLIER
--     types it when accepting the booking (owner ruling 2; the couple's picker is step 6). NULL = one (every booking
--     before this, and every card that is not by the piece). >= 1.
--     🔒 Written ONLY through set_booked_quantity (below): `authenticated` holds UPDATE on event_vendors under its
--     row policies, so a couple could otherwise shrink their own 200 to 1 and free 199 chairs. A trigger refuses any
--     change made as `authenticated` / `anon`; the definer writes as its owner.
--
-- 2 · service_card_bookings_on — counts PIECES for a by-the-piece service: the sum of booked_quantity (NULL = 1).
--     Every other service still counts bookings (each = 1). Body otherwise identical to 20271346711828. So
--     vendor_agree_to_lock / vendor_day_check / service_cards_unbookable_on / the couple's ask all read "320 of 500
--     out" for chairs without being touched.
--
-- 3 · acquire_schedule_pools — CARRIED TO QUANTITY. A booking takes its N pieces on every pool it spans, ALL OR
--     NOTHING, under the same FOR UPDATE locks: occupancy = the SUM of the other live bookings' quantities + outside
--     clients, and the booking is refused when occupancy + N exceeds the pool's number. N = booked_quantity (NULL = 1),
--     so every booking that is not by the piece is refused exactly as before (used + 1 > cap ⇔ used >= cap).
--     An Always available card (availability_style 'none', owner ruling 4) is never counted: it takes no seat and is
--     never on the calendar ('status' 'ok', 'counted' false). Body otherwise identical to 20271269411264.
--
-- 4 · set_booked_quantity(booking, n) — the supplier's yes for a piece booking. Same callers as acquire (the shop on
--     its own booking, or an admin). Locks the card row (one piece yes at a time per card) and every pool the
--     booking already holds; refuses when the card's own "How many do you have" or any pool would go past its number;
--     else writes n everywhere at once.
--
-- 5 · vendor_schedule_pools.daily_booking_capacity — no upper bound in SQL any more (was 1..500, 20271350427190). A
--     schedule that rents chairs holds as many as the shop has (owner ruling 3: no cap above 500 for pieces). The app
--     keeps 500 for every schedule that is not by the piece (calendar/actions.ts). >= 1 still.
--
-- Production today: no card carries a style yet (step 3 is new), so no booking counts differently today than it did
-- yesterday — booked_quantity is NULL everywhere, i.e. 1.

BEGIN;

-- ── 1 · booked_quantity ───────────────────────────────────────────────────────
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS booked_quantity INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'event_vendors_booked_quantity_check'
       AND conrelid = 'public.event_vendors'::regclass
  ) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_booked_quantity_check CHECK (booked_quantity IS NULL OR booked_quantity >= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.event_vendors.booked_quantity IS
  'Rented by the piece: how many pieces this booking takes (typed by the supplier at the yes, owner 2026-11-19). '
  'NULL = one. Written only by set_booked_quantity (trg_booked_quantity_only_by_the_definer).';

CREATE OR REPLACE FUNCTION public.booked_quantity_only_by_the_definer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.booked_quantity IS DISTINCT FROM OLD.booked_quantity AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'booked_quantity is set only by set_booked_quantity' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_booked_quantity_only_by_the_definer ON public.event_vendors;
CREATE TRIGGER trg_booked_quantity_only_by_the_definer
  BEFORE UPDATE OF booked_quantity ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.booked_quantity_only_by_the_definer();

CREATE OR REPLACE FUNCTION public.booked_quantity_set_on_insert_only_by_the_definer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.booked_quantity IS NOT NULL AND current_user IN ('authenticated', 'anon') THEN
    NEW.booked_quantity := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_booked_quantity_set_on_insert_only_by_the_definer ON public.event_vendors;
CREATE TRIGGER trg_booked_quantity_set_on_insert_only_by_the_definer
  BEFORE INSERT ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.booked_quantity_set_on_insert_only_by_the_definer();

-- ── 2 · service_card_bookings_on counts pieces for a by-the-piece service ─────
CREATE OR REPLACE FUNCTION public.service_card_bookings_on(
  p_service_id        uuid,
  p_day               date,
  p_exclude_vendor_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT s.vendor_service_id, s.vendor_profile_id, s.category, s.branch_id
      FROM public.vendor_services s
     WHERE s.vendor_service_id = p_service_id
  ),
  -- The cards that share this card's count: on halls → every card of the shop on one of its halls (a room holds so
  -- many events a day whichever package is booked); otherwise → every card of the same shop, same service
  -- (category), same branch. Always includes the card itself.
  sharing AS (
    SELECT me.vendor_service_id AS sid FROM me
    UNION
    SELECT h2.vendor_service_id
      FROM me
      JOIN public.vendor_service_halls h1 ON h1.vendor_service_id = me.vendor_service_id
      JOIN public.vendor_service_halls h2 ON h2.pool_id = h1.pool_id
                                          AND h2.vendor_profile_id = me.vendor_profile_id
    UNION
    SELECT s2.vendor_service_id
      FROM me
      JOIN public.vendor_services s2
        ON s2.vendor_profile_id = me.vendor_profile_id
       AND s2.category = me.category
       AND s2.branch_id IS NOT DISTINCT FROM me.branch_id
     WHERE me.category IS NOT NULL AND length(me.category) > 0
       AND NOT EXISTS (SELECT 1 FROM public.vendor_service_halls h WHERE h.vendor_service_id = me.vendor_service_id)
  )
  -- 🗓 STEP 4: a by-the-piece service counts PIECES (booked_quantity, NULL = 1); every other service counts bookings.
  SELECT COALESCE(sum(CASE WHEN vs.availability_style = 'piece' THEN COALESCE(ev.booked_quantity, 1) ELSE 1 END), 0)::integer
    FROM public.event_vendors ev
    LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
    JOIN public.events e ON e.event_id = ev.event_id
   WHERE ev.service_id IN (SELECT sid FROM sharing)
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND ev.archived_at IS NULL
     AND e.event_date = p_day
     AND e.event_date_precision = 'day'
     AND (p_exclude_vendor_id IS NULL OR ev.vendor_id <> p_exclude_vendor_id);
$function$;


REVOKE ALL ON FUNCTION public.service_card_bookings_on(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_bookings_on(uuid, date, uuid) TO service_role;


-- ── 3 · acquire_schedule_pools carried to quantity ───────────────────────────
CREATE OR REPLACE FUNCTION public.acquire_schedule_pools(
  p_event_id        UUID,
  p_event_vendor_id UUID,
  p_pool_ids        UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date      DATE;
  v_precision TEXT;
  v_pool      RECORD;
  v_used      INT;
  v_closed    BOOLEAN;
  v_locked    BOOLEAN;
  v_whitelist BOOLEAN;
  v_qty       INT;
  v_style     TEXT;
BEGIN
  -- ── Authorization (WIDENED 2026-08-04 · PR-I) ──────────────────────────
  -- Three principals, each proving ownership of a DIFFERENT side of the same
  -- booking. A caller who is none of them is still refused, exactly as before.
  IF p_event_id NOT IN (SELECT public.current_couple_event_ids())
     AND p_event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids())
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  IF p_pool_ids IS NULL OR array_length(p_pool_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('status', 'no_pools');
  END IF;

  SELECT event_date, event_date_precision
    INTO v_date, v_precision
    FROM public.events
   WHERE event_id = p_event_id;

  -- Eventual-consistency doctrine: no day-precise date → degrade OPEN
  -- (the atomic gate engages the moment the couple locks a real day).
  IF v_date IS NULL OR v_precision IS DISTINCT FROM 'day' THEN
    RETURN jsonb_build_object('status', 'no_date');
  END IF;

  -- 🗓 STEP 4 (2026-11-19): this booking's size. A by-the-piece booking takes its booked_quantity (the supplier's
  -- yes, set_booked_quantity); every other booking takes 1, exactly as before. An Always available card is never
  -- counted (owner ruling 4): it takes no seat and is never on the calendar.
  SELECT COALESCE(ev.booked_quantity, 1), vs.availability_style
    INTO v_qty, v_style
    FROM public.event_vendors ev
    LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
   WHERE ev.vendor_id = p_event_vendor_id;
  IF v_style = 'none' THEN
    RETURN jsonb_build_object('status', 'ok', 'pool_ids', '[]'::jsonb, 'booked_date', v_date, 'counted', false);
  END IF;
  v_qty := COALESCE(v_qty, 1);

  -- Lock every pool row, DETERMINISTIC ORDER (pool_id) so two concurrent
  -- bundles spanning overlapping pool sets can never deadlock.
  FOR v_pool IN
    SELECT pool_id, pool_label, daily_booking_capacity, vendor_profile_id
      FROM public.vendor_schedule_pools
     WHERE pool_id = ANY (p_pool_ids)
       AND is_active
     ORDER BY pool_id
       FOR UPDATE
  LOOP
    -- (a) Closure blocks: a manual/synced block covering the date — a one-off
    --     range or a REPEAT (2026-10-14) — either scoped to this pool or
    --     org-wide (pool_id IS NULL), closes the date outright regardless of
    --     capacity. Only an ALL-DAY block closes a date: a morning/afternoon/
    --     evening block refuses only the times it meets (the slot gate).
    SELECT EXISTS (
      SELECT 1 FROM public.vendor_calendar_blocks b
       WHERE b.vendor_profile_id = v_pool.vendor_profile_id
         AND b.block_source IN ('manual', 'synced_calendar')
         AND (b.pool_id = v_pool.pool_id OR b.pool_id IS NULL)
         AND b.day_part = 'all_day'
         AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, v_date)
    ) INTO v_closed;
    IF v_closed THEN
      RETURN jsonb_build_object('status', 'blocked', 'pool_id', v_pool.pool_id);
    END IF;

    -- (a2) An explicit vendor-set day state (pool-scoped or org-wide).
    --      locked  → hard hold, cannot book (like a closure).
    --      whitelist → approve-first, the acquire is HELD for vendor review.
    SELECT
      bool_or(ds.day_state = 'locked'),
      bool_or(ds.day_state = 'whitelist')
      INTO v_locked, v_whitelist
      FROM public.vendor_calendar_day_states ds
     WHERE ds.vendor_profile_id = v_pool.vendor_profile_id
       AND ds.state_date = v_date
       AND (ds.pool_id = v_pool.pool_id OR ds.pool_id IS NULL);
    IF COALESCE(v_locked, FALSE) THEN
      RETURN jsonb_build_object('status', 'locked', 'pool_id', v_pool.pool_id);
    END IF;
    IF COALESCE(v_whitelist, FALSE) THEN
      RETURN jsonb_build_object('status', 'whitelist', 'pool_id', v_pool.pool_id);
    END IF;

    -- (b) Occupancy = live app reservations (other booking rows) +
    --     external-client jobs on this pool overlapping the date (one-off and
    --     all-day by CHECK, asked through the same rule).
    SELECT
      (SELECT COALESCE(sum(COALESCE(ev2.booked_quantity, 1)), 0) FROM public.vendor_schedule_pool_bookings pb
         LEFT JOIN public.event_vendors ev2 ON ev2.vendor_id = pb.event_vendor_id
        WHERE pb.pool_id = v_pool.pool_id
          AND pb.booked_date = v_date
          AND pb.released_at IS NULL
          AND pb.event_vendor_id <> p_event_vendor_id)
      +
      (SELECT count(*) FROM public.vendor_calendar_blocks b
        WHERE b.pool_id = v_pool.pool_id
          AND b.block_source = 'external_client'
          AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, v_date))
    INTO v_used;

    -- All or nothing, by quantity: every booking that takes 1 is refused exactly as before (used + 1 > cap ⇔ used >= cap).
    IF v_used + v_qty > v_pool.daily_booking_capacity THEN
      RETURN jsonb_build_object(
        'status', 'full',
        'pool_id', v_pool.pool_id,
        'pool_label', v_pool.pool_label);
    END IF;
  END LOOP;

  -- All pools clear under held locks → consume every one. Idempotent on
  -- re-acquire via the live-uniqueness partial index.
  --
  -- ⚠ THE `AND sp.is_active` BELOW IS THE FIX (2026-08-01). Without it this
  -- INSERT quantified over a WIDER set than the validation loop above, so an
  -- inactive pool skipped every gate and still got a row. The two halves must
  -- always name the same set; if a future change adds a predicate to the loop,
  -- it belongs here too.
  INSERT INTO public.vendor_schedule_pool_bookings
    (pool_id, vendor_profile_id, event_vendor_id, event_id, booked_date)
  SELECT sp.pool_id, sp.vendor_profile_id, p_event_vendor_id, p_event_id, v_date
    FROM public.vendor_schedule_pools sp
   WHERE sp.pool_id = ANY (p_pool_ids)
     AND sp.is_active
  ON CONFLICT (pool_id, event_vendor_id) WHERE released_at IS NULL
  DO NOTHING;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pool_ids', to_jsonb(p_pool_ids),
    'booked_date', v_date);
END;
$$;


REVOKE ALL ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) TO authenticated;


-- ── 4 · set_booked_quantity ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_booked_quantity(
  p_event_vendor_id uuid,
  p_quantity        int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id   uuid;
  v_service    uuid;
  v_style      text;
  v_cap        int;
  v_date       date;
  v_precision  text;
  v_pool       record;
  v_used       int;
  v_card_used  int;
BEGIN
  IF p_event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids()) AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;
  SELECT ev.event_id, ev.service_id INTO v_event_id, v_service
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_event_vendor_id;
  IF v_service IS NULL THEN
    RETURN jsonb_build_object('status', 'no_card');
  END IF;

  -- One piece yes at a time per card: the card row is the lock.
  SELECT vs.availability_style, NULLIF(vs.daily_capacity, 0) INTO v_style, v_cap
    FROM public.vendor_services vs
   WHERE vs.vendor_service_id = v_service
     FOR UPDATE;
  IF v_style IS DISTINCT FROM 'piece' THEN
    RETURN jsonb_build_object('status', 'not_by_the_piece');
  END IF;
  -- Asked only of a by-the-piece card: a missing or bad number refuses the yes (never "one piece" by default).
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RETURN jsonb_build_object('status', 'bad_quantity');
  END IF;

  SELECT event_date, event_date_precision INTO v_date, v_precision
    FROM public.events WHERE event_id = v_event_id;

  -- (a) the card's own "How many do you have" — the other bookings' pieces that day + this one.
  IF v_cap IS NOT NULL AND v_date IS NOT NULL AND v_precision = 'day' THEN
    v_card_used := public.service_card_bookings_on(v_service, v_date, p_event_vendor_id);
    IF v_card_used + p_quantity > v_cap THEN
      RETURN jsonb_build_object('status', 'full', 'have', v_cap, 'out', v_card_used, 'free', GREATEST(v_cap - v_card_used, 0));
    END IF;
  END IF;

  -- (b) every pool this booking already holds a seat on — the same count acquire_schedule_pools makes, all or nothing.
  FOR v_pool IN
    SELECT sp.pool_id, sp.pool_label, sp.daily_booking_capacity, pb.booked_date
      FROM public.vendor_schedule_pool_bookings pb
      JOIN public.vendor_schedule_pools sp ON sp.pool_id = pb.pool_id
     WHERE pb.event_vendor_id = p_event_vendor_id
       AND pb.released_at IS NULL
       AND sp.is_active
     ORDER BY sp.pool_id
       FOR UPDATE OF sp
  LOOP
    SELECT
      (SELECT COALESCE(sum(COALESCE(ev2.booked_quantity, 1)), 0) FROM public.vendor_schedule_pool_bookings pb2
         LEFT JOIN public.event_vendors ev2 ON ev2.vendor_id = pb2.event_vendor_id
        WHERE pb2.pool_id = v_pool.pool_id
          AND pb2.booked_date = v_pool.booked_date
          AND pb2.released_at IS NULL
          AND pb2.event_vendor_id <> p_event_vendor_id)
      +
      (SELECT count(*) FROM public.vendor_calendar_blocks b
        WHERE b.pool_id = v_pool.pool_id
          AND b.block_source = 'external_client'
          AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, v_pool.booked_date))
    INTO v_used;
    IF v_used + p_quantity > v_pool.daily_booking_capacity THEN
      RETURN jsonb_build_object('status', 'full', 'pool_id', v_pool.pool_id, 'pool_label', v_pool.pool_label,
        'have', v_pool.daily_booking_capacity, 'out', v_used, 'free', GREATEST(v_pool.daily_booking_capacity - v_used, 0));
    END IF;
  END LOOP;

  UPDATE public.event_vendors SET booked_quantity = p_quantity WHERE vendor_id = p_event_vendor_id;
  RETURN jsonb_build_object('status', 'ok', 'quantity', p_quantity);
END;
$function$;

COMMENT ON FUNCTION public.set_booked_quantity(uuid, int) IS
  'Rented by the piece: the supplier''s yes says how many pieces (owner 2026-11-19, ruling 2). Refused when the card''s '
  'own number or any pool the booking holds would go past its number; else written all at once. The only writer of '
  'event_vendors.booked_quantity.';

REVOKE ALL ON FUNCTION public.set_booked_quantity(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_booked_quantity(uuid, int) TO authenticated, service_role;

-- ── 5 · a schedule that rents pieces holds as many as the shop has ───────────
ALTER TABLE public.vendor_schedule_pools
  DROP CONSTRAINT IF EXISTS vendor_schedule_pools_daily_booking_capacity_check;
ALTER TABLE public.vendor_schedule_pools
  ADD CONSTRAINT vendor_schedule_pools_daily_booking_capacity_check
  CHECK (daily_booking_capacity >= 1);

COMMIT;
