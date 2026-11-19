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
--     🔢 ONE NUMBER FOR PIECES (review 2026-11-19; owner 2a "one field, vendor_services.daily_capacity, labelled by
--     style" and 2c "pieces take only pieces"): a by-the-piece booking is checked against its CARD's own "How many do
--     you have" (service_card_daily_limit — the same number the yes reads), never against the schedule's
--     daily_booking_capacity. It still takes its seat on the schedule (the Day bar lists it), but the schedule's
--     number does not hold pieces.
--     An Always available card (availability_style 'none', owner ruling 4) is never counted: it takes no seat and is
--     never on the calendar ('status' 'ok', 'counted' false). Body otherwise identical to 20271269411264.
--
-- 4 · set_booked_quantity(booking, n) — the supplier's yes for a piece booking. Same callers as acquire (the shop on
--     its own booking, or an admin). Locks the card row (one piece yes at a time per card) and every pool the
--     booking already holds; refuses when the card's own "How many do you have" would go past its number (the ONE
--     number for pieces — see 3); else writes n.
--
-- 5 · (withdrawn in review, 2026-11-19) the schedule's daily_booking_capacity keeps its 1..500 (20271350427190). The
--     "no cap above 500 for pieces" (owner ruling 3) lives on the card's own number, which is the only one pieces are
--     counted against (see 3).
--
-- 10 · MADE TO ORDER IS COUNTED WHILE IT IS BEING MADE (owner, DECISION_LOG 2026-11-19 "AVAILABILITY FINALIZED",
--     "Wrong, fix"): an order is "in progress" on every day of its preparation window [due − prep, due], not only on
--     the date it is due. Two new numbers, kept apart from order_lead_days ("Order at least N days", the couple's rule):
--       vendor_services.usual_prep_days — "Usual preparation time" on a Made to order card, 0..365, NULL = none.
--       event_vendors.prep_days         — THIS order's own time (2b: the accept sheet asks "Is the time right?"),
--                                         0..365, NULL = the card's. No writer yet (2b adds the definer).
--     🔒 prep_days is NOT browser-readable (event_vendors SELECT is a column allow-list since 20271343340931 and it is
--     not granted) and NOT browser-writable (the booked_quantity triggers now cover it: an `authenticated` / `anon`
--     change is refused, an insert's value is dropped) — a couple could otherwise shorten their order's window.
--     schedule_pool_in_progress_on(pool, day) is THE count; vendor_day_pool_taken returns it beside `taken` and the
--     Clients day bar reads it ("N of M in progress · K free"). The HARD refusal (acquire_schedule_pools) still counts
--     the due date only, unchanged, until 2b brings the soft warning.
--
-- 11 · copy_vendor_service_to_branch carries usual_prep_days (a branch copy is counted the same way).
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

-- ── 1a · preparation time (section 10 of the header) ─────────────────────────
ALTER TABLE public.vendor_services ADD COLUMN IF NOT EXISTS usual_prep_days INT;
ALTER TABLE public.event_vendors   ADD COLUMN IF NOT EXISTS prep_days INT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_services_usual_prep_days_check'
                    AND conrelid = 'public.vendor_services'::regclass) THEN
    ALTER TABLE public.vendor_services
      ADD CONSTRAINT vendor_services_usual_prep_days_check CHECK (usual_prep_days IS NULL OR usual_prep_days BETWEEN 0 AND 365);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_vendors_prep_days_check'
                    AND conrelid = 'public.event_vendors'::regclass) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_prep_days_check CHECK (prep_days IS NULL OR prep_days BETWEEN 0 AND 365);
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_services.usual_prep_days IS
  'Made to order: "Usual preparation time" in days (owner 2026-11-19, AVAILABILITY FINALIZED). An order is counted '
  'in progress on every day of [due - prep, due]. NULL or 0 = counted on its due date only. Not order_lead_days.';
COMMENT ON COLUMN public.event_vendors.prep_days IS
  'Made to order: THIS order''s preparation time in days (2b, confirmed at accept). NULL = the card''s usual_prep_days. '
  'Not browser-readable; written only by a definer (trg_booked_quantity_only_by_the_definer covers it).';

-- booked_quantity is READ in the browser (the couple's own ask, the supplier's Agree prefill — under the row
-- policies), so it is granted like every other non-amount column since 20271343340931. prep_days is NOT granted: a
-- browser never reads it directly (owner/controller 19 Nov: couples neither read nor write it).
GRANT SELECT (booked_quantity) ON public.event_vendors TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.booked_quantity_only_by_the_definer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.booked_quantity IS DISTINCT FROM OLD.booked_quantity AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'booked_quantity is set only by set_booked_quantity' USING ERRCODE = '42501';
  END IF;
  IF NEW.prep_days IS DISTINCT FROM OLD.prep_days AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'prep_days is set only by a definer' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_booked_quantity_only_by_the_definer ON public.event_vendors;
CREATE TRIGGER trg_booked_quantity_only_by_the_definer
  BEFORE UPDATE OF booked_quantity, prep_days ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.booked_quantity_only_by_the_definer();

CREATE OR REPLACE FUNCTION public.booked_quantity_set_on_insert_only_by_the_definer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.booked_quantity := NULL;
    NEW.prep_days := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_booked_quantity_set_on_insert_only_by_the_definer ON public.event_vendors;
CREATE TRIGGER trg_booked_quantity_set_on_insert_only_by_the_definer
  BEFORE INSERT ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.booked_quantity_set_on_insert_only_by_the_definer();


-- ── 1b · THE ONE COUNT and THE ONE LOCK ───────────────────────────────────────
-- schedule_pool_taken_on — a schedule's taken count on a day: the pieces of every live seat (booked_quantity, NULL = 1)
-- + outside clients on that day. acquire_schedule_pools, set_booked_quantity AND the Clients day bar
-- (vendor_day_pool_taken) all read THIS function, so the bar and the guard can never disagree.
CREATE OR REPLACE FUNCTION public.schedule_pool_taken_on(p_pool_id uuid, p_day date, p_exclude uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (
    (SELECT COALESCE(sum(COALESCE(ev.booked_quantity, 1)), 0) FROM public.vendor_schedule_pool_bookings pb
       LEFT JOIN public.event_vendors ev ON ev.vendor_id = pb.event_vendor_id
      WHERE pb.pool_id = p_pool_id
        AND pb.booked_date = p_day
        AND pb.released_at IS NULL
        AND (p_exclude IS NULL OR pb.event_vendor_id <> p_exclude))
    +
    (SELECT count(*) FROM public.vendor_calendar_blocks b
      WHERE b.pool_id = p_pool_id
        AND b.block_source = 'external_client'
        AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, p_day))
  )::integer;
