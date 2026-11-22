-- pay_zero_code_confirm
-- Created via `pnpm migration:new`. Idempotent (it may be re-applied).
--
-- ₱0 CODES ON /pay — "Send for confirmation" (controller 2026-11-22, the follow-up to #8130 "EVERY PAYMENT WALL TAKES
-- A CODE"). A code that covers the WHOLE price leaves nothing to pay, so there is no receipt and no Maya payment — but
-- an admin must still confirm it (a leaked 100% code must not switch anything on by itself). The confirmation is an
-- ordinary `payments` row in the existing /admin/payments queue: amount ₱0, channel 'voucher', status 'pending'.
--
-- 1 · payments.amount_php — iteration 0034 (20260513150000) declared `CHECK (amount_php > 0)`, which refuses that row.
--     Relaxed to: more than ₱0, OR exactly ₱0 on the 'voucher' channel. Every other channel still needs real money;
--     a negative amount is still refused everywhere.
--
-- 2 · pay_reprice_order_with_code — the /pay code box's re-price as ONE statement that also re-checks, in the same
--     statement, that no Maya checkout is open for the order (review of #8130, low 1: the app read "no open checkout"
--     and then updated, so another tab could open a checkout at the old price in between). service_role only — the app
--     calls it with the money writer AFTER its own session checks; it authorises nothing by itself.
--
-- No table, no column, no policy. Nothing is back-filled: no existing row is ₱0.

-- ─── 1 · a ₱0 payment row is allowed on the 'voucher' channel only ──────────────────────────────────────────────
DO $$
DECLARE
  c record;
BEGIN
  -- Drop the old "more than ₱0" check under whatever name it carries (the inline CHECK was auto-named), and this
  -- migration's own check, so a re-run lands on exactly one constraint.
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.payments'::regclass
       AND contype = 'c'
       AND (
         conname = 'payments_amount_php_positive_or_voucher'
         OR regexp_replace(pg_get_constraintdef(oid), '[\s()]|::numeric', '', 'g') = 'CHECKamount_php>0'
       )
  LOOP
    EXECUTE format('ALTER TABLE public.payments DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.payments
    ADD CONSTRAINT payments_amount_php_positive_or_voucher
    CHECK (amount_php > 0 OR (amount_php = 0 AND channel = 'voucher'));
END $$;

COMMENT ON CONSTRAINT payments_amount_php_positive_or_voucher ON public.payments IS
  'A payment is more than ₱0 — except a ₱0 row on channel ''voucher'': a code covered the whole price and the row is the admin''s confirmation request in /admin/payments (20271357859993).';

-- ─── 2 · the /pay code box's re-price, guarded in one statement ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pay_reprice_order_with_code(
  p_order_id uuid,
  p_code text,
  p_discount_centavos bigint
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH repriced AS (
    UPDATE public.orders o
       SET voucher_code_applied = p_code,
           voucher_discount_centavos = p_discount_centavos
     WHERE o.order_id = p_order_id
       AND p_code IS NOT NULL
       AND p_discount_centavos > 0
       -- still exactly as the app checked it: unpaid, no code yet, not admin-quoted…
       AND o.status::text IN ('draft', 'awaiting_payment')
       AND o.voucher_code_applied IS NULL
       AND o.confirmed_total_php IS NULL
       -- …and NO OPEN MAYA CHECKOUT: a price Maya already holds is never changed under it.
       AND NOT EXISTS (
         SELECT 1
           FROM public.maya_checkouts m
          WHERE m.order_id = o.order_id
            AND m.status = 'created'
       )
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM repriced);
$$;

COMMENT ON FUNCTION public.pay_reprice_order_with_code(uuid, text, bigint) IS
  'The /pay code box''s re-price: sets orders.voucher_code_applied + voucher_discount_centavos only while the order is unpaid, has no code, is not admin-quoted AND has no open Maya checkout — all in one statement. Returns whether it re-priced. service_role only (20271357859993).';

REVOKE ALL ON FUNCTION public.pay_reprice_order_with_code(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_reprice_order_with_code(uuid, text, bigint) TO service_role;
