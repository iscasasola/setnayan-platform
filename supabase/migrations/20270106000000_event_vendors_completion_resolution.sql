-- Event Lifecycle Menu · §6.1 admin backstop — completion resolution (2026-06-16).
--
-- The per-vendor completion handshake (migration 20270101000000) can stall in
-- two ways the couple/vendor can't unstick: a non-delivery DISPUTE freezes the
-- review gate, and a vendor who never marks complete leaves an `awaiting_vendor`
-- row hanging (the N=30d auto-complete eventually fires read-side, but an admin
-- may need to resolve sooner). The /admin/completions surface is the human
-- backstop. It has two outcomes:
--   • force-complete  → completion_status='confirmed' (review/recommendation unlocks)
--   • uphold non-delivery → status stays 'disputed' (review stays frozen — correct
--     for a real non-delivery), but the row is marked resolved so it leaves the queue.
--
-- These two columns are the resolution stamp shared by both outcomes. They are
-- ADMIN-only metadata (written via the service-role client behind the admin gate)
-- — no new RLS policy: the couple/vendor review surfaces already react to
-- completion_status alone (confirmed → unlock, disputed → frozen), so they don't
-- need to read these. The attention query filters on completion_resolved_at to
-- drop handled rows.

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS completion_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_resolution_note TEXT;

COMMENT ON COLUMN public.event_vendors.completion_resolved_at IS
  'Admin completion-handshake resolution timestamp (Event Lifecycle Menu §6.1 backstop). Set on force-complete OR uphold-non-delivery; drops the row from the /admin/completions queue. NULL = unresolved.';
COMMENT ON COLUMN public.event_vendors.completion_resolution_note IS
  'Admin-entered note recorded with completion_resolved_at — what was decided and why.';

-- Partial index: the attention queue scans only unresolved rows.
CREATE INDEX IF NOT EXISTS event_vendors_completion_unresolved_idx
  ON public.event_vendors (completion_status)
  WHERE completion_resolved_at IS NULL;
