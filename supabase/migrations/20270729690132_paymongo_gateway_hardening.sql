-- paymongo_gateway_hardening
-- ============================================================================
-- Hardening for the PayMongo one-time gateway (money-path Phase 1.5):
--   • processed_webhook_events — delivery-id dedup so a duplicate valid webhook
--     is deduped by DELIVERY ID, not only by order status.
--   • payments.gateway_payment_id — the PayMongo pay_… id a gateway refund is
--     issued against (stamped by the webhook at fulfillment).
--   • order_refunds.gateway_refund_id + refund_mode — which rail returned the
--     money (gateway API vs off-platform manual reversal) + the PayMongo ref_… id.
--   • orders.gateway_fee_centavos ALREADY EXISTS (migration 20260516210000
--     vendor_payout_model, NOT NULL DEFAULT 0) — the couple-SKU fee booking
--     (Gap 6) writes that existing column from the webhook; re-asserted below as
--     a defensive IF NOT EXISTS no-op so this file is self-describing.
--
-- Idempotent. No RLS change on payments/order_refunds/orders (existing).
-- processed_webhook_events gets RLS enabled with NO policies → deny-by-default,
-- reached only via the service-role admin client (the webhook).
-- NOT pushed here — owner applies via `supabase db push`.
-- ============================================================================

-- ── Webhook delivery-id dedup ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider     TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  event_type   TEXT,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The load-bearing idempotency guard: a second delivery of the same provider
-- event id collides here (23505) → the webhook acks 200 without re-processing.
CREATE UNIQUE INDEX IF NOT EXISTS processed_webhook_events_provider_event_uq
  ON public.processed_webhook_events(provider, event_id);

COMMENT ON TABLE public.processed_webhook_events IS
  'Idempotency ledger for inbound provider webhooks. UNIQUE(provider,event_id) '
  'dedups a duplicate valid delivery by DELIVERY ID (e.g. PayMongo evt_…), '
  'independent of order status. Written only by the service-role webhook route; '
  'RLS-enabled with no policies (deny-by-default). Added 2026-07-12.';

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- ── PayMongo payment id on the matched payment row (for gateway refunds) ─────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;

COMMENT ON COLUMN public.payments.gateway_payment_id IS
  'PayMongo payment id (pay_…) that settled this order, stamped by the '
  'checkout_session.payment.paid webhook. The handle a gateway refund '
  '(createPayMongoRefund) is issued against. NULL for manual GCash/BDO payments.';

-- Sparse lookup (refund/dispute webhook maps pay_… → order via this).
CREATE INDEX IF NOT EXISTS payments_gateway_payment_id_idx
  ON public.payments(gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

-- ── Refund rail + gateway refund id on the audit row ────────────────────────
ALTER TABLE public.order_refunds
  ADD COLUMN IF NOT EXISTS gateway_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_mode TEXT;

COMMENT ON COLUMN public.order_refunds.gateway_refund_id IS
  'PayMongo refund id (ref_…) when the money was returned through the gateway '
  '(refund_mode=gateway). NULL for manual off-platform bank reversals.';

COMMENT ON COLUMN public.order_refunds.refund_mode IS
  'How the money was returned: ''gateway'' (PayMongo API refund against '
  'payments.gateway_payment_id) or ''manual'' (off-platform bank/e-wallet '
  'reversal the owner performs; this row just records it). NULL = legacy manual.';

-- ── Defensive re-assert of the couple-SKU fee-booking column (already exists) ─
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gateway_fee_centavos INTEGER NOT NULL DEFAULT 0;
