-- ============================================================================
-- 20270920601523_force_majeure_escalated_status.sql
--
-- Gap audit 2026-07-23 · Batch B2. Add the 'escalated' status to
-- force_majeure_flags so the lazy stale-flag sweep can advance an untouched
-- dispute for admin attention INSTEAD of silently marking it 'resolved'.
--
-- WHY: sweepEscalateStaleFlags (was sweepAutoResolveStaleFlags) fires from any
-- page that surfaces flags — the admin triage queue AND the couple's own
-- disputes page — and used to UPDATE every stale open/under_review flag to
-- 'resolved' from that mere pageview: a destructive close of a dispute nobody
-- acted on, and the "escalated" path the help/tour copy promises never existed.
-- The sweep now sets 'escalated'; the admin queue's default filter admits it, so
-- the flag stays visible for a real human to decide. Nothing auto-CLOSES.
--
-- Widens the CHECK only (adds one value) — never rejects an existing row.
-- IDEMPOTENT: DROP CONSTRAINT IF EXISTS + ADD.
-- ============================================================================

BEGIN;

ALTER TABLE public.force_majeure_flags
  DROP CONSTRAINT IF EXISTS force_majeure_flags_status_check;

ALTER TABLE public.force_majeure_flags
  ADD CONSTRAINT force_majeure_flags_status_check
  CHECK (status IN (
    'open',
    'under_review',
    'escalated',
    'refund_issued',
    'rescheduled',
    'partial_credit',
    'mediation',
    'resolved',
    'dismissed'
  ));

COMMIT;
