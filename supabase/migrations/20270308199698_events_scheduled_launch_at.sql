-- events.scheduled_launch_at — couple-set future go-live for the wedding website.
--
-- Owner ask 2026-06-28: couples want to "align when the website will launch"
-- (pick a future date/time) on top of the existing "Launch now" button.
--
-- Cron-free by design (project lock: NO polling crons). Nothing flips this row
-- on a timer. Instead the public page gate (apps/web/app/[slug]/page.tsx)
-- evaluates it at READ TIME: when landing_page_visibility is still 'private'
-- AND scheduled_launch_at <= now(), the page renders as public for that request
-- and a deferred after() task persists the flip (visibility -> 'public',
-- std_launched_at stamped, scheduled_launch_at cleared) + fans out the
-- Save-the-Date emails (idempotent per guests.std_sent_at). So visibility is
-- exact at the scheduled instant; the DB write-through + email push happen on
-- the first page load past that instant.
--
-- NULL = no schedule (the default — launch is manual via launchSaveTheDate).
-- Cleared back to NULL the moment the event goes public (manual or scheduled).
--
-- RLS: events already has couple/host policies; this column is written only via
-- host-gated server actions (requireCouple) and the admin client in the
-- read-time flip, so no new policy is required.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS scheduled_launch_at timestamptz;

COMMENT ON COLUMN public.events.scheduled_launch_at IS
  'Couple-set future go-live for the wedding website. Cron-free: the /[slug] '
  'gate treats a private page as public once now() >= this, then lazily '
  'persists the flip + STD emails via after(). NULL = no schedule; cleared on '
  'go-public (manual or scheduled). See migration 20270308199698.';
