-- ============================================================================
-- The host decides which attached stories appear on their day
-- ============================================================================
-- Owner, 2026-08-15, two rulings that only work together:
--   "vendors who are part of that event can create a content for that event."
--   "they can create a column for that story, and the user can decide to add it
--    or not."
--
-- 🔑 THIS IS NOT ASK-BEFORE-YOU-WRITE. A supplier who worked the day is never
-- blocked from telling their side — the piece is theirs and lives on their own
-- page either way. The couple decides only whether it is ADDED to THEIR day.
-- Nobody waits on anybody to create. (This retires the one-tap
-- request-and-approve handshake in the design record's D2; the owner's shape is
-- better and this column is it.)
--
-- 🛑 WHY THIS COLUMN SHIPS IN THE SAME CHANGE THAT WIDENS WHO MAY ATTACH.
-- Widening attachment WITHOUT this control would let a business hang a public
-- page off a family's wedding with no say from that family — strictly worse
-- than hosts-only, which is where the product was. The two halves are one unit.
--
-- NULL = attached but not shown on the couple's surfaces. A timestamp = the
-- host added it. Nothing is backfilled: every existing chapter was authored by
-- the event's own host, and the app stamps those automatically on write, so a
-- couple never has to approve themselves.

ALTER TABLE public.creator_chapters
  ADD COLUMN IF NOT EXISTS host_included_at timestamptz;

COMMENT ON COLUMN public.creator_chapters.host_included_at IS
  'When the celebration''s host added this chapter to their day. NULL = the '
  'chapter is attached (event_id) but must NOT appear on the couple''s '
  'surfaces — the cross-rail chips, or anywhere Setnayan speaks about that '
  'event. The author''s own page always shows it regardless: attaching is the '
  'author''s act, INCLUDING is the host''s. Stamped automatically when the '
  'author IS the host. Owner 2026-08-15.';

-- The cross-rail asks "which included chapter belongs to these events?", so the
-- index carries the same three predicates that read path uses.
CREATE INDEX IF NOT EXISTS creator_chapters_event_included_idx
  ON public.creator_chapters (event_id, published_at DESC)
  WHERE status = 'published'
    AND event_id IS NOT NULL
    AND host_included_at IS NOT NULL;

-- 🔒 THE COLUMN IS NOT THE AUTHOR'S TO SET. `creator_chapters` RLS is Pattern A
-- (user_id = auth.uid()), so without this an author could stamp their own
-- chapter as host-included through PostgREST and put it on somebody else's
-- wedding — the exact harm this column exists to prevent.
-- 🔑 THE ROW IS YOURS, THE FIELD IS NOT: a policy saying "this row is yours"
-- has no opinion about a field recording SOMEBODY ELSE'S decision. Revoked at
-- the column level; the host's action runs through the service role.
REVOKE UPDATE (host_included_at) ON public.creator_chapters FROM authenticated;
REVOKE INSERT (host_included_at) ON public.creator_chapters FROM authenticated;

-- 🔑 SO THE DATABASE STAMPS IT, NOT THE APP. The revoke above means the
-- authenticated client cannot NAME this column — including our own composer
-- action, which would otherwise have to stamp it when a couple attaches their
-- own celebration. Postgres checks privileges against columns NAMED, not values
-- written, so an app-side stamp would fail for the legitimate case too.
--
-- A trigger is the right tool here: the value must EXIST, and the browser must
-- not choose it. It also means "the author is the host, so of course it is
-- included" can never be forgotten by a future write path.
CREATE OR REPLACE FUNCTION public.set_chapter_host_inclusion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Re-pointing a chapter at a DIFFERENT celebration drops the previous host's
  -- decision. It was a judgement about a different day, and carrying it over
  -- would silently place the piece on a wedding whose host never saw it.
  IF TG_OP = 'UPDATE' AND NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    NEW.host_included_at := NULL;
  END IF;

  IF NEW.event_id IS NULL THEN
    NEW.host_included_at := NULL;
    RETURN NEW;
  END IF;

  -- The author IS the host of this celebration ⇒ included, always. A couple
  -- never has to approve themselves.
  IF NEW.host_included_at IS NULL AND EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = NEW.event_id
      AND em.user_id  = NEW.user_id
      AND em.member_type = 'couple'
  ) THEN
    NEW.host_included_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_chapter_host_inclusion_trg ON public.creator_chapters;
CREATE TRIGGER set_chapter_host_inclusion_trg
  BEFORE INSERT OR UPDATE OF event_id ON public.creator_chapters
  FOR EACH ROW EXECUTE FUNCTION public.set_chapter_host_inclusion();
