-- ============================================================================
-- 20260602000000_orders_lapsed_status_and_expires_at.sql
-- Task #23 — PILOT BLOCKER · subscription expiry sweep for non-Concierge SKUs.
--
-- Context. Task #10 stress-test agent discovered that `apps/web/lib/sku-catalog.ts`
-- marks 12 SKUs as `subscription: true` (vendor_pro_weekly · panood_annual_streaming ·
-- panood_annual_streaming_plus · all_tools_unlock_annual · tool_*_weekly × 5 ·
-- sponsored_boost_annual_30km · papic_cam_bridge_all_slots_annual ·
-- vendor_verification_annual_renewal) but ONLY `concierge_complete` has working
-- expiry-sweep code (lib/concierge.ts:121-138 sweepExpiredConcierge). At pilot,
-- every non-Concierge subscription stays at orders.status='paid' indefinitely
-- after expiry — silent revenue + UX bug.
--
-- This migration:
--   1. Extends `public.order_status` enum with `'lapsed'` (subscription
--      expired naturally, distinct from `fulfilled` = service delivered).
--      Lapsed is terminal but does NOT trigger a refund (refunds use the
--      pre-existing `refunded` status).
--   2. Adds `orders.expires_at TIMESTAMPTZ NULL` so the sweep query can do
--      a single index-friendly WHERE `expires_at < NOW()`. NULL on non-
--      subscription orders.
--   3. Adds a partial index on (status, expires_at) WHERE status='paid' AND
--      expires_at IS NOT NULL — keeps the hot-path sweep cheap even at
--      pilot scale.
--   4. Backfills existing `paid` subscription orders with a derived
--      expires_at = updated_at + interval (1 day for `unit='day'` /
--      7 days for `unit='week'` / etc). The stress test scenario S2/S3
--      previously backdated created_at to fake expiry; that approach
--      still works because the sweep reads expires_at, which the new
--      app-side activate path will populate at insert time.
--
-- Per [[reference_setnayan_cron_strategy]] NO new cron triggers. Sweep
-- runs lazily on page loaders (mirroring Concierge's wiring at
-- apps/web/app/dashboard/[eventId]/page.tsx:147).
--
-- Source of truth: CLAUDE.md 2026-05-22 row (Task #10 finding) ·
-- HANDOFF_2026-05-17 § Engineering gap.
--
-- Idempotent. No drops. Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Extend order_status enum with 'lapsed'.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'lapsed'
      AND enumtypid = 'public.order_status'::regtype
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'lapsed';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. orders.expires_at column.
-- ----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.expires_at IS
  'Subscription expiry timestamp. NULL on non-subscription SKUs. Set at order activation by app code. Sweep flips status paid → lapsed when expires_at < NOW(). See apps/web/lib/subscriptions.ts.';

-- ----------------------------------------------------------------------------
-- 3. Partial index — hot path for the sweep.
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS orders_subscription_expiry_idx
  ON public.orders (expires_at)
  WHERE status = 'paid' AND expires_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. Backfill — populate expires_at for existing paid subscription orders.
--
-- Derive duration from service_key (the SKU code). Mirrors the TS expiry
-- map in apps/web/lib/subscriptions.ts. If the backfill misses any rows
-- (e.g. a SKU added after this migration shipped), the next purchase via
-- the app code will populate expires_at correctly; only legacy rows
-- predating this migration ever risk staying NULL.
-- ----------------------------------------------------------------------------

UPDATE public.orders SET expires_at = updated_at + interval '7 days'
WHERE status = 'paid'
  AND expires_at IS NULL
  AND service_key IN (
    'vendor_pro_weekly',
    'tool_mood_board_weekly',
    'tool_seat_arrangement_weekly',
    'tool_palette_weekly',
    'tool_qr_reader_weekly',
    'tool_advanced_pricing_weekly'
  );

UPDATE public.orders SET expires_at = updated_at + interval '90 days'
WHERE status = 'paid'
  AND expires_at IS NULL
  AND service_key = 'sponsored_boost_quarterly_30km';

UPDATE public.orders SET expires_at = updated_at + interval '365 days'
WHERE status = 'paid'
  AND expires_at IS NULL
  AND service_key IN (
    'panood_annual_streaming',
    'panood_annual_streaming_plus',
    'all_tools_unlock_annual',
    'papic_cam_bridge_all_slots_annual',
    'sponsored_boost_annual_30km',
    'vendor_verification_annual_renewal'
  );

COMMIT;
