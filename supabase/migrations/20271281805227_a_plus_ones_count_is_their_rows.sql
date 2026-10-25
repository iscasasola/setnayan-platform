-- ═══════════════════════════════════════════════════════════════════════════
-- A GUEST'S +N IS THEIR +1 ROWS — the count and the rows can never disagree
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚖ Owner, verbatim, 2026-10-21 (desktop Guests): "why does Ronald Dane Llarena
-- have a +1 but no row under him" — then, on the missing rows: "fix it".
-- And 2026-09-21: "+ will have seats beside the person invited" — "+3" means
-- exactly three linked rows (`plus_one_of_guest_id`).
--
-- 🪤 WHAT WAS WRONG. The number (`plus_one_count`) and the rows were written by
-- two different steps: a writer saved the number, and the APP then minted the
-- "TBA" rows (`syncExtraSeats`, lib/extra-seats-sync.ts) — best-effort, its
-- result ignored by the card's save, the quick add and the import. And a number
-- set BEFORE rows existed (the 2026-09-21 backfill of `plus_one_allowed` into
-- `plus_one_count`, migration 20271238345933) never got rows at all: no writer
-- re-syncs a number that does not change. Measured in prod 2026-10-21 (read-only):
-- two cale-ice guests (Antonio Loo, Ronald Llarena) allowed +1 since 2026-09-14,
-- zero rows ever. The card said "Allowed, but no +1 added yet." and the List
-- "+1 not added yet" — a +1 the host could see and never reach.
--
-- ✅ THE FIX. The DATABASE follows the number, in ONE function under the SAME
-- lock as the reply's seat mint (`guest_plus_one_seat_mint`, 20271272305444 —
-- `pg_advisory_xact_lock` on 'guest_plus_one_seat:' || bringer), so a reply
-- naming a seat and a host changing the number queue behind each other:
--   · fewer live rows than the number → the missing "TBA" seats are minted, in
--     exactly the shape `syncExtraSeats` inserts (side, group, invitation of the
--     guest who brings them; "+N · TBA", numbered by seat; `plus_one_mode` limited);
--   · more live rows than the number → ONLY unnamed placeholders go, newest first,
--     their chair released — a NAMED +1 is never removed by a number (owner
--     2026-09-29: the host's number is never refused; the named stay, and the List
--     says "3 named · 1 allowed").
-- A trigger runs it whenever a guest's number is set (insert) or changes (update),
-- whichever writer did it — the card, the List, the quick add, a claim, the import,
-- the old on/off box (whose count `guests_plus_one_count_sync_trg` derives), or SQL.
-- A +1 has no number (`a_plus_one_brings_no_one`), so nothing is ever minted under one.
--
-- ✅ AND THE REPLY'S MINT NAMES A WAITING SEAT. With the rows always there, a name
-- the reply planned as a NEW seat (a stale plan, a second tab) finds the guest at
-- their number — it now names the oldest unnamed placeholder instead of being
-- dropped as `full`. `full` stays the answer when every seat already has a name.
--
-- The seats are SEATED by the app, as before (`syncExtraSeats` → the seat engine,
-- which puts them beside their guest); a seat the database minted waits unseated
-- until the next reconcile, exactly as a TBA row did.
--
-- Rows that ALREADY disagree are not touched here — that is the separate, named
-- backfill (20271282098748_backfill_missing_plus_one_seats_owner_ruled_2026_10_21.sql).

