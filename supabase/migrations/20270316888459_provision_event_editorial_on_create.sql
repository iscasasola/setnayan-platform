-- provision event editorial on create
-- ============================================================================
-- Every event gets an editorial — materialize a draft `event_editorial` row at
-- event-creation time so each event is a tracked, ready-to-publish story object
-- (owner intent 2026-06-28: "each event created will have an editorial").
--
-- WHY A ROW IF THE EDITORIAL ALREADY COMPOSES LIVE?
--   The public editorial renders from the `events` row regardless — `event_editorial`
--   is optional at render time (app/[slug]/_components/editorial/data.ts). What the
--   row buys is a STABLE, LISTABLE object: a place to hold the couple's text
--   overrides, the draft→published flag (the social OG share card shows the story
--   card only when status='published'), and the frozen impact metrics at publish.
--   Materializing it at creation makes "publish my story / feature in Real Stories"
--   (PR2) a flag-flip on an existing row instead of a create-then-publish.
--
-- WHY draft_json STAYS EMPTY ('{}')
--   The compose engine auto-writes headline/deck/etc. from `events.love_story` and
--   PREFERS draft_json keys when present (saveEditorial: blank field = let the engine
--   auto-write). Seeding text into draft_json here would FREEZE those as permanent
--   couple-overrides that no longer track the live love-story edits. So we seed an
--   EMPTY draft at status='draft' and let the composer stay authoritative until the
--   couple actually edits.
--
-- RESILIENCE
--   The trigger is EXCEPTION-guarded and ON CONFLICT DO NOTHING: a seeding failure
--   must NEVER block event creation (editorial is non-critical to an event existing).
--
-- IDEMPOTENT: CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER + ON CONFLICT +
-- a guarded backfill. Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Trigger function — seed one draft editorial per new event.
--    SECURITY DEFINER so it bypasses event_editorial RLS (the table is owned by
--    the server-side composer; couples have no direct write policy), mirroring
--    public.handle_new_event(). search_path pinned per the DEFINER-hardening rule.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_event_editorial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.event_editorial (event_id, status, draft_json)
    VALUES (NEW.event_id, 'draft', '{}'::jsonb)
    ON CONFLICT (event_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Editorial is non-critical to event creation — never abort the INSERT.
    NULL;
  END;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Trigger — fires for every new event (all paths: dashboard create,
--    onboarding, anon-draft commit, seeded events). Separate from
--    on_event_created so an editorial-seeding fault is isolated from the
--    join-token mint.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_event_created_seed_editorial ON public.events;
CREATE TRIGGER on_event_created_seed_editorial
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.seed_event_editorial();

-- ----------------------------------------------------------------------------
-- 3. Backfill — every EXISTING event that has no editorial row gets a draft one,
--    so "each event has an editorial" is true retroactively, not just forward.
--    Idempotent via NOT EXISTS / ON CONFLICT.
-- ----------------------------------------------------------------------------
INSERT INTO public.event_editorial (event_id, status, draft_json)
SELECT e.event_id, 'draft', '{}'::jsonb
FROM public.events e
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_editorial ed WHERE ed.event_id = e.event_id
)
ON CONFLICT (event_id) DO NOTHING;

COMMIT;
