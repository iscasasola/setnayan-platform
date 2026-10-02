-- one_qr_lets_a_signed_in_guest_in
-- Created via `pnpm migration:new`. Idempotent (CREATE OR REPLACE + REVOKE/GRANT).
-- NO DATA IS CHANGED.
--
-- 🎟 ONE QR FOR EVERYONE — A SIGNED-IN PERSON IS ADDED, NO APPROVAL (owner,
-- DECISION_LOG 2026-09-30 "THE RSVP IS OPTIONAL — AND AN EVENT CAN RUN ON ONE QR
-- FOR EVERYONE", verbatim: *"we can also have that 1 QR for any who attends the
-- event and syncs it directly to their account. no RSVP needed."* ⇒ "anyone who
-- attends scans it, signs in … and the event is added to their account as a
-- guest; no reply, no approval unless the host picks 'I approve each one'").
--
-- Before this, signing in through the event's one QR made a REQUEST (a
-- `self_added_unlisted` row waiting for Keep/Link) for every choice, because
-- onboarding writes `whoCanRsvp: 'anyone'` for both "Anyone, I approve" and
-- "One QR for everyone" and the join door read only that key.
--
-- THE GATE — all three, read from `events.rsvp_ask_config` (the ONE stored
-- setting onboarding, Your info and the join door share; lib/rsvp-ask.ts
-- `oneQrLetsYouIn` is the TS twin of this predicate):
--   · guestsReply = false          "Will guests reply? No"
--   · whoCanRsvp  = 'anyone'       the one QR is open (not "Personal QR only")
--   · approveEach IS NOT true      the host did not pick "I approve each one"
-- Anything else answers 'needs_approval' and the caller makes the usual request.
--
-- WHAT IT WRITES — and only this, in one transaction:
--   · ONE guest row for THIS event (`role 'guest'`, `entry_source
--     'host_seeded'` — what Keep promotes a request to, so it counts like a
--     kept guest), named from the person's own account;
--   · ONE `event_members` row: `member_type 'guest'`, `role 'guest'`,
--     `joined_via 'qr_scan'`, bound to that row. NEVER couple/host — the role is
--     a literal here, nothing a caller passes can change it.
--
-- WHAT IT REFUSES:
--   · 'locked'  — the host pressed Finalize (`guest_count_locked_at`). The
--                 `guard_guest_edits_when_locked` trigger EXEMPTS service_role,
--                 and this function is service_role-only, so the lock is
--                 checked HERE, explicitly — the trigger would not.
--   · 'full'    — the one-QR ceiling (ONE_QR_CEILING below, the same 1000 the
--                 request door's SELF_JOIN_CEILING uses) is reached.
--   · 'closed'  — the event is archived, or missing.
--   · already a member (any member_type) → 'member', nothing written.
--
-- 🔒 WHO MAY CALL IT: service_role ONLY. Migration 20271014300000 closed a
-- client-side self-join because the client could pick ANY event. This function
-- is the join door's server action (`joinEventAction`, after its own
-- private-event and sign-in checks) and nothing else; `authenticated` and
-- `anon` hold no EXECUTE, so it is not reachable through PostgREST.
-- Regression: apps/web/tests/db/one-qr-lets-a-signed-in-guest-in.db.test.ts.

