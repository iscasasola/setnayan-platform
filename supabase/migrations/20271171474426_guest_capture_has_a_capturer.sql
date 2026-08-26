-- ============================================================================
-- A GUEST'S CAPTURE NOW RECORDS WHICH PERSON TOOK IT
-- ============================================================================
--
-- `papic_photos.captured_by_person_id` was given a writer on 2026-08-26
-- (20271170468759): a trigger derives the person from the seat's claimer, so
-- "each person's own folder" works for the cameras. `papic_guest_captures` — the
-- separate table a guest phone's captures live in, which nothing copies between
-- — had **no capturer column at all**, so that idea covered the cameras and not
-- the guests. This is the other half.
--
-- ── THE HANDOFF SAID THIS NEEDED SOMETHING THAT DOES NOT EXIST. IT DOES. ────
--
-- 🔑 `WHATS_NEXT_Papic_Meter_Ladder_And_Uploads_2026-08-26.md` § 2.2 says this
-- *"needs a guest-to-person resolution that does not exist yet."* Measured
-- against the live database rather than read: `guests.person_id` exists, and the
-- `set_guest_person` BEFORE INSERT OR UPDATE OF email trigger has been resolving
-- it from the guest's email address since 20270514555975. The resolution is
-- shipped. Nothing new had to be invented.
--
-- ⚠ AND IT IS EMPTY IN PRODUCTION, WHICH IS NOT THE SAME THING. All 40 guest
-- rows carry `person_id IS NULL`, because none of them was added with an email
-- that matches a `people` row. So this column will be NULL for every guest we
-- have today. **That is the resolver having nothing to resolve, not a gate with
-- no handle** — the writer exists, it runs on every insert, and it fills in the
-- moment a guest is added by an address the person spine already knows.
--
-- ── WHAT IS DERIVED, AND FROM WHAT ──────────────────────────────────────────
--
-- The seat version joins the seat's claimer to `people.claimed_by_user_id`. The
-- guest version is one hop shorter: the guest row already carries `person_id`.
-- Both answer the same question — *which person in the spine took this frame* —
-- and both answer NULL when the honest answer is "we do not know".
--
-- ⛔ THE VALUE IS DERIVED, NEVER ACCEPTED. Like its twin, this runs on INSERT
-- and on any UPDATE of the columns it depends on, so a value a caller names is
-- always replaced. That matters here and is not theoretical: `anon` and
-- `authenticated` hold UPDATE on this table at TABLE level, so the new column
-- arrives writable by a browser and the trigger is the only thing standing
-- between that and somebody's name on a photograph they did not take.
--
-- 🚨 AND THE GUEST LINK IS PINNED, FOR THE SAME REASON THE SEAT LINK IS. The
-- seat trigger's own comment records that deriving credit from the seat is only
-- as trustworthy as the seat, so it refuses to let a photo move between cameras.
-- A capture does not move between guests either, and nothing in the product does
-- it — so `guest_id` is pinned on UPDATE here. Pinning costs no feature and
-- removes the one input that could make an honest derivation produce a lie.
--
-- ── THE BACKFILL, AND WHAT IT IS WORTH ──────────────────────────────────────
--
-- ⚠ A BACKFILL IS A POINT-IN-TIME ACT. It is written because it is correct, not
-- because it covers anything: production holds **ZERO** `papic_guest_captures`
-- rows, so it will match nothing on the way in. The trigger is what provides
-- ongoing coverage. Never cite this statement as evidence that the column is
-- populated — query the column.
-- ============================================================================

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS captured_by_person_id UUID
    REFERENCES public.people(person_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.papic_guest_captures.captured_by_person_id IS
  'WHICH PERSON took this frame, derived by tg_stamp_guest_capturer_person from '
  'guests.person_id — never accepted from a caller. The twin of '
  'papic_photos.captured_by_person_id, which derives the same fact from the '
  'seat''s claimer. NULL is the honest answer for a guest whose email has never '
  'matched a person in the spine, which is every guest in production today.';

-- Partial: the rows worth grouping are the ones that carry a value, and the
-- "whose frames are these" read filters on exactly that. Mirrors the index the
-- seat column got.
CREATE INDEX IF NOT EXISTS papic_guest_captures_capturer_idx
  ON public.papic_guest_captures (captured_by_person_id)
  WHERE captured_by_person_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_stamp_guest_capturer_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  /*
    🪤 NO `current_user` GATE HERE, AND THAT IS DELIBERATE.

    Inside a SECURITY DEFINER function `current_user` is the function's OWNER,
    never the caller — so a gate written with it can never be true, and the pin
    below would never fire. `tg_stamp_capturer_person` next door shipped exactly
    that bug in its first cut: the forgery test moved the photo and the trigger
    watched. The pin is UNCONDITIONAL, which is the better rule anyway: a capture
    does not move between guests, not for a browser and not for us.
  */
  IF TG_OP = 'UPDATE' THEN
    IF NEW.guest_id IS DISTINCT FROM OLD.guest_id THEN
      NEW.guest_id := OLD.guest_id;
    END IF;
  END IF;

  -- The one hop. `guests.person_id` is resolved from the guest's email by the
  -- shipped `set_guest_person` trigger; a guest row is unique by guest_id, so
  -- this cannot fan out. SELECT INTO does not raise on zero rows, so a guest
  -- with no person leaves the column NULL — an absence, not a guess.
  SELECT g.person_id
    INTO NEW.captured_by_person_id
    FROM public.guests g
   WHERE g.guest_id = NEW.guest_id;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.tg_stamp_guest_capturer_person() IS
  'Derives papic_guest_captures.captured_by_person_id from guests.person_id on '
  'every INSERT and on any UPDATE of guest_id or the column itself, so a value a '
  'caller names is always replaced. Also pins guest_id on UPDATE: a capture does '
  'not move between guests, and an honest derivation from a forged input is '
  'still a lie.';

DROP TRIGGER IF EXISTS stamp_guest_capturer_person ON public.papic_guest_captures;
CREATE TRIGGER stamp_guest_capturer_person
  BEFORE INSERT OR UPDATE OF guest_id, captured_by_person_id
  ON public.papic_guest_captures
  FOR EACH ROW EXECUTE FUNCTION public.tg_stamp_guest_capturer_person();

-- ── THE BACKFILL (matches nothing today — see the header) ───────────────────
UPDATE public.papic_guest_captures gc
   SET captured_by_person_id = g.person_id
  FROM public.guests g
 WHERE g.guest_id = gc.guest_id
   AND g.person_id IS NOT NULL
   AND gc.captured_by_person_id IS DISTINCT FROM g.person_id;

-- ── REFUSE TO APPLY IF THE DERIVATION IS NOT ACTUALLY WIRED ─────────────────
-- A column with no writer is the shape this project keeps paying for: five gates
-- with no handle, and one that sat unread for seven weeks while the feature it
-- controlled was believed to be running. So this refuses to apply rather than
-- shipping a column and a hope.
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'papic_guest_captures'
       AND column_name = 'captured_by_person_id'
  ) THEN
    RAISE EXCEPTION 'refusing to apply: papic_guest_captures.captured_by_person_id was not added';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'papic_guest_captures'
       AND t.tgname = 'stamp_guest_capturer_person'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'refusing to apply: the stamp_guest_capturer_person trigger is absent — the column would have no writer';
  END IF;
END;
$guard$;
