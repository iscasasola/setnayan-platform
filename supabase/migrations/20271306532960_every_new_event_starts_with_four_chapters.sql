-- every_new_event_starts_with_four_chapters
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📖 EVERY NEW EVENT STARTS WITH FOUR CHAPTERS (owner 2026-11-03, DECISION_LOG "EVERY EVENT IS BUILT FROM PREBUILT
-- PARTS" and its amendment "ALL FOUR PREBUILT PARTS ARE DEFAULT PUBLIC CHAPTERS"; approved prototype "Event chapters —
-- 4 Nov 2026", frame 1): Prep · Ceremony · Cocktail + Reception · After Party, public, already there for the host to
-- fill.
--
-- 🔑 THIS MIGRATION REMEMBERS WHICH EVENTS ARE NEW, and moves an undated event's chapters onto its day (§2). It writes
-- no chapter. The chapters are written by the app, the first time a host opens the Schedule (`seedDefaultChapters`,
-- apps/web/lib/schedule-seed.server.ts), because:
--   · the moments inside them are the shipped rite-aware template (`buildScheduleSeed`, lib/schedule.ts) — a Catholic
--     Mass is never handed to a civil wedding — and that list lives in TypeScript. Copying it here would be a second,
--     competing source of truth for one fact;
--   · most new weddings have NO date yet. Their chapters are written at once on the seed's placeholder day, and that
--     day is kept on the marker (`placeholder_day`). A schedule written on a guessed day was never moved when the real
--     date arrived (20271264726195: a date set from NULL has no anchor to measure from), so §2 below moves it: the first
--     time the event gets an EXACT day, by ANY path, every block on the placeholder day (and its moments) moves onto it,
--     in one statement, and the marker goes. A failure there is logged and never refuses the date.
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
  event_id        UUID        PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- NULL = not seeded yet. A day = seeded on this placeholder day (no exact date then); moved when the date arrives.
  placeholder_day DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.event_default_chapters_pending ADD COLUMN IF NOT EXISTS placeholder_day DATE;

ALTER TABLE public.event_default_chapters_pending ENABLE ROW LEVEL SECURITY;
-- Service-only: no browser role reads or writes it; only the trigger below and the app's seed (service role) touch it.
REVOKE ALL ON TABLE public.event_default_chapters_pending FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.event_default_chapters_pending IS
  'A NEW event whose four default chapters (Prep, Ceremony, Cocktail + Reception, After Party) are not written yet. '
  'Inserted by events_default_chapters_mark on every events INSERT; claimed once by the app seed '
  '(lib/schedule-seed.server.ts seedDefaultChapters) when a host first opens the Schedule: deleted when the event has '
  'an exact day, else stamped with placeholder_day, and deleted by events_default_chapters_follow_date once the chapters '
  'are moved onto the real day. Service-only (2026-11-03).';

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

-- ── 2 · THE DATE ARRIVES: the placeholder day's chapters move onto it ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_default_chapters_follow_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from DATE;
  v_days INTEGER;
BEGIN
  IF NEW.event_date IS NULL OR NEW.event_date_precision IS DISTINCT FROM 'day' THEN
    RETURN NEW;
  END IF;
  SELECT p.placeholder_day INTO v_from
    FROM public.event_default_chapters_pending p
   WHERE p.event_id = NEW.event_id AND p.placeholder_day IS NOT NULL;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  v_days := NEW.event_date - v_from;
  BEGIN
    IF v_days <> 0 THEN
      -- The chapters on the placeholder day and every moment under them — whole 24-hour steps on a UTC column that
      -- holds the venue's wall clock (the 20271264726195 arithmetic). A chapter the host put on another day stays.
      UPDATE public.event_schedule_blocks b
         SET start_at   = b.start_at + make_interval(hours => 24 * v_days),
             end_at     = b.end_at   + make_interval(hours => 24 * v_days),
             updated_at = now()
       WHERE b.event_id = NEW.event_id
         AND (
           ((b.start_at AT TIME ZONE 'UTC')::date = v_from AND b.parent_block_id IS NULL)
           OR b.parent_block_id IN (
             SELECT c.block_id FROM public.event_schedule_blocks c
              WHERE c.event_id = NEW.event_id AND c.parent_block_id IS NULL
                AND (c.start_at AT TIME ZONE 'UTC')::date = v_from
           )
         );
    END IF;
    DELETE FROM public.event_default_chapters_pending WHERE event_id = NEW.event_id;
  EXCEPTION WHEN OTHERS THEN
    -- Never refuse the date over its schedule: the marker stays, and the next exact change tries again.
    RAISE WARNING 'event_default_chapters_follow_date(%): % %', NEW.event_id, SQLSTATE, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.event_default_chapters_follow_date() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_default_chapters_follow_date ON public.events;
CREATE TRIGGER events_default_chapters_follow_date
  AFTER UPDATE OF event_date, event_date_precision ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.event_default_chapters_follow_date();

COMMIT;
