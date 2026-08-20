-- ============================================================================
-- A chapter knows when it happened
-- ============================================================================
-- Owner, 2026-08-20: *"we want the chapters to make sense. just like in a book.
-- or in an adventure novel of a person. chapters are defined not just per
-- celebration. for tv shows. season is annual and episode is everything that
-- happened for that season."*
--
-- THE SHAPE THAT ANSWERS THAT: the YEAR is the season, and a CHAPTER is the
-- episode — one thing that happened, numbered inside its year. A chapter is
-- therefore NOT one-per-celebration: a trip, a move, an ordinary Tuesday worth
-- keeping are all chapters, and the product already allowed them ("Not about
-- one of my celebrations" has shipped in the composer since the picker landed).
--
-- 🔴 WHAT THE MODEL WAS MISSING. A chapter about no celebration had NO DAY OF
-- ITS OWN — the only date on the row is `published_at`. So somebody writing up
-- their 2019 engagement today filed it under 2026, in a chronicle whose whole
-- job is to be in life order. Worse, `published_at` is RE-STAMPED on republish
-- (app/dashboard/(account)/creator/actions.ts), so taking a chapter back to
-- draft and posting it again silently moved it to the end of their story — and,
-- once years are headings, into a different year.
--
-- `happened_on` is the answer to one question the composer now asks: **when did
-- this happen?** Resolution order, in lib/creator-chronicle.ts:
--     happened_on  →  the attached celebration's event_date  →  published_at
--
-- 🔑 A DATE, NOT A TIMESTAMP. A chapter happened on a DAY. Storing an instant
-- would reintroduce the 2026-08-04 bug family, where `2026-12-12` read as the
-- 11th for every reader west of Greenwich — on the save-the-date, the
-- invitation and 41 screens.
--
-- ⚖ NULLABLE, AND STAYS NULLABLE. A chapter with no day yet is a real state
-- (an unfinished draft about no celebration), and the chronicle prints it as
-- "not placed yet" rather than guessing a position in somebody's life.
--
-- 🔒 NOT BACKFILLED. Production holds one chapter, attached to no celebration;
-- writing today's date onto it would be inventing a fact about somebody's life.
-- The resolver already falls back to the publish date, which is what that
-- chapter has always been ordered by.
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.creator_chapters
  ADD COLUMN IF NOT EXISTS happened_on DATE;

COMMENT ON COLUMN public.creator_chapters.happened_on IS
  'The day this chapter is ABOUT, when the author told us. NULL is normal: for a chapter '
  'attached to a celebration the day comes from that celebration, and for one that is not '
  'yet posted there may be no day at all. Read FIRST by lib/creator-chronicle.chronicleDay '
  '(happened_on → the celebration''s event_date → published_at), which decides the year a '
  'chapter files under and its number inside that year. A DATE, never a timestamp: a '
  'chapter happened on a day, and an instant would read as the day before west of '
  'Greenwich. Owner 2026-08-20.';

-- The author's own list and the public timeline both order by the resolved day
-- within a person. Postgres cannot index the resolver (it spans two tables), so
-- this covers the common half: a person's chapters that carry their own day.
CREATE INDEX IF NOT EXISTS creator_chapters_user_happened_idx
  ON public.creator_chapters (user_id, happened_on DESC)
  WHERE happened_on IS NOT NULL;

-- A day in the future is not a memory. The composer says so first, in a
-- sentence; this is the backstop for a direct PostgREST write.
-- ⚠ `CURRENT_DATE` is evaluated per-row at write time, which is what makes this
-- legal in a CHECK: it constrains the value at the moment it is written, and a
-- stored row never becomes invalid as time passes (the date only moves further
-- into the past).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.creator_chapters'::regclass
       AND conname  = 'creator_chapters_happened_on_not_ahead'
  ) THEN
    ALTER TABLE public.creator_chapters
      ADD CONSTRAINT creator_chapters_happened_on_not_ahead
      -- +1 day of slack, deliberately: the server clocks UTC and the author is
      -- in Manila, eight hours ahead. Without it somebody writing up tonight's
      -- party at 9pm Manila would be told their own evening is in the future.
      CHECK (happened_on IS NULL OR happened_on <= (CURRENT_DATE + 1));
  END IF;
END
$$;

COMMENT ON CONSTRAINT creator_chapters_happened_on_not_ahead
  ON public.creator_chapters IS
  'A chapter records something that happened. One day of slack because the database runs '
  'in UTC and the people writing are eight hours ahead of it — without it, somebody '
  'writing up tonight''s party would be told their own evening had not happened yet.';

COMMIT;
