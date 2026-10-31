-- a_helper_asks_the_hosts_for_more
-- ============================================================================
-- 🪪 ASK THE HOSTS — a helper asks for more on ONE part, and every host is told
-- in the app (owner 2026-10-31, "yes" to building "Ask the hosts"; DECISION_LOG
-- "A HELPER SEES THEIR OWN ACCESS AS THE FIRST ROW OF HOME ⚙ EVENT SETTINGS —
-- read-only, with 'Ask the hosts'").
--
-- ── WHAT THIS IS ───────────────────────────────────────────────────────────
-- ONE definer, `ask_hosts_for_more_access(event, part, note)`. It GRANTS
-- NOTHING: access stays exactly what `event_moderators.permissions_json.areas`
-- says, and only the hosts change that, on People with access. All it does is
-- write one `access_more_asked` notice to each host, deep-linked to
-- Home ⚙ › People with access, landed on the asking helper's row.
--
-- ── WHO MAY ASK ────────────────────────────────────────────────────────────
-- The caller's OWN accepted, live seat on THIS event — a coordinator or a
-- LIMITED helper alike. This is a read-side request, not an edit gate: a
-- limited helper "may view but may not edit", and asking is not editing.
-- A stranger, a guest, a supplier with no seat, a removed or not-yet-accepted
-- seat: refused ('not_a_helper'), nothing written.
--
-- ── IT CANNOT BE SPAMMED ───────────────────────────────────────────────────
-- At most ONE ask per helper per part per day: a second ask for the same part
-- within 24 hours of the last is refused ('already_asked', with when), nothing
-- written. No new table — the notices themselves are the record: the link
-- names the seat and the part (`…&person=<moderator_id>&part=<area>`), so the
-- check is an EXISTS over `notifications`. The seat row is locked FOR UPDATE
-- first, so two presses at once cannot both pass the check.
--
-- ── IN-APP ONLY ────────────────────────────────────────────────────────────
-- Written straight into `notifications` — it never passes emitNotification,
-- so no email and no push can follow it (and `access_more_asked` is on
-- neither allowlist in lib/notification-emit.ts either).
--
-- Never applied by hand — the pipeline's `db push --include-all` applies it.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ask_hosts_for_more_access(
  p_event_id UUID,
  p_area     TEXT,
  p_note     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_seat  RECORD;
  v_name  TEXT;
  v_role  TEXT;
  v_part  TEXT;
  v_note  TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_url   TEXT;
  v_last  TIMESTAMPTZ;
  v_sent  INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_signed_in');
  END IF;

  -- The parts a host can raise for a helper (lib/delegate-areas.ts
  -- `areaChoices` — Event Hub has no setting, so there is nothing to ask for).
  -- The words are DELEGATE_AREA_LABEL's; a-helper-asks-the-hosts.test.ts holds
  -- the two lists equal.
  v_part := CASE p_area
    WHEN 'guest_list' THEN 'Guest list'
    WHEN 'seat_plan'  THEN 'Seat plan'
    WHEN 'schedule'   THEN 'The Day'
    WHEN 'vendors'    THEN 'Suppliers'
    WHEN 'mood_board' THEN 'Mood Board'
    WHEN 'budget'     THEN 'Budget & payments'
    WHEN 'photos'     THEN 'Photos'
    ELSE NULL
  END;
  IF v_part IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_part');
  END IF;

  -- The caller's OWN accepted, live seat on this event — any role, the limited
  -- helper included. Locked: two presses at once queue here.
  SELECT m.moderator_id, m.role_subtype, m.display_label
    INTO v_seat
    FROM public.event_moderators m
   WHERE m.event_id = p_event_id
     AND m.user_id = v_uid
     AND m.accepted_at IS NOT NULL
     AND m.removed_at IS NULL
   ORDER BY (m.role_subtype = 'wedding_planner_external') DESC, m.accepted_at
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_a_helper');
  END IF;

  v_url := '/dashboard/' || p_event_id::TEXT
        || '?settings=1&row=access&person=' || v_seat.moderator_id::TEXT
        || '&part=' || p_area;

  -- One ask per helper per part a day.
  SELECT max(n.created_at) INTO v_last
    FROM public.notifications n
   WHERE n.event_id = p_event_id
     AND n.type = 'access_more_asked'::public.notification_type
     AND n.related_url = v_url
     AND n.created_at > NOW() - INTERVAL '1 day';
  IF v_last IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_asked', 'asked_at', v_last);
  END IF;

  SELECT NULLIF(btrim(u.display_name), '') INTO v_name FROM public.users u WHERE u.user_id = v_uid;
  v_name := COALESCE(v_name, NULLIF(btrim(v_seat.display_label), ''), 'Someone');
  v_role := CASE WHEN v_seat.role_subtype = 'wedding_planner_external' THEN 'Coordinator' ELSE 'Helper' END;

  INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
  SELECT DISTINCT em.user_id,
         'access_more_asked'::public.notification_type,
         left(format('%s %s asks for more access · %s', v_role, v_name, v_part), 160),
         CASE WHEN v_note IS NULL
              THEN 'Open People with access to change what they can open.'
              ELSE format('“%s” — open People with access to change what they can open.', left(v_note, 140))
         END,
         v_url,
         p_event_id
    FROM public.event_members em
   WHERE em.event_id = p_event_id
     AND em.member_type = 'couple'
     AND em.user_id IS NOT NULL
     AND em.user_id <> v_uid;
  GET DIAGNOSTICS v_sent = ROW_COUNT;

  IF v_sent = 0 THEN
    RETURN jsonb_build_object('status', 'no_hosts');
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'asked_at', NOW(), 'hosts', v_sent);
END;
$$;

REVOKE ALL ON FUNCTION public.ask_hosts_for_more_access(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ask_hosts_for_more_access(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.ask_hosts_for_more_access(UUID, TEXT, TEXT) IS
  'Ask the hosts (owner 2026-10-31): the caller''s own accepted seat on the event (coordinator or limited helper) asks for more on one part; every host (event_members couple) gets one in-app access_more_asked notice linked to People with access on that seat. Grants nothing. One ask per seat per part per 24 hours (the notices are the record). Never emails.';
