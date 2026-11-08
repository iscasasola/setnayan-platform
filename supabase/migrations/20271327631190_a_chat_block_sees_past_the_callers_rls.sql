-- a_chat_block_sees_past_the_callers_rls
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- A CHAT BLOCK SEES PAST THE CALLER'S RLS — THE ONE BUILD, security fix
-- (build-notes/supplier-1build-integration.md §7 item 11, found by lane C2).
--
-- THE BUG (live since 20270223909213): chat_messages_block_guard asks "is the
-- other side of this thread somebody I blocked / who blocked me?" INLINE, so
-- its lookups on event_members and vendor_profiles run under the CALLER's RLS.
-- A couple cannot see an UNPUBLISHED shop's vendor_profiles row (nor a supplier
-- the event's members), the subquery comes back empty, NOT EXISTS is TRUE and
-- the guard PASSES — for exactly the blocked pair. A couple who blocked an
-- unpublished shop could still post into its thread.
--
-- THE FIX: the same pattern hearts already use (20271325581544): ask through
-- the SECURITY DEFINER helper public.chat_pair_is_blocked(event_id,
-- vendor_profile_id), which reads without the caller's RLS and only ever
-- answers about auth.uid(), so it discloses nothing. Not a new helper — that
-- one, as defined there.
--
-- Behaviour delta beyond the bug: the helper also counts the shop's TEAM
-- (vendor_team_members) as "the other side", as hearts already do — a team
-- member who blocked a couple (or was blocked by them) is now held by the
-- send guard too, not only by the heart guard.
--
-- The policy stays RESTRICTIVE FOR INSERT TO authenticated, so it still only
-- ANDs onto chat_messages_member_insert; service-role (system) messages are
-- untouched. With zero blocked_users rows it is still a structural no-op.
-- No data is changed (no UPDATE), so there is nothing to order.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Fail loudly, not silently, if the helper this policy leans on is missing
-- (e.g. this file landing without 20271325581544).
DO $$
BEGIN
  IF to_regprocedure('public.chat_pair_is_blocked(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'a_chat_block_sees_past_the_callers_rls: public.chat_pair_is_blocked(uuid, uuid) is missing — apply 20271325581544_a_message_can_be_hearted first';
  END IF;
END $$;

DROP POLICY IF EXISTS chat_messages_block_guard ON public.chat_messages;
CREATE POLICY chat_messages_block_guard ON public.chat_messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.chat_pair_is_blocked(event_id, vendor_profile_id));

COMMENT ON POLICY chat_messages_block_guard ON public.chat_messages IS
  'RESTRICTIVE: a blocked pair (either direction; couple members, shop owner, shop team) cannot post into their shared thread. Asked through the SECURITY DEFINER helper chat_pair_is_blocked so the caller''s RLS cannot hide the other side (an unpublished shop) and make the guard pass. Same check as chat_message_hearts_block_guard_insert.';

COMMIT;
