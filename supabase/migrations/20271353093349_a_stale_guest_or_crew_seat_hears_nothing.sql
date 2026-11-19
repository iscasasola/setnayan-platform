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
--
-- ── AND, OWNER RULING 20 NOV ("all your picks") — a removed co-host ALSO ────
-- ── leaves the event's host-made group chats; added back, gets them back ────
--   0 · chat_thread_members.left_by_removal: WHY left_at is set (a removal,
--       not the person's own leave). Never TRUE on a live seat.
--   4 · the 20271352461498 event_members trigger, extended: a person who
--       stops being a host loses their live seats in the event's MADE groups
--       (General / role groups are derived from the guest list and untouched).
--   5 · a person who becomes a host again gets back every made-group seat a
--       removal closed — never one they left themselves.
--   6 · chat_group_former_members(): their past lines stay attributed
--       ("Rita · left") in the group's stream.
--   7 · the same, once, for co-hosts removed before this file.
--   left_note is NOT written (the person's own words); NO line is posted.
--   Reactivating a member does NOT reopen a closed seat: a host puts them
--   back with chat_group_add, which revives the row (ON CONFLICT … left_at =
--   NULL) — the same as anyone who left.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 0 · why a seat closed: by a removal, or by the person ────────────────────
-- A seat a removal closed comes back when the person is a host again (owner,
-- 20 Nov: "a co-host added back regains the groups they were in"); a seat the
-- person LEFT themselves (chat_group_leave / chat_thread_leave) does not. The
-- flag only says WHY left_at is set — whether a seat is held is still
-- chat_seat_is_held() alone. It is never TRUE on a live seat (the trigger
-- below clears it whenever left_at goes back to NULL, by any path).
ALTER TABLE public.chat_thread_members
  ADD COLUMN IF NOT EXISTS left_by_removal BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.chat_thread_members.left_by_removal IS
  'TRUE when left_at was set by a removal (a co-host removed, a guest or crew member gone) rather than by the person leaving. A host made again gets the host-made group seats a removal closed back (tg_event_members_reopen_chat_seats). Never TRUE while left_at IS NULL. Migration 20271353093349.';

CREATE OR REPLACE FUNCTION public.tg_chat_thread_members_live_seat_has_no_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.left_at IS NULL THEN
    NEW.left_by_removal := FALSE;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_thread_members_live_seat_has_no_removal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_thread_members_live_seat_has_no_removal ON public.chat_thread_members;
CREATE TRIGGER chat_thread_members_live_seat_has_no_removal
  BEFORE INSERT OR UPDATE ON public.chat_thread_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_thread_members_live_seat_has_no_removal();

-- ── 1 · the one closing step ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_close_unheld_seats(p_user_id UUID, p_event_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chat_thread_members m
     SET left_at = clock_timestamp(), left_by_removal = TRUE
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
  'Closes (left_at) a person''s live chat seats that chat_seat_is_held() no longer holds — in one event, or every event when p_event_id is NULL. Marks the seat left_by_removal; writes no left_note and posts no line. Called by the event_members and vendor_team_members triggers. Migration 20271353093349.';

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
   SET left_at = clock_timestamp(), left_by_removal = TRUE
 WHERE m.left_at IS NULL
   AND NOT public.chat_seat_is_held(m.thread_id, m.user_id);

-- ── 4 · a removed co-host leaves the host-made groups too ────────────────────
-- Owner ruling, 20 Nov ("all your picks"): a co-host removed from the event
-- ALSO leaves its host-made group chats. Their past lines stay, attributed;
-- they lose read and write and get no pings — exactly what a closed seat
-- (left_at) already means to current_thread_ids(), the private-line check and
-- chat_group_member_ids(). So this is the 20271352461498 trigger with one more
-- step: when the person STOPS being a host ('couple'), their live seats in the
-- event's MADE groups close too, even though chat_seat_is_held() would still
-- hold them as a guest. General and the role groups are untouched: they are
-- derived from the guest list, and a removed co-host who is still an attending
-- guest is in them as any guest is.
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
  PERFORM public.chat_close_unheld_seats(OLD.user_id, OLD.event_id);
  -- No longer a host of THIS event (removed, deleted, or the row re-pointed).
  IF OLD.member_type = 'couple'
     AND (TG_OP = 'DELETE'
          OR NEW.member_type IS DISTINCT FROM 'couple'
          OR NEW.user_id IS DISTINCT FROM OLD.user_id
          OR NEW.event_id IS DISTINCT FROM OLD.event_id) THEN
    UPDATE public.chat_thread_members m
       SET left_at = clock_timestamp(), left_by_removal = TRUE
      FROM public.chat_threads t
     WHERE t.thread_id = m.thread_id
       AND t.event_id = OLD.event_id
       AND t.kind = 'group' AND t.group_kind = 'made'
       AND m.user_id = OLD.user_id
       AND m.left_at IS NULL;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_event_members_close_chat_seats() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.tg_event_members_close_chat_seats() IS
  'When an event_members row goes or changes: the person''s live seats that are no longer held (chat_seat_is_held) close, and if they stopped being a host (''couple'') their seats in the event''s host-made groups close too (owner 20 Nov). left_by_removal is set; no left_note, no line. Migrations 20271352461498 · 20271353093349.';

-- ── 5 · a co-host added back gets those groups back ──────────────────────────
-- Owner, 20 Nov: "A co-host added back regains the groups they were in." When
-- a person BECOMES a host of the event (a fresh row, or guest → couple), every
-- host-made group seat a removal closed reopens. A seat they left themselves
-- (left_by_removal FALSE) stays closed — that was their choice. No line is
-- posted. Supplier chats keep the 20271352461498 behaviour: the host rejoins
-- by themselves (chat_thread_add_host) or is re-seated by another host.
CREATE OR REPLACE FUNCTION public.tg_event_members_reopen_chat_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.member_type IS DISTINCT FROM 'couple' THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.member_type = 'couple'
     AND OLD.user_id IS NOT DISTINCT FROM NEW.user_id
     AND OLD.event_id IS NOT DISTINCT FROM NEW.event_id THEN
    RETURN NULL;
  END IF;
  UPDATE public.chat_thread_members m
     SET left_at = NULL, left_by_removal = FALSE
    FROM public.chat_threads t
   WHERE t.thread_id = m.thread_id
     AND t.event_id = NEW.event_id
     AND t.kind = 'group' AND t.group_kind = 'made'
     AND m.user_id = NEW.user_id
     AND m.left_at IS NOT NULL
     AND m.left_by_removal;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_event_members_reopen_chat_seats() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.tg_event_members_reopen_chat_seats() IS
  'When a person becomes a host (''couple'') of an event, their host-made group seats that a removal closed (left_by_removal) reopen. Seats they left themselves stay closed. Posts no line. Migration 20271353093349.';

DROP TRIGGER IF EXISTS event_members_reopen_chat_seats ON public.event_members;
CREATE TRIGGER event_members_reopen_chat_seats
  AFTER INSERT OR UPDATE OF member_type, user_id, event_id ON public.event_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_event_members_reopen_chat_seats();

-- ── 6 · their past lines still say who wrote them ───────────────────────────
-- A group's stream names each run from chat_group_members(), which lists the
-- people IN the group — so a line from anyone who has left (removed or by
-- choice) lost its writer's name. This lists the people who HAD a seat and no
-- longer do, for a member of the group only, so the stream can say "Rita · left".
CREATE OR REPLACE FUNCTION public.chat_group_former_members(p_thread_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'user_id',    u.user_id,
           'first_name', COALESCE(NULLIF(btrim(u.first_name), ''),
                                  NULLIF(split_part(btrim(COALESCE(u.display_name, '')), ' ', 1), '')),
           'name',       COALESCE(NULLIF(btrim(u.display_name), ''),
                                  NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), ''))
         ) ORDER BY u.first_name NULLS LAST, u.user_id), '[]'::jsonb)
    FROM public.chat_thread_members m
    JOIN public.chat_threads t ON t.thread_id = m.thread_id AND t.kind = 'group'
    JOIN public.users u ON u.user_id = m.user_id
   WHERE m.thread_id = p_thread_id
     AND m.left_at IS NOT NULL
     AND public.chat_group_is_member(p_thread_id, auth.uid())
     AND NOT public.chat_group_is_member(p_thread_id, m.user_id);
