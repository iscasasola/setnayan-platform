-- ═══════════════════════════════════════════════════════════════════════════
-- THE HOST HANDS SHOTS OUT TO A CAMERA — and can take the unspent ones back
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner, 2026-08-11: *"the host can dedicated a specific number of shots for a
-- specific QR code. and the rest can be distributed to the rest"*.
--
-- The sibling migration (20271130515135) collapsed Papic to one product and one
-- ladder. This is the half that makes one product enough: a way to take shots
-- you already own and put them on one camera's QR, where nobody else can spend
-- them — and a way to pull the unspent ones back.
--
-- ── WHY THIS IS A NEW LEDGER AND NOT A NEW GRANT ROW ──────────────────────
-- papic_event_point_grants already carries the shared/dedicated distinction
-- (seat_id NULL vs SET) and the capture gate already spends a seat's dedicated
-- balance before the shared pool. The obvious move — write a +N seat grant and
-- a -N shared grant — is blocked by that table's own CHECK (points > 0), and
-- relaxing it would let any future writer mint a negative pool by accident.
--
-- It would also be wrong in kind. A grant row records WHAT WAS BOUGHT; it is an
-- append-only money record that an admin reads back when reconciling an order.
-- Handing shots to a camera is not a purchase and must not look like one in
-- that ledger. So allocation is a separate, mutable layer on top:
--
--   papic_seat_allocations — ONE row per camera, holding the amount the host
--                            has currently handed it. Not a log of moves; the
--                            current state. That is what makes it idempotent:
--                            "set this camera to 200" applied twice is 200.
--
-- The two read functions then compose the two layers, and every existing gate,
-- meter and refund path keeps working untouched because both already ask those
-- two functions rather than the tables:
--
--   dedicated to a camera = its seat grants  +  its allocation
--   left in the shared pot = shared grants   −  every allocation
--
-- ── THE INVERSE SHIPS IN THE SAME MIGRATION, ON PURPOSE ───────────────────
-- 🔑 A forward primitive with no inverse is the defect this codebase has
-- already paid for once (the auto-block that closed a booked date and had
-- nothing anywhere to remove it, leaving a vendor reading BUSY permanently).
-- Handing shots to a camera is exactly that shape: fill it and you can never
-- empty it, and a couple who put 2,000 on the wrong cousin's QR would have
-- stranded 2,000 shots with no way back. papic_dedicate_shots takes a TARGET
-- rather than a delta precisely so that lowering it IS the inverse — there is
-- no second function that could be forgotten, because giving and taking back
-- are the same call.
--
-- What CANNOT come back is what the camera already SHOT. The floor on any
-- target is that camera's own spend, and the refusal is explicit rather than a
-- silent clamp, because a host who types 50 into a camera that has already
-- taken 300 has misunderstood something and deserves to be told.

