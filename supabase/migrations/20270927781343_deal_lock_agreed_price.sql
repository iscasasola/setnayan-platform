-- ============================================================================
-- 20270927781343_deal_lock_agreed_price.sql
-- Customer "Lock this deal" — freeze the final agreed price (negotiation rework,
-- council verdict 2026-07-24).
--
-- WHY THIS EXISTS
--   The customer commits with ONE "Lock this deal" tap on an accepted Deal card.
--   Locking (a) stamps the Deal (proposal_amendments.locked_at) so the card shows
--   "🔒 Locked", and (b) writes the frozen total onto the THREAD
--   (chat_threads.agreed_price_centavos + locked_at + locked_by_user_id). The
--   thread's agreed_price is the clean handoff to the PAYMENT session (the
--   vendor's finalize / 5% / pay flow reads it) — that flow is NOT built here.
--
--   Gated behind NEXT_PUBLIC_CHAT_NEGOTIATION_V1. Purely additive columns.
--   IDEMPOTENT.
-- ============================================================================

BEGIN;

-- Per-Deal lock stamp (drives the card's Locked state).
ALTER TABLE public.proposal_amendments
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Thread-level frozen agreed price (the payment session's read point).
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS agreed_price_centavos BIGINT
    CHECK (agreed_price_centavos IS NULL OR agreed_price_centavos >= 0),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by_user_id UUID;

COMMENT ON COLUMN public.chat_threads.agreed_price_centavos IS
  'The final agreed price (centavos) the customer LOCKED on a Deal — the handoff '
  'to the payment session (vendor finalize / 5% / pay). Set by lockDeal. Gated by '
  'NEXT_PUBLIC_CHAT_NEGOTIATION_V1.';

COMMIT;