$$;
REVOKE ALL ON FUNCTION public.chat_group_former_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_former_members(UUID) TO authenticated;

COMMENT ON FUNCTION public.chat_group_former_members(UUID) IS
  'The people who had a seat in this group and no longer do (left, or closed by a removal) — names only, for a member of the group only — so their past lines stay attributed ("· left"). Migration 20271353093349.';

-- ── 7 · co-hosts removed before this file ───────────────────────────────────
-- Their host-made group seats taken while they were a host, still open. A
-- removed full co-host seat (event_moderators.removed_at) who is not a host
-- now; only seats joined before the removal. Idempotent: a re-run finds none.
UPDATE public.chat_thread_members m
   SET left_at = clock_timestamp(), left_by_removal = TRUE
  FROM public.chat_threads t
 WHERE t.thread_id = m.thread_id
   AND t.kind = 'group' AND t.group_kind = 'made'
   AND m.left_at IS NULL
   AND EXISTS (SELECT 1 FROM public.event_moderators mo
                WHERE mo.event_id = t.event_id AND mo.user_id = m.user_id
                  AND mo.removed_at IS NOT NULL AND mo.removed_at > m.joined_at
                  AND public.seat_is_full_cohost(mo.role_subtype))
   AND NOT EXISTS (SELECT 1 FROM public.event_members em
                    WHERE em.event_id = t.event_id AND em.user_id = m.user_id
                      AND em.member_type = 'couple');

COMMIT;
