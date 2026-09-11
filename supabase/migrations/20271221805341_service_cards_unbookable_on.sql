-- ============================================================================
-- service_cards_unbookable_on — which service cards the booking path would
-- REFUSE on which days. Read-only. Register session H6.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Owner, 2026-09-11 (DECISION_LOG): *"if there are no more available booking
-- for that day for that service card, it should not show"* — in the couple's
-- bench SEARCH. With only a month chosen: *"Hide only if full all month"*.
--
-- The search must hide EXACTLY what the booking path refuses: hide a card the
-- booking path would still accept and a couple loses a supplier who could have
-- taken them; show one it would refuse and they chase a supplier who cannot.
-- So this function does not invent a rule. It restates, read-only, the two
-- refusals the booking path really enforces (read 2026-09-11 from the bodies in
-- force — the latest migration defining each):
--
--   POOLS — acquire_schedule_pools(), per pool the card resolves to, on a
--   day-precise date, refuses when:
--     (a)  a 'manual' / 'synced_calendar' block covers the day, scoped to the
--          pool or shop-wide (pool_id IS NULL);
--     (a2) a day state is 'locked' (pool-scoped or shop-wide);
--     (b)  live vendor_schedule_pool_bookings + 'external_client' blocks on the
--          pool ≥ daily_booking_capacity.
--   Only ACTIVE pools are gated (its loop reads `AND is_active`).
--
--   SLOTS — acquire_service_time_slot(), for a card with ≥1 active time slot:
--     a shop-wide 'locked' day state, or the CHOSEN slot at capacity, where
--     occupancy = event_vendors on that slot in
--     contracted · deposit_paid · delivered · complete, not archived, on a
--     day-precision event that day. The couple picks the slot, so a card is
--     refused only when EVERY active slot is full.
--
--   A card is refused on a day when its slots refuse OR any of its pools does
--   — the lock takes the slot and the deposit takes the pools
--   (`updateVendorStatus` acquires pools for any card, slotted or not).
--
-- ── ⚖ THREE DELIBERATE DIFFERENCES FROM THE BOOKING PATH ────────────────────
-- 1. 'whitelist' days are NOT refused here. The booking path holds them for the
--    supplier's approval; they are still bookable with the supplier's yes, and
--    the orchestrator ruled (2026-09-11) that search shows them.
-- 2. vendor_services.daily_capacity is NOT read. Its only gate
--    (`vendors/actions.ts` "#2") counts other couples' bookings through the
--    COUPLE'S session, which RLS limits to the couple's own events — so in
--    production it never refuses. Hiding on it would hide cards the booking
--    path accepts. A tripwire test fails the moment that gate starts seeing
--    other couples' bookings. Tracked as "LOCK-PATH CAPACITY".
-- 3. POOL RESOLUTION IS READ-ONLY. The booking path resolves a card's pools
--    through resolve_schedule_pool(), which is VOLATILE: when a sold category
--    has no pool yet it INSERTS one (active, capacity 1, no bookings). Calling
--    it here would create pools because a couple browsed. So this reads the
--    existing mapping, and where none exists it treats the card as holding the
--    pool the booking path WOULD create — which, being new and empty, can only
--    be refused by a SHOP-WIDE closure or a shop-wide 'locked' day. An existing
--    mapping to an INACTIVE pool is skipped entirely, as the acquire skips it.
--
-- Resolution mirrors lib/schedule-pools.ts `resolvePoolIdsForService`: the
-- card's named-calendar pool (vendor_schedule_calendar_services) when
-- `p_named_calendars`, else — or when it has none — its category's pool; plus
-- one category pool per bundle leg (vendor_service_links). The caller passes
-- the SAME flag the lock reads (NEXT_PUBLIC_NAMED_CALENDARS_ENABLED, through
-- lib/schedule-pools.ts `namedCalendarsEnabled`). The lock reads calendar
-- membership through the couple's session, which sees it for PUBLISHED shops
-- only; the bench search lists published shops only, so the two agree there.
--
-- ── PRIVACY: SERVER-ONLY ────────────────────────────────────────────────────
-- EXECUTE is held by `service_role` alone — revoked from PUBLIC, anon AND
-- authenticated. Granted to signed-in users, any account could call
-- /rest/v1/rpc/service_cards_unbookable_on over arbitrary card ids and read a
-- month of any supplier's refused days per call (orchestrator review of #5434,
-- 2026-09-11). So the bench search calls it from server code with the admin
-- client and sends the browser only its verdict — a supplier shown or not —
-- never a (card, date) pair. Even so it returns only the refused pairs (no
-- labels, counts or capacities) and the inputs stay CAPPED (≤ 100 cards,
-- ≤ 31 dates).
--
-- Guards: apps/web/tests/db/a-full-card-leaves-bench-search.db.test.ts (the
-- behaviour, seeded) · apps/web/lib/h6-mirrors-the-booking-path.test.ts (parity
-- with the two booking functions' latest migration bodies + the tripwire).
-- ============================================================================

BEGIN;

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
    SELECT s.vendor_service_id AS sid, s.vendor_profile_id AS vpid, s.category
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
  )

  SELECT r.sid, r.day FROM pool_refused r
  UNION
  SELECT r.sid, r.day FROM slot_refused r;
END;
$function$;

COMMENT ON FUNCTION public.service_cards_unbookable_on(uuid[], date[], boolean) IS
  'Read-only: the (service card, date) pairs the booking path would REFUSE — '
  'acquire_schedule_pools (closure · locked day · pool full) and '
  'acquire_service_time_slot (locked day · every slot full). Whitelist days and '
  'vendor_services.daily_capacity are deliberately not refusals (see migration '
  'header). Pool resolution is a read-only mirror of resolve_schedule_pool, '
  'which would otherwise CREATE pools. Server-only (service_role); capped at 100 '
  'cards and 31 dates; returns no labels or counts. Used by the bench search to '
  'hide suppliers with no booking left (owner 2026-09-11, register H6).';

-- Server-only. Name every role: Supabase's default privileges give anon and
-- authenticated their own EXECUTE entries, which REVOKE ... FROM PUBLIC misses.
REVOKE ALL ON FUNCTION public.service_cards_unbookable_on(uuid[], date[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_cards_unbookable_on(uuid[], date[], boolean) TO service_role;

COMMIT;
