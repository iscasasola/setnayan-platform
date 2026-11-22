-- ============================================================================
-- EVENT SERVICES — the two singles go on sale, and a plan bought inside ONE
-- Event services order keeps its photos as long as a plan bought on its own
-- (owner, 2026-11-23)
-- ============================================================================
--
-- ⚖ DECISION_LOG 2026-11-23, newest wins:
--   · "EVENT PLANS ARE PACKAGES; SINGLES ARE THE SECOND CHOICE — OWNER PRICES:
--     EVENT HUB ₱2,790 · SETNAYAN AI ₱2,790 · LIVE WATCH ₱3,990."
--     Owner, verbatim: *"so there is a separate price for setnayan AI 2790"* ·
--     *"Event Hub unlock 2790"*.
--   · "EVENT SERVICES v4 — APPROVED TO BUILD (owner: "Yes, build it")":
--     SETNAYAN_AI 2,790 back on sale, new Event Hub single 2,790.
--
-- NOT HERE, ON PURPOSE:
--   · Live Watch ₱3,990 — the owner sets it in Admin › Pricing (the 23 Nov row:
--     "Live Watch 3,990 is set by the owner in Admin once #8177 is live").
--   · `setnayan_ai_per_event_pricing_enabled` — left as it is. With it ON the
--     charge authority prices Setnayan AI by the event's type
--     (lib/order-charge-authority.ts step 3), and the same switch also decides
--     how a PAID AI stays on (`isSetnayanAiActiveForEvent`). Flipping it from a
--     migration could switch AI off for events that paid for it. The Event
--     services page quotes every single through that same authority, so the
--     screen and the charge never disagree. Making ₱2,790 the price for every
--     event type is the owner's call (Admin › Pricing tier rows), asked in the PR.
--
-- This file is the ONLY place these figures are typed. Product code reads the row.
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- KEEP IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── 1 · Setnayan AI back on sale ────────────────────────────────────────────
-- Retired 2026-11-05 at ₱3,300 ("Setnayan AI is not sold separately"). On sale
-- again at the owner's ₱2,790. The retirement stamps are cleared so the row reads
-- as live everywhere (`fetchV2CustomerCatalog` filters on is_active).
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php    = 2790.00,
       is_active           = TRUE,
       retired_at          = NULL,
       retired_by_admin_id = NULL,
       retirement_reason   = NULL,
       updated_at          = NOW()
 WHERE service_code = 'SETNAYAN_AI'
   AND (retail_price_php IS DISTINCT FROM 2790.00 OR is_active IS DISTINCT FROM TRUE OR retired_at IS NOT NULL);

-- ── 2 · the Event Hub single (new) ──────────────────────────────────────────
-- Unlocks what Event Plus unlocks, minus Plus's Papic credits: every theme and
-- every part of the Event Hub to design. The app reads it as the whole Hub
-- (`eventHubOwnership`, lib/couple-website-pro.ts) and through the Hub's own
-- ownership aliases (`SKU_OWNERSHIP_ALIASES`, lib/entitlements.ts). No credits,
-- no extra photo hold.
-- saas_overhead_cost_php is NOT NULL: copied from Event Plus's row (the Hub is
-- most of what Plus runs). The owner sets the real figure in Admin › Pricing.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, onboarding_price_php,
   saas_overhead_cost_php, description, is_active, billing_period,
   is_pax_priced, is_token_able, included_papic_credits, fullres_extra_keep_days)
SELECT 'EVENT_HUB', 'Event Hub', 2790.00, NULL,
       COALESCE((SELECT saas_overhead_cost_php FROM public.platform_retail_catalog_v2
                  WHERE service_code = 'EVENT_PLUS'), 0),
       'Every theme, every part to design — the whole Event Hub for this event.',
       TRUE, 'one_time', FALSE, FALSE, NULL, NULL
ON CONFLICT (service_code) DO NOTHING;

