-- notification_type_papic_originals_reminder
-- ============================================================================
-- 📸 THE PHOTO RULE'S REMINDERS (owner 2026-11-03, DECISION_LOG "THE PHOTO
-- RULE"): originals are kept until 3 months after the event's LAST day; the
-- host is reminded IN THE APP at day 60, 80 and 89 of that window —
-- "Copy to Google Drive (free) or Download all". No new emails.
--
-- `papic_originals_reminder` → each host (event_members.member_type = 'couple')
-- of an event whose originals are still kept. Sent by
-- apps/web/lib/papic-originals-reminder.ts, once per stage per host.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it. Same shape as
-- 20271303211103_notification_type_coordinator_invited.sql.
--
-- ⛔ IN-APP ONLY. Not on the email allowlist (lib/notification-emit.ts).
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'papic_originals_reminder';
