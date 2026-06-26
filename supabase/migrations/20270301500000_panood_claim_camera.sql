-- ============================================================================
-- 20270301500000_panood_claim_camera.sql
--
-- PR5 of the upgraded Panood multicam controller (iteration 0011): the
-- CAMERA-OPERATOR JOIN flow. A DIRECT clone of the PROVEN Papic seat-claim RPC
-- (public.papic_claim_seat, migration 20260718000000) — the same security model,
-- the same JSON verdict shape, the same race-safe conditional UPDATE.
--
-- The couple provisions N camera "seats" (public.panood_camera_operators,
-- migration 20270227010000) and shares one per-camera link (/panood/cam/[token]).
-- A designated operator opens it on their phone and claims the camera — binding
-- it to their auth.uid() so the (later) WebRTC publish can authenticate as that
-- operator and so the controller can see which feed is which.
--
-- WHY a SECURITY DEFINER fn (not an RLS write) — panood_camera_operators RLS is
-- strict control-room-only (couple + coordinator); the operator is NEITHER, so a
-- direct UPDATE under their session is RLS-blocked. The token is the capability,
-- auth.uid() is the claimer identity, and the fn binds the two under the owner's
-- rights. This is byte-for-byte the papic_claim_seat posture.
--
-- IDEMPOTENT / SAFE on a live DB — one new function, CREATE OR REPLACE, no table
-- or column changes, no drops, no backfill. The fn itself is idempotent on a
-- re-open (same operator re-scanning their own link → 'claimed', never an error)
-- and race-safe (the bind is a conditional UPDATE … WHERE claimer_user_id IS NULL
-- so two simultaneous claimers can't both win — the loser gets 'taken').
--
-- Rules (mirror papic_claim_seat exactly):
--   • unauthenticated (no auth.uid())                       → 'unauthenticated'
--   • token matches no LIVE (revoked_at IS NULL) camera      → 'invalid'
--     (a revoked/reissued token reads as invalid — no cross-event reuse, a stale
--      QR can never re-bind)
--   • camera already claimed by THIS same user               → idempotent 'claimed'
--   • camera already claimed by someone else                 → 'taken'
--   • otherwise bind claimer_user_id + claimed_at + status='live' → 'claimed'
--
-- One token → one camera → one event: claim_qr_token is UNIQUE
-- (panood_camera_operators_claim_qr_token_key) and a camera row is bound to a
-- single event_id, so a token can only ever claim its own camera on its own
-- event. There is no path here to bind a token to a different event's camera.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.panood_claim_camera(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_cam        public.panood_camera_operators%ROWTYPE;
  v_event_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  -- A blank/absent token can never match the UNIQUE NOT NULL claim_qr_token.
  IF p_token IS NULL OR length(btrim(p_token)) = 0 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT * INTO v_cam
  FROM public.panood_camera_operators
  WHERE claim_qr_token = p_token
    AND revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    -- No live camera for this token: unknown / revoked / reissued. Reject — a
    -- stale or revoked QR can never re-bind, and there is no cross-event reuse.
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- Already claimed?
  IF v_cam.claimer_user_id IS NOT NULL THEN
    IF v_cam.claimer_user_id = v_uid THEN
      -- Same operator re-opening their own link — idempotent success.
      SELECT display_name INTO v_event_name
      FROM public.events WHERE event_id = v_cam.event_id;
      RETURN jsonb_build_object(
        'status', 'claimed',
        'camera_index', v_cam.camera_index,
        'label', v_cam.label,
        'event_id', v_cam.event_id,
        'event_name', v_event_name
      );
    END IF;
    -- Bound to a different operator.
    RETURN jsonb_build_object('status', 'taken', 'camera_index', v_cam.camera_index);
  END IF;

  -- Bind. The WHERE re-asserts the open + live invariants so a claimer who lost a
  -- race (someone bound it between our SELECT and this UPDATE) gets 'taken', not a
  -- silent overwrite. status flips to 'live' so the controller lights the feed.
  UPDATE public.panood_camera_operators
  SET claimer_user_id = v_uid,
      claimed_at = NOW(),
      status = 'live',
      last_seen_at = NOW(),
      updated_at = NOW()
  WHERE id = v_cam.id
    AND claimer_user_id IS NULL
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    -- Lost the race — someone claimed it between our SELECT and UPDATE.
    RETURN jsonb_build_object('status', 'taken', 'camera_index', v_cam.camera_index);
  END IF;

  SELECT display_name INTO v_event_name
  FROM public.events WHERE event_id = v_cam.event_id;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'camera_index', v_cam.camera_index,
    'label', v_cam.label,
    'event_id', v_cam.event_id,
    'event_name', v_event_name
  );
END;
$$;

-- SECURITY DEFINER means the body runs as the owner; EXECUTE just lets the
-- authenticated role invoke it. Mirrors papic_claim_seat's grant (authenticated
-- only — the operator always has a real auth.uid() by the time they call, either
-- their own account or a native-anon session minted on the claim POST).
GRANT EXECUTE ON FUNCTION public.panood_claim_camera(TEXT) TO authenticated;

COMMIT;
