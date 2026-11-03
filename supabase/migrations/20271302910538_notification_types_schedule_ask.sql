-- notification_types_schedule_ask
-- ============================================================================
-- 🗓 THE HOST ASKS A SUPPLIER TO CHANGE THEIR TIMES — AND HEARS THE ANSWER.
-- (owner 2026-11-02, DECISION_LOG "A SUPPLIER'S SCHEDULE BASICS FOR THIS
-- WEEK", item 2: *"receive requests for schedules from hosts of the event and
-- coordinator"*.)
--
--   schedule_ask           → the SUPPLIER: a host or the coordinator asks them
--                            to change their times on a moment.
--   schedule_ask_answered  → the person who ASKED: the supplier said yes (the
--                            moment moved) or no (with their reason).
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it. Same shape as
-- 20271262858364_notification_type_schedule_change_requested.sql.
--
-- ⛔ IN-APP ONLY. Neither is on the email allowlist (lib/notification-emit.ts)
-- — owner rule 2026-10-11: no new emails without his word. That is also why
-- the supplier's notice is NOT `schedule_change_requested`: that one is
-- emailed.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'schedule_ask';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'schedule_ask_answered';
