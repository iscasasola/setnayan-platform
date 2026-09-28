-- ============================================================================
-- CO-HOSTS COME FROM THE GUEST LIST.
--
-- Owner, 2026-09-28 (DECISION_LOG "CO-HOSTS COME FROM THE GUEST LIST — FINAL
-- MODEL" and the rows after it), verbatim where it decides something:
--   "accepted guests can be assigned as host … host meaning access to the
--    event creation" · "they must accept attending the event first" ·
--   "becoming a host will just give you equal access to the event as the one
--    who created it" · "the assigning is automatic" · "use Co-host" ·
--   "Limited Helper can keep. may view but may not edit" ·
--   "only celebrant themselves can reassign another or their own celebrant
--    role to something else" · "yes they cannot edit".
--
-- ── WHAT WAS LIVE, MEASURED ON HIS OWN EVENT ────────────────────────────────
-- The bride's June host invite was a link nobody sent; it expired unseen. She
-- later joined through her guest invitation and was linked as a GUEST; made a
-- host by hand, she stayed a guest to every table, because the membership
-- trigger inserted with ON CONFLICT DO NOTHING and a guest row IS a conflict.
--
-- ── THE MODEL ───────────────────────────────────────────────────────────────
-- A seat in event_moderators is now tied to a GUEST ROW (`guest_id`). A
-- co-host picks the guest's Access (Co-host · Limited helper); the seat is
-- written PENDING. It goes live — automatically, nobody accepts it — the
-- moment that guest has JOINED: answered Attending AND their account is linked
-- to their guest row. Whichever of the three happens last triggers it:
--   · the Access pick           (event_moderators INSERT / guest_id)
--   · the guest's YES           (guests.rsvp_status → attending)
--   · the guest's account link  (event_members guest_id + user_id)
-- The live seat mints the membership (sync_delegate_membership) and drops the
-- "You are now a co-host…" notice into their tray.
--
-- ── ACCESS BY THE SEAT'S KIND, NEVER BY THE GUEST'S ROLE ─────────────────────
--   co-host (co_host, and the legacy full-host kinds) → 'couple' — equal to
--     the creator
--   limited helper (viewer, family_helper) and the hired planner
--     (wedding_planner_external) → 'coordinator', and READ-ONLY for the
--     limited helper (below)
-- A guest who becomes a co-host is UPGRADED (not skipped); removing them
-- returns them to 'guest', keeping their guest row, seat and RSVP.
--
-- ── A LIMITED HELPER CANNOT EDIT — AT THE DATABASE ──────────────────────────
-- Measured on prod 2026-09-28: 19 tables already gate writes on
-- moderator_area_level (a helper's areas are all 'view', so those refuse); but
-- ~20 more let ANY coordinator member write (appointments, check-ins, guest
-- columns, Papic missions, Live Studio, wall display…). Each of those gets a
-- RESTRICTIVE policy refusing INSERT / UPDATE / DELETE from a limited helper.
-- The set is computed from pg_policies at apply time, and
-- tests/db/cohosts-come-from-the-guest-list.db.test.ts fails if a future table
-- lets a coordinator write without one of the two locks.
--
-- ── CELEBRANTS ──────────────────────────────────────────────────────────────
--   · a co-host whose guest role is a celebrant (celebrant · bride · groom —
--     lib/role-groups isHonoreeRole) CANNOT be removed as co-host;
--   · only a celebrant may change a celebrant's role (their own or another's).
-- ============================================================================

-- ── 1 · a seat belongs to a guest row ───────────────────────────────────────
ALTER TABLE public.event_moderators
  ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES public.guests(guest_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_moderators.guest_id IS
  'The guest-list row this seat was assigned from (owner 2026-09-28: co-hosts come from the guest list). '
  'Waiting (user_id NULL — never read accepted_at, it is DEFAULT now()) until that guest has joined '
  '(Attending + account linked); then live automatically.';

-- One live seat per guest row.
CREATE UNIQUE INDEX IF NOT EXISTS event_moderators_one_live_seat_per_guest
  ON public.event_moderators (guest_id)
  WHERE guest_id IS NOT NULL AND removed_at IS NULL;

-- ── 2 · helpers ─────────────────────────────────────────────────────────────
-- Seat kinds that are FULL co-hosts (equal to the creator). Everything else a
-- seat can be — limited helper, hired planner — is a coordinator member.
CREATE OR REPLACE FUNCTION public.seat_is_full_cohost(p_role_subtype text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT p_role_subtype IN ('co_host', 'host', 'bride', 'groom', 'partner1', 'partner2', 'celebrant');
$$;

-- Is the caller a live LIMITED HELPER on this event? (seat kind 'viewer')
CREATE OR REPLACE FUNCTION public.is_limited_helper(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_moderators m
    WHERE m.event_id = p_event_id
      AND m.user_id = auth.uid()
      AND m.accepted_at IS NOT NULL
      AND m.removed_at IS NULL
      AND m.role_subtype = 'viewer'
  );
$$;
REVOKE ALL ON FUNCTION public.is_limited_helper(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_limited_helper(uuid) TO authenticated;

-- Is this user a CELEBRANT of this event? Their guest row is found two ways —
-- the account link on event_members (a guest who joined) and the person
-- record (the creator's own row, which carries no member link).
CREATE OR REPLACE FUNCTION public.is_event_celebrant(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.guests g
    WHERE g.event_id = p_event_id
      AND g.role IN ('celebrant', 'bride', 'groom')
      AND (
        g.guest_id IN (SELECT em.guest_id FROM public.event_members em
                       WHERE em.event_id = p_event_id AND em.user_id = p_user_id
                         AND em.guest_id IS NOT NULL)
        OR g.person_id IN (SELECT p.person_id FROM public.people p
                           WHERE p.claimed_by_user_id = p_user_id)
      )
  );
$$;
REVOKE ALL ON FUNCTION public.is_event_celebrant(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── 3 · the membership a live seat mints ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_delegate_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.member_type :=
    CASE WHEN public.seat_is_full_cohost(NEW.role_subtype)
         THEN 'couple'::public.member_type
         ELSE 'coordinator'::public.member_type END;
BEGIN
  -- Forward: a live, claimed seat is a membership of the seat's kind. A GUEST
  -- row is upgraded (the bride's bug). Switching a seat between co-host and
  -- limited helper moves the membership with it — but only a membership THIS
  -- door wrote (joined_via 'invited'): the creator's couple row is never
  -- downgraded, and a vendor row is never touched.
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
             AND EXCLUDED.member_type = 'couple')
         OR (public.event_members.member_type = 'couple'
             AND public.event_members.joined_via = 'invited'
             AND EXCLUDED.member_type = 'coordinator');
  END IF;

  -- Inverse: removal undoes only what the forward branch wrote — coordinator,
  -- or couple with joined_via = 'invited'. The creator ('created_event') is
  -- never touched. Still on the guest list → back to guest; otherwise deleted.
  -- (UNIQUE event_id, user_id on this table means the "another live role"
  -- guard cannot fire today; it is a belt.)
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
    -- ⚠ event_colour_grants_coordinator CASCADEs off the membership only on
    -- DELETE (20271204966904); the branch that KEEPS the row must drop them.
    IF EXISTS (
      SELECT 1 FROM public.event_members
      WHERE event_id = NEW.event_id AND user_id = NEW.user_id
        AND guest_id IS NOT NULL
        AND (member_type = 'coordinator'
             OR (member_type = 'couple' AND joined_via = 'invited'))
    ) THEN
      DELETE FROM public.event_colour_grants_coordinator
      WHERE event_id = NEW.event_id AND user_id = NEW.user_id;
    END IF;
    UPDATE public.event_members
    SET member_type = 'guest'
    WHERE event_id = NEW.event_id AND user_id = NEW.user_id
      AND guest_id IS NOT NULL
      AND (member_type = 'coordinator'
           OR (member_type = 'couple' AND joined_via = 'invited'));
    DELETE FROM public.event_members
    WHERE event_id = NEW.event_id AND user_id = NEW.user_id
      AND guest_id IS NULL
      AND (member_type = 'coordinator'
           OR (member_type = 'couple' AND joined_via = 'invited'));
  END IF;

  RETURN NEW;
END;
$$;

-- Fire on a change of the seat's KIND too, so Co-host ⇄ Limited helper moves
-- the membership at once (20271161203067 fired on accept/remove/claim only).
DROP TRIGGER IF EXISTS sync_delegate_membership ON public.event_moderators;
CREATE TRIGGER sync_delegate_membership
AFTER INSERT OR UPDATE OF accepted_at, removed_at, user_id, role_subtype
ON public.event_moderators
FOR EACH ROW
EXECUTE FUNCTION public.sync_delegate_membership();

COMMENT ON FUNCTION public.sync_delegate_membership() IS
  'Owner 2026-09-28: a live seat is a membership by the SEAT''s kind — full co-host → couple '
  '(equal to the creator), limited helper / hired planner → coordinator. Upgrades a guest row '
  'instead of skipping it. Inverse undoes only what it wrote (coordinator, or couple with '
  'joined_via=invited): back to guest when guest_id is set, else deleted. Never the creator.';

-- ── 4 · a pending seat goes live when its guest has joined ──────────────────
CREATE OR REPLACE FUNCTION public.activate_guest_seats(p_guest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event uuid;
  v_attending boolean;
  v_uid uuid;
  r record;
  v_owner text;
  v_event_name text;
  v_event_type text;
  v_full boolean;
BEGIN
  SELECT g.event_id, (g.rsvp_status = 'attending')
    INTO v_event, v_attending
  FROM public.guests g WHERE g.guest_id = p_guest_id;
  IF NOT FOUND OR NOT v_attending THEN
    RETURN;  -- "they must accept attending the event first"
  END IF;

  SELECT em.user_id INTO v_uid
  FROM public.event_members em
  WHERE em.event_id = v_event AND em.guest_id = p_guest_id AND em.user_id IS NOT NULL
  LIMIT 1;
  IF v_uid IS NULL THEN
    RETURN;  -- attending but no account linked yet: not joined
  END IF;

  FOR r IN
    SELECT m.moderator_id, m.event_id, m.role_subtype, m.invited_by_user_id
    FROM public.event_moderators m
    -- ⚠ "Waiting" = NO ACCOUNT ON THE SEAT YET, never "accepted_at IS NULL":
    -- event_moderators.accepted_at is DEFAULT now(), so a seat inserted
    -- without naming it is stamped accepted with nobody in it (measured on
    -- prod 2026-09-28 — the first dry run of this flow skipped every seat).
    WHERE m.guest_id = p_guest_id
      AND m.user_id IS NULL
      AND m.removed_at IS NULL
  LOOP
    -- One seat per person per event (UNIQUE event_id, user_id): a person who
    -- already holds one (the creator's own seat) keeps it; this stays pending.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.event_moderators x
      WHERE x.event_id = r.event_id AND x.user_id = v_uid
        AND x.moderator_id <> r.moderator_id
    );

    UPDATE public.event_moderators
    SET user_id = v_uid,
        accepted_at = now(),
        invitation_token = NULL,
        updated_at = now()
    WHERE moderator_id = r.moderator_id;

    -- "You are now a co-host for {user name}'s {event name} {event type} event."
    -- {user name} = the event's creator; the inviter if the creator has no name.
    SELECT e.display_name, replace(e.event_type::text, '_', ' ')
      INTO v_event_name, v_event_type
    FROM public.events e WHERE e.event_id = r.event_id;
    SELECT u.display_name INTO v_owner
    FROM public.event_members em JOIN public.users u ON u.user_id = em.user_id
    WHERE em.event_id = r.event_id AND em.member_type = 'couple'
      AND em.joined_via = 'created_event'
    ORDER BY em.id LIMIT 1;
    IF v_owner IS NULL THEN
      SELECT u.display_name INTO v_owner FROM public.users u
      WHERE u.user_id = r.invited_by_user_id;
    END IF;
    v_full := public.seat_is_full_cohost(r.role_subtype);

    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
      VALUES (
        v_uid,
        'cohost_added',
        left(format('You are now a %s for %s%s event.',
          CASE WHEN v_full THEN 'co-host' ELSE 'limited helper' END,
          CASE WHEN v_owner IS NULL THEN '' ELSE v_owner || '''s ' END,
          trim(coalesce(v_event_name, 'this') || ' ' || coalesce(v_event_type, ''))), 160),
        CASE WHEN v_full
          THEN 'You have access to the following: the guest list, seat plan, budget and payments, suppliers, schedule, the Event Hub, and adding or removing co-hosts — the same as the person who created it.'
          ELSE 'You can follow the progress: the guest list, seat plan, budget, suppliers and schedule. You can view everything, but you can''t edit or change anything.'
        END,
        '/dashboard/' || r.event_id::text || '?welcome=cohost',
        r.event_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- The seat is the product; the notice is its announcement. Never let a
      -- failed notice undo a co-host.
      RAISE WARNING 'activate_guest_seats notice (%): %', r.moderator_id, SQLERRM;
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_guest_seats(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.activate_seats_on_seat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.guest_id IS NOT NULL AND NEW.user_id IS NULL AND NEW.removed_at IS NULL THEN
    PERFORM public.activate_guest_seats(NEW.guest_id);
  END IF;
  RETURN NEW;
END;
$$;
-- INSERT = a fresh pick; UPDATE OF removed_at = a removed seat REVIVED by a
-- later pick (UNIQUE event_id, user_id means a person keeps one seat row per
-- event for life, so re-adding revives it rather than inserting a second).
DROP TRIGGER IF EXISTS activate_seats_on_seat ON public.event_moderators;
CREATE TRIGGER activate_seats_on_seat
AFTER INSERT OR UPDATE OF guest_id, removed_at ON public.event_moderators
FOR EACH ROW EXECUTE FUNCTION public.activate_seats_on_seat();

CREATE OR REPLACE FUNCTION public.activate_seats_on_rsvp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.rsvp_status = 'attending' AND OLD.rsvp_status IS DISTINCT FROM 'attending' THEN
    PERFORM public.activate_guest_seats(NEW.guest_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS activate_seats_on_rsvp ON public.guests;
CREATE TRIGGER activate_seats_on_rsvp
AFTER UPDATE OF rsvp_status ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.activate_seats_on_rsvp();

CREATE OR REPLACE FUNCTION public.activate_seats_on_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.guest_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    PERFORM public.activate_guest_seats(NEW.guest_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS activate_seats_on_link ON public.event_members;
CREATE TRIGGER activate_seats_on_link
AFTER INSERT OR UPDATE OF guest_id, user_id ON public.event_members
FOR EACH ROW EXECUTE FUNCTION public.activate_seats_on_link();

-- ── 5 · a celebrant co-host cannot be removed ───────────────────────────────
CREATE OR REPLACE FUNCTION public.a_celebrant_cohost_stays()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Removed, OR switched down to a limited-access kind — both take a
  -- celebrant's co-host access away, so both are refused.
  IF ((NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL)
      OR (NEW.removed_at IS NULL AND NOT public.seat_is_full_cohost(NEW.role_subtype)))
     AND OLD.removed_at IS NULL
     AND public.seat_is_full_cohost(OLD.role_subtype)
     AND EXISTS (
       SELECT 1 FROM public.guests g
       WHERE g.event_id = OLD.event_id
         AND g.role IN ('celebrant', 'bride', 'groom')
         AND (g.guest_id = OLD.guest_id
              OR (OLD.user_id IS NOT NULL AND public.is_event_celebrant(OLD.event_id, OLD.user_id)))
     ) THEN
    RAISE EXCEPTION 'celebrant_cohost_locked'
      USING ERRCODE = 'P0001',
            HINT = 'A celebrant stays a co-host. Change their role from celebrant first.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_celebrant_cohost_stays ON public.event_moderators;
CREATE TRIGGER a_celebrant_cohost_stays
BEFORE UPDATE OF removed_at, role_subtype ON public.event_moderators
FOR EACH ROW EXECUTE FUNCTION public.a_celebrant_cohost_stays();

-- ── 6 · only a celebrant changes a celebrant's role ─────────────────────────
-- auth.uid() is NULL for the service role (imports, erasure, system jobs); the
-- app's own role edits run as the signed-in user, so this is where they meet it.
CREATE OR REPLACE FUNCTION public.only_a_celebrant_moves_a_celebrant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role IN ('celebrant', 'bride', 'groom')
     AND NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_event_celebrant(OLD.event_id, auth.uid()) THEN
    RAISE EXCEPTION 'celebrant_role_locked'
      USING ERRCODE = 'P0001',
            HINT = 'Only a celebrant can change a celebrant''s role.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS only_a_celebrant_moves_a_celebrant ON public.guests;
CREATE TRIGGER only_a_celebrant_moves_a_celebrant
BEFORE UPDATE OF role ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.only_a_celebrant_moves_a_celebrant();

-- ── 7 · a limited helper cannot write ───────────────────────────────────────
-- Every table whose PERMISSIVE write policy admits a coordinator member
-- WITHOUT an area check gets a RESTRICTIVE refusal for a limited helper.
-- (Area-gated tables already refuse them: their areas are all 'view'.)
DO $$
DECLARE
  t text;
  short text;
BEGIN
  FOR t IN
    SELECT p.tablename
    FROM pg_policies p
    JOIN information_schema.columns c
      ON c.table_schema = 'public' AND c.table_name = p.tablename AND c.column_name = 'event_id'
    WHERE p.schemaname = 'public'
      AND p.permissive = 'PERMISSIVE'
      AND p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    GROUP BY p.tablename
    HAVING bool_or((coalesce(p.qual, '') || coalesce(p.with_check, '')) ILIKE '%coordinator%')
       AND NOT bool_or((coalesce(p.qual, '') || coalesce(p.with_check, '')) ILIKE '%moderator_area_level%')
  LOOP
    short := left(t, 40);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'lh_ro_ins_' || short, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'lh_ro_upd_' || short, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'lh_ro_del_' || short, t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_limited_helper(event_id))', 'lh_ro_ins_' || short, t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_limited_helper(event_id))', 'lh_ro_upd_' || short, t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_limited_helper(event_id))', 'lh_ro_del_' || short, t);
  END LOOP;
END;
$$;

-- ── 8 · followers ───────────────────────────────────────────────────────────
-- Owner 2026-09-28: "all accepted guests of an event will automatically follow
-- the hosts. but not add them" · "connected people follow each other" ·
-- "Claire Buanhog and Ice Casasola will automatically follow each other since
-- they are both celebrants. A guest added will automatically follow both".
--   · the event's co-hosts ('couple' members — the creator and every live
--     co-host) follow EACH OTHER;
--   · a guest who has JOINED (Attending + account linked) follows every
--     co-host — follow only, never a connection;
--   · a co-host added later is followed by every guest already joined;
--   · a CONFIRMED connection makes both people follow each other.
-- Follows are the follower's own: removing a co-host unfollows nobody, and
-- anyone may unfollow later. user_follows' UNIQUE + no-self CHECK make every
-- insert here idempotent.

-- 🔑 AN UNFOLLOW STICKS. The automatic follows below are recomputed whole, so
-- without a memory of "I unfollowed them" the next guest's YES would re-follow
-- somebody who had just unfollowed — and the owner's rule is that a guest "can
-- unfollow any time". Deleting a follow (any door: the button, SQL) leaves a
-- private tombstone; automatic follows skip tombstoned pairs; following again
-- BY HAND clears it. (Caught by the People-page design pass, 2026-09-28,
-- before this merged.)
CREATE TABLE IF NOT EXISTS public.user_unfollows (
  id                bigserial PRIMARY KEY,
  follower_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_unfollows_unique UNIQUE (follower_user_id, followed_user_id)
);
ALTER TABLE public.user_unfollows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_unfollows_own_read ON public.user_unfollows;
CREATE POLICY user_unfollows_own_read ON public.user_unfollows
  FOR SELECT TO authenticated
  USING (follower_user_id = auth.uid());
REVOKE ALL ON public.user_unfollows FROM anon;
COMMENT ON TABLE public.user_unfollows IS
  'Owner 2026-09-28: a guest "can unfollow any time". Written only by triggers on user_follows '
  '(a delete leaves a tombstone; a hand-made follow clears it); read by the automatic follows so '
  'they never re-follow somebody the person unfollowed. Private to the follower.';

CREATE OR REPLACE FUNCTION public.remember_an_unfollow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO public.user_unfollows (follower_user_id, followed_user_id)
    VALUES (OLD.follower_user_id, OLD.followed_user_id)
    ON CONFLICT (follower_user_id, followed_user_id) DO NOTHING;
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;  -- an account being deleted cascades its follows; nothing to remember
  END;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS remember_an_unfollow ON public.user_follows;
CREATE TRIGGER remember_an_unfollow
AFTER DELETE ON public.user_follows
FOR EACH ROW EXECUTE FUNCTION public.remember_an_unfollow();

CREATE OR REPLACE FUNCTION public.a_follow_forgets_the_unfollow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.user_unfollows
  WHERE follower_user_id = NEW.follower_user_id AND followed_user_id = NEW.followed_user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_follow_forgets_the_unfollow ON public.user_follows;
CREATE TRIGGER a_follow_forgets_the_unfollow
AFTER INSERT ON public.user_follows
FOR EACH ROW EXECUTE FUNCTION public.a_follow_forgets_the_unfollow();
REVOKE ALL ON FUNCTION public.remember_an_unfollow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.a_follow_forgets_the_unfollow() FROM PUBLIC, anon, authenticated;

-- Everyone who should follow / be followed on one event, recomputed whole:
-- cheap (an event has a handful of co-hosts) and it cannot drift.
CREATE OR REPLACE FUNCTION public.sync_event_follows(p_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cohosts AS (
    SELECT DISTINCT em.user_id FROM public.event_members em
    WHERE em.event_id = p_event_id AND em.member_type = 'couple' AND em.user_id IS NOT NULL
  ),
  joined AS (
    SELECT DISTINCT em.user_id FROM public.event_members em
    JOIN public.guests g ON g.guest_id = em.guest_id
    WHERE em.event_id = p_event_id AND em.user_id IS NOT NULL
      AND g.rsvp_status = 'attending'
  ),
  pairs AS (
    SELECT a.user_id AS follower, b.user_id AS followed FROM cohosts a, cohosts b
    UNION
    SELECT j.user_id, c.user_id FROM joined j, cohosts c
  )
  INSERT INTO public.user_follows (follower_user_id, followed_user_id)
  SELECT follower, followed FROM pairs p
  WHERE follower <> followed
    AND NOT EXISTS (SELECT 1 FROM public.user_unfollows x
                    WHERE x.follower_user_id = p.follower AND x.followed_user_id = p.followed)
  ON CONFLICT (follower_user_id, followed_user_id) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.sync_event_follows(uuid) FROM PUBLIC, anon, authenticated;

-- A membership that becomes a co-host, or a guest link that appears.
CREATE OR REPLACE FUNCTION public.follows_on_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL
     AND (NEW.member_type = 'couple' OR NEW.guest_id IS NOT NULL) THEN
    PERFORM public.sync_event_follows(NEW.event_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS follows_on_membership ON public.event_members;
CREATE TRIGGER follows_on_membership
AFTER INSERT OR UPDATE OF member_type, guest_id, user_id ON public.event_members
FOR EACH ROW EXECUTE FUNCTION public.follows_on_membership();

-- A guest who says YES after their account is already linked.
CREATE OR REPLACE FUNCTION public.follows_on_rsvp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.rsvp_status = 'attending' AND OLD.rsvp_status IS DISTINCT FROM 'attending' THEN
    PERFORM public.sync_event_follows(NEW.event_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS follows_on_rsvp ON public.guests;
CREATE TRIGGER follows_on_rsvp
AFTER UPDATE OF rsvp_status ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.follows_on_rsvp();

-- A confirmed connection: both people follow each other.
CREATE OR REPLACE FUNCTION public.follows_on_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a uuid; b uuid;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed'
     AND NEW.deleted_at IS NULL THEN
    SELECT claimed_by_user_id INTO a FROM public.people WHERE person_id = NEW.from_person_id;
    SELECT claimed_by_user_id INTO b FROM public.people WHERE person_id = NEW.to_person_id;
    IF a IS NOT NULL AND b IS NOT NULL AND a <> b THEN
      INSERT INTO public.user_follows (follower_user_id, followed_user_id)
      SELECT v.f, v.t FROM (VALUES (a, b), (b, a)) AS v(f, t)
      WHERE NOT EXISTS (SELECT 1 FROM public.user_unfollows x
                        WHERE x.follower_user_id = v.f AND x.followed_user_id = v.t)
      ON CONFLICT (follower_user_id, followed_user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS follows_on_connection ON public.person_connections;
CREATE TRIGGER follows_on_connection
AFTER UPDATE OF status ON public.person_connections
FOR EACH ROW EXECUTE FUNCTION public.follows_on_connection();

REVOKE ALL ON FUNCTION public.follows_on_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.follows_on_rsvp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.follows_on_connection() FROM PUBLIC, anon, authenticated;

-- Trigger functions: off the RPC surface.
REVOKE ALL ON FUNCTION public.sync_delegate_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_seats_on_seat() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_seats_on_rsvp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_seats_on_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.a_celebrant_cohost_stays() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.only_a_celebrant_moves_a_celebrant() FROM PUBLIC, anon, authenticated;

-- ── BACKFILL (measured on prod 2026-09-28 before writing) ───────────────────
-- (a) Tie every live seat to its holder's guest row, where they have one. In
--     prod that is the bride's seat on S89E-W8324K4Q5J (her account is linked
--     to her guest row); creators' seats have no member link and stay NULL.
UPDATE public.event_moderators m
SET guest_id = em.guest_id
FROM public.event_members em
WHERE m.guest_id IS NULL
  AND m.user_id IS NOT NULL
  AND m.accepted_at IS NOT NULL
  AND m.removed_at IS NULL
  AND em.event_id = m.event_id
  AND em.user_id = m.user_id
  AND em.guest_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.event_moderators x
    WHERE x.guest_id = em.guest_id AND x.removed_at IS NULL
  );

-- (b) Live seats whose membership is missing or below their kind.
INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
SELECT m.event_id, m.user_id,
       CASE WHEN public.seat_is_full_cohost(m.role_subtype)
            THEN 'couple'::public.member_type
            ELSE 'coordinator'::public.member_type END,
       'invited'
FROM public.event_moderators m
WHERE m.accepted_at IS NOT NULL AND m.removed_at IS NULL AND m.user_id IS NOT NULL
ON CONFLICT (event_id, user_id) DO UPDATE
  SET member_type = EXCLUDED.member_type,
      joined_via  = 'invited'
  WHERE public.event_members.member_type = 'guest'
     OR (public.event_members.member_type = 'coordinator'
         AND EXCLUDED.member_type = 'couple');

-- (c) A guest made a co-host by hand (the bride): mark the row as this door's,
--     so removing her returns her to the guest list.
UPDATE public.event_members em
SET joined_via = 'invited'
FROM public.event_moderators m
WHERE m.event_id = em.event_id AND m.user_id = em.user_id
  AND m.accepted_at IS NOT NULL AND m.removed_at IS NULL
  AND public.seat_is_full_cohost(m.role_subtype)
  AND em.member_type = 'couple'
  AND em.joined_via = 'guest_signup';

-- (d) The "Part of the host" label is retired (owner 2026-09-28: the tag must be
--     TRUE, so "+Co-host" is derived from the seat and nothing else). In prod
--     exactly one guest wears it — the bride, who holds a real seat.
UPDATE public.guests
SET extra_roles = array_remove(extra_roles, 'host'::public.guest_role)
WHERE 'host'::public.guest_role = ANY (extra_roles);

-- (e) Followers for what is already true: every event's co-hosts follow each
--     other and its joined guests follow them; every confirmed connection
--     follows both ways. (Prod 2026-09-28: 0 follows exist.)
SELECT public.sync_event_follows(e.event_id) FROM public.events e;

INSERT INTO public.user_follows (follower_user_id, followed_user_id)
SELECT pa.claimed_by_user_id, pb.claimed_by_user_id
FROM public.person_connections pc
JOIN public.people pa ON pa.person_id = pc.from_person_id
JOIN public.people pb ON pb.person_id = pc.to_person_id
WHERE pc.status = 'confirmed' AND pc.deleted_at IS NULL
  AND pa.claimed_by_user_id IS NOT NULL AND pb.claimed_by_user_id IS NOT NULL
  AND pa.claimed_by_user_id <> pb.claimed_by_user_id
UNION
SELECT pb.claimed_by_user_id, pa.claimed_by_user_id
FROM public.person_connections pc
JOIN public.people pa ON pa.person_id = pc.from_person_id
JOIN public.people pb ON pb.person_id = pc.to_person_id
WHERE pc.status = 'confirmed' AND pc.deleted_at IS NULL
  AND pa.claimed_by_user_id IS NOT NULL AND pb.claimed_by_user_id IS NOT NULL
  AND pa.claimed_by_user_id <> pb.claimed_by_user_id
ON CONFLICT (follower_user_id, followed_user_id) DO NOTHING;
