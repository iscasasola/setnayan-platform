-- ============================================================================
-- 20260513160000_iteration_0028_notifications.sql
-- Iteration 0028 In-App Notifications MVP.
--
-- One row per delivered notification. Notifications are emitted from server
-- actions when something happens that the user should know about:
--   • chat_message — new message in a thread you're a member of
--   • order_quoted — admin confirmed your order's total
--   • order_paid — admin marked your order paid (after matching a payment)
--   • payment_matched — admin approved your logged payment
--   • payment_rejected — admin rejected your logged payment
--
-- Deferred:
--   • Email delivery (waits on Resend SMTP being wired into Supabase)
--   • Push notifications (PWA push API)
--   • Per-channel preferences (couples/vendors get all in-app for V1)
--   • Notification grouping / digest
--
-- Idempotent.
-- ============================================================================

BEGIN;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'chat_message',
    'order_quoted',
    'order_paid',
    'payment_matched',
    'payment_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  type             public.notification_type NOT NULL,
  title            TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 160),
  body             TEXT,
  related_url      TEXT,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, read_at)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_created_at_idx
  ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Pattern A: recipient-only.
DROP POLICY IF EXISTS notifications_recipient_read ON public.notifications;
CREATE POLICY notifications_recipient_read
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Recipients can flip read_at; service-role (admin client) handles INSERT
-- from server actions so the writer's identity doesn't need to be the
-- recipient.
DROP POLICY IF EXISTS notifications_recipient_update ON public.notifications;
CREATE POLICY notifications_recipient_update
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
