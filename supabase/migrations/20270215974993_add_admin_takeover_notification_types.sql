-- ============================================================================
-- 20270215974993_add_admin_takeover_notification_types.sql
--
-- Admin Account-Access Model — Phase 3 (account takeover) notification types.
-- Adds two values to public.notification_type so the takeover flow can tell the
-- TARGET user, in-app + email, that their account is being accessed and (on
-- end) what was changed:
--
--   • admin_takeover_started        — fired on session START (must-fix #4):
--       "A Setnayan team member is accessing your account." Real-time in-app +
--       email (it's on EMAIL_ENABLED_TYPES in lib/notification-emit.ts).
--   • admin_takeover_change_report  — fired on session END (must-fix #5):
--       the list of changes made during the session. In-app + email.
--
-- These mirror the design doc §6 templates (admin_takeover_started /
-- admin_takeover_change_report).
--
-- ALTER TYPE … ADD VALUE IF NOT EXISTS is idempotent + re-run safe. ADD VALUE
-- cannot run inside an explicit transaction block, so this migration is
-- intentionally BARE (no BEGIN/COMMIT). Matches the pattern in
-- 20270205806123_add_completion_accepted_notification_type.sql,
-- 20270129155743_add_notification_types.sql, and
-- 20260907000000_notification_types_cross_actor_signals.sql.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_takeover_started';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_takeover_change_report';
