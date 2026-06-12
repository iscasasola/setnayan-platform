-- Panood Watch-Live on the guest day-of page (spec §7.5 service-visibility
-- map, slice 3 — owner 2026-06-12: "panood … must be on the on-the-day part").
--
-- One nullable TEXT on events: the canonical YouTube watch URL of the
-- couple's Panood broadcast. Written from the Panood setup page (host-guarded
-- server action that normalizes/validates YouTube URLs before persisting —
-- apps/web/lib/panood-watch.ts) until the broadcaster auto-creation lands,
-- which will write the same column from the YouTube Data API. The guest page
-- renders a Watch-Live embed during the live window when this is set AND the
-- event holds the PANOOD_SYSTEM activation.
--
-- RLS: no new policies — events UPDATE is already host-scoped; the public
-- page reads via the admin client like every other landing column (the URL
-- is, by definition, a public watch link).
--
-- Additive + idempotent; safe on a live database.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS panood_watch_url TEXT;

COMMENT ON COLUMN public.events.panood_watch_url IS
  'Canonical YouTube watch URL for the Panood live broadcast (normalized https://www.youtube.com/watch?v=<id>). NULL = not yet staged. Guest day-of page embeds it (youtube-nocookie) during the live window when PANOOD_SYSTEM is active.';
