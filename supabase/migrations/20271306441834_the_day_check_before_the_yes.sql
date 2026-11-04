-- ============================================================================
-- the_day_check_before_the_yes — 2026-11-04 DAY CHECK BEFORE ACCEPT
--
-- Owner, 4 Nov 2026: "show if there are conflicts with their schedule? which
-- should be mostly unlikely since we will not allow them to accept if there is
-- a conflict in their schedule. or maybe also show who are shortlisted on that
-- schedule? so they know if they want to accept?" → prototype approved
-- ("Yes, build it").
--
-- Until now a supplier learned a day was full only AFTER pressing Agree:
-- `vendor_agree_to_lock` refused (`slot_full` · `daily_limit_reached` ·
-- `resolve_others_first`) and lib/lock-answer-notice.ts said why. This
-- migration lets the supplier SEE the day before the tap.
--
-- 1. `vendor_day_check(p_event_vendor_id)` — SECURITY DEFINER, STABLE, read
--    only, granted to `authenticated`. ONE call answers the whole day for one
--    booking ask:
--      verdict      the status `vendor_agree_to_lock` would answer with from its
--                   capacity gates — 'resolve_others_first' · 'slot_full' ·
--                   'daily_limit_reached' · 'open' — computed with the RPC's OWN
--                   predicates, in the RPC's own order. The daily count is the
--                   SAME function the RPC calls (`service_card_bookings_on`),
--                   never a second count; the slot count is the RPC's
--                   occupancy predicate, kept beside it here.
--      services     each card this couple has on the event from this shop: its
--                   limit (whole day N a day, or N per slot × slots), how many
--                   are booked, full or not.
--      booked       who is booked that day — on Setnayan (couple's event name,
--                   type, card) and outside (the shop's own `external_client`
--                   blocks; the client name the shop typed, nothing else).
--      asking       other couples whose booking ask to this shop is open for
--                   that day (the same rows `resolve_others_first` counts),
--                   with the chat to open.
--      shortlisted  couples who have this shop on an event that day
--                   (`considering` / `shortlisted`, not archived) and have NOT
--                   asked. A shortlist row is already a live relationship that
--                   opens the supplier's customer card for that event
--                   (get_vendor_event_brief, 20271235469220) — no new exposure.
--    The OWNERSHIP GATE is `vendor_agree_to_lock`'s, byte for byte: whoever can
--    press Agree on the row can see its day, and nobody else.
--    🔒 tests/db/the-day-check-agrees-with-the-yes.db.test.ts proves, as a real
--    `authenticated` session, that the verdict equals what the RPC then answers
--    for the same row — open, a full card, a full slot, others asking — and
--    that a stranger is refused.
--
-- 2. `vendor_waitlist_the_ask(p_event_vendor_id)` — SECURITY DEFINER, granted
--    to `authenticated`. "Waiting list" on a FULL day: puts the asking couple on
--    the shop's EXISTING waiting list (`vendor_date_waitlist`, Wave 4 — the
--    same row the couple's own "Join the waitlist" writes, so the shipped
--    "a slot opened → tell them first" path picks them up). Couples alone may
--    insert there (RLS `user_id = auth.uid()`), hence DEFINER. Same ownership
--    gate; refused unless the ask is still open and the day is full by the
--    verdict above (`not_full`) — a waiting list for an open day is nonsense.
--    Idempotent ('already'). The polite chat message is the app's
--    (sendChatMessageCore, the shipped send path); no email is added.
--
-- `vendor_agree_to_lock` is NOT changed. The refusal stays the server's.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_day_check(p_event_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state      TEXT;
  v_event_id   UUID;
  v_status     TEXT;
  v_mvid       UUID;
  v_slot       UUID;
  v_service    UUID;
  v_date       DATE;
  v_prec       TEXT;
  v_competing  INT := 0;
  v_slot_cap   INT;
  v_slot_used  INT;
  v_daily_cap  INT;
  v_slot_full  BOOLEAN := FALSE;
  v_daily_full BOOLEAN := FALSE;
  v_verdict    TEXT;
  v_services   JSONB;
  v_booked     JSONB;
  v_outside    JSONB;
  v_asking     JSONB;
  v_saved      JSONB;
