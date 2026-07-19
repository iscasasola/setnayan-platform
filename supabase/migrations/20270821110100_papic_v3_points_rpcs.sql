-- ============================================================================
-- 20270821110100_papic_v3_points_rpcs.sql
--
-- Papic v3 — capture-POINTS enforcement RPCs (owner 2026-07-17 · PR-1 of 12).
-- Forks the proven per-kind atomic pattern from 20270301349537
-- (papic_reserve_camera_capture / papic_camera_remaining) to a SINGLE points
-- budget resolved from papic_tier_config (20270821110000).
--
--   • papic_reserve_camera_points(seat, event, cost) -> boolean
--     AUTHORITATIVE, race-safe record-layer gate. Resolves the seat's tier ->
--     papic_tier_config.points_per_day budget INSIDE the function. Unlimited
--     (points_per_day IS NULL) always returns TRUE without touching the ledger.
--     Otherwise atomically upserts today's usage row and CONDITIONALLY adds
--     `cost` points only when (points_used + cost <= budget). The
--     UPDATE ... WHERE points_used + cost <= budget RETURNING is atomic under
--     row lock, so the point that would exceed the budget can never persist
--     even under concurrent captures. cost = 1 (photo) | 3 (5s clip).
--
--   • papic_camera_points_remaining(seat) -> int
--     Read-only probe for the PRESIGN layer (api/upload): points left today.
--     Lets presign refuse an upload URL at 0 so no orphan R2 bytes accrue.
--     The reserve fn above is the backstop.
--
-- Idempotent (CREATE OR REPLACE). Old papic_reserve_camera_capture /
-- papic_camera_remaining stay in place for one release (PR-3 cuts the call
-- sites, then a later PR drops the deprecated fns).
-- ============================================================================

BEGIN;

-- Points remaining today for a seat (budget from tier config). MAXINT = unlimited.
CREATE OR REPLACE FUNCTION public.papic_camera_points_remaining(
  p_seat_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget INTEGER;
  v_used   INTEGER;
BEGIN
  SELECT tc.points_per_day
    INTO v_budget
    FROM public.paparazzi_seats ps
    JOIN public.papic_tier_config tc ON tc.tier_code = ps.tier
   WHERE ps.seat_id = p_seat_id;

  -- Unknown seat or unlimited tier -> effectively no cap.
  IF NOT FOUND OR v_budget IS NULL THEN
    RETURN 2147483647;
  END IF;

  SELECT COALESCE(points_used, 0)
    INTO v_used
    FROM public.papic_seat_day_usage
   WHERE seat_id = p_seat_id AND usage_date = CURRENT_DATE;

  RETURN GREATEST(0, v_budget - COALESCE(v_used, 0));
END;
$$;

-- Atomic conditional points reserve. Returns TRUE iff `cost` points were booked.
CREATE OR REPLACE FUNCTION public.papic_reserve_camera_points(
  p_seat_id  UUID,
  p_event_id UUID,
  p_cost     INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget INTEGER;
  v_used   INTEGER;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RETURN FALSE;  -- defensive: a capture always costs >= 1 point
  END IF;

  -- Resolve the tier's daily point budget.
  SELECT tc.points_per_day
    INTO v_budget
    FROM public.paparazzi_seats ps
    JOIN public.papic_tier_config tc ON tc.tier_code = ps.tier
   WHERE ps.seat_id = p_seat_id;

  -- Unknown seat: refuse (fail-closed). Unlimited tier: allow, no ledger.
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  IF v_budget IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Ensure today's row exists (race-safe via UNIQUE(seat_id, usage_date)).
  INSERT INTO public.papic_seat_day_usage (event_id, seat_id, usage_date)
  VALUES (p_event_id, p_seat_id, CURRENT_DATE)
  ON CONFLICT (seat_id, usage_date) DO NOTHING;

  -- Atomic conditional add: only when the full cost still fits under budget.
  UPDATE public.papic_seat_day_usage
     SET points_used = points_used + p_cost, updated_at = NOW()
   WHERE seat_id = p_seat_id
     AND usage_date = CURRENT_DATE
     AND points_used + p_cost <= v_budget
  RETURNING points_used INTO v_used;

  RETURN v_used IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_camera_points_remaining(UUID)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.papic_reserve_camera_points(UUID, UUID, INTEGER)
  TO authenticated, anon, service_role;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION:
--   -- Free seat (20-pt budget): 20 photos succeed, the 21st fails.
--   SELECT public.papic_reserve_camera_points('<free_seat>','<event>',1);  -- t x20, then f
--   -- A 5s clip costs 3: at 18 used, a clip (3) succeeds -> 21? No: 18+3=21 > 20 -> f
--   SELECT public.papic_camera_points_remaining('<free_seat>');            -- 0 at budget
--   -- Unlimited seat: always true, ledger untouched.
--   SELECT public.papic_reserve_camera_points('<unli_seat>','<event>',3);  -- t (no row)
-- ============================================================================
