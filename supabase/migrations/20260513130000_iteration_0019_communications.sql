-- ============================================================================
-- 20260513130000_iteration_0019_communications.sql
-- Iteration 0019 Communications MVP — 1:1 chat only.
--
-- A chat thread is the conversation between ONE event (couple side) and ONE
-- vendor (vendor side). UNIQUE(event_id, vendor_profile_id) guarantees one
-- thread per pairing — opening "Message vendor" again just resumes the
-- existing conversation.
--
-- Deferred:
--   • Realtime (V1 = page refresh on send)
--   • Group chat / multi-vendor threads
--   • Video meetings (Daily.co)
--   • File attachments + viewers
--   • Coordinator-join (3rd party joins thread)
--   • Read receipts, typing indicators, push notifications
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Helper: SETOF UUID of vendor_profile_ids owned by the current user
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_vendor_profile_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT vendor_profile_id FROM public.vendor_profiles
  WHERE user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 2. chat_sender_role enum
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.chat_sender_role AS ENUM ('couple', 'vendor', 'coordinator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. chat_threads
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_threads (
  thread_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id           TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('H'),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id   UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  created_by_user_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, vendor_profile_id)
);

CREATE INDEX IF NOT EXISTS chat_threads_event_id_idx
  ON public.chat_threads(event_id);
CREATE INDEX IF NOT EXISTS chat_threads_vendor_profile_id_idx
  ON public.chat_threads(vendor_profile_id);

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

-- Either party in the thread can read.
DROP POLICY IF EXISTS chat_threads_member_read ON public.chat_threads;
CREATE POLICY chat_threads_member_read
  ON public.chat_threads FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- Either party can create / update / delete a thread between themselves.
DROP POLICY IF EXISTS chat_threads_member_write ON public.chat_threads;
CREATE POLICY chat_threads_member_write
  ON public.chat_threads FOR ALL
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- ----------------------------------------------------------------------------
-- 4. chat_messages
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_messages (
  message_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id           UUID NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id   UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  sender_user_id      UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  sender_role         public.chat_sender_role NOT NULL,
  body                TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_id_idx
  ON public.chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS chat_messages_event_id_idx
  ON public.chat_messages(event_id);
CREATE INDEX IF NOT EXISTS chat_messages_vendor_profile_id_idx
  ON public.chat_messages(vendor_profile_id);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_messages_member_read ON public.chat_messages;
CREATE POLICY chat_messages_member_read
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- Messages are append-only: INSERT only, no UPDATE / DELETE policy means
-- those are denied for authenticated users by default.
DROP POLICY IF EXISTS chat_messages_member_insert ON public.chat_messages;
CREATE POLICY chat_messages_member_insert
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- ----------------------------------------------------------------------------
-- 5. Bump thread updated_at on message insert
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bump_chat_thread_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_threads
  SET updated_at = NEW.created_at
  WHERE thread_id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.chat_messages;
CREATE TRIGGER on_chat_message_inserted
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_chat_thread_updated_at();

COMMIT;