BEGIN
  -- ── OWNERSHIP — vendor_agree_to_lock's gate, unchanged ────────────────────
  IF NOT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id
       AND (
         ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
         OR EXISTS (
           SELECT 1
             FROM public.vendor_services vs
            WHERE vs.vendor_service_id = ev.service_id
              AND vs.vendor_profile_id = ev.marketplace_vendor_id
              AND vs.vendor_service_id IN (SELECT public.agent_assigned_service_ids())
         )
       )
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT lock_request_state, event_id, status::TEXT, marketplace_vendor_id,
         service_time_slot_id, service_id
    INTO v_state, v_event_id, v_status, v_mvid, v_slot, v_service
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT e.event_date, e.event_date_precision
    INTO v_date, v_prec
    FROM public.events e
   WHERE e.event_id = v_event_id;

  -- No day to check: every capacity gate of the RPC is skipped for these too.
  IF v_mvid IS NULL OR v_date IS NULL OR v_prec IS DISTINCT FROM 'day' THEN
    RETURN jsonb_build_object('status', 'no_date', 'event_id', v_event_id, 'ask', v_state);
  END IF;

  -- ── 1 · OTHERS ASKING (the RPC's resolve_others_first count) ──────────────
  SELECT count(*) INTO v_competing
    FROM public.event_vendors ev
    JOIN public.events e2 ON e2.event_id = ev.event_id
   WHERE ev.marketplace_vendor_id = v_mvid
     AND ev.lock_request_state = 'pending'
     AND ev.archived_at IS NULL
     AND ev.vendor_id <> p_event_vendor_id
     AND e2.event_date = v_date
     AND e2.event_date_precision = 'day';

  -- ── 2 · THE ASK'S TIME SLOT (the RPC's slot occupancy predicate) ──────────
  IF v_slot IS NOT NULL THEN
    SELECT slot_capacity INTO v_slot_cap
      FROM public.vendor_service_time_slots
     WHERE slot_id = v_slot
       AND is_active;
    IF v_slot_cap IS NOT NULL THEN
      SELECT count(*) INTO v_slot_used
        FROM public.event_vendors ev
        JOIN public.events e3 ON e3.event_id = ev.event_id
       WHERE ev.service_time_slot_id = v_slot
         AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND ev.archived_at IS NULL
         AND e3.event_date = v_date
         AND e3.event_date_precision = 'day'
         AND ev.vendor_id <> p_event_vendor_id;
      v_slot_full := v_slot_used >= v_slot_cap;
    END IF;
  END IF;

  -- ── 3 · THE CARD'S "BOOKINGS PER DAY" (the RPC's daily gate, same count) ──
  IF v_status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND v_service IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.vendor_service_time_slots t
        WHERE t.vendor_service_id = v_service
          AND t.is_active
     ) THEN
    SELECT vs.daily_capacity INTO v_daily_cap
      FROM public.vendor_services vs
     WHERE vs.vendor_service_id = v_service;
    v_daily_full := v_daily_cap IS NOT NULL AND v_daily_cap > 0
      AND public.service_card_bookings_on(v_service, v_date, p_event_vendor_id) >= v_daily_cap;
  END IF;

  -- The RPC's order: others first, then the slot, then the card's day.
  v_verdict := CASE
                 WHEN COALESCE(v_competing, 0) > 0 THEN 'resolve_others_first'
                 WHEN v_slot_full THEN 'slot_full'
                 WHEN v_daily_full THEN 'daily_limit_reached'
                 ELSE 'open'
               END;

  -- ── THE CARDS THIS COUPLE HAS FROM THIS SHOP, EACH WITH ITS DAY ────────────
  SELECT COALESCE(jsonb_agg(c ORDER BY c->>'name'), '[]'::jsonb) INTO v_services
    FROM (
      SELECT jsonb_build_object(
               'service_id', vs.vendor_service_id,
               'name', COALESCE(NULLIF(trim(vs.title), ''), vs.category),
               'category', vs.category,
               'mode', CASE WHEN sl.n > 0 THEN 'slot' ELSE 'day' END,
               'daily_limit', CASE WHEN sl.n > 0 THEN NULL ELSE NULLIF(vs.daily_capacity, 0) END,
               'slots', sl.n,
               'per_slot', sl.per_slot,
               'slot_limit', sl.cap,
               'booked', CASE
                           WHEN sl.n > 0 THEN (
                             SELECT count(*)::int
                               FROM public.event_vendors b
                               JOIN public.events eb ON eb.event_id = b.event_id
                              WHERE b.service_time_slot_id IN (
                                      SELECT t.slot_id FROM public.vendor_service_time_slots t
                                       WHERE t.vendor_service_id = vs.vendor_service_id AND t.is_active)
                                AND b.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
                                AND b.archived_at IS NULL
                                AND eb.event_date = v_date
                                AND eb.event_date_precision = 'day'
                                AND b.event_id <> v_event_id)
                           ELSE public.service_card_bookings_on(vs.vendor_service_id, v_date, p_event_vendor_id)
                         END,
               'is_this_ask', vs.vendor_service_id = v_service
             ) AS c
        FROM public.vendor_services vs
        CROSS JOIN LATERAL (
          SELECT count(*)::int AS n,
                 COALESCE(sum(t.slot_capacity), 0)::int AS cap,
                 max(t.slot_capacity)::int AS per_slot
            FROM public.vendor_service_time_slots t
           WHERE t.vendor_service_id = vs.vendor_service_id
             AND t.is_active
        ) sl
       WHERE vs.vendor_profile_id = v_mvid
         AND vs.vendor_service_id IN (
               SELECT ev.service_id FROM public.event_vendors ev
                WHERE ev.event_id = v_event_id
                  AND ev.marketplace_vendor_id = v_mvid
                  AND ev.service_id IS NOT NULL
                  AND ev.archived_at IS NULL)
    ) s;

  -- ── WHO IS BOOKED THAT DAY ON SETNAYAN (one row per couple) ────────────────
  SELECT COALESCE(jsonb_agg(b ORDER BY b->>'name'), '[]'::jsonb) INTO v_booked
    FROM (
      SELECT DISTINCT ON (ev.event_id) jsonb_build_object(
               'event_id', ev.event_id,
               'name', COALESCE(NULLIF(trim(e.display_name), ''), 'A couple'),
               'event_type', COALESCE(etv.label_en, e.event_type),
               'service', COALESCE(NULLIF(trim(vs.title), ''), vs.category, ev.category::text),
               'service_id', ev.service_id,
               'source', 'setnayan'
             ) AS b
        FROM public.event_vendors ev
        JOIN public.events e ON e.event_id = ev.event_id
        LEFT JOIN public.event_type_vocab etv ON etv.event_type = e.event_type
        LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
       WHERE ev.marketplace_vendor_id = v_mvid
         AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND ev.archived_at IS NULL
         AND ev.event_id <> v_event_id
         AND e.event_date = v_date
         AND e.event_date_precision = 'day'
       ORDER BY ev.event_id, (ev.package_role IS DISTINCT FROM 'covered') DESC
       LIMIT 40
    ) x;

  -- ── …AND OUTSIDE (the shop's own record of a client it sold elsewhere) ─────
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'name', COALESCE(NULLIF(trim(b.client_name), ''), 'Outside client'),
           'source', 'outside') ORDER BY b.blocked_at), '[]'::jsonb)
    INTO v_outside
    FROM (
      SELECT blk.client_name, blk.blocked_at
        FROM public.vendor_calendar_blocks blk
       WHERE blk.vendor_profile_id = v_mvid
         AND blk.block_source = 'external_client'
         AND (blk.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= v_date
         AND (blk.blocked_until AT TIME ZONE 'Asia/Manila')::date >= v_date
       ORDER BY blk.blocked_at
       LIMIT 20
    ) b;

  -- ── OTHERS ASKING FOR THAT DAY (the rows resolve_others_first counts) ──────
  SELECT COALESCE(jsonb_agg(a ORDER BY a->>'asked_at'), '[]'::jsonb) INTO v_asking
    FROM (
      SELECT jsonb_build_object(
               'event_id', ev.event_id,
               'name', COALESCE(NULLIF(trim(e.display_name), ''), 'A couple'),
               'event_type', COALESCE(etv.label_en, e.event_type),
               'asked_at', ev.lock_requested_at,
               'thread_id', (
                 SELECT t.thread_id FROM public.chat_threads t
                  WHERE t.event_id = ev.event_id
                    AND t.vendor_profile_id = v_mvid
                  ORDER BY t.created_at DESC
                  LIMIT 1)
             ) AS a
        FROM public.event_vendors ev
        JOIN public.events e ON e.event_id = ev.event_id
        LEFT JOIN public.event_type_vocab etv ON etv.event_type = e.event_type
       WHERE ev.marketplace_vendor_id = v_mvid
         AND ev.lock_request_state = 'pending'
         AND ev.archived_at IS NULL
         AND ev.vendor_id <> p_event_vendor_id
         AND e.event_date = v_date
         AND e.event_date_precision = 'day'
       LIMIT 40
    ) y;

  -- ── SHORTLISTED YOU FOR THAT DAY, NOT ASKED ───────────────────────────────
  SELECT COALESCE(jsonb_agg(sv ORDER BY sv->>'name'), '[]'::jsonb) INTO v_saved
    FROM (
      SELECT DISTINCT ON (ev.event_id) jsonb_build_object(
               'event_id', ev.event_id,
               'name', COALESCE(NULLIF(trim(e.display_name), ''), 'A couple'),
               'event_type', COALESCE(etv.label_en, e.event_type),
               'saved_at', ev.created_at
             ) AS sv
        FROM public.event_vendors ev
        JOIN public.events e ON e.event_id = ev.event_id
        LEFT JOIN public.event_type_vocab etv ON etv.event_type = e.event_type
       WHERE ev.marketplace_vendor_id = v_mvid
         AND ev.status IN ('considering', 'shortlisted')
         AND ev.lock_request_state IS NULL
         AND ev.archived_at IS NULL
         AND ev.event_id <> v_event_id
         AND e.event_date = v_date
         AND e.event_date_precision = 'day'
         AND NOT EXISTS (
           SELECT 1 FROM public.event_vendors ask
            WHERE ask.event_id = ev.event_id
              AND ask.marketplace_vendor_id = v_mvid
              AND ask.lock_request_state = 'pending'
              AND ask.archived_at IS NULL)
       ORDER BY ev.event_id, ev.created_at
       LIMIT 40
    ) z;

  RETURN jsonb_build_object(
    'status', 'ok',
    'event_id', v_event_id,
    'ask', v_state,
    'date', v_date,
    'verdict', v_verdict,
    'competing', COALESCE(v_competing, 0),
    'slot_full', v_slot_full,
    'daily_full', v_daily_full,
    'services', v_services,
    'booked', v_booked || v_outside,
    'asking', v_asking,
    'shortlisted', v_saved
  );
END;
$function$;

COMMENT ON FUNCTION public.vendor_day_check(uuid) IS
  'Read-only: the day of one booking ask, as the supplier sees it BEFORE Agree — the capacity verdict '
  'vendor_agree_to_lock would answer with (resolve_others_first · slot_full · daily_limit_reached · open, '
  'same predicates, same service_card_bookings_on count), each card''s limit and bookings, who is booked '
  '(on Setnayan and outside), who else is asking, who shortlisted the shop that day. vendor_agree_to_lock''s '
  'ownership gate. DAY CHECK BEFORE ACCEPT, owner 2026-11-04.';

REVOKE ALL ON FUNCTION public.vendor_day_check(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_day_check(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.vendor_waitlist_the_ask(p_event_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_check    JSONB;
  v_state    TEXT;
  v_event_id UUID;
  v_mvid     UUID;
  v_user     UUID;
  v_date     DATE;
BEGIN
  -- vendor_day_check carries the ownership gate (raises for a stranger) and the
  -- one verdict; this function only acts on it.
  v_check := public.vendor_day_check(p_event_vendor_id);

  SELECT lock_request_state, event_id, marketplace_vendor_id, lock_requested_by_user_id
    INTO v_state, v_event_id, v_mvid, v_user
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id;

  IF v_state IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('status', 'not_pending', 'event_id', v_event_id);
  END IF;
  IF v_check->>'status' <> 'ok' THEN
    RETURN jsonb_build_object('status', 'no_date', 'event_id', v_event_id);
  END IF;
  IF NOT ((v_check->>'slot_full')::boolean OR (v_check->>'daily_full')::boolean) THEN
    RETURN jsonb_build_object('status', 'not_full', 'event_id', v_event_id);
  END IF;

  -- The couple who asked. An ask written before the column was stamped falls
  -- back to the event's first couple member.
  IF v_user IS NULL THEN
    SELECT em.user_id INTO v_user
      FROM public.event_members em
     WHERE em.event_id = v_event_id
       AND em.member_type = 'couple'
     ORDER BY em.joined_at
     LIMIT 1;
  END IF;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status', 'no_couple', 'event_id', v_event_id);
  END IF;

  v_date := (v_check->>'date')::date;

  IF EXISTS (
    SELECT 1 FROM public.vendor_date_waitlist w
     WHERE w.user_id = v_user
       AND w.vendor_profile_id = v_mvid
       AND w.requested_date = v_date
       AND w.status IN ('pending', 'notified')
  ) THEN
    RETURN jsonb_build_object('status', 'already', 'event_id', v_event_id, 'date', v_date);
  END IF;

  INSERT INTO public.vendor_date_waitlist (vendor_profile_id, event_id, requested_date, user_id, status)
  VALUES (v_mvid, v_event_id, v_date, v_user, 'pending');

  RETURN jsonb_build_object('status', 'ok', 'event_id', v_event_id, 'date', v_date, 'vendor_profile_id', v_mvid);
END;
$function$;

COMMENT ON FUNCTION public.vendor_waitlist_the_ask(uuid) IS
  'Puts the couple behind an open booking ask on the shop''s waiting list (vendor_date_waitlist, the row the '
  'couple''s own Join writes) for their date — only when vendor_day_check says the day is full. Ownership via '
  'vendor_day_check. Idempotent. DAY CHECK BEFORE ACCEPT, owner 2026-11-04.';

REVOKE ALL ON FUNCTION public.vendor_waitlist_the_ask(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_waitlist_the_ask(uuid) TO authenticated, service_role;

COMMIT;
