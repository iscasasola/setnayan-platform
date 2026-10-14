-- ============================================================================
-- 20271269411264_schedules_repeats_hours_and_halls.sql
--
-- "NOT AVAILABLE" REPEATS AND TAKES HOURS · AN OUTSIDE BOOKING HAS A TIME.
--
-- Owner, 2026-10-14 (DECISION_LOG ✅ "APPROVE": the simpler supplier dashboard —
-- "repeating 'Not available' blocks + hour ranges: YES (new schema — allocate
-- forward, RLS at create)"); prototype
-- `prototypes/supplier_easy_dashboard_2026-10-14_fable.html` SHEETS.block
-- (Repeats · Hours) and SHEETS.add (Name · Schedule · Date · TIME · Note).
-- The case that asked for it: a parish whose Sunday Masses fill every Sunday
-- morning, typed by a church helper — one row, not fifty-two.
--
-- EXTENDS THE SHIPPED TABLE — no new table. `vendor_calendar_blocks` already
-- holds every closure and every outside booking (`block_source`); four columns:
--
--   repeat_rule   'once' (the range, as before) · 'weekly' (every weekday of
--                 the first day) · 'weekend' (every Sat + Sun) · 'daily'.
--                 A repeat starts on the first day (blocked_at, Manila) and
--                 runs to repeat_until (inclusive) — for ever when NULL.
--   repeat_until  DATE · only on a repeat.
--   day_part      'all_day' · 'morning' 06:00–12:00 · 'afternoon' 12:00–18:00 ·
--                 'evening' 18:00–24:00.
--   client_time   TIME · the start time of an outside booking (NULL = none given).
--
-- Every existing row reads 'once' + 'all_day' + no time — so every existing
-- block means exactly what it meant before this file.
--
-- 🔑 THE RULE, ONCE, IN SQL — two small functions every gate calls:
--   calendar_block_on_day(...)       does the block cover this civil day?
--   calendar_block_meets_time(...)   does its part of the day meet this time?
-- Their TypeScript twin is `apps/web/lib/not-available.ts`; the db test
-- `not-available-repeats-and-hours.db.test.ts` runs both over one grid.
--
-- 🔑 A PART OF A DAY NEVER CLOSES THE DAY. Only an all_day block closes a date
-- (acquire_schedule_pools 'blocked'). A morning block refuses only the TIMES it
-- meets: an exact time slot overlapping it is refused by
-- acquire_service_time_slot ('blocked') — so a repeating Sunday-morning block
-- refuses a Sunday 10 AM slot and allows a Sunday 3 PM one.
--
-- EVERY READER IN SQL, re-pointed here (latest definitions copied, only the
-- block predicate changed):
--   acquire_schedule_pools        (20271103100000) — closures honour repeats; all-day only
--   acquire_service_time_slot     (20270405381226 + 20271105038066 grants) — NEW block gate by hours
--   service_cards_unbookable_on   (20271222330608) — the bench/couple mirror of both
--   vendors_blocked_on_date       (20270721314905) — the couple search's busy bit
--   import_external_client        (20270329583590) — takes p_client_time
--   capture_vendor_calendar_block_freed (20270911937450) — the freed log keeps the repeat
-- The setnayan_booking helpers (vendor_block_booked_date / _unblock_) write and
-- match one-off, all-day rows only — the CHECKs below keep it that way.
--
-- ── AND HALLS (owner 2026-10-14, DECISION_LOG 🏛) ────────────────────────────
-- "A vendor is a venue reception … 3 halls that can run independently, but can
-- also be connected to create a bigger hall." A venue's halls are schedules
-- (pools) flagged is_hall, each with its own guest capacity; a card USES one or
-- more halls (vendor_service_halls — a sibling link, so the one-schedule
-- membership table and every card on it are untouched). This LIFTS the
-- 2026-06-20 lock "one card = one schedule" (vendor_schedule_calendar_services
-- PK vendor_service_id) FOR HALLS: a card with hall links resolves to EXACTLY
-- its halls (never also its category pool, which would make two cards on
-- different halls collide). acquire_schedule_pools already locks several pools
-- all-or-nothing, so booking "Grand Hall = A + B + C" takes a seat on each,
-- and a Hall A booking refuses every card that uses A that day; halls not
-- involved stay free. Halls are not limited by the plan's per-day number
-- (the app's clamp skips them; the cap stays for other schedules).
-- ============================================================================

BEGIN;

-- ── 1 · THE COLUMNS ─────────────────────────────────────────────────────────
ALTER TABLE public.vendor_calendar_blocks
  ADD COLUMN IF NOT EXISTS repeat_rule  TEXT NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS repeat_until DATE,
  ADD COLUMN IF NOT EXISTS day_part     TEXT NOT NULL DEFAULT 'all_day',
  ADD COLUMN IF NOT EXISTS client_time  TIME;

ALTER TABLE public.vendor_calendar_blocks
  DROP CONSTRAINT IF EXISTS vendor_calendar_blocks_repeat_rule_check;
ALTER TABLE public.vendor_calendar_blocks
  ADD CONSTRAINT vendor_calendar_blocks_repeat_rule_check
  CHECK (repeat_rule IN ('once', 'weekly', 'weekend', 'daily'));

ALTER TABLE public.vendor_calendar_blocks
  DROP CONSTRAINT IF EXISTS vendor_calendar_blocks_day_part_check;
ALTER TABLE public.vendor_calendar_blocks
  ADD CONSTRAINT vendor_calendar_blocks_day_part_check
  CHECK (day_part IN ('all_day', 'morning', 'afternoon', 'evening'));

-- An end date only on a repeat, and never before its first day.
ALTER TABLE public.vendor_calendar_blocks
  DROP CONSTRAINT IF EXISTS vendor_calendar_blocks_repeat_until_check;
ALTER TABLE public.vendor_calendar_blocks
  ADD CONSTRAINT vendor_calendar_blocks_repeat_until_check
  CHECK (
    repeat_until IS NULL
    OR (repeat_rule <> 'once'
        AND repeat_until >= (blocked_at AT TIME ZONE 'Asia/Manila')::date)
  );

-- Only a closure the shop types repeats or takes hours. An outside booking and
-- a Setnayan booking stay one-off and all-day, so the capacity count (one
-- outside booking = one seat on the days it spans) and the booked-date helpers
-- never meet a repeat.
ALTER TABLE public.vendor_calendar_blocks
  DROP CONSTRAINT IF EXISTS vendor_calendar_blocks_only_closures_repeat;
ALTER TABLE public.vendor_calendar_blocks
  ADD CONSTRAINT vendor_calendar_blocks_only_closures_repeat
  CHECK (
    block_source IN ('manual', 'synced_calendar')
    OR (repeat_rule = 'once' AND day_part = 'all_day')
  );

-- A time belongs to an outside booking, on the minute.
ALTER TABLE public.vendor_calendar_blocks
  DROP CONSTRAINT IF EXISTS vendor_calendar_blocks_client_time_check;
ALTER TABLE public.vendor_calendar_blocks
  ADD CONSTRAINT vendor_calendar_blocks_client_time_check
  CHECK (
    client_time IS NULL
    OR (block_source = 'external_client' AND EXTRACT(SECOND FROM client_time) = 0)
  );

-- A repeat is found by the rule, not by its range — index the few that repeat.
CREATE INDEX IF NOT EXISTS vendor_calendar_blocks_repeat_idx
  ON public.vendor_calendar_blocks (vendor_profile_id)
  WHERE repeat_rule <> 'once';

COMMENT ON COLUMN public.vendor_calendar_blocks.repeat_rule IS
  'Not available, repeating (owner 2026-10-14): once (the blocked_at..blocked_until range) · weekly (every weekday of the first day) · weekend (every Sat + Sun) · daily. A repeat starts on the first day (blocked_at, Asia/Manila) and runs to repeat_until, or for ever. Read through calendar_block_on_day(), never by the range alone.';
COMMENT ON COLUMN public.vendor_calendar_blocks.repeat_until IS
  'The last day (inclusive) a repeating block covers; NULL = no end. Only on a repeat (CHECK).';
COMMENT ON COLUMN public.vendor_calendar_blocks.day_part IS
  'Which hours are not available (owner 2026-10-14): all_day · morning 06:00–12:00 · afternoon 12:00–18:00 · evening 18:00–24:00. Only all_day closes a date; a part refuses only the times it meets (calendar_block_meets_time).';
COMMENT ON COLUMN public.vendor_calendar_blocks.client_time IS
  'An outside booking''s start time (owner 2026-10-14, "Add a booking from outside" with a time). NULL = no time given. Shown on the supplier''s day; does not change the date''s capacity count.';

-- ── 1b · HALLS — a venue's schedules, and the cards that use them ─────────
ALTER TABLE public.vendor_schedule_pools
  ADD COLUMN IF NOT EXISTS is_hall           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seated_capacity   INT,
  ADD COLUMN IF NOT EXISTS standing_capacity INT;

ALTER TABLE public.vendor_schedule_pools
  DROP CONSTRAINT IF EXISTS vendor_schedule_pools_hall_guests_check;
ALTER TABLE public.vendor_schedule_pools
  ADD CONSTRAINT vendor_schedule_pools_hall_guests_check
  CHECK (
    (seated_capacity   IS NULL OR (is_hall AND seated_capacity   BETWEEN 1 AND 100000))
    AND
    (standing_capacity IS NULL OR (is_hall AND standing_capacity BETWEEN 1 AND 100000))
  );

COMMENT ON COLUMN public.vendor_schedule_pools.is_hall IS
  'A venue''s hall (owner 2026-10-14 🏛): a schedule a card may USE together with other halls (vendor_service_halls). Halls are not limited by the plan''s per-day number; the cap stays for other schedules.';
COMMENT ON COLUMN public.vendor_schedule_pools.seated_capacity IS 'A hall''s seated guest capacity (halls only).';
COMMENT ON COLUMN public.vendor_schedule_pools.standing_capacity IS 'A hall''s standing guest capacity (halls only).';

CREATE TABLE IF NOT EXISTS public.vendor_service_halls (
  vendor_service_id  UUID NOT NULL
                     REFERENCES public.vendor_services(vendor_service_id)
                     ON DELETE CASCADE,
  pool_id            UUID NOT NULL
                     REFERENCES public.vendor_schedule_pools(pool_id)
                     ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id)
                     ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_service_id, pool_id)
);

