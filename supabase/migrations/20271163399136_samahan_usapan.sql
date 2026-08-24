-- samahan_usapan
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
--
-- Usapan — the samahan's chat room (owner 2026-08-24: "can we set a chat room
-- on the page?"). The page has carried an honest "coming soon" note since
-- 2026-07-15; this replaces it.
--
-- ⛔ WHY NOT `chat_threads` (which the 2026-07-15 plan owner-locked as "reuse
-- 0019 chat"): read out of prod, that table is a BOOKING NEGOTIATION, not a
-- chat primitive — `event_id` NOT NULL, `vendor_profile_id` NOT NULL, plus
-- inquiry_status · pax_at_inquiry · agreed_price_centavos · locked_at. A
-- samahan chat has neither an event nor a vendor. Reusing it would mean
-- making both FKs nullable and re-reasoning every RLS policy and consumer
-- that assumes a vendor thread — i.e. touching the live booking system to
-- ship a group chat. This table is the smaller, isolated answer, and the
-- plan's "full PR series" estimate was sized against the reuse, not this.
--
-- Retention: messages, not photos — the corpus's 5-year CHAT rule applies and
-- is NOT reinvented here. No sweep is added; `purge_expired_chat` remains the
-- one place that decides when a message is old.

BEGIN;

CREATE TABLE IF NOT EXISTS public.samahan_messages (
  id            BIGSERIAL PRIMARY KEY,
  message_id    UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  community_id  UUID NOT NULL REFERENCES public.communities(community_id) ON DELETE CASCADE,
  -- The author. CASCADE + NOT NULL: a message is the person's own words, so
  -- it goes with their account (classified in lib/erasure/coverage.ts).
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  -- Author take-down is a SOFT delete: the row survives so the thread does
  -- not silently reflow under people who are reading it, and so a moderation
  -- question later has something to look at. Readers filter on it.
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.samahan_messages IS
  'Usapan — a samahan''s group chat (owner 2026-08-24). Members read + post; authors soft-delete their own. Deliberately NOT chat_threads: that table is a couple-vendor booking negotiation (event_id + vendor_profile_id both NOT NULL). Retention follows the 5-year CHAT rule; no new sweep.';

CREATE INDEX IF NOT EXISTS samahan_messages_community_idx
  ON public.samahan_messages (community_id, created_at DESC);

ALTER TABLE public.samahan_messages ENABLE ROW LEVEL SECURITY;

-- Default-ACL hygiene: new tables arrive OPEN in this database. Close
-- everything, then grant exactly what the policies scope. No DELETE grant —
-- take-down is the soft UPDATE below, so a hard delete is service-role only.
REVOKE ALL ON public.samahan_messages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.samahan_messages TO authenticated;
GRANT USAGE ON SEQUENCE public.samahan_messages_id_seq TO authenticated;

-- Members of the samahan read its messages.
DROP POLICY IF EXISTS samahan_message_member_read ON public.samahan_messages;
CREATE POLICY samahan_message_member_read ON public.samahan_messages
  FOR SELECT TO authenticated
  USING (community_id IN (SELECT public.current_community_ids()) OR public.is_admin());

-- A member posts AS THEMSELVES into a samahan they belong to. The
-- `user_id = auth.uid()` half is what stops the browser client — which any
-- signed-in person holds — from posting in somebody else's voice
-- (the 2026-08-12 impersonation family).
DROP POLICY IF EXISTS samahan_message_member_write ON public.samahan_messages;
CREATE POLICY samahan_message_member_write ON public.samahan_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND community_id IN (SELECT public.current_community_ids())
  );

-- Take-down: the AUTHOR only, and only their own row. Admin is deliberately
-- excluded here — an admin removing a member's message is a moderation act
-- that should leave an audit trail, and no such surface exists yet.
DROP POLICY IF EXISTS samahan_message_author_update ON public.samahan_messages;
CREATE POLICY samahan_message_author_update ON public.samahan_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- The UPDATE policy says "this row is yours". It does NOT say which FIELD —
-- the 2026-08-12 lesson, eight times over. Without this, an author could
-- rewrite `body` after everyone read it, or move their message into another
-- samahan. Take-down is the only edit the product offers, so it is the only
-- one the database allows.
CREATE OR REPLACE FUNCTION public.samahan_messages_author_field_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  -- Privileged callers (service_role / owner jobs) are unaffected. Derived
  -- from current_user, never auth.role() — the replay shim returns 'anon'
  -- where prod returns NULL, so auth.role() branches are dead in tests.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.body IS DISTINCT FROM OLD.body
     OR NEW.community_id IS DISTINCT FROM OLD.community_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.message_id IS DISTINCT FROM OLD.message_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'samahan_messages: only deleted_at may change';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS samahan_messages_author_field_guard ON public.samahan_messages;
CREATE TRIGGER samahan_messages_author_field_guard
  BEFORE UPDATE ON public.samahan_messages
  FOR EACH ROW EXECUTE FUNCTION public.samahan_messages_author_field_guard();

COMMIT;
