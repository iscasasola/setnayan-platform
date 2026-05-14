-- ============================================================================
-- 20260514010000_notification_type_additions.sql
-- Iteration 0028 follow-up — expand the notification_type enum to cover the
-- new transactional events plumbed in this iteration.
--
-- New values:
--   • rsvp_received          — already emitted from /[slug]/actions.ts but
--                              missing from the DB enum until now; the live
--                              insert was failing silently (emitNotification
--                              swallows the error).
--   • help_ticket_replied    — admin posts a reply on /admin/help; the help
--                              ticket owner gets in-app + Resend email.
--   • vendor_inquiry_received — couple's first message to a vendor thread; the
--                               vendor user gets in-app + Resend email.
--
-- ALTER TYPE … ADD VALUE IF NOT EXISTS is idempotent. Each statement runs
-- outside the surrounding migration transaction so re-running this file on
-- a remote DB that already has the values is a no-op.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'rsvp_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'help_ticket_replied';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_inquiry_received';
