-- plan_gift_ending_notice_type
-- Created via `pnpm migration:new`. Idempotent; ADDS only.
--
-- 🔔 A GIFTED SUPPLIER PLAN SAYS "ENDS SOON" 7 DAYS BEFORE AND AGAIN 1 DAY BEFORE (owner 14 Nov 2026, DECISION_LOG):
-- an in-app notice + email at each stage, one "Stay on <plan>" button, the end date in words. Sent by the fleet-wide,
-- cron-free sweep `maybeSweepPlanGiftEndingNotices` (lib/setnayan-shop-gift.server.ts).
--
--   1 · the notification type (its own statement — a new enum value cannot be used in the transaction that adds it);
--   2 · two stamps on the gift row, each set ONCE (only while NULL) by the sweep's conditional UPDATE, so a stage is
--       sent exactly once whatever runs at the same time.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_plan_gift_ending';

ALTER TABLE public.setnayan_shop_gifts
  ADD COLUMN IF NOT EXISTS ends_soon_7_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_soon_1_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.setnayan_shop_gifts.ends_soon_7_sent_at IS
  'When the 7-day "ends soon" notice + email went (set once, while NULL). Also stamped with the 1-day stage when a gift is first seen inside its last day.';
COMMENT ON COLUMN public.setnayan_shop_gifts.ends_soon_1_sent_at IS
  'When the 1-day "ends soon" notice + email went (set once, while NULL).';
