-- a_removed_member_reads_nothing
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ════════════════════════════════════════════════════════════════════════════
-- A REMOVED MEMBER READS NOTHING — whispers OR shared lines (Unichat part E).
-- Controller, under owner delegation 20 Nov: "Removed or deactivated reads
-- nothing, whispers OR shared." Builds on 20271352461498 (a removed co-host
-- reads no chat) and 20271354185201 (a whisper stays on its side).
--
-- ── THE GAP (measured on 20271354185201) ────────────────────────────────────
-- A shop team member who is DEACTIVATED (vendor_team_members.deactivated_at —
-- the soft-lock of 20270511762904) kept reading every SHARED line of the shop's
-- chats, and could still write as the shop: the shop arms of
-- chat_messages_member_read / _member_insert (and tg_chat_messages_derive_sender)
-- ask current_vendor_profile_ids() / current_vendor_ids(), which do not look at
-- deactivated_at. The whisper policy of 20271354185201 closed it for whispers
-- only. A member taken OFF the team (row deleted) was already out — those
-- helpers name only rows that exist.
--
-- ── THE RULE — one predicate, on read AND on write ──────────────────────────
-- chat_shop_seat_is_lost(shop): the caller holds a DEACTIVATED seat on that
-- shop and no other — not its owner (vendor_profiles.user_id), no live team
-- row. RESTRICTIVE policies (so they only narrow, never widen) refuse such a
-- caller every line of that shop's chats and the threads themselves, unless
-- they still hold a seat on the people's side (current_thread_ids — a host or
-- coordinator of the event, a held group seat) or are an admin (whose chat
-- reads are already bounded by 20271341658320, an open dispute only).
--
-- Why not change current_vendor_ids(): it gates dozens of shop tables, and
-- the ruling is about the chat. A shop-wide change is its own decision.
--
-- 🔒 tests/db/a-removed-member-reads-nothing.db.test.ts (with a policy-drop
--    sabotage proving these policies are what closes it).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.chat_shop_seat_is_lost(p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_vendor_profile_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.vendor_team_members tm
                  WHERE tm.vendor_profile_id = p_vendor_profile_id
                    AND tm.user_id = auth.uid()
                    AND tm.deactivated_at IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.vendor_team_members tm
                      WHERE tm.vendor_profile_id = p_vendor_profile_id
                        AND tm.user_id = auth.uid()
                        AND tm.deactivated_at IS NULL)
     AND NOT EXISTS (SELECT 1 FROM public.vendor_profiles vp
                      WHERE vp.vendor_profile_id = p_vendor_profile_id
                        AND vp.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.chat_shop_seat_is_lost(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_shop_seat_is_lost(UUID) TO authenticated;

COMMENT ON FUNCTION public.chat_shop_seat_is_lost(UUID) IS
  'TRUE when the caller''s only seat on this shop is a DEACTIVATED team row (vendor_team_members.deactivated_at) — not the owner, no live row. Asks only about the caller. Used by the RESTRICTIVE chat policies *_a_removed_member_reads_nothing. Migration 20271354552883.';

DROP POLICY IF EXISTS chat_messages_a_removed_member_reads_nothing ON public.chat_messages;
CREATE POLICY chat_messages_a_removed_member_reads_nothing
  ON public.chat_messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT public.chat_shop_seat_is_lost(vendor_profile_id)
    OR thread_id IN (SELECT public.current_thread_ids())
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS chat_messages_a_removed_member_writes_nothing ON public.chat_messages;
CREATE POLICY chat_messages_a_removed_member_writes_nothing
  ON public.chat_messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.chat_shop_seat_is_lost(vendor_profile_id)
    -- Still seated as someone else (a host, a coordinator) they write as THAT — never as the shop. sender_role is
    -- already stamped here: BEFORE triggers (tg_chat_messages_derive_sender) run before RLS's WITH CHECK.
    OR (thread_id IN (SELECT public.current_thread_ids())
        AND sender_role IS DISTINCT FROM 'vendor'::public.chat_sender_role)
  );

DROP POLICY IF EXISTS chat_threads_a_removed_member_reads_nothing ON public.chat_threads;
CREATE POLICY chat_threads_a_removed_member_reads_nothing
  ON public.chat_threads
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT public.chat_shop_seat_is_lost(vendor_profile_id)
    OR thread_id IN (SELECT public.current_thread_ids())
    OR (SELECT public.is_admin())
  );

COMMENT ON POLICY chat_messages_a_removed_member_reads_nothing ON public.chat_messages IS
  'RESTRICTIVE: a shop team member whose only seat is deactivated reads none of the shop''s chat lines — whispers or shared — unless they hold a seat on the people''s side (current_thread_ids) or are an admin. Controller under owner delegation 20 Nov. Migration 20271354552883.';
COMMENT ON POLICY chat_messages_a_removed_member_writes_nothing ON public.chat_messages IS
  'RESTRICTIVE: the same person writes no line into the shop''s chats (the shop arm of _member_insert did not look at deactivated_at); still seated as a host or coordinator, they write as that, never as the shop. Migration 20271354552883.';
COMMENT ON POLICY chat_threads_a_removed_member_reads_nothing ON public.chat_threads IS
  'RESTRICTIVE: the same person does not see the shop''s chat threads either. Migration 20271354552883.';

COMMIT;
