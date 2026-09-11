-- ============================================================================
-- a_cards_daily_limit_really_refuses — LOCK-PATH CAPACITY (register · N5).
--
-- ── THE BUG (measured by S2 in production pg_policies, 2026-09-11; re-measured
--    by N5 in the replay as a real `authenticated` couple) ─────────────────────
-- A supplier's per-card daily limit (`vendor_services.daily_capacity`) is
-- enforced by ONE gate: vendors/actions.ts finalizeVendor, "#2", which returns
-- `soft_hold_limit_reached`. It counted the card's confirmed bookings on the
-- couple's date by reading `events` and `event_vendors` THROUGH THE COUPLE'S OWN
-- SESSION — and RLS lets a couple see only their own events. So it always
-- counted 0 and never refused: a limit of 2 took a third, fourth, fifth couple.
-- It also ignored `event_date_precision`, so a month-only event stored as the
-- 1st counted as a booking ON the 1st.
--
-- ── THE FIX: ONE COUNT, TWO READERS ─────────────────────────────────────────
-- 1. `service_card_bookings_on(card, day[, exclude_row])` — SECURITY DEFINER,
--    read-only, returns ONE integer: the card's bookings that day in
--    contracted · deposit_paid · delivered · complete (lib/events.ts
--    CONFIRMED_VENDOR_STATUSES), not archived, on DAY-PRECISE events only.
--    Server-only: EXECUTE is held by `service_role` alone, so no browser can
--    probe a supplier's bookings per day. The #2 gate calls it with the admin
--    client, scoped by the card id it read off the couple's own booking row and
--    the date it read off the couple's own event — both through the couple's
--    session — and only when that event is day-precise.
-- 2. `service_cards_unbookable_on` (H6, 20271221805341) learns the same verdict:
--    a card with no active time slot and a daily_capacity is refused on a day
--    when that count reaches the limit. Its body is 20271221805341's byte for
--    byte apart from `svc.dcap` and the `capacity_refused` CTE. The tripwire H6
--    left for exactly this change is removed in the same PR; the parity guard
--    and the seeded differential now cover daily_capacity cards.
--
-- Production today: 0 cards with a daily limit, 0 confirmed bookings with a
-- service (S2, 2026-09-11) — nothing is refused that was accepted yesterday.
--
-- Guards: apps/web/tests/db/a-full-card-leaves-bench-search.db.test.ts ·
-- apps/web/tests/db/a-cards-daily-limit-really-refuses.db.test.ts ·
-- apps/web/lib/h6-mirrors-the-booking-path.test.ts.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.service_card_bookings_on(
  p_service_id        uuid,
  p_day               date,
  p_exclude_vendor_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)::integer
    FROM public.event_vendors ev
    JOIN public.events e ON e.event_id = ev.event_id
   WHERE ev.service_id = p_service_id
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND ev.archived_at IS NULL
     AND e.event_date = p_day
     AND e.event_date_precision = 'day'
     AND (p_exclude_vendor_id IS NULL OR ev.vendor_id <> p_exclude_vendor_id);
$function$;

COMMENT ON FUNCTION public.service_card_bookings_on(uuid, date, uuid) IS
  'Read-only: how many bookings (contracted · deposit_paid · delivered · complete, '
  'not archived) a service card holds on a DAY-PRECISE event that day, optionally '
  'excluding one booking row. The one count behind the per-card daily limit — the '
  'lock''s #2 gate (vendors/actions.ts) and service_cards_unbookable_on (the bench '
  'search). Server-only (service_role); a month-only event is never a booking on '
  'the 1st. LOCK-PATH CAPACITY, 20271222330608.';

