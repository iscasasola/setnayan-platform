-- Event Lifecycle Menu PR3 — event-level "close out the day" clearance.
--
-- Writing cleared_at flips the lifecycle phase Day-of → After (the menu becomes
-- Review · Editorial · Galleries). This is the EVENT-level gate (§6.2), distinct
-- from the per-vendor completion handshake (PR4). Read-side auto-clear at T+24h
-- means After can be entered even if this stays null (no cron — the phase helper
-- evaluates now() against the event date), so this column only records an
-- *explicit* close-out by the couple or a delegated coordinator.
--
-- Audit-only columns; events already carries RLS (couple + coordinator read,
-- couple/coordinator-scoped writes go through the server action behind a
-- membership check). No new policy needed.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cleared_by_user_id UUID;

COMMENT ON COLUMN public.events.cleared_at IS
  'Event Lifecycle Menu: when the couple/coordinator closed out the wedding day (Day-of -> After). NULL until an explicit close-out; the phase helper also auto-clears read-side at T+24h.';
COMMENT ON COLUMN public.events.cleared_by_user_id IS
  'Event Lifecycle Menu: who closed out the day (couple or delegated coordinator).';
