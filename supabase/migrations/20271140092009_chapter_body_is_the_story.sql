-- ===========================================================================
-- A CHAPTER'S STORY IS WRITING. THE VIDEO IS OPTIONAL.
--
-- Owner decision 2026-08-12, verbatim: "their storytelling doesn't need to be a
-- video anymore. it will be their editorial and they can also paste a video
-- they can upload to the editorial."
--
-- Until now a chapter's prose lived at `substrate.itinerary` — a TRAVEL-shaped
-- key inside a jsonb bag documented as "the raw moat behind the chapter". That
-- name was survivable while the embed was the main event. It is not survivable
-- now that the writing IS the main event: the field a couple types their
-- wedding story into cannot be called an itinerary.
--
-- 🔑 RENAME THE VALUE, DO NOT DOCUMENT AROUND IT. This project already paid for
-- that lesson: `sponsored_included` → `included_in_package` (20271108090000),
-- after the word sent two independent readers to the same wrong conclusion. A
-- comment does not travel with a value into a query result, a log line or an
-- export. So the body is promoted OUT of the substrate bag into a first-class,
-- honestly-named column.
--
-- SAFE BY MEASUREMENT, NOT BY ASSUMPTION: prod holds 0 creator_chapters rows
-- (measured 2026-08-12), so the backfill below moves nothing in production. It
-- is written correctly anyway — preview/branch databases are not empty, and a
-- backfill that only works on an empty table is not a backfill.
--
-- GRANTS: creator_chapters carries TABLE-level privileges only (no column ACLs
-- — verified via pg_attribute.attacl, not information_schema). A new column
-- therefore inherits the table grant and does NOT need a re-GRANT. Had this
-- table been column-granted like `events`, naming `body` in a select would have
-- had the WHOLE query rejected and the page would 404 with nothing thrown.
-- ===========================================================================

-- 1 ── The column ------------------------------------------------------------
ALTER TABLE public.creator_chapters
  ADD COLUMN IF NOT EXISTS body text;

COMMENT ON COLUMN public.creator_chapters.body IS
  'The chapter''s EDITORIAL — the story itself, in the storyteller''s own words, '
  'paragraphs preserved as blank-line-separated text. This is the PRIMARY content '
  'of a chapter (owner 2026-08-12); embed_url is an OPTIONAL companion video. '
  'Required to publish — see the creator_chapters_published_needs_body CHECK. '
  'Formerly substrate->>''itinerary'', which was travel-shaped naming on the main event.';

-- 2 ── Carry any existing prose across, then retire the misleading key --------
-- Idempotent: only fills a NULL/blank body, and only from a non-blank source.
UPDATE public.creator_chapters
   SET body = btrim(substrate->>'itinerary')
 WHERE (body IS NULL OR btrim(body) = '')
   AND btrim(coalesce(substrate->>'itinerary', '')) <> '';

-- The key must not survive the rename — a second home for the same value is how
-- the old name comes back. Reads of substrate.itinerary are removed in the same
-- PR, so nothing is left pointing here.
UPDATE public.creator_chapters
   SET substrate = substrate - 'itinerary'
 WHERE substrate ? 'itinerary';

-- 3 ── A published chapter must actually say something ------------------------
-- The app validates first, with a sentence a person can act on; this is the
-- backstop that makes the promise true even for a direct PostgREST write. A
-- DRAFT is deliberately unconstrained — that is where an unfinished story lives.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.creator_chapters'::regclass
       AND conname  = 'creator_chapters_published_needs_body'
  ) THEN
    ALTER TABLE public.creator_chapters
      ADD CONSTRAINT creator_chapters_published_needs_body
      CHECK (status <> 'published' OR btrim(coalesce(body, '')) <> '');
  END IF;
END
$$;

COMMENT ON CONSTRAINT creator_chapters_published_needs_body
  ON public.creator_chapters IS
  'A published chapter needs WRITING, not a video. Replaces the old app-only rule '
  '"Add the embedded edit before publishing", which made an external video account '
  '(YouTube/Instagram/TikTok) a precondition for telling your own story — the single '
  'reason the storyteller shelf was empty (0 chapters, 0 public profiles, 2026-08-12).';