REVOKE ALL ON FUNCTION public.service_card_bookings_on(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_bookings_on(uuid, date, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.service_cards_unbookable_on(
  p_service_ids     uuid[],
  p_dates           date[],
  p_named_calendars boolean DEFAULT TRUE
)
RETURNS TABLE (service_id uuid, refused_on date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  IF p_service_ids IS NULL OR p_dates IS NULL
     OR cardinality(p_service_ids) = 0 OR cardinality(p_dates) = 0 THEN
    RETURN;
  END IF;
  IF cardinality(p_service_ids) > 100 THEN
    RAISE EXCEPTION 'too_many_service_ids' USING ERRCODE = '22023',
      HINT = 'at most 100 service cards per call';
  END IF;
  IF cardinality(p_dates) > 31 THEN
    RAISE EXCEPTION 'too_many_dates' USING ERRCODE = '22023',
      HINT = 'at most 31 dates per call';
  END IF;

  RETURN QUERY
  WITH
  svc AS (
    SELECT s.vendor_service_id AS sid, s.vendor_profile_id AS vpid, s.category,
           s.daily_capacity AS dcap
      FROM public.vendor_services s
     WHERE s.vendor_service_id = ANY (p_service_ids)
  ),
  d AS (
    SELECT DISTINCT x.day FROM unnest(p_dates) AS x(day) WHERE x.day IS NOT NULL
  ),

  -- ── Pool resolution, read-only (see header §3) ───────────────────────────
  -- Every category the card resolves: its own (when it has no named calendar,
  -- or named calendars are off) and each bundle leg.
  wanted_category AS (
    SELECT svc.sid, svc.vpid, svc.category AS category_key
      FROM svc
      LEFT JOIN public.vendor_schedule_calendar_services cs
        ON cs.vendor_service_id = svc.sid
     WHERE svc.category IS NOT NULL AND length(svc.category) > 0
       AND (NOT p_named_calendars OR cs.pool_id IS NULL)
    UNION
    SELECT svc.sid, svc.vpid, l.linked_canonical_service
      FROM svc
      JOIN public.vendor_service_links l ON l.vendor_service_id = svc.sid
     WHERE l.linked_canonical_service IS NOT NULL
       AND length(l.linked_canonical_service) > 0
  ),
  -- A REAL pool the card holds: its named calendar, or an existing category map.
  real_pool AS (
    SELECT svc.sid, cs.pool_id
      FROM svc
      JOIN public.vendor_schedule_calendar_services cs ON cs.vendor_service_id = svc.sid
     WHERE p_named_calendars
    UNION
    SELECT wc.sid, pc.pool_id
      FROM wanted_category wc
      JOIN public.vendor_schedule_pool_categories pc
        ON pc.vendor_profile_id = wc.vpid AND pc.category_key = wc.category_key
  ),
  -- …and the pools the booking path would CREATE on first resolve: a wanted
  -- category with no mapping yet. New pools are active and empty.
  virtual_pool_card AS (
    SELECT DISTINCT wc.sid, wc.vpid
      FROM wanted_category wc
     WHERE NOT EXISTS (
       SELECT 1 FROM public.vendor_schedule_pool_categories pc
        WHERE pc.vendor_profile_id = wc.vpid AND pc.category_key = wc.category_key)
  ),
  active_pool AS (
    SELECT rp.sid, p.pool_id, p.vendor_profile_id AS vpid, p.daily_booking_capacity AS cap
      FROM real_pool rp
      JOIN public.vendor_schedule_pools p ON p.pool_id = rp.pool_id
     WHERE p.is_active
  ),

  -- ── (a)+(a2) shop-wide: refuses every active pool, real or new ──────────
  shop_closed AS (
    SELECT DISTINCT c.vpid, d.day
      FROM (SELECT vpid FROM active_pool UNION SELECT vpid FROM virtual_pool_card) c
     CROSS JOIN d
     WHERE EXISTS (
             SELECT 1 FROM public.vendor_calendar_blocks b
              WHERE b.vendor_profile_id = c.vpid
                AND b.block_source IN ('manual', 'synced_calendar')
                AND b.pool_id IS NULL
                AND (b.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= d.day
                AND (b.blocked_until AT TIME ZONE 'Asia/Manila')::date >= d.day)
        OR EXISTS (
             SELECT 1 FROM public.vendor_calendar_day_states ds
              WHERE ds.vendor_profile_id = c.vpid
                AND ds.state_date = d.day
                AND ds.pool_id IS NULL
                AND ds.day_state = 'locked')
  ),

  -- ── (a)+(a2)+(b) per REAL active pool ───────────────────────────────────
  pool_refused AS (
    SELECT ap.sid, d.day
      FROM active_pool ap
     CROSS JOIN d
     WHERE EXISTS (
             SELECT 1 FROM public.vendor_calendar_blocks b
              WHERE b.vendor_profile_id = ap.vpid
                AND b.block_source IN ('manual', 'synced_calendar')
                AND (b.pool_id = ap.pool_id OR b.pool_id IS NULL)
                AND (b.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= d.day
                AND (b.blocked_until AT TIME ZONE 'Asia/Manila')::date >= d.day)
        OR EXISTS (
             SELECT 1 FROM public.vendor_calendar_day_states ds
              WHERE ds.vendor_profile_id = ap.vpid
                AND ds.state_date = d.day
                AND (ds.pool_id = ap.pool_id OR ds.pool_id IS NULL)
                AND ds.day_state = 'locked')
        OR (
             (SELECT count(*) FROM public.vendor_schedule_pool_bookings pb
               WHERE pb.pool_id = ap.pool_id
                 AND pb.booked_date = d.day
                 AND pb.released_at IS NULL)
           + (SELECT count(*) FROM public.vendor_calendar_blocks b
               WHERE b.pool_id = ap.pool_id
                 AND b.block_source = 'external_client'
                 AND (b.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= d.day
                 AND (b.blocked_until AT TIME ZONE 'Asia/Manila')::date >= d.day)
           ) >= ap.cap
    UNION
    SELECT vp.sid, sc.day
      FROM virtual_pool_card vp
      JOIN shop_closed sc ON sc.vpid = vp.vpid
  ),

  -- ── SLOTS (Enterprise), per acquire_service_time_slot ──────────────────
  slot AS (
    SELECT t.slot_id, t.vendor_service_id AS sid, t.vendor_profile_id AS vpid, t.slot_capacity AS cap
      FROM public.vendor_service_time_slots t
     WHERE t.vendor_service_id IN (SELECT sid FROM svc)
       AND t.is_active
  ),
  slot_refused AS (
    SELECT sc.sid, d.day
      FROM (SELECT DISTINCT sid, vpid FROM slot) sc
     CROSS JOIN d
     WHERE EXISTS (
             SELECT 1 FROM public.vendor_calendar_day_states ds
              WHERE ds.vendor_profile_id = sc.vpid
                AND ds.state_date = d.day
                AND ds.pool_id IS NULL
                AND ds.day_state = 'locked')
        OR NOT EXISTS (
             -- a slot with room that day
             SELECT 1 FROM slot sl
              WHERE sl.sid = sc.sid
                AND (SELECT count(*)
                       FROM public.event_vendors ev
                       JOIN public.events e ON e.event_id = ev.event_id
                      WHERE ev.service_time_slot_id = sl.slot_id
                        AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
                        AND ev.archived_at IS NULL
                        AND e.event_date = d.day
                        AND e.event_date_precision = 'day') < sl.cap)
  ),

  -- ── PER-CARD DAILY LIMIT (#2), per vendors/actions.ts finalizeVendor ─────
  -- A card with NO active time slot and a daily_capacity is full on a day when
  -- the card's bookings that day reach it — counted by the SAME function the
  -- lock's #2 gate asks (service_card_bookings_on: day-precise events only, the
  -- four booked statuses, not archived). A slotted card is judged by its slots.
  capacity_refused AS (
    SELECT svc.sid, d.day
      FROM svc
     CROSS JOIN d
     WHERE svc.dcap IS NOT NULL AND svc.dcap > 0
       AND NOT EXISTS (SELECT 1 FROM slot sl WHERE sl.sid = svc.sid)
       AND public.service_card_bookings_on(svc.sid, d.day) >= svc.dcap
  )

  SELECT r.sid, r.day FROM pool_refused r
  UNION
  SELECT r.sid, r.day FROM slot_refused r
  UNION
  SELECT r.sid, r.day FROM capacity_refused r;
END;
$function$;

COMMENT ON FUNCTION public.service_cards_unbookable_on(uuid[], date[], boolean) IS
  'Read-only: the (service card, date) pairs the booking path would REFUSE — '
  'acquire_schedule_pools (closure · locked day · pool full), '
  'acquire_service_time_slot (locked day · every slot full) and the per-card daily '
  'limit (#2 gate: service_card_bookings_on ≥ daily_capacity, cards without active '
  'slots). Whitelist days are deliberately not refusals. Pool resolution is a '
  'read-only mirror of resolve_schedule_pool, which would otherwise CREATE pools. '
  'Server-only (service_role); capped at 100 cards and 31 dates; returns no labels '
  'or counts. Used by the bench search to hide suppliers with no booking left '
  '(owner 2026-09-11, register H6; daily limit added by LOCK-PATH CAPACITY).';

-- Server-only. Name every role: Supabase's default privileges give anon and
-- authenticated their own EXECUTE entries, which REVOKE ... FROM PUBLIC misses.
REVOKE ALL ON FUNCTION public.service_cards_unbookable_on(uuid[], date[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_cards_unbookable_on(uuid[], date[], boolean) TO service_role;

-- ── POST-CONDITIONS ────────────────────────────────────────────────────────
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, p.prosecdef, p.provolatile, p.proconfig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
     WHERE p.proname IN ('service_card_bookings_on', 'service_cards_unbookable_on')
  LOOP
    IF NOT f.prosecdef THEN
      RAISE EXCEPTION 'POST-CONDITION FAILED: % is not SECURITY DEFINER — under the caller it would count only their own bookings again', f.proname;
    END IF;
    IF f.provolatile <> 's' THEN
      RAISE EXCEPTION 'POST-CONDITION FAILED: % is not STABLE — it must never write', f.proname;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(coalesce(f.proconfig, ARRAY[]::text[])) c WHERE c LIKE 'search_path=%') THEN
      RAISE EXCEPTION 'POST-CONDITION FAILED: % has no pinned search_path', f.proname;
    END IF;
    IF has_function_privilege('anon', f.oid, 'EXECUTE') OR has_function_privilege('authenticated', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-CONDITION FAILED: % is callable from a browser', f.proname;
    END IF;
    IF NOT has_function_privilege('service_role', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-CONDITION FAILED: the server cannot call %', f.proname;
    END IF;
  END LOOP;
  IF position('service_card_bookings_on(' IN pg_get_functiondef('public.service_cards_unbookable_on(uuid[], date[], boolean)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the bench search does not ask the daily-limit count';
  END IF;
  IF position('event_date_precision = ''day''' IN pg_get_functiondef('public.service_card_bookings_on(uuid, date, uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the count is not day-precision-only';
  END IF;
END $$;

COMMIT;
