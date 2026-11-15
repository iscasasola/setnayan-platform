-- service_card_badge_holds_and_facts
-- Created via `pnpm migration:new`. Idempotent: CREATE TABLE IF NOT EXISTS · CREATE OR REPLACE FUNCTION. Writes NO data.
-- ============================================================================
-- 🏅 BADGE BUILD J3 — THE SERVICE-CARD BADGES (owner-approved prototypes 15 Nov:
-- specs prototypes/supplier_badges_2026-11-15/badge-milestones_v86 · badge-flow-walkthrough_v5).
--
-- Each service card earns up to five medals of its own, on Setnayan activity in the last 30 days, ON while true and
-- OFF the moment it is not: Hot Booking · Quick Responder · Trending Now · Rave Reviews · Generous Giver. (Setnayan
-- Verified is the SHOP's, read from the shop — never stored here.)
--
-- TWO OBJECTS, AND THE RULES ARE IN NEITHER:
--   · service_card_badge_facts(shop) — the raw numbers per card (bookings, couples, gifts, reviews, inquiries, reply
--     times). The thresholds live ONCE, in apps/web/lib/card-badges.ts, so the app and its tests read one rule.
--   · service_card_badge_settle(shop, passing) — remembers since when each card has held each badge (the "time
--     held" a medal shows) and answers which ones are NEW, exactly once, so the Today congratulations fires once.
--     A badge that stops passing is deleted: losing it resets the count (row 6419). ⚠ What a supplier is TOLD when a
--     card loses a badge is UNRULED — this only does what the design draws: the medal leaves the row, no notice.
--
-- ⚖ SOURCES AND THEIR LIMITS (said in the PR, never faked):
--   · a "paid booking" is the Card Record's own booked filter narrowed to PAID: status deposit_paid · delivered ·
--     complete, deposit recorded in the window, unarchived, not fraud, a live celebration, arm's length
--     (vendor_booking_is_arms_length). There is no refund status on event_vendors; a voided/archived row stops counting.
--   · an inquiry ABOUT A CARD is a thread_service_interests row naming that card. An interest that names only a
--     category (vendor_service_id NULL) belongs to no card and counts for none.
--   · a reply is per THREAD (chat_messages has no card): the shop's first own message (sender_role 'vendor', not a
--     bot) after the interest was raised. A thread asking about two cards answers both with one reply.
--   · an interest withdrawn is skipped — but there is no withdrawn-at time, so "withdrawn BEFORE the hour" cannot be
--     told from "withdrawn after": every withdrawn interest is skipped.
--   · a gift is a vendor_proposal_shop_gifts line on an ACCEPTED quote of that shop, on that event, naming that card.
--
-- 🔒 Both functions read and write other couples' events: SECURITY DEFINER, EXECUTE for service_role ONLY. The table
-- is service-role only too (RLS on, no policy, every grant revoked) — the app reads holds through settle.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_card_badge_holds (
  vendor_service_id UUID NOT NULL REFERENCES public.vendor_services (vendor_service_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles (vendor_profile_id) ON DELETE CASCADE,
  badge             TEXT NOT NULL CHECK (badge IN ('book', 'quick', 'trend', 'rave', 'gift')),
  held_since        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_service_id, badge)
);

ALTER TABLE public.service_card_badge_holds ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.service_card_badge_holds FROM PUBLIC;
REVOKE ALL ON public.service_card_badge_holds FROM anon;
REVOKE ALL ON public.service_card_badge_holds FROM authenticated;

CREATE INDEX IF NOT EXISTS service_card_badge_holds_shop_idx
  ON public.service_card_badge_holds (vendor_profile_id);

COMMENT ON TABLE public.service_card_badge_holds IS
  'Badge build J3 (owner prototypes 2026-11-15): since when each service card has held each card badge (book · quick · trend · rave · gift) — the medal''s "time held". A row exists only while the badge passes; losing it deletes the row, so the count resets. Written and read only by service_card_badge_settle (service_role). Setnayan Verified is the shop''s and is never stored here.';

-- ----------------------------------------------------------------------------
-- The raw numbers, per card of one shop. No thresholds here: apps/web/lib/card-badges.ts holds them.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.service_card_badge_facts(p_vendor_profile_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH shop AS (
    SELECT vp.vendor_profile_id AS vpid,
           vp.last_verified_at,
           (vp.fraud_suspended_at IS NULL AND vp.fraud_banned_at IS NULL) AS good_standing
      FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
  ),
  cards AS (
    SELECT vs.vendor_service_id AS id,
           (vs.is_active AND vs.taken_down_at IS NULL AND NOT vs.is_demo) AS published
      FROM public.vendor_services vs
      JOIN shop ON shop.vpid = vs.vendor_profile_id
  ),
  paid AS (
    SELECT ev.service_id AS id, ev.event_id, ev.vendor_id
      FROM public.event_vendors ev
      JOIN shop ON shop.vpid = ev.marketplace_vendor_id
      JOIN public.events e ON e.event_id = ev.event_id
     WHERE ev.service_id IN (SELECT id FROM cards)
       AND ev.status::TEXT IN ('deposit_paid', 'delivered', 'complete')
       AND ev.deposit_recorded_at >= NOW() - INTERVAL '30 days'
       AND ev.archived_at IS NULL
       AND ev.voided_by_fraud = FALSE
       AND e.archived = FALSE
       AND public.vendor_booking_is_arms_length(shop.vpid, ev.event_id, ev.vendor_id)
  ),
  paid_n AS (
    SELECT p.id,
           COUNT(*)::INT                  AS paid_bookings,
           COUNT(DISTINCT p.event_id)::INT AS paid_couples,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1
               FROM public.vendor_proposals pr
               JOIN public.vendor_proposal_shop_gifts g ON g.proposal_id = pr.proposal_id
              WHERE pr.event_id = p.event_id
                AND pr.vendor_profile_id = p_vendor_profile_id
                AND pr.status = 'accepted'
                AND COALESCE(pr.service_card_ids, '[]'::JSONB) ? p.id::TEXT
           ))::INT                         AS paid_with_gift
      FROM paid p
     GROUP BY p.id
  ),
  rev AS (
    SELECT r.service_id AS id, r.event_id, r.rating_overall
      FROM public.vendor_reviews r
     WHERE r.vendor_profile_id = p_vendor_profile_id
       AND r.service_id IN (SELECT id FROM cards)
       AND r.created_at >= NOW() - INTERVAL '30 days'
       AND r.voided_by_fraud = FALSE
       AND r.booked_through_setnayan = TRUE
  ),
  rev_n AS (
    SELECT x.id,
           SUM(LEAST(x.fives, 2))::INT AS five_star_capped,
           SUM(x.unders)::INT          AS under_four
      FROM (
        SELECT id, event_id,
               COUNT(*) FILTER (WHERE rating_overall = 5) AS fives,
               COUNT(*) FILTER (WHERE rating_overall < 4) AS unders
          FROM rev
         GROUP BY id, event_id
      ) x
     GROUP BY x.id
  ),
  asks AS (
    SELECT ti.vendor_service_id AS id, ti.thread_id, ti.created_at AS asked_at, ct.event_id,
           (ti.status = 'withdrawn') AS withdrawn
      FROM public.thread_service_interests ti
      JOIN public.chat_threads ct ON ct.thread_id = ti.thread_id
     WHERE ct.vendor_profile_id = p_vendor_profile_id
       AND ti.vendor_service_id IN (SELECT id FROM cards)
       AND ti.created_at >= NOW() - INTERVAL '60 days'
  ),
  trend_n AS (
    SELECT id,
           COUNT(DISTINCT event_id) FILTER (WHERE asked_at >= NOW() - INTERVAL '30 days')::INT AS couples_now,
           COUNT(DISTINCT event_id) FILTER (WHERE asked_at <  NOW() - INTERVAL '30 days')::INT AS couples_before
      FROM asks
     GROUP BY id
  ),
  replies AS (
    SELECT a.id,
           JSONB_AGG(JSONB_BUILD_OBJECT(
             'asked_at', a.asked_at,
             'replied_at', (
               SELECT MIN(m.created_at)
                 FROM public.chat_messages m
                WHERE m.thread_id = a.thread_id
                  AND m.sender_role::TEXT = 'vendor'
                  AND m.is_bot = FALSE
                  AND m.created_at >= a.asked_at
             ),
             'withdrawn', a.withdrawn
           ) ORDER BY a.asked_at) AS list
      FROM asks a
     WHERE a.asked_at >= NOW() - INTERVAL '30 days'
     GROUP BY a.id
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM shop) THEN NULL ELSE JSONB_BUILD_OBJECT(
    'verified_since', (SELECT last_verified_at FROM shop),
    'good_standing', (SELECT good_standing FROM shop),
    'cards', COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
               'id', c.id,
               'published', c.published,
               'paid_bookings', COALESCE(pn.paid_bookings, 0),
               'paid_couples', COALESCE(pn.paid_couples, 0),
               'paid_with_gift', COALESCE(pn.paid_with_gift, 0),
               'five_star_capped', COALESCE(rn.five_star_capped, 0),
               'under_four', COALESCE(rn.under_four, 0),
               'couples_now', COALESCE(tn.couples_now, 0),
               'couples_before', COALESCE(tn.couples_before, 0),
               'inquiries', COALESCE(rp.list, '[]'::JSONB)
             ))
        FROM cards c
        LEFT JOIN paid_n  pn ON pn.id = c.id
        LEFT JOIN rev_n   rn ON rn.id = c.id
        LEFT JOIN trend_n tn ON tn.id = c.id
        LEFT JOIN replies rp ON rp.id = c.id
    ), '[]'::JSONB)
  ) END;
