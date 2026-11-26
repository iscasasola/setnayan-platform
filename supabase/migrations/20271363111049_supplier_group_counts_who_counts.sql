-- supplier_group_counts_who_counts · A6-57 (final check 25 Nov, area 6)
--
-- The supplier's booking group (`supplier_booking_group`, migration 20271357741892) counted every member row: a guest
-- the hosts deleted, a pending request, a guest who passed away and a represented role holder were all "in your group",
-- and a decline still counted. Now the group follows the ONE guest rule (`countsTowardEvent`, lib/guests.ts): those
-- guests are not listed, and a new `counted` field is the group's number without the declined (they stay listed with
-- their reply). Only the RETURN changed; the reader rule, statuses and grants are the shipped ones. CREATE OR REPLACE
-- keeps the grants. Idempotent. Held by tests/db/the-supplier-group-counts-who-counts.db.test.ts.

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

  -- WHO IS IN THE GROUP, BY THE ONE GUEST RULE (A6-57, final check 25 Nov): `countsTowardEvent` (lib/guests.ts) —
  -- a guest the hosts deleted, a request not yet accepted ('self_added_unlisted'), a guest who passed away, and a
  -- role holder represented by a proxy are not in the supplier's group. `counted` is the group's number the supplier
  -- reads: the guests left, without those who said they can't come. A declined guest stays listed with their reply.
  RETURN jsonb_build_object(
    'status', 'ok',
    'label', v_row.label,
    'booked', v_row.pax_quote_base,
    'counted', (
      SELECT count(*)::int
        FROM public.guest_group_memberships gm
        JOIN public.guests gu ON gu.guest_id = gm.guest_id
       WHERE gm.group_id = v_row.group_id
         AND gu.event_id = p_event_id
         AND gu.deleted_at IS NULL
         AND gu.entry_source <> 'self_added_unlisted' AND NOT gu.passed_away
         AND gu.represented_by_guest_id IS NULL
         AND gu.rsvp_status IS DISTINCT FROM 'declined'),
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
         AND gu.deleted_at IS NULL
         AND gu.entry_source <> 'self_added_unlisted' AND NOT gu.passed_away
         AND gu.represented_by_guest_id IS NULL
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
  'A reader whose booking has no group: no_group. Since A6-57 (25 Nov) the group lists only guests who count by the one '
  'guest rule (countsTowardEvent: not deleted, not a pending request, not passed away, not represented), and `counted` '
  'is that number without the declined.';
