-- ============================================================================
-- 20260909000000_login_ghosting_check.sql
-- Login-driven ghosting escalation (NO cron — owner directive 2026-06-07).
--
-- Why login-driven: at 250k vendors / 1M active accounts a background sweep of
-- every stale inquiry is wasteful and won't scale. Instead the check runs
-- lazily, ONCE per login, using each actor's login moment as the "now":
--   • customer logs in → are any inquiries THEY sent still unanswered past the
--     threshold? → nudge them toward alternatives.
--   • vendor logs in   → are any inquiries THEY received still unanswered? →
--     nudge them to reply (response-rate hygiene).
-- The work is gated by comparing users.last_login_at to a new
-- users.last_ghost_check_at so it fires exactly once per login, never in the
-- background. See apps/web/lib/ghosting.ts + the dashboard layouts.
--
-- This migration adds:
--   1. users.last_ghost_check_at — the "have I run the check for this login?"
--      marker (users.last_login_at already exists since the 0000 shell schema,
--      and is now actually written at login — see lib/login-activity.ts).
--   2. Two notification_type values for the nudges.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_ghost_check_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.last_ghost_check_at IS
  'Last time the login-driven ghosting check ran for this user. Compared to last_login_at so the check fires once per login (no cron). Written by apps/web/lib/ghosting.ts.';

-- notification_type additions. ADD VALUE IF NOT EXISTS is idempotent; this
-- migration only adds the values (runtime emits them), so it is transaction-safe.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'inquiry_awaiting_reply';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'inquiry_no_response';
