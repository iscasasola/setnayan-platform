-- legacy_host_seats_join_their_linked_guest
--
-- ⚖ THE HOSTS FOLD, owner 2026-09-30 (DECISION_LOG "HOSTS FOLD — THREE OWNER
-- ANSWERS", answer 3): old email co-hosts "need to be reinvited" — "unless they
-- are already linked". Hosts leaves for the Guest list, where access is the
-- Access column on a guest's row (`event_moderators.guest_id`, 20271251336140).
-- A seat from before that column existed has no row to show on, so:
--
--   · a live legacy seat whose person's account is ALREADY LINKED to a guest
--     row on this event (their `event_members.guest_id`) is attached to that
--     row — it shows in the Access column at the level it already has, and
--     nobody is re-invited;
--   · every other seat is left exactly as it is. There is no special handling
--     for them (no legacy block): the couple adds the person to the list and
--     sets their Access. Pending email invites are not touched either — they
--     keep working until they expire, and `inviteHost` mints no new non-planner
--     ones.
--
-- 🔑 "LINKED" IS THE OWNER'S DEFINITION, NOT A GUESS: the seat's `user_id` has
-- an `event_members` row on the SAME event with a non-null `guest_id` — the
-- link `lib/guest-account-photos.ts` and the guest card already read. An email
-- that merely matches a guest's email is NOT a link and does not carry.
--
-- Two kinds of legacy seat are deliberately NOT carried, because neither is an
-- "email co-host":
--   · the creator's own self-seat (`joined_via = 'created_event'`) — the creator
--     is always a co-host on their own row by rule (`guestAccessState` lock
--     'creator'), with or without a seat;
--   · the hired planner (`wedding_planner_external`) — a supplier, never a
--     guest-list Access level; their seat moved to their supplier workspace.
--
-- 📏 MEASURED ON PROD, read-only, 2026-09-30, before writing this:
--   11 live seats with guest_id IS NULL — 10 are creators' own self-seats
--   (7 bride · 2 groom · 1 family_helper) and 1 is a hired planner. ZERO are
--   linked by the definition above, and ZERO pending email invites exist (no
--   seat holds an invitation token). So this is expected to move 0 rows today;
--   it is the fold-time sweep for any link made before it runs. It reports its
--   own count (RAISE NOTICE), so "moved nothing" is a measurement, not a guess.
--
-- ⚠ One live seat per guest (`event_moderators_one_live_seat_per_guest`): a
-- guest row that already holds a live seat is skipped, and DISTINCT ON picks
-- one seat per guest so a single statement can never collide with itself.
-- Triggers: `a_seat_guest_is_on_its_event` re-checks the event match (the join
-- guarantees it); `activate_seats_on_seat` acts only on user_id IS NULL seats,
-- and every seat here is live; `sync_delegate_membership` does not fire on a
-- guest_id change. Idempotent: a second run finds no seat with guest_id NULL
-- that it could still attach.

DO $$
DECLARE
  moved integer;
BEGIN
  WITH candidate AS (
    SELECT DISTINCT ON (em.guest_id)
           m.moderator_id,
           em.guest_id
      FROM public.event_moderators AS m
      JOIN public.event_members AS em
        ON em.event_id = m.event_id
       AND em.user_id  = m.user_id
      JOIN public.guests AS g
        ON g.guest_id = em.guest_id
       AND g.event_id = m.event_id
       AND g.deleted_at IS NULL
     WHERE m.guest_id IS NULL
       AND m.removed_at IS NULL
       AND m.user_id IS NOT NULL
       AND m.role_subtype <> 'wedding_planner_external'
       AND em.guest_id IS NOT NULL
       AND em.joined_via IS DISTINCT FROM 'created_event'
       AND NOT EXISTS (
             SELECT 1
               FROM public.event_moderators AS o
              WHERE o.guest_id = em.guest_id
                AND o.removed_at IS NULL
           )
     ORDER BY em.guest_id, m.accepted_at NULLS LAST, m.moderator_id
  )
  UPDATE public.event_moderators AS m
     SET guest_id   = c.guest_id,
         updated_at = now()
    FROM candidate AS c
   WHERE m.moderator_id = c.moderator_id;

  GET DIAGNOSTICS moved = ROW_COUNT;
  RAISE NOTICE 'legacy_host_seats_join_their_linked_guest: % legacy seat(s) attached to their linked guest row', moved;
END
$$;
