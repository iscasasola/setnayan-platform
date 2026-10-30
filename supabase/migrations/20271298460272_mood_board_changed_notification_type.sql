-- mood_board_changed_notification_type
-- ============================================================================
-- 🖼⏱ "COORDINATOR ANA CHANGED THE MOOD BOARD · STAGE" — TO EVERY OWNER
-- (owner 2026-10-30, DECISION_LOG "MOOD BOARD CHANGES: SUPPLIERS ASK,
-- COORDINATORS APPLY, THE OWNERS HAVE 24 HOURS TO UNDO"): a change by anyone
-- the hosts gave Mood Board Edit applies at once, and every owner gets ONE
-- in-app notice per change, with an Undo that lasts 24 hours. In-app only —
-- no email, no push.
--
-- No existing type says it truthfully: `mood_board_share` reads "Mood board
-- shared" and is a couple → supplier nudge. Written by the trigger in
-- 20271299051148_mood_board_changes_undo_24h.sql.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it (same shape as
-- 20271284540209_notification_type_schedule_shifted.sql).
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'mood_board_changed';