CREATE INDEX IF NOT EXISTS vendor_service_halls_pool_idx
  ON public.vendor_service_halls(pool_id);
CREATE INDEX IF NOT EXISTS vendor_service_halls_profile_idx
  ON public.vendor_service_halls(vendor_profile_id);

-- RLS AT CREATE — the same two policies as vendor_schedule_calendar_services
-- (20270209750853): the owner manages its own links; a signed-in couple may
-- read a published shop's links (they resolve the pools at booking time).
ALTER TABLE public.vendor_service_halls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_service_halls_owner ON public.vendor_service_halls;
CREATE POLICY vendor_service_halls_owner
  ON public.vendor_service_halls FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vendor_service_halls_public_read ON public.vendor_service_halls;
CREATE POLICY vendor_service_halls_public_read
  ON public.vendor_service_halls FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE is_published = TRUE
    )
  );

-- A browser holding the anon key has no business here.
REVOKE ALL ON TABLE public.vendor_service_halls FROM anon;

-- 🔑 A LINK MAY ONLY JOIN A SHOP'S OWN CARD TO THE SAME SHOP'S OWN HALL. RLS
-- checks the row's vendor_profile_id, not the pool's or the card's — without
-- this, a card could name ANOTHER shop's pool, and acquire_schedule_pools
-- (SECURITY DEFINER) would take a seat on it.
CREATE OR REPLACE FUNCTION public.guard_vendor_service_hall()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_schedule_pools p
     WHERE p.pool_id = NEW.pool_id
       AND p.vendor_profile_id = NEW.vendor_profile_id
       AND p.is_hall
  ) THEN
    RAISE EXCEPTION 'hall_not_yours' USING ERRCODE = '42501',
      HINT = 'a card may use only its own shop''s halls';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_services s
     WHERE s.vendor_service_id = NEW.vendor_service_id
       AND s.vendor_profile_id = NEW.vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'card_not_yours' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_vendor_service_hall() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_vendor_service_hall ON public.vendor_service_halls;
