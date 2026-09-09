-- A WITHDRAWAL REACHES EVERY COPY — `04` §3 · `07` Q6 (owner-ruled 2026-09-09) · 08 step 4.1.
--
-- Two schema facts, both small, both load-bearing for S14.
--
-- ── 1. THE FOURTH PUBLISH STATE: 'taken_back' ───────────────────────────────
-- The ladder ships three rungs (`lib/who-can-see-your-story.ts`): draft · event
-- · published, and the CHECK below is what makes them the only three. The design
-- (`02` §8, `01` §2's viewer table) adds a fourth for a story that WAS public and
-- has been pulled back:
--
--     Taken back  →  host: the Story Maker.  guest: the fallback.  stranger: the fallback.
--
-- ⚠ IT IS NOT A SYNONYM FOR 'draft', AND THE DIFFERENCE IS THE POINT. Read-wise
-- the two are identical — only the host gets in — so a reader that has not learnt
-- the new word is already safe (`storyAudienceOf` fails an unknown status closed
-- to 'draft', and every shipped read path that asks `status = 'published'`
-- refuses it without being edited). What 'taken_back' adds is the RECORD that a
-- published story was withdrawn, which is exactly the fact the host needs to see
-- on the ladder and the fact a guest exercising RA 10173 is owed.
--
-- 🔑 THE EDITION NUMBER SURVIVES IT. `event_editorial_edition_stamped_once`
-- already refuses to move `edition_no` / `edition_volume` once set, and
-- `story/actions.ts` only stamps when `edition_no IS NULL`. So published →
-- taken_back → published keeps the number the host was given. Nothing here
-- changes that; it is recorded because the round trip is now reachable.
--
-- ── 2. `story_version_at` — WHAT A PRINTED COPY CAN SAY ─────────────────────
-- 🔑 SAY WHAT THE STAMP CANNOT DO. Paper cannot be recalled. A copy printed
-- BEFORE this ships carries no stamp and can never know anything; a copy printed
-- after it carries the moment it was true, so a reader can CHECK the living page
-- against it. The stamp does not reach into a printed page and no copy anywhere
-- may imply that it does.
--
-- ⚠ A TIMESTAMP, NOT A COUNTER, AND THAT IS DELIBERATE. A counter needs
-- read-modify-write (`version = version + 1`), which races: two guests
-- withdrawing in the same second would leave one bump lost, and a version that
-- silently fails to move is worse than no version at all. `now()` is a blind
-- write — last writer wins, and the last writer IS the newest change, which is
-- the value the stamp is supposed to carry. It also reads better on paper: "as
-- it stood at 2:32 pm on 9 September" is something a person can act on, and an
-- opaque integer is not.
--
-- Backfilled from `updated_at` so every story that already exists has an honest
-- stamp from the first print, rather than a blank the print sheet would have to
-- explain away.
--
-- GRANTS: none needed, and that was measured rather than assumed —
-- `event_editorial` holds TABLE-LEVEL grants (pg_class.relacl carries
-- `authenticated=arwdDxtm`, and 0 of its columns have an ACL of their own), so a
-- new column inherits them. This is the OPPOSITE of `public.events`, whose 205
-- columns are granted individually and where omitting the per-column GRANT makes
-- PostgREST refuse every query against the table.

-- ---------------------------------------------------------------------------
-- 1. The fourth state.
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_editorial
  DROP CONSTRAINT IF EXISTS event_editorial_status_check;

ALTER TABLE public.event_editorial
  ADD CONSTRAINT event_editorial_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'event'::text, 'published'::text, 'taken_back'::text]));

COMMENT ON COLUMN public.event_editorial.status IS
  'Who may read this story: draft = the host only · event = the people of this celebration · published = anyone with the link · taken_back = the host only, after it had been published (the fourth rung, `07` Q6, ruled 2026-09-09). An unrecognised value is read as ''draft'' by the app and fails closed.';

-- ---------------------------------------------------------------------------
-- 2. The version stamp.
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_editorial
  ADD COLUMN IF NOT EXISTS story_version_at timestamptz;

UPDATE public.event_editorial
   SET story_version_at = COALESCE(updated_at, created_at, now())
 WHERE story_version_at IS NULL;

ALTER TABLE public.event_editorial
  ALTER COLUMN story_version_at SET DEFAULT now();

COMMENT ON COLUMN public.event_editorial.story_version_at IS
  'The moment this story last changed in a way a READER would care about - a guest withdrawing or restoring their consent, a name coming off, the host moving the ladder. Printed on the keepsake so a person holding paper can tell whether it is still current, and used to version the Open Graph card URL (its Cache-Control cannot be revalidated, so the URL has to change). Written by lib/a-withdrawal-reaches-every-copy.server.ts. NOT a counter: `now()` is race-free where `version + 1` is not.';
