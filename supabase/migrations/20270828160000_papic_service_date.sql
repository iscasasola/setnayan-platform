-- Papic One — the couple picks the SERVICE DATE, and the pass stops being permanent.
-- Corpus: 0012_papic/Papic_Pricing_Lock_2026-07-20.md § 2.3 (owner 2026-07-21).
--
-- ── THE HOLE THIS CLOSES ─────────────────────────────────────────────────
-- eventPapicGuestActive() is today a pure OWNERSHIP check —
-- eventSkuActive(event, 'PAPIC_GUEST'). There is NO date dimension anywhere, so
-- one purchase leaves every guest's camera live from admin approval onward,
-- FOREVER. Nobody chose that: it is a storage and consent exposure that simply
-- fell out of the pass never having had a window.
--
-- ── THE MODEL (owner 2026-07-21) ────────────────────────────────────────
-- A couple picks the DATE OF THE SERVICE when they buy. Buying several passes
-- covers several dates — pre-nup, ceremony, after-party. Every capture from
-- every date still lands in ONE album (the wedding), which needs no work: photos
-- key to event_id, never to a purchase.
--
-- POINTS STAY POOLED — one wedding purse across all dates. The date controls
-- WHEN cameras work, not how points are partitioned. That keeps the fail-closed
-- reserve RPC untouched (money code), matches the one-album mental model, and
-- lets a quiet pre-nup leave more for the reception. The accepted trade: a busy
-- day can eat into a later date's budget. The top-up is uncapped, so the
-- recovery path exists — but it is PRE-EVENT only, so the checkout arithmetic
-- carries the warning.
--
-- ── NULL = UNSCOPED = ALWAYS ON ─────────────────────────────────────────
-- Both columns are NULLABLE and nothing is backfilled. A NULL service_date means
-- "not date-scoped" and keeps the legacy always-on behaviour, so the single
-- historical PAPIC_GUEST order (2026-06-08) and any comp grant are unaffected.
-- Only purchases that CHOOSE a date get fenced by one. No grandfathering clause
-- is needed and none should be written.

-- ---- 1. the chosen date, captured at purchase ----------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_date DATE;

COMMENT ON COLUMN public.orders.service_date IS
  'Optional date the purchased service is FOR (not when it was bought). Papic One '
  'uses it to scope which day the event''s guest cameras are live; a couple buying '
  'several passes covers several dates. NULL = not date-scoped (legacy / always-on). '
  'Generic by design — any dated service may adopt it.';

-- ---- 2. carried onto the grant at activation -----------------------------
-- Denormalised deliberately: the gate reads grants (already the per-purchase
-- record and the thing the pool sums), so copying the date here keeps the
-- date check a single-table read on a hot path, and keeps a refund reversal
-- (DELETE by order_id) removing the date window with the points.

ALTER TABLE public.papic_event_point_grants
  ADD COLUMN IF NOT EXISTS service_date DATE;

COMMENT ON COLUMN public.papic_event_point_grants.service_date IS
  'The date this grant''s cameras are live, copied from orders.service_date at '
  'activation. NULL = unscoped (always on) — legacy grants and admin comps. Points '
  'are NOT partitioned by date: the event pool stays one purse and this column '
  'gates only WHEN capture is open. See lib/papic-guest.ts.';

CREATE INDEX IF NOT EXISTS papic_event_point_grants_event_date_idx
  ON public.papic_event_point_grants(event_id, service_date);

-- ---- 3. post-conditions --------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='service_date'
  ) THEN
    RAISE EXCEPTION 'orders.service_date was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='papic_event_point_grants'
      AND column_name='service_date'
  ) THEN
    RAISE EXCEPTION 'papic_event_point_grants.service_date was not created';
  END IF;

  -- Nothing may have been silently backfilled: every pre-existing grant must
  -- stay unscoped, or a live event would lose its cameras.
  IF EXISTS (
    SELECT 1 FROM public.papic_event_point_grants
    WHERE service_date IS NOT NULL AND created_at < NOW() - INTERVAL '1 minute'
  ) THEN
    RAISE EXCEPTION 'pre-existing grants were date-scoped — legacy passes must stay always-on';
  END IF;
END $$;
