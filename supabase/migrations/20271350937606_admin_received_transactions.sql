-- ============================================================================
-- 20271350937606_admin_received_transactions.sql
-- Created via `pnpm migration:new`. Idempotent.
--
-- 🏦 WHAT ARRIVED IN OUR BDO, AS THE ADMIN SAW IT (owner 2026-11-17,
-- DECISION_LOG "ADMIN PAYMENT VERIFY — BATCH OF RECEIVED SCREENSHOTS", drawn in
-- specs prototypes/admin_payment_verify_2026-11-17/).
--
-- The admin drops screenshots of RECEIVED transfers from their own BDO app on
-- /admin/payments. Each picture is transcribed, the reference + amount + time
-- are kept here as ONE ROW, and the picture itself is discarded — no image is
-- ever stored (owner: "Pictures are read, then deleted").
--
-- 🔑 A ROW HERE IS ADVICE, NEVER APPROVAL. It is the admin's own bank's word,
-- read by a model. Matching a row to a buyer's payment is a HUMAN press that
-- runs the shipped approvePaymentCore path. Auto-match (match_kind 'auto') is
-- reserved for phase 2, which ships with the BDO pay flow and its 30-minute
-- hold; nothing in this migration or this PR writes it.
--
-- Admin only: RLS at CREATE TABLE with the canonical is_admin() pattern; the
-- server writes with the service role. No signed-in role may write directly.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_received_transactions (
  received_id         BIGSERIAL PRIMARY KEY,
  channel             TEXT NOT NULL DEFAULT 'bdo' CHECK (channel IN ('bdo')),
  -- As transcribed, and normalised (spaces/dashes out, upper case) for matching.
  reference           TEXT,
  reference_norm      TEXT,
  amount_php          NUMERIC(12,2) CHECK (amount_php IS NULL OR amount_php > 0),
  -- When the bank says the money arrived. NULL when the picture did not show it.
  received_at         TIMESTAMPTZ,
  -- 'read' = transcribed cleanly · 'unreadable' = the picture gave us nothing
  -- usable (kept so the admin sees the count, never silently dropped).
  read_status         TEXT NOT NULL DEFAULT 'read' CHECK (read_status IN ('read', 'unreadable')),
  matched_payment_id  UUID REFERENCES public.payments(payment_id) ON DELETE SET NULL,
  match_kind          TEXT CHECK (match_kind IS NULL OR match_kind IN ('manual', 'auto')),
  matched_at          TIMESTAMPTZ,
  matched_by          UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  -- "Not now ▾" — 'later' (leave for the next drop) · 'not_setnayan'.
  left_reason         TEXT CHECK (left_reason IS NULL OR left_reason IN ('later', 'not_setnayan')),
  created_by          UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_received_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_received_transactions_admin_all ON public.admin_received_transactions;
CREATE POLICY admin_received_transactions_admin_all
  ON public.admin_received_transactions FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON TABLE public.admin_received_transactions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.admin_received_transactions FROM authenticated;

-- One received transfer can settle at most one payment.
CREATE UNIQUE INDEX IF NOT EXISTS admin_received_transactions_one_match
  ON public.admin_received_transactions (matched_payment_id)
  WHERE matched_payment_id IS NOT NULL;

-- The open pile the desk draws: unmatched rows, newest first.
CREATE INDEX IF NOT EXISTS admin_received_transactions_open
  ON public.admin_received_transactions (created_at DESC)
  WHERE matched_payment_id IS NULL;

CREATE INDEX IF NOT EXISTS admin_received_transactions_ref
  ON public.admin_received_transactions (reference_norm);

COMMIT;
