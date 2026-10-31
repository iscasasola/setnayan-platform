-- 20271299863206_rsvp_push_groups_on_the_bell_rows.sql
--
-- A GUEST'S REPLY REACHES THE HOST'S PHONE, GROUPED — ONE NOTICE PER WINDOW.
--
-- Owner, 2026-10-31, verbatim: "I keep getting email notifications everytime a
-- person confirms rsvp. How much does that cost us?" → "Can we make the
-- notification instead like facebook even if on website and app?" → "Yes. The
-- notification on the phone not on the app."
--
-- `rsvp_received` leaves the email allowlist and joins the push list, and the
-- push is grouped per host × event: the first reply after a quiet stretch goes
-- out at once, the rest inside 20 minutes fold into ONE later notice ("Maria + 2
-- others replied"). lib/rsvp-push-grouping.ts holds the rule.
--
-- 🔑 THE STATE IS ON THE BELL ROWS THEMSELVES. `pushed_at` says "this reply has
-- been carried by a phone notice". No second table, so the tray and the phone can
-- never disagree about who replied. NULL on every existing row; the push path
-- never reaches back further than two hours (RSVP_PUSH_HORIZON_MS), so the old
-- rows are never pushed.
--
-- RLS: unchanged. `notifications` keeps its Pattern A recipient-only policies; the
-- column is written by the service-role client in lib/rsvp-push.server.ts. A
-- recipient could set their own row's pushed_at through the existing UPDATE
-- policy — the only effect would be to skip their own phone notice.
--
-- Erasure: unchanged. The column lives on `notifications`, whose rows already go
-- with the user (ON DELETE CASCADE from users).

BEGIN;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.notifications.pushed_at IS
  'When a phone notice carried this row (grouped guest replies, '
  'lib/rsvp-push-grouping.ts). NULL = not pushed. Written by the service role only.';

-- The flush's one read: replies still waiting, newest window only.
CREATE INDEX IF NOT EXISTS notifications_rsvp_push_waiting_idx
  ON public.notifications(created_at)
  WHERE type = 'rsvp_received' AND pushed_at IS NULL AND read_at IS NULL;

COMMIT;
