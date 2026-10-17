-- ═══════════════════════════════════════════════════════════════════════════
-- A PLUS-ONE SEAT IS MINTED UNDER A LOCK — event day, no double records (L1·1)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🪤 WHAT WAS WRONG. `nameTheSeats` (apps/web/app/[slug]/actions.ts) read the
-- bringer's seat rows, planned which names fill which seats (`planSeatNames`),
-- then INSERTed a `guests` row for every name that needed a new seat. The plan
-- and the write were two round trips with nothing between them: two submits of
-- the same reply (a double tap, a retry after a lost response, two tabs) each
-- read "no seat yet", each planned a create, and each inserted one. Result: the
-- same +1 twice — two rows, two QR codes, two chairs on the seating chart — and
-- with a +2 allowance, more seats than the couple gave. The only index on
-- `plus_one_of_guest_id` (`guests_plus_one_of_idx`) is not unique, so nothing
-- below the app refused it.
--
-- ✅ THE FIX. The mint is ONE statement behind ONE lock, and the couple's
-- allowance is asked INSIDE it:
--   1. `pg_advisory_xact_lock` keyed on the BRINGER — every mint for one guest's
--      seats queues behind the previous one; different guests never wait on
--      each other;
--   2. the bringer's row is re-read live (`plus_one_allowed`, `plus_one_count`)
--      — the allowance comes from the DATABASE, never from the caller;
--   3. a live seat of this bringer that already carries the same first + last
--      name IS this seat: it is returned, nothing is inserted (the double tap);
--   4. a bringer already at their allowance gets `full`, nothing is inserted
--      (the stale plan of a second submit, or a crafted post);
--   5. otherwise the row is inserted, exactly the shape the app inserted before.
--
-- ⚖ Mirrors `plusOneSeats` (apps/web/lib/guests.ts): the count, clamped 0..4,
-- and nothing at all when `plus_one_allowed` is false.
--
-- 🔒 service_role only — the reply's server action is the one caller.

CREATE OR REPLACE FUNCTION public.guest_plus_one_seat_mint(
  p_event_id         UUID,
  p_bringer_guest_id UUID,
  p_seat             JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $mint$
DECLARE
  v_bringer RECORD;
  v_allowed INTEGER;
  v_live    INTEGER;
  v_first   TEXT := NULLIF(btrim(COALESCE(p_seat->>'first_name', '')), '');
  v_last    TEXT := NULLIF(btrim(COALESCE(p_seat->>'last_name', '')), '');
  v_same    UUID;
  v_new     UUID;
BEGIN
  IF p_event_id IS NULL OR p_bringer_guest_id IS NULL OR v_first IS NULL OR v_last IS NULL THEN
    RETURN jsonb_build_object('status', 'missing_input');
  END IF;

  -- 1 · one bringer's seats are minted one at a time.
  PERFORM pg_advisory_xact_lock(hashtextextended('guest_plus_one_seat:' || p_bringer_guest_id::text, 0));

  -- 2 · the allowance, live.
  SELECT plus_one_allowed, plus_one_count, plus_one_mode, side, group_category
    INTO v_bringer
    FROM public.guests
   WHERE guest_id = p_bringer_guest_id
     AND event_id = p_event_id
     AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_bringer');
  END IF;
  v_allowed := CASE
    WHEN v_bringer.plus_one_allowed THEN LEAST(4, GREATEST(0, COALESCE(v_bringer.plus_one_count, 1)))
    ELSE 0
  END;

  -- 3 · the same name on a live seat of this bringer is this seat.
  SELECT guest_id INTO v_same
    FROM public.guests
   WHERE event_id = p_event_id
     AND plus_one_of_guest_id = p_bringer_guest_id
     AND deleted_at IS NULL
     AND lower(btrim(first_name)) = lower(v_first)
     AND lower(btrim(last_name)) = lower(v_last)
   ORDER BY created_at
   LIMIT 1;
  IF v_same IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'ok', 'guest_id', v_same, 'existing', true);
  END IF;

  -- 4 · never past what the couple gave.
  SELECT COUNT(*)::INTEGER INTO v_live
    FROM public.guests
   WHERE event_id = p_event_id
     AND plus_one_of_guest_id = p_bringer_guest_id
     AND deleted_at IS NULL;
  IF v_live >= v_allowed THEN
    RETURN jsonb_build_object('status', 'full', 'allowed', v_allowed, 'live', v_live);
  END IF;

  -- 5 · the seat — the same shape the reply inserted before this function.
  INSERT INTO public.guests (
    event_id, first_name, last_name, name_prefix, middle_name, name_suffix,
    side, group_category, role, rsvp_status, photo_consent,
    plus_one_of_guest_id, plus_one_mode, plus_one_name_confirmed_at,
    meal_preference, dietary_restrictions
  )
  VALUES (
    p_event_id, v_first, v_last,
    p_seat->>'name_prefix', p_seat->>'middle_name', p_seat->>'name_suffix',
    v_bringer.side, v_bringer.group_category, 'guest', 'pending', TRUE,
    p_bringer_guest_id, v_bringer.plus_one_mode,
    COALESCE((p_seat->>'plus_one_name_confirmed_at')::TIMESTAMPTZ, now()),
    (p_seat->>'meal_preference')::public.meal_preference,
    p_seat->>'dietary_restrictions'
  )
  RETURNING guest_id INTO v_new;

  RETURN jsonb_build_object('status', 'ok', 'guest_id', v_new, 'existing', false);
END;
$mint$;

COMMENT ON FUNCTION public.guest_plus_one_seat_mint(UUID, UUID, JSONB) IS
  'Mint one plus-one seat for a bringer, under an advisory lock on the bringer: the couple''s allowance is re-read inside the lock, a live seat with the same name is returned instead of a second one, and a bringer at their allowance gets status=full. service_role only (the RSVP server action).';

REVOKE ALL ON FUNCTION public.guest_plus_one_seat_mint(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_plus_one_seat_mint(UUID, UUID, JSONB) TO service_role;
