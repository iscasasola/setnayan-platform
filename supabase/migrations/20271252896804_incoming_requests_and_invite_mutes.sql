-- ============================================================================
-- INCOMING REQUESTS — an invitation shows in the invited person's account,
-- and they can stop hearing from somebody.
--
-- Owner, 2026-09-28: "if they have an account. it must show on their event
-- page. as incoming requests" · "You are invited to {user name}'s {event name}
-- {event type} event. (YES/NO)" · the three-holes ruling: "Incoming requests
-- get 'Don't show me invites from this person'". ⚖ OWNER/DPO RULING: this
-- overrides the counsel hold on the in-account guest notice
-- (FEATURE_ACCOUNT_AUTOSURFACE) for THIS surface — recorded in DECISION_LOG.
--
-- ── THE REQUEST ITSELF IS NOT STORED ────────────────────────────────────────
-- An incoming request is a READ, not a row: a guest row on somebody's list
-- whose email is this account's email, still unanswered, not yet linked to
-- this account, from somebody not muted or blocked. Computed where it is shown
-- (lib/incoming-requests.server.ts), so it can never drift from the guest list
-- it describes — the host edits the email, the request follows; the guest
-- answers, it is gone; an account created LATER with that email sees it at once
-- ("when they get an account, the event syncs to their account").
--
-- What IS written here:
--   1. `invite_mutes` — "Don't show me invites from this person". PRIVATE to the
--      person muting: unlike `blocked_users` (a chat block, which the blocked
--      person can read and which also stops messages), a mute tells nobody and
--      stops nothing but invitations. An existing chat BLOCK also hides
--      invitations — somebody you blocked cannot invite you either.
--   2. the bell row: a guest row given an email that belongs to an account
--      drops ONE `event_invitation` notice into that account's tray.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invite_mutes (
  id             bigserial PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invite_mutes_unique UNIQUE (user_id, muted_user_id),
  CONSTRAINT invite_mutes_not_self CHECK (user_id <> muted_user_id)
);
ALTER TABLE public.invite_mutes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.invite_mutes IS
  'Owner 2026-09-28: "Don''t show me invites from this person". Private to the muter (Pattern A: '
  'user_id = auth.uid()); the muted person is never told. Hides incoming requests and their bell '
  'notice from muted_user_id''s events. Nothing else is affected (a chat block is blocked_users).';

DROP POLICY IF EXISTS invite_mutes_own ON public.invite_mutes;
CREATE POLICY invite_mutes_own ON public.invite_mutes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Exactly what the page needs, nothing inherited: the default grant would hand
-- authenticated UPDATE/TRUNCATE/REFERENCES too (exposure-freeze would say so).
REVOKE ALL ON public.invite_mutes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.invite_mutes TO authenticated;
GRANT ALL ON public.invite_mutes TO service_role;
GRANT USAGE ON SEQUENCE public.invite_mutes_id_seq TO authenticated;

