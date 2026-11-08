-- a_message_can_be_hearted
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- A MESSAGE CAN BE HEARTED — THE ONE BUILD, lane C2 (owner 8 Nov 2026, v111
-- "tap = heart"; spec plans/supplier_one_build_2026-11-08 §5.2, B1 §3b).
--
-- One row per (message, person). Un-heart = hearted := false (no DELETE), so
-- every change is an UPDATE that realtime can filter by thread_id on the
-- EXISTING chat-${threadId} channel (a second .on(), no new connection).
--
-- RLS — mirrors the AS-BUILT chat_messages policies, not spec "Pattern E":
--   current_thread_ids() is an empty stub in prod (noted in 20271295352678).
--   The live read predicate is chat_messages_member_read
--   (20260821000000_vendor_role_aware_rls.sql): couple member · the thread's
--   shop · a viewer-seat agent on an event they handle. Copied branch for
--   branch, with auth calls written once per statement (policies-ask-once).
--
-- ⚠ CORRECTION TO THE PLAN (B1 §3b said the block guard is "inherited" through
--   the INSERT policy's EXISTS on chat_messages): chat_messages_block_guard is
--   RESTRICTIVE **FOR INSERT** only. An EXISTS subquery is a SELECT and does
--   not see it — a blocked person can still READ the thread. So hearts carry
--   their own RESTRICTIVE block guard (insert + update), the same pair rule
--   as chat_messages_block_guard (20270223909213) asked through a SECURITY
--   DEFINER helper (chat_pair_is_blocked) — see the guard section for why
--   the inline form is defeated by the caller's RLS.
--
-- Scope columns (thread, event, shop) are DERIVED from the message in a
-- BEFORE trigger, never trusted from the client; user_id is forced to the
-- caller. Rows die with their message (CASCADE) and with their person.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_message_hearts (
  message_id        UUID        NOT NULL REFERENCES public.chat_messages(message_id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id         UUID        NOT NULL,
  event_id          UUID        NOT NULL,
  vendor_profile_id UUID,
  hearted           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
ALTER TABLE public.chat_message_hearts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS chat_message_hearts_thread_idx
  ON public.chat_message_hearts (thread_id) WHERE hearted;
CREATE INDEX IF NOT EXISTS chat_message_hearts_user_idx
  ON public.chat_message_hearts (user_id);

COMMENT ON TABLE public.chat_message_hearts IS
  'A ♥ on one chat message by one person (owner 8 Nov 2026, v111 tap-to-heart). One row per (message_id, user_id); un-heart sets hearted = false (no DELETE). thread_id / event_id / vendor_profile_id are derived from the message by tg_chat_message_hearts_scope; user_id is always the caller. RLS mirrors chat_messages_member_read; a RESTRICTIVE block guard mirrors chat_messages_block_guard.';

-- Derive the scope from the message; a heart is always the caller's own.
CREATE OR REPLACE FUNCTION public.tg_chat_message_hearts_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT m.thread_id, m.event_id, m.vendor_profile_id
    INTO NEW.thread_id, NEW.event_id, NEW.vendor_profile_id
    FROM public.chat_messages m
   WHERE m.message_id = NEW.message_id;
  IF NEW.thread_id IS NULL THEN
    RAISE EXCEPTION 'chat_message_hearts: unknown message %', NEW.message_id
      USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- A heart never changes hands or messages.
    NEW.user_id    := OLD.user_id;
    NEW.message_id := OLD.message_id;
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.user_id    := COALESCE(auth.uid(), NEW.user_id);
    NEW.created_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_chat_message_hearts_scope() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_message_hearts_scope ON public.chat_message_hearts;
CREATE TRIGGER chat_message_hearts_scope
  BEFORE INSERT OR UPDATE ON public.chat_message_hearts
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_message_hearts_scope();

-- READ: the same three branches as chat_messages_member_read.
DROP POLICY IF EXISTS chat_message_hearts_member_read ON public.chat_message_hearts;
CREATE POLICY chat_message_hearts_member_read
  ON public.chat_message_hearts FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  );

-- WRITE: own row only, on a message the caller can read (the EXISTS runs
-- under chat_messages' SELECT policy as the caller).
DROP POLICY IF EXISTS chat_message_hearts_own_insert ON public.chat_message_hearts;
CREATE POLICY chat_message_hearts_own_insert
  ON public.chat_message_hearts FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.message_id = chat_message_hearts.message_id)
  );

DROP POLICY IF EXISTS chat_message_hearts_own_update ON public.chat_message_hearts;
CREATE POLICY chat_message_hearts_own_update
  ON public.chat_message_hearts FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.message_id = chat_message_hearts.message_id)
  );
