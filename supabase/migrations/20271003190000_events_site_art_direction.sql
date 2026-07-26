-- Pahina wave A PR-5b — the Candlelight art direction (design spec §4).
--
-- One column, two values. `daylight` is the default and is exactly today's
-- look; `candlelight` flips the guest site to the dark direction (paper ↔ warm
-- near-black, ink ↔ warm cream, accents brightened) via a CSS recipe in
-- globals.css. It is a Website Pro flourish, gated server-side in
-- `updateSiteColors` by `eventCoupleWebsiteProActive` — the same gate the two
-- custom colour columns already use.
--
-- NO new relation is created here, so the 2026-07-26 standing rule about
-- REVOKE-ing default privileges on new tables/views does not apply — an added
-- column inherits `events`' existing grants and RLS unchanged.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS site_art_direction text NOT NULL DEFAULT 'daylight';

-- Constrain to the two known values. Named so a violation is self-explaining in
-- logs, and added separately from the column so a re-run is idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_site_art_direction_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_site_art_direction_check
      CHECK (site_art_direction IN ('daylight', 'candlelight'));
  END IF;
END $$;

COMMENT ON COLUMN public.events.site_art_direction IS
  'Pahina guest-site art direction: daylight (default, today''s look) | candlelight (dark direction). Website Pro flourish; write path is updateSiteColors, gated on eventCoupleWebsiteProActive.';

-- Post-condition: every existing row is daylight, i.e. this migration is a
-- no-op for every live event until a Pro couple opts in.
DO $$
DECLARE
  stray integer;
BEGIN
  SELECT count(*) INTO stray FROM public.events WHERE site_art_direction <> 'daylight';
  IF stray > 0 THEN
    RAISE EXCEPTION 'events_site_art_direction: % row(s) are not daylight after backfill', stray;
  END IF;
END $$;