CREATE OR REPLACE FUNCTION public.guest_plus_one_seats_follow_count(p_bringer_guest_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $follow$
DECLARE
  v_b       RECORD;
  v_target  INTEGER;
  v_live    INTEGER;
  v_drop    UUID[];
  v_made    INTEGER := 0;
BEGIN
  IF p_bringer_guest_id IS NULL THEN
    RETURN jsonb_build_object('status', 'missing_input');
  END IF;

  -- The reply's seat mint takes this same lock: one bringer's seats change one writer at a time.
  PERFORM pg_advisory_xact_lock(hashtextextended('guest_plus_one_seat:' || p_bringer_guest_id::text, 0));

  SELECT guest_id, event_id, plus_one_count, plus_one_of_guest_id, side, group_category, invited_to_blocks, deleted_at
    INTO v_b
    FROM public.guests
   WHERE guest_id = p_bringer_guest_id;
  IF NOT FOUND OR v_b.deleted_at IS NOT NULL OR v_b.plus_one_of_guest_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'skipped');
  END IF;

  v_target := LEAST(4, GREATEST(0, COALESCE(v_b.plus_one_count, 0)));
  SELECT COUNT(*)::INTEGER INTO v_live
    FROM public.guests
   WHERE plus_one_of_guest_id = v_b.guest_id
     AND deleted_at IS NULL;

  IF v_live < v_target THEN
    INSERT INTO public.guests (
      event_id, first_name, last_name, display_name, side, group_category, role,
      rsvp_status, photo_consent, invited_to_blocks, plus_one_of_guest_id, plus_one_mode
    )
    SELECT v_b.event_id, 'TBA', '+1', '+' || (v_live + n) || ' · TBA', v_b.side, v_b.group_category, 'guest',
           'pending', TRUE, v_b.invited_to_blocks, v_b.guest_id, 'limited'
      FROM generate_series(1, v_target - v_live) AS n;
    v_made := v_target - v_live;
    RETURN jsonb_build_object('status', 'ok', 'created', v_made, 'removed', 0);
  END IF;

  IF v_live > v_target THEN
    SELECT COALESCE(array_agg(guest_id), ARRAY[]::UUID[]) INTO v_drop
      FROM (
        SELECT guest_id
          FROM public.guests
         WHERE plus_one_of_guest_id = v_b.guest_id
           AND deleted_at IS NULL
           AND plus_one_name_confirmed_at IS NULL
           AND upper(btrim(COALESCE(first_name, ''))) = 'TBA'
         ORDER BY created_at DESC, guest_id DESC
         LIMIT v_live - v_target
      ) AS placeholders;
    IF array_length(v_drop, 1) > 0 THEN
      -- Their chairs first, as a removal from the list does: a removed seat holding a chair is a ghost in the plan.
      DELETE FROM public.event_seat_assignments WHERE guest_id = ANY (v_drop);
      UPDATE public.guests SET deleted_at = now() WHERE guest_id = ANY (v_drop);
    END IF;
    RETURN jsonb_build_object('status', 'ok', 'created', 0, 'removed', COALESCE(array_length(v_drop, 1), 0));
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'created', 0, 'removed', 0);
END;
$follow$;

COMMENT ON FUNCTION public.guest_plus_one_seats_follow_count(UUID) IS
  'Make a guest''s live +1 rows match plus_one_count: mint the missing "TBA" seats, or remove ONLY unnamed placeholders (never a named +1), under the same advisory lock as guest_plus_one_seat_mint. Run by the a_plus_ones_count_is_their_rows triggers; service_role may call it (backfills).';

