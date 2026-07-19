-- 20270801100000_events_is_surprise.sql
-- Surprise-mode ("hidden website") — owner-locked 2026-07-12, chosen scope
-- "just the hidden website".
--
-- Some events are a SURPRISE for the person being celebrated (a surprise 50th
-- anniversary the kids are planning, a surprise 60th for Lola). The risk is the
-- event's public website: if the link leaks, the honoree can stumble on it and
-- the surprise is spoiled. The FIX reuses the machinery already in place —
-- landing_page_visibility='private' + scheduled_launch_at=<event date> keeps the
-- site sealed until the day and the cron-free read-time auto-launch
-- (lib/launch-save-the-date.ts) reveals it. This flag adds only the host-facing
-- FRAMING: "this is a surprise", so the dashboard can say "🤫 hidden until <date>"
-- instead of the generic "scheduled launch". The public page never reads it (the
-- seal is visibility + schedule only), so this is a host-side marker with no
-- effect on what guests see.
--
-- Attribute-only People-layer (owner 2026-07-12): the honoree is data on the
-- event, not a login — so there is nothing to hide in-app; the website is the
-- only leak surface, which this covers.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_surprise BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.is_surprise IS
  'Host-side marker that this event is a surprise for the honoree. Drives "hidden until <date>" framing; the actual site seal is landing_page_visibility + scheduled_launch_at. Owner-locked 2026-07-12.';

-- No RLS change: is_surprise is an ordinary column on events, covered by the
-- existing events row policies (hosts read/write their own event).
