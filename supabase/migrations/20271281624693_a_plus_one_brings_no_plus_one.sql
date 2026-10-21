-- ═══════════════════════════════════════════════════════════════════════════
-- A +1 BRINGS NO +1 — one level of plus-ones, held by the database
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚖ Owner, verbatim, 2026-10-21 (desktop Guests, the card of "Ms. pamela mitra
-- labriaga · +1 of Pam" open, its RSVP showing "Extra seats ▾ None"):
--     "a +1 of a guest cannot have their own +1."
--
-- A +1 is a `guests` row whose `plus_one_of_guest_id` names the guest who brings
-- them (apps/web/lib/guests.ts `isAPlusOne`). The card offered such a row the same
-- "Extra seats" pick as any guest, and every writer of the number would take it:
-- the card's save, the List's inline number, the import, a claim — and then
-- `syncExtraSeats` minted "+1 · TBA" rows UNDER the +1, and their reply's name
-- boxes minted named ones through `guest_plus_one_seat_mint`. The app now refuses
-- all of those; this makes the rule the database's own, so no writer — present or
-- future, app or SQL — can give a +1 a +1.
--
--   1 · CHECK `a_plus_one_brings_no_one` — a +1 row's own number is 0 and its
--       on/off is off. (`guests_plus_one_count_sync_trg` keeps the two equal, so
--       the pair is one fact; both are named so neither can drift alone.)
--   2 · TRIGGER `a_plus_one_has_no_plus_one` — a row may only point at a bringer
--       who is NOT a +1, and a guest who already brings +1 rows cannot become a
--       +1 themselves. That is the cross-row half a CHECK cannot see.
--   3 · `guest_plus_one_seat_mint` answers `bringer_is_plus_one` (asked inside
--       its lock, before the allowance) instead of minting.
--
-- 📏 MEASURED BEFORE WRITING (prod, read-only, 2026-10-21): 38 +1 rows (35 live),
--    0 of them with a nonzero `plus_one_count` or `plus_one_allowed`, 0 with a +1
--    of their own. So nothing is changed by this migration and the CHECK is added
--    VALIDATED. ⚠ Should a violating row appear before this applies, the CHECK is
--    added NOT VALID instead (new writes are still held) and the rows are LEFT
--    ALONE — changing a couple's guest list is the owner's call, not a
--    migration's. The NOTICE names how many.

-- ── 1 · the row's own number ───────────────────────────────────────────────
DO $chk$
DECLARE
  v_bad INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.guests'::regclass AND conname = 'a_plus_one_brings_no_one'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_bad
    FROM public.guests
   WHERE plus_one_of_guest_id IS NOT NULL
     AND (plus_one_count <> 0 OR plus_one_allowed);

  IF v_bad = 0 THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT a_plus_one_brings_no_one
      CHECK (plus_one_of_guest_id IS NULL OR (plus_one_count = 0 AND NOT plus_one_allowed));
  ELSE
    RAISE NOTICE 'a_plus_one_brings_no_one: % +1 row(s) already carry extra seats — added NOT VALID, rows left as they are', v_bad;
    ALTER TABLE public.guests
      ADD CONSTRAINT a_plus_one_brings_no_one
      CHECK (plus_one_of_guest_id IS NULL OR (plus_one_count = 0 AND NOT plus_one_allowed)) NOT VALID;
  END IF;
END $chk$;

COMMENT ON CONSTRAINT a_plus_one_brings_no_one ON public.guests IS
  'Owner 2026-10-21: "a +1 of a guest cannot have their own +1." A row with plus_one_of_guest_id set brings nobody: plus_one_count = 0 and plus_one_allowed = false.';

-- ── 2 · the bringer is never a +1 ──────────────────────────────────────────
-- SECURITY DEFINER: the rule must hold whatever the writer may read under RLS (the
-- reply writes as service_role, the host as authenticated) — it only ever reads
-- `plus_one_of_guest_id` of the rows involved, and returns nothing but the row.
CREATE OR REPLACE FUNCTION public.a_plus_one_has_no_plus_one()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.plus_one_of_guest_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.plus_one_of_guest_id = NEW.guest_id THEN
    RAISE EXCEPTION 'A +1 can''t bring their own +1.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.guests
     WHERE guest_id = NEW.plus_one_of_guest_id
       AND plus_one_of_guest_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A +1 can''t bring their own +1.' USING ERRCODE = 'check_violation';
  END IF;
  -- A guest who already brings +1 rows (live or removed — a removed one can be
  -- restored) cannot become somebody's +1.
  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1 FROM public.guests
     WHERE plus_one_of_guest_id = NEW.guest_id
  ) THEN
    RAISE EXCEPTION 'A +1 can''t bring their own +1.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS a_plus_one_has_no_plus_one ON public.guests;
CREATE TRIGGER a_plus_one_has_no_plus_one
  BEFORE INSERT OR UPDATE OF plus_one_of_guest_id ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.a_plus_one_has_no_plus_one();

-- A trigger function is not an API: nobody calls it directly.
REVOKE EXECUTE ON FUNCTION public.a_plus_one_has_no_plus_one() FROM PUBLIC, anon, authenticated;

-- ── 3 · the seat mint refuses a +1 bringer ────────────────────────────────
-- Identical to 20271272305444 except the bringer read carries
-- `plus_one_of_guest_id`, and a +1 bringer answers `bringer_is_plus_one`.
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
  'Mint one plus-one seat for a bringer, under an advisory lock on the bringer: a bringer who is itself a +1 gets status=bringer_is_plus_one, the couple''s allowance is re-read inside the lock, a live seat with the same name is returned instead of a second one, and a bringer at their allowance gets status=full. service_role only (the RSVP server action).';

REVOKE ALL ON FUNCTION public.guest_plus_one_seat_mint(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_plus_one_seat_mint(UUID, UUID, JSONB) TO service_role;
