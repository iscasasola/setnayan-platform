-- ============================================================================
-- A SEAT CAPTURE'S CREDIT AND ITS PHOTO ARE NOW ONE TRANSACTION
-- ============================================================================
--
-- ── THE DEBT THIS PAYS ──────────────────────────────────────────────────────
--
-- `recordSeatCapture` reserved the credits (papic_reserve_capture_split) and
-- THEN wrote the papic_photos row. Two round trips. A process that died in the
-- gap left the credits spent and no photograph — the couple charged for a shot
-- that does not exist. The application unwind (releaseCaptureCredits) covers the
-- ORDINARY failure, where the insert returns an error and the same process is
-- still alive to put the credits back; it cannot cover a death, a timeout, a
-- container eviction or a deploy landing between the two calls.
--
-- 20271169487222 (the migration that closed the INSERT grant) says this in its
-- own words and names the repair: *"a SECURITY DEFINER record function that
-- reserves and inserts under one transaction, which also deletes the unwind code
-- outright."* This is that function.
--
-- 🔑 IT IS NOT A NEW IDEA AND IT IS NOT A NEW SHAPE. `papic_record_guest_capture`
-- has done exactly this for the OTHER half of Papic since 20260718000000:
-- resolve the capturer, check the event owns the service, check the uploader is
-- not blocked, check terms, check the pass, meter, insert — all inside one
-- SECURITY DEFINER function, which is why `anon` has never needed an INSERT
-- grant on `papic_guest_captures`. This follows its shape.
--
-- ⚠ IT IS A MODEL, NOT A FUNCTION TO REUSE. That one writes
-- `papic_guest_captures`; this one writes `papic_photos`. Nothing copies between
-- them and neither is a second writer of the other's table.
--
-- ── WHAT MOVED INTO THE TRANSACTION, AND WHAT DELIBERATELY DID NOT ──────────
--
-- The record path refuses a capture eight ways. Three of them are now IN here,
-- because they are the ones the credit spend must be consistent with:
--
--   IN   · seat authorization (the seat exists, belongs to this event, is
--          claimed by THIS person, and is not revoked)
--   IN   · the split credit reserve (the camera's own credits first, the event
--          pot for the remainder)
--   IN   · the row itself
--
-- Five stay in the server action above it, and each for a reason:
--
--   OUT  · the per-camera BURST limiter — it lives in Upstash. It cannot move
--          into Postgres and should not: it protects a credit balance from a
--          stuck client, and it FAILS OPEN by design so a limiter outage never
--          stops a wedding being photographed.
--   OUT  · the 10-second clip cap — a refusal about the FILE, decided before
--          anything is presigned. Nothing is spent when it fires.
--   OUT  · the capture WINDOW, the paid-order gate, the put-away gate — each
--          needs reads (orders, event state, the shared window helper) that are
--          already correct in TypeScript and are deliberately fail-OPEN or
--          fail-CLOSED in ways this function must not silently re-decide.
--   OUT  · the RA 10173 geo control — resolved above and arriving here as the
--          exact columns to write. Passing the DECISION rather than the raw fix
--          keeps `buildPapicGeoFields` the single place that rule is expressed.
--
-- 🔑 ALL FIVE REFUSE BEFORE ANY CREDIT IS TOUCHED, so none of them can leave a
-- spend without a photograph. That is the property this migration is about — not
-- "every check is in SQL", which would be a rewrite that buys nothing.
--
-- ── WHY THE CALLER'S IDENTITY IS AN ARGUMENT AND NEVER `current_user` ────────
--
-- 🪤 `current_user` INSIDE A `SECURITY DEFINER` FUNCTION IS THE FUNCTION'S
-- OWNER, NEVER THE CALLER. This project has paid for that twice — most recently
-- in `tg_stamp_capturer_person`, where a gate copied from a SECURITY INVOKER
-- trigger next door could not be true, so the pin never fired and the forgery
-- test moved the photo while the trigger watched.
--
-- And `auth.uid()` is no use either, because this function is called with the
-- SERVICE ROLE, where there is no JWT to read.
--
-- So identity arrives as `p_claimer_user_id`, resolved OUTSIDE under the
-- caller's own session — exactly how `papic_record_guest_capture` receives
-- `p_guest_id` from a cookie the route validated. The function then compares it
-- to `paparazzi_seats.claimer_user_id` itself, so a wrong id is refused here and
-- not only up there.
--
-- ⛔ WHICH IS WHY EXECUTE IS SERVICE-ROLE ONLY, AND THAT IS LOAD-BEARING. If a
-- browser role could call this, a signed-in claimer would name their own id and
-- walk past the five gates listed above — the burst limiter, the clip cap, the
-- window, the payment and the put-away — which is precisely the hole
-- 20271169487222 closed. `papic_reserve_capture_split` and
-- `papic_release_capture_split` already sit behind the same door; this joins
-- them rather than inventing a new posture.
--
-- ── WHAT IS STILL NOT PROMISED ──────────────────────────────────────────────
--
-- ⚠ The bytes are in R2 before this runs, and R2 is not in the transaction. A
-- refusal here leaves an orphaned object, which is what the presign-side probes
-- exist to make rare. Orphaned bytes cost storage; a leaked credit costs a
-- couple a photograph. Only the second one is a money invariant.
--
-- ⚠ Prod at the time of writing: 14 papic_photos rows, every one already
-- credited and metered. Nothing is retro-fixed here.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.papic_record_seat_capture(
  p_seat_id           UUID,
  p_event_id          UUID,
  p_claimer_user_id   UUID,
  p_r2_object_key     TEXT,
  p_photo_type        TEXT DEFAULT 'photo',
  p_poster_r2_key     TEXT DEFAULT NULL,
  p_cost              INTEGER DEFAULT 0,
  p_geo_lat           DOUBLE PRECISION DEFAULT NULL,
  p_geo_lon           DOUBLE PRECISION DEFAULT NULL,
  p_geo_accuracy_m    DOUBLE PRECISION DEFAULT NULL,
  p_geo_unavailable   BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_seat_event    UUID;
  v_seat_claimer  UUID;
  v_revoked_at    TIMESTAMPTZ;
  v_type          TEXT;
  v_poster        TEXT;
  v_key           TEXT;
  v_ok            BOOLEAN;
  v_dedicated     INTEGER := 0;
  v_pool          INTEGER := 0;
  v_photo_id      UUID;
BEGIN
  v_key := NULLIF(btrim(COALESCE(p_r2_object_key, '')), '');
  IF p_seat_id IS NULL OR p_event_id IS NULL OR p_claimer_user_id IS NULL
     OR v_key IS NULL THEN
    RETURN jsonb_build_object('status', 'missing_input');
  END IF;

  -- Normalize the kind. Anything that is not the literal 'clip' is a photo, so a
  -- malformed caller can never trip the CHECK constraint — the same normalization
  -- papic_record_guest_capture does for `p_media_type`.
  v_type   := CASE WHEN p_photo_type = 'clip' THEN 'clip' ELSE 'photo' END;
  -- A poster frame is the NSFW screen's proxy for a video. It is meaningless on a
  -- still, and a still carrying one would be screened against the wrong image.
  v_poster := CASE
    WHEN v_type = 'clip' THEN NULLIF(btrim(COALESCE(p_poster_r2_key, '')), '')
    ELSE NULL
  END;

  -- ── AUTHORIZATION, DONE HERE AND NOT ONLY UPSTAIRS ────────────────────────
  -- The action already resolves the seat under the claimer's own session, where
  -- RLS scopes the lookup. This asks the same three questions again against the
  -- row, because a SECURITY DEFINER function that trusts its arguments is a
  -- function whose only fence is the discipline of its callers.
  SELECT event_id, claimer_user_id, revoked_at
    INTO v_seat_event, v_seat_claimer, v_revoked_at
    FROM public.paparazzi_seats
   WHERE seat_id = p_seat_id;

  IF v_seat_event IS NULL THEN
    RETURN jsonb_build_object('status', 'not_your_seat');
  END IF;
  -- CROSS-EVENT GUARD, the same one papic_reserve_capture_split carries: a seat
  -- id is not a capability, so naming one event's camera while charging another
  -- event's pot is refused rather than merely unlikely.
  IF v_seat_event <> p_event_id THEN
    RETURN jsonb_build_object('status', 'not_your_seat');
  END IF;
  IF v_seat_claimer IS NULL OR v_seat_claimer <> p_claimer_user_id THEN
    RETURN jsonb_build_object('status', 'not_your_seat');
  END IF;
  IF v_revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  -- ── THE METER ─────────────────────────────────────────────────────────────
  -- p_cost = 0 means "this capture is not metered" — an event holding the Papic
  -- Unlock pass, or a legacy PAPIC_SEATS pack seat, both of which skip the
  -- reserve upstairs today. Expressed as a cost of zero rather than a boolean so
  -- there is exactly one number describing what this capture is worth.
  IF COALESCE(p_cost, 0) > 0 THEN
    SELECT r.ok, r.dedicated_spent, r.pool_spent
      INTO v_ok, v_dedicated, v_pool
      FROM public.papic_reserve_capture_split(p_seat_id, p_event_id, p_cost) AS r;

    -- The split returns FALSE having spent NOTHING when the pot cannot cover the
    -- remainder — its own comment explains why the refusable leg runs first. So
    -- an exhausted answer needs no unwind, here or above.
    IF NOT COALESCE(v_ok, FALSE) THEN
      RETURN jsonb_build_object('status', 'exhausted');
    END IF;
  END IF;

  -- ── THE ROW ───────────────────────────────────────────────────────────────
  -- 🔑 THIS IS THE WHOLE POINT OF THE FUNCTION. The reserve above has already
  -- moved two balances. If this INSERT raises — a constraint, a revoked grant, a
  -- lost connection mid-statement — the transaction rolls back and both balances
  -- go with it. There is no window in which credits are spent and no photograph
  -- exists, and therefore nothing left for an application unwind to do.
  --
  -- geo: passing NULL for every geo argument writes exactly what "the privacy
  -- control is off" wrote before — NULLs, and `geo_unavailable` at its column
  -- default of FALSE. The decision itself stays in buildPapicGeoFields, which is
  -- the one place the RA 10173 rule is expressed.
  --
  -- `expires_at` is not an argument. Captures are uncapped and permanent; the
  -- retired free sampler was the only path that ever set an expiry, and giving
  -- this function a handle for it would be inventing a rule nothing asks for.
  INSERT INTO public.papic_photos (
    event_id, paparazzi_seat_id, r2_object_key, photo_type, poster_r2_key,
    geo_lat, geo_lon, geo_accuracy_m, geo_unavailable
  )
  VALUES (
    p_event_id, p_seat_id, v_key, v_type, v_poster,
    p_geo_lat, p_geo_lon, p_geo_accuracy_m, COALESCE(p_geo_unavailable, FALSE)
  )
  RETURNING photo_id INTO v_photo_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'photo_id', v_photo_id,
    -- Returned for observability only. NOTHING should unwind these: they are
    -- committed with the row or they never happened.
    'dedicated_spent', COALESCE(v_dedicated, 0),
    'pool_spent', COALESCE(v_pool, 0)
  );
