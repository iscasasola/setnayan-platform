-- ============================================================================
-- A HOST IS A HOST THE MOMENT THEY ARE ADDED — whatever their role.
--
-- Owner, 2026-09-28, in one sitting, about his own bride:
--   "creating someone a host needs no approval from their side. they will be
--    auto accepted"
--   "this should also work for any person who becomes host of the event
--    (but regardless of their role)"
--   "she can also be a bride but not a host"
--   "she is not a coordinator"
--
-- ── WHAT WAS LIVE, MEASURED ON HIS OWN EVENT ────────────────────────────────
-- The bride was invited as a host in June. The invite existed only as a link
-- the inviter had to copy and send by hand — no email, no notification, nothing
-- on her account — so it expired unseen and was later revoked. When she did
-- sign up (via her guest invitation) she was linked as a GUEST. Made a host by
-- hand four minutes later, she was STILL a guest to every table: the membership
-- trigger below inserted with ON CONFLICT DO NOTHING, and a guest row is a
-- conflict. A host on paper; a guest to all 117 policies that gate on
-- event_members. That is the normal shape for a bride or groom — they are on
-- their own guest list — so this was not a corner case.
--
-- ── THREE CHANGES ───────────────────────────────────────────────────────────
-- 1. NO ACCEPT STEP. A host added by email whose account already exists is
--    accepted AT INSERT (BEFORE INSERT trigger). One whose account does not yet
--    exist is claimed the moment an account with that email appears (AFTER
--    INSERT OR UPDATE OF email on public.users — which also covers an anonymous
--    draft that later secures itself with a real address). The token accept
--    page keeps working for any row still pending; it is no longer required.
--
-- 2. A HOST'S MEMBERSHIP IS 'couple', WHATEVER THE ROLE. The label (bride,
--    parent, co-host…) says who they are; being a host is what grants access.
--    The ONE exception is `wedding_planner_external`: that is the hired
--    coordinator, who comes in through the RA 10173 consent-gated door
--    (lib/coordinator-grant.ts, the consent modal) and keeps the 2026-08-24
--    "full helper access" = 'coordinator' ruling and its accept step.
--    ⚖ This REVERSES 2026-08-24 for every non-planner host role, which used to
--    be minted 'coordinator' too. Owner-stated above; logged in DECISION_LOG.
--
-- 3. A GUEST WHO IS MADE A HOST IS UPGRADED, NOT SKIPPED. The conflict branch
--    now upgrades guest → host type (and coordinator → couple), keeping
--    guest_id so their invitation, seat and RSVP stay theirs. It NEVER touches
--    a couple row it did not write, and never a vendor row.
--
-- ── THE INVERSE, KEPT HONEST ────────────────────────────────────────────────
-- Removal undoes only what this door did: rows with member_type 'coordinator'
-- (as before) or 'couple' with joined_via = 'invited'. The event's creator
-- ('created_event') is never touched. A row that carries a guest_id goes BACK
-- to 'guest' instead of being deleted — removing a host must not also delete
-- the person from their own guest list. (That branch also drops the person's
-- coordinator colour grants by hand — their FK only CASCADEs on DELETE.)
--
-- ── BACKFILL, MEASURED BEFORE WRITING (prod, 2026-09-28) ────────────────────
-- Pending live invites: 0. Accepted live hosts: 12 — ten creators
-- ('created_event', untouched), one planner (stays coordinator), and the bride
-- above, whose row was corrected by hand today and only gains
-- joined_via = 'invited' here so the inverse can find it.
-- ============================================================================

-- ── 2 + 3 · the membership a host seat mints ────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_delegate_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.member_type :=
    CASE WHEN NEW.role_subtype = 'wedding_planner_external'
         THEN 'coordinator'::public.member_type
         ELSE 'couple'::public.member_type END;
