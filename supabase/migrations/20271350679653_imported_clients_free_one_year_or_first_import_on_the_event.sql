-- imported_clients_free_one_year_or_first_import_on_the_event
--
-- Owner, 2026-11-16 (specs DECISION_LOG d4899cd5, amended by 9fe95ebe). SUPERSEDES "AN IMPORTED CLIENT BOOKS FREE FOR
-- LIFE" and the free-import parts of "NO CAP ON CLIENT IMPORTS". The rule for a booking a SUPPLIER BROUGHT (an
-- `event_vendors` row whose `source` is vendor_invite · vendor_locked_qr · reuse_accept):
--   (1) the import CREATED the client's Setnayan account → no booking fee for 12 MONTHS from the import, on every
--       booking that client makes with THAT supplier;
--   (2) the client already had an account → no fee FOR THAT EVENT when this supplier is the FIRST imported supplier on
--       it — a new event or one already on Setnayan (amendment 9fe95ebe);
--   (3) every other supplier on the same event pays the normal booking fee, even when imported too;
--   (4) an earlier Setnayan contact with that supplier (a chat, a save, a page open through Setnayan) makes it a
--       Setnayan booking.
-- Until today a supplier-brought row was free FOREVER and BEFORE any earlier Setnayan fact was read (#7841 hole 2a).
--
-- ── WHAT THIS READS (all on main already; NO new schema — Add a client, #7889, records the import side) ─────────
--   · event_vendors (event_id, marketplace_vendor_id, source, created_at, vendor_id) — the import is the supplier-brought
--     row; its created_at is the import moment;
--   · event_members (event_id, user_id, member_type = 'couple') — who the client is, across their events;
--   · events.created_at — which of the client's events came first;
--   · chat_threads (event_id, created_at) and vendor_profile_views (event_id, vendor_profile_id, source, viewed_at).
-- ⚠ "THE IMPORT CREATED THE ACCOUNT" IS READ STRUCTURALLY, not from a sign-up record (none ties an account to the
-- invite on main): the imported event is the client's FIRST event (no couple member is a couple member of an event
-- created earlier) AND the import is the first thing on it (no shop row and no chat on it before the import). It
-- fails toward the FEE: a client with any earlier event, or an event already in use, is an existing account (rule 2).
-- Known looseness, named for the owner: an account made long ago that never created an event or touched a supplier
-- reads as new. When #7889's `vendor_client_invites` lands, its created_at ≤ the account's created_at can sharpen it.
-- ⚠ "12 months" is read against NOW() at the moment the fee is decided; booking_fee_ledger freezes it at first charge.
--
-- Adds functions only. No data is written; no frozen ledger row is changed. RLS is unchanged.

-- ── 1 · the per-event rule, with (4): an earlier Setnayan fact beats a supplier-brought row ──────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_attribution_for_event(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
        FROM public.chat_threads t
       WHERE t.event_id = p_event_id
         AND t.vendor_profile_id = p_vendor_profile_id
         AND public.booking_fee_is_sourced_surface(t.inquiry_source)
    ) THEN 'sourced'
    WHEN EXISTS (
      SELECT 1
        FROM public.event_vendors ev
        LEFT JOIN public.event_manual_vendors emv
          ON emv.manual_vendor_id = ev.manual_vendor_id
       WHERE ev.event_id = p_event_id
         AND (ev.marketplace_vendor_id = p_vendor_profile_id
              OR emv.leak_match_vendor_profile_id = p_vendor_profile_id)
         AND COALESCE(ev.source, '') NOT IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept')
         AND (
           ev.source IN ('host_marketplace_search', 'auto_cascade_from_finalize', 'vendor_shortlist_qr')
           OR EXISTS (
             SELECT 1
               FROM public.event_vendors p
              WHERE p.event_id = p_event_id
                AND p.marketplace_vendor_id = p_vendor_profile_id
                AND p.vendor_id <> ev.vendor_id
                AND p.source IN ('host_marketplace_search', 'auto_cascade_from_finalize', 'vendor_shortlist_qr')
                AND p.created_at < COALESCE(emv.created_at, ev.created_at)
           )
           OR EXISTS (
             SELECT 1
               FROM public.vendor_profile_views v
              WHERE v.event_id = p_event_id
                AND v.vendor_profile_id = p_vendor_profile_id
                AND v.viewed_at < COALESCE(emv.created_at, ev.created_at)
                AND public.booking_fee_is_sourced_surface(v.source)
           )
         )
    ) THEN 'sourced'
    WHEN EXISTS (
      -- (4) A row the supplier brought, preceded by a Setnayan save of the shop or a Setnayan profile view for this event.
      SELECT 1
        FROM public.event_vendors ev
       WHERE ev.event_id = p_event_id
         AND ev.marketplace_vendor_id = p_vendor_profile_id
         AND ev.source IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept')
         AND (
           EXISTS (
             SELECT 1
               FROM public.event_vendors p
              WHERE p.event_id = p_event_id
                AND p.marketplace_vendor_id = p_vendor_profile_id
                AND p.vendor_id <> ev.vendor_id
                AND p.source IN ('host_marketplace_search', 'auto_cascade_from_finalize', 'vendor_shortlist_qr')
                AND p.created_at < ev.created_at
           )
           OR EXISTS (
             SELECT 1
               FROM public.vendor_profile_views v
              WHERE v.event_id = p_event_id
                AND v.vendor_profile_id = p_vendor_profile_id
                AND v.viewed_at < ev.created_at
                AND public.booking_fee_is_sourced_surface(v.source)
           )
         )
    ) THEN 'sourced'
    ELSE 'import'
  END;
$$;
COMMENT ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) IS
  'sourced | import for ONE (vendor, event), from that event''s facts only: a chat from a Setnayan surface, a save on '
  'Setnayan, or a Setnayan profile view before the booking makes it sourced - and, since 2026-11-16 (d4899cd5 point 4), '
  'also before a row the supplier brought. ''import'' here means only "no Setnayan fact on this event"; whether a '
  'supplier-brought booking is free is decided by booking_fee_attribution_for (one year / first import on the event).';

