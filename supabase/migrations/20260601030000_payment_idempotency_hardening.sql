-- ============================================================================
-- 20260601030000_payment_idempotency_hardening.sql
-- Task 8 — payment idempotency hardening before 2026-06-01 pilot launch.
--
-- Adds:
--   (1) payments.client_idempotency_key TEXT — optional UUID the customer's
--       upload form sends; partial unique index keys it per (order_id, key)
--       so a retried submit returns the existing row instead of a duplicate.
--
-- The state-machine guards (admin approve/reject only flips status when it
-- was 'pending') are enforced in the server actions in this same PR via
--   .update(...).eq('payment_id', X).eq('status', 'pending')
-- so the schema doesn't need a CHECK or trigger for that — the conditional
-- WHERE clause makes the second admin's call a no-op (zero rows returned).
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS client_idempotency_key TEXT;

-- Partial unique index — NULL keys (legacy / un-migrated forms) don't collide,
-- only forms that supply an explicit key get dedup protection.
CREATE UNIQUE INDEX IF NOT EXISTS payments_order_idempotency_key_uq
  ON public.payments(order_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.payments.client_idempotency_key IS
  'Client-generated UUID per submit attempt. Partial unique index on '
  '(order_id, key) makes retried submits return the existing payment row '
  'instead of inserting a duplicate. Added 2026-06-01 (Task 8 pilot hardening).';

COMMIT;
