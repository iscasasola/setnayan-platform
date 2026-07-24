-- ============================================================================
-- 20270920602517_guest_capture_restore_ugc_gates.sql
--
-- Gap audit 2026-07-23 · Batch B2. Restore the two UGC moderation gates to the
-- SECURITY DEFINER papic_record_guest_capture() RPC.
--
-- WHY: migration 20261108000000 installed papic_record_guest_capture as the
-- AUTHORITATIVE server-side gate — it returned 'blocked' for a guest in
-- event_blocked_users and 'terms_required' before a first upload without
-- ugc_terms_accepted_at (Apple 1.2 / Play UGC compliance). Later re-creations of
-- the function (…216612756 → …303900000 → …903248590 clip-currency) carried the
-- quota + pool logic forward but silently DROPPED both gates. The route
-- (app/api/papic/guest-capture) still enforces both at the app layer, so this is
-- NOT a live bypass — it is defense-in-depth restored to the authoritative
-- function so a direct RPC caller can never deposit under a block / no terms.
--
-- This CREATE OR REPLACE keeps the current clip-currency body verbatim (10s cap,
-- one-pool applies, PAPIC_UNLOCK, advisory lock, 150 credits) and re-inserts the
-- block + terms gates right after the ownership check, exactly where the
-- authoritative version had them (before the quota branch). Idempotent.
-- ============================================================================

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
  v_terms_at  TIMESTAMPTZ;
  v_blocked   BOOLEAN;
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

  -- Clip duration is capped at the 10000ms clip lock (defense in depth —
  -- the client + route also enforce it). Photos carry no duration.
  v_duration := CASE
    WHEN v_media = 'clip' AND p_duration_ms IS NOT NULL
      THEN LEAST(GREATEST(p_duration_ms, 0), 10000)
    ELSE NULL
  END;

  -- Resolve the guest's event + terms-acceptance. A deleted guest cannot capture.
  SELECT event_id, ugc_terms_accepted_at INTO v_event_id, v_terms_at
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

  -- UGC moderation gate 1 — event-scoped block (Apple 1.2 / Play UGC). A blocked
  -- uploader cannot deposit anything into this event's gallery. (Restored — the
  -- authoritative 20261108000000 enforced this; the route mirrors it.)
  SELECT EXISTS (
    SELECT 1 FROM public.event_blocked_users b
    WHERE b.event_id = v_event_id
      AND b.blocked_guest_id = p_guest_id
  ) INTO v_blocked;
  IF v_blocked THEN
    RETURN jsonb_build_object('status', 'blocked');
  END IF;

  -- UGC moderation gate 2 — one-time terms acceptance before the first upload.
  IF v_terms_at IS NULL THEN
    RETURN jsonb_build_object('status', 'terms_required');
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