-- ── 2 · when this supplier imported the client onto this event ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_import_at(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT min(ev.created_at)
    FROM public.event_vendors ev
   WHERE ev.event_id = p_event_id
     AND ev.marketplace_vendor_id = p_vendor_profile_id
     AND ev.source IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept');
$$;
COMMENT ON FUNCTION public.booking_fee_import_at(UUID, UUID) IS
  'The moment a supplier imported the client onto an event: the earliest row the supplier brought (vendor_invite, '
  'vendor_locked_qr, reuse_accept). NULL when the supplier did not import them onto it.';

-- ── 3 · (2)/(3): is this supplier the FIRST imported supplier on the event? ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_is_first_import(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.at IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.event_vendors o
        WHERE o.event_id = p_event_id
          AND o.marketplace_vendor_id IS NOT NULL
          AND o.marketplace_vendor_id <> p_vendor_profile_id
          AND o.source IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept')
          AND (o.created_at < a.at
               OR (o.created_at = a.at AND o.marketplace_vendor_id::text < p_vendor_profile_id::text))
     )
    FROM (SELECT public.booking_fee_import_at(p_vendor_profile_id, p_event_id) AS at) a;
$$;
COMMENT ON FUNCTION public.booking_fee_is_first_import(UUID, UUID) IS
  'True when this supplier is the FIRST imported supplier on the event (earliest import; a same-instant tie goes to the '
  'lower shop id, so exactly one wins). Owner 2026-11-16 d4899cd5 (2)(3), amended 9fe95ebe: the event may be new or '
  'already on Setnayan.';

-- ── 4 · (1): did this import create the client's account? (structural reading — see the header) ──────────────
CREATE OR REPLACE FUNCTION public.booking_fee_import_created_account(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.at IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.event_members m
        WHERE m.event_id = p_event_id AND m.member_type = 'couple'
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.event_members m
         JOIN public.event_members mo
           ON mo.user_id = m.user_id
          AND mo.member_type = 'couple'
          AND mo.event_id <> p_event_id
         JOIN public.events oe ON oe.event_id = mo.event_id
         JOIN public.events e ON e.event_id = p_event_id
        WHERE m.event_id = p_event_id
          AND m.member_type = 'couple'
          AND oe.created_at <= e.created_at
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.event_vendors x
        WHERE x.event_id = p_event_id AND x.created_at < a.at
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.chat_threads t
        WHERE t.event_id = p_event_id AND t.created_at < a.at
     )
    FROM (SELECT public.booking_fee_import_at(p_vendor_profile_id, p_event_id) AS at) a;
$$;
COMMENT ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) IS
  'True when this supplier''s import onto the event brought the client onto Setnayan: the event is the first of every '
  'couple member, and the import is the first shop row and precedes every chat on it. Structural reading of d4899cd5 '
  '(1) - fails toward the fee. Sharpen with the Add-a-client invite record when it lands.';

