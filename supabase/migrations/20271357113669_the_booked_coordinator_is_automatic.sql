-- the_booked_coordinator_is_automatic
-- ============================================================================
-- 🧭 THE BOOKED COORDINATOR — THE HOSTS' DASHBOARD MINUS MEMORIES AND PAYING
-- (owner 2026-11-21, DECISION_LOG rows "A BOOKED COORDINATOR OPENS EVERYTHING
-- EXCEPT MEDIA FILES AND PAYMENTS" · "BOOKED COORDINATOR — WHAT THEY MAY EDIT VS
-- ONLY VIEW" · "BOOKED COORDINATOR ON BUILD: FIND + RECOMMEND + SHORTLIST, NO
-- BOOKING, NO PAYING" · "COORDINATOR: DUE PAYMENTS VIEWABLE + 'REMIND THE
-- HOSTS', NOT LOGGABLE; ACCESS IS AUTOMATIC").
--
-- ── 1 · LIMITED · FULL RETIRES ──────────────────────────────────────────────
-- Since 2026-10-29 Home asked the hosts "Limited or Full access?" and wrote the
-- answer into the seat (`permissions_json.access_level`, with the seat-as-it-was
-- in `prior`). FULL turned the seat into a CO-HOST seat — a `couple` member, who
-- therefore opened Memories, logged payments and booked suppliers: exactly the
-- three things the owner has now ruled out. The choice retires; booked = the
-- ruled access, and the hosts keep ONE switch (On = the grant below, Off = the
-- lowest level of every part).
--   · an answered FULL seat → back to the coordinator's seat with the ruled
--     grant (`COORDINATOR_AREAS`, lib/delegate-areas.ts). Narrower than what it
--     had, never wider. `sync_delegate_membership` moves the membership from
--     `couple` (joined_via 'invited') back to `coordinator` on this UPDATE.
--   · an answered LIMITED seat → the switch OFF (`COORDINATOR_OFF_AREAS`). The
--     hosts chose "change nothing"; Off is the only answer left that never hands
--     over more than they chose.
-- The `access_level` and `prior` keys go with it.
--
-- ── 2 · THE GRANT ITSELF, ON EVERY BOOKED COORDINATOR'S SEAT THAT HELD THE OLD
--       DEFAULT ─────────────────────────────────────────────────────────────
-- The old default (`mood_board: view`, `budget: off`, no `payments`) becomes the
-- ruled one (`mood_board: edit`, `budget: view`, `payments: view`) — ONLY on a
-- seat whose map is exactly that old default (the switch was ON and nobody
-- changed a part) AND whose holder's shop is booked on the event as a
-- coordinator. A seat the hosts switched Off or narrowed part by part is theirs
-- and is not touched.
--
-- ── 3 · "REMIND THE HOSTS" ──────────────────────────────────────────────────
-- `remind_the_hosts_of_a_payment(event, supplier_row)`: a delegate whose seat
-- gives `payments` at View (the booked coordinator) sends every host one in-app
-- notice that a payment to that supplier is due. It LOGS NOTHING and PAYS
-- NOTHING. One reminder per seat per supplier a day; the notices are the
-- record. Called from the browser like `ask_hosts_for_more_access` — no server
-- action (the route budget is at its ceiling).
--
-- ── 4 · ASK THE HOSTS SPEAKS THE SPLIT ──────────────────────────────────────
-- `ask_hosts_for_more_access` names its parts with DELEGATE_AREA_LABEL's words;
-- "Budget & payments" is now "Budget" and "Payments".
--
-- Never applied by hand — the pipeline's `db push --include-all` applies it.
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ── 1 · Limited · Full retires ─────────────────────────────────────────────
UPDATE public.event_moderators m
   SET role_subtype = 'wedding_planner_external',
       permissions_json = jsonb_build_object(
         'edit_all', true, 'checkout', false, 'invite_hosts', true, 'remove_hosts', false,
         'areas', jsonb_build_object(
           'guest_list', 'edit', 'seat_plan', 'edit', 'schedule', 'edit', 'vendors', 'edit',
           'invitations', 'edit', 'mood_board', 'edit', 'budget', 'view', 'payments', 'view',
           'photos', NULL)),
       updated_at = NOW()
 WHERE m.removed_at IS NULL
   AND m.permissions_json ->> 'access_level' = 'full';

UPDATE public.event_moderators m
   SET role_subtype = 'wedding_planner_external',
       permissions_json = jsonb_build_object(
         'edit_all', true, 'checkout', false, 'invite_hosts', true, 'remove_hosts', false,
         'areas', jsonb_build_object(
           'guest_list', NULL, 'seat_plan', NULL, 'schedule', NULL, 'vendors', NULL,
           'invitations', 'view', 'mood_board', 'view', 'budget', NULL, 'payments', NULL,
           'photos', NULL)),
       updated_at = NOW()
 WHERE m.removed_at IS NULL
   AND m.permissions_json ->> 'access_level' = 'limited';

-- ── 2 · The ruled grant on a booked coordinator's untouched default seat ────
UPDATE public.event_moderators m
   SET permissions_json = jsonb_set(
         jsonb_set(m.permissions_json, '{checkout}', 'false'::jsonb),
         '{areas}',
         (m.permissions_json -> 'areas')
           || jsonb_build_object('mood_board', 'edit', 'budget', 'view', 'payments', 'view')),
       updated_at = NOW()
 WHERE m.removed_at IS NULL
   AND m.accepted_at IS NOT NULL
   AND m.user_id IS NOT NULL
   AND m.role_subtype = 'wedding_planner_external'
   AND m.permissions_json -> 'areas' = jsonb_build_object(
         'guest_list', 'edit', 'seat_plan', 'edit', 'schedule', 'edit', 'vendors', 'edit',
         'invitations', 'edit', 'mood_board', 'view', 'budget', NULL, 'photos', NULL)
   AND EXISTS (
     SELECT 1
       FROM public.vendor_profiles vp
       JOIN public.event_vendors ev ON ev.marketplace_vendor_id = vp.vendor_profile_id
      WHERE ev.event_id = m.event_id
        AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
        AND public.services_make_a_coordinator(vp.services)
        AND (vp.user_id = m.user_id
             OR EXISTS (SELECT 1 FROM public.vendor_team_members tm
                         WHERE tm.vendor_profile_id = vp.vendor_profile_id AND tm.user_id = m.user_id))
   );

-- ── 3 · Remind the hosts ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remind_the_hosts_of_a_payment(
  p_event_id  UUID,
  p_vendor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_seat   RECORD;
  v_name   TEXT;
  v_shop   TEXT;
  v_url    TEXT;
  v_last   TIMESTAMPTZ;
  v_sent   INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_signed_in');
  END IF;

  -- A host does not remind the hosts — they pay.
  IF EXISTS (SELECT 1 FROM public.event_members em
              WHERE em.event_id = p_event_id AND em.user_id = v_uid AND em.member_type = 'couple') THEN
    RETURN jsonb_build_object('status', 'is_host');
  END IF;

  -- The caller's own live seat, and it must give Payments (View). Locked: two presses at once queue here.
  SELECT m.moderator_id, m.display_label
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
  IF public.moderator_area_level(p_event_id, 'payments') IS NULL THEN
    RETURN jsonb_build_object('status', 'no_payments_access');
  END IF;

  -- The supplier row is THIS event's.
  SELECT NULLIF(btrim(ev.vendor_name), '') INTO v_shop
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_vendor_id AND ev.event_id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_this_event');
  END IF;
  v_shop := COALESCE(v_shop, 'A supplier');

  v_url := '/dashboard/' || p_event_id::TEXT || '/budget?remind=' || p_vendor_id::TEXT
        || '&from=' || v_seat.moderator_id::TEXT;

  -- One reminder per seat per supplier a day.
  SELECT max(n.created_at) INTO v_last
    FROM public.notifications n
   WHERE n.event_id = p_event_id
     AND n.type = 'coordinator_reminded_payment'::public.notification_type
     AND n.related_url = v_url
     AND n.created_at > NOW() - INTERVAL '1 day';
  IF v_last IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_reminded', 'reminded_at', v_last);
  END IF;

  SELECT NULLIF(btrim(u.display_name), '') INTO v_name FROM public.users u WHERE u.user_id = v_uid;
  v_name := COALESCE(v_name, NULLIF(btrim(v_seat.display_label), ''), 'Your coordinator');

  INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
  SELECT DISTINCT em.user_id,
         'coordinator_reminded_payment'::public.notification_type,
         left(format('%s reminds you · %s has a payment due', v_name, v_shop), 160),
         'Open Budget to see what is due and pay it.',
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
  RETURN jsonb_build_object('status', 'ok', 'reminded_at', NOW(), 'hosts', v_sent);
END;
$$;

REVOKE ALL ON FUNCTION public.remind_the_hosts_of_a_payment(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remind_the_hosts_of_a_payment(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.remind_the_hosts_of_a_payment(UUID, UUID) IS
  'Remind the hosts (owner 2026-11-21): a delegate whose seat gives payments at View (the booked coordinator) tells every host, in the app, that a payment to one of THIS event''s suppliers is due. Logs nothing, pays nothing. A host is refused (is_host). One per seat per supplier per 24 hours (the notices are the record). Never emails.';

-- ── 4 · Ask the hosts speaks the split ──────────────────────────────────────
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
    WHEN 'budget'     THEN 'Budget'
    WHEN 'payments'   THEN 'Payments'
    WHEN 'photos'     THEN 'Photos'
    ELSE NULL
  END;
  IF v_part IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_part');
  END IF;

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

COMMIT;
