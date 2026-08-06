-- close_anon_camera_points_grant
-- ============================================================================
-- 🔴 ANYONE WHO KNOWS AN ORDER ID COULD MINT PAID CAMERA CREDITS.
-- ============================================================================
-- `papic_grant_camera_points(p_event_id, p_order_id)` is SECURITY DEFINER and
-- was EXECUTE-able by `anon`. Verified in live prod 2026-08-06:
--     has_function_privilege('anon', oid, 'EXECUTE') = true
--
-- It checked NOTHING about the caller or the purchase:
--   · never read the order's payment status — an unpaid/pending order granted;
--   · never checked who was calling — no auth.uid(), no membership;
--   · never checked the order BELONGS to the event. `p_event_id` is supplied by
--     the CALLER and written straight into the grant row, so order X's points
--     could be minted onto event Y.
-- Its only real guard was idempotency (one grant per order_id), which stops a
-- double-spend of the same order — not a first, unauthorised one.
--
-- THE ONLY LEGITIMATE CALLER is the admin SKU-activation hook
-- (lib/sku-activation.ts -> `ctx.admin.rpc(...)`), which runs as service_role
-- and therefore does not need — and never used — the anon grant.
-- service_role BYPASSES grants entirely, so revoking costs that path nothing.
--
-- TWO FIXES, because either alone is thin:
--   1. REVOKE the grant. The real fix: no anonymous caller reaches it at all.
--   2. Check the order belongs to the event anyway, inside the function.
--      Defence in depth — a future migration that re-grants EXECUTE (this repo's
--      documented default-ACL problem: new objects ship OPEN) would otherwise
--      silently reopen the whole hole.
--
-- ALSO CLOSED: `papic_reserve_camera_capture`, flagged the same day for taking
-- its quota ceiling FROM THE CALLER (`p_limit IS NULL` ⇒ unconditional TRUE).
-- It has ZERO live callers — `lib/papic-cameras.ts:731` records it as "then
-- dropped" — so revoking anon/authenticated on it cannot break anything.
--
-- ⚠ NOT TOUCHED, deliberately: `papic_record_guest_capture` (BOTH overloads).
-- That is the anonymous guest-capture path and must keep working.
-- ⚠ Checked rather than assumed: `papic_release_camera_points` and
-- `papic_release_event_points` are called on the same route but are already
-- anon=FALSE / authenticated=FALSE — that route reaches them as service_role.
-- A first draft of this migration's test asserted they were anon-callable and
-- would have shipped a false claim about our own surface.
--
-- Live blast radius today: zero. Prod is pre-launch — no paid camera orders
-- exist. This closes it before that stops being true.
--
-- Idempotent: REVOKE/GRANT and CREATE OR REPLACE.

BEGIN;

-- 1 · No anonymous or ordinary signed-in caller. service_role bypasses grants.
REVOKE EXECUTE ON FUNCTION public.papic_grant_camera_points(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.papic_reserve_camera_capture(uuid, uuid, text, integer)
  FROM PUBLIC, anon, authenticated;

-- 2 · Defence in depth: the order must belong to the event it is granting onto.
CREATE OR REPLACE FUNCTION public.papic_grant_camera_points(p_event_id uuid, p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seat  UUID;
  v_pts   INTEGER;
  v_per   INTEGER;
  v_n     INTEGER;
BEGIN
  IF p_event_id IS NULL OR p_order_id IS NULL THEN
    RETURN 0;
  END IF;

  -- ⚠ ADDED 2026-08-06. p_event_id arrives from the CALLER; without this the
  -- points from one wedding's order could be minted onto another wedding.
  -- Fails CLOSED: an order we cannot tie to this event grants nothing.
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.order_id = p_order_id
       AND o.event_id = p_event_id
  ) THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.papic_event_point_grants
     WHERE order_id = p_order_id AND source = 'camera_grant'
  ) THEN
    RETURN 0;  -- a re-approved order must never double-grant
  END IF;

  -- (A) a Papic One rung aimed at one camera (new OR reload)
  SELECT o.seat_id, o.points INTO v_seat, v_pts
    FROM public.papic_one_orders o
   WHERE o.order_id = p_order_id;

  IF v_seat IS NOT NULL AND COALESCE(v_pts, 0) > 0 THEN
    INSERT INTO public.papic_event_point_grants
      (event_id, seat_id, points, source, order_id, note)
    VALUES (p_event_id, v_seat, v_pts, 'camera_grant', p_order_id,
            format('Papic One · %s pts dedicated to one camera', v_pts));
    RETURN v_pts;
  END IF;

  -- (B) legacy multi-camera PAPIC_CAMERAS order
  SELECT t.points INTO v_per
    FROM public.papic_one_tiers t
   WHERE t.service_code = 'PAPIC_CAMERA_MINI_DAY' AND t.is_active;
  v_per := COALESCE(v_per, 50);
  IF v_per <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.papic_event_point_grants
    (event_id, seat_id, points, source, order_id, note)
  SELECT p_event_id, ps.seat_id, v_per, 'camera_grant', p_order_id,
         format('Papic One · %s pts dedicated to camera #%s', v_per, ps.seat_index)
    FROM public.paparazzi_seats ps
   WHERE ps.paid_order_id = p_order_id
     AND ps.tier = 'mini';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN COALESCE(v_n, 0) * v_per;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.papic_grant_camera_points(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

COMMIT;