$$;

COMMENT ON FUNCTION public.service_card_badge_facts(UUID) IS
  'Badge build J3: the raw 30-day numbers per service card of one shop (paid bookings · distinct couples · bookings with a shop gift · five-star reviews capped at 2 per event · reviews under 4 · distinct inquiring couples now and the 30 days before · each inquiry''s asked/replied time). No thresholds — apps/web/lib/card-badges.ts decides. NULL when the shop does not exist (a failed read, never zero). Reads other couples'' events: service_role only.';

REVOKE ALL ON FUNCTION public.service_card_badge_facts(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_card_badge_facts(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.service_card_badge_facts(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_badge_facts(UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- Remember what passes now; forget what does not; say which are new — once.
-- p_passing: [{"card":"<vendor_service_id>","badge":"book"}, …] — the app's verdict. Cards not of this shop are ignored.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.service_card_badge_settle(p_vendor_profile_id UUID, p_passing JSONB)
RETURNS TABLE (vendor_service_id UUID, badge TEXT, held_since TIMESTAMPTZ, is_new BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _scb_pass (card UUID, badge TEXT) ON COMMIT DROP;
  TRUNCATE _scb_pass;
  INSERT INTO _scb_pass (card, badge)
  SELECT DISTINCT (x->>'card')::UUID, x->>'badge'
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(p_passing, '[]'::JSONB)) x
    JOIN public.vendor_services vs
      ON vs.vendor_service_id = (x->>'card')::UUID
     AND vs.vendor_profile_id = p_vendor_profile_id
   WHERE x->>'badge' IN ('book', 'quick', 'trend', 'rave', 'gift');

  -- Off the moment it is not true: the row goes, so a later return starts the count again.
  DELETE FROM public.service_card_badge_holds h
   WHERE h.vendor_profile_id = p_vendor_profile_id
     AND NOT EXISTS (SELECT 1 FROM _scb_pass p WHERE p.card = h.vendor_service_id AND p.badge = h.badge);

  -- New holds: ON CONFLICT DO NOTHING makes ONE caller the winner, so a badge is announced once.
  RETURN QUERY
  WITH ins AS (
    INSERT INTO public.service_card_badge_holds AS t (vendor_service_id, vendor_profile_id, badge)
    SELECT p.card, p_vendor_profile_id, p.badge FROM _scb_pass p
    ON CONFLICT ON CONSTRAINT service_card_badge_holds_pkey DO NOTHING
    RETURNING t.vendor_service_id, t.badge, t.held_since
  )
  SELECT i.vendor_service_id, i.badge, i.held_since, TRUE FROM ins i
  UNION ALL
  SELECT h.vendor_service_id, h.badge, h.held_since, FALSE
    FROM public.service_card_badge_holds h
   WHERE h.vendor_profile_id = p_vendor_profile_id
     AND NOT EXISTS (SELECT 1 FROM ins i WHERE i.vendor_service_id = h.vendor_service_id AND i.badge = h.badge);
END;
$$;

COMMENT ON FUNCTION public.service_card_badge_settle(UUID, JSONB) IS
  'Badge build J3: given the app''s verdict (the card badges passing now), deletes every hold of this shop no longer passing (the count resets), inserts the new ones, and returns every hold with held_since and is_new — is_new is TRUE for exactly one caller per earning (ON CONFLICT DO NOTHING), which sends the one card_badge_earned notice. Cards of another shop are ignored. service_role only.';

REVOKE ALL ON FUNCTION public.service_card_badge_settle(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_card_badge_settle(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.service_card_badge_settle(UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_badge_settle(UUID, JSONB) TO service_role;
