-- a_stale_guest_or_crew_seat_hears_nothing
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ════════════════════════════════════════════════════════════════════════════
-- A STALE GUEST OR CREW SEAT HEARS NOTHING — the follow-up to 20271352461498
-- (a removed co-host reads no chat). Owner, 20 Nov: "Yes, build it".
--
-- ── THE GAP (measured on 20271352461498) ────────────────────────────────────
-- A host-made group seats anyone chat_group_person_kind() names, including a
-- SUPPLIER who is a live member of a shop's team (vendor_team_members,
-- deactivated_at IS NULL — a person with NO event_members row at all). When
-- that member is deactivated (deactivated_at set — the existing soft-lock,
-- 20270511762904) or taken off the team (row deleted),
-- chat_group_person_kind() stops naming them, so chat_seat_is_held() is false
-- and current_thread_ids() already reads them nothing. BUT their
-- chat_thread_members row keeps left_at IS NULL, because the only trigger that
-- closes seats sits on event_members — and a team change never touches
-- event_members. A live row is still read WITHOUT current_thread_ids() by the
-- live-ping fan-out (chat_message_reader_ids → chat_group_member_ids, whose
-- second arm is every live row) and by the private-line recipient check. So
-- they were still PINGED (id-only) about lines in a group they could no longer
-- open, and could still be picked for a private line.
--
-- A GUEST removed from the list needs nothing new, measured: the soft delete
-- (guests.deleted_at) already DELETEs their event_members 'guest' row
-- (a_removed_guest_ends_its_account_link, 20271261618741), which fires the
-- 20271352461498 event_members trigger and closes the seat. A test pins it
-- (tests/db/a-stale-guest-or-crew-seat-hears-nothing.db.test.ts).
--
-- ── WHAT THIS FILE DOES — the same mechanism, no second rule ────────────────
--   1 · chat_close_unheld_seats(user, event): the 20271352461498 trigger's
--       closing step as one helper — a live seat that chat_seat_is_held() no
--       longer holds gets left_at. NULL event = every event (a shop's crew
--       member can sit in groups of many events). Nothing else is decided here.
--   2 · vendor_team_members AFTER UPDATE OF deactivated_at / user_id /
--       vendor_profile_id, and AFTER DELETE: the member loses seats no longer
--       held. A member who is still someone on the event another way (a host,
--       a guest, the owner or crew of another shop in it) keeps their seat —
--       chat_seat_is_held() decides, exactly as before.
--   3 · The same, once, for seats already stale before this file.
--   left_note is NOT written (the person's own words); NO line is posted.
--   Reactivating a member does NOT reopen a closed seat: a host puts them
--   back with chat_group_add, which revives the row (ON CONFLICT … left_at =
--   NULL) — the same as anyone who left.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · the one closing step ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_close_unheld_seats(p_user_id UUID, p_event_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chat_thread_members m
     SET left_at = clock_timestamp()
    FROM public.chat_threads t
   WHERE p_user_id IS NOT NULL
     AND t.thread_id = m.thread_id
     AND (p_event_id IS NULL OR t.event_id = p_event_id)
     AND m.user_id = p_user_id
     AND m.left_at IS NULL
     AND NOT public.chat_seat_is_held(m.thread_id, m.user_id);
$$;
REVOKE ALL ON FUNCTION public.chat_close_unheld_seats(UUID, UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.chat_close_unheld_seats(UUID, UUID) IS
  'Closes (left_at) a person''s live chat seats that chat_seat_is_held() no longer holds — in one event, or every event when p_event_id is NULL. Writes no left_note and posts no line. Called by the vendor_team_members triggers. Migration 20271353093349.';

-- ── 2 · a shop's crew member deactivated or taken off the team ──────────────
CREATE OR REPLACE FUNCTION public.tg_vendor_team_members_close_chat_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.chat_close_unheld_seats(OLD.user_id, NULL);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_vendor_team_members_close_chat_seats() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.tg_vendor_team_members_close_chat_seats() IS
  'When a shop team member is deactivated (deactivated_at), re-pointed, or removed, they lose chat seats no longer held in any event (chat_close_unheld_seats). Migration 20271353093349.';

DROP TRIGGER IF EXISTS vendor_team_members_close_chat_seats_on_change ON public.vendor_team_members;
CREATE TRIGGER vendor_team_members_close_chat_seats_on_change
  AFTER UPDATE OF deactivated_at, user_id, vendor_profile_id ON public.vendor_team_members
  FOR EACH ROW
  WHEN (OLD.deactivated_at IS DISTINCT FROM NEW.deactivated_at
        OR OLD.user_id IS DISTINCT FROM NEW.user_id
        OR OLD.vendor_profile_id IS DISTINCT FROM NEW.vendor_profile_id)
  EXECUTE FUNCTION public.tg_vendor_team_members_close_chat_seats();

DROP TRIGGER IF EXISTS vendor_team_members_close_chat_seats_on_delete ON public.vendor_team_members;
CREATE TRIGGER vendor_team_members_close_chat_seats_on_delete
  AFTER DELETE ON public.vendor_team_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_team_members_close_chat_seats();

-- ── 3 · seats already stale before this file ────────────────────────────────
-- The 20271352461498 rule, once more. Idempotent: a re-run finds no live seat
-- that is not held.
UPDATE public.chat_thread_members m
   SET left_at = clock_timestamp()
 WHERE m.left_at IS NULL
   AND NOT public.chat_seat_is_held(m.thread_id, m.user_id);

COMMIT;
