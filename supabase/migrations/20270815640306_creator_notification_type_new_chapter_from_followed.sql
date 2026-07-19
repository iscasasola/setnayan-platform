-- ============================================================================
-- 20270815640306_creator_notification_type_new_chapter_from_followed.sql
-- Creator "Adventure Chapter" — AUDIENCE layer · notify-on-new-chapter enum.
--
-- Spec: ~/Documents/Claude/Projects/Setnayan/
--         Creator_Adventure_Chapter_Build_Plan_2026-07-16.md   (audience layer)
--       + Creator_Program_Council_Verdict_2026-07-15.md
--
-- One new `notification_type` enum value so the follow-fanout — when a user
-- PUBLISHES a chapter, their followers get told — can reach public.notifications
-- at all. Emitted from app code (the publishChapter server action → emitNotification),
-- gated on the follower's existing marketing consent (users.marketing_opt_in) so
-- it never spams an opted-out account (RA 10173).
--
-- WHY A SEPARATE, DEDICATED MIGRATION: Postgres forbids USING a newly-added
-- enum value in the SAME transaction that adds it. This file ONLY runs the
-- ALTER TYPE (no INSERT/UPDATE references the value here), so the value is
-- committed before any later migration or runtime code touches it. Mirrors the
-- house pattern from 20270527224949_setnayan_ai_guard_notifications.sql.
--
-- Idempotent — ADD VALUE IF NOT EXISTS.
-- ============================================================================

ALTER TYPE public.notification_type
  ADD VALUE IF NOT EXISTS 'new_chapter_from_followed';