$function$;
REVOKE ALL ON FUNCTION public.schedule_pool_taken_on(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_pool_taken_on(uuid, date, uuid) TO service_role;

-- schedule_pool_in_progress_on — a schedule's IN PROGRESS count on a day (section 10): every live seat whose
-- [due − prep, due] covers the day, prep = the order's own prep_days, else its card's usual_prep_days when the card is
-- Made to order, else 0 — so a booking with no preparation time counts on its due date exactly as schedule_pool_taken_on
-- does (same rows, same released_at, same NULL = 1 pieces) + outside clients on that day. The Day bar reads this.
CREATE OR REPLACE FUNCTION public.schedule_pool_in_progress_on(p_pool_id uuid, p_day date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (
    (SELECT COALESCE(sum(COALESCE(ev.booked_quantity, 1)), 0) FROM public.vendor_schedule_pool_bookings pb
       LEFT JOIN public.event_vendors ev ON ev.vendor_id = pb.event_vendor_id
       LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
      WHERE pb.pool_id = p_pool_id
        AND pb.released_at IS NULL
        AND pb.booked_date >= p_day
        AND pb.booked_date - COALESCE(ev.prep_days,
                                      CASE WHEN vs.availability_style = 'order' THEN vs.usual_prep_days END,
                                      0) <= p_day)
    +
    (SELECT count(*) FROM public.vendor_calendar_blocks b
      WHERE b.pool_id = p_pool_id
        AND b.block_source = 'external_client'
        AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, p_day))
  )::integer;
$function$;
REVOKE ALL ON FUNCTION public.schedule_pool_in_progress_on(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_pool_in_progress_on(uuid, date) TO service_role;

-- lock_shop_day_counts — one transaction-scoped lock per SHOP, taken by every write that grows a card's count
-- (the yes, the piece quantity). A card's count spans its sharing cards, so a lock on one card row is not enough.
CREATE OR REPLACE FUNCTION public.lock_shop_day_counts(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_shop uuid;
BEGIN
  SELECT vendor_profile_id INTO v_shop FROM public.vendor_services WHERE vendor_service_id = p_service_id;
  IF v_shop IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('setnayan.shop-day-counts:' || v_shop::text, 0));
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.lock_shop_day_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_shop_day_counts(uuid) TO service_role;

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
  v_service   UUID;
  v_have      INT;
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
  SELECT COALESCE(ev.booked_quantity, 1), vs.availability_style, ev.service_id
    INTO v_qty, v_style, v_service
    FROM public.event_vendors ev
    LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
   WHERE ev.vendor_id = p_event_vendor_id;
  IF v_style = 'none' THEN
    RETURN jsonb_build_object('status', 'ok', 'pool_ids', '[]'::jsonb, 'booked_date', v_date, 'counted', false);
  END IF;
  v_qty := COALESCE(v_qty, 1);

  -- 🔢 Pieces are counted against the CARD's own number only (header 3) — under the shop's one lock, the same count
  -- and the same number the yes reads (service_card_bookings_on · service_card_daily_limit).
  IF v_style = 'piece' THEN
    PERFORM public.lock_shop_day_counts(v_service);
    v_have := public.service_card_daily_limit(v_service);
    IF v_have IS NOT NULL
       AND public.service_card_bookings_on(v_service, v_date, p_event_vendor_id) + v_qty > v_have THEN
      RETURN jsonb_build_object('status', 'full', 'pool_id', NULL, 'pool_label', NULL);
    END IF;
  END IF;

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
    v_used := public.schedule_pool_taken_on(v_pool.pool_id, v_date, p_event_vendor_id);

    -- All or nothing: every booking that takes 1 is refused exactly as before (used + 1 > cap ⇔ used >= cap). A piece
    -- booking was checked against its card above — the schedule's number does not hold pieces.
    IF v_style IS DISTINCT FROM 'piece' AND v_used + 1 > v_pool.daily_booking_capacity THEN
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
  PERFORM public.lock_shop_day_counts(v_service);
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

  -- (b) withdrawn in review (2026-11-19): the schedule's number does not hold pieces — the card's is the ONE number
  -- (header 3), checked in (a) above.

  UPDATE public.event_vendors SET booked_quantity = p_quantity WHERE vendor_id = p_event_vendor_id;
  RETURN jsonb_build_object('status', 'ok', 'quantity', p_quantity);
END;
$function$;

COMMENT ON FUNCTION public.set_booked_quantity(uuid, int) IS
  'Rented by the piece: the supplier''s yes says how many pieces (owner 2026-11-19, ruling 2). Refused when the card''s '
  'own "How many do you have" (the one number for pieces) would go past its number; else written. The only writer of '
  'event_vendors.booked_quantity.';

REVOKE ALL ON FUNCTION public.set_booked_quantity(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_booked_quantity(uuid, int) TO authenticated, service_role;

-- ── 5 · (withdrawn in review) the schedule's 1..500 stands — see the header ──


-- ── 6 · the COUPLE picks how many (owner Q2, 19 Nov: "yes it should show"; AVAILABILITY_PLAN step 3 AV-PIECE "the
--     couple picks how many"). Their ask carries the number; the supplier may change it when accepting
--     (set_booked_quantity). An ask takes nothing — only the yes takes pieces — so this checks the stock only to
--     answer honestly ("only 180 free that day"), it never holds them.
CREATE OR REPLACE FUNCTION public.set_asked_quantity(p_event_vendor_id uuid, p_quantity int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_service  uuid;
  v_status   text;
  v_style    text;
  v_cap      int;
  v_date     date;
  v_prec     text;
  v_out      int;
BEGIN
  SELECT ev.event_id, ev.service_id, ev.status::text INTO v_event_id, v_service, v_status
    FROM public.event_vendors ev WHERE ev.vendor_id = p_event_vendor_id;
  IF v_event_id IS NULL OR (v_event_id NOT IN (SELECT public.current_couple_event_ids()) AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;
  IF v_status IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN jsonb_build_object('status', 'already_booked');
  END IF;
  SELECT vs.availability_style, NULLIF(vs.daily_capacity, 0) INTO v_style, v_cap
    FROM public.vendor_services vs WHERE vs.vendor_service_id = v_service;
  IF v_style IS DISTINCT FROM 'piece' THEN
    RETURN jsonb_build_object('status', 'not_by_the_piece');
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RETURN jsonb_build_object('status', 'bad_quantity');
  END IF;
  SELECT event_date, event_date_precision INTO v_date, v_prec FROM public.events WHERE event_id = v_event_id;
  IF v_cap IS NOT NULL AND v_date IS NOT NULL AND v_prec = 'day' THEN
    v_out := public.service_card_bookings_on(v_service, v_date, p_event_vendor_id);
    IF v_out + p_quantity > v_cap THEN
      RETURN jsonb_build_object('status', 'full', 'have', v_cap, 'free', GREATEST(v_cap - v_out, 0));
    END IF;
  END IF;
  UPDATE public.event_vendors SET booked_quantity = p_quantity WHERE vendor_id = p_event_vendor_id;
  RETURN jsonb_build_object('status', 'ok', 'quantity', p_quantity);
END;
$function$;
REVOKE ALL ON FUNCTION public.set_asked_quantity(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_asked_quantity(uuid, int) TO authenticated, service_role;

-- ── 7 · the Clients day bar reads the guard's own count ─────────────────────
-- vendor_day_pool_taken(day) — every schedule of the CALLER's shop with schedule_pool_taken_on for that day: the
-- exact number acquire_schedule_pools refuses by — and `in_progress`, schedule_pool_in_progress_on (section 10), the
-- number a Made to order schedule's bar says. One call per screen (the shop's schedules are few).
CREATE OR REPLACE FUNCTION public.vendor_day_pool_taken(p_day date)
RETURNS TABLE (pool_id uuid, taken integer, in_progress integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT sp.pool_id, public.schedule_pool_taken_on(sp.pool_id, p_day, NULL), public.schedule_pool_in_progress_on(sp.pool_id, p_day)
    FROM public.vendor_schedule_pools sp
   WHERE sp.vendor_profile_id IN (SELECT public.current_vendor_ids())
     AND sp.is_active;
$function$;
REVOKE ALL ON FUNCTION public.vendor_day_pool_taken(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_day_pool_taken(date) TO authenticated, service_role;

-- ── 8 · the yes counts the booking's own pieces, under one lock per shop ────
-- vendor_agree_to_lock: body identical to 20271316466285 except the PER-CARD DAILY LIMIT block — it now takes
-- lock_shop_day_counts and refuses when out + this booking's pieces > the card's number (a piece booking with no
-- number is refused: 'pieces_needed'). For every card that is not by the piece the rule is unchanged.
CREATE OR REPLACE FUNCTION public.vendor_agree_to_lock(p_event_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state       TEXT;
  v_expires_at  TIMESTAMPTZ;
  v_agreed_at   TIMESTAMPTZ;
  v_event_id    UUID;
  v_group       TEXT;
  v_status      TEXT;
  v_mvid        UUID;
  v_slot        UUID;
  v_rows        INTEGER;
  v_msg         TEXT;
  v_date        DATE;
  v_prec        TEXT;
  v_event_ids   UUID[];
  v_capacity    INT;
  v_used        INT;
  v_competing   INT;
  v_pkg_id      UUID;
  v_covered     INT;
  v_service     UUID;
  v_daily_cap   INT;
  v_own_qty     INT;
  v_own_style   TEXT;
BEGIN
  -- ── OWNERSHIP ──────────────────────────────────────────────────────────────
  -- NARROWED from the shipped gate, deliberately. current_vendor_event_vendor_ids()
  -- has a second arm matching on event_vendors.service_id via
  -- agent_assigned_service_ids() — and service_id is a column the COUPLE can
  -- write (authenticated holds UPDATE on it; no constraint ties it to
  -- marketplace_vendor_id). That was harmless while this RPC wrote an inert
  -- marker nobody read. It is NOT harmless now that this RPC is the only thing
  -- that creates a booking.
  -- 🔑 RULE: when an RPC becomes the sole authority for a booking, its ownership
  -- predicate may not key on a column the counterparty controls.
  -- The agent arm is kept — staff seats legitimately answer for their org — but
  -- re-anchored so the service must belong to the org that was actually ASKED.
  IF NOT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id
       AND (
         ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
         OR EXISTS (
           SELECT 1
             FROM public.vendor_services vs
            WHERE vs.vendor_service_id = ev.service_id
              AND vs.vendor_profile_id = ev.marketplace_vendor_id
              AND vs.vendor_service_id IN (SELECT public.agent_assigned_service_ids())
         )
       )
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT lock_request_state, lock_request_expires_at, lock_agreed_at,
         event_id, hard_single_group, status::TEXT, marketplace_vendor_id,
         service_time_slot_id, event_vendor_package_id
    INTO v_state, v_expires_at, v_agreed_at,
         v_event_id, v_group, v_status, v_mvid, v_slot, v_pkg_id
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_state IS NULL THEN
    RETURN jsonb_build_object('status', 'not_requested', 'event_id', v_event_id);
  END IF;

  IF v_state = 'agreed' THEN
    RETURN jsonb_build_object(
      'status', 'already', 'agreed_at', v_agreed_at, 'event_id', v_event_id);
  END IF;

  IF v_state IN ('declined', 'cancelled', 'expired') THEN
    RETURN jsonb_build_object(
      'status', 'not_pending', 'current', v_state, 'event_id', v_event_id);
  END IF;

  -- LAZY EXPIRY. Kept even though a sweep now exists: the sweep fires on request
  -- traffic, so a vendor can still open a lapsed request between two passes.
  -- Flipping (rather than merely refusing) releases both pending indexes so the
  -- couple can ask again.
  IF v_expires_at IS NOT NULL AND v_expires_at <= NOW() THEN
    UPDATE public.event_vendors
       SET lock_request_state = 'expired',
           updated_at         = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object(
      'status', 'expired', 'expired_at', v_expires_at, 'event_id', v_event_id);
  END IF;

  -- ── A CONFIRMED RIVAL IN THE COUPLE'S OWN CATEGORY ─────────────────────────
  -- The couple booked someone else for this hard-single category while the ask
  -- was outstanding. Close the request rather than leaving it to rot in the
  -- pending index. 'cancelled' is the honest value — every path that can confirm
  -- a hard-single sibling is couple-initiated, so the couple did withdraw it, by
  -- booking elsewhere — but the ACTOR IS STAMPED so the record does not lose the
  -- fact that the vendor was here and answered.
  IF v_group IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_vendors ev
     WHERE ev.event_id = v_event_id
       AND ev.hard_single_group = v_group
       AND ev.vendor_id <> p_event_vendor_id
       AND ev.archived_at IS NULL
       AND ev.package_role IS DISTINCT FROM 'covered'
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  ) THEN
    UPDATE public.event_vendors
       SET lock_request_state        = 'cancelled',
           lock_request_cancelled_at = NOW(),
           lock_answered_by_user_id  = auth.uid(),
           updated_at                = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object(
      'status', 'group_taken', 'event_id', v_event_id);
  END IF;

  -- ── OWNER DECISION 3 · DECLINE THE OTHERS FIRST ───────────────────────────
  -- Service_Schedule_and_Quotation_Flow_2026-06-02.md §T1.4. A vendor may not
  -- take one couple while other couples are still waiting on them for the same
  -- date: they must answer the others first, so nobody loses silently.
  -- Capacity is the owner's documented default of 1 (daily_booking_capacity was
  -- never built — see the header). A vendor with no date on the event has no
  -- date to compete on, so the rule does not apply.
  SELECT e.event_date, e.event_date_precision
    INTO v_date, v_prec
    FROM public.events e
   WHERE e.event_id = v_event_id;

  IF v_mvid IS NOT NULL AND v_date IS NOT NULL AND v_prec = 'day' THEN
    SELECT count(*) INTO v_competing
      FROM public.event_vendors ev
      JOIN public.events e2 ON e2.event_id = ev.event_id
     WHERE ev.marketplace_vendor_id = v_mvid
       AND ev.lock_request_state = 'pending'
       AND ev.archived_at IS NULL
       AND ev.vendor_id <> p_event_vendor_id
       AND e2.event_date = v_date
       AND e2.event_date_precision = 'day';

    IF COALESCE(v_competing, 0) > 0 THEN
      RETURN jsonb_build_object(
        'status', 'resolve_others_first',
        'competing', v_competing,
        'event_date', v_date,
        'event_id', v_event_id);
    END IF;
  END IF;

  -- ── TIME-SLOT CAPACITY ────────────────────────────────────────────────────
  -- Capacity is consumed HERE, not at the couple's ask, because the ask no
  -- longer books anything. The predicate mirrors acquire_service_time_slot's
  -- occupancy count (read from the live function, not retyped from memory).
  IF v_slot IS NOT NULL AND v_date IS NOT NULL AND v_prec = 'day' THEN
    SELECT slot_capacity INTO v_capacity
      FROM public.vendor_service_time_slots
     WHERE slot_id = v_slot
       AND is_active
     FOR UPDATE;

    IF v_capacity IS NOT NULL THEN
      SELECT array_agg(event_id) INTO v_event_ids
        FROM public.events
       WHERE event_date = v_date
         AND event_date_precision = 'day';

      SELECT count(*) INTO v_used
        FROM public.event_vendors
       WHERE service_time_slot_id = v_slot
         AND status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND archived_at IS NULL
         AND event_id = ANY (v_event_ids)
         AND vendor_id <> p_event_vendor_id;

      IF v_used >= v_capacity THEN
        RETURN jsonb_build_object(
          'status', 'slot_full', 'event_id', v_event_id);
      END IF;
    END IF;
  END IF;

  -- ── PER-CARD DAILY LIMIT (LOCK-PATH 2 · 20271223386305) ────────────────────
  -- The couple's ASK is checked against the card's "Bookings per day"
  -- (vendors/actions.ts #2), but it is THIS yes that books — and it did not
  -- check the limit at all. Whatever grew the count between the ask and the
  -- yes (a Locked-QR claim, a booking made while the handshake was off, a limit
  -- the supplier lowered) let the yes go past it.
  -- Same rule as the ask and the bench search, and the SAME count — never a
  -- second one: a card with NO active time slot (a slotted card is judged by
  -- its slot, above), a daily_capacity above zero, a day-precise date, and
  -- service_card_bookings_on (booked statuses, not archived, day-precise
  -- events). A row that is already booked is not a new booking, so its yes is
  -- never refused here. The card row is locked first, so two yeses on one card
  -- cannot both read the last free place (NO KEY: bookings that merely
  -- reference the card are not blocked).
  IF v_date IS NOT NULL AND v_prec = 'day'
     AND v_status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    SELECT ev.service_id INTO v_service
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id;

    IF v_service IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.vendor_service_time_slots t
       WHERE t.vendor_service_id = v_service
         AND t.is_active
    ) THEN
      PERFORM 1
        FROM public.vendor_services vs
       WHERE vs.vendor_service_id = v_service
       FOR NO KEY UPDATE;
      -- 🔒 STEP 4: the count spans every card that shares this one's stock (same shop, service, branch — or its halls),
      -- so locking this card's row alone let two yeses on two sharing cards both read the last free place. One lock
      -- per SHOP serializes every yes of the shop (and set_booked_quantity takes the same one).
      PERFORM public.lock_shop_day_counts(v_service);
      -- 🪑 A by-the-piece card counts the booking's OWN pieces too: out + mine > have refuses. Every other card: mine = 1,
      -- so `out + 1 > cap` is exactly the old `out >= cap`. A piece booking with no number is refused — never "one".
      SELECT vs.availability_style INTO v_own_style FROM public.vendor_services vs WHERE vs.vendor_service_id = v_service;
      SELECT ev.booked_quantity INTO v_own_qty FROM public.event_vendors ev WHERE ev.vendor_id = p_event_vendor_id;
      IF v_own_style = 'piece' AND v_own_qty IS NULL THEN
        RETURN jsonb_build_object('status', 'pieces_needed', 'event_id', v_event_id);
      END IF;
      v_own_qty := CASE WHEN v_own_style = 'piece' THEN v_own_qty ELSE 1 END;
      -- 2026-11-06: the card's own number INSIDE its plan's bookings per date per card (Solo 1 · Pro 3 · Ultra 5 +
      -- bought). The only changed line of this function — `service_card_daily_limit` (§5 above).
      v_daily_cap := public.service_card_daily_limit(v_service);

      IF v_daily_cap IS NOT NULL AND v_daily_cap > 0
         AND public.service_card_bookings_on(v_service, v_date, p_event_vendor_id) + v_own_qty > v_daily_cap THEN
        RETURN jsonb_build_object(
          'status', 'daily_limit_reached', 'daily_limit', v_daily_cap, 'event_id', v_event_id);
      END IF;
    END IF;
  END IF;

  -- ── THE FLIP ──────────────────────────────────────────────────────────────
  -- One statement. state='agreed' AND status='contracted' land together or not
  -- at all. The status half is MONOTONE (see the header): a row that is already
  -- further up the ladder keeps its status, so agreeing can never demote a paid
  -- booking or release the vendor's held date.
  BEGIN
    UPDATE public.event_vendors
       SET lock_request_state       = 'agreed',
           lock_agreed_at           = NOW(),
           lock_answered_by_user_id = auth.uid(),
           lock_declined_at         = NULL,
           lock_decline_reason      = NULL,
           -- ── THE STAMPS THIS FUNCTION HAS ALWAYS BEEN SAID TO WRITE ────────
           -- Added 2026-08-17. `vendors/actions.ts` has asserted since slice A
           -- that "the agree RPC stamps both alongside 'contracted', exactly as
           -- acquire_service_time_slot already does". Half of that was true:
           -- acquire_service_time_slot DOES stamp both (read out of prod, not
           -- retyped); this function stamped NEITHER.
           --
           -- 🔑 A SENTENCE IS NOT A MECHANISM. The comment was written on the
           -- couple's side, describing what a different object would do, and
           -- nothing ever checked. Read the function body, not the prose about
           -- it.
           --
           -- WHY IT MATTERS THE INSTANT THE FLAG GOES ON: this becomes the main
           -- booking path, and ~10 features key off linked_vendor_profile_id —
           -- the supplier doorway on /{slug}, editorial first-pick credit, Real
           -- Stories credit, Papic attribution, stage-note recipients, showcase
           -- credits, the verified median, fraud detection, the plausibility
           -- scanner, venue-room-size. Every handshake booking would have been
           -- a 'contracted' row with a NULL link, i.e. invisible to all of them.
           --
           -- SHAPE COPIED FROM acquire_service_time_slot, which is the only
           -- other RPC that books: rank 1, link taken from the row's OWN
           -- marketplace_vendor_id.
           --
           -- COALESCE is DEFENCE IN DEPTH, NOT A LIVE SAFEGUARD — and I only know
           -- that because writing the test disproved my own reasoning. I added it
           -- believing the `OR is_admin()` arm of the ownership gate could reach a
           -- row whose marketplace_vendor_id is NULL, where a bare assignment
           -- would blank an existing link. It cannot:
           --   event_vendors_lock_request_marketplace_chk
           --     CHECK (lock_request_state IS DISTINCT FROM 'pending'
           --            OR marketplace_vendor_id IS NOT NULL)
           -- and this UPDATE only ever matches lock_request_state='pending'. So
           -- the row it guards against cannot exist today. Kept because it costs
           -- nothing and the constraint is one migration away from being relaxed;
           -- the constraint itself is now pinned by a test, so whoever relaxes it
           -- is told.
           -- 🔑 VERIFY YOUR OWN CONCLUSIONS TOO. This comment was going to assert
           -- a live hazard that the schema already forbids.
           selection_match_rank     = 1,
           linked_vendor_profile_id =
             COALESCE(marketplace_vendor_id, linked_vendor_profile_id),
           status = CASE
                      WHEN status IN ('contracted', 'deposit_paid',
                                      'delivered', 'complete')
                        THEN status
                      ELSE 'contracted'::public.vendor_status
                    END,
           updated_at               = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION
    -- ⚠ THE VERIFIED-SHOP TRIGGER RAISES check_violation ON THIS TABLE AND THE
    -- FLIP MAKES IT NEWLY REACHABLE — it used to fire on the couple's write,
    -- where finalizeVendor handled it. (A second one, the free-tier booking cap,
    -- was dropped 2026-10-28 — owner: "Remove the limit." — and its
    -- "fully booked" answer went with it.) The shipped RPC had NO exception block at
    -- all, so a vendor pressing Agree would have met a raw Postgres string.
    -- Discriminate on the message; a blanket handler would tell a fully verified
    -- vendor to finish their verification, which is how a real defect gets
    -- triaged as a user error and never investigated.
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg LIKE 'vendor_not_verified%' THEN
        RETURN jsonb_build_object('status', 'not_verified', 'event_id', v_event_id);
      END IF;
      RAISE;  -- anything else is a real defect and must fail loudly.
    WHEN unique_violation THEN
      -- Raced a rival into the confirmed hard-single index between the
      -- pre-check above and this statement. Defence in depth, not the design.
      RETURN jsonb_build_object('status', 'group_taken', 'event_id', v_event_id);
  END;

  IF v_rows = 0 THEN
    SELECT lock_request_state, lock_agreed_at INTO v_state, v_agreed_at
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    RETURN jsonb_build_object(
      'status', 'already', 'current', v_state,
      'agreed_at', v_agreed_at, 'event_id', v_event_id);
  END IF;

  -- ── A PACKAGE IS ONE ANSWER, N ROWS (PR-H slice B) ──────────────────────
  -- The package lock path cascades one ANCHOR row plus a COVERED row per kept
  -- line, all pointing at one event_vendor_packages booking. Only the anchor
  -- carries the request — the pending index's own predicate says so
  -- (package_role IS DISTINCT FROM 'covered'), and a covered line is not a
  -- separate question anybody could answer.
  --
  -- 🔑 SO AGREEING TO THE ANCHOR MUST BOOK THE WHOLE PACKAGE. Without this the
  -- supplier's yes would confirm ONE line and leave every other line of the
  -- package they just agreed to sitting at 'considering' — a half-booked
  -- package, which is not a state the product has copy for, a price for, or a
  -- way out of.
  --
  -- Same MONOTONE shape as the anchor's own flip: a covered row already further
  -- up the ladder keeps its status, so this can never demote a paid line. The
  -- booking row moves 'considering' → 'locked' and takes its locked_at receipt
  -- at the moment the receipt becomes true, not seven days earlier.
  IF v_pkg_id IS NOT NULL THEN
    UPDATE public.event_vendors
       SET status = CASE
                      WHEN status IN ('contracted', 'deposit_paid',
                                      'delivered', 'complete')
                        THEN status
                      ELSE 'contracted'::public.vendor_status
                    END,
           updated_at = NOW()
     WHERE event_vendor_package_id = v_pkg_id
       AND package_role = 'covered'
       AND archived_at IS NULL;
    GET DIAGNOSTICS v_covered = ROW_COUNT;

    UPDATE public.event_vendor_packages
       SET status    = 'locked',
           locked_at = COALESCE(locked_at, NOW())
     WHERE booking_id = v_pkg_id
       AND status = 'considering';
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok', 'agreed_at', NOW(), 'event_id', v_event_id,
    'package_lines_booked', COALESCE(v_covered, 0));
END;
$function$;


-- ── 9 · the bench search's mirror counts pieces too ─────────────────────────
-- service_cards_unbookable_on (the H6 mirror of the booking path, read by Discover and the bench): body identical to
-- 20271316466285 except its schedule count, which is now schedule_pool_taken_on — so a schedule whose 500 chairs are
-- out reads FULL there too, not "2 bookings of 500". Guarded by lib/h6-mirrors-the-booking-path.test.ts.
CREATE OR REPLACE FUNCTION public.service_cards_unbookable_on(
  p_service_ids     uuid[],
  p_dates           date[],
  p_named_calendars boolean DEFAULT TRUE
)
RETURNS TABLE (service_id uuid, refused_on date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  IF p_service_ids IS NULL OR p_dates IS NULL
     OR cardinality(p_service_ids) = 0 OR cardinality(p_dates) = 0 THEN
    RETURN;
  END IF;
  IF cardinality(p_service_ids) > 100 THEN
    RAISE EXCEPTION 'too_many_service_ids' USING ERRCODE = '22023',
      HINT = 'at most 100 service cards per call';
  END IF;
  IF cardinality(p_dates) > 31 THEN
    RAISE EXCEPTION 'too_many_dates' USING ERRCODE = '22023',
      HINT = 'at most 31 dates per call';
  END IF;

  RETURN QUERY
  WITH
  svc AS (
    SELECT s.vendor_service_id AS sid, s.vendor_profile_id AS vpid, s.category,
           public.service_card_daily_limit(s.vendor_service_id) AS dcap
      FROM public.vendor_services s
     WHERE s.vendor_service_id = ANY (p_service_ids)
  ),
  d AS (
    SELECT DISTINCT x.day FROM unnest(p_dates) AS x(day) WHERE x.day IS NOT NULL
  ),
  -- A card on halls is on exactly its halls (2026-10-14 🏛) — whatever the flag.
  hall AS (
    SELECT h.vendor_service_id AS sid, h.pool_id
      FROM public.vendor_service_halls h
     WHERE h.vendor_service_id IN (SELECT sid FROM svc)
  ),

  -- ── Pool resolution, read-only (see 20271221805341 header §3) ────────────
  wanted_category AS (
    SELECT svc.sid, svc.vpid, svc.category AS category_key
      FROM svc
      LEFT JOIN public.vendor_schedule_calendar_services cs
        ON cs.vendor_service_id = svc.sid
     WHERE svc.category IS NOT NULL AND length(svc.category) > 0
       AND (NOT p_named_calendars OR cs.pool_id IS NULL)
       AND NOT EXISTS (SELECT 1 FROM hall WHERE hall.sid = svc.sid)
    UNION
    SELECT svc.sid, svc.vpid, l.linked_canonical_service
      FROM svc
      JOIN public.vendor_service_links l ON l.vendor_service_id = svc.sid
     WHERE l.linked_canonical_service IS NOT NULL
       AND length(l.linked_canonical_service) > 0
  ),
  real_pool AS (
    SELECT hall.sid, hall.pool_id FROM hall
    UNION
    SELECT svc.sid, cs.pool_id
      FROM svc
      JOIN public.vendor_schedule_calendar_services cs ON cs.vendor_service_id = svc.sid
     WHERE p_named_calendars
       AND NOT EXISTS (SELECT 1 FROM hall WHERE hall.sid = svc.sid)
    UNION
    SELECT wc.sid, pc.pool_id
      FROM wanted_category wc
      JOIN public.vendor_schedule_pool_categories pc
        ON pc.vendor_profile_id = wc.vpid AND pc.category_key = wc.category_key
  ),
  virtual_pool_card AS (
    SELECT DISTINCT wc.sid, wc.vpid
      FROM wanted_category wc
     WHERE NOT EXISTS (
       SELECT 1 FROM public.vendor_schedule_pool_categories pc
        WHERE pc.vendor_profile_id = wc.vpid AND pc.category_key = wc.category_key)
  ),
  active_pool AS (
    SELECT rp.sid, p.pool_id, p.vendor_profile_id AS vpid, p.daily_booking_capacity AS cap,
           (vs.availability_style = 'piece') AS by_piece
      FROM real_pool rp
      JOIN public.vendor_schedule_pools p ON p.pool_id = rp.pool_id
      LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = rp.sid
     WHERE p.is_active
  ),

  -- ── (a)+(a2) shop-wide: refuses every active pool, real or new ──────────
  shop_closed AS (
    SELECT DISTINCT c.vpid, d.day
      FROM (SELECT vpid FROM active_pool UNION SELECT vpid FROM virtual_pool_card) c
     CROSS JOIN d
     WHERE EXISTS (
             SELECT 1 FROM public.vendor_calendar_blocks b
              WHERE b.vendor_profile_id = c.vpid
                AND b.block_source IN ('manual', 'synced_calendar')
                AND b.pool_id IS NULL
                AND b.day_part = 'all_day'
                AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, d.day))
        OR EXISTS (
             SELECT 1 FROM public.vendor_calendar_day_states ds
              WHERE ds.vendor_profile_id = c.vpid
                AND ds.state_date = d.day
                AND ds.pool_id IS NULL
                AND ds.day_state = 'locked')
  ),

  -- ── (a)+(a2)+(b) per REAL active pool ───────────────────────────────────
  pool_refused AS (
    SELECT ap.sid, d.day
      FROM active_pool ap
     CROSS JOIN d
     WHERE EXISTS (
             SELECT 1 FROM public.vendor_calendar_blocks b
              WHERE b.vendor_profile_id = ap.vpid
                AND b.block_source IN ('manual', 'synced_calendar')
                AND (b.pool_id = ap.pool_id OR b.pool_id IS NULL)
                AND b.day_part = 'all_day'
                AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, d.day))
        OR EXISTS (
             SELECT 1 FROM public.vendor_calendar_day_states ds
              WHERE ds.vendor_profile_id = ap.vpid
                AND ds.state_date = d.day
                AND (ds.pool_id = ap.pool_id OR ds.pool_id IS NULL)
                AND ds.day_state = 'locked')
        -- 🗓 STEP 4: the SAME count acquire_schedule_pools refuses by (+ outside clients). A by-the-piece card is NOT
        -- refused by its schedule's number — its card's own number is the one (capacity_refused, below), as in acquire.
        OR (ap.by_piece IS NOT TRUE AND public.schedule_pool_taken_on(ap.pool_id, d.day, NULL) >= ap.cap)
    UNION
    SELECT vp.sid, sc.day
      FROM virtual_pool_card vp
      JOIN shop_closed sc ON sc.vpid = vp.vpid
  ),

  -- ── SLOTS (every plan since 2026-10-14), per acquire_service_time_slot ──
  slot AS (
    SELECT t.slot_id, t.vendor_service_id AS sid, t.vendor_profile_id AS vpid, t.slot_capacity AS cap,
           t.start_time AS st, t.end_time AS et
      FROM public.vendor_service_time_slots t
     WHERE t.vendor_service_id IN (SELECT sid FROM svc)
       AND t.is_active
  ),
  slot_refused AS (
    SELECT sc.sid, d.day
      FROM (SELECT DISTINCT sid, vpid FROM slot) sc
     CROSS JOIN d
     WHERE EXISTS (
             SELECT 1 FROM public.vendor_calendar_day_states ds
              WHERE ds.vendor_profile_id = sc.vpid
                AND ds.state_date = d.day
                AND ds.pool_id IS NULL
                AND ds.day_state = 'locked')
        OR NOT EXISTS (
             -- a slot with room that day, whose hours are not "Not available"
             SELECT 1 FROM slot sl
              WHERE sl.sid = sc.sid
                AND NOT public.calendar_blocks_refuse_slot(sl.sid, d.day, sl.st, sl.et)
                AND (SELECT count(*)
                       FROM public.event_vendors ev
                       JOIN public.events e ON e.event_id = ev.event_id
                      WHERE ev.service_time_slot_id = sl.slot_id
                        AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
                        AND ev.archived_at IS NULL
                        AND e.event_date = d.day
                        AND e.event_date_precision = 'day') < sl.cap)
  ),

  -- ── PER-CARD DAILY LIMIT (#2), per vendors/actions.ts finalizeVendor ─────
  capacity_refused AS (
    SELECT svc.sid, d.day
      FROM svc
     CROSS JOIN d
     WHERE svc.dcap IS NOT NULL AND svc.dcap > 0
       AND NOT EXISTS (SELECT 1 FROM slot sl WHERE sl.sid = svc.sid)
       AND public.service_card_bookings_on(svc.sid, d.day) >= svc.dcap
  )

  SELECT r.sid, r.day FROM pool_refused r
  UNION
  SELECT r.sid, r.day FROM slot_refused r
  UNION
  SELECT r.sid, r.day FROM capacity_refused r;
END;
$function$;

REVOKE ALL ON FUNCTION public.service_cards_unbookable_on(uuid[], date[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_cards_unbookable_on(uuid[], date[], boolean) TO service_role;

-- ── 11 · Copy to another branch carries the usual preparation time too ─────
-- copy_vendor_service_to_branch: body identical to 20271351451190 (step 3) plus usual_prep_days, so a branch copy of a
-- Made to order card is counted in progress the same way.
-- ⚠ Any later migration that redefines it must keep availability_style, order_lead_days AND usual_prep_days.
CREATE OR REPLACE FUNCTION public.copy_vendor_service_to_branch(
  p_vendor_profile_id UUID,
  p_source_service_id UUID,
  p_branch_id         UUID,      -- NULL = the main location
  p_price_php         INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s          public.vendor_services%ROWTYPE;
  v_new_id   UUID := gen_random_uuid();
  v_pool_id  UUID;
  v_capacity INTEGER;
  v_label    TEXT;
  v_start    INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND p_vendor_profile_id NOT IN (SELECT public.current_vendor_ids('admin')) THEN
    RAISE EXCEPTION 'Only an admin of this shop can copy its cards.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_price_php IS NULL OR p_price_php <= 0 OR p_price_php > 100000000 THEN
    RAISE EXCEPTION 'Set the price there before you copy.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO s FROM public.vendor_services
   WHERE vendor_service_id = p_source_service_id AND vendor_profile_id = p_vendor_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF s.branch_id IS NOT DISTINCT FROM p_branch_id THEN
    RAISE EXCEPTION 'That card is already at this branch.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_branch_id IS NOT NULL THEN
    SELECT branch_label INTO v_label FROM public.vendor_branches
     WHERE branch_id = p_branch_id AND parent_vendor_profile_id = p_vendor_profile_id AND cancelled_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That branch is not one of yours.' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_label := 'Main';
  END IF;

  -- "Price there" is the card's headline number on its own basis; the "from ₱X" anchor follows it the same way
  -- parsePricingFields (services/actions.ts) computes it.
  v_start := CASE COALESCE(s.pricing_basis, 'fixed')
               WHEN 'per_pax'  THEN p_price_php * COALESCE(NULLIF(s.min_pax, 0), 1)
               ELSE p_price_php
             END;

  PERFORM set_config('setnayan.branch_copy', 'on', true);
  INSERT INTO public.vendor_services (
    vendor_service_id, vendor_profile_id, category, title, branch_id, branch_copy_of, is_active,
    starting_price_php, per_pax_price_php, hour_base_php,
    crew_size, crew_meal_required, crew_meal_included, transport_included, transport_flat_fee_php,
    package_inclusions, primary_photo_r2_key, showcase_video_r2_key, showcase_photo_r2_keys,
    last_minute_end_months, last_minute_surcharge_pct, daily_capacity, is_linked_only,
    added_pax_price_php, added_pax_block, recommended_lead_time_months, exclusive_perk_text,
    is_demo, demo_batch_id, base_pax, coverage_id, pricing_basis, min_pax, min_hours, extra_hour_php,
    includes_setnayan_gift, gift_pack_code, category_request_id,
    availability_style, order_lead_days, usual_prep_days
  ) VALUES (
    v_new_id, s.vendor_profile_id, s.category, s.title, p_branch_id, s.vendor_service_id, s.is_active,
    v_start,
    CASE WHEN s.pricing_basis = 'per_pax'  THEN p_price_php ELSE s.per_pax_price_php END,
    CASE WHEN s.pricing_basis = 'per_hour' THEN p_price_php ELSE s.hour_base_php END,
    s.crew_size, s.crew_meal_required, s.crew_meal_included, s.transport_included, s.transport_flat_fee_php,
    s.package_inclusions, s.primary_photo_r2_key, s.showcase_video_r2_key, s.showcase_photo_r2_keys,
    s.last_minute_end_months, s.last_minute_surcharge_pct, s.daily_capacity, s.is_linked_only,
    s.added_pax_price_php, s.added_pax_block, s.recommended_lead_time_months, s.exclusive_perk_text,
    s.is_demo, s.demo_batch_id, s.base_pax, s.coverage_id, s.pricing_basis, s.min_pax, s.min_hours, s.extra_hour_php,
    s.includes_setnayan_gift, s.gift_pack_code, s.category_request_id,
    s.availability_style, s.order_lead_days, s.usual_prep_days
  );

  PERFORM set_config('setnayan.branch_copy', '', true);

  INSERT INTO public.vendor_service_price_brackets (vendor_service_id, vendor_profile_id, min_pax, max_pax, price_php, sort_order)
  SELECT v_new_id, vendor_profile_id, min_pax, max_pax, price_php, sort_order
    FROM public.vendor_service_price_brackets WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
  SELECT v_new_id, vendor_profile_id, label, worth_php, sort_order
    FROM public.vendor_service_inclusions WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_discounts (vendor_service_id, vendor_profile_id, discount_type, rate, unit, expires_at, conditions_md, sort_order, min_lead_months)
  SELECT v_new_id, vendor_profile_id, discount_type, rate, unit, expires_at, conditions_md, sort_order, min_lead_months
    FROM public.vendor_service_discounts WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_addons (vendor_service_id, vendor_profile_id, label, from_price_php, sort_order)
  SELECT v_new_id, vendor_profile_id, label, from_price_php, sort_order
    FROM public.vendor_service_addons WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_payment_schedules (vendor_service_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos, due_anchor, due_offset_days, cancellation_terms, downpayment_non_refundable, refund_window_days, no_show_forfeit)
  SELECT v_new_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos, due_anchor, due_offset_days, cancellation_terms, downpayment_non_refundable, refund_window_days, no_show_forfeit
    FROM public.vendor_service_payment_schedules WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_time_slots (vendor_service_id, vendor_profile_id, slot_label, start_time, end_time, slot_capacity, display_order, is_active, seat_capacity)
  SELECT v_new_id, vendor_profile_id, slot_label, start_time, end_time, slot_capacity, display_order, is_active, seat_capacity
    FROM public.vendor_service_time_slots WHERE vendor_service_id = s.vendor_service_id;

  -- Its own calendar: a new vendor-named pool, as many a day as the original's calendar allows.
  SELECT p.daily_booking_capacity INTO v_capacity
    FROM public.vendor_schedule_calendar_services c
    JOIN public.vendor_schedule_pools p ON p.pool_id = c.pool_id
   WHERE c.vendor_service_id = s.vendor_service_id;
  INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label, calendar_name, daily_booking_capacity, is_vendor_created)
  VALUES (
    s.vendor_profile_id,
    left(COALESCE(NULLIF(btrim(s.title), ''), s.category) || ' · ' || v_label, 80),
    left(COALESCE(NULLIF(btrim(s.title), ''), s.category) || ' · ' || v_label, 80),
    LEAST(GREATEST(COALESCE(v_capacity, 1), 1), 500),  -- the schedule's own CHECK 1..500 (20271350427190); was 50, pre-lift
    TRUE
  )
  RETURNING pool_id INTO v_pool_id;
  INSERT INTO public.vendor_schedule_calendar_services (vendor_service_id, pool_id, vendor_profile_id)
  VALUES (v_new_id, v_pool_id, s.vendor_profile_id);

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) IS
  'Copy to another branch (owner 2026-11-14, item 10). Admin of the shop only. Copies the card''s AUTHORED fields and children, references the same photos, sets branch_copy_of (so it uses no card), gives it its own price and its own schedule pool. Never copies bookings, reviews, halls, agents or the public id.';

COMMIT;
