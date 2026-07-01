-- vendor calendar day states 6 state taxonomy
--
-- PHASE 5 (Vendor Dashboard reorg) — the 6-state day taxonomy gets its own
-- explicit storage, and the two states that had NO storage before land here.
--
-- The 6 day states, in precedence order, and where each lives:
--   blocked   — a manual / synced closure block covers the date
--               (vendor_calendar_blocks, block_source manual|synced_calendar).
--   locked    — NET-NEW. A vendor-set hard hold on a date: gates new bookings
--               like a closure, but is a first-class "I'm holding this" marker
--               with its own note (prep day, tentative client, personal). Stored
--               HERE.  ← this migration adds it.
--   whitelist — NET-NEW. A vendor-set "approve-first" day: the vendor wants to
--               vet any new Setnayan booking before the date auto-consumes, so
--               the atomic acquire is HELD (returns 'whitelist') rather than
--               silently consuming. Stored HERE.  ← this migration adds it.
--   full      — consuming reservations (booked + external clients) >= capacity
--               (derived from vendor_schedule_pool_bookings + external_client
--               blocks vs vendor_schedule_pools.daily_booking_capacity).
--   booked    — 0 < consumed < capacity (same derivation).
--   open      — default: no row here, no block, capacity free.
-- (waitlist is a SEPARATE couple-facing concept — vendor_date_waitlist — not a
--  vendor-set day state, so it is NOT stored in this table.)
--
-- Both new states GATE the atomic booking-accept path server-side (this
-- migration re-defines acquire_schedule_pools to honor them), so a
-- locked / whitelist day can never be double-booked out from under the vendor.
--
-- RLS at CREATE TABLE time (canonical helpers, prod):
--   • vendor owner manages own rows   (vendor_profile_id IN current_vendor_profile_ids())
--   • admin full                      (is_admin())
--   No couple/public read: couples only ever see "unavailable" (privacy lock);
--   the gating happens inside the SECURITY DEFINER acquire RPC, not via a
--   couple-visible read.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS · ADD COLUMN IF NOT EXISTS ·
-- CREATE INDEX IF NOT EXISTS · CREATE OR REPLACE FUNCTION · DROP POLICY IF
-- EXISTS then CREATE POLICY.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_calendar_day_states — explicit vendor-set day states.
--    Grain: one row per (vendor, pool-or-org, civil DATE, state). pool_id NULL
--    = org-wide (every schedule). A given (vendor, pool, date) carries at most
--    one live state via the partial unique index below.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_calendar_day_states (
  day_state_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id)
                     ON DELETE CASCADE,
  -- NULL = org-wide (applies to every schedule pool). Set = scoped to one pool.
  pool_id            UUID
                     REFERENCES public.vendor_schedule_pools(pool_id)
                     ON DELETE CASCADE,
  state_date         DATE NOT NULL,
  -- Only the two NET-NEW vendor-set states live here. blocked/full/booked/open
  -- are derived elsewhere (see header) and must NOT be written here.
  day_state          TEXT NOT NULL
                     CHECK (day_state IN ('locked', 'whitelist')),
  note               TEXT
                     CHECK (note IS NULL OR length(note) <= 300),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one live state per (vendor, pool-scope, date). COALESCE folds the
-- org-wide NULL pool into a sentinel so (vendor, NULL, date) is also unique.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_calendar_day_states_uniq
  ON public.vendor_calendar_day_states
     (vendor_profile_id, COALESCE(pool_id, '00000000-0000-0000-0000-000000000000'::uuid), state_date);

-- The acquire hot path: is there a locked/whitelist state for this pool (or
-- org-wide) on this date?
CREATE INDEX IF NOT EXISTS vendor_calendar_day_states_pool_date_idx
  ON public.vendor_calendar_day_states (vendor_profile_id, state_date);

ALTER TABLE public.vendor_calendar_day_states ENABLE ROW LEVEL SECURITY;

-- Vendor owner manages their own day states (mirrors vendor_schedule_pools).
DROP POLICY IF EXISTS vendor_calendar_day_states_owner
  ON public.vendor_calendar_day_states;
CREATE POLICY vendor_calendar_day_states_owner
  ON public.vendor_calendar_day_states FOR ALL
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Admin full control (ops / support).
DROP POLICY IF EXISTS vendor_calendar_day_states_admin
  ON public.vendor_calendar_day_states;
CREATE POLICY vendor_calendar_day_states_admin
  ON public.vendor_calendar_day_states FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.vendor_calendar_day_states IS
  'PHASE 5 6-state day taxonomy: explicit vendor-set day states. Holds the two states with no prior storage — locked (hard hold, gates like a closure) and whitelist (approve-first: new bookings held for vendor review). blocked/full/booked/open are derived (blocks + bookings + capacity); waitlist lives in vendor_date_waitlist. Both states here gate the atomic acquire_schedule_pools RPC server-side. Couples never read this — they see only "unavailable" (privacy lock).';

