-- ============================================================================
-- EVENT ULTRA — ₱9,990, one-time per event (owner, 2026-11-13)
-- ============================================================================
--
-- ⚖ DECISION_LOG 2026-11-13, newest wins:
--   · "EVENT ULTRA APPROVED — BUILD IT (₱9,990 · 3,500 credits · six self-serve items)"
--     Owner, verbatim: *"yes update it. including the rest of the details in the app
--     and documentation. keep those prices."*
--   · "PAPIC CREDITS FINAL: EVENT PLUS 1,000 · EVENT PRO 2,000 · EVENT ULTRA 3,500"
--   · "EVENT ULTRA (PROPOSED PLAN) — ONLY SERVICES THAT RUN THEMSELVES"
--
-- Ultra = everything in Event Pro + Live Watch (self-run LIVE_STUDIO, 1 day) +
-- full-size originals kept 12 months after the event's last day (instead of 3) +
-- canvas prints + Patiktok + 3,500 Papic credits. The app grants Pro / Live Watch /
-- Patiktok through `SKU_OWNERSHIP_ALIASES` (lib/entitlements.ts) — read side only,
-- so no order row is ever written for the parts.
--
-- This file is the ONLY place these figures are typed. Product code reads the row.
-- Plus / Pro credits are NOT touched here (PR #7598 sets them).
--
-- ALTER before INSERT/UPDATE (memory "ALTER before UPDATE in one migration").
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- ============================================================================

BEGIN;

-- ── 0 · fullres_extra_keep_days (ALTER first) ───────────────────────────────
-- Days ADDED to the standard full-size hold (FULL_RES_POST_EVENT_GRACE_DAYS = 92,
-- lib/papic-fullres-drop-core.ts) for an event that holds this product, paid.
-- NULL / 0 = no extra hold. Can only ever KEEP originals longer: the clock below
-- adds it, never subtracts it.
ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS fullres_extra_keep_days INTEGER;
ALTER TABLE public.platform_retail_catalog_v2
  DROP CONSTRAINT IF EXISTS platform_retail_catalog_v2_fullres_extra_keep_days_nonneg;
ALTER TABLE public.platform_retail_catalog_v2
  ADD CONSTRAINT platform_retail_catalog_v2_fullres_extra_keep_days_nonneg
  CHECK (fullres_extra_keep_days IS NULL OR fullres_extra_keep_days >= 0);
COMMENT ON COLUMN public.platform_retail_catalog_v2.fullres_extra_keep_days IS
  'Extra days an event that holds this product (paid/fulfilled order) keeps its full-size Papic originals, ON TOP of the standard 92 days after the event''s last day. Event Ultra: 274 (92 + 274 = 366 days ≈ 12 months, owner 2026-11-13). Read by papic_events_past_fullres_clock; can only keep files longer. Admin-managed.';

-- ── 1 · the Event Ultra row ─────────────────────────────────────────────────
-- saas_overhead_cost_php is NOT NULL: copied from Event Pro's row (Ultra carries at
-- least Pro's running cost). Live Watch's real streaming cost is still unrecorded
-- (its own row says 0) — the owner sets the real figure in Admin › Pricing.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, onboarding_price_php,
   saas_overhead_cost_php, description, is_active, billing_period,
   is_pax_priced, is_token_able, included_papic_credits, fullres_extra_keep_days)
SELECT 'EVENT_ULTRA', 'Event Ultra', 9990.00, NULL,
       COALESCE((SELECT saas_overhead_cost_php FROM public.platform_retail_catalog_v2
                  WHERE service_code = 'COUPLE_WEBSITE_PRO'), 0),
       'Everything in Event Pro, plus Live Watch for one day, your full-size photos kept 12 months, canvas prints, Patiktok and 3,500 Papic credits.',
       TRUE, 'one_time', FALSE, FALSE, 3500, 274
ON CONFLICT (service_code) DO UPDATE
   SET title                   = EXCLUDED.title,
       retail_price_php        = EXCLUDED.retail_price_php,
       onboarding_price_php    = NULL,
       description             = EXCLUDED.description,
       is_active               = TRUE,
       retired_at              = NULL,
       billing_period          = 'one_time',
       included_papic_credits  = EXCLUDED.included_papic_credits,
       fullres_extra_keep_days = EXCLUDED.fullres_extra_keep_days,
       updated_at              = NOW();

-- ── 2 · the full-size clock honours a paid plan's extra hold ─────────────────
-- Same signature, same body as 20271126998711, plus ONE term: the event's
-- post-event floor is pushed out by the largest `fullres_extra_keep_days` of any
-- product it holds in a paid/fulfilled order. COALESCE(…, 0) — no paid plan, no
-- change. The warn job (lib/daily-email-jobs.ts) calls this same function with the
-- lead pulled back, so it follows with no edit.
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
           COALESCE((
             SELECT MAX(GREATEST(c.fullres_extra_keep_days, 0))
               FROM public.orders o
               JOIN public.platform_retail_catalog_v2 c ON c.service_code = o.service_key
              WHERE o.event_id = e.event_id
                AND o.status IN ('paid', 'fulfilled')
           ), 0) AS extra_keep_days
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
  'Events whose full-res originals may be replaced by their compressed copy: never sooner than N days after the event''s LAST day (event_end_date when the celebration spans several days, else event_date), plus the largest fullres_extra_keep_days of any product the event holds in a paid/fulfilled order (Event Ultra: 12 months in all, owner 2026-11-13). The extra term can only keep files longer.';

REVOKE ALL ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER)
  TO service_role;

COMMIT;
