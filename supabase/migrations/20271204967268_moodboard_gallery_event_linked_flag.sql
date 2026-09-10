-- ============================================================================
-- 20271204967268_moodboard_gallery_event_linked_flag.sql
-- MB22 — "YOURS STAND OUT": the couple-facing picker needs to know WHETHER a
-- gallery photo is event-linked, without learning WHICH event.
--
-- `moodboard_library_assets.source_event_id` (MB11, 20271202522764) is
-- REVOKED from `anon` and `authenticated` on purpose — the couple-facing
-- picker (`fetchGalleryAssets`, the authenticated client) must never be able
-- to read or ORDER BY the raw column, because that column is a correlation
-- handle on a stranger's event UUID. That revoke is correct and this
-- migration does not touch it.
--
-- But MB22's brief is "event-linked photos rank first, with a badge" — and a
-- boolean fact ("this came from SOME celebration, not which one") is not the
-- same disclosure the MB11 revoke exists to prevent. It is also, in a real
-- sense, already public: MB20's watermark bakes exactly this same boolean
-- into the PIXELS of the photo itself (the discreet seal vs. the stamp,
-- `lib/watermark-server.ts`) — anyone who can view the image can already see
-- it. Adding a queryable boolean does not create a new leak; it lets the
-- picker sort and badge by a fact the photo already announces visually.
--
-- So: a STORED GENERATED column, computed from `source_event_id` and nothing
-- else, granted to `anon`/`authenticated` — while `source_event_id` itself
-- stays exactly as withheld as MB11 left it.
-- ============================================================================

BEGIN;

ALTER TABLE public.moodboard_library_assets
  ADD COLUMN IF NOT EXISTS is_event_linked boolean
    GENERATED ALWAYS AS (source_event_id IS NOT NULL) STORED;

COMMENT ON COLUMN public.moodboard_library_assets.is_event_linked IS
  'Derived, read-only: TRUE when source_event_id IS NOT NULL (MB22). Exists so the couple-facing picker can rank and badge event-linked photos WITHOUT reading source_event_id itself, which stays revoked from anon/authenticated per MB11 (20271202522764) — this column reveals only the boolean, never which celebration, and the same boolean is already visible in the photo''s own watermark (seal vs. stamp, MB20).';

-- `moodboard_library_assets` already moved off table-level grants for
-- anon/authenticated (MB11 replaced them with an explicit per-column
-- allow-list), so a bare `GRANT SELECT (col)` here only ADDS this one column
-- to that allow-list — it cannot reopen anything MB11 closed, and
-- `source_event_id` is not named below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'moodboard_library_assets'
       AND column_name  = 'is_event_linked'
  ) THEN
    RAISE EXCEPTION 'is_event_linked is missing — the grant below would apply to nothing';
  END IF;

  GRANT SELECT (is_event_linked) ON public.moodboard_library_assets TO anon, authenticated;
END $$;

-- Post-conditions — fail loudly rather than ship a silently-wrong grant.
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
  rle TEXT;
BEGIN
  FOREACH rle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT has_column_privilege(
         rle, 'public.moodboard_library_assets', 'is_event_linked', 'SELECT') THEN
      bad := array_append(bad, rle || ' still cannot SELECT is_event_linked');
    END IF;
    -- The one thing this migration must never do: reopen the column MB11 shut.
    IF has_column_privilege(
         rle, 'public.moodboard_library_assets', 'source_event_id', 'SELECT') THEN
      bad := array_append(bad, rle || ' can now SELECT source_event_id — MB11''s revoke broke');
    END IF;
  END LOOP;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'MB22 grant post-conditions failed: %', array_to_string(bad, '; ');
  END IF;
END $$;

COMMIT;
