-- graphs_open_at_bronze
--
-- J5 · each badge's graphs open at that badge's Bronze (owner 15 Nov; contract
-- Setnayan-specs prototypes/supplier_badges_2026-11-15/badge-unlock_v6.html: "each badge's Bronze opens the graphs
-- about its own area … never greyed out" · "Shops that already see graphs today keep them (owner: 'Yes')").
--
-- Three objects, all ADDED (nothing dropped, nothing tightened):
--
--   1. public.vendor_graph_unlocks_kept — THE KEEP-WHAT-YOU-HAD MARKER. One row per shop that already saw the graphs
--      when graphs moved behind Bronze. Today every Verified shop sees every graph (lib/locks.ts `analytics` opens on
--      Verified), so the row is written ONCE, here, for every shop Verified at the moment this migration applies.
--      ⚠ This backfill is the only data this migration writes, and it is the marker itself: without it a Verified
--      shop below Bronze would lose graphs it sees today. A shop verified LATER gets no row and opens graphs by badge.
--      Nothing else ever writes the table (no INSERT/UPDATE/DELETE grant to any client role).
--
--   2. public.shop_graph_unlock_facts(shop) — the two facts the unlock adapter (apps/web/lib/graph-unlocks.ts) needs
--      that main does not already read, in ONE call: the marker, and the badge steps the shop has EVER earned
--      (`shop_badge_rewards`, written exactly once per step, never on a dip) — so a Bronze once earned keeps its graphs
--      when a count later falls (owner: "keep what you had"). No count is derived here: every badge count is main's own
--      counter (shop_trusted_five_star_count · shop_gift_points · shop_trusted_by_count, read by badge-rewards.server.ts).
--
--   3. public.shop_gifts_to_bookings(shop, since, booked statuses) — the "Gifts given → bookings" graph: of the couples
--      who asked the shop since `since` (chat_threads, the Asked graph's own source), how many were offered a gift in
--      the shop's quote and how many booked (event_vendors in the statuses the CALLER passes — the app's one list,
--      BOOKED_EVENT_VENDOR_STATUSES, never a second copy typed here), plus the shop's free gift stock, which the
--      graph's recommendation needs. Read only when the Gifts given badge has opened the graph.
--
-- Both functions are SECURITY DEFINER, service_role only: the page resolves the shop from the session first and reads
-- with the admin client, as readShopTrackerFacts already does. Each returns NULL for a shop that does not exist.

BEGIN;

-- ── 1 · the keep marker ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_graph_unlocks_kept (
  vendor_profile_id UUID PRIMARY KEY
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  kept_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vendor_graph_unlocks_kept ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vendor_graph_unlocks_kept FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vendor_graph_unlocks_kept TO authenticated;
GRANT ALL ON TABLE public.vendor_graph_unlocks_kept TO service_role;

-- A shop reads its own marker; an admin reads all. Nobody writes it through PostgREST.
DROP POLICY IF EXISTS vendor_graph_unlocks_kept_own_read ON public.vendor_graph_unlocks_kept;
CREATE POLICY vendor_graph_unlocks_kept_own_read ON public.vendor_graph_unlocks_kept
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids()) OR (SELECT public.is_admin()));

COMMENT ON TABLE public.vendor_graph_unlocks_kept IS
  'J5 keep-what-you-had marker (owner 15 Nov, badge-unlock_v6: "Shops that already see graphs today keep them"). One '
  'row per shop Verified when graphs moved behind each badge''s Bronze; such a shop keeps every graph it saw. Written '
  'once by migration 20271348267938; no client role may write it.';

-- The one-time backfill: every shop that sees the graphs today. Re-applying adds nothing (ON CONFLICT).
INSERT INTO public.vendor_graph_unlocks_kept (vendor_profile_id)
SELECT vp.vendor_profile_id
  FROM public.vendor_profiles vp
 WHERE vp.public_visibility = 'verified'
ON CONFLICT (vendor_profile_id) DO NOTHING;

-- ── 2 · the unlock facts ───────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_graph_unlock_facts(p_vendor_profile_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'kept', EXISTS (SELECT 1 FROM public.vendor_graph_unlocks_kept k
                            WHERE k.vendor_profile_id = vp.vendor_profile_id),
           'earned', COALESCE((SELECT jsonb_agg(r.reward_key ORDER BY r.reward_key)
                                 FROM public.shop_badge_rewards r
                                WHERE r.vendor_profile_id = vp.vendor_profile_id
                                  AND r.revoked_at IS NULL), '[]'::jsonb)
         )
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id;
$$;

REVOKE ALL ON FUNCTION public.shop_graph_unlock_facts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_graph_unlock_facts(UUID) TO service_role;

COMMENT ON FUNCTION public.shop_graph_unlock_facts(UUID) IS
  'J5: what decides which graphs a shop sees beside main''s badge counters, in one call — kept '
  '(vendor_graph_unlocks_kept) and earned (every unrevoked shop_badge_rewards key). service_role only; NULL for an '
  'unknown shop.';

-- ── 3 · gifts → bookings ───────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_gifts_to_bookings(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ,
  p_booked_statuses   TEXT[]
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH asked AS (
    SELECT DISTINCT ct.event_id
      FROM public.chat_threads ct
     WHERE ct.vendor_profile_id = p_vendor_profile_id
       AND ct.event_id IS NOT NULL
       AND ct.created_at >= p_since
  ),
  marked AS (
    SELECT a.event_id,
           (EXISTS (
             SELECT 1
               FROM public.vendor_proposals p
               JOIN public.vendor_proposal_shop_gifts g ON g.proposal_id = p.proposal_id
              WHERE p.vendor_profile_id = p_vendor_profile_id
                AND p.event_id = a.event_id
           ) OR EXISTS (
             SELECT 1 FROM public.shop_gift_stock_entries e
              WHERE e.vendor_profile_id = p_vendor_profile_id
                AND e.event_id = a.event_id
                AND e.kind = 'given'
           )) AS gifted,
           EXISTS (
             SELECT 1 FROM public.event_vendors ev
              WHERE ev.event_id = a.event_id
                AND ev.marketplace_vendor_id = p_vendor_profile_id
                AND ev.status::text = ANY (p_booked_statuses)
           ) AS booked
      FROM asked a
  )
  SELECT jsonb_build_object(
           'gifted_booked',   (SELECT count(*) FROM marked WHERE gifted AND booked),
           'gifted_deciding', (SELECT count(*) FROM marked WHERE gifted AND NOT booked),
           'plain_booked',    (SELECT count(*) FROM marked WHERE NOT gifted AND booked),
           'plain_deciding',  (SELECT count(*) FROM marked WHERE NOT gifted AND NOT booked),
           'free_stock',      (SELECT COALESCE(SUM(GREATEST(0, s.balance - s.held)), 0)
                                 FROM public.shop_gift_stock_status(vp.vendor_profile_id) s)
         )
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id;
$$;

REVOKE ALL ON FUNCTION public.shop_gifts_to_bookings(UUID, TIMESTAMPTZ, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gifts_to_bookings(UUID, TIMESTAMPTZ, TEXT[]) TO service_role;

COMMENT ON FUNCTION public.shop_gifts_to_bookings(UUID, TIMESTAMPTZ, TEXT[]) IS
  'J5 "Gifts given → bookings" graph: couples who asked since p_since (chat_threads), split by offered a gift (a quote '
  'gift line or a given stock entry) × booked (event_vendors in the caller''s booked statuses), plus free gift stock '
  '(shop_gift_stock_status). service_role only; NULL for an unknown shop.';

COMMIT;
