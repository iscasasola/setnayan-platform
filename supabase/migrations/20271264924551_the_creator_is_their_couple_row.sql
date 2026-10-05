-- ============================================================================
-- THE EVENT'S CREATOR IS THEIR OWN COUPLE ROW.
--
-- Owner, 2026-10-04 (measured read-only on his own wedding): the account that
-- CREATED the event holds an `event_members` row with `guest_id = NULL`, so his
-- Groom row on the guest list read "Not linked", and a host's card offers no
-- Invite ("A host — nothing to send") — there was no way in the app to say
-- "that row is me". The bride, who joined through her link, IS linked to hers.
--
-- Two halves, both here:
--
--   1 · BACKFILL (existing events). A creator's unlinked membership is attached
--       to a couple row (bride · groom) ONLY when that is unambiguous:
--         · the row is unlinked (no membership holds it), not deleted, not
--           marked passed away, and its person record is not claimed by a
--           DIFFERENT account;
--         · it matches the creator — the row's email is the account's email,
--           OR its person record is the one the account claimed, OR its first
--           AND last name equal the account's profile name;
--         · it is the creator's ONLY matching row, AND the creator is the
--           row's ONLY matching creator. Two candidates → nothing (never guess).
--       Idempotent: it only ever fills a NULL `guest_id`, so a re-run finds
--       nothing to do.
--
--   2 · "THIS IS ME" (the in-app fallback). `claim_my_couple_row(event, guest)`
--       — a host (a `couple` member of the event) whose own membership holds
--       no row attaches it to an unlinked bride / groom row of that event.
--       SECURITY DEFINER with every check explicit inside it; returns a word
--       ('linked' or why not), never raises for a refusal.
--
-- New events are linked at creation by the onboarding commit (it knows which of
-- the two the creator said they are) — app/onboarding/wedding/actions.ts.
--
-- ⚠ Only `event_members.guest_id` (and its mirror `role`) moves. The member
-- type stays `couple` and `joined_via` stays `created_event`, so nothing that
-- reads the creator (loadGuestAccessMap, sync_delegate_membership's "never the
-- creator") changes meaning. The triggers that fire on a guest_id change are
-- benign here: link_guest_to_account_person only acts on `guest` members,
-- activate_seats_on_link only acts on an attending row's pending seats, and
-- follows_on_membership already counts every couple member.
-- ============================================================================

-- ── 1 · backfill ────────────────────────────────────────────────────────────
WITH creators AS (
  SELECT em.id AS member_row, em.event_id, em.user_id
  FROM public.event_members em
  WHERE em.member_type = 'couple'
    AND em.joined_via = 'created_event'
    AND em.guest_id IS NULL
    AND em.user_id IS NOT NULL
),
matches AS (
  SELECT c.member_row, c.event_id, c.user_id, g.guest_id, g.role
  FROM creators c
  JOIN public.users u ON u.user_id = c.user_id
  JOIN public.guests g
    ON g.event_id = c.event_id
   AND g.role IN ('bride', 'groom')
   AND g.deleted_at IS NULL
   AND COALESCE(g.passed_away, false) = false
  LEFT JOIN public.people p ON p.person_id = g.person_id
  WHERE NOT EXISTS (
          SELECT 1 FROM public.event_members x
          WHERE x.event_id = g.event_id AND x.guest_id = g.guest_id
        )
    AND (p.claimed_by_user_id IS NULL OR p.claimed_by_user_id = c.user_id)
    AND (
          (NULLIF(btrim(g.email), '') IS NOT NULL
           AND lower(btrim(g.email)) = lower(btrim(u.email)))
       OR (p.claimed_by_user_id = c.user_id)
       OR (NULLIF(btrim(u.first_name), '') IS NOT NULL
           AND NULLIF(btrim(u.last_name), '') IS NOT NULL
           AND lower(btrim(g.first_name)) = lower(btrim(u.first_name))
           AND lower(btrim(g.last_name))  = lower(btrim(u.last_name)))
        )
),
unambiguous AS (
  SELECT m.member_row, m.guest_id, m.role
  FROM matches m
  WHERE (SELECT count(*) FROM matches a WHERE a.member_row = m.member_row) = 1
    AND (SELECT count(*) FROM matches b WHERE b.guest_id = m.guest_id) = 1
)
UPDATE public.event_members em
SET guest_id = un.guest_id,
    role     = un.role
FROM unambiguous un
WHERE em.id = un.member_row
  AND em.guest_id IS NULL;

-- ── 2 · "This is me" ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_my_couple_row(p_event_id uuid, p_guest_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_member_id bigint;
  v_member_guest uuid;
  v_role text;
  v_claimed_by uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'not_signed_in';
  END IF;

  -- A HOST of this event: a `couple` member. Their own membership must hold no
  -- row yet — one account, one row.
  SELECT em.id, em.guest_id INTO v_member_id, v_member_guest
  FROM public.event_members em
  WHERE em.event_id = p_event_id
    AND em.user_id = v_uid
    AND em.member_type = 'couple'
  FOR UPDATE;
  IF v_member_id IS NULL THEN
    RETURN 'not_a_host';
  END IF;
  IF v_member_guest IS NOT NULL THEN
    IF v_member_guest = p_guest_id THEN
      RETURN 'already_yours';
    END IF;
    RETURN 'you_hold_another_row';
  END IF;

  -- A COUPLE row of THIS event (bride · groom), live.
  SELECT g.role, p.claimed_by_user_id INTO v_role, v_claimed_by
  FROM public.guests g
  LEFT JOIN public.people p ON p.person_id = g.person_id
  WHERE g.guest_id = p_guest_id
    AND g.event_id = p_event_id
    AND g.deleted_at IS NULL
    AND COALESCE(g.passed_away, false) = false;
  IF v_role IS NULL OR v_role NOT IN ('bride', 'groom') THEN
    RETURN 'not_a_couple_row';
  END IF;

  -- Never a row somebody already holds, nor one another account's person owns.
  IF EXISTS (
    SELECT 1 FROM public.event_members x
    WHERE x.event_id = p_event_id AND x.guest_id = p_guest_id
  ) THEN
    RETURN 'already_linked';
  END IF;
  IF v_claimed_by IS NOT NULL AND v_claimed_by <> v_uid THEN
    RETURN 'someone_else';
  END IF;

  BEGIN
    UPDATE public.event_members
    SET guest_id = p_guest_id,
        role     = v_role
    WHERE id = v_member_id
      AND guest_id IS NULL;
  EXCEPTION WHEN unique_violation THEN
    RETURN 'already_linked';
  END;
  RETURN 'linked';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_my_couple_row(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_my_couple_row(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.claim_my_couple_row(uuid, uuid) IS
  'Owner 2026-10-04: "This is me" on a host''s own unlinked couple row. A couple member of the event '
  'whose membership holds no row attaches it to an unlinked, live bride/groom row of that event whose '
  'person record is not another account''s. Returns linked | already_yours | you_hold_another_row | '
  'not_signed_in | not_a_host | not_a_couple_row | already_linked | someone_else.';
