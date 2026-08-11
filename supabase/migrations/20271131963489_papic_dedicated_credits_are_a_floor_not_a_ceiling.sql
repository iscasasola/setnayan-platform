-- ═══════════════════════════════════════════════════════════════════════════
-- DEDICATED CREDITS ARE A FLOOR, NOT A CEILING
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner, 2026-08-11: *"that account with dedicated can still have more if they
-- have used all their dedicated shots"* — and, on how a capture that straddles
-- the two balances should be paid: *"spend 2 and take 6."*
--
-- ── THE DEFECT THIS FIXES, MEASURED ───────────────────────────────────────
-- Handing a camera its own credits SILENTLY CAPPED IT. Measured on a replayed
-- database before writing a line of this file: an event holding 1,047 shared
-- credits, one camera given 3 dedicated. It took its 3, and the 4th capture was
-- REFUSED while the shared pot sat untouched at 1,047.
--
--   papic_reserve_camera_points      → FALSE  (its own bucket is empty)
--   papic_reserve_event_points_..    → -1     (pool stands down: "it's dedicated")
--
-- Both gates were individually behaving as designed and the pair was wrong: the
-- pool stood down on the strength of the camera having EVER held dedicated
-- credits, not on it having any LEFT. So "give this camera 200 shots of its own"
-- meant "limit this camera to 200", which is the exact opposite of the promise.
-- The whole point of dedicating is to GUARANTEE a floor nobody else can spend.
--
-- ── THE RULE (owner-decided) ──────────────────────────────────────────────
-- A capture spends the camera's OWN credits first, as many as it has, and the
-- shared pot pays whatever is left over. A camera never stops while the event
-- still has credits anywhere.
--
--   camera holds 2 · a 10-second video costs 8  →  2 from the camera, 6 from the pot
--
-- The owner chose the splitting rule explicitly over the simpler "if it doesn't
-- fit, the pot pays it all", which would have stranded small remainders on a
-- camera forever. Nothing is stranded now.
--
-- ── WHY A NEW FUNCTION AND NOT AN EDIT TO THE TWO GATES ───────────────────
-- 🔑 THE SPLIT CANNOT BE DECIDED BY TWO GATES IN SEQUENCE, and that is the whole
-- reason this file adds a name instead of changing two.
--
-- Today the seams call the seat gate and then the pool gate. The seat gate
-- MUTATES: by the time the pool gate runs, the camera's usage counter has
-- already moved. Asking the pool gate "did the camera pay for this, or should
-- you?" is then unanswerable — a camera that spent its last credit and one that
-- had none to spend are, after the fact, the same row. Any answer it invented
-- would double-charge some captures and let others through free, and neither
-- would leave a trace.
--
-- So the decision moves into ONE function, under ONE row lock, in ONE
-- transaction. It reads the camera's remaining credits, takes what it can, asks
-- the pool for the rest, and either both halves commit or neither does.
--
-- A NEW NAME, not an extra parameter: an overload makes the PostgREST call
-- ambiguous, which this schema has been bitten by before (see the *_for_seat
-- naming note in 20271019231590).
--
-- ⚠ THE OLD FUNCTIONS ARE LEFT EXACTLY AS THEY ARE. They still have callers
-- (the presign probe, the vendor path, legacy seats) and changing them under
-- those callers is a separate blast radius. This file adds the correct primitive
-- and its inverse; the enforcement seams move onto it in the same PR.