CREATE OR REPLACE FUNCTION public.join_open_event_as_guest(p_event_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ONE_QR_CEILING CONSTANT INTEGER := 1000;
  v_cfg      JSONB;
  v_locked   TIMESTAMPTZ;
  v_archived BOOLEAN;
  v_member   RECORD;
  v_joined   INTEGER;
  v_first    TEXT;
  v_last     TEXT;
  v_display  TEXT;
  v_email    TEXT;
  v_guest_id UUID;
BEGIN
  IF p_event_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'closed');
  END IF;

  -- The event row, locked so two scans cannot both pass the ceiling check.
  SELECT e.rsvp_ask_config, e.guest_count_locked_at, COALESCE(e.archived, FALSE)
    INTO v_cfg, v_locked, v_archived
    FROM public.events e
   WHERE e.event_id = p_event_id
   FOR UPDATE;
  IF NOT FOUND OR v_archived THEN
    RETURN jsonb_build_object('outcome', 'closed');
  END IF;

  -- Already inside (a guest by another door, or a host) → nothing to add.
  SELECT m.member_type, m.guest_id INTO v_member
    FROM public.event_members m
   WHERE m.event_id = p_event_id AND m.user_id = p_user_id
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('outcome', 'member', 'guest_id', v_member.guest_id, 'member_type', v_member.member_type);
  END IF;

  -- THE GATE (see header). jsonb comparison, so a string "false" is not false.
  IF NOT (
        COALESCE(v_cfg -> 'guestsReply', 'true'::jsonb) = 'false'::jsonb
    AND COALESCE(v_cfg ->> 'whoCanRsvp', 'guest_list') = 'anyone'
    AND COALESCE(v_cfg -> 'approveEach', 'false'::jsonb) <> 'true'::jsonb
  ) THEN
    RETURN jsonb_build_object('outcome', 'needs_approval');
  END IF;

  IF v_locked IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'locked');
  END IF;

  SELECT count(*) INTO v_joined
    FROM public.event_members m
   WHERE m.event_id = p_event_id AND m.member_type = 'guest' AND m.joined_via = 'qr_scan';
  IF v_joined >= ONE_QR_CEILING THEN
    RETURN jsonb_build_object('outcome', 'full');
  END IF;

  -- The name, from the person's own account: first/last, else the display
  -- name, else the address's local part. `last_name` is NOT NULL, so a single
  -- word keeps the '—' placeholder the request door uses.
  SELECT NULLIF(btrim(u.first_name), ''), NULLIF(btrim(u.last_name), ''),
         NULLIF(btrim(u.display_name), ''), NULLIF(btrim(u.email), '')
    INTO v_first, v_last, v_display, v_email
    FROM public.users u
   WHERE u.user_id = p_user_id;
  IF v_first IS NULL AND v_display IS NOT NULL THEN
    v_first := split_part(v_display, ' ', 1);
    v_last := COALESCE(v_last, NULLIF(btrim(substr(v_display, length(v_first) + 1)), ''));
  END IF;
  IF v_first IS NULL AND v_email IS NOT NULL THEN
    v_first := NULLIF(split_part(v_email, '@', 1), '');
  END IF;
  v_first := left(COALESCE(v_first, 'Guest'), 80);
  v_last := left(COALESCE(v_last, '—'), 80);

  INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, entry_source)
  VALUES (p_event_id, v_first, v_last, 'both', 'other', 'guest', 'host_seeded')
  RETURNING guest_id INTO v_guest_id;

  BEGIN
    INSERT INTO public.event_members (event_id, user_id, member_type, role, joined_via, guest_id)
    VALUES (p_event_id, p_user_id, 'guest', 'guest', 'qr_scan', v_guest_id);
  EXCEPTION WHEN unique_violation THEN
    -- A second scan by the same person won the race: undo this row, report theirs.
    DELETE FROM public.guests WHERE guest_id = v_guest_id;
    SELECT m.member_type, m.guest_id INTO v_member
      FROM public.event_members m
     WHERE m.event_id = p_event_id AND m.user_id = p_user_id
     LIMIT 1;
    RETURN jsonb_build_object('outcome', 'member', 'guest_id', v_member.guest_id, 'member_type', v_member.member_type);
  END;

  RETURN jsonb_build_object('outcome', 'joined', 'guest_id', v_guest_id);
END;
$$;

REVOKE ALL ON FUNCTION public.join_open_event_as_guest(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_open_event_as_guest(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.join_open_event_as_guest(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.join_open_event_as_guest(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.join_open_event_as_guest(UUID, UUID) IS
  'One QR for everyone: adds a signed-in person to THIS event as a guest (never a host) when '
  'rsvp_ask_config says guestsReply=false, whoCanRsvp=anyone and approveEach is not true. Refuses '
  'a finalized list (locked), the 1000 ceiling (full) and an archived event (closed). '
  'service_role only — called by app/join/[eventId]/actions.ts joinEventAction.';