BEGIN
  -- Forward: an accepted, live, claimed host seat is a membership.
  IF NEW.accepted_at IS NOT NULL
     AND NEW.removed_at IS NULL
     AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
    VALUES (NEW.event_id, NEW.user_id, v_type, 'invited')
    ON CONFLICT (event_id, user_id) DO UPDATE
      SET member_type = EXCLUDED.member_type,
          joined_via  = 'invited'
      WHERE public.event_members.member_type = 'guest'
         OR (public.event_members.member_type = 'coordinator'
             AND EXCLUDED.member_type = 'couple');
  END IF;

  -- Inverse: removal undoes only what the forward branch wrote. The "another
  -- live accepted role remains" guard is a BELT — UNIQUE (event_id, user_id)
  -- on event_moderators means it cannot fire today.
  IF NEW.removed_at IS NOT NULL
     AND NEW.user_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.event_moderators m
       WHERE m.event_id = NEW.event_id
         AND m.user_id = NEW.user_id
         AND m.moderator_id <> NEW.moderator_id
         AND m.accepted_at IS NOT NULL
         AND m.removed_at IS NULL
     ) THEN
    -- Still on the guest list → back to guest.
    -- ⚠ event_colour_grants_coordinator CASCADEs off this row only on DELETE
    -- (20271204966904). Keeping the row as a guest would keep a removed
    -- coordinator's colour grants alive, so they go here, explicitly, in the
    -- one branch that does not delete.
    IF EXISTS (
      SELECT 1 FROM public.event_members
      WHERE event_id = NEW.event_id
        AND user_id = NEW.user_id
        AND guest_id IS NOT NULL
        AND (member_type = 'coordinator'
             OR (member_type = 'couple' AND joined_via = 'invited'))
    ) THEN
      DELETE FROM public.event_colour_grants_coordinator
      WHERE event_id = NEW.event_id AND user_id = NEW.user_id;
    END IF;
    UPDATE public.event_members
    SET member_type = 'guest'
    WHERE event_id = NEW.event_id
      AND user_id = NEW.user_id
      AND guest_id IS NOT NULL
      AND (member_type = 'coordinator'
           OR (member_type = 'couple' AND joined_via = 'invited'));
    -- Not a guest → the membership goes.
    DELETE FROM public.event_members
    WHERE event_id = NEW.event_id
      AND user_id = NEW.user_id
      AND guest_id IS NULL
      AND (member_type = 'coordinator'
           OR (member_type = 'couple' AND joined_via = 'invited'));
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_delegate_membership() IS
  'Owner 2026-09-28: an accepted host is a couple member whatever their role; '
  'wedding_planner_external stays coordinator (2026-08-24). Upgrades a guest '
  'row instead of skipping it. Inverse undoes only what it wrote (coordinator, '
  'or couple with joined_via=invited): back to guest when guest_id is set, else '
  'deleted. Never touches the creator (created_event) or a vendor row.';

-- ── 1a · added with an account → a host at once ────────────────────────────
CREATE OR REPLACE FUNCTION public.a_host_added_is_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF NEW.user_id IS NULL
     AND NEW.accepted_at IS NULL
     AND NEW.removed_at IS NULL
     AND NEW.invitation_email IS NOT NULL
     AND NEW.role_subtype <> 'wedding_planner_external' THEN
    SELECT u.user_id INTO v_uid
    FROM public.users u
    WHERE lower(u.email) = lower(btrim(NEW.invitation_email))
    LIMIT 1;

    -- One seat per person per event (UNIQUE event_id, user_id). If they
    -- already hold one — live or removed — leave this row pending rather
    -- than fail the insert.
    IF v_uid IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.event_moderators m
      WHERE m.event_id = NEW.event_id AND m.user_id = v_uid
    ) THEN
      NEW.user_id := v_uid;
      NEW.accepted_at := now();
      NEW.invitation_token := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_host_added_is_accepted ON public.event_moderators;
CREATE TRIGGER a_host_added_is_accepted
BEFORE INSERT ON public.event_moderators
FOR EACH ROW
EXECUTE FUNCTION public.a_host_added_is_accepted();

