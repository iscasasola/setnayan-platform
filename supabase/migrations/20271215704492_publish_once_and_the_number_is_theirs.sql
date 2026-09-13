-- publish_once_and_the_number_is_theirs
--
-- 08 step 1.6 · design `02` §8 · `03` §2.4 + §2.8 — the publish ladder.
--
-- Four things land on `event_editorial`, all of them about the ONE moment a
-- story stops being the host's and becomes somebody else's to read.
--
-- ═══ 1 · THE EDITION NUMBER WAS RECOMPUTED AT EVERY RENDER ═══════════════════
-- `app/[slug]/_components/editorial/data.ts` counted the weddings in the awards
-- cycle up to this event's date ON EVERY LOAD. So the number printed under the
-- words "theirs forever" moved whenever somebody ELSE's wedding landed in the
-- same cycle with an earlier date — a couple published as No. 4 and came back
-- to No. 5, and a keepsake printed on either day disagreed with the page.
--
-- `edition_volume` + `edition_no` are written ONCE, on the FIRST transition of
-- `status` to 'published'.
--
-- ⚠ NOT ON `published_at`. That column is stamped the first time the story stops
-- being private, which is the first GUESTS-ONLY share — deliberately so; it is
-- the "when did this stop being private" date. A story that sits at guests-only
-- for a month carries no edition number at all and its masthead reads "Vol. I"
-- alone, which is the truth.
--
-- 🔒 AND THE APP BEING RIGHT IS NOT THE SAME AS THE NUMBER BEING SAFE.
-- `authenticated` holds TABLE-LEVEL UPDATE on this table (read out of
-- production, not assumed — `role_table_grants`, all three roles table-level,
-- so these new columns are covered by the existing grants and need none of
-- their own), and `event_editorial_couple_rw` admits the host. Without the
-- trigger below a host could PATCH their own edition number through PostgREST
-- and never touch the server action. "Stamped once and never moves" is
-- therefore enforced in the DATABASE, and the trigger refuses everybody —
-- service_role included. There is no legitimate caller.
--
-- ⚠ IT COUNTS WEDDINGS, AND THAT IS OWNER QUESTION Q5, STILL OPEN. For a debut,
-- "No. 7" means the seventh WEDDING. Left filtering weddings on purpose, with
-- the reason recorded in WEDDING_ONLY_BY_DESIGN (lib/editorial-event-types.test.ts)
-- — a filter not to flip quietly.
--
-- ═══ 2 · THE ROOM WAS READ LIVE, AND IT IS A WORKING DOCUMENT ════════════════
-- `03` §2.8, verified against production: `event_tables` and
-- `event_seat_assignments` carry NO soft-delete column — 0 of `deleted_at` /
-- `archived_at` / `soft_deleted_at` on either — so every table removal is a HARD
-- delete, and the seat arranger wipes and re-solves assignments on every run.
-- A host who tidies up after the wedding, re-runs the seating, or reuses the
-- room for the next celebration SILENTLY REDRAWS OR EMPTIES the floor plan of a
-- story that was already published. Nobody is told.
--
-- `room_snapshot` freezes the labels, the positions and the shapes at publish;
-- `loadStoryRoom` prefers it over the live plan from then on. It is the house
-- pattern already (`moodboard_part_finalizations.design_snapshot`,
-- `event_renders.design_snapshot`; ⚠ `03` §1 cites `event_moodboard_saves.
-- palette_snapshot` as the precedent and THAT TABLE DOES NOT EXIST).
--
-- 🔒 THE SNAPSHOT CANNOT CARRY A PERSON, and not because it is filtered: it
-- stores a `StoryRoom`, whose entire field list is a label, two percentages and
-- a shape. There is nowhere in that shape to put a name.
--
-- ⛔ THE HEAT IS DELIBERATELY NOT FROZEN. How many photographs came from each
-- table is drawn from captures and rides the RA 10173 consent veto; a guest who
-- withdraws AFTER publish must still come off the plan. Freezing the heat would
-- freeze a withdrawal out.
--
-- ═══ 3 · THE CONSENT TICK IS A RECORD, NOT A CHECKBOX ════════════════════════
-- `publish_consent_at` stores WHEN the host agreed to
--   "I want this story to be public, and I understand it will carry our names,
--    our photos, and the words our guests agreed to share."
-- RA 10173 consent that exists only as client state is not evidence of
-- anything. The server refuses a move to 'published' without it, so the record
-- and the permission are the same fact rather than two that can disagree.
--
-- 🔑 IT IS NOT CLEARED WHEN THE HOST GOES BACK TO GUESTS-ONLY. They did agree,
-- on that date; taking the story back does not un-happen it, and re-ticking a
-- box they already ticked to restore what they had is a punishment for using a
-- control the consent copy itself promises them.
--
-- ═══ 4 · THE EXPOSURE SURFACE WIDENS BY EXACTLY FOUR LINES ═══════════════════
-- Regenerated in this PR. The diff is **4 added `col` lines and their two
-- counters (6593→6597, col 4844→4848) and nothing else** — which is the check
-- that matters, because regenerating a baseline can otherwise record a real
-- mistake as intended. All four read `anon=- authenticated=SIU`: **a stranger
-- cannot reach any of them.**
--
-- ⛔ THE `authenticated` UPDATE ON THE TWO EDITION COLUMNS IS NOT NARROWED HERE,
-- AND THAT IS A DELIBERATE REFUSAL. Doing so would mean revoking UPDATE at TABLE
-- level (the only thing that drops column grants) and re-granting it on all 19
-- columns of a shipped write path — a real blast radius, on the same reasoning
-- the desk's migration (20271214724787) gave for leaving
-- `editorial_vendor_media`'s 14 grants alone. The trigger above is the
-- enforcement, it refuses every caller, and `the-number-is-stamped-once.db.test.ts`
-- attacks it with a plain UPDATE and no application code.