-- No DELETE policy and no DELETE grant: un-heart = hearted := false.

-- BLOCK GUARD: a blocked pair cannot heart in their shared thread.
-- Asked through a SECURITY DEFINER helper, NOT inline: inline, the
-- "who is on the other side" lookups (event_members, vendor_profiles) run
-- under the CALLER's RLS — and a couple cannot see an unpublished shop's
-- vendor_profiles row, nor a supplier the event's members, so the inline
-- subquery comes back empty and the guard PASSES for exactly the blocked
-- pair. (Measured on this replay: the shipped chat_messages_block_guard lets
-- a blocker post into an unpublished shop's thread for that reason — flagged
-- in build-notes/supplier-1build-c2.md, outside this lane.) The helper only
-- ever answers about the CALLER (auth.uid()), so it discloses nothing.
CREATE OR REPLACE FUNCTION public.chat_pair_is_blocked(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.blocked_users b
     WHERE auth.uid() IN (b.blocker_user_id, b.blocked_user_id)
       AND (CASE WHEN b.blocker_user_id = auth.uid()
                 THEN b.blocked_user_id ELSE b.blocker_user_id END)
           IN (
             SELECT em.user_id FROM public.event_members em
              WHERE em.event_id = p_event_id AND em.member_type = 'couple'
             UNION
             SELECT vp.user_id FROM public.vendor_profiles vp
              WHERE vp.vendor_profile_id = p_vendor_profile_id
             UNION
             SELECT vtm.user_id FROM public.vendor_team_members vtm
              WHERE vtm.vendor_profile_id = p_vendor_profile_id
           )
  );
$$;

REVOKE ALL ON FUNCTION public.chat_pair_is_blocked(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_pair_is_blocked(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.chat_pair_is_blocked(UUID, UUID) IS
  'TRUE when the CALLER and anybody on the other side of this event × shop conversation (the event''s couple members, the shop owner, its team) have a blocked_users row between them, either direction. Read without the caller''s RLS so an unseen shop or member cannot make the answer FALSE. Answers only about auth.uid().';

DROP POLICY IF EXISTS chat_message_hearts_block_guard_insert ON public.chat_message_hearts;
CREATE POLICY chat_message_hearts_block_guard_insert
  ON public.chat_message_hearts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.chat_pair_is_blocked(event_id, vendor_profile_id));

DROP POLICY IF EXISTS chat_message_hearts_block_guard_update ON public.chat_message_hearts;
CREATE POLICY chat_message_hearts_block_guard_update
  ON public.chat_message_hearts
  AS RESTRICTIVE FOR UPDATE TO authenticated
  WITH CHECK (NOT public.chat_pair_is_blocked(event_id, vendor_profile_id));

-- REVOKE ALL first: the platform's default privileges hand `authenticated`
-- DELETE (and TRUNCATE) on every new table; without this, "no DELETE" would
-- rest on the absence of a policy alone.
REVOKE ALL ON public.chat_message_hearts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_message_hearts TO authenticated;
GRANT ALL ON public.chat_message_hearts TO service_role;

-- Realtime: on the existing publication (guarded so a replay without the
-- publication stays green, as 20270711955398 does).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
                       AND tablename = 'chat_message_hearts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_hearts;
  END IF;
END $$;

COMMIT;