-- The person an invitation is FROM: the event's creator (their name is the
-- {user name} in the owner's sentence).
CREATE OR REPLACE FUNCTION public.event_creator_user_id(p_event_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT em.user_id FROM public.event_members em
  WHERE em.event_id = p_event_id AND em.member_type = 'couple'
    AND em.joined_via = 'created_event'
  ORDER BY em.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.event_creator_user_id(uuid) FROM PUBLIC, anon, authenticated;

-- ── the bell row ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.an_invitation_reaches_the_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_creator uuid;
  v_owner text;
  v_event_name text;
  v_event_type text;
BEGIN
  IF NEW.email IS NULL OR NEW.deleted_at IS NOT NULL OR NEW.rsvp_status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND lower(btrim(coalesce(OLD.email, ''))) = lower(btrim(NEW.email)) THEN
    RETURN NEW;  -- the email did not change: nothing new to tell anybody
  END IF;

  -- 🔑 A GUEST INSERT MUST NEVER FAIL BECAUSE OF THIS (a couple importing 200
  -- names). Any error is swallowed; the request still shows on the Events page,
  -- which is computed, not written.
  BEGIN
    SELECT u.user_id INTO v_uid FROM public.users u
    WHERE lower(u.email) = lower(btrim(NEW.email)) LIMIT 1;
    IF v_uid IS NULL THEN RETURN NEW; END IF;

    v_creator := public.event_creator_user_id(NEW.event_id);
    IF v_creator IS NULL OR v_creator = v_uid THEN RETURN NEW; END IF;

    IF EXISTS (SELECT 1 FROM public.event_members em
               WHERE em.event_id = NEW.event_id AND em.user_id = v_uid)
       OR EXISTS (SELECT 1 FROM public.invite_mutes m
                  WHERE m.user_id = v_uid AND m.muted_user_id = v_creator)
       OR EXISTS (SELECT 1 FROM public.blocked_users b
                  WHERE b.blocker_user_id = v_uid AND b.blocked_user_id = v_creator)
       OR EXISTS (SELECT 1 FROM public.notifications n
                  WHERE n.user_id = v_uid AND n.event_id = NEW.event_id
                    AND n.type = 'event_invitation') THEN
      RETURN NEW;
    END IF;

    SELECT e.display_name, replace(e.event_type::text, '_', ' ')
      INTO v_event_name, v_event_type
    FROM public.events e WHERE e.event_id = NEW.event_id;
    SELECT u.display_name INTO v_owner FROM public.users u WHERE u.user_id = v_creator;

    INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
    VALUES (
      v_uid,
      'event_invitation',
      left(format('You are invited to %s%s event.',
        CASE WHEN v_owner IS NULL THEN '' ELSE v_owner || '''s ' END,
        trim(coalesce(v_event_name, 'an') || ' ' || coalesce(v_event_type, ''))), 160),
      'Say yes or no on your Events page.',
      '/dashboard',
      NEW.event_id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'an_invitation_reaches_the_account(%): %', NEW.guest_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.an_invitation_reaches_the_account() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS an_invitation_reaches_the_account ON public.guests;
CREATE TRIGGER an_invitation_reaches_the_account
AFTER INSERT OR UPDATE OF email ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.an_invitation_reaches_the_account();

-- ── the requests themselves: ONE read, the same for the page and the answer ──
-- A guest row on somebody's list whose email is THIS account's CONFIRMED email,
-- unanswered, not linked to this account yet, from a creator not muted or
-- blocked. `email_confirmed_at` is required: the email is the only proof this
-- person is the one the host meant, so an unconfirmed address proves nothing.
CREATE OR REPLACE FUNCTION public.incoming_requests_for_me()
RETURNS TABLE (
  guest_id uuid,
  event_id uuid,
  event_name text,
  event_type text,
  event_date date,
  owner_user_id uuid,
  owner_name text,
  event_slug text,
  qr_token text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.guest_id, g.event_id, e.display_name::text, e.event_type::text, e.event_date,
         c.uid, u.display_name::text, e.slug::text, g.qr_token::text
  FROM auth.users me
  JOIN public.guests g ON lower(btrim(g.email)) = lower(me.email)
  JOIN public.events e ON e.event_id = g.event_id
  CROSS JOIN LATERAL (SELECT public.event_creator_user_id(g.event_id) AS uid) c
  LEFT JOIN public.users u ON u.user_id = c.uid
  WHERE me.id = auth.uid()
    AND me.email IS NOT NULL
    AND me.email_confirmed_at IS NOT NULL
    AND g.deleted_at IS NULL
    AND g.rsvp_status = 'pending'
    AND coalesce(e.archived, false) = false
    AND c.uid IS NOT NULL AND c.uid <> me.id
    AND NOT EXISTS (SELECT 1 FROM public.event_members em
                    WHERE em.event_id = g.event_id AND em.user_id = me.id)
    AND NOT EXISTS (SELECT 1 FROM public.event_members em2
                    WHERE em2.event_id = g.event_id AND em2.guest_id = g.guest_id)
    AND NOT EXISTS (SELECT 1 FROM public.invite_mutes m
                    WHERE m.user_id = me.id AND m.muted_user_id = c.uid)
    AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
                    WHERE b.blocker_user_id = me.id AND b.blocked_user_id = c.uid)
  ORDER BY e.event_date NULLS LAST, g.guest_id;
$$;
REVOKE ALL ON FUNCTION public.incoming_requests_for_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.incoming_requests_for_me() TO authenticated;

-- ── the answer: YES joins and attends; NO declines. The only No in the flow ──
-- YES links this account to its guest row FIRST, then marks Attending — so the
-- triggers downstream see a JOINED guest: a waiting co-host seat goes live
-- (activate_guest_seats) and the guest follows the co-hosts (follows_on_rsvp).
-- "accepting means they are also going automatically."
CREATE OR REPLACE FUNCTION public.answer_incoming_request(p_guest_id uuid, p_yes boolean)
RETURNS TABLE (event_id uuid, event_slug text, qr_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  SELECT * INTO r FROM public.incoming_requests_for_me() q WHERE q.guest_id = p_guest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_your_request' USING ERRCODE = '42501';
  END IF;

  IF p_yes THEN
    INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
    VALUES (r.event_id, auth.uid(), 'guest', 'invite_claim', r.guest_id);
    UPDATE public.guests
    SET rsvp_status = 'attending', rsvp_responded_at = now(), updated_at = now()
    WHERE guest_id = r.guest_id;
  ELSE
    UPDATE public.guests
    SET rsvp_status = 'declined', rsvp_responded_at = now(), updated_at = now()
    WHERE guest_id = r.guest_id;
  END IF;

  RETURN QUERY SELECT r.event_id, r.event_slug, r.qr_token;
END;
$$;
REVOKE ALL ON FUNCTION public.answer_incoming_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_incoming_request(uuid, boolean) TO authenticated;
