-- ============================================================================
-- 20260514140000_enable_realtime_chat.sql
-- Enable Supabase Realtime for chat + notifications.
--
-- Iteration 0019 originally shipped 1:1 chat with V1 = page refresh on send.
-- This migration upgrades that to <500ms live updates by adding the chat and
-- notification tables to the `supabase_realtime` PostgreSQL publication. The
-- publication is created automatically by Supabase for every project, so we
-- just have to opt the right tables in.
--
-- RLS is already in place on every table touched here (see iterations 0019
-- and 0028), and Realtime honors RLS — clients only receive change events
-- for rows they're authorized to SELECT. No extra policy work is needed.
--
-- Idempotent: each ALTER PUBLICATION is wrapped in a DO block that checks
-- pg_publication_tables first, so re-running the migration is a no-op.
-- ============================================================================

BEGIN;

-- chat_messages — INSERTs drive the live message stream. UPDATEs are kept
-- in the publication so future read-receipt / edit features don't need a
-- second migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- chat_threads — UPDATEs to updated_at are emitted by the
-- bump_chat_thread_updated_at trigger every time a message lands. Adding
-- the table to the publication lets thread-list views reorder live without
-- a refresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;
  END IF;
END $$;

-- notifications — drives the unread bell badge in the top nav. Both INSERTs
-- (new notification) and UPDATEs (recipient flips read_at) need to flow to
-- the client so the badge stays accurate without a page reload.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

COMMIT;