-- ── 1 · the split reserve ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.papic_reserve_capture_split(
  p_seat_id  UUID,
  p_event_id UUID,
  p_cost     INTEGER
) RETURNS TABLE (
  ok              BOOLEAN,
  dedicated_spent INTEGER,
  pool_spent      INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat_event UUID;
  v_ded_total  INTEGER;
  v_used       INTEGER;
  v_ded_left   INTEGER;
  v_take_ded   INTEGER;
  v_need_pool  INTEGER;
  v_pool_ok    BOOLEAN;
BEGIN
  IF p_seat_id IS NULL OR p_event_id IS NULL OR p_cost IS NULL OR p_cost <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0;  -- a capture always costs >= 1
    RETURN;
  END IF;

  -- CROSS-EVENT GUARD. A seat id is not a capability: without this, a caller
  -- could name one event's camera while charging another event's pot.
  SELECT event_id INTO v_seat_event
    FROM public.paparazzi_seats
   WHERE seat_id = p_seat_id;
  IF v_seat_event IS NULL OR v_seat_event <> p_event_id THEN
    RETURN QUERY SELECT FALSE, 0, 0;  -- fail-CLOSED on an unknown/foreign seat
    RETURN;
  END IF;

  -- Materialise the usage row and LOCK it for the rest of the transaction, so
  -- two phones firing at once cannot both read the same "credits left" and both
  -- spend it. Every read below is under this lock.
  INSERT INTO public.papic_seat_point_usage (seat_id)
  VALUES (p_seat_id)
  ON CONFLICT (seat_id) DO NOTHING;

  SELECT points_used INTO v_used
    FROM public.papic_seat_point_usage
   WHERE seat_id = p_seat_id
     FOR UPDATE;
  v_used := COALESCE(v_used, 0);

  v_ded_total := public.papic_seat_dedicated_points(p_seat_id);
  v_ded_left  := GREATEST(0, COALESCE(v_ded_total, 0) - v_used);

  v_take_ded  := LEAST(p_cost, v_ded_left);
  v_need_pool := p_cost - v_take_ded;

  -- THE POOL LEG FIRST, and deliberately so. If the pot cannot cover the
  -- remainder the whole capture is refused having spent NOTHING — the camera's
  -- own credits must not be consumed by a capture that never happened. (Both
  -- legs are in one transaction, so an exception would roll back either way;
  -- doing the refusable leg first means the ordinary refusal needs no rollback
  -- at all.)
  IF v_need_pool > 0 THEN
    v_pool_ok := public.papic_reserve_event_points(p_event_id, v_need_pool);
    IF NOT COALESCE(v_pool_ok, FALSE) THEN
      RETURN QUERY SELECT FALSE, 0, 0;
      RETURN;
    END IF;
  END IF;

  IF v_take_ded > 0 THEN
    UPDATE public.papic_seat_point_usage
       SET points_used = points_used + v_take_ded, updated_at = NOW()
     WHERE seat_id = p_seat_id;
  END IF;

  RETURN QUERY SELECT TRUE, v_take_ded, v_need_pool;
END;
$$;

COMMENT ON FUNCTION public.papic_reserve_capture_split(UUID, UUID, INTEGER) IS
  'Reserve one capture across BOTH balances: the camera''s own dedicated credits '
  'first, the shared pot for the remainder (owner 2026-08-11 — "spend 2 and take '
  '6"). All-or-nothing: a refusal spends neither side. Returns how much came from '
  'each so the caller can unwind exactly what it booked. Dedicated credits are a '
  'FLOOR nobody else may spend, never a ceiling on the camera.';

REVOKE ALL ON FUNCTION public.papic_reserve_capture_split(UUID, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_reserve_capture_split(UUID, UUID, INTEGER)
  TO service_role;

-- ── 2 · its inverse, which ships in the same migration ─────────────────────
--
-- 🔑 A FORWARD PRIMITIVE WITH NO INVERSE is a defect this codebase has already
-- paid for (the auto-block that closed a booked date and had nothing to remove
-- it). A split reserve needs a split release or an aborted upload refunds the
-- wrong ledger — release the whole cost to the pot and the couple is handed
-- credits the camera actually spent; release it all to the camera and its
-- guaranteed floor quietly grows.
--
-- The caller passes back exactly the two figures the reserve returned, which is
-- why the reserve returns them at all.
CREATE OR REPLACE FUNCTION public.papic_release_capture_split(
  p_seat_id         UUID,
  p_event_id        UUID,
  p_dedicated_spent INTEGER,
  p_pool_spent      INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_seat_id IS NOT NULL AND COALESCE(p_dedicated_spent, 0) > 0 THEN
    UPDATE public.papic_seat_point_usage
       SET points_used = GREATEST(0, points_used - p_dedicated_spent),
           updated_at = NOW()
     WHERE seat_id = p_seat_id;
  END IF;

  IF p_event_id IS NOT NULL AND COALESCE(p_pool_spent, 0) > 0 THEN
    PERFORM public.papic_release_event_points(p_event_id, p_pool_spent);
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.papic_release_capture_split(UUID, UUID, INTEGER, INTEGER) IS
  'Unwind a papic_reserve_capture_split, putting each half back where it came '
  'from. Pass the two figures the reserve returned — releasing the whole cost to '
  'either side alone silently moves credits between the camera and the pot.';

REVOKE ALL ON FUNCTION public.papic_release_capture_split(UUID, UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_release_capture_split(UUID, UUID, INTEGER, INTEGER)
  TO service_role;

-- ── 3 · what a camera can still shoot, counting BOTH balances ──────────────
--
-- The presign probe asks "is there room for this?" before handing out an upload
-- URL. It used to ask the camera's own bucket alone, which is how a camera with
-- an empty bucket and a full pot behind it got refused a URL.
CREATE OR REPLACE FUNCTION public.papic_capture_points_available(
  p_seat_id  UUID,
  p_event_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ded_total INTEGER;
  v_used      INTEGER;
  v_ded_left  INTEGER;
  v_pool      INTEGER;
BEGIN
  IF p_seat_id IS NULL OR p_event_id IS NULL THEN RETURN 0; END IF;

  v_ded_total := COALESCE(public.papic_seat_dedicated_points(p_seat_id), 0);
  SELECT COALESCE(points_used, 0) INTO v_used
    FROM public.papic_seat_point_usage WHERE seat_id = p_seat_id;
  v_ded_left := GREATEST(0, v_ded_total - COALESCE(v_used, 0));

  SELECT remaining_points INTO v_pool
    FROM public.papic_event_pool_status(p_event_id);

  RETURN v_ded_left + GREATEST(0, COALESCE(v_pool, 0));
END;
$$;

COMMENT ON FUNCTION public.papic_capture_points_available(UUID, UUID) IS
  'Everything this camera can still spend: its own dedicated credits PLUS the '
  'shared pot. Read-only probe for the presign seam. Asking the camera''s bucket '
  'alone is what refused an upload URL to a camera with a full pot behind it.';

REVOKE ALL ON FUNCTION public.papic_capture_points_available(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_capture_points_available(UUID, UUID)
  TO service_role;

-- ── 4 · assertions — the floor is checked, not described ───────────────────
DO $$
DECLARE
  v_event UUID;
  v_seat  UUID;
  r       RECORD;
BEGIN
  INSERT INTO public.events (display_name, event_type)
  VALUES ('migration self-check', 'birthday') RETURNING event_id INTO v_event;

  INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
  VALUES (v_event, 100, 'admin', 'migration self-check');

  INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, tier)
  VALUES (v_event, 987, 'PAPIC_CAMERA_FREE',
          translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'), 'free')
  RETURNING seat_id INTO v_seat;

  -- Give the camera 2 of its own.
  PERFORM public.papic_dedicate_shots(v_event, v_seat, 2);

  -- A capture costing 8 must take 2 from the camera and 6 from the pot.
  SELECT * INTO r FROM public.papic_reserve_capture_split(v_seat, v_event, 8);
  IF NOT r.ok OR r.dedicated_spent <> 2 OR r.pool_spent <> 6 THEN
    RAISE EXCEPTION
      'split reserve wrong: ok=% dedicated=% pool=% (owner rule: spend 2 and take 6)',
      r.ok, r.dedicated_spent, r.pool_spent;
  END IF;

  -- And the camera keeps shooting on the pot alone once its own are gone.
  SELECT * INTO r FROM public.papic_reserve_capture_split(v_seat, v_event, 1);
  IF NOT r.ok OR r.dedicated_spent <> 0 OR r.pool_spent <> 1 THEN
    RAISE EXCEPTION
      'an emptied camera must carry on from the pot: ok=% dedicated=% pool=%',
      r.ok, r.dedicated_spent, r.pool_spent;
  END IF;

  -- Clean up the self-check; it must leave no data behind.
  DELETE FROM public.events WHERE event_id = v_event;
END $$;
