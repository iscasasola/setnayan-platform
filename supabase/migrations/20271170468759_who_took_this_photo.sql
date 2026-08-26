-- ============================================================================
-- WHO TOOK THIS PHOTO — the column has never held a value, in production, ever
-- ============================================================================
--
-- `papic_photos.captured_by_person_id` was added on 2026-05-23 to power the
-- Life Story perspective-shift, and it is what "each person's own folder" would
-- have to key on. Its own comment states the rule precisely:
--
--     resolved from paparazzi_seats.claimer_user_id → people.claimed_by_user_id
--
-- 🚨 MEASURED IN PRODUCTION 2026-08-26, NOT INFERRED FROM A GREP: 14 photos ·
-- 14 of them carry a seat · 14 of them have a claimer whose person row exists
-- and is resolvable RIGHT NOW · and **0 of them carry the value**. Not "no
-- ongoing writer" — the column has never held a value at all. The one-time
-- backfill in 20270523457332 matched nothing, because every photo in prod was
-- taken after it ran, and nothing has written the column since.
--
-- 🔑 SO THIS IS A GATE WITH NO HANDLE, AND IT IS THE SIXTH. A column, an index
-- over it, a reader in lib/life-story-moment-graph.ts that groups a person's
-- own-event frames by capturer — and no writer, so the read has been grouping
-- an empty set for three months and looked exactly like a feature nobody uses.
--
-- ── WHY A TRIGGER AND NOT AN APP-SIDE STAMP ─────────────────────────────────
--
-- The value is DERIVED. It is not a decision anybody makes; it is a join the
-- seat already answers. Three consequences follow:
--
-- 1. **Enumerate by the column, not by the remembered list of writers.** There
--    are two capture paths today (recordSeatCapture and papic_record_guest_
--    capture) and this project has been bitten repeatedly by fixing the paths
--    somebody remembered. A trigger covers every path that exists and every
--    path added later, including one written by somebody who never reads this.
--
-- 2. **It cannot drift from the backfill.** The join below is the same join
--    20270523457332 used. Written in the app it would be a second copy of a
--    rule, and two copies of a rule always drift.
--
-- 3. **It costs nothing on the hot path.** Resolving this in JavaScript is one
--    extra round trip per capture, at a stated peak of 1–250 captures/second.
--    Here it is an index lookup inside a transaction that is already open.
--
-- ── IT DERIVES, IT DOES NOT DEFER TO THE CALLER ─────────────────────────────
--
-- The trigger overwrites whatever was supplied rather than filling only NULLs.
-- A supplied value is either identical (redundant) or different (wrong — the
-- photo did not come from a different person's camera), and `authenticated`
-- holds UPDATE on this column, so "fill if null" would leave it forgeable.
-- Same reasoning as `tg_pin_vendor_capture_verdict` on the sibling table.
--
-- ⚠ NO `current_user` GATE, and that is deliberate — it is the opposite choice
-- from the verdict pin next door, for a reason worth stating. That trigger
-- protects a decision, so it must let the service role make it. This one
-- reproduces a join, and the honest capture path writes with the SERVICE ROLE:
-- gating on `current_user NOT IN ('authenticated','anon')` would skip the only
-- writer this exists for and ship the bug it fixes.
--
-- ⚠ WHAT IT LEGITIMATELY LEAVES NULL, so nobody reads NULL as a fault:
--   · a photo with no seat (guest captures come in by guest_id)
--   · a seat nobody has claimed
--   · a claimer with no `people` row
-- The column's own comment already says "nullable for unclaimed/ephemeral
-- seats". Those are absences, not failures.
--
-- ⚠ AND ONE ACCURACY LIMIT, NAMED RATHER THAN HIDDEN: the Uploads camera is
-- claimed by ONE host, so a co-host adding photos through it is credited to
-- the claimer. The column means "whose camera shot this frame", which is what
-- the seat answers — if per-uploader credit is wanted, that is a different
-- fact and needs its own column, not a redefinition of this one.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_stamp_capturer_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- The one join, identical to the 20270523457332 backfill's.
  -- people.claimed_by_user_id is UNIQUE (one account claims at most one
  -- person) and paparazzi_seats.claimer_user_id references auth.users(id) —
  -- the same id space — so this is one-to-one and cannot fan out.
  SELECT pe.person_id
    INTO NEW.captured_by_person_id
    FROM public.paparazzi_seats s
    JOIN public.people pe
      ON pe.claimed_by_user_id = s.claimer_user_id
   WHERE s.seat_id = NEW.paparazzi_seat_id
     AND s.claimer_user_id IS NOT NULL;

  -- No row found leaves NEW.captured_by_person_id NULL, which is the correct
  -- answer for a photo with no seat, an unclaimed seat, or a claimer with no
  -- person row. SELECT INTO does not raise on zero rows.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_stamp_capturer_person() IS
  'Derives papic_photos.captured_by_person_id from the seat''s claimer on every '
  'INSERT and UPDATE. The column had ZERO writers and ZERO non-null rows in '
  'production for three months while a reader grouped by it. Derived, never '
  'supplied: a caller-named value is redundant at best and a forgery at worst, '
  'and `authenticated` holds UPDATE on the column. Deliberately NOT gated on '
  'current_user — unlike tg_pin_vendor_capture_verdict, which protects a '
  'decision the service role must be able to make, this reproduces a join, and '
  'the honest capture path writes AS the service role.';

DROP TRIGGER IF EXISTS stamp_capturer_person ON public.papic_photos;
CREATE TRIGGER stamp_capturer_person
  BEFORE INSERT OR UPDATE OF paparazzi_seat_id, captured_by_person_id
  ON public.papic_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_stamp_capturer_person();

-- ── Re-backfill ─────────────────────────────────────────────────────────────
-- ⚠ THE 2026-05-23 BACKFILL IS NOT STILL DOING ITS JOB — a backfill is a
-- point-in-time act, and every photo in production was taken after it ran. All
-- 14 are derivable and all 14 are NULL. This one is scoped identically and is
-- idempotent, so running it again on a database where the trigger has been
-- doing the work changes nothing.
--
-- ⚠ It is written as a plain UPDATE and the trigger fires on it, deriving the
-- same value the UPDATE computes. That is not a conflict — both sides read the
-- same join off the same seat. The SET is kept anyway so this statement still
-- says what it does on a database where the trigger is absent.
UPDATE public.papic_photos AS ph
SET captured_by_person_id = pe.person_id
FROM public.paparazzi_seats AS s
JOIN public.people AS pe
  ON pe.claimed_by_user_id = s.claimer_user_id
WHERE ph.paparazzi_seat_id = s.seat_id
  AND s.claimer_user_id IS NOT NULL
  AND ph.captured_by_person_id IS NULL;