-- ── 1 · the ledger ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.papic_seat_allocations (
  seat_id    UUID PRIMARY KEY REFERENCES public.paparazzi_seats(seat_id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  points     INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS papic_seat_allocations_event_idx
  ON public.papic_seat_allocations(event_id);

COMMENT ON TABLE public.papic_seat_allocations IS
  'How many of the event''s shots the host has handed to one camera''s QR, where '
  'nobody else can spend them. ONE row per camera holding the CURRENT amount — '
  'not a log of moves. Composed with papic_event_point_grants by '
  'papic_seat_dedicated_points and papic_event_pool_status; never read directly '
  'by a capture path.';

-- Every table in `public` ships OPEN — the default ACL grants arwdDxtm to anon
-- and authenticated. RLS at CREATE TABLE time AND an explicit REVOKE, both.
-- No policy on purpose: this table is written only by the SECURITY DEFINER
-- function below and read only through the two composing functions. A host
-- editing their own allocation row directly is exactly what the fence exists to
-- stop — the same posture papic_event_point_grants ships with.
ALTER TABLE public.papic_seat_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.papic_seat_allocations FROM PUBLIC, anon, authenticated;

-- ── 2 · a camera's dedicated balance = its grants + its allocation ─────────
--
-- Replaces the definition from 20271019231590 (the LAST migration that defines
-- it — 20271028837115 and 20271031571953 only revoke grants on other functions).
-- The sum-of-grants half is byte-identical; the allocation is added on top.
--
-- Everything downstream composes for free, which is the whole reason the
-- allocation went here rather than into a capture path:
--   • papic_camera_points_remaining subtracts this camera's spend from it
--   • papic_reserve_camera_points spends it before the shared pool
--   • papic_reserve_event_points_for_seat returns -1 while it is > 0, so a
--     dedicated capture never touches the shared pot
CREATE OR REPLACE FUNCTION public.papic_seat_dedicated_points(
  p_seat_id UUID
) RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    COALESCE((SELECT SUM(points) FROM public.papic_event_point_grants
               WHERE seat_id = p_seat_id), 0)
  + COALESCE((SELECT points FROM public.papic_seat_allocations
               WHERE seat_id = p_seat_id), 0)
  )::INTEGER;
$$;

COMMENT ON FUNCTION public.papic_seat_dedicated_points(UUID) IS
  'Total shots DEDICATED to one camera: what was granted straight to it, plus '
  'what the host has handed it out of the shared pot. 0 means "not a dedicated '
  'camera" — the caller then falls through to the shared pool.';

REVOKE ALL ON FUNCTION public.papic_seat_dedicated_points(UUID)
  FROM PUBLIC, anon, authenticated;

-- ── 3 · the shared pot is what is left after the hand-outs ─────────────────
--
-- Replaces 20271019231590 § 3a. ONE arithmetic change: v_alloc is subtracted
-- from the total.
--
-- ⚠ AND IT IS SUBTRACTED FROM total_points, NEVER FROM granted_points, which
-- looks like a detail and is not. `granted_points <= 0` is this function's test
-- for "this event has no Papic pool product at all" and it returns applies =
-- FALSE on that basis. Fold the hand-outs into granted and a host who dedicates
-- their whole balance to cameras would flip their event to applies = FALSE —
-- the pool would report itself as not existing, on an event that had just paid
-- for it. granted_points keeps meaning "what was bought"; total_points means
-- "what is still shared".
CREATE OR REPLACE FUNCTION public.papic_event_pool_status(
  p_event_id UUID
) RETURNS TABLE (
  applies          BOOLEAN,
  guest_count      INTEGER,
  base_points      INTEGER,
  granted_points   INTEGER,
  total_points     INTEGER,
  used_points      INTEGER,
  remaining_points INTEGER,
  soft_stop_at     INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_per_guest INTEGER;
  v_floor     INTEGER;
  v_ceiling   INTEGER;
  v_soft_pct  INTEGER;
  v_guests    INTEGER;
  v_base      INTEGER;
  v_granted   INTEGER;
  v_alloc     INTEGER;
  v_total     INTEGER;
  v_used      INTEGER;
  v_has_flat  BOOLEAN;
BEGIN
  v_has_flat := public.papic_event_has_flat_pass(p_event_id);

  -- SHARED grants only. seat_id NOT NULL is a camera's own balance.
  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_granted
    FROM public.papic_event_point_grants
   WHERE event_id = p_event_id
     AND seat_id IS NULL;

  IF NOT v_has_flat AND COALESCE(v_granted, 0) <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- What the host has handed out to individual cameras. Those shots are still
  -- the event's; they are just no longer shared.
  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_alloc
    FROM public.papic_seat_allocations
   WHERE event_id = p_event_id;

  SELECT points_per_guest, floor_points, ceiling_points, soft_stop_pct
    INTO v_per_guest, v_floor, v_ceiling, v_soft_pct
    FROM public.papic_event_pool_config
   WHERE config_key = 'default';

  IF v_has_flat THEN
    SELECT GREATEST(
             COALESCE(e.final_pax, 0),
             COALESCE(e.estimated_pax, 0),
             COALESCE((
               SELECT COUNT(*) FROM public.guests g
                WHERE g.event_id = p_event_id
                  AND g.deleted_at IS NULL
                  AND g.rsvp_status::text <> 'declined'
             ), 0)
           )::INTEGER
      INTO v_guests
      FROM public.events e
     WHERE e.event_id = p_event_id;
    v_guests := COALESCE(v_guests, 0);
    v_base := LEAST(v_ceiling, GREATEST(v_floor, v_guests * v_per_guest));
  ELSE
    v_guests := 0;
    v_base := 0;
  END IF;

  v_total := v_base + COALESCE(v_granted, 0) - COALESCE(v_alloc, 0);

  SELECT COALESCE(points_used, 0)
    INTO v_used
    FROM public.papic_event_pool_usage
   WHERE event_id = p_event_id;
  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    TRUE,
    v_guests,
    v_base,
    COALESCE(v_granted, 0),
    v_total,
    v_used,
    GREATEST(0, v_total - v_used),
    (v_total * v_soft_pct) / 100;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_event_pool_status(UUID)
  FROM PUBLIC, anon, authenticated;

-- ── 4 · the move ───────────────────────────────────────────────────────────
--
-- Sets a camera's own shots to p_points, taking the difference out of the
-- shared pot or putting it back. Returns the amount the camera now holds.
--
-- TARGET, NOT DELTA — so the same call gives and takes back, a double-submit is
-- harmless, and there is no second function anyone could forget to write.
--
-- It refuses rather than clamps, in both directions. A clamp is a silent
-- decline, and a guard that refuses in silence is indistinguishable from one
-- that passed: the host would tap "give 2,000", see 400, and have no idea which
-- of the two numbers is the truth.
CREATE OR REPLACE FUNCTION public.papic_dedicate_shots(
  p_event_id UUID,
  p_seat_id  UUID,
  p_points   INTEGER,
  p_actor    UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat_event UUID;
  v_current    INTEGER;
  v_spent      INTEGER;
  v_shared     INTEGER;
  v_delta      INTEGER;
BEGIN
  IF p_event_id IS NULL OR p_seat_id IS NULL OR p_points IS NULL OR p_points < 0 THEN
    RAISE EXCEPTION 'papic_dedicate_shots: bad arguments'
      USING ERRCODE = '22023';
  END IF;

  -- CROSS-EVENT GUARD. A seat id is not a capability: without this, one event's
  -- host could name another event's camera and move THAT event's pool. Same
  -- guard the camera-grant path carries (20271114597183), and the same reason.
  SELECT event_id INTO v_seat_event
    FROM public.paparazzi_seats
   WHERE seat_id = p_seat_id;
  IF v_seat_event IS NULL OR v_seat_event <> p_event_id THEN
    RAISE EXCEPTION 'papic_dedicate_shots: camera does not belong to this event'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the row for the duration so two taps cannot both read the old value
  -- and both spend the same shared shots.
  SELECT points INTO v_current
    FROM public.papic_seat_allocations
   WHERE seat_id = p_seat_id
     FOR UPDATE;
  v_current := COALESCE(v_current, 0);

  IF p_points = v_current THEN
    RETURN v_current;  -- nothing to move
  END IF;

  v_delta := p_points - v_current;

  IF v_delta < 0 THEN
    -- TAKING BACK. Only the unspent part can come home. What this camera has
    -- already shot was paid for out of its own balance and is gone.
    --
    -- ⚠ The floor is the spend against the ALLOCATION, but a camera can also
    -- hold granted points (a legacy Papic One purchase). Its total spend is
    -- charged against grants FIRST conceptually, but the ledger does not split
    -- them — so the honest floor is: never let the camera's total dedicated
    -- balance drop below what it has already used.
    SELECT COALESCE(points_used, 0) INTO v_spent
      FROM public.papic_seat_point_usage
     WHERE seat_id = p_seat_id;
    v_spent := COALESCE(v_spent, 0);

    IF (public.papic_seat_dedicated_points(p_seat_id) + v_delta) < v_spent THEN
      RAISE EXCEPTION
        'papic_dedicate_shots: this camera has already taken % shots — you cannot take those back',
        v_spent
        USING ERRCODE = '23514';
    END IF;
  ELSE
    -- GIVING. The increase has to come out of what is genuinely still shared:
    -- not what was bought, but what is left after everyone else's spending and
    -- every other camera's hand-out. papic_event_pool_status already computes
    -- exactly that, and reading it here rather than re-deriving the arithmetic
    -- is what keeps the two from drifting apart.
    SELECT remaining_points INTO v_shared
      FROM public.papic_event_pool_status(p_event_id);
    v_shared := COALESCE(v_shared, 0);

    IF v_delta > v_shared THEN
      RAISE EXCEPTION
        'papic_dedicate_shots: only % shots are still shared — cannot hand out %',
        v_shared, v_delta
        USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO public.papic_seat_allocations (seat_id, event_id, points, updated_by)
  VALUES (p_seat_id, p_event_id, p_points, p_actor)
  ON CONFLICT (seat_id) DO UPDATE
    SET points     = EXCLUDED.points,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by;

  RETURN p_points;
END;
$$;

COMMENT ON FUNCTION public.papic_dedicate_shots(UUID, UUID, INTEGER, UUID) IS
  'Set how many of the event''s shots belong to ONE camera''s QR alone. TARGET, '
  'not delta — lowering it is how the host takes unspent shots back, so giving '
  'and taking back are the same call and neither can be missing. Zero-sum: what '
  'a camera gains, the shared pot loses. Refuses (never clamps) when the pot is '
  'short or when the camera has already spent more than the new figure.';

REVOKE ALL ON FUNCTION public.papic_dedicate_shots(UUID, UUID, INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_dedicate_shots(UUID, UUID, INTEGER, UUID)
  TO service_role;

-- ── 5 · assertions ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_relrowsecurity BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO v_relrowsecurity
    FROM pg_class WHERE oid = 'public.papic_seat_allocations'::regclass;
  IF NOT COALESCE(v_relrowsecurity, FALSE) THEN
    RAISE EXCEPTION 'papic_seat_allocations shipped without RLS';
  END IF;

  IF has_table_privilege('anon', 'public.papic_seat_allocations', 'SELECT')
     OR has_table_privilege('authenticated', 'public.papic_seat_allocations', 'SELECT') THEN
    RAISE EXCEPTION
      'papic_seat_allocations is readable by a session role — new public tables ship OPEN, REVOKE was missed';
  END IF;

  -- The composing read must actually compose. A function that ignored the new
  -- table would leave every hand-out invisible to the capture gate, which is
  -- the one failure that would let a camera and the pool spend the same shot.
  IF (SELECT pg_get_functiondef('public.papic_seat_dedicated_points(uuid)'::regprocedure))
     NOT LIKE '%papic_seat_allocations%' THEN
    RAISE EXCEPTION 'papic_seat_dedicated_points does not read papic_seat_allocations';
  END IF;
  IF (SELECT pg_get_functiondef('public.papic_event_pool_status(uuid)'::regprocedure))
     NOT LIKE '%papic_seat_allocations%' THEN
    RAISE EXCEPTION 'papic_event_pool_status does not subtract papic_seat_allocations';
  END IF;
END $$;
