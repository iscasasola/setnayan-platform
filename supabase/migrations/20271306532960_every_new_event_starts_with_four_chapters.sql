-- every_new_event_starts_with_four_chapters
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📖 EVERY NEW EVENT STARTS WITH FOUR CHAPTERS (owner 2026-11-03, DECISION_LOG "EVERY EVENT IS BUILT FROM PREBUILT
-- PARTS" and its amendment "ALL FOUR PREBUILT PARTS ARE DEFAULT PUBLIC CHAPTERS"; approved prototype "Event chapters —
-- 4 Nov 2026", frame 1): Prep · Ceremony · Cocktail + Reception · After Party, public, already there for the host to
-- fill.
--
-- 🔑 THIS MIGRATION ONLY REMEMBERS WHICH EVENTS ARE NEW. It writes no chapter. The chapters are written by the app,
-- the first time a host opens the Schedule once the event has an exact day (`seedDefaultChapters`,
-- apps/web/lib/schedule-seed.server.ts), because:
--   · the moments inside them are the shipped rite-aware template (`buildScheduleSeed`, lib/schedule.ts) — a Catholic
--     Mass is never handed to a civil wedding — and that list lives in TypeScript. Copying it here would be a second,
--     competing source of truth for one fact;
--   · most new weddings have NO date yet. A chapter needs a day, and a schedule written on a guessed day is never moved
--     when the real date arrives (20271264726195: a date set from NULL has no anchor to measure from). So the seed
--     waits for the day.
--
-- WHY A MARKER AND NOT "AN EMPTY SCHEDULE": an event made before this ships has no marker, so it is never handed four
-- chapters it did not ask for; and a host who swipes all four away does not get them back on the next open — the
-- marker is claimed (deleted) once, by the one seed.
--
-- The trigger fires on EVERY insert into public.events, whatever path made it (six app paths today: both onboardings,
-- the generic onboarding, Create event, Plan next year, What's next) — one mechanism, not six call sites.
--
-- RLS: service-only (no browser role reads or writes it), the event_schedule_day_anchor pattern. The trigger function
-- is SECURITY DEFINER so a couple's own insert (RLS) still leaves the marker.
-- Held by apps/web/tests/db/every-new-event-starts-with-four-chapters.db.test.ts.

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_default_chapters_pending (
  event_id   UUID        PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_default_chapters_pending ENABLE ROW LEVEL SECURITY;
-- Service-only: no browser role reads or writes it; only the trigger below and the app's seed (service role) touch it.
REVOKE ALL ON TABLE public.event_default_chapters_pending FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.event_default_chapters_pending IS
  'A NEW event whose four default chapters (Prep, Ceremony, Cocktail + Reception, After Party) are not written yet. '
  'Inserted by events_default_chapters_mark on every events INSERT; claimed (deleted) once by the app seed '
  '(lib/schedule-seed.server.ts seedDefaultChapters) when a host opens the Schedule with an exact day. Service-only '
  '(2026-11-03).';

CREATE OR REPLACE FUNCTION public.event_default_chapters_mark()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.event_default_chapters_pending (event_id)
  VALUES (NEW.event_id)
  ON CONFLICT (event_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.event_default_chapters_mark() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_default_chapters_mark ON public.events;
CREATE TRIGGER events_default_chapters_mark
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.event_default_chapters_mark();

COMMIT;
