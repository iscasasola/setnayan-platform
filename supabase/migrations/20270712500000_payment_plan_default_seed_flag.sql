-- Payment-plan default-seed flag.
--
-- When a couple locks a MARKETPLACE vendor that carries a booking total but
-- never configured a payment schedule (vendor_service_payment_schedules),
-- finalizeVendor now seeds a 50/50 ESTIMATED plan instead of leaving the couple
-- with an empty plan / silent "pay the vendor directly" fallback. This flag
-- marks such plans so the couple's workspace can label them "estimated — confirm
-- with your vendor" and the vendor can still override with a real schedule on
-- a re-lock (the upsert always rewrites this column).
--
-- Additive + backfill-safe: existing rows default to FALSE (they were either a
-- real vendor schedule or a genuine no-schedule direct-pay booking).

ALTER TABLE public.event_vendor_payment_plan
  ADD COLUMN IF NOT EXISTS is_default_seeded BOOLEAN NOT NULL DEFAULT FALSE;
