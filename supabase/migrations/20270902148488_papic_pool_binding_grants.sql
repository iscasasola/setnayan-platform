-- papic pool binding grants
--
-- THE binding: make the event pool "apply" whenever an event holds ANY
-- papic_event_point_grants row (Free / Papic One / Papic Pool), not only when it
-- holds a pass_service_codes order. This routes the whole one-pool model through
-- the SAME reserve RPC (papic_reserve_event_points) — WITHOUT touching
-- papic_event_pool_config.pass_service_codes, so the §11 fence RAISE in
-- 20270828140000 (which aborts if a papic_pass_tiers code appears there) can
-- never trip.
--
-- Two CREATE OR REPLACEs, both additive + idempotent:
--   3a. papic_event_pool_status  — applies when flat-pass OR grants exist; the
--       guest-derived base applies ONLY to the legacy flat-pass fence, so a
--       grant-only event is metered at exactly SUM(grants) (Free 50 / One 250*N
--       / Pool 3000), never the clamp(guests*150, 5000, 30000) ceiling.
--   3b. papic_record_guest_capture — a grant-driven event may record via guest
--       phones (ownership-via-pool) and its per-guest 150-credit cap yields to
--       the event pool (the route's papic_reserve_event_points is the real cap).
--
-- papic_event_points_remaining + papic_reserve_event_points read pool_status, so
-- redefining status alone re-points both — they are NOT edited here. No
-- is_active / status flip; no rename. Pool / One stay dark (no new doorway).

BEGIN;

-- ---- 3a. papic_event_pool_status — apply via flat-pass OR grants -----------
-- Byte-identical to 20270826385580 except: (1) v_granted is summed up-front,
-- (2) the fence applies when a flat pass exists OR any grant exists, and (3) the
-- guest-derived base is computed ONLY for the legacy flat pass (grant-only
-- events have base 0 => total == SUM(grants)).
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
  v_total     INTEGER;
  v_used      INTEGER;
  v_has_flat  BOOLEAN;
BEGIN
  v_has_flat := public.papic_event_has_flat_pass(p_event_id);

  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_granted
    FROM public.papic_event_point_grants
   WHERE event_id = p_event_id;

  -- Applies when a flat pass exists (legacy) OR the event holds ANY grant
  -- (Free / One / Pool). No grant + no pass -> fence absent, byte-identical to
  -- today's non-pass behaviour.
  IF NOT v_has_flat AND COALESCE(v_granted, 0) <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT points_per_guest, floor_points, ceiling_points, soft_stop_pct
    INTO v_per_guest, v_floor, v_ceiling, v_soft_pct
    FROM public.papic_event_pool_config
   WHERE config_key = 'default';

  -- Guest-derived base applies ONLY to the legacy flat-pass fence. A grant-only
  -- event has base 0, so its total is exactly SUM(grants) — a ₱100 Papic One
  -- buyer is metered at 250, not the guest-clamp ceiling.
  IF v_has_flat THEN
    -- Guest count = the most generous defensible number, so the fence never
    -- under-serves a couple whose RSVPs lag: the frozen final_pax, the couple's
    -- own estimate, and the live non-declined guest rows — whichever is largest.
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

  v_total := v_base + COALESCE(v_granted, 0);

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

-- ---- 3b. papic_record_guest_capture — record + yield the 150 to the pool ---
-- Byte-identical to 20270303900000 except: (1) resolve v_pool_applies once the
-- guest's event is known, (2) ownership passes when the event owns PAPIC_GUEST
-- OR the pool applies (so a Free event with only a free_grant can record via
-- guest phones), and (3) the per-guest 150-credit cap yields to the pool (so a
-- Pool event's per-guest-150 never binds before the purchased ceiling — the
-- route's papic_reserve_event_points is the real cap).
CREATE OR REPLACE FUNCTION public.papic_record_guest_capture(
  p_guest_id          UUID,
  p_r2_object_key     TEXT DEFAULT NULL,
  p_consent_to_public BOOLEAN DEFAULT false,
  p_media_type        TEXT DEFAULT 'photo',
  p_duration_ms       INT DEFAULT NULL,
  p_poster_r2_key     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits   CONSTANT INTEGER := 150;
  v_event_id  UUID;
  v_owns      BOOLEAN;
  v_unlimited BOOLEAN;
  v_used      INTEGER;
  v_media     TEXT;
  v_duration  INT;
  v_pool_applies BOOLEAN;
BEGIN
  -- Normalize media_type → only 'photo' | 'clip'; anything else falls back to
  -- 'photo' so a malformed caller never trips the CHECK constraint.
  v_media := CASE WHEN p_media_type = 'clip' THEN 'clip' ELSE 'photo' END;

  -- Clip duration is capped at the 5000ms corpus hard lock (defense in depth —
  -- the client + route also enforce it). Photos carry no duration.
  v_duration := CASE
    WHEN v_media = 'clip' AND p_duration_ms IS NOT NULL
      THEN LEAST(GREATEST(p_duration_ms, 0), 5000)
    ELSE NULL
  END;

  -- Resolve the guest's event. A deleted guest cannot capture.
  SELECT event_id INTO v_event_id
  FROM public.guests
  WHERE guest_id = p_guest_id
    AND deleted_at IS NULL;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_guest');
  END IF;

  -- Does the ONE shared event pool apply to this event (Free / One / Pool grant,
  -- or the legacy flat pass)? Resolved once and reused for both gates below.
  v_pool_applies := (SELECT applies FROM public.papic_event_pool_status(v_event_id));

  -- Ownership passes when the event owns PAPIC_GUEST OR the pool applies — the
  -- latter lets a Free event (owns nothing, holds only a free_grant) record via
  -- guest phones.
  v_owns := public.papic_event_owns_service(v_event_id, 'PAPIC_GUEST')
            OR COALESCE(v_pool_applies, FALSE);
  IF NOT v_owns THEN
    RETURN jsonb_build_object('status', 'not_owned');
  END IF;

  -- "Unlock all of Papic": an ACTIVE (paid/fulfilled) PAPIC_UNLOCK order lifts the
  -- per-guest 150-credit cap. Mirrors apps/web/lib/entitlements.ts
  -- eventHasPapicUnlock (active-only) — a pending pass never lifts the cap.
  SELECT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE event_id = v_event_id
      AND service_key = 'PAPIC_UNLOCK'
      AND status IN ('paid', 'fulfilled')
  ) INTO v_unlimited;

  -- The event pool is the authoritative ceiling for a pool-driven event, so the
  -- per-guest 150 must NOT double-cap it: yield the per-guest gate whenever the
  -- pool applies (the route's papic_reserve_event_points is the real cap).
  v_unlimited := v_unlimited OR COALESCE(v_pool_applies, FALSE);

  -- Advisory lock keyed on the guest so two simultaneous captures from the
  -- same phone serialize through the count check. hashtextextended → bigint
  -- lock key scoped to this transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

  SELECT COUNT(*)::INTEGER INTO v_used
  FROM public.papic_guest_captures
  WHERE guest_id = p_guest_id;

  -- Unlock / pool events never exhaust here; otherwise the 150-credit pool binds.
  IF NOT v_unlimited AND v_used >= v_credits THEN
    RETURN jsonb_build_object(
      'status', 'quota_exhausted',
      'total', v_credits,
      'used', v_used,
      'remaining', 0
    );
  END IF;

  INSERT INTO public.papic_guest_captures (
    event_id, guest_id, r2_object_key, consent_to_public,
    media_type, duration_ms, poster_r2_key
  )
  VALUES (
    v_event_id, p_guest_id, p_r2_object_key, COALESCE(p_consent_to_public, false),
    v_media, v_duration, NULLIF(btrim(COALESCE(p_poster_r2_key, '')), '')
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'total', v_credits,
    'used', v_used + 1,
    -- Unlimited guests report a non-zero remaining so no numeric consumer ever
    -- reads "exhausted"; the client shows "Unlimited" off the server-rendered
    -- flag regardless.
    'remaining', CASE
      WHEN v_unlimited THEN v_credits
      ELSE GREATEST(0, v_credits - (v_used + 1))
    END,
    'unlimited', v_unlimited
  );
END;
$$;

COMMIT;
