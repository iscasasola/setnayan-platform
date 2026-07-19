-- std_film_content_snapshot
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Save-the-Date film content snapshot (iteration 0024 · content-lock PR).
--
-- Adds STD-specific "finalized" columns that take priority over the live
-- event data in the film. Decouples the STD snapshot from the couple's
-- ongoing event edits:
--
--   std_film_date       — the wedding date locked to this STD film
--   std_film_venue_name — the venue name locked to this STD film
--   std_film_venue_city — the venue city / area locked to this STD film
--   std_film_story      — the love-story snippet locked to this STD film
--
-- Resolution order (enforced at the page layer, not the DB):
--   std_film_* (finalized snapshot)  →  event_* / love_story (live fallback)
--
-- Once the couple saves via the STD builder inline forms, the value is
-- stored here. Subsequent changes to event_date / venue_name / love_story
-- no longer affect the film — the snapshot is immutable from the film's
-- perspective (though it remains a normal writable column for admin overrides).
--
-- No RLS change: events already carries couple_can_update_event (couples write
-- their own row) + the current_event_ids() SELECT policy.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS std_film_date         DATE,
  ADD COLUMN IF NOT EXISTS std_film_venue_name   TEXT,
  ADD COLUMN IF NOT EXISTS std_film_venue_city   TEXT,
  ADD COLUMN IF NOT EXISTS std_film_story        TEXT;

COMMENT ON COLUMN public.events.std_film_date IS
  'STD film snapshot: wedding date locked for this film (priority over event_date). Set via the STD builder. Iteration 0024.';
COMMENT ON COLUMN public.events.std_film_venue_name IS
  'STD film snapshot: venue name locked for this film (priority over venue_name). Iteration 0024.';
COMMENT ON COLUMN public.events.std_film_venue_city IS
  'STD film snapshot: venue city/area locked for this film (priority over venue_address). Iteration 0024.';
COMMENT ON COLUMN public.events.std_film_story IS
  'STD film snapshot: love-story snippet locked for this film (priority over love_story). Iteration 0024.';