-- ── 1b · added before they had an account → claimed when it appears ────────
CREATE OR REPLACE FUNCTION public.claim_host_seats_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;
  -- 🔑 A SIGN-UP MUST NEVER FAIL BECAUSE OF THIS. Any error is swallowed with
  -- a warning; the seat stays pending and its token link still works.
  BEGIN
    UPDATE public.event_moderators m
    SET user_id = NEW.user_id,
        accepted_at = now(),
        invitation_token = NULL,
        updated_at = now()
    WHERE m.moderator_id IN (
      -- One seat per event even if the same email was added twice.
      SELECT DISTINCT ON (p.event_id) p.moderator_id
      FROM public.event_moderators p
      WHERE p.user_id IS NULL
        AND p.accepted_at IS NULL
        AND p.removed_at IS NULL
        AND p.role_subtype <> 'wedding_planner_external'
        AND lower(btrim(p.invitation_email)) = lower(NEW.email)
        AND NOT EXISTS (
          SELECT 1 FROM public.event_moderators x
          WHERE x.event_id = p.event_id AND x.user_id = NEW.user_id
        )
      ORDER BY p.event_id, p.created_at DESC
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'claim_host_seats_for_user(%): %', NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claim_host_seats_for_user ON public.users;
CREATE TRIGGER claim_host_seats_for_user
AFTER INSERT OR UPDATE OF email ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.claim_host_seats_for_user();

-- Trigger functions: off the RPC surface (see 20271161203067 for why).
REVOKE ALL ON FUNCTION public.a_host_added_is_accepted() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_host_seats_for_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_delegate_membership() FROM PUBLIC, anon, authenticated;

-- ── BACKFILL ────────────────────────────────────────────────────────────────
-- (a) Pending seats whose person already has an account. 0 in prod today.
UPDATE public.event_moderators m
SET user_id = u.user_id,
    accepted_at = now(),
    invitation_token = NULL,
    updated_at = now()
FROM public.users u
WHERE m.user_id IS NULL
  AND m.accepted_at IS NULL
  AND m.removed_at IS NULL
  AND m.role_subtype <> 'wedding_planner_external'
  AND lower(btrim(m.invitation_email)) = lower(u.email)
  AND NOT EXISTS (
    SELECT 1 FROM public.event_moderators x
    WHERE x.event_id = m.event_id AND x.user_id = u.user_id
  )
  AND m.moderator_id = (
    SELECT p.moderator_id FROM public.event_moderators p
    WHERE p.event_id = m.event_id
      AND p.user_id IS NULL AND p.accepted_at IS NULL AND p.removed_at IS NULL
      AND lower(btrim(p.invitation_email)) = lower(u.email)
    ORDER BY p.created_at DESC
    LIMIT 1
  );

-- (b) Accepted live hosts whose membership is missing or below their seat.
INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
SELECT m.event_id, m.user_id,
       CASE WHEN m.role_subtype = 'wedding_planner_external'
            THEN 'coordinator'::public.member_type
            ELSE 'couple'::public.member_type END,
       'invited'
FROM public.event_moderators m
WHERE m.accepted_at IS NOT NULL
  AND m.removed_at IS NULL
  AND m.user_id IS NOT NULL
ON CONFLICT (event_id, user_id) DO UPDATE
  SET member_type = EXCLUDED.member_type,
      joined_via  = 'invited'
  WHERE public.event_members.member_type = 'guest'
     OR (public.event_members.member_type = 'coordinator'
         AND EXCLUDED.member_type = 'couple');

-- (c) A guest already made a host by hand (the bride above): mark the row as
--     this door's, so removing her returns her to the guest list.
UPDATE public.event_members em
SET joined_via = 'invited'
FROM public.event_moderators m
WHERE m.event_id = em.event_id
  AND m.user_id = em.user_id
  AND m.accepted_at IS NOT NULL
  AND m.removed_at IS NULL
  AND m.role_subtype <> 'wedding_planner_external'
  AND em.member_type = 'couple'
  AND em.joined_via = 'guest_signup';
