-- ============================================================================
-- A chapter can be shared with the day only
-- ============================================================================
-- Owner, 2026-08-20: *"they also get to choose whether it is only me, private
-- (all in that event only), public."*
--
-- Three answers to one question — WHO READS THIS — and they are three values of
-- ONE column, not a second column beside `status`. Two columns meaning
-- overlapping things is how a product ends up with two homes for one fact and
-- only one of them ever written (this same table has already paid that bill:
-- `substrate.papic_gallery_id` vs `event_id`).
--
--   draft      →  ONLY ME. Unchanged: this is what draft has always meant.
--   event      →  THE PEOPLE OF THIS CELEBRATION. New.
--   published  →  EVERYONE. Unchanged.
--
-- 🔑 WHY A THIRD VALUE OF `status` AND NOT A NEW `audience` COLUMN — IT FAILS
-- CLOSED. Ten shipped read paths ask `status = 'published'` (the public
-- profile, the chapter page, the share card, the Real Stories shelf, the
-- storyteller search, the follower notification, analytics, attribution, the
-- host's curation screen, and the RLS policy itself). With `event` as its own
-- status, **every one of them keeps refusing an event-only chapter without
-- being edited** — and any read path added in future refuses it too, by
-- default. A separate `audience` column would have left all ten returning
-- event-only chapters to the public internet until each was found and changed,
-- and the eleventh would leak forever. **The safe direction is the one where
-- forgetting means hiding.**
--
-- ⚠ THE WORD `draft` NOW CARRIES A SECOND MEANING and the UI never says it: the
-- composer offers "Only me", "The people of this celebration" and "Everyone".
-- The stored words stay as they are because ten call sites depend on them; the
-- renaming that matters is the one a person reads.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The third value.
-- ----------------------------------------------------------------------------
ALTER TABLE public.creator_chapters
  DROP CONSTRAINT IF EXISTS creator_chapters_status_check;
ALTER TABLE public.creator_chapters
  ADD CONSTRAINT creator_chapters_status_check
  CHECK (status IN ('draft', 'event', 'published'));

COMMENT ON COLUMN public.creator_chapters.status IS
  'WHO READS THIS. draft = only the author. event = the people of the attached '
  'celebration (hosts, guests holding a seat, booked suppliers) and nobody else — it is '
  'NOT public and no public read path returns it, because they all ask for '
  '''published''. published = everyone. Three values of one column on purpose: a '
  'separate audience column would have left every existing public read serving '
  'event-only chapters to the internet until each was found and changed. Owner '
  '2026-08-20.';

-- ----------------------------------------------------------------------------
-- 2. "Shared with the celebration" needs a celebration.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.creator_chapters'::regclass
       AND conname  = 'creator_chapters_event_audience_needs_event'
  ) THEN
    ALTER TABLE public.creator_chapters
      ADD CONSTRAINT creator_chapters_event_audience_needs_event
      CHECK (status <> 'event' OR event_id IS NOT NULL);
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. A chapter anybody else can read needs WRITING.
--    Widened from the 2026-08-12 rule, which named 'published' only. A chapter
--    shared with the people of a celebration is just as much a thing somebody
--    else opens, and an empty one is just as much a broken promise.
-- ----------------------------------------------------------------------------
ALTER TABLE public.creator_chapters
  DROP CONSTRAINT IF EXISTS creator_chapters_published_needs_body;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.creator_chapters'::regclass
       AND conname  = 'creator_chapters_shared_needs_body'
  ) THEN
    ALTER TABLE public.creator_chapters
      ADD CONSTRAINT creator_chapters_shared_needs_body
      CHECK (status = 'draft' OR btrim(coalesce(body, '')) <> '');
  END IF;
END
$$;

COMMENT ON CONSTRAINT creator_chapters_shared_needs_body
  ON public.creator_chapters IS
  'A chapter anybody but its author can read needs WRITING, not a video. Replaces '
  'creator_chapters_published_needs_body, which named ''published'' only — the same rule '
  'has to cover a chapter shared with the people of a celebration. The app validates '
  'first, with a sentence a person can act on; this is the backstop that makes the '
  'promise true even for a direct PostgREST write.';

-- ----------------------------------------------------------------------------
-- 4. Detaching the celebration takes the sharing with it.
--    🪤 WITHOUT THIS THE CONSTRAINT ABOVE REFUSES A LEGITIMATE EDIT. Somebody
--    who unlinks the celebration from a chapter shared WITH that celebration
--    would be told, by the database, that their own save is invalid — with
--    nothing on the screen able to explain it. The audience falls back to the
--    only honest answer when there is no longer a celebration to share with:
--    only me.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_chapter_audience_floor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_id IS NULL AND NEW.status = 'event' THEN
    NEW.status := 'draft';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_chapter_audience_floor() IS
  'Detaching the celebration from a chapter shared with that celebration drops it back '
  'to "only me" — the audience no longer describes anybody. Runs BEFORE the constraint '
  'so a legitimate unlink is never refused by the database.';

DROP TRIGGER IF EXISTS set_chapter_audience_floor_trg ON public.creator_chapters;
CREATE TRIGGER set_chapter_audience_floor_trg
  BEFORE INSERT OR UPDATE ON public.creator_chapters
  FOR EACH ROW EXECUTE FUNCTION public.set_chapter_audience_floor();

-- ----------------------------------------------------------------------------
-- 5. The read this makes possible: what is on THIS celebration's page.
--    Mirrors creator_chapters_event_included_idx, which covers the public half.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS creator_chapters_event_audience_idx
  ON public.creator_chapters (event_id, published_at DESC)
  WHERE event_id IS NOT NULL
    AND host_included_at IS NOT NULL
    AND status IN ('event', 'published');

-- ----------------------------------------------------------------------------
-- 6. 🔒 THE PUBLIC-READ POLICY IS DELIBERATELY UNTOUCHED. It already says
--    `status = 'published'`, so an event-only chapter is refused by RLS to anon
--    and to every account that is not its author. The event-side read runs
--    through the service role, which is where the "is this viewer one of this
--    celebration's people?" question can actually be answered.
-- ----------------------------------------------------------------------------

COMMIT;
