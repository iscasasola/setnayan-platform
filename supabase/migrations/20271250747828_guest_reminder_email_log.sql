-- ============================================================================
-- 20271250747828_guest_reminder_email_log.sql
--
-- THE LOCK UNDER THE GUEST REMINDER EMAILS — 30 · 7 · 1 days before the event
-- (DECISION_LOG 2026-09-26 "THE LAST 30 DAYS: EACH GUEST GETS YOUR CHECKLIST"
-- → "Plus optional reminder EMAILS at 30 / 7 / 1 days to guests with an email
-- (no SMS in V1; couple can switch off; links to their own page)"; scheduled
-- before the Apple check by the 2026-09-28 row "EVERY EVENT HUB BUILD
-- FINISHES BEFORE THE APPLE CHECK").
--
-- One row per (guest, milestone, event date), inserted BEFORE the send by
-- `runGuestReminderEmails` (lib/guest-reminder-emails.ts) — the same
-- insert-first claim `supplier_night_before_email_log` and
-- `anniversary_headsup_log` use. The PRIMARY KEY is the idempotency: two
-- requests racing the same 6-hour window both try the insert and exactly one
-- wins (the other sees 23505 and sends nothing). A send that Resend refuses
-- deletes its row so a later run retries — a possible duplicate beats a
-- reminder nobody ever got.
--
-- `event_date` is part of the key ON PURPOSE: a couple who moves the day gets
-- a fresh set of reminders for the new date, because the reminder's content
-- ("30 days to 18 December") was about the old one.
--
-- Service/admin only: the cron-free job writes through the service role
-- (bypasses RLS); admins may read for support. No couple, guest or public
-- access — the couple never sees per-guest reminder state, exactly as they
-- never see a guest's checklist ticks (`guest_checklist_ticks`).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + ENABLE RLS; no policy (service role only).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_reminder_email_log (
  guest_id        UUID        NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  event_id        UUID        NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Days before the event this reminder was for. The three milestones the
  -- owner named, and only those — a fourth needs a decision, not a row.
  milestone_days  SMALLINT    NOT NULL CHECK (milestone_days IN (30, 7, 1)),
  event_date      DATE        NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_id       TEXT,
  PRIMARY KEY (guest_id, milestone_days, event_date)
);

CREATE INDEX IF NOT EXISTS guest_reminder_email_log_event_idx
  ON public.guest_reminder_email_log (event_id);

ALTER TABLE public.guest_reminder_email_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.guest_reminder_email_log IS
  'Idempotency lock for the guest reminder emails at 30/7/1 days before the event (owner 2026-09-26). One row per guest × milestone × event date, inserted BEFORE the send by runGuestReminderEmails (lib/guest-reminder-emails.ts); the PK is what stops a double-send when two requests race the same window. Service-role writer; admin read only.';

-- Close the stock `GRANT ALL ... TO anon, authenticated` a new table is born
-- with (Supabase default) — a log table with an admin-only policy must not
-- still hand the public internet a table-level grant as its "defence in depth".
-- Server-only: the reminder job writes it with the service role, and nothing
-- signed in reads it. A table in `public` inherits the default grants, and RLS
-- is ROW-level — it cannot hide a column — so the grants come off for BOTH
-- roles (exposure-freeze.db.test.ts, 2026-09-28).
REVOKE ALL ON public.guest_reminder_email_log FROM anon, authenticated;

-- No policy: RLS on with no policy + no grants = service role only (the
-- reminder job). Nothing signed in reads this log; admin reads go through
-- the service role like every other job ledger.

COMMIT;
