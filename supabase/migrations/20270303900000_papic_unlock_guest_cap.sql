-- "Unlock all of Papic" (PR9 · #2269) — lift the per-guest 150-credit cap.
--
-- PR9 shipped the PAPIC_UNLOCK umbrella bundle (grants every Papic add-on) but
-- DEFERRED the metered allowances. This redefines papic_record_guest_capture so
-- an event holding an ACTIVE (paid/fulfilled) PAPIC_UNLOCK order never exhausts a
-- guest (v_unlimited) — the guest half of "unli guests". The match is
-- paid/fulfilled ONLY, mirroring the app-side eventHasPapicUnlock
-- (checkOrderActive) — a pending 'submitted' pass does NOT lift the cap.
--
-- Everything else is BYTE-IDENTICAL to the 20270216612756 definition (clip media
-- + duration + poster + advisory lock + ownership gate). Additive + idempotent
-- (CREATE OR REPLACE), no new columns, no RLS change.
--
-- GRACEFUL: if unapplied, the cap stays 150 and the feature degrades to today's
-- behavior — the app-side fetchGuestQuota lift is independent and safe on its own
-- (it only affects the display + the route pre-check; this RPC is the hard gate).

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

  v_owns := public.papic_event_owns_service(v_event_id, 'PAPIC_GUEST');
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

  -- Advisory lock keyed on the guest so two simultaneous captures from the
  -- same phone serialize through the count check. hashtextextended → bigint
  -- lock key scoped to this transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

  SELECT COUNT(*)::INTEGER INTO v_used
  FROM public.papic_guest_captures
  WHERE guest_id = p_guest_id;

  -- Unlock events never exhaust; otherwise the 150-credit pool binds.
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