-- ═══ 5 · SAFE BY ARITHMETIC, READ OUT OF PRODUCTION 2026-09-09 ═══════════════
-- 7 `event_editorial` rows: 6 draft, 1 published (`movie-night`, a `date`).
-- The one published row is BACKFILLED below with exactly the number the page
-- renders today, so nothing anybody can see changes — it simply stops moving.
-- Every other row is a draft and will be stamped when its host publishes.

-- ─── 1 · The columns ────────────────────────────────────────────────────────
-- One ALTER per column, deliberately: the exposure-baseline guard reads the
-- FIRST added column of a multi-column ALTER and is blind to the rest.

ALTER TABLE public.event_editorial
  ADD COLUMN IF NOT EXISTS edition_volume INTEGER;

ALTER TABLE public.event_editorial
  ADD COLUMN IF NOT EXISTS edition_no INTEGER;

ALTER TABLE public.event_editorial
  ADD COLUMN IF NOT EXISTS room_snapshot JSONB;

ALTER TABLE public.event_editorial
  ADD COLUMN IF NOT EXISTS publish_consent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_editorial.edition_volume IS
  'The awards-cycle Volume, STAMPED ONCE on the first transition of status to '
  '''published'' and never moved again (trigger '
  'event_editorial_edition_stamped_once). Frozen rather than derived so a host '
  'who later corrects their event date cannot move a published edition. NULL '
  'until published — the masthead then reads "Vol. I" from the date alone.';

COMMENT ON COLUMN public.event_editorial.edition_no IS
  'This celebration''s place in its awards cycle, STAMPED ONCE at publish. Was '
  'recomputed on EVERY render, so the number printed under "theirs forever" '
  'moved when another wedding landed in the same cycle with an earlier date. '
  '⚠ It counts WEDDINGS — what it should count for a debut is owner question '
  'Q5, open. NULL means the story has never been published, or the count was '
  'refused: a story with no number reads "Vol. I" and is honest, where a story '
  'stamped No. 1 because a query failed would be a lie nothing can correct.';

COMMENT ON COLUMN public.event_editorial.room_snapshot IS
  'The floor plan AS IT STOOD when the story was published — {v:1, room:{...}} '
  'holding labels, positions and shapes only. event_tables and '
  'event_seat_assignments have no soft delete and the seat arranger re-solves '
  'on every run, so reading the plan live let a published story silently redraw '
  'itself. Cannot carry a person: the stored shape has no field for one. The '
  'per-table photo HEAT is deliberately NOT frozen — it rides the consent veto '
  'and a withdrawal after publish must still come off the plan.';

COMMENT ON COLUMN public.event_editorial.publish_consent_at IS
  'When the host ticked "I want this story to be public, and I understand it '
  'will carry our names, our photos, and the words our guests agreed to share." '
  'RA 10173 record. The server refuses a move to ''published'' without it. NOT '
  'cleared when the host goes back to guests-only — they did agree on that '
  'date, and the consent copy itself promises they may go back whenever.';

-- ─── 2 · The number never moves ─────────────────────────────────────────────
-- Refuses ANY change to a stamped edition, from any caller. There is no
-- legitimate one: the stamp is written in the same UPDATE that first sets
-- status='published', when both columns are still NULL.

CREATE OR REPLACE FUNCTION public.event_editorial_edition_stamped_once()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.edition_no IS NOT NULL AND NEW.edition_no IS DISTINCT FROM OLD.edition_no THEN
    RAISE EXCEPTION
      'event_editorial.edition_no is stamped once and never moves (event %: % -> %)',
      OLD.event_id, OLD.edition_no, NEW.edition_no
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.edition_volume IS NOT NULL
     AND NEW.edition_volume IS DISTINCT FROM OLD.edition_volume THEN
    RAISE EXCEPTION
      'event_editorial.edition_volume is stamped once and never moves (event %: % -> %)',
      OLD.event_id, OLD.edition_volume, NEW.edition_volume
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.event_editorial_edition_stamped_once() IS
  'Refuses any change to a stamped edition_no / edition_volume, for every '
  'caller including service_role. "No. 1, theirs forever" is a promise printed '
  'on a keepsake; a host holds table-level UPDATE on this table through '
  'event_editorial_couple_rw and could otherwise PATCH it straight through '
  'PostgREST without the server action ever running.';

DROP TRIGGER IF EXISTS event_editorial_edition_stamped_once
  ON public.event_editorial;

CREATE TRIGGER event_editorial_edition_stamped_once
  BEFORE UPDATE ON public.event_editorial
  FOR EACH ROW
  EXECUTE FUNCTION public.event_editorial_edition_stamped_once();

-- ─── 3 · Backfill the already-published rows ────────────────────────────────
-- Exactly the arithmetic the render does today (lib/story-edition.ts
-- `editionCycleStart` + `countEditionNo`), so nothing anybody can see changes.
-- Volume = cycle-start year - 2025, clamped to ≥ 1.
--
-- ⚠ A ROW WHOSE COUNT COMES BACK 0 IS LEFT UNSTAMPED, not stamped 1. Today's
-- render already shows "Vol. I" alone in that case (`mastheadEdition` needs a
-- non-null number), so leaving it NULL preserves what the page says. Stamping a
-- guess would be permanent.

WITH cycle AS (
  SELECT
    ee.event_id,
    e.event_date,
    make_date(
      CASE
        WHEN (EXTRACT(MONTH FROM e.event_date) > 11)
          OR (EXTRACT(MONTH FROM e.event_date) = 11 AND EXTRACT(DAY FROM e.event_date) >= 18)
        THEN EXTRACT(YEAR FROM e.event_date)::int
        ELSE EXTRACT(YEAR FROM e.event_date)::int - 1
      END, 11, 18) AS cycle_start
  FROM public.event_editorial ee
  JOIN public.events e USING (event_id)
  WHERE ee.status = 'published'
    AND ee.edition_no IS NULL
    AND e.event_date IS NOT NULL
), counted AS (
  SELECT
    c.event_id,
    GREATEST(1, EXTRACT(YEAR FROM c.cycle_start)::int - 2025) AS vol,
    (SELECT COUNT(*)
       FROM public.events w
      WHERE w.event_type = 'wedding'
        AND w.event_date >= c.cycle_start
        AND w.event_date <= c.event_date) AS no
  FROM cycle c
)
UPDATE public.event_editorial ee
   SET edition_volume = counted.vol,
       edition_no     = counted.no
  FROM counted
 WHERE ee.event_id = counted.event_id
   AND counted.no > 0;
