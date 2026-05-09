-- Tayo V1 — Iteration 0000 update: event_type column for the create-event picker
--
-- Spec: 0000 Step 2.5 — six-tile picker (Wedding selectable; the other five
-- show "Coming soon"). All existing rows backfill to 'wedding'.

ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'wedding';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_event_type_check') THEN
    ALTER TABLE events ADD CONSTRAINT events_event_type_check
      CHECK (event_type IN ('wedding', 'birthday', 'celebration', 'travel', 'corporate', 'burial'));
  END IF;
END $$;

COMMENT ON COLUMN events.event_type IS
  'Event-type tile chosen at create. V1 only allows ''wedding''; the other five values are reserved for future iterations and surfaced as "Coming soon" tiles in the picker UI.';
