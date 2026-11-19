-- a_removed_cohost_reads_no_chat
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ════════════════════════════════════════════════════════════════════════════
-- A REMOVED CO-HOST READS NO CHAT. Owner, 19 Nov: "yes fix the co-host leak
-- today".
--
-- ── THE GAP (measured on origin/main before this file) ──────────────────────
-- current_thread_ids() (last defined in 20271340374819) admits a person to a
-- thread through ANY live chat_thread_members row — `left_at IS NULL` — and
-- never asks whether that person is still on the event. left_at is written
-- only by chat_thread_leave() / chat_group_leave(). Removing a co-host
-- (event_moderators.removed_at → sync_delegate_membership, 20271251336140)
-- turns their event_members row from 'couple' back into 'guest', or deletes
-- it — and touches no chat seat. So a removed co-host kept reading every
-- supplier conversation they had been seated in, quotes and payments included.
--
-- ── WHO HOLDS A SEAT (every writer of chat_thread_members, measured) ────────
--   SUPPLIER chats (kind = 'supplier') — hosts only:
--     · 20271330575424 backfill: every event_members 'couple' row;
--     · tg_chat_threads_seat_the_opener: the opening host ('couple'), else
--       every 'couple' member;
--     · chat_thread_add_host (20271330575424 → 20271330723629 →
--       20271340374819): refuses anyone who is not 'couple' (not_a_host).
--     Coordinators are never rows (derived, arm 2). The supplier side is never
--     rows (vendor_profiles / vendor_team_members).
--     ⇒ a supplier-chat seat is held while the person is 'couple' on the event.
--   GROUP chats (kind = 'group', 20271340374819) — anyone on the event:
--     · chat_group_create / chat_group_add: any person for whom
--       chat_group_person_kind(event, user) is NOT NULL — host · coordinator ·
--       guest (event_members + a live guest row) · SUPPLIER (the shop owner or
--       a live team member of a shop with a supplier chat on this event — a
--       person with NO event_members row at all).
--     · chat_group_leave: a host's opt-out row (left_at set) — not a seat.
--     ⇒ a group seat is held while chat_group_person_kind is NOT NULL, the
--       groups' own rule ("everyone in a group is someone on this event"). A
--       supplier in a made group keeps their seat exactly as before.
--   One rule for both: chat_seat_is_held(thread, user), below.
--
-- ── WHAT THIS FILE DOES ─────────────────────────────────────────────────────
--   1 · chat_seat_is_held(thread, user) — the rule above, in one place.
--   2 · current_thread_ids(): its FIRST arm additionally requires
--       chat_seat_is_held. The coordinator arm and the General/role arm are
--       byte-for-byte as 20271340374819 left them (both already read live
--       event_members). So every reader keyed on it — chat_messages read and
--       insert, chat_threads read, decisions, polls, the unread counters —
--       stops at once, including for anyone removed BEFORE this file.
--   3 · A trigger on event_members (AFTER DELETE · AFTER UPDATE OF
--       member_type / user_id / event_id / guest_id): the moment a person
--       stops holding a seat, their live seats in that event's threads get
--       left_at. WHY, beyond the read check: several things read a live
--       chat_thread_members row WITHOUT going through current_thread_ids() —
--       the private-line recipient check (tg_chat_messages_private_is_
--       between_members), the live-ping / tray fan-out
--       (chat_message_reader_ids → chat_group_member_ids /
--       chat_message_recipient_ids), the ChatHostStrip (thread_chat_hosts)
--       and the app's notice fan-out (readThreadHostPeople). Without the
--       trigger a removed co-host could still be picked as a private
--       recipient and still be TOLD that a message arrived in a chat they can
--       no longer open. left_note is NOT written (it is the person's own
--       words); NO system line is posted (nothing new sends or notifies).
--       A person made co-host again can rejoin themselves, as any host who
--       left (chat_thread_add_host's self path, which requires 'couple').
--   4 · The same, once, for seats already orphaned before this file.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · the one rule ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_seat_is_held(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.chat_threads t
     WHERE t.thread_id = p_thread_id
       AND (
         -- A supplier chat: a host of the event.
         (t.kind = 'supplier'
          AND EXISTS (SELECT 1 FROM public.event_members em
                       WHERE em.event_id = t.event_id
                         AND em.user_id = p_user_id
                         AND em.member_type = 'couple'))
         -- A group: anyone who is still someone on this event.
         OR (t.kind = 'group'
             AND public.chat_group_person_kind(t.event_id, p_user_id) IS NOT NULL)
       )
  );
$$;
REVOKE ALL ON FUNCTION public.chat_seat_is_held(UUID, UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.chat_seat_is_held(UUID, UUID) IS
  'Whether a chat_thread_members row still seats this person: a SUPPLIER chat seats a host of the event (event_members couple); a GROUP seats anyone chat_group_person_kind still names (host · coordinator · guest · supplier). A seat that is not held reads nothing (current_thread_ids) and is closed (left_at) when the membership goes. Answers about anyone, so no grant to end users. Migration 20271352461498.';

-- ── 2 · the canonical helper: a seat counts only while it is held ───────────
CREATE OR REPLACE FUNCTION public.current_thread_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- A live membership row: a host in a supplier chat, anyone put in a group —
  -- only while that seat is still held (a removed co-host reads nothing).
  SELECT m.thread_id
    FROM public.chat_thread_members m
   WHERE m.user_id = auth.uid()
     AND m.left_at IS NULL
     AND public.chat_seat_is_held(m.thread_id, m.user_id)
  UNION
  -- A coordinator: every SUPPLIER thread of their event (groups only when added).
  SELECT t.thread_id
    FROM public.chat_threads t
    JOIN public.event_members em ON em.event_id = t.event_id
   WHERE em.user_id = auth.uid()
     AND em.member_type = 'coordinator'
     AND t.kind = 'supplier'
  UNION
  -- General and the role groups: derived from the hosts and the guest list.
  SELECT t.thread_id
    FROM public.chat_threads t
   WHERE t.kind = 'group'
     AND t.group_kind IN ('general', 'role')
     AND t.event_id IN (SELECT em.event_id FROM public.event_members em
                         WHERE em.user_id = auth.uid()
                           AND em.member_type IN ('couple', 'guest'))
     AND public.chat_group_is_member(t.thread_id, auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.current_thread_ids() TO authenticated;

COMMENT ON FUNCTION public.current_thread_ids() IS
  'Chat threads the caller is IN on the people''s side: a live chat_thread_members row that is still held (chat_seat_is_held — a host in a supplier chat, anyone still on the event in a group), every SUPPLIER thread of an event where the caller is a coordinator, and the General / role groups the caller is derived into (chat_group_member_ids). Excludes the supplier side of supplier chats, which stays vendor_profile-derived. Migrations 20271330575424 · 20271340374819 · 20271352461498.';

-- ── 3 · leaving the event closes the seats ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_event_members_close_chat_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.user_id IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.chat_thread_members m
     SET left_at = clock_timestamp()
    FROM public.chat_threads t
   WHERE t.thread_id = m.thread_id
     AND t.event_id = OLD.event_id
     AND m.user_id = OLD.user_id
     AND m.left_at IS NULL
     AND NOT public.chat_seat_is_held(m.thread_id, m.user_id);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_event_members_close_chat_seats() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.tg_event_members_close_chat_seats() IS
  'When an event_members row goes or changes (a co-host removed → guest or deleted), the person''s live chat seats in that event''s threads that are no longer held (chat_seat_is_held) get left_at. Writes no left_note and posts no line. Migration 20271352461498.';

DROP TRIGGER IF EXISTS event_members_close_chat_seats_on_delete ON public.event_members;
CREATE TRIGGER event_members_close_chat_seats_on_delete
  AFTER DELETE ON public.event_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_event_members_close_chat_seats();

DROP TRIGGER IF EXISTS event_members_close_chat_seats_on_change ON public.event_members;
CREATE TRIGGER event_members_close_chat_seats_on_change
  AFTER UPDATE OF member_type, user_id, event_id, guest_id ON public.event_members
  FOR EACH ROW
  WHEN (OLD.member_type IS DISTINCT FROM NEW.member_type
        OR OLD.user_id  IS DISTINCT FROM NEW.user_id
        OR OLD.event_id IS DISTINCT FROM NEW.event_id
        OR OLD.guest_id IS DISTINCT FROM NEW.guest_id)
  EXECUTE FUNCTION public.tg_event_members_close_chat_seats();

-- ── 4 · seats orphaned before this file ─────────────────────────────────────
-- The same rule, once. Idempotent: a re-run finds no live seat that is not held.
UPDATE public.chat_thread_members m
   SET left_at = clock_timestamp()
 WHERE m.left_at IS NULL
   AND NOT public.chat_seat_is_held(m.thread_id, m.user_id);

COMMIT;