END;
$function$;

COMMENT ON FUNCTION public.papic_record_seat_capture(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN
) IS
  'Reserve a seat capture''s credits AND write its papic_photos row in ONE '
  'transaction (2026-08-26). Replaces the two-step reserve-then-insert in '
  'recordSeatCapture, whose gap leaked credits on a process death. Caller '
  'identity arrives as p_claimer_user_id and is compared to the seat''s claimer '
  'here — never current_user, which inside a SECURITY DEFINER function is this '
  'function''s OWNER. SERVICE-ROLE ONLY: a browser role holding EXECUTE could '
  'skip the burst limiter, the clip cap, the capture window, the paid-order gate '
  'and the put-away gate, which is the hole 20271169487222 closed. p_cost = 0 '
  'means unmetered (Papic Unlock pass / legacy pack seat).';

-- ── THE DOOR ────────────────────────────────────────────────────────────────
-- A fresh function is created with EXECUTE granted to PUBLIC, which includes
-- `anon` and `authenticated`. Revoking from PUBLIC is what actually closes it;
-- revoking the two roles by name leaves the PUBLIC grant standing and every
-- future role arrives holding it.
REVOKE ALL ON FUNCTION public.papic_record_seat_capture(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.papic_record_seat_capture(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN
) FROM anon;
REVOKE ALL ON FUNCTION public.papic_record_seat_capture(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.papic_record_seat_capture(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN
) TO service_role;

-- ── REFUSE TO APPLY IF THE DOOR DID NOT CLOSE ───────────────────────────────
-- The grants above are the security half of this migration. A migration that
-- creates the function and silently fails to close it would hand every signed-in
-- claimer a way around five gates — so it refuses to apply rather than reporting
-- success on half the work.
DO $guard$
DECLARE
  v_oid OID;
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'papic_record_seat_capture';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: papic_record_seat_capture was not created';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'refusing to apply: anon can EXECUTE papic_record_seat_capture';
  END IF;
  IF has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'refusing to apply: authenticated can EXECUTE papic_record_seat_capture';
  END IF;
  IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'refusing to apply: service_role cannot EXECUTE papic_record_seat_capture — the camera would stop recording';
  END IF;
END;
$guard$;
