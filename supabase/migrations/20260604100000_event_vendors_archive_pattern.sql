-- ============================================================================
-- 20260604100000_event_vendors_archive_pattern.sql
--
-- Cross-category vendor recommendations · finalize auto-cleanup
-- (CLAUDE.md 2026-05-22 owner directive).
--
-- Adds:
--   • event_vendors.archived_at TIMESTAMPTZ — soft-archive timestamp set
--     by the finalizeVendor server action when the host locks ONE vendor
--     in a category, so the other considering picks in that same category
--     get archived (host has committed). NULL = active; populated = the
--     row no longer surfaces on the planning grid (and won't be counted
--     as a "considering" option-on-the-table) but stays in DB for audit
--     + potential restore.
--   • event_vendors_archived_at_idx — partial index covering only
--     non-archived rows for the planning-grid query path.
--
-- Why a soft-delete column instead of overloading `status`:
--   • The vendor_status enum is already saturated with 6 status values
--     (considering / shortlisted / contracted / deposit_paid / delivered
--     / complete) — every value carries semantic meaning. Adding
--     'archived' would conflate "host committed to someone else" with
--     "row removed from active consideration," and would force every
--     enum consumer to add `IN ('archived', ...)` filters.
--   • Keeps row provenance: the host's prior research stays in DB
--     even after they commit elsewhere. If they later switch their lock
--     (via the existing SwitchVendorConfirm flow), the archived options
--     can be restored.
--   • Mirrors the `events.archived` pattern from CLAUDE.md 2026-05-09 lock
--     (events table soft-delete instead of hard-delete).
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Partial index: only NON-archived rows make it into the home grid query
-- (`WHERE archived_at IS NULL` filter on the planning fetch). Keeps the
-- index slim so the home-page query path doesn't pay for archived row
-- scanning that no longer surfaces in UI.
CREATE INDEX IF NOT EXISTS event_vendors_active_idx
  ON public.event_vendors(event_id)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN public.event_vendors.archived_at IS
  'Soft-archive timestamp. Set by finalizeVendor when the host locks ONE vendor in a category, archiving the other considering picks in that same category. NULL = active; populated = no longer surfaces on the planning grid but kept for audit + restore.';

COMMIT;
