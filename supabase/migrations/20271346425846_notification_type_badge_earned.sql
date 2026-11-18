-- notification_type_badge_earned
-- ============================================================================
-- A SUPPLIER IS TOLD THE MOMENT A BADGE IS EARNED (owner 2026-11-15, DECISION_LOG
-- "SUPPLIER BADGES, SEALS AND REWARDS — THE OWNER'S RULINGS OF 15 NOV": "on a
-- grant: one Today notice + a new `badge_earned` notification/email via
-- emitNotification"). The words are the app's (lib/badge-earned.ts).
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it (same shape as
-- 20271343761700_notification_type_account_suspension.sql).
--
-- 📧 EMAIL: the owner's word is the 15 Nov ruling above ("notification/email");
-- the type is added to the frozen allowlist in the same PR.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'badge_earned';
