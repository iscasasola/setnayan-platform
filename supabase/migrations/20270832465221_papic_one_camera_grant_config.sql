-- papic one camera grant config
--
-- Papic One = the per-camera add-on (owner 2026-07-22 · Papic_One_Pool_Model_Spec
-- §0). Each ₱100 camera grants 250 points into the ONE shared event pool + one
-- paparazzi_seats row. This migration lays the grant-config + vocabulary
-- foundation so the app-side approval hook (lib/sku-activation.ts) and the pool
-- binding (later migration) can route Papic One / Papic Pool / Free through the
-- SAME papic_event_point_grants ledger and the SAME reserve RPC.
--
-- NEVER-RENAME LOCK honored: no service_code / tier_code is renamed or dropped.
-- The ONLY tier write here is a metering number (mini.points_per_day → NULL),
-- not an identity or price. Nothing is flipped is_active. Additive + idempotent
-- + inert on apply (nothing runs until app code calls the new function).
--
-- Prefix auto-allocated via `pnpm migration:new` to sort AFTER every existing
-- migration, so the applied-migration guards it supersedes
-- (20270828150000's mini.points_per_day=200 assertion) already ran at their
-- historical position on a fresh replay/db-reset before this flips the value.

BEGIN;

-- ---- 1a. Extend the grant `source` vocabulary ----------------------------
-- Add BOTH new values now (a CHECK edit is atomic, and the free/pool binding
-- migrations depend on 'free_grant' + 'camera_grant' already being legal). The
-- live CHECK today rejects both (grep-confirmed zero occurrences), so
-- §4-PR5's free_grant seed would abort without this.
ALTER TABLE public.papic_event_point_grants
  DROP CONSTRAINT IF EXISTS papic_event_point_grants_source_check;
ALTER TABLE public.papic_event_point_grants
  ADD CONSTRAINT papic_event_point_grants_source_check
  CHECK (source IN ('admin','topup_order','comp','migration','free_grant','camera_grant'));

-- ---- 1b. Admin-tunable per-camera grant amount ---------------------------
-- Mirrors the papic_event_pool_config "PRICING-RELEVANT, admin-editable" posture
-- (never hardcode the 250 in app code).
ALTER TABLE public.papic_event_pool_config
  ADD COLUMN IF NOT EXISTS camera_grant_points INTEGER NOT NULL DEFAULT 250
    CHECK (camera_grant_points >= 0);

-- ---- 1c. Window-total metering for Papic One -----------------------------
-- Drop the per-camera-per-day throttle on the 'mini' tier so a Papic One seat
-- meters ONLY against the event pool ("one gate, no per-seat reserve").
-- papic_reserve_camera_points returns TRUE without touching the ledger when
-- points_per_day IS NULL (20270821110100), exactly like the 'unlimited' tier —
-- so the seat path's existing papic_reserve_event_points call becomes the sole
-- gate for Papic One. Supersedes the applied guard at 20270828150000 (which
-- asserted mini.points_per_day=200 at ITS historical position); a forward UPDATE
-- does not re-run that DO block.
UPDATE public.papic_tier_config
   SET points_per_day = NULL, updated_at = NOW()
 WHERE tier_code = 'mini' AND points_per_day IS DISTINCT FROM NULL;

-- ---- 1d. The Papic One grant engine --------------------------------------
-- SECURITY DEFINER so it can write the service-role-only grants ledger.
-- Idempotent BY order_id (a re-approved order never double-grants). Repeatable
-- across DISTINCT orders (each ₱100 camera buy is its own order_id → grants
-- again). N = the mini seats actually provisioned for THIS order, so an order
-- of 3 cameras grants 3 × 250 in ONE row, not 250.
CREATE OR REPLACE FUNCTION public.papic_grant_camera_points(
  p_event_id UUID,
  p_order_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n     INTEGER;
  v_per   INTEGER;
  v_total INTEGER;
BEGIN
  IF p_event_id IS NULL OR p_order_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Idempotent by order_id: a re-approved order must never double-grant.
  IF EXISTS (
    SELECT 1 FROM public.papic_event_point_grants
     WHERE order_id = p_order_id AND source = 'camera_grant'
  ) THEN
    RETURN 0;
  END IF;

  -- N = the mini cameras actually provisioned for THIS order (repeatable-safe:
  -- each purchase is a distinct order_id, so a later buy grants again). Seats
  -- are provisioned at order-creation, so they exist before the approval hook.
  SELECT COUNT(*) INTO v_n
    FROM public.paparazzi_seats
   WHERE paid_order_id = p_order_id AND tier = 'mini';
  IF v_n = 0 THEN
    RETURN 0;
  END IF;

  SELECT camera_grant_points INTO v_per
    FROM public.papic_event_pool_config WHERE config_key = 'default';
  v_per := COALESCE(v_per, 250);
  v_total := v_n * v_per;
  IF v_total <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.papic_event_point_grants (event_id, points, source, order_id, note)
  VALUES (p_event_id, v_total, 'camera_grant', p_order_id,
          format('Papic One · %s camera(s) × %s pts', v_n, v_per));
  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_grant_camera_points(UUID, UUID)
  TO authenticated, service_role;

COMMIT;