-- ----------------------------------------------------------------------------
-- 2. set_vendor_calendar_day_state — owner-authenticated upsert / clear.
--    p_day_state NULL clears any state (→ open). Idempotent. Owner-only:
--    RAISEs when the caller doesn't own the pool / profile.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_vendor_calendar_day_state(
  p_vendor_profile_id UUID,
  p_pool_id           UUID,   -- NULL = org-wide
  p_state_date        DATE,
  p_day_state         TEXT,   -- 'locked' | 'whitelist' | NULL (clear → open)
  p_note              TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  -- Ownership: the profile must belong to the caller (an org member).
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
       AND (vp.user_id = auth.uid()
            OR vp.vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  ) INTO v_is_owner;
  IF NOT v_is_owner AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  IF p_state_date IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_date');
  END IF;

  -- A pool-scoped state must reference the caller's OWN pool.
  IF p_pool_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vendor_schedule_pools sp
       WHERE sp.pool_id = p_pool_id
         AND sp.vendor_profile_id = p_vendor_profile_id
    ) THEN
      RETURN jsonb_build_object('status', 'bad_pool');
    END IF;
  END IF;

  -- Clear (→ open): delete any live state for this (vendor, pool-scope, date).
  IF p_day_state IS NULL THEN
    DELETE FROM public.vendor_calendar_day_states
     WHERE vendor_profile_id = p_vendor_profile_id
       AND COALESCE(pool_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(p_pool_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND state_date = p_state_date;
    RETURN jsonb_build_object('status', 'cleared');
  END IF;

  IF p_day_state NOT IN ('locked', 'whitelist') THEN
    RETURN jsonb_build_object('status', 'bad_state');
  END IF;

  -- Upsert. The COALESCE-based unique index is a partial expression index, so
  -- ON CONFLICT can't target it directly; do an explicit update-then-insert.
  UPDATE public.vendor_calendar_day_states
     SET day_state = p_day_state,
         note = NULLIF(left(COALESCE(p_note, ''), 300), ''),
         updated_at = NOW()
   WHERE vendor_profile_id = p_vendor_profile_id
     AND COALESCE(pool_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(p_pool_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND state_date = p_state_date;
  IF NOT FOUND THEN
    INSERT INTO public.vendor_calendar_day_states
      (vendor_profile_id, pool_id, state_date, day_state, note)
    VALUES
      (p_vendor_profile_id, p_pool_id, p_state_date, p_day_state,
       NULLIF(left(COALESCE(p_note, ''), 300), ''));
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'day_state', p_day_state);
END;
$$;

REVOKE ALL ON FUNCTION public.set_vendor_calendar_day_state(UUID, UUID, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_vendor_calendar_day_state(UUID, UUID, DATE, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.set_vendor_calendar_day_state(UUID, UUID, DATE, TEXT, TEXT) IS
  'PHASE 5: owner-authenticated upsert/clear of a vendor-set day state (locked | whitelist | NULL→clear). Org-wide when p_pool_id IS NULL. Validates ownership + pool membership; idempotent. Read by acquire_schedule_pools to gate the atomic booking-accept.';

-- ----------------------------------------------------------------------------
-- 3. acquire_schedule_pools — re-defined to honor the two new day states.
--    Precedence: closure block → LOCKED → WHITELIST → capacity. A locked or
--    whitelist day (pool-scoped OR org-wide, i.e. pool_id NULL) HOLDS the
--    acquire so a booked date can never slip past a vendor's explicit hold.
--    Everything else is byte-identical to 20261126000000 § 6 (deterministic
--    FOR UPDATE ordering, occupancy math, all-or-nothing consume).
-- ----------------------------------------------------------------------------
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
  IF p_event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
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
    -- (a) Closure blocks: a manual/synced block overlapping the date, either
    --     scoped to this pool or org-wide (pool_id IS NULL), closes the date
    --     outright regardless of capacity.
    SELECT EXISTS (
      SELECT 1 FROM public.vendor_calendar_blocks b
       WHERE b.vendor_profile_id = v_pool.vendor_profile_id
         AND b.block_source IN ('manual', 'synced_calendar')
         AND (b.pool_id = v_pool.pool_id OR b.pool_id IS NULL)
         AND (b.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= v_date
         AND (b.blocked_until AT TIME ZONE 'Asia/Manila')::date >= v_date
    ) INTO v_closed;
    IF v_closed THEN
      RETURN jsonb_build_object('status', 'blocked', 'pool_id', v_pool.pool_id);
    END IF;

    -- (a2) NET-NEW: an explicit vendor-set day state (pool-scoped or org-wide).
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
    --     external-client jobs on this pool overlapping the date.
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
          AND (b.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= v_date
          AND (b.blocked_until AT TIME ZONE 'Asia/Manila')::date >= v_date)
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
  INSERT INTO public.vendor_schedule_pool_bookings
    (pool_id, vendor_profile_id, event_vendor_id, event_id, booked_date)
  SELECT sp.pool_id, sp.vendor_profile_id, p_event_vendor_id, p_event_id, v_date
    FROM public.vendor_schedule_pools sp
   WHERE sp.pool_id = ANY (p_pool_ids)
  ON CONFLICT (pool_id, event_vendor_id) WHERE released_at IS NULL
  DO NOTHING;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pool_ids', to_jsonb(p_pool_ids),
    'booked_date', v_date);
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) IS
  'Multi-pool all-or-nothing atomic acquire (owner 2026-06-12). PHASE 5: now also honors vendor-set day states — precedence closure-block → LOCKED (hard hold) → WHITELIST (approve-first hold) → capacity. Deterministic-order FOR UPDATE on every pool row; degrades open without a day-precise date. Couple-auth via current_couple_event_ids().';

COMMIT;

-- =============================================================================
-- VERIFICATION (run via supabase db query):
--   \d public.vendor_calendar_day_states
--   SELECT proname FROM pg_proc
--    WHERE proname IN ('set_vendor_calendar_day_state','acquire_schedule_pools');
--   SELECT polname FROM pg_policy
--    WHERE polrelid = 'public.vendor_calendar_day_states'::regclass;
--   -- locked day gates:
--   -- SELECT public.set_vendor_calendar_day_state('<vendor>', NULL, '2026-12-25', 'locked', 'holiday hold');
--   -- then a couple acquire on 2026-12-25 must return {"status":"locked"}.
-- =============================================================================
