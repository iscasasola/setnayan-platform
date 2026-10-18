-- ═══════════════════════════════════════════════════════════════════════════
-- A GUEST SHOT SPENDS ITS POINTS IN THE SAME TRANSACTION AS ITS ROW
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🪤 WHAT WAS WRONG. `POST /api/papic/guest-capture` booked the shot's points
-- (`papic_reserve_event_points`, or `papic_reserve_capture_split` for a guest
-- holding a camera of her own) in ONE round trip, and wrote the row
-- (`papic_record_guest_capture`) in a SECOND. The route put the points back when
-- the record refused — but only while the same process was alive to do it. A
-- timeout, a container eviction or a deploy landing between the two calls left
-- the points spent and no photograph: the couple's pot (or the guest's own
-- purchase) charged for a shot that does not exist. Named and left open by
-- #6621 (20271272777206, "⏳ LEFT").
--
-- ✅ THE FIX — the seat path's shape, already shipped for the other half of
-- Papic (`papic_record_seat_capture`, 20271170528490): ONE function, ONE
-- transaction. It books the points against the SAME ledgers the route used and
-- writes the row, and if either side refuses, the other is undone with it. Either both commit or neither does, so there is no state between
-- them for a death to strand and nothing left for an application unwind to do.
--
-- ── THE THREE BALANCES, EXACTLY AS BEFORE ────────────────────────────────
--   • the PER-GUEST CEILING (and the platform's per-phone 150) — metered INSIDE
--     `papic_record_guest_capture` by summing `points_cost` over her rows. It is
--     called here unchanged, so it meters unchanged; a row rolled back is a
--     spend rolled back.
--   • the GUEST'S OWN CAMERA + THE POT — `papic_reserve_capture_split` when she
--     holds an active camera (same predicate as `resolveGuestOwnCamera`: this
--     event, this guest, not revoked), otherwise `papic_reserve_event_points`.
--     The same two functions the route called, with the same cost. Neither
--     function is edited.
--
-- ── TWO ORDERS, AND EACH IS FORCED ───────────────────────────────────────
-- 🔑 A GUEST WITH HER OWN CAMERA BOOKS FIRST, exactly as the route did. The
-- ceiling meters what she spent of the COUPLE'S credits = everything minus what
-- she paid for herself, and "what she paid for herself" is read off
-- `papic_seat_point_usage` — the ledger the split moves. Recording first would
-- meter this shot as if the couple paid all of it and refuse her at her own
-- expense. (`papic-guest-own-credits-are-hers.db.test.ts` says the same of its
-- helper: "THE ORDER IS THE POINT".)
--
-- 🔑 EVERY OTHER GUEST RECORDS FIRST AND BOOKS LAST. With no camera of her own
-- nothing she spent is self-funded, so the order cannot change what the ceiling
-- sees — and the POT IS ONE ROW PER EVENT that every guest books against.
-- Booked first, its lock would be held across the whole record body (the
-- ceiling's aggregates, the insert) and serialise the celebration's cameras on
-- it; booked last, it is held only from the booking to the commit.
--   ⚠ The one place that order shows: when her ceiling AND the pot refuse in the
--   same instant she is told about her ceiling, not the pot. The route's
--   fail-open pre-check still answers the pot first in every ordinary case (it
--   409s before the upload); only a race past it sees the other refusal, and
--   both spend nothing.
--
-- ── THE ONE EXCEPTION BLOCK, AND WHY IT IS SAFE HERE ─────────────────────
-- `seat-capture-is-atomic.db.test.ts` warns that an EXCEPTION handler is an
-- implicit subtransaction that could commit a reserve while discarding the row.
-- Here the block holds BOTH — the booking AND the row — and catches exactly TWO
-- codes, each raised by this function to undo the block on purpose: PX409 (the
-- pot cannot cover a shot already recorded) and PX422 (the record refused a shot
-- already booked). Rolling the block back takes the row, its ceiling spend and
-- every booking with it. Any other error propagates and the whole call rolls
-- back. `a-guest-shot-spends-with-its-row.db.test.ts` forces a failure AFTER the
-- row and both bookings and reads the ledgers back — proven, not described.
--
-- ── A REPEAT SPENDS NOTHING ──────────────────────────────────────────────
-- A shutter that already landed (same `p_client_capture_id`) is answered under
-- the guest's lock, BEFORE any booking, by the record's own `duplicate: true`
-- reply. The route used to book first and put the points back on `duplicate`;
-- that booking is gone.
--
-- ⛔ SERVICE-ROLE ONLY, like `papic_record_seat_capture` and the two reserves it
-- calls. The route is the only caller and it runs the gates no SQL can (the
-- capture window, the put-away gate, the burst limiter, the upload itself).
--
-- ⛔ A NEW NAME, NOT A NEW `papic_record_guest_capture`. deploy-prod applies
-- migrations BEFORE the new code is live, so for the minutes of the Vercel build
-- the OLD route runs against this database. Had the record itself started
-- booking points, that old route — which still books its own — would charge
-- every shot twice. Under a new name the old route is untouched until the new
-- one replaces it.
--
-- ⚠ R2 IS STILL NOT IN THE TRANSACTION. The bytes are uploaded before this runs
-- (keyed by the shutter id, so a retry overwrites them). A refusal or a death
-- leaves an object and no row — storage, never money.

CREATE OR REPLACE FUNCTION public.papic_record_guest_capture_and_spend(
  p_guest_id          UUID,
  p_r2_object_key     TEXT,
  p_consent_to_public BOOLEAN DEFAULT false,
  p_media_type        TEXT DEFAULT 'photo',
  p_duration_ms       INT DEFAULT NULL,
  p_poster_r2_key     TEXT DEFAULT NULL,
  p_points_cost       INT DEFAULT 1,
  p_captured_at       TIMESTAMPTZ DEFAULT NULL,
  p_client_capture_id UUID DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rec     JSONB;
  v_event   UUID;
  v_cost    INTEGER;
  v_seat    UUID;
  v_ok      BOOLEAN;
  v_stored  INTEGER;
BEGIN
  -- The record's own floor, the same expression — so the ledgers are charged
  -- exactly what the row stores (asserted against the row below).
  v_cost := GREATEST(COALESCE(p_points_cost, 1), 1);

  SELECT g.event_id INTO v_event
    FROM public.guests g
   WHERE g.guest_id = p_guest_id
     AND g.deleted_at IS NULL;
  IF v_event IS NULL THEN
    -- Nothing to charge: the record answers `invalid_guest` and writes nothing.
    RETURN public.papic_record_guest_capture(p_guest_id => p_guest_id);
  END IF;

  -- The record's own lock, taken first so nothing below runs twice for one
  -- shutter (advisory xact locks are re-entrant: the record re-takes it).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

  IF p_client_capture_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.papic_guest_captures c
     WHERE c.guest_id = p_guest_id
       AND c.client_capture_id = p_client_capture_id
  ) THEN
    -- A shutter that already landed: the record's own `duplicate` reply, and
    -- not one point booked.
    RETURN public.papic_record_guest_capture(
      p_guest_id => p_guest_id, p_client_capture_id => p_client_capture_id);
  END IF;

  -- Her own camera, if she holds one — the predicate resolveGuestOwnCamera
  -- used (this event, this guest, not revoked; at most one row under
  -- paparazzi_seats_one_active_camera_per_guest).
  SELECT s.seat_id INTO v_seat
    FROM public.paparazzi_seats s
   WHERE s.event_id = v_event
     AND s.guest_id = p_guest_id
     AND s.revoked_at IS NULL;

  BEGIN
    IF v_seat IS NOT NULL THEN
      -- HER CAMERA: book first (her own credits, then the pot, all-or-nothing)
      -- so the ceiling below sees what she paid for herself.
      SELECT r.ok INTO v_ok
        FROM public.papic_reserve_capture_split(v_seat, v_event, v_cost) AS r;
      IF NOT COALESCE(v_ok, FALSE) THEN
        RAISE EXCEPTION 'papic pool cannot cover this shot' USING ERRCODE = 'PX409';
      END IF;
    END IF;

    -- THE ROW, and with it the per-guest ceiling (metered inside, unchanged).
    v_rec := public.papic_record_guest_capture(
      p_guest_id          => p_guest_id,
      p_r2_object_key     => p_r2_object_key,
      p_consent_to_public => p_consent_to_public,
      p_media_type        => p_media_type,
      p_duration_ms       => p_duration_ms,
      p_poster_r2_key     => p_poster_r2_key,
      p_points_cost       => p_points_cost,
      p_captured_at       => p_captured_at,
      p_client_capture_id => p_client_capture_id
    );

    -- Refused (ceiling, 150, terms, blocked, not owned) wrote no row — and must
    -- not keep a booking either. Undo the block; the reply is kept in v_rec.
    IF (v_rec->>'status') IS DISTINCT FROM 'ok'
       OR COALESCE((v_rec->>'duplicate')::BOOLEAN, FALSE) THEN
      RAISE EXCEPTION 'papic record refused this shot' USING ERRCODE = 'PX422';
    END IF;

    SELECT c.points_cost INTO v_stored
      FROM public.papic_guest_captures c
     WHERE c.capture_id = (v_rec->>'capture_id')::UUID;
    IF v_stored IS DISTINCT FROM v_cost THEN
      -- Not caught: the whole call rolls back rather than charge one number and
      -- store another.
      RAISE EXCEPTION 'papic guest capture stored % but was charged %', v_stored, v_cost;
    END IF;

    IF v_seat IS NULL THEN
      -- EVERYONE ELSE: book last, so the pot's row is locked only to the commit.
      -- TRUE without a ledger row when no pool applies to this event.
      v_ok := public.papic_reserve_event_points(v_event, v_cost);
      IF NOT COALESCE(v_ok, FALSE) THEN
        RAISE EXCEPTION 'papic pool cannot cover this shot' USING ERRCODE = 'PX409';
      END IF;
    END IF;

    RETURN v_rec;
  EXCEPTION
    WHEN SQLSTATE 'PX409' THEN
      RETURN jsonb_build_object('status', 'camera_points_exhausted');
    WHEN SQLSTATE 'PX422' THEN
      RETURN v_rec;
  END;
END;
$function$;

COMMENT ON FUNCTION public.papic_record_guest_capture_and_spend(
  UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT, TIMESTAMPTZ, UUID
) IS
  'Record a guest capture AND book its points in ONE transaction (2026-10-18). '
  'Replaces the route''s reserve-then-record pair, whose gap left points spent '
  'with no photograph when the function died between them. Books against the '
  'same ledgers the route used (papic_reserve_capture_split when the guest holds '
  'an active camera — booked BEFORE the row, because the ceiling reads her '
  'self-funded spend off that ledger — else papic_reserve_event_points, booked '
  'AFTER the row to keep the pot''s lock short). Either side refusing undoes the '
  'other; a pot that cannot cover answers camera_points_exhausted. A duplicate '
  'shutter books nothing. SERVICE-ROLE ONLY.';

REVOKE ALL ON FUNCTION public.papic_record_guest_capture_and_spend(
  UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT, TIMESTAMPTZ, UUID
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.papic_record_guest_capture_and_spend(
  UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT, TIMESTAMPTZ, UUID
) FROM anon;
REVOKE ALL ON FUNCTION public.papic_record_guest_capture_and_spend(
  UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT, TIMESTAMPTZ, UUID
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.papic_record_guest_capture_and_spend(
  UUID, TEXT, BOOLEAN, TEXT, INT, TEXT, INT, TIMESTAMPTZ, UUID
) TO service_role;

-- ── THE HAND UNWIND'S RPC GOES WITH ITS LAST CALLER ─────────────────────────
-- `papic_release_capture_split` existed only so the route could put a booking
-- back by hand. The route no longer books outside this function, and the seat
-- path stopped releasing in 20271170528490, so nothing calls it; a refund door
-- with no caller is one a future edit can wire back in to give back a spend
-- that committed with its row (ugat-both-ends: "call it, or drop the function").
--   ⚠ THE DEPLOY WINDOW, named rather than hidden: deploy-prod applies this
--   BEFORE the new route is live. For the minutes of that Vercel build the OLD
--   route still runs, and on its rare refund path (a record that refuses AFTER
--   its booking — a ceiling or the 150 reached in a race, or a racing repeat)
--   the release now fails. `releaseCaptureCredits` logs that and never throws,
--   so the camera keeps working; that one shot's booking stays spent, exactly
--   the leak the old route already had on a death. Its ordinary path is
--   untouched (both reserves and the record are unchanged).
DROP FUNCTION IF EXISTS public.papic_release_capture_split(UUID, UUID, INTEGER, INTEGER);

-- ── REFUSE TO APPLY IF IT DID NOT DO ITS JOB ────────────────────────────────
DO $guard$
DECLARE
  v_n   INTEGER;
  v_oid OID;
  v_def TEXT;
BEGIN
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'papic_record_guest_capture_and_spend';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'refusing to apply: % papic_record_guest_capture_and_spend overloads (a named call resolves to none — 42725)', v_n;
  END IF;
  v_oid := 'public.papic_record_guest_capture_and_spend'::regproc;
  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'refusing to apply: a browser role can EXECUTE papic_record_guest_capture_and_spend';
  END IF;
  IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'refusing to apply: service_role cannot EXECUTE papic_record_guest_capture_and_spend — the guest camera would stop recording';
  END IF;
  IF to_regprocedure('public.papic_release_capture_split(uuid,uuid,integer,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: the hand-unwind RPC papic_release_capture_split is still here';
  END IF;
  SELECT pg_get_functiondef(v_oid) INTO v_def;
  IF v_def NOT LIKE '%papic_reserve_capture_split%'
     OR v_def NOT LIKE '%papic_reserve_event_points%'
     OR v_def NOT LIKE '%papic_record_guest_capture(%' THEN
    RAISE EXCEPTION 'refusing to apply: papic_record_guest_capture_and_spend lost a ledger';
  END IF;
END;
$guard$;
