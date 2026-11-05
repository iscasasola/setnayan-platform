-- notification_type_schedule_released
-- ============================================================================
-- 📣 "YOUR FULL SCHEDULE IS READY" — TO A GUEST WITH AN ACCOUNT (owner
-- 2026-11-01, DECISION_LOG "FULL SCHEDULE: A HOST OR COORDINATOR PRESSES
-- RELEASE, NOTIFICATIONS ONLY"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md
-- §3 "Basic, then full (Release)"). Owner, verbatim: *"Coordinator or host
-- presses release"* · *"Just norifications please"*.
--
-- No existing type says it truthfully: `schedule_shifted` is about the clock
-- moving, not about a guest's own schedule opening. Written by the database
-- itself, in `release_full_schedule` (20271302139506). In-app only — NOT on the
-- email allowlist (no email, the owner's ruling).
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it (same shape as
-- 20271301389353_notification_type_supplier_where_changed.sql).
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'schedule_released';
