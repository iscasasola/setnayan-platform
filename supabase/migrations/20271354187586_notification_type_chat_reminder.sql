-- notification_type_chat_reminder
-- Created via `pnpm migration:new`. Idempotent: ADD VALUE IF NOT EXISTS only. Writes NO data.
-- ============================================================================
-- ⏰ UNICHAT PART H1 — "Remind me" on a chat message (approved Unichat prototype v3, DECISION_LOG 2026-11-20
-- "Unichat live prototype v3 APPROVED": "… edit/unsend, seen-by, failed-send retry, voice notes, reminders …").
--
-- The notice a person gets back when a reminder THEY set on a message comes due. Sent by
-- `lib/chat-reminders.server.ts` (`deliverDueChatReminders`), to the person who set it and nobody else.
-- 📧 IN-APP ONLY — never on EMAIL_ENABLED_TYPES (owner rule 2026-10-11: no new emails without his word).
--
-- Alone in its own file on purpose: Postgres forbids USING a newly added enum value in the same transaction that
-- adds it, so the tables and functions that go with it live in the next migration.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'chat_reminder';
