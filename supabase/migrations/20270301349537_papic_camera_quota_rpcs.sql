-- ============================================================================
-- 20270301010000_papic_camera_quota_rpcs.sql
--
-- Per-CAMERA quota enforcement (per-camera model · PR3). Two SECURITY DEFINER
-- functions over the papic_seat_day_usage ledger (added in 20270301000000):
--
--   • papic_reserve_camera_capture(seat, event, kind, limit) → boolean
--     The AUTHORITATIVE, race-safe record-layer gate. Atomically upserts the
--     (seat, today) usage row and CONDITIONALLY increments the per-kind counter
--     only when it is below the tier's daily limit. Returns TRUE if it reserved
--     a slot (capture allowed), FALSE if the seat is at cap. Unlimited tier
--     (p_limit IS NULL) always returns TRUE without touching the ledger. The
--     conditional UPDATE ... WHERE counter < limit RETURNING is atomic under
--     row lock, so the (limit+1)th capture can never persist even under
--     concurrent requests (mirrors the sampler's papic_sampler_insert_capture).
--
--   • papic_camera_remaining(seat, kind, limit) → int
--     A read-only probe for the PRESIGN layer (api/upload): how many captures
--     of this kind remain today. Lets the presign route refuse an upload URL at
--     cap so no orphan R2 bytes accrue (R2 is Setnayan's only marginal cost).
--     Fail-open by design — the reserve fn above is the backstop.
--
-- These apply ONLY to per-camera seats (sku_code PAPIC_CAMERA_*); the caller
-- (lib/papic-cameras papicPerCameraTier) decides. The legacy PAPIC_SEATS pack
-- and the free sampler are untouched. Idempotent (CREATE OR REPLACE).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.papic_camera_remaining(
  p_seat_id UUID,
  p_kind    TEXT,
  p_limit   INTEGER
) RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_limit IS NULL THEN 2147483647
    ELSE GREATEST(
      0,
      p_limit - COALESCE((
        SELECT CASE WHEN p_kind = 'clip' THEN videos_used ELSE photos_used END
        FROM public.papic_seat_day_usage
        WHERE seat_id = p_seat_id AND usage_date = CURRENT_DATE
      ), 0)
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.papic_reserve_camera_capture(
  p_seat_id  UUID,
  p_event_id UUID,
  p_kind     TEXT,
  p_limit    INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  -- Unlimited tier: no ledger, always allowed.
  IF p_limit IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Ensure today's row exists (race-safe via the UNIQUE(seat_id, usage_date)).
  INSERT INTO public.papic_seat_day_usage (event_id, seat_id, usage_date)
  VALUES (p_event_id, p_seat_id, CURRENT_DATE)
  ON CONFLICT (seat_id, usage_date) DO NOTHING;

  -- Atomic conditional increment: only when under the limit. The RETURNING is
  -- non-null exactly when a slot was reserved.
  IF p_kind = 'clip' THEN
    UPDATE public.papic_seat_day_usage
       SET videos_used = videos_used + 1, updated_at = NOW()
     WHERE seat_id = p_seat_id
       AND usage_date = CURRENT_DATE
       AND videos_used < p_limit
    RETURNING videos_used INTO v_used;
  ELSE
    UPDATE public.papic_seat_day_usage
       SET photos_used = photos_used + 1, updated_at = NOW()
     WHERE seat_id = p_seat_id
       AND usage_date = CURRENT_DATE
       AND photos_used < p_limit
    RETURNING photos_used INTO v_used;
  END IF;

  RETURN v_used IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_camera_remaining(UUID, TEXT, INTEGER)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.papic_reserve_camera_capture(UUID, UUID, TEXT, INTEGER)
  TO authenticated, anon, service_role;

COMMIT;
