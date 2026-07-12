-- order_refund_status_gateway_values
-- ============================================================================
-- Add the two gateway-refund lifecycle values to public.order_refund_status.
-- Kept in its OWN migration file (no BEGIN/COMMIT wrapper) because Postgres
-- forbids USING a newly ADDed enum value in the same transaction that adds it —
-- a separate migration = separate transaction = safe.
--
--   • 'failed'     — a gateway refund API call failed (money NOT returned; the
--                    admin refundOrder records this row + surfaces the error).
--   • 'processing' — reserved for an async gateway refund that is pending
--                    settlement (refund.updated webhook may move it to 'sent').
--
-- Existing values: 'sent' · 'disputed_by_customer' · 'reversed'. Idempotent.
-- NOT pushed here — owner applies via `supabase db push`.
-- ============================================================================

ALTER TYPE public.order_refund_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.order_refund_status ADD VALUE IF NOT EXISTS 'failed';
