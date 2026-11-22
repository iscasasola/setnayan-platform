-- one_team_rule_and_a_host_whispers_as_a_host
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
-- NOT applied anywhere by this PR — the pipeline pushes it.

-- ════════════════════════════════════════════════════════════════════════════
-- ONE DEFINITION OF "TEAM" — and a host whispers as a host (Unichat H1,
-- controller ruling on the #8060 review, 20 Nov, under owner delegation).
--
-- THE FAULT: two rules said who "the shop's team" is in one conversation.
--   · the DATABASE (chat_whisper_side_of, 20271354185201): the owner or ANY live
--     team member — and "the shop wins" over a host seat;
--   · the APP (lib/chat-shop-people.server.ts): the owner, every owner/admin
--     member, and a member below admin only when one of their ASSIGNED services
--     serves THIS event (chat_messages_member_insert's three branches).
--   So a host of the event who is also a junior member of the shop was a host to
--   the app and 'team' to the database: every whisper they sent to their
--   co-hosts was refused (WHISPER_NOT_YOUR_SIDE), and every co-host whisper that
--   named them was refused (WHISPER_CROSSES_SIDES).
--
-- THE RULING:
--   1 · ONE definition, the app's, written ONCE, here:
--         chat_shop_team_user_ids(shop, event) — the owner · every live
--         owner/admin member · a live member below admin whose assigned service
--         this event booked. chat_is_shop_team() is derived from it. The app
--         reads the same function (readShopChatPeople → rpc), so there is no
--         second copy to drift.
--   2 · A HOST OF THE EVENT ACTS ON THE HOSTS' SIDE in that event's threads,
--       whatever their shop role. A host holding a seat here is 'hosts'; a host
--       of the event with no seat here is on NO side (never the shop's team).
--       A coordinator who is also on the team stays the shop here (unchanged).
--
-- WHAT CHANGES: chat_whisper_side_of (CREATE OR REPLACE against its only
-- definition, 20271354185201). chat_whisper_my_side, the BEFORE INSERT trigger
-- and the RESTRICTIVE read all call it, so they follow without being touched.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ── 1 · the ONE team rule ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_shop_team_user_ids(p_vendor_profile_id UUID, p_event_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- The shop's owner.
  SELECT vp.user_id
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id
     AND vp.user_id IS NOT NULL
  UNION
  -- A live team member: owner/admin always; below admin only while one of their
  -- assigned services is booked by THIS event (agent_customer_event_ids' rule).
  SELECT tm.user_id
    FROM public.vendor_team_members tm
   WHERE tm.vendor_profile_id = p_vendor_profile_id
     AND tm.user_id IS NOT NULL
     AND tm.deactivated_at IS NULL
     AND (
       tm.role IN ('owner', 'admin')
       OR EXISTS (SELECT 1
                    FROM public.vendor_service_agents vsa
                    JOIN public.event_vendors ev ON ev.service_id = vsa.vendor_service_id
                   WHERE vsa.vendor_team_member_id = tm.vendor_team_member_id
                     AND ev.event_id = p_event_id)
     );
$$;
REVOKE ALL ON FUNCTION public.chat_shop_team_user_ids(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_shop_team_user_ids(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.chat_shop_team_user_ids(UUID, UUID) IS
  'THE one definition of a shop''s team in one (event × shop) conversation: the owner, every live owner/admin member, and a live member below admin whose assigned service this event booked. The app reads it (lib/chat-shop-people.server.ts readShopChatPeople, service role); chat_is_shop_team and chat_whisper_side_of derive from it. Answers about anyone, so no grant to end users. Migration 20271355512715.';

CREATE OR REPLACE FUNCTION public.chat_is_shop_team(p_vendor_profile_id UUID, p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.chat_shop_team_user_ids(p_vendor_profile_id, p_event_id) u
                  WHERE u = p_user_id);
$$;
REVOKE ALL ON FUNCTION public.chat_is_shop_team(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.chat_is_shop_team(UUID, UUID, UUID) IS
  'Whether a person is in chat_shop_team_user_ids(shop, event) — derived, never a second rule. Answers about anyone, so no grant to end users. Migration 20271355512715.';

-- ── 2 · which side a person is on: a host first, then the ONE team rule ─────
CREATE OR REPLACE FUNCTION public.chat_whisper_side_of(p_thread_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR t.thread_id IS NULL OR t.kind <> 'supplier' THEN NULL
    -- A host of the event acts on the hosts' side, whatever their shop role:
    -- seated here → 'hosts'; not seated here → no side (never the shop's team).
    WHEN EXISTS (SELECT 1 FROM public.event_members em
                  WHERE em.event_id = t.event_id
                    AND em.user_id = p_user_id
                    AND em.member_type = 'couple')
      THEN CASE
        WHEN EXISTS (SELECT 1 FROM public.chat_thread_members m
                      WHERE m.thread_id = t.thread_id
                        AND m.user_id = p_user_id
                        AND m.left_at IS NULL
                        AND public.chat_seat_is_held(m.thread_id, m.user_id))
          THEN 'hosts'
        ELSE NULL
      END
    WHEN public.chat_is_shop_team(t.vendor_profile_id, t.event_id, p_user_id) THEN 'team'
    WHEN EXISTS (SELECT 1 FROM public.event_members em
                  WHERE em.event_id = t.event_id
                    AND em.user_id = p_user_id
                    AND em.member_type = 'coordinator')
      THEN 'hosts'
    ELSE NULL
  END
  FROM (SELECT p_thread_id AS want) w
  LEFT JOIN public.chat_threads t ON t.thread_id = w.want;
$$;
REVOKE ALL ON FUNCTION public.chat_whisper_side_of(UUID, UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.chat_whisper_side_of(UUID, UUID) IS
  'Which whisper side of a SUPPLIER chat a person is on now: a host of the event is hosts when seated here (chat_seat_is_held) and on no side otherwise, whatever their shop role · else team when chat_is_shop_team (the ONE team rule, chat_shop_team_user_ids) · else hosts for a coordinator of the event · else NULL. Answers about anyone, so no grant to end users. Migrations 20271354185201, 20271355512715.';

COMMIT;
