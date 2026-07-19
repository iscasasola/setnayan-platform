-- notification_type_inquiry_displaced
-- ============================================================================
-- EXCLUSIVITY on lock · new notification_type value `inquiry_displaced`.
--
-- When a couple LOCKS a hard-single pick (one venue/officiant/coordinator/host/
-- LED at a time), the OTHER marketplace vendors they were inquiring in the same
-- group are out of the running: their open inquiry threads are moved to the
-- provisioned `chat_inquiry_status = 'displaced'` state (20261126000000 · "slot
-- filled by another booking — REVIVABLE") and each released vendor is notified.
-- This is the notification type for that release.
--
-- Bare ADD VALUE (no surrounding transaction) — matches the other
-- notification_type_* migrations. The value is only USED at runtime
-- (emitNotification), never inside this migration, so PG's "can't use a new
-- enum value in the same tx it was added" rule is not engaged. Idempotent.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'inquiry_displaced';