REVOKE ALL ON FUNCTION public.guest_plus_one_seats_follow_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_plus_one_seats_follow_count(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.a_plus_ones_count_is_their_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $trg$
BEGIN
  PERFORM public.guest_plus_one_seats_follow_count(NEW.guest_id);
  RETURN NULL;
END $trg$;

REVOKE EXECUTE ON FUNCTION public.a_plus_ones_count_is_their_rows() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_plus_ones_count_is_their_rows_ins ON public.guests;
CREATE TRIGGER a_plus_ones_count_is_their_rows_ins
  AFTER INSERT ON public.guests
  FOR EACH ROW
  WHEN (NEW.plus_one_count > 0 AND NEW.plus_one_of_guest_id IS NULL AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.a_plus_ones_count_is_their_rows();

DROP TRIGGER IF EXISTS a_plus_ones_count_is_their_rows_upd ON public.guests;
CREATE TRIGGER a_plus_ones_count_is_their_rows_upd
  AFTER UPDATE ON public.guests
  FOR EACH ROW
  WHEN (NEW.plus_one_count IS DISTINCT FROM OLD.plus_one_count AND NEW.plus_one_of_guest_id IS NULL AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.a_plus_ones_count_is_their_rows();

-- ── the reply's mint names a waiting seat instead of answering `full` ──────
-- Identical to 20271281624693's version except step 4: at the couple's number, the
-- oldest unnamed placeholder takes the name; `full` only when none is left.
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
  v_open    UUID;
  v_new     UUID;
BEGIN
  IF p_event_id IS NULL OR p_bringer_guest_id IS NULL OR v_first IS NULL OR v_last IS NULL THEN
    RETURN jsonb_build_object('status', 'missing_input');
  END IF;

  -- 1 · one bringer's seats are minted one at a time.
  PERFORM pg_advisory_xact_lock(hashtextextended('guest_plus_one_seat:' || p_bringer_guest_id::text, 0));

  -- 2 · the allowance, live.
  SELECT plus_one_allowed, plus_one_count, plus_one_mode, side, group_category, plus_one_of_guest_id
    INTO v_bringer
    FROM public.guests
   WHERE guest_id = p_bringer_guest_id
     AND event_id = p_event_id
     AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_bringer');
  END IF;

  -- 2a · a +1 brings nobody (owner 2026-10-21).
  IF v_bringer.plus_one_of_guest_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'bringer_is_plus_one');
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

  -- 4 · never past what the couple gave — at the number, a waiting seat takes the name.
  SELECT COUNT(*)::INTEGER INTO v_live
    FROM public.guests
   WHERE event_id = p_event_id
     AND plus_one_of_guest_id = p_bringer_guest_id
     AND deleted_at IS NULL;
  IF v_live >= v_allowed THEN
    SELECT guest_id INTO v_open
      FROM public.guests
     WHERE event_id = p_event_id
       AND plus_one_of_guest_id = p_bringer_guest_id
       AND deleted_at IS NULL
       AND plus_one_name_confirmed_at IS NULL
       AND upper(btrim(COALESCE(first_name, ''))) = 'TBA'
     ORDER BY created_at, guest_id
     LIMIT 1;
    IF v_allowed = 0 OR v_open IS NULL THEN
      RETURN jsonb_build_object('status', 'full', 'allowed', v_allowed, 'live', v_live);
    END IF;
    UPDATE public.guests
       SET first_name = v_first,
           last_name = v_last,
           name_prefix = p_seat->>'name_prefix',
           middle_name = p_seat->>'middle_name',
           name_suffix = p_seat->>'name_suffix',
           display_name = NULL,
           plus_one_name_confirmed_at = COALESCE((p_seat->>'plus_one_name_confirmed_at')::TIMESTAMPTZ, now()),
           meal_preference = COALESCE((p_seat->>'meal_preference')::public.meal_preference, meal_preference),
           dietary_restrictions = COALESCE(p_seat->>'dietary_restrictions', dietary_restrictions),
           updated_at = now()
     WHERE guest_id = v_open;
    RETURN jsonb_build_object('status', 'ok', 'guest_id', v_open, 'existing', false, 'named_placeholder', true);
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
  'Mint (or name) one plus-one seat for a bringer, under an advisory lock on the bringer shared with guest_plus_one_seats_follow_count: a +1 bringer gets status=bringer_is_plus_one; the allowance is re-read inside the lock; a live seat with the same name is returned; at the allowance the oldest unnamed placeholder takes the name, and status=full only when none is left. service_role only (the RSVP server action).';

REVOKE ALL ON FUNCTION public.guest_plus_one_seat_mint(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_plus_one_seat_mint(UUID, UUID, JSONB) TO service_role;
