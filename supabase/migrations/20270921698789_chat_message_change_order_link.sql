-- ============================================================================
-- 20270921698789_chat_message_change_order_link.sql
-- Link a chat message to a change order so a discount / inclusion request
-- renders as an in-thread card (accept / counter / decline).
--
-- WHY THIS EXISTS
--   Negotiation auto-reader Phase 2 (owner 2026-07-24: "auto-read … inclusions,
--   discounts → accept/revise/reject"). When a message reads as a discount or
--   inclusion request and the sender taps the chip, the create action inserts a
--   vendor_change_orders row (the existing propose→accept/decline machine +
--   single-winner RPCs, migration 20270320861005) AND posts a chat_messages row
--   pointing at it via this FK. The stream renders that row as a change-order
--   card — the SAME pattern as proposal_id (20270225555952) and appointment_id
--   (20270920827160).
--
--   Gated behind NEXT_PUBLIC_CHAT_NEGOTIATION_V1 (same flag as Phase 1, ships
--   dark). Purely additive: a nullable column + partial index.
--
-- IDEMPOTENT. Safe to (re-)apply.
-- ============================================================================

BEGIN;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS change_order_id UUID
    REFERENCES public.vendor_change_orders(change_order_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.chat_messages.change_order_id IS
  'Set when this message announces a discount/inclusion request — renders as an '
  'in-thread change-order card (accept / counter / decline) backed by '
  'vendor_change_orders. Mirrors proposal_id / appointment_id. NULL on every '
  'other message. Gated by NEXT_PUBLIC_CHAT_NEGOTIATION_V1.';

CREATE INDEX IF NOT EXISTS chat_messages_change_order_id_idx
  ON public.chat_messages (change_order_id)
  WHERE change_order_id IS NOT NULL;

COMMIT;
