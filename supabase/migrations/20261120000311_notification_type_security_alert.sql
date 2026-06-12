-- ============================================================================
-- 20261120000311_notification_type_security_alert.sql
-- One new notification_type enum value — the 10th (and last unwired) 0028 V1
-- template:
--   security_alert — account-holder-facing: "Your password was changed".
--       Fired from lib/account-security-actions.ts → changePassword() and
--       app/reset-password/actions.ts → completePasswordReset() after the
--       password update succeeds. Deliberately NOT fired from
--       signOutOtherDevices() — that's the remedy, not the threat. This is
--       the follow-up PR #1262 skipped because the type is enum-constrained.
-- Mirrored in apps/web/lib/notifications.ts (union + label + tone) and the
-- web-push allowlist in apps/web/lib/notification-emit.ts (security alerts
-- are exactly the high-signal, time-sensitive class push exists for).
--
-- ALTER TYPE … ADD VALUE IF NOT EXISTS is idempotent and re-run safe. Matches
-- the pattern in 20260918000100_token_purchase_notification_types.sql and
-- 20260907000000_notification_types_cross_actor_signals.sql.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'security_alert';