-- ── 3 · a plan inside one Event services order keeps its photos as long ─────
-- The Event services page sells a plan, singles and photos as ONE order (a basket:
-- `orders.service_key = 'EVENT_SERVICES'`, its lines in `onboarding_order_items`,
-- the same one-bill table the sign-up basket uses). The full-size clock read only
-- `orders.service_key`, so an Event Ultra or Event Pro bought on that bill would
-- have kept its originals only the standard 92 days. Same signature, same body as
-- 20271348181787, plus ONE term: the largest `fullres_extra_keep_days` of any line
-- on a paid/fulfilled basket of this event. It can only keep files longer.
CREATE OR REPLACE FUNCTION public.papic_events_past_fullres_clock(
  p_retention_days  INTEGER,
  p_post_event_days INTEGER
) RETURNS TABLE (event_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_use AS (
    SELECT e.event_id,
           LEAST(
             COALESCE((SELECT MIN(p.captured_at) FROM public.papic_photos p
                        WHERE p.event_id = e.event_id), 'infinity'::timestamptz),
             COALESCE((SELECT MIN(g.captured_at) FROM public.papic_guest_captures g
                        WHERE g.event_id = e.event_id), 'infinity'::timestamptz)
           ) AS started_at,
           GREATEST(COALESCE(e.event_end_date, e.event_date), e.event_date) AS event_last_day,
           -- 💎 Event Ultra (owner 2026-11-13): a paid plan may hold originals longer.
           GREATEST(
             COALESCE((
               SELECT MAX(GREATEST(c.fullres_extra_keep_days, 0))
                 FROM public.orders o
                 JOIN public.platform_retail_catalog_v2 c ON c.service_code = o.service_key
                WHERE o.event_id = e.event_id
                  AND o.status IN ('paid', 'fulfilled')
             ), 0),
             -- 🛒 …or the plan is a LINE of one paid bill (Event services, 2026-11-23; the sign-up basket too).
             COALESCE((
               SELECT MAX(GREATEST(c.fullres_extra_keep_days, 0))
                 FROM public.orders o
                 JOIN public.onboarding_order_items i ON i.order_id = o.order_id
                 JOIN public.platform_retail_catalog_v2 c ON c.service_code = i.service_code
                WHERE o.event_id = e.event_id
                  AND o.status IN ('paid', 'fulfilled')
             ), 0),
             -- 🎁 …or a SUPPLIER GAVE it (owner 2026-11-15: a gifted Event Ultra is FULL Ultra). ONLY the
             -- shop-gift delivery source — a 'given' row carrying `unlocks_sku`. An admin comp does NOT extend
             -- the hold (owner 2026-11-15: "keep them at 3 months"). The days are still the catalogue row's.
             COALESCE((
               SELECT MAX(GREATEST(c.fullres_extra_keep_days, 0))
                 FROM public.shop_gift_stock_entries g
                 JOIN public.platform_retail_catalog_v2 c ON c.service_code = g.unlocks_sku
                WHERE g.event_id = e.event_id
                  AND g.kind = 'given'
                  AND g.unlocks_sku IS NOT NULL
             ), 0)
           ) AS extra_keep_days
      FROM public.events e
  )
  SELECT f.event_id
    FROM first_use f
   WHERE f.started_at <> 'infinity'::timestamptz
     AND NOW() >= f.started_at + make_interval(days => GREATEST(p_retention_days, 0))
     AND (
       f.event_last_day IS NULL
       OR NOW() >= (f.event_last_day::timestamptz
                    + make_interval(days => GREATEST(p_post_event_days, 0) + f.extra_keep_days))
     );
$$;

COMMENT ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER) IS
  'Events whose full-res originals may be replaced by their compressed copy: never sooner than N days after the event''s LAST day (event_end_date when the celebration spans several days, else event_date), plus the largest fullres_extra_keep_days of any product the event holds in a paid/fulfilled order — directly, as a LINE of a paid bill (onboarding_order_items: the Event services order and the sign-up basket, 2026-11-23), or as a SUPPLIER GIFT delivered to it (a given shop_gift_stock_entries row''s unlocks_sku; admin comps keep the plain hold, owner 2026-11-15). The extra term can only keep files longer.';

REVOKE ALL ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER)
  TO service_role;

COMMIT;
