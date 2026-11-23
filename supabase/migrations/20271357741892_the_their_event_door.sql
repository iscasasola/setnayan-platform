-- the_their_event_door
-- ============================================================================
-- 🚪 "THEIR EVENT" — EVERY OTHER BOOKED SUPPLIER (owner 2026-11-21, DECISION_LOG
-- "'THEIR EVENT' DOOR SHAPE + SCHEDULE RULE" · "WHAT EACH BOOKED SUPPLIER OPENS
-- BY DEFAULT" · "'YES TO ALL'" (1) booking groups, (5) photo & video / stylist;
-- controller call (3) the cap). PR 2 of 2 (PR 1: 20271357113669).
--
-- ── 1 · THE CAP, IN THE ONE RESOLVER ────────────────────────────────────────
-- A supplier's seat (`wedding_planner_external`, held by a booked supplier who
-- is not the coordinator and not a host — `supplier_proposes_only_for`) never
-- opens Payments or Memories (`photos`), whatever its map says; every other
-- area was already capped at View (20271329978605), so Budget is View at most.
-- Mirrored by `supplierAreaCap` (lib/their-event.ts) and `seatAreaLevel`
-- (lib/delegate-areas.ts).
--
-- ── 2 · A PER-HEAD BOOKING MAKES ITS OWN GUEST GROUP ────────────────────────
-- "A per-head booking (caterer packs, hair & makeup faces, booth guests)
-- creates its own group in the hosts' guest list, named for that supplier; the
-- hosts and the coordinator fill it; the supplier sees ONLY that group." Rule 0:
-- the shipped `guest_groups` (+ `guest_group_memberships`) and the shipped
-- per-head fact `event_vendor_counts_per_head`. ONE new column ties a group to
-- the booking (`guest_groups.event_vendor_id`, SET NULL when the booking goes);
-- a TRIGGER on `event_vendors` makes the group the moment a per-head row
-- becomes booked — every booking path, present and future, the same.
-- The booked count stays `event_vendors.pax_quote_base`; the group's live count
-- is only ever SHOWN beside it — it never changes the price.
--
-- ── 3 · THE ONE GROUP, READ BY THE SUPPLIER ─────────────────────────────────
-- `supplier_booking_group(event)`: a SECURITY DEFINER read for a booked
-- supplier — their booking's group: its label, the booked count and its
-- guests' names, reply and dietary note. NOTHING else of the guest list: no
-- other group, no contact details.
--
-- WHO READS IT (owner 2026-08-27: "the staff who handles the event will handle
-- the event fully but the vendor owner also has access to oversight all their
-- business"; controller ruling 22 Nov 2026, ship review of #8094) — ONLY:
--   (a) the shop's owner            — vendor_profiles.user_id;
--   (b) a LIVE Shop Manager         — the top team role, the repo's own helper
--       `current_vendor_duty_ids('shop_manager')` (20271351755368: duty =
--       'shop_manager' on a seat whose deactivated_at IS NULL);
--   (c) the LIVE seat that handles THIS client — #8114's routing
--       (20271356599293): the client is the chat_threads row for (event, shop);
--       its handler is handled_by_member_id, or covering_member_id while the
--       handler is paused (`currentHandlerOf`, lib/handled-by.server.ts).
-- Nobody else on the team. "Live" = vendor_team_members.deactivated_at IS NULL:
-- a paused seat never reads it. The rule is written ONCE, in the one SELECT.
-- A host (is_host), a stranger (not_booked), a member of the booked shop's team
-- who is none of (a)(b)(c) (not_your_client), a reader whose booking has no
-- group (no_group): each refused in its own words.
--
-- ── 4 · ONE SET OF NAMES ────────────────────────────────────────────────────
-- `ask_hosts_for_more_access` names its parts with DELEGATE_AREA_LABEL, now the
-- hosts' dashboard tab names: Guests · Seats · Schedule · Suppliers · Mood
-- Board · Budget · Payments · Memories (controller call (6), 21 Nov).
--
-- Never applied by hand — the pipeline's `db push --include-all` applies it.
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ── 1 · The cap ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.moderator_area_level(p_event_id UUID, p_area TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN s.role_subtype = 'wedding_planner_external'
            AND p_area IN ('payments', 'photos')
            AND public.supplier_proposes_only_for(p_event_id, s.user_id)
             THEN NULL
           WHEN s.lvl = 'edit'
            AND s.role_subtype = 'wedding_planner_external'
            AND public.supplier_proposes_only_for(p_event_id, s.user_id)
             THEN 'view'
           ELSE s.lvl
         END
    FROM (
      SELECT m.role_subtype,
             m.user_id,
             CASE
               WHEN m.permissions_json -> 'areas' ? p_area
                 THEN NULLIF(m.permissions_json -> 'areas' ->> p_area, '')
               WHEN m.permissions_json ? 'areas'
                 THEN NULL
               WHEN p_area = 'budget'
                 THEN CASE WHEN COALESCE((m.permissions_json ->> 'checkout')::boolean, FALSE)
                           THEN 'view' ELSE NULL END
               WHEN p_area = 'mood_board' THEN 'view'
               WHEN p_area IN ('guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations')
                 THEN CASE WHEN COALESCE((m.permissions_json ->> 'edit_all')::boolean, FALSE)
                           THEN 'edit' ELSE 'view' END
               ELSE NULL
             END AS lvl
        FROM public.event_moderators m
       WHERE m.event_id = p_event_id
         AND m.user_id = auth.uid()
         AND m.accepted_at IS NOT NULL
         AND m.removed_at IS NULL
       LIMIT 1
    ) s;
$$;

CREATE OR REPLACE FUNCTION public.moderator_area_level_of(p_event_id UUID, p_user_id UUID, p_area TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN s.role_subtype = 'wedding_planner_external'
            AND p_area IN ('payments', 'photos')
            AND public.supplier_proposes_only_for(p_event_id, s.user_id)
             THEN NULL
           WHEN s.lvl = 'edit'
            AND s.role_subtype = 'wedding_planner_external'
            AND public.supplier_proposes_only_for(p_event_id, s.user_id)
             THEN 'view'
           ELSE s.lvl
         END
    FROM (
      SELECT m.role_subtype,
             m.user_id,
             CASE
               WHEN m.permissions_json -> 'areas' ? p_area
                 THEN NULLIF(m.permissions_json -> 'areas' ->> p_area, '')
               WHEN m.permissions_json ? 'areas'
                 THEN NULL
               WHEN p_area = 'budget'
                 THEN CASE WHEN COALESCE((m.permissions_json ->> 'checkout')::boolean, FALSE)
                           THEN 'view' ELSE NULL END
               WHEN p_area = 'mood_board' THEN 'view'
               WHEN p_area IN ('guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations')
                 THEN CASE WHEN COALESCE((m.permissions_json ->> 'edit_all')::boolean, FALSE)
                           THEN 'edit' ELSE 'view' END
               ELSE NULL
             END AS lvl
        FROM public.event_moderators m
       WHERE m.event_id = p_event_id
         AND m.user_id = p_user_id
         AND m.accepted_at IS NOT NULL
         AND m.removed_at IS NULL
       LIMIT 1
    ) s;
$$;
REVOKE ALL ON FUNCTION public.moderator_area_level_of(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ── 2 · The booking's own guest group ───────────────────────────────────────
ALTER TABLE public.guest_groups
  ADD COLUMN IF NOT EXISTS event_vendor_id UUID REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.guest_groups.event_vendor_id IS
  'The per-head booking this group belongs to (owner 2026-11-21, "YES TO ALL" (1)): made by the booking, named for the '
  'supplier, filled by the hosts and the coordinator; the supplier reads ONLY this group (supplier_booking_group). '
  'NULL = a group the hosts made. Migration 20271357741892.';

CREATE UNIQUE INDEX IF NOT EXISTS guest_groups_one_per_booking
  ON public.guest_groups (event_vendor_id) WHERE event_vendor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.booking_makes_its_guest_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base  TEXT;
  v_label TEXT;
  v_try   INTEGER := 1;
BEGIN
  IF NEW.status IS NULL OR NEW.status::TEXT NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.guest_groups g WHERE g.event_vendor_id = NEW.vendor_id) THEN
    RETURN NEW;
  END IF;
  IF NOT public.event_vendor_counts_per_head(NEW.vendor_id) THEN
    RETURN NEW;
  END IF;
  v_base := left(COALESCE(NULLIF(btrim(NEW.vendor_name), ''), 'Supplier'), 48);
  v_label := v_base;
  -- The hosts may already have a group with that name: never take it over — "<name> · booking", "… 2", ….
  WHILE EXISTS (SELECT 1 FROM public.guest_groups g WHERE g.event_id = NEW.event_id AND lower(g.label) = lower(v_label)) LOOP
    v_label := CASE WHEN v_try = 1 THEN v_base || ' · booking' ELSE v_base || ' · booking ' || v_try END;
    v_try := v_try + 1;
    EXIT WHEN v_try > 20;
  END LOOP;
  INSERT INTO public.guest_groups (event_id, label, event_vendor_id)
  VALUES (NEW.event_id, left(v_label, 64), NEW.vendor_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_makes_its_guest_group() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS booking_makes_its_guest_group ON public.event_vendors;
CREATE TRIGGER booking_makes_its_guest_group
AFTER INSERT OR UPDATE OF status ON public.event_vendors
FOR EACH ROW EXECUTE FUNCTION public.booking_makes_its_guest_group();

-- ── 3 · The one group, read by the supplier ────────────────────────────────
CREATE OR REPLACE FUNCTION public.supplier_booking_group(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_signed_in');
  END IF;
  -- A host reads the whole list on their own pages; this door is a supplier's.
  IF EXISTS (SELECT 1 FROM public.event_members em
              WHERE em.event_id = p_event_id AND em.user_id = v_uid AND em.member_type = 'couple') THEN
    RETURN jsonb_build_object('status', 'is_host');
  END IF;

  -- The caller's shop's BOOKED row on this event — and the caller must be one of its READERS. The reader rule is
  -- written ONCE, here (owner 2026-08-27; controller ruling 22 Nov 2026):
  --   (a) the shop's owner;
  --   (b) a LIVE Shop Manager — `current_vendor_duty_ids('shop_manager')` (duty = 'shop_manager', deactivated_at NULL);
  --   (c) the LIVE seat that handles THIS client — the (event, shop) chat_threads row's cover while the handler is
  --       paused, else its handler (the app's `currentHandlerOf`).
  -- A row WITH a group sorts first, so a shop with two bookings here reads the one that has a group.
  SELECT ev.vendor_id, ev.pax_quote_base, g.group_id, g.label
    INTO v_row
    FROM public.event_vendors ev
    JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
    LEFT JOIN public.guest_groups g ON g.event_vendor_id = ev.vendor_id
   WHERE ev.event_id = p_event_id
     AND ev.status::TEXT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND (vp.user_id = v_uid
          OR vp.vendor_profile_id IN (SELECT public.current_vendor_duty_ids('shop_manager'))
          OR EXISTS (SELECT 1
                       FROM public.chat_threads t
                       JOIN public.vendor_team_members tm
                         ON tm.vendor_team_member_id = COALESCE(t.covering_member_id, t.handled_by_member_id)
                      WHERE t.event_id = ev.event_id
                        AND t.vendor_profile_id = vp.vendor_profile_id
                        AND t.kind = 'supplier'
                        AND tm.vendor_profile_id = vp.vendor_profile_id
                        AND tm.user_id = v_uid
                        AND tm.deactivated_at IS NULL))
   ORDER BY (g.group_id IS NULL), ev.created_at
   LIMIT 1;
  IF NOT FOUND THEN
    -- On the booked shop's team, but none of (a)(b)(c) — a paused seat, or a member who does not handle this client.
    -- Said as itself, never as "not booked" and never as an empty group.
    IF EXISTS (
      SELECT 1 FROM public.event_vendors ev
        JOIN public.vendor_team_members tm ON tm.vendor_profile_id = ev.marketplace_vendor_id
       WHERE ev.event_id = p_event_id
         AND ev.status::TEXT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND tm.user_id = v_uid
    ) THEN
      RETURN jsonb_build_object('status', 'not_your_client');
    END IF;
    RETURN jsonb_build_object('status', 'not_booked');
  END IF;
  IF v_row.group_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_group');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'label', v_row.label,
    'booked', v_row.pax_quote_base,
    'guests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'name', btrim(concat_ws(' ', gu.first_name, gu.last_name)),
               'rsvp', gu.rsvp_status,
               'diet', NULLIF(btrim(gu.dietary_restrictions), ''))
             ORDER BY gu.last_name NULLS LAST, gu.first_name)
        FROM public.guest_group_memberships gm
        JOIN public.guests gu ON gu.guest_id = gm.guest_id
       WHERE gm.group_id = v_row.group_id
         AND gu.event_id = p_event_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_booking_group(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_booking_group(UUID) TO authenticated;

COMMENT ON FUNCTION public.supplier_booking_group(UUID) IS
  'Their event · Guests (owner 2026-11-21, "YES TO ALL" (1)): a booked supplier reads ONLY their per-head booking''s '
  'own guest group — label, booked count (pax_quote_base), names, reply, dietary note. No other group, no contact '
  'details. READERS (owner 2026-08-27; controller 22 Nov 2026), and nobody else on the team: the shop''s owner; a '
  'live Shop Manager (current_vendor_duty_ids(''shop_manager'')); the live seat that handles this client '
  '(chat_threads.covering_member_id, else handled_by_member_id). Live = deactivated_at IS NULL — a paused seat never '
  'reads it. Hosts: is_host. Not booked: not_booked. On the booked shop''s team but not a reader: not_your_client. '
  'A reader whose booking has no group: no_group.';

-- ── 4 · Ask the hosts speaks the hosts' tab names (controller call (6)) ───────
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
    WHEN 'guest_list' THEN 'Guests'
    WHEN 'seat_plan'  THEN 'Seats'
    WHEN 'schedule'   THEN 'Schedule'
    WHEN 'vendors'    THEN 'Suppliers'
    WHEN 'mood_board' THEN 'Mood Board'
    WHEN 'budget'     THEN 'Budget'
    WHEN 'payments'   THEN 'Payments'
    WHEN 'photos'     THEN 'Memories'
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
