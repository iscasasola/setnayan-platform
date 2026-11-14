-- card portfolio booked events
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ═══════════════════════════════════════════════════════════════════════════
-- ONE ALBUM, TWO PLACES — which live events booked which of a shop's cards.
--
-- Rulings (corpus DECISION_LOG 2026-10-08): "EACH SERVICE CARD COLLECTS ITS OWN
-- PROOF AND ITS OWN PORTFOLIO", "ONE ALBUM, TWO PLACES", "SERVICE CARD MAKER —
-- AMENDMENT ROUND" and "APPROVED — THE SERVICE CARD MAKER DRAWING" (frames
-- 71–78). The drawing names ONE new read, `cardPortfolioAlbums`, and NO table.
-- This is that read's join, and only the join: (card, event) pairs. The
-- photos stay where they already are and are read by reference by the app
-- (`lib/card-portfolio-albums.server.ts`): the Files photos the couple showed
-- (`event_supplier_photos_listed`) and the album photos that came through the
-- 7-day guest notice (`supplier_page_photo_notices`).
--
-- WHY A FUNCTION AND NOT A PLAIN SELECT FROM THE APP. A card's album is shown
-- as PROOF of its work, so a booking the supplier sits on both sides of must
-- not count — exactly the Card Record's rule. That rule is
-- `vendor_booking_is_arms_length`, which is internal (REVOKEd from every
-- browser role). Reading it here keeps ONE definition of "a real booking of
-- this card" shared with `service_card_records`, instead of a second,
-- hand-copied one in TypeScript.
--
-- A BOOKING OF A CARD (three shipped places say it; nothing new is stored):
--   1. `event_vendors.service_id` = the card                     ('booking')
--   2. a claimed multi-service lock: the card is in the token's
--      `vendor_service_ids` and the token's `claimed_event_vendor_id`
--      is the booking row                                         ('lock')
--   3. an ACCEPTED quote that names the card in `service_card_ids`
--      on an event where the same shop holds a booking of one of
--      its own cards — the quote's other cards are what Files files
--      photos under (DECISION_LOG 2026-11-12 "UPLOADS BELONG TO THE
--      QUOTED SERVICE")                                           ('quote')
-- …and in every case the booking row passes the Card Record's own filter:
-- booked status (`booked_event_vendor_statuses()`), not archived, not voided
-- for fraud, a live unarchived event, arm's length.
--
-- `delivered` = the booking row says the work was done (delivered/complete):
-- the drawing's "delivered · no photos" line for an album with no photo.
--
-- WHO MAY CALL IT: service_role only. It returns couples' event ids, which the
-- Card Record deliberately never does; the app calls it server-side, for cards
-- it has already proved are the shop's own (the edit sheet, Their work) or
-- that are live on a published shop (the couple's view), and draws only
-- type · venue · month — never an id, a name or a date.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.card_portfolio_booked_events(p_service_ids uuid[])
 RETURNS TABLE(vendor_service_id uuid, event_id uuid, delivered boolean, via text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_max_ids CONSTANT INTEGER := 200;
  v_ids UUID[];
BEGIN
  IF p_service_ids IS NULL
     OR COALESCE(array_length(p_service_ids, 1), 0) = 0
     OR array_length(p_service_ids, 1) > v_max_ids THEN
    RETURN;
  END IF;
  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(p_service_ids) AS x WHERE x IS NOT NULL);
  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH svc AS (
    SELECT vs.vendor_service_id AS sid, vs.vendor_profile_id AS vpid
      FROM public.vendor_services vs
     WHERE vs.vendor_service_id = ANY (v_ids)
  ),
  -- Every booking row of the shops those cards belong to that passes the
  -- Card Record's filter — the ONE definition of "a real booking".
  real_booking AS (
    SELECT ev.vendor_id AS ev_row, ev.event_id, ev.service_id, ev.status::TEXT AS status, s.vpid
      FROM svc s
      JOIN public.vendor_services own ON own.vendor_profile_id = s.vpid
      JOIN public.event_vendors ev ON ev.service_id = own.vendor_service_id
      JOIN public.events e ON e.event_id = ev.event_id
     WHERE ev.status::TEXT = ANY (public.booked_event_vendor_statuses())
       AND ev.archived_at IS NULL
       AND ev.voided_by_fraud = FALSE
       AND e.archived = FALSE
       AND public.vendor_booking_is_arms_length(s.vpid, ev.event_id, ev.vendor_id)
  ),
  pairs AS (
    -- 1 · the booking names the card
    SELECT b.service_id AS sid, b.event_id, b.status, 'booking'::TEXT AS via
      FROM real_booking b
     WHERE b.service_id = ANY (v_ids)
    UNION
    -- 2 · a claimed multi-service lock names the card
    SELECT s.sid, b.event_id, b.status, 'lock'::TEXT
      FROM svc s
      JOIN public.vendor_locked_qr_tokens t
        ON t.vendor_profile_id = s.vpid
       AND t.status = 'claimed'
       AND t.vendor_service_ids ? s.sid::TEXT
      JOIN real_booking b ON b.ev_row = t.claimed_event_vendor_id AND b.vpid = s.vpid
    UNION
    -- 3 · an accepted quote names the card, on an event this shop really booked
    SELECT s.sid, b.event_id, b.status, 'quote'::TEXT
      FROM svc s
      JOIN public.vendor_proposals p
        ON p.vendor_profile_id = s.vpid
       AND p.status::TEXT = 'accepted'
       AND p.service_card_ids @> jsonb_build_array(s.sid::TEXT)
      JOIN real_booking b ON b.event_id = p.event_id AND b.vpid = s.vpid
  )
  SELECT pr.sid, pr.event_id,
         bool_or(pr.status IN ('delivered', 'complete')),
         -- the strongest source names it: the booking, then the lock, then the quote
         (array_agg(pr.via ORDER BY CASE pr.via WHEN 'booking' THEN 0 WHEN 'lock' THEN 1 ELSE 2 END))[1]
    FROM pairs pr
   GROUP BY pr.sid, pr.event_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.card_portfolio_booked_events(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.card_portfolio_booked_events(uuid[]) TO service_role;

COMMENT ON FUNCTION public.card_portfolio_booked_events(uuid[]) IS
  'ONE ALBUM, TWO PLACES (DECISION_LOG 2026-10-08, frames 71–78): the (card, live event) pairs a shop''s cards were really booked on — event_vendors.service_id · a claimed lock''s vendor_service_ids · an accepted quote''s service_card_ids on an event the shop booked — under the Card Record''s own filter (booked status, unarchived, not fraud, arm''s length). Returns event ids, so service_role only; the app draws type · venue · month. No table: the photos are read by reference (event_supplier_photos_listed, supplier_page_photo_notices).';

COMMIT;
