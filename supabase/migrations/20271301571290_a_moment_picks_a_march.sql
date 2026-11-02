-- a_moment_picks_a_march
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🚶 "THIS IS A MARCH" ON A MOMENT (owner 2026-11-01, DECISION_LOG "A MOMENT PICKS WHICH MARCH; MARCHES ARE MADE IN
-- MARCH, WITH GUESTS PICKED"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3). Owner: *"When we say this is a
-- march. It picks which march. So in march we can create a march similar to schedule"* · *"And pick guests to add to
-- the march."*
--
-- 🔑 EXTEND, DO NOT REBUILD (Rule 0). The marches already exist:
--   · the event's Wedding March itself — its role-based sections (`march_walks`, 20271258783396);
--   · the couple's OWN marches — `march_groups` (20271296703339, the 29 Oct "custom March groups YES"), named, with
--     guests picked into them (`march_walks.march_group`).
-- The one fact with no home is WHICH march a moment is. Hence ONE column on the moment:
--
--   event_schedule_blocks.march_key
--     NULL        — not a march (every row today, so nothing changes);
--     'entourage' — the event's Wedding March (its role-based sections);
--     'own_…'     — one of the couple's own marches (`march_groups.group_key` of the SAME event).
--
-- · TWO MOMENTS MAY USE ONE MARCH — no unique index: a rehearsal and the day can both be the Grand Entrance.
-- · REMOVING THE LINK NEVER DELETES THE MARCH — the link is a value on the moment; clearing it writes only the moment.
-- · DELETING A MARCH CLEARS ITS LINKS, never a moment (trigger below). It runs as its owner: the person deleting a
--   march (a host, or a helper with Edit on the guest list) may not be allowed to edit the schedule, and a link left
--   pointing at a march that is gone would name a march nobody can open.
-- · A LINK NAMES A MARCH OF ITS OWN EVENT — refused here (trigger below), never only on a screen.
-- · Only a MOMENT (a child block) is a march — a chapter is not.
-- ⛔ Touches no guest row, no walk and no march group.

ALTER TABLE public.event_schedule_blocks
  ADD COLUMN IF NOT EXISTS march_key TEXT;

ALTER TABLE public.event_schedule_blocks
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_march_key_check;
ALTER TABLE public.event_schedule_blocks
  ADD CONSTRAINT event_schedule_blocks_march_key_check
    CHECK (
      march_key IS NULL
      OR (
        parent_block_id IS NOT NULL
        AND (march_key = 'entourage' OR march_key ~ '^own_[0-9a-z]{6,24}$')
      )
    );

COMMENT ON COLUMN public.event_schedule_blocks.march_key IS
  'Moment only: which march this moment is. NULL = not a march; ''entourage'' = the event''s Wedding March; '
  '''own_…'' = one of the couple''s own marches (march_groups.group_key, same event). Two moments may share one. '
  'Cleared (never the moment) when that march is deleted. 20271301571290.';

-- Every moment that is one march, for the delete trigger's clear.
CREATE INDEX IF NOT EXISTS event_schedule_blocks_march_key_idx
  ON public.event_schedule_blocks (event_id, march_key)
  WHERE march_key IS NOT NULL;

-- ── 1 · a link names a march of its own event ─────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: a coordinator with Edit on the Schedule may not be able to READ `march_groups` (its RLS is the
-- guest list's), and an existing march must not read as missing to them. It only answers exists / not; it writes nothing.
CREATE OR REPLACE FUNCTION public.event_schedule_blocks_march_is_real()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only an own march is looked up; 'entourage' needs no row, and any other value is the CHECK's to refuse.
  IF NEW.march_key IS NULL OR NEW.march_key NOT LIKE 'own\_%' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.march_key IS NOT DISTINCT FROM OLD.march_key AND NEW.event_id = OLD.event_id THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.march_groups g WHERE g.event_id = NEW.event_id AND g.group_key = NEW.march_key
  ) THEN
    RAISE EXCEPTION 'march_not_found' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.event_schedule_blocks_march_is_real() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_blocks_march_is_real ON public.event_schedule_blocks;
CREATE TRIGGER event_schedule_blocks_march_is_real
  BEFORE INSERT OR UPDATE OF march_key, event_id ON public.event_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.event_schedule_blocks_march_is_real();

-- ── 2 · deleting a march clears its links, never a moment ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.march_groups_clear_moment_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.event_schedule_blocks
     SET march_key = NULL
   WHERE event_id = OLD.event_id
     AND march_key = OLD.group_key;
  RETURN OLD;
END $$;

REVOKE ALL ON FUNCTION public.march_groups_clear_moment_links() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS march_groups_clear_moment_links ON public.march_groups;
CREATE TRIGGER march_groups_clear_moment_links
  AFTER DELETE ON public.march_groups
  FOR EACH ROW EXECUTE FUNCTION public.march_groups_clear_moment_links();
