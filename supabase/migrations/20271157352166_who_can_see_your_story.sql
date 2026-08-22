-- ============================================================================
-- WHO CAN SEE YOUR STORY — the third audience
-- ============================================================================
-- Owner 2026-08-22, closing the story maker: a couple chooses only me · the
-- people of this celebration · everyone.
--
-- 🔑 THE AUDIENCE GOES INSIDE `status`, NOT INTO A COLUMN OF ITS OWN. Several
-- shipped read paths already ask `status = 'published'` — the Told shelf on My
-- Events, the Library's guest view, Real Stories, the admin counts. Widening
-- this column means every one of them, and every one written later, refuses a
-- celebration-only story WITHOUT being edited. Forgetting hides; forgetting
-- cannot leak. A separate `story_audience` column would have left all of them
-- reading `published` and silently ignoring the couple's choice.
--
-- 🚨 THIS IS A PRIVACY FIX, NOT ONLY A FEATURE. Until now the public page
-- decided to render the story from the LIFECYCLE alone and never looked at this
-- column, while a row is auto-created for every event at creation — so after the
-- day, a couple's UNPUBLISHED story was already readable by anyone who could
-- open the page. The application gate lands with this migration.
--
-- ⚖ NOTHING MOVES FOR ANY EXISTING ROW. This only ADDS a legal value; every
-- current row keeps the exact status it has. Measured in production on
-- 2026-08-22 before writing this: 5 story rows, 0 of them 'published'.
-- ============================================================================

DO $$
BEGIN
  -- Idempotent by construction: drop the old constraint if it is there, then
  -- add the widened one. Named explicitly rather than relying on the generated
  -- name, so a re-run cannot leave two constraints disagreeing.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.event_editorial'::regclass
       AND conname  = 'event_editorial_status_check'
  ) THEN
    ALTER TABLE public.event_editorial
      DROP CONSTRAINT event_editorial_status_check;
  END IF;

  ALTER TABLE public.event_editorial
    ADD CONSTRAINT event_editorial_status_check
    CHECK (status IN ('draft', 'event', 'published'));
END $$;

COMMENT ON COLUMN public.event_editorial.status IS
  'WHO CAN READ THIS STORY, not a workflow state. draft = only the host; '
  'event = the people of that celebration (hosts, seated guests, suppliers who '
  'worked it); published = everyone. The audience lives in this column ON '
  'PURPOSE: the shipped readers that ask status = ''published'' then refuse a '
  'narrower audience without being edited. See lib/who-can-see-your-story.ts.';
