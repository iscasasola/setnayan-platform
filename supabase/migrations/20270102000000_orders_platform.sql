-- 20270102000000_orders_platform.sql
--
-- WHY: stamp where an order originated — web vs the native iOS/Android app — so
-- /admin/payments can show it (companion to PR #1538 route-to-web). Existing
-- orders default to 'web' (they were all web). New orders are stamped by
-- submitOrderAction from the request platform (lib/request-platform.ts).
--
-- Idempotent. Additive — no data change for existing rows beyond the default.
-- NOT AUTO-APPLIED: owner runs `supabase db push --db-url "$SUPABASE_DB_URL"`.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_platform_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_platform_check
      CHECK (platform IN ('web', 'ios', 'android'));
  END IF;
END $$;

COMMENT ON COLUMN public.orders.platform IS
  'Originating platform of the order: web | ios | android. Stamped at creation by submitOrderAction from lib/request-platform.ts (SetnayanApp UA + setnayan-client-type cookie). Surfaced in /admin/payments.';

COMMIT;