CREATE TRIGGER trg_guard_vendor_service_hall
  BEFORE INSERT OR UPDATE ON public.vendor_service_halls
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_vendor_service_hall();

COMMENT ON TABLE public.vendor_service_halls IS
  'Card → halls (owner 2026-10-14 🏛, LIFTS the 2026-06-20 one-card-one-schedule lock for halls): a card that uses halls resolves to EXACTLY these pools (resolvePoolIdsForService, service_cards_unbookable_on, calendar_blocks_refuse_slot) — never also its named schedule or category pool. acquire_schedule_pools takes a seat on each, all-or-nothing. Same-shop only (trg_guard_vendor_service_hall).';

-- ── 2 · THE RULE, ONCE ──────────────────────────────────────────────────────
-- Does the block cover this civil (Manila) day, at any hour?
CREATE OR REPLACE FUNCTION public.calendar_block_on_day(
  p_blocked_at    TIMESTAMPTZ,
  p_blocked_until TIMESTAMPTZ,
  p_repeat_rule   TEXT,
  p_repeat_until  DATE,
  p_day           DATE
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_day IS NULL OR p_blocked_at IS NULL THEN FALSE
    WHEN COALESCE(p_repeat_rule, 'once') = 'once' THEN
          (p_blocked_at    AT TIME ZONE 'Asia/Manila')::date <= p_day
      AND (p_blocked_until AT TIME ZONE 'Asia/Manila')::date >= p_day
    WHEN p_day < (p_blocked_at AT TIME ZONE 'Asia/Manila')::date THEN FALSE
    WHEN p_repeat_until IS NOT NULL AND p_day > p_repeat_until THEN FALSE
    WHEN p_repeat_rule = 'daily'   THEN TRUE
    WHEN p_repeat_rule = 'weekend' THEN EXTRACT(DOW FROM p_day) IN (0, 6)
    WHEN p_repeat_rule = 'weekly'  THEN
      EXTRACT(DOW FROM p_day) = EXTRACT(DOW FROM (p_blocked_at AT TIME ZONE 'Asia/Manila')::date)
    ELSE FALSE
  END
$$;

COMMENT ON FUNCTION public.calendar_block_on_day(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, DATE, DATE) IS
  'Does a vendor_calendar_blocks row cover this Asia/Manila civil day (any hours)? once = its range; weekly/weekend/daily = from its first day to repeat_until (or for ever). TS twin: apps/web/lib/not-available.ts blockOnDay.';

-- Does a part of the day meet a time? p_end NULL (or not after p_start) = a
-- moment, which meets the part it falls in. No time meets only all_day.
CREATE OR REPLACE FUNCTION public.calendar_block_meets_time(
  p_day_part TEXT,
  p_start    TIME,
  p_end      TIME
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  WITH r AS (
    SELECT
      CASE COALESCE(p_day_part, 'all_day')
        WHEN 'morning' THEN 360 WHEN 'afternoon' THEN 720 WHEN 'evening' THEN 1080 ELSE 0 END AS f,
      CASE COALESCE(p_day_part, 'all_day')
        WHEN 'morning' THEN 720 WHEN 'afternoon' THEN 1080 ELSE 1440 END AS t,
      (EXTRACT(HOUR FROM p_start) * 60 + EXTRACT(MINUTE FROM p_start))::int AS s,
      (EXTRACT(HOUR FROM p_end)   * 60 + EXTRACT(MINUTE FROM p_end))::int   AS e
  )
  SELECT CASE
    WHEN COALESCE(p_day_part, 'all_day') = 'all_day' THEN TRUE
    WHEN p_start IS NULL THEN FALSE
    WHEN p_end IS NULL OR r.e <= r.s THEN r.s >= r.f AND r.s < r.t
    ELSE r.s < r.t AND r.e > r.f
  END
  FROM r
$$;

COMMENT ON FUNCTION public.calendar_block_meets_time(TEXT, TIME, TIME) IS
  'Does a block''s day_part meet a time range? all_day meets everything; a part meets a range that overlaps it (half-open) or a moment inside it. TS twin: apps/web/lib/not-available.ts dayPartMeetsTime.';

-- Is an exact time slot of this card refused, on this day, by a "Not
-- available" block? Scoped like the pool gate: a shop-wide block, or one on
-- the card's own schedule (its named calendar, else its category's pool).
CREATE OR REPLACE FUNCTION public.calendar_blocks_refuse_slot(
  p_service_id UUID,
  p_day        DATE,
  p_start      TIME,
  p_end        TIME
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.vendor_services s
      JOIN public.vendor_calendar_blocks b ON b.vendor_profile_id = s.vendor_profile_id
     WHERE s.vendor_service_id = p_service_id
       AND b.block_source IN ('manual', 'synced_calendar')
       AND (
         b.pool_id IS NULL
         OR b.pool_id IN (
           -- A card on halls is on exactly its halls …
           SELECT h.pool_id FROM public.vendor_service_halls h
            WHERE h.vendor_service_id = s.vendor_service_id
           UNION ALL
           -- … else on its named schedule …
           SELECT cs.pool_id FROM public.vendor_schedule_calendar_services cs
            WHERE cs.vendor_service_id = s.vendor_service_id
              AND NOT EXISTS (
                SELECT 1 FROM public.vendor_service_halls h2
                 WHERE h2.vendor_service_id = s.vendor_service_id)
           UNION ALL
           -- … else on its category's pool.
           SELECT pc.pool_id FROM public.vendor_schedule_pool_categories pc
            WHERE pc.vendor_profile_id = s.vendor_profile_id
              AND pc.category_key = s.category
              AND NOT EXISTS (
                SELECT 1 FROM public.vendor_schedule_calendar_services cs2
                 WHERE cs2.vendor_service_id = s.vendor_service_id)
              AND NOT EXISTS (
                SELECT 1 FROM public.vendor_service_halls h3
                 WHERE h3.vendor_service_id = s.vendor_service_id)
         )
       )
       AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, p_day)
       AND public.calendar_block_meets_time(b.day_part, p_start, p_end)
  )
