-- THE STORY COVER'S PAIRING RULE — the CHECK S4 deliberately deferred to S7.
--
-- Step 1.5 of the by-the-minute story build
-- (Design_Editorial_By_The_Minute_2026-09-07, 02 section 6, 08 step 1.5).
--
-- S4 (20271214335885) added story_cover_kind + story_cover_ref and said so in
-- the column's own comment, verbatim: "Deliberately NOT constrained against
-- story_cover_kind here — the cover screen that writes the pair will add that
-- CHECK once its shapes are fixed, and a pairing rule guessed now is a rule S7
-- would have to loosen. Not forgotten." The shapes are now fixed. This is it.
--
-- ── THE RULE ────────────────────────────────────────────────────────────────
--   NULL          → no cover was ever chosen. Every surface renders exactly as
--                   it did before covers existed: the living-hero ladder.
--   hero          → the living hero, chosen deliberately. No pointer needed —
--   monogram        the column and the couple's own mark are already on `events`.
--   capture       → papic_photos.photo_id
--   vendor_frame  → editorial_vendor_media.media_id
--   upload        → an R2 object key
--
-- ⚠ THE POINTER IS AN ID WHEREVER ONE EXISTS, NOT A BAKED OBJECT KEY, and that
-- is a correction to S4's own comment (which said "the supplier frame's key").
-- A capture can be vetoed by a guest, reclassified by the screen or hidden by
-- the host tomorrow; a supplier's frame can be withdrawn, or its supplier
-- dropped as the recommended pick. Storing the KEY would freeze a permission
-- that is not frozen, and the cover is the most-shared surface the product has.
-- Storing the ID lets lib/story-cover.ts re-ask every one of those questions at
-- read time and simply fall back to the living hero when the answer has changed.
-- Only `upload` stores a key: it has no row, and no consent of its own to
-- withdraw.
--
-- ── WHAT WAS MEASURED, NOT ASSUMED ──────────────────────────────────────────
-- Against PROD (njrupjnvkjkitfctetvi), 2026-09-09, before writing this:
--   · both columns exist, are nullable TEXT, and `authenticated` may SELECT
--     both (has_column_privilege = true for each) — so nothing here needs a
--     GRANT and events_host does not need rebuilding: no column is added.
--   · events_story_cover_kind_check is present (1 row in pg_constraint).
--   · 7 events rows exist and 0 of them carry story_cover_kind OR
--     story_cover_ref. **So this constraint cannot fail to validate on the way
--     in** — checked rather than hoped, because an ADD CONSTRAINT that fails
--     validation aborts the whole deploy, and the guidance to write
--     `NOT VALID` instead would have quietly left the rule unenforced for
--     exactly the rows it was written for.

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_story_cover_pairing_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_story_cover_pairing_check
  CHECK (
    (story_cover_kind IS NULL AND story_cover_ref IS NULL)
    OR (story_cover_kind IN ('hero', 'monogram') AND story_cover_ref IS NULL)
    OR (story_cover_kind IN ('capture', 'vendor_frame', 'upload') AND story_cover_ref IS NOT NULL)
  );

COMMENT ON COLUMN public.events.story_cover_ref IS
  'Where the chosen cover lives, PAIRED WITH story_cover_kind by '
  'events_story_cover_pairing_check: a papic_photos.photo_id for ''capture'', an '
  'editorial_vendor_media.media_id for ''vendor_frame'', an R2 object key for '
  '''upload''. NULL for ''hero'' and ''monogram'', which need no pointer, and NULL '
  'whenever the kind is NULL. An ID rather than a baked key on purpose: a capture '
  'can be vetoed and a supplier frame withdrawn AFTER the host chooses, so '
  'lib/story-cover.ts re-checks the pointer on every read and falls back to the '
  'living hero when it no longer qualifies.';

-- ── PROVE IT, rather than assume the statement above did what it says ───────
DO $$
BEGIN
  -- The constraint exists AND is VALIDATED. A convalidated=false constraint
  -- admits every row that already exists, which for a rule written to keep
  -- unrenderable pairs out is the same as not having written it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'events_story_cover_pairing_check'
       AND conrelid = 'public.events'::regclass
       AND convalidated
  ) THEN
    RAISE EXCEPTION 'events_story_cover_pairing_check is missing or was left NOT VALID';
  END IF;
END $$;

-- ⚠ THAT A CHECK EXISTS SAYS NOTHING ABOUT WHAT IT CHECKS, and the proof that
-- it REFUSES a half-written pair deliberately does NOT live here. Probing it
-- with an INSERT inside a migration means a throwaway row's unrelated NOT NULL
-- or the wedding-consistency CHECK can abort a production deploy — the guard
-- would then break the thing it was written to protect. It lives in
-- `apps/web/tests/db/story-cover-pairing.db.test.ts`, which replays these
-- migrations into PGlite and tries all five kinds both ways round: there a
-- failure is a red test, which is what a guard is for.
