-- an invitation and a chat add reach the account
-- ============================================================================
-- W1/W3 walkthrough findings (findings-W1.md RW-197 · F-W3-27), 2026-11-14, on the live site:
--   "a guest invited to an event, or added to its chat, gets NO notice".
--
-- MEASURED ON PROD (SELECT only, 2026-11-14), before writing a line:
--   · `an_invitation_reaches_the_account` (20271252896804) is attached and enabled — and has written ONE
--     `event_invitation` notice, ever. It finds the account by the guest row's EMAIL only. In the last 30 days
--     0 guests carried an email matching an account; every guest who belongs to an account was linked through
--     `guests.person_id` → `people.claimed_by_user_id` with `email` NULL (added from People, by name, by phone).
--     Those guests got no bell row — and `incoming_requests_for_me` (the same email-only match) showed them no
--     request on the Events page either.
--   · Nothing writes a notice when a person is added to a chat: `chat_group_add` / `chat_group_create` /
--     `chat_thread_add_host` insert `chat_thread_members` and post a system line INSIDE the chat — which the
--     person cannot see, because nothing told them the chat exists.
--
-- WHAT THIS FILE DOES (the owner's 2026-09-28 rule is unchanged: "if they have an account. it must show on their
-- event page. as incoming requests" — "You are invited to {user name}'s {event name} {event type} event. (YES/NO)",
-- a request AND a row in the bell):
--   1 · `incoming_requests_for_me` matches the account by its email (as before) OR by the person record the account
--       claimed — and, for BOTH roads, only an account whose email is CONFIRMED (an account's own person is made
--       from its sign-up email, so the person road must not skip the proof the email road asks for). Every other filter
--       (pending, not already a member, not the creator, not muted, not blocked, not archived) is unchanged, and
--       `answer_incoming_request` reads through it, so YES/NO works for these guests with no second rule.
--   2 · `an_invitation_reaches_the_account` resolves the account the same two ways and also fires when
--       `person_id` is set or changed — still ONE notice per (account, event), still never failing a guest insert.
--   3 · A NEW trigger on `chat_thread_members`: a person added to a chat by SOMEONE ELSE (added_by ≠ them; not the
--       opener, not a self-rejoin, not the 2026-11-09 backfill whose added_by is NULL) gets one `chat_message`
--       notice: "{who} added you to {group}" / "… to the chat with {shop}". Says who and where — never a message.
--
-- ⚖ NOT the counsel-held auto-surface (FEATURE_ACCOUNT_AUTOSURFACE, RA 10173): nothing here attaches an event to an
-- account. The invitation is a REQUEST the person answers Yes or No; a chat add tells a person already in the event.
-- NEVER APPLIED BY HAND — the pipeline pushes it. KEEP IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── 1 · the requests: email OR the claimed person ──
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
  JOIN public.guests g
    ON lower(btrim(g.email)) = lower(me.email)
    OR g.person_id IN (SELECT p.person_id FROM public.people p WHERE p.claimed_by_user_id = me.id)
  JOIN public.events e ON e.event_id = g.event_id
  CROSS JOIN LATERAL (SELECT public.event_creator_user_id(g.event_id) AS uid) c
  LEFT JOIN public.users u ON u.user_id = c.uid
  WHERE me.id = auth.uid()
    -- 🔒 A CONFIRMED EMAIL, FOR BOTH ROADS. An account's own person is made from its email at sign-up, and a guest
    -- added by email is linked to that person — so without this, signing up with somebody else's (unconfirmed)
    -- address would hand you their invitation through the person road. (Caught by the replay test, 2026-11-14.)
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

