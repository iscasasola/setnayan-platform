-- the_arrangement_is_kept
-- ============================================================================
-- "MAKE IT YOURS" — WHERE A HOST'S ARRANGEMENT OF THEIR STORY IS KEPT.
-- 10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md step 3 · the owner-passed prototype
-- prototypes/story_make_it_yours_2026-09-10.html.
--
-- What is kept: the story's mode (Automatic | I choose), the host's moments in
-- the host's order with any names they typed, the words on every page, every
-- photo placed by hand (x, y in 660-unit sheet units), and named photo sets.
-- Automatic is NOT kept — it is re-derived from the run of show on every read.
-- The document's shape is defined once, in apps/web/lib/story-arrangement.ts.
--
-- ⚖ A COLUMN ON THE STORY'S OWN ROW, NOT A KEY IN draft_json. Three writers
-- (saveEditorial, the cover step, What's Next) rewrite the whole of draft_json
-- from a copy read moments earlier. An arrangement that autosaves on every
-- change would be put back by whichever of them finished second — including
-- the story's own Save button, pressed in the same tab. None of them name this
-- column, so none of them can overwrite it.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS · DROP/ADD CONSTRAINT · CREATE OR
-- REPLACE FUNCTION · DROP/CREATE TRIGGER.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_editorial
  ADD COLUMN IF NOT EXISTS arrangement jsonb,
  ADD COLUMN IF NOT EXISTS arrangement_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.event_editorial
  DROP CONSTRAINT IF EXISTS event_editorial_arrangement_is_a_document;
ALTER TABLE public.event_editorial
  ADD CONSTRAINT event_editorial_arrangement_is_a_document
  CHECK (arrangement IS NULL OR jsonb_typeof(arrangement) = 'object');

ALTER TABLE public.event_editorial
  DROP CONSTRAINT IF EXISTS event_editorial_arrangement_version_counts_up;
ALTER TABLE public.event_editorial
  ADD CONSTRAINT event_editorial_arrangement_version_counts_up
  CHECK (arrangement_version >= 0);

COMMENT ON COLUMN public.event_editorial.arrangement IS
  'The host''s "Make it yours" arrangement (apps/web/lib/story-arrangement.ts). '
  'Written ONLY by save_story_arrangement. Photo references are capture ids, never '
  'keys: every read re-applies the consent veto and the guests'' layer, so a photo '
  'a guest takes back drops off every page without this document changing.';
COMMENT ON COLUMN public.event_editorial.arrangement_version IS
  'Counts saves of arrangement. A save names the version it was built on and lands '
  'only if that is still the stored one — two tabs cannot silently overwrite each other.';

-- ----------------------------------------------------------------------------
-- THE ONE WRITE — a compare-and-set on the version.
--
-- Returns one row, (outcome, saved_version):
--   saved      — it landed; saved_version is the new version
--   unchanged  — the stored document is ALREADY exactly this one (a retried
--                autosave, or two tabs that made the same change): not a
--                conflict; saved_version is the current version
--   conflict   — somebody saved since p_expected; nothing was written;
--                saved_version is the version that won
--   no_story   — the celebration has no story row (every event is given one at
--                creation, so this is a fault to report, not a case to paper over)
--
-- Why this is safe with two writers at once: the UPDATE's WHERE names the
-- expected version. The second of two concurrent saves waits on the first's
-- row lock, then re-checks that WHERE against the row the first one committed,
-- finds the version moved, and updates nothing.
--
-- SECURITY INVOKER and executable by service_role alone. The server action
-- proves the caller is a host of THIS celebration before it calls this.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_story_arrangement(
  p_event_id uuid,
  p_expected integer,
  p_doc jsonb
)
RETURNS TABLE (outcome text, saved_version integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version integer;
  v_doc jsonb;
BEGIN
  IF p_event_id IS NULL OR p_expected IS NULL OR p_expected < 0 THEN
    RAISE EXCEPTION 'story:arrangement_needs_an_event_and_a_version';
  END IF;
  IF p_doc IS NULL OR jsonb_typeof(p_doc) <> 'object' THEN
    RAISE EXCEPTION 'story:arrangement_must_be_a_document';
  END IF;

  UPDATE public.event_editorial e
     SET arrangement = p_doc,
         arrangement_version = e.arrangement_version + 1
   WHERE e.event_id = p_event_id
     AND e.arrangement_version = p_expected
  RETURNING e.arrangement_version INTO v_version;

  IF FOUND THEN
    RETURN QUERY SELECT 'saved'::text, v_version;
    RETURN;
  END IF;

  SELECT e.arrangement_version, e.arrangement
    INTO v_version, v_doc
    FROM public.event_editorial e
   WHERE e.event_id = p_event_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'no_story'::text, NULL::integer;
    RETURN;
  END IF;

  -- jsonb equality ignores key order, so a document re-serialised by another
  -- client in a different order is still recognised as the same document.
  IF v_doc IS NOT DISTINCT FROM p_doc THEN
    RETURN QUERY SELECT 'unchanged'::text, v_version;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'conflict'::text, v_version;
END;
$$;

REVOKE ALL ON FUNCTION public.save_story_arrangement(uuid, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_story_arrangement(uuid, integer, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_story_arrangement(uuid, integer, jsonb) TO service_role;

COMMENT ON FUNCTION public.save_story_arrangement(uuid, integer, jsonb) IS
  'The only writer of event_editorial.arrangement: a compare-and-set on arrangement_version. '
  'Outcomes: saved | unchanged (same document already stored) | conflict | no_story.';

-- ----------------------------------------------------------------------------
-- THE DOOR THE TABLE GRANT LEAVES OPEN — shut, the same way the two doors of
-- 20271217599705 were.
--
-- `authenticated` holds TABLE-level INSERT and UPDATE on event_editorial, and
-- the couple policy is permissive FOR ALL — so without this a signed-in host
-- could PATCH `arrangement` straight through PostgREST and skip every rule the
-- save enforces (one photograph, one moment). Column grants cannot subtract
-- from a table grant, so the fence is a trigger. Every OTHER column stays
-- writable exactly as before; only these two are refused to browser roles.
--
-- The role test is current_user, not auth.role() — the PGlite replay's shim
-- answers 'anon' where production answers NULL (see the two-doors migration).
-- The reads re-apply every rule anyway (a stored document is repaired on the
-- way out), so this is the second fence, not the only one.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_the_arrangement_has_one_door()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.arrangement IS NOT NULL OR NEW.arrangement_version <> 0 THEN
      RAISE EXCEPTION 'story:arrangement_has_one_door'
        USING HINT = 'The arrangement is saved through the Story Maker, not written directly.';
    END IF;
  ELSIF NEW.arrangement IS DISTINCT FROM OLD.arrangement
     OR NEW.arrangement_version IS DISTINCT FROM OLD.arrangement_version THEN
    RAISE EXCEPTION 'story:arrangement_has_one_door'
      USING HINT = 'The arrangement is saved through the Story Maker, not written directly.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_editorial_arrangement_has_one_door ON public.event_editorial;
CREATE TRIGGER event_editorial_arrangement_has_one_door
  BEFORE INSERT OR UPDATE ON public.event_editorial
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_the_arrangement_has_one_door();

COMMENT ON FUNCTION public.tg_the_arrangement_has_one_door() IS
  'Refuses a browser-role write to event_editorial.arrangement / arrangement_version. '
  'The table grant to authenticated cannot be narrowed per column; save_story_arrangement '
  '(service_role) is the one door.';

COMMIT;