-- ── 5 · the rule every caller reads ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_attribution_for(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH couple_events AS (
    SELECT DISTINCT mo.event_id
      FROM public.event_members me
      JOIN public.event_members mo
        ON mo.user_id = me.user_id
       AND mo.member_type = 'couple'
     WHERE me.event_id = p_event_id
       AND me.member_type = 'couple'
  )
  SELECT CASE
    -- (1) This supplier brought the client onto Setnayan within the last 12 months, with no Setnayan fact first:
    --     free on every event of that client with this supplier.
    WHEN EXISTS (
      SELECT 1
        FROM couple_events ce
       WHERE public.booking_fee_import_created_account(p_vendor_profile_id, ce.event_id)
         AND public.booking_fee_import_at(p_vendor_profile_id, ce.event_id) > NOW() - INTERVAL '12 months'
         AND public.booking_fee_attribution_for_event(p_vendor_profile_id, ce.event_id) = 'import'
    ) THEN 'import'
    -- (4) A Setnayan fact on this event.
    WHEN public.booking_fee_attribution_for_event(p_vendor_profile_id, p_event_id) = 'sourced' THEN 'sourced'
    -- HOLE 3 (LOCKED §3, every repeat): the same couple, sourced to this shop on an event first touched no later.
    WHEN EXISTS (
      SELECT 1
        FROM public.event_members me
        JOIN public.event_members mo
          ON mo.user_id = me.user_id
         AND mo.member_type = 'couple'
         AND mo.event_id <> p_event_id
       WHERE me.event_id = p_event_id
         AND me.member_type = 'couple'
         AND public.booking_fee_first_contact_at(p_vendor_profile_id, mo.event_id)
               <= COALESCE(public.booking_fee_first_contact_at(p_vendor_profile_id, p_event_id), 'infinity'::timestamptz)
         AND COALESCE(
               (SELECT l.attribution
                  FROM public.booking_fee_ledger l
                 WHERE l.vendor_profile_id = p_vendor_profile_id
                   AND l.event_id = mo.event_id
                   AND l.attribution_frozen_at IS NOT NULL),
               public.booking_fee_attribution_for_event(p_vendor_profile_id, mo.event_id)
             ) = 'sourced'
    ) THEN 'sourced'
    -- (2)/(3) The supplier brought this booking: free only as the FIRST imported supplier on this event.
    WHEN public.booking_fee_import_at(p_vendor_profile_id, p_event_id) IS NOT NULL THEN
      CASE WHEN public.booking_fee_is_first_import(p_vendor_profile_id, p_event_id) THEN 'import' ELSE 'sourced' END
    -- Nothing from Setnayan and nothing imported: found outside Setnayan (unchanged).
    ELSE 'import'
  END;
$$;
COMMENT ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) IS
  'sourced | import for a (vendor, event). Owner 2026-11-16 (d4899cd5, amended 9fe95ebe): (1) a supplier whose import '
  'brought the client onto Setnayan books that client free for 12 months, on every event; (4) otherwise any Setnayan '
  'fact on the event makes it sourced; HOLE 3 - the same couple sourced to the shop on an earlier-touched event is '
  'sourced here too; (2)(3) a booking the supplier brought is free only for the FIRST imported supplier on the event, '
  'every other one pays; a booking with nothing from Setnayan and nothing imported stays free. Fails SAFE to import '
  'only where no fact exists. The per-event arms mirror bookingFeeAttributionFromFacts in apps/web/lib/booking-fee-gate.ts.';

REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_import_at(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_import_at(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_import_at(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_import_at(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_is_first_import(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_is_first_import(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_is_first_import(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_is_first_import(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_import_created_account(UUID, UUID) TO service_role;
