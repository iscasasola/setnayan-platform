-- std guest email sent
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ---------------------------------------------------------------------------
-- Save-the-Date guest-email fan-out idempotency (iterations 0024 + 0001 + 0028)
--
-- When a couple LAUNCHES their Save-the-Date (launchSaveTheDate flips
-- events.landing_page_visibility → 'public' + stamps std_launched_at), we now
-- actively EMAIL each guest who has an email address their save-the-date,
-- augmenting the existing shared-link "pull" model with an opt-out-able push.
--
-- This column is the per-guest idempotency guard: it stamps WHEN that guest was
-- emailed their save-the-date, so re-launching (launchSaveTheDate is idempotent
-- and re-stamps) never re-spams a guest who already got theirs. We keep it
-- distinct from the pre-existing guests.invitation_sent_at — that tracks the
-- formal invitation (full RSVP invite, a later moment), whereas this tracks the
-- earlier save-the-date announcement. They are two different sends.
--
-- No RLS change: guests already carries the couple/event-scoped policies from
-- 20260513010000_iteration_0001_guests.sql; a new nullable timestamp column is
-- covered by them unchanged.
-- ---------------------------------------------------------------------------

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS std_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guests.std_sent_at IS
  'When this guest was emailed their Save-the-Date (the launchSaveTheDate fan-out). NULL = not yet sent. Idempotency guard so re-launch never re-emails a guest. Distinct from invitation_sent_at (the later formal RSVP invitation). Iterations 0024/0001/0028.';

-- Partial index: the fan-out query selects guests for an event WHERE
-- std_sent_at IS NULL AND email IS NOT NULL. Indexing the not-yet-sent rows per
-- event keeps re-launch (most rows already stamped) cheap.
CREATE INDEX IF NOT EXISTS guests_std_unsent_idx
  ON public.guests (event_id)
  WHERE std_sent_at IS NULL AND email IS NOT NULL AND deleted_at IS NULL;