$$;

COMMENT ON FUNCTION public.calendar_blocks_refuse_slot(UUID, DATE, TIME, TIME) IS
  'Is a card''s time window refused on a day by a manual/synced "Not available" block (shop-wide, or on the card''s own schedule), honouring repeats and hours? Asked by acquire_service_time_slot and service_cards_unbookable_on — one predicate, so the bench never disagrees with the booking path. Server-only.';

REVOKE ALL ON FUNCTION public.calendar_blocks_refuse_slot(UUID, DATE, TIME, TIME) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_blocks_refuse_slot(UUID, DATE, TIME, TIME) TO service_role;

-- ── 3 · acquire_schedule_pools — closures honour repeats; only all_day closes ─
-- Copied from 20271103100000 (latest). Changed: the closure predicate (a) and
-- the outside-booking count (b) ask calendar_block_on_day; (a) adds day_part.
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
      (SELECT count(*) FROM public.vendor_schedule_pool_bookings pb
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

    IF v_used >= v_pool.daily_booking_capacity THEN
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

-- ── 4 · acquire_service_time_slot — a slot meeting "Not available" is refused ─
-- Copied from 20270405381226 (latest body; 20271105038066 only revoked anon).
-- Changed: one NEW gate, (b0) below — before this file the slot path read no
-- block at all (a slotted card's closures were refused only by the pool path).
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
  v_start      TIME;
  v_end        TIME;
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
  -- Also read the owning vendor_profile_id for the day-state gate below, and
  -- the window for the "Not available" gate.
  SELECT slot_capacity, vendor_profile_id, start_time, end_time
    INTO v_capacity, v_vendor_pid, v_start, v_end
    FROM public.vendor_service_time_slots
   WHERE slot_id = p_slot_id
     AND vendor_service_id = p_service_id
     AND is_active
   FOR UPDATE;

  IF v_capacity IS NULL THEN
    RETURN jsonb_build_object('status', 'slot_not_found');
  END IF;

  -- (b0) NOT AVAILABLE (2026-10-14). A manual/synced block covering the date
  -- (one-off or repeating) whose hours meet this slot's window refuses it —
  -- "every Sunday morning" refuses a Sunday 10 AM slot and leaves 3 PM open.
  -- Same predicate the bench asks (calendar_blocks_refuse_slot).
  IF public.calendar_blocks_refuse_slot(p_service_id, v_date, v_start, v_end) THEN
    RETURN jsonb_build_object('status', 'blocked', 'slot_id', p_slot_id);
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

-- Same grants as 20271105038066 left them: the couple's session only.
REVOKE EXECUTE ON FUNCTION public.acquire_service_time_slot(UUID, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_service_time_slot(UUID, UUID, UUID, UUID) TO authenticated;

-- ── 5 · service_cards_unbookable_on — the bench mirrors both gates ─────────
-- Copied from 20271222330608 (latest). Changed: every block predicate asks
-- calendar_block_on_day (repeats); closures are all_day only; a slot "with
-- room" must also not be refused by calendar_blocks_refuse_slot (hours).
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
           s.daily_capacity AS dcap
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
    SELECT rp.sid, p.pool_id, p.vendor_profile_id AS vpid, p.daily_booking_capacity AS cap
      FROM real_pool rp
      JOIN public.vendor_schedule_pools p ON p.pool_id = rp.pool_id
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
        OR (
             (SELECT count(*) FROM public.vendor_schedule_pool_bookings pb
               WHERE pb.pool_id = ap.pool_id
                 AND pb.booked_date = d.day
                 AND pb.released_at IS NULL)
           + (SELECT count(*) FROM public.vendor_calendar_blocks b
               WHERE b.pool_id = ap.pool_id
                 AND b.block_source = 'external_client'
                 AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, d.day))
           ) >= ap.cap
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

-- ── 6 · vendors_blocked_on_date — the search's busy bit, repeats included ───
-- Copied from 20270721314905. Changed: a block is "on the date" by the rule
-- (repeats), and only an all-day one makes the supplier busy that day — a
-- Sunday-morning Mass does not take a Sunday wedding off the list.
CREATE OR REPLACE FUNCTION public.vendors_blocked_on_date(
  p_vendor_ids uuid[],
  p_event_date date
)
RETURNS TABLE (vendor_profile_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT b.vendor_profile_id
  FROM public.vendor_calendar_blocks b
  WHERE b.vendor_profile_id = ANY (p_vendor_ids)
    AND b.day_part = 'all_day'
    AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, p_event_date);
$$;

REVOKE ALL     ON FUNCTION public.vendors_blocked_on_date(uuid[], date) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.vendors_blocked_on_date(uuid[], date) FROM anon;
GRANT  EXECUTE ON FUNCTION public.vendors_blocked_on_date(uuid[], date) TO authenticated;

-- ── 7 · import_external_client — a booking from outside has a time ─────────
-- Copied from 20270329583590 (latest). Changed: p_client_time (optional, last,
-- DEFAULT NULL — an older caller naming seven arguments still resolves).
-- A new argument is a new signature, so the old one is dropped first; the
-- grants are re-stated, and anon is now named (it held EXECUTE through
-- Supabase's default privileges; the body refused it anyway).
DROP FUNCTION IF EXISTS public.import_external_client(UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE);

CREATE OR REPLACE FUNCTION public.import_external_client(
  p_vendor_profile_id UUID,
  p_pool_id           UUID,
  p_client_name       TEXT,
  p_client_contact    TEXT,
  p_client_note       TEXT,
  p_start_date        DATE,
  p_end_date          DATE,
  p_client_time       TIME DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block_id UUID;
  v_name     TEXT := NULLIF(trim(p_client_name), '');
BEGIN
  -- Ownership — DEFINER + granted to authenticated, so gate explicitly
  -- (mirrors unlock_vendor_event).
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
       AND vp.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'not_owner');
  END IF;

  -- External clients are category-scoped by definition: the pool must be
  -- the vendor's own, active pool.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_schedule_pools sp
     WHERE sp.pool_id = p_pool_id
       AND sp.vendor_profile_id = p_vendor_profile_id
       AND sp.is_active
  ) THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'pool');
  END IF;

  IF v_name IS NULL OR length(v_name) > 120 THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'name');
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL
     OR p_end_date < p_start_date
     OR p_end_date - p_start_date > 31 THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'dates');
  END IF;

  -- Day-grain block in PH civil time: 00:00 → 23:30 (the 30-min granularity
  -- CHECK on vendor_calendar_blocks allows :00/:30 only; 23:30 keeps the
  -- ::date overlap math on the same civil day). The TIME is its own column:
  -- it says when the outside booking starts, and never moves the day's seat.
  INSERT INTO public.vendor_calendar_blocks
    (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label,
     block_source, is_private, client_name, client_contact, client_note, client_time)
  VALUES (
    p_vendor_profile_id,
    p_pool_id,
    (p_start_date::text || ' 00:00:00+08')::timestamptz,
    (p_end_date::text   || ' 23:30:00+08')::timestamptz,
    v_name,
    'external_client',
    TRUE,
    v_name,
    NULLIF(trim(p_client_contact), ''),
    NULLIF(trim(p_client_note), ''),
    date_trunc('minute', p_client_time)::time
  )
  RETURNING block_id INTO v_block_id;

  -- Import is FREE (owner 2026-06-30). No token burn.
  RETURN jsonb_build_object('status', 'ok', 'block_id', v_block_id, 'tokens_burned', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.import_external_client(UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE, TIME) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_external_client(UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE, TIME) TO authenticated;

-- ── 8 · the freed log keeps the repeat ──────────────────────────────────────
-- A removed repeating block frees every day it covered, not only its first.
ALTER TABLE public.vendor_availability_freed
  ADD COLUMN IF NOT EXISTS repeat_rule  TEXT NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS repeat_until DATE,
  ADD COLUMN IF NOT EXISTS day_part     TEXT NOT NULL DEFAULT 'all_day';

CREATE OR REPLACE FUNCTION public.capture_vendor_calendar_block_freed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vendor_availability_freed
    (vendor_profile_id, blocked_at, blocked_until, repeat_rule, repeat_until, day_part)
  VALUES
    (OLD.vendor_profile_id, OLD.blocked_at, OLD.blocked_until,
     OLD.repeat_rule, OLD.repeat_until, OLD.day_part);
  RETURN OLD;
END;
$$;

-- ── POST-CONDITIONS ─────────────────────────────────────────────────────────
DO $$
BEGIN
  -- The rule itself, on the case that asked for it.
  IF NOT public.calendar_block_on_day('2027-01-03 06:00+08', '2027-01-03 12:00+08', 'weekly', NULL, '2027-03-07') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: a weekly Sunday block does not cover a later Sunday';
  END IF;
  IF public.calendar_block_on_day('2027-01-03 06:00+08', '2027-01-03 12:00+08', 'weekly', NULL, '2027-03-08') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: a weekly Sunday block covers a Monday';
  END IF;
  IF NOT public.calendar_block_meets_time('morning', '10:00', '11:00') OR public.calendar_block_meets_time('morning', '15:00', '16:00') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the morning does not meet 10 AM, or meets 3 PM';
  END IF;
  -- Every gate asks the rule (a later CREATE OR REPLACE that drops it fails here only if it replays this file, so
  -- the db test re-checks the live definitions).
  IF position('calendar_block_on_day(' IN pg_get_functiondef('public.acquire_schedule_pools(uuid, uuid, uuid[])'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: acquire_schedule_pools does not ask calendar_block_on_day';
  END IF;
  IF position('calendar_blocks_refuse_slot(' IN pg_get_functiondef('public.acquire_service_time_slot(uuid, uuid, uuid, uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: acquire_service_time_slot does not ask calendar_blocks_refuse_slot';
  END IF;
  IF position('calendar_blocks_refuse_slot(' IN pg_get_functiondef('public.service_cards_unbookable_on(uuid[], date[], boolean)'::regprocedure)) = 0
     OR position('service_card_bookings_on(' IN pg_get_functiondef('public.service_cards_unbookable_on(uuid[], date[], boolean)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the bench search lost a gate';
  END IF;
  IF has_function_privilege('anon', 'public.calendar_blocks_refuse_slot(uuid, date, time, time)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.calendar_blocks_refuse_slot(uuid, date, time, time)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: a browser can ask whether a supplier is busy at a time';
  END IF;
  IF has_table_privilege('anon', 'public.vendor_service_halls', 'SELECT')
     OR has_table_privilege('anon', 'public.vendor_service_halls', 'INSERT') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: anon can read or write a card''s halls';
  END IF;
  IF position('vendor_service_halls' IN pg_get_functiondef('public.service_cards_unbookable_on(uuid[], date[], boolean)'::regprocedure)) = 0
     OR position('vendor_service_halls' IN pg_get_functiondef('public.calendar_blocks_refuse_slot(uuid, date, time, time)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: a card''s halls are not every pool the bench asks';
  END IF;
  IF has_function_privilege('anon', 'public.acquire_service_time_slot(uuid, uuid, uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.import_external_client(uuid, uuid, text, text, text, date, date, time)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: anon can execute a booking or outside-booking write';
  END IF;
END $$;

COMMIT;
