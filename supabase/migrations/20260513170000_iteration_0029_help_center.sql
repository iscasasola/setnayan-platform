-- ============================================================================
-- 20260513170000_iteration_0029_help_center.sql
-- Iteration 0029 Help Center MVP — contact-form inbox.
--
-- One row per submitted help-message. Anonymous visitors can INSERT (the
-- public /help page is the form); admins read + work the queue via
-- /admin/help using the service-role client.
--
-- Deferred:
--   • Article CMS (V1 hardcodes articles in apps/web/lib/help.ts)
--   • AI-powered search across articles
--   • Per-article analytics
--   • Multi-language (EN only)
--   • Reply-via-email (waits on Resend SMTP)
--
-- Idempotent.
-- ============================================================================

BEGIN;

DO $$ BEGIN
  CREATE TYPE public.help_message_status AS ENUM ('new', 'in_progress', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.help_messages (
  message_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id           TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('M'),
  user_id             UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  sender_email        TEXT NOT NULL CHECK (length(sender_email) > 0 AND length(sender_email) <= 160),
  sender_name         TEXT CHECK (sender_name IS NULL OR length(sender_name) <= 128),
  topic               TEXT,
  subject             TEXT NOT NULL CHECK (length(subject) > 0 AND length(subject) <= 160),
  body                TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  status              public.help_message_status NOT NULL DEFAULT 'new',
  admin_notes         TEXT,
  handled_by_user_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS help_messages_status_idx ON public.help_messages(status);
CREATE INDEX IF NOT EXISTS help_messages_created_at_idx ON public.help_messages(created_at DESC);

ALTER TABLE public.help_messages ENABLE ROW LEVEL SECURITY;

-- Anon visitors + authenticated users can both submit a help message. The
-- public /help page hits this directly with anon credentials so guests can
-- reach support without a Setnayan account.
DROP POLICY IF EXISTS help_messages_anyone_insert ON public.help_messages;
CREATE POLICY help_messages_anyone_insert
  ON public.help_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Authenticated submitters can read their own past messages back.
DROP POLICY IF EXISTS help_messages_sender_read ON public.help_messages;
CREATE POLICY help_messages_sender_read
  ON public.help_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- All UPDATE / DELETE plus admin-side SELECT goes through the service-role
-- client in /admin/help — no policy required (admin client bypasses RLS).

COMMIT;
