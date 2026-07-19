-- ============================================================================
-- Papic free sampler — close the storage-leak / abuse hole
-- (owner-flagged "FIX before widening" · 2026-06-25)
-- ============================================================================
--
-- THE BUG. The free Papic sampler caps each seat at 8 photos + 2 clips
-- (migration 20270103000000). That cap was enforced ONLY in the
-- recordSeatCapture server action — i.e. AFTER the bytes were already PUT to R2
-- by the client (presign /api/upload → PUT → recordSeatCapture). A scripted (or
-- just-leaked-link) claimer could therefore:
--   1. presign the 9th/10th photo (the presign route never checked the cap),
--   2. PUT the bytes to R2,
--   3. get rejected only at the recordSeatCapture INSERT (over-cap),
-- leaving ORPHAN BYTES in R2 that no papic_photos row accounts for — never
-- counted, never swept. R2 storage is Setnayan's only marginal per-couple cost,
-- so leaked bytes are the one real cost leak.
--
-- Compounding it, the recordSeatCapture cap check was a NON-ATOMIC
-- count-then-insert: two concurrent requests could both read a stale "7 used"
-- and both insert the 8th+9th. (The old comment "one phone per seat = no
-- concurrency" doesn't hold against a hostile/scripted caller.)
--
-- THE FIX (this migration adds the DB primitives; the app wires them):
--   (A) papic_sampler_insert_capture(...) — the ATOMIC record-layer reservation.
--       It takes a row lock on the seat, counts the CURRENT (non-superseded)
--       captures of that kind, and INSERTs the papic_photos row ONLY when under
--       cap, all in one transaction. Concurrent callers serialize on the seat
--       lock, so the (cap+1)th INSERT is impossible — the DB row IS the cap.
--       recordSeatCapture calls this for sampler seats instead of its old
--       count-then-insert.
--   (B) papic_sampler_remaining(...) — a cheap capacity probe the PRESIGN route
--       (/api/upload, papic-sampler branch) calls so it REFUSES to mint a
--       presigned PUT URL once the seat is at cap. No URL ⇒ no bytes can reach
--       R2 unaccounted. This is the actual leak-prevention; (A) is the
--       authoritative backstop against a presign-time race.
--
-- Both functions touch ONLY is_free_sampler = TRUE seats. Paid/normal seats are
-- untouched (uncapped, permanent) — the live paid pipeline does not change.
--
-- pgcrypto note: gen_random_uuid lives in the `extensions` schema. This file
-- pins search_path = public, extensions; the INSERT omits photo_id so the
-- column's existing gen_random_uuid() DEFAULT fires (no direct call here), but
-- the extensions schema is on the path defensively all the same.
--
-- Idempotent. CREATE OR REPLACE only. No data backfill, no drops.
-- ============================================================================

BEGIN;

-- Per-seat sampler caps mirror the app constants (lib/papic-seats.ts:
-- PAPIC_SAMPLER_PHOTO_CAP = 8 · PAPIC_SAMPLER_CLIP_CAP = 2). Inlined as 8 / 2.

-- ---------------------------------------------------------------------------
-- (B) Capacity probe — how many more captures of this kind can this sampler
--     seat still take? Returns the remaining count (0 = at cap). The presign
--     route calls this BEFORE minting a presigned URL so over-cap bytes can
--     never reach R2. SECURITY DEFINER so it works for the (anonymous) claimer,
--     whose session can't read the seat under RLS in this aggregate shape; the
--     caller passes the seat_id the upload route already resolved + ownership-
--     checked, so this only ever reports a count, never leaks seat data.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_sampler_remaining(
  p_seat_id UUID,
  p_kind    TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_is_sampler BOOLEAN;
  v_cap        INTEGER;
  v_used       INTEGER;
  v_kind       TEXT;
BEGIN
  v_kind := CASE WHEN p_kind = 'clip' THEN 'clip' ELSE 'photo' END;

  SELECT is_free_sampler INTO v_is_sampler
  FROM public.paparazzi_seats
  WHERE seat_id = p_seat_id;

  -- Unknown seat OR a paid/normal seat → uncapped from this probe's POV.
  -- (Paid seats are intentionally not gated here; their entitlement gate lives
  -- elsewhere.) Return a large sentinel so the presign route treats it as "room".
  IF v_is_sampler IS DISTINCT FROM TRUE THEN
    RETURN 2147483647;
  END IF;

  v_cap := CASE WHEN v_kind = 'clip' THEN 2 ELSE 8 END;

  SELECT COUNT(*) INTO v_used
  FROM public.papic_photos
  WHERE paparazzi_seat_id = p_seat_id
    AND photo_type = v_kind
    AND superseded_at IS NULL;

  RETURN GREATEST(v_cap - COALESCE(v_used, 0), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_sampler_remaining(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- (A) Atomic record-layer reservation — INSERT the sampler capture ONLY when
--     the seat is under its per-kind cap, holding a row lock on the seat so
--     concurrent callers can't both pass a stale count. This is the heart of
--     the fix: the DB row is the cap, so it is IMPOSSIBLE to persist an
--     over-cap capture (and therefore impossible to justify over-cap bytes).
--
--     Returns a JSONB verdict the server action maps straight to its existing
--     RecordSeatCaptureResult:
--       { ok:true,  photo_id:<uuid> }
--       { ok:false, error:'sampler_photo_cap' | 'sampler_clip_cap'
--                          | 'not_sampler' | 'no_seat' | 'revoked' }
--
--     p_expires_at is computed by the caller (NULL when the event already
--     converted — Drive grant / paid — so shots are born permanent; otherwise
--     NOW()+30d). p_poster_r2_key is the clip's NSFW poster proxy (NULL for
--     photos / when absent). The caller has ALREADY verified (under RLS) that
--     it is the seat's claimer before calling this DEFINER fn.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_sampler_insert_capture(
  p_seat_id       UUID,
  p_kind          TEXT,
  p_r2_object_key TEXT,
  p_poster_r2_key TEXT DEFAULT NULL,
  p_expires_at    TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event_id   UUID;
  v_is_sampler BOOLEAN;
  v_revoked    TIMESTAMPTZ;
  v_kind       TEXT;
  v_cap        INTEGER;
  v_used       INTEGER;
  v_photo_id   UUID;
BEGIN
  IF p_r2_object_key IS NULL OR length(trim(p_r2_object_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_input');
  END IF;

  v_kind := CASE WHEN p_kind = 'clip' THEN 'clip' ELSE 'photo' END;

  -- Lock the seat row for the duration of the transaction. Concurrent capture
  -- requests for the SAME seat serialize here, so the count-then-insert below
  -- is atomic — two requests can never both read "7 used" and both insert.
  SELECT event_id, is_free_sampler, revoked_at
    INTO v_event_id, v_is_sampler, v_revoked
  FROM public.paparazzi_seats
  WHERE seat_id = p_seat_id
  FOR UPDATE;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_seat');
  END IF;
  IF v_revoked IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;
  -- This RPC is for the FREE sampler only. A non-sampler seat must use the
  -- normal (uncapped) insert path; reject so we never silently mis-route.
  IF v_is_sampler IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_sampler');
  END IF;

  v_cap := CASE WHEN v_kind = 'clip' THEN 2 ELSE 8 END;

  SELECT COUNT(*) INTO v_used
  FROM public.papic_photos
  WHERE paparazzi_seat_id = p_seat_id
    AND photo_type = v_kind
    AND superseded_at IS NULL;

  IF COALESCE(v_used, 0) >= v_cap THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', CASE WHEN v_kind = 'clip' THEN 'sampler_clip_cap' ELSE 'sampler_photo_cap' END
    );
  END IF;

  -- Under cap → reserve the slot by inserting the row. photo_id rides the
  -- column default (gen_random_uuid via the table DEFAULT). poster_r2_key only
  -- for clips that carry one.
  INSERT INTO public.papic_photos (
    event_id,
    paparazzi_seat_id,
    r2_object_key,
    photo_type,
    poster_r2_key,
    expires_at
  )
  VALUES (
    v_event_id,
    p_seat_id,
    p_r2_object_key,
    v_kind,
    CASE WHEN v_kind = 'clip' THEN p_poster_r2_key ELSE NULL END,
    p_expires_at
  )
  RETURNING photo_id INTO v_photo_id;

  RETURN jsonb_build_object('ok', true, 'photo_id', v_photo_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_sampler_insert_capture(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated;

COMMIT;