-- ── 2 · the bell row: email OR the claimed person ──
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
  IF NEW.deleted_at IS NOT NULL OR NEW.rsvp_status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF NEW.email IS NULL AND NEW.person_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND lower(btrim(coalesce(OLD.email, ''))) = lower(btrim(coalesce(NEW.email, '')))
     AND OLD.person_id IS NOT DISTINCT FROM NEW.person_id THEN
    RETURN NEW;  -- neither the email nor the person changed: nothing new to tell anybody
  END IF;

  -- 🔑 A GUEST INSERT MUST NEVER FAIL BECAUSE OF THIS (a couple importing 200 names). Any error is swallowed; the
  -- request still shows on the Events page, which is computed, not written.
  BEGIN
    IF NEW.email IS NOT NULL THEN
      SELECT u.user_id INTO v_uid FROM public.users u
      WHERE lower(u.email) = lower(btrim(NEW.email)) LIMIT 1;
    END IF;
    IF v_uid IS NULL AND NEW.person_id IS NOT NULL THEN
      -- The person road only for an account whose email is confirmed — the same proof the request asks for.
      SELECT p.claimed_by_user_id INTO v_uid
        FROM public.people p JOIN auth.users au ON au.id = p.claimed_by_user_id
       WHERE p.person_id = NEW.person_id AND au.email_confirmed_at IS NOT NULL;
    END IF;
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
AFTER INSERT OR UPDATE OF email, person_id ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.an_invitation_reaches_the_account();

-- ── 3 · a chat add reaches the person added ──
CREATE OR REPLACE FUNCTION public.a_chat_add_reaches_the_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event uuid;
  v_kind text;
  v_group text;
  v_shop_id uuid;
  v_shop text;
  v_from text;
  v_title text;
  v_url text;
BEGIN
  -- Only an add BY SOMEONE ELSE: not the opener / backfill (added_by NULL), not a host rejoining by themselves.
  IF NEW.left_at IS NOT NULL OR NEW.added_by_user_id IS NULL OR NEW.added_by_user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  -- A host rejoining by themselves clears left_at but keeps the ORIGINAL adder in added_by — the actor is the person.
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id THEN
    RETURN NEW;
  END IF;
  -- An UPDATE tells only a return (left_at was set, now cleared) — never a row that was already in.
  IF TG_OP = 'UPDATE' AND OLD.left_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- 🔑 AN ADD MUST NEVER FAIL BECAUSE OF THIS: the notice is best-effort, the membership is the product.
  BEGIN
    SELECT t.event_id, t.kind, t.group_name, t.vendor_profile_id
      INTO v_event, v_kind, v_group, v_shop_id
    FROM public.chat_threads t WHERE t.thread_id = NEW.thread_id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    SELECT NULLIF(btrim(COALESCE(u.display_name, u.first_name, '')), '') INTO v_from
      FROM public.users u WHERE u.user_id = NEW.added_by_user_id;

    IF v_kind = 'group' THEN
      v_title := format('%s added you to %s', COALESCE(v_from, 'Someone'),
                        COALESCE(NULLIF(btrim(v_group), ''), 'a group chat'));
      v_url := '/samahan/chat/' || NEW.thread_id::text;
    ELSE
      SELECT vp.business_name INTO v_shop FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_shop_id;
      v_title := format('%s added you to the chat with %s', COALESCE(v_from, 'Someone'),
                        COALESCE(NULLIF(btrim(v_shop), ''), 'a supplier'));
      v_url := '/dashboard/' || v_event::text || '/messages/' || NEW.thread_id::text;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
    VALUES (NEW.user_id, 'chat_message'::public.notification_type, left(v_title, 160),
            'Open the chat to read it and reply.', v_url, v_event);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'a_chat_add_reaches_the_account(%, %): %', NEW.thread_id, NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.a_chat_add_reaches_the_account() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_chat_add_reaches_the_account ON public.chat_thread_members;
CREATE TRIGGER a_chat_add_reaches_the_account
AFTER INSERT OR UPDATE OF left_at ON public.chat_thread_members
FOR EACH ROW EXECUTE FUNCTION public.a_chat_add_reaches_the_account();

COMMIT;
