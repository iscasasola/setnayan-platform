-- the_booking_fee_follows_the_couple — HOLE 3 (controller sweep 2026-11-16), CLOSED.
--
-- Owner, Vendor_Monetization_Model_LOCKED_2026-07-25 §3: the finder's fee "applies to the first booking AND every
-- repeat of a sourced client with that vendor", and sourced-vs-own is "stamped ONCE at first contact". Re-confirmed
-- 2026-11-16 (specs DECISION_LOG "AN IMPORTED CLIENT BOOKS FREE FOR LIFE WITH THE SUPPLIER WHO BROUGHT THEM"): "a
-- SOURCED client still pays on the first booking and every repeat."
--
-- Proven open by apps/web/tests/db/hole-3-the-fee-follows-the-event-not-the-couple.db.test.ts (#7841): every fact
-- `booking_fee_attribution_for(vendor, event)` read was keyed on THAT event, and `booking_fee_ledger` is UNIQUE per
-- (vendor, event) — so a couple Setnayan sourced to a shop on event A booked the same shop directly on event B and B
-- read 'import' (free forever).
--
-- ── WHAT THIS CHANGES ──────────────────────────────────────────────────────────────────────────────────────────
--   · The old per-event body is kept VERBATIM as `booking_fee_attribution_for_event` (the copy in 20271348281460).
--   · `booking_fee_attribution_for` keeps its signature and callers, and adds ONE arm: 'sourced' when a COUPLE
--     member of this event (event_members.member_type = 'couple' — never a coordinator, who works many couples'
--     events) is a couple member of ANOTHER event where this shop is sourced — that event's FROZEN ledger stamp when
--     there is one, else its per-event facts — AND that event's first contact with the shop came no later than this
--     event's (first contact wins; a supplier's own client who later wanders onto Find is not re-stamped by this arm).
--   · `booking_fee_first_contact_at` — the earliest chat thread, shop row (incl. a hand-typed record matched to the
--     shop) or profile view for a (shop, event).
-- Fails SAFE to import, as before: no couple member, no other event, no first contact → the per-event answer stands.
-- Adds only functions. No data is written; no frozen ledger row is changed. RLS is unchanged.

-- ── 1 · the per-event rule, unchanged, under its own name ────────────────────────────────────────────────────
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
    ELSE 'import'
  END;
$$;
COMMENT ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) IS
  'sourced | import for ONE (vendor, event), from that event''s facts only — the body booking_fee_attribution_for had '
  'until 2026-11-16 (20271348281460). booking_fee_attribution_for adds the same-couple arm on top (HOLE 3).';
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_attribution_for_event(UUID, UUID) TO service_role;

-- ── 2 · when a (shop, event) first touched ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_first_contact_at(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT min(at) FROM (
    SELECT t.created_at AS at
      FROM public.chat_threads t
     WHERE t.event_id = p_event_id
       AND t.vendor_profile_id = p_vendor_profile_id
    UNION ALL
    SELECT COALESCE(emv.created_at, ev.created_at)
      FROM public.event_vendors ev
      LEFT JOIN public.event_manual_vendors emv
        ON emv.manual_vendor_id = ev.manual_vendor_id
     WHERE ev.event_id = p_event_id
       AND (ev.marketplace_vendor_id = p_vendor_profile_id
            OR emv.leak_match_vendor_profile_id = p_vendor_profile_id)
    UNION ALL
    SELECT v.viewed_at
      FROM public.vendor_profile_views v
     WHERE v.event_id = p_event_id
       AND v.vendor_profile_id = p_vendor_profile_id
  ) f;
$$;
COMMENT ON FUNCTION public.booking_fee_first_contact_at(UUID, UUID) IS
  'The earliest contact between a shop and an event: a chat thread, a shop row (or a hand-typed record matched to the '
  'shop), or a profile view. NULL when there is none. Orders the same-couple arm of booking_fee_attribution_for.';
REVOKE ALL ON FUNCTION public.booking_fee_first_contact_at(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_first_contact_at(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_first_contact_at(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_first_contact_at(UUID, UUID) TO service_role;

-- ── 3 · the rule every caller reads: this event, or the same couple sourced first elsewhere ──────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_attribution_for(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.booking_fee_attribution_for_event(p_vendor_profile_id, p_event_id) = 'sourced' THEN 'sourced'
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
    ELSE 'import'
  END;
$$;
COMMENT ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) IS
  'sourced | import for a (vendor, event). SOURCED when this event''s own facts say so (booking_fee_attribution_for_event: '
  'a chat from a Setnayan surface, a save on Setnayan, or a Setnayan profile view before the booking; never a row the '
  'supplier brought), OR (HOLE 3, owner LOCKED §3 "every repeat", re-confirmed 2026-11-16) a couple member of this event '
  'is a couple member of another event where this shop is sourced - its frozen ledger stamp, else its facts - whose first '
  'contact with the shop came no later than this event''s. Fails SAFE to import. Mirrors bookingFeeAttributionFromFacts '
  '(per-event arms) in apps/web/lib/booking-fee-gate.ts; the same-couple arm is SQL only, and SQL decides the bill.';
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) TO service_role;
