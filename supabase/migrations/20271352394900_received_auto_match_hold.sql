-- ============================================================================
-- 20271351549033_received_auto_match_hold.sql
-- Created via `pnpm migration:new`. Idempotent.
--
-- ⏳ PHASE 2 OF THE ADMIN BDO BATCH MATCH — THE 30-MINUTE HOLD.
-- Owner rulings (specs DECISION_LOG, 2026-11-17):
--   · exact matches auto-approve, a narrow exception to the 2026-07-11 rule;
--   · conditions closed: whole reference (or the FULL InstaPay invoice) AND the
--     exact amount, exactly ONE unpaid payment, money not earlier than the order;
--   · "Hold 30 min, then pay": the match is RECORDED, waits 30 minutes, an Undo
--     inside the window cancels cleanly, and only then the normal approve runs.
--
-- Two columns on the phase-1 table (20271350937606), nothing else:
--
--   released_at     When the hold ran the normal approve path. NULL while the
--                   hold is open. The compare-and-swap that makes Undo and the
--                   release mutually exclusive: each one updates only
--                   `WHERE released_at IS NULL`, so exactly one of them wins.
--
--   auto_undone_at  When an admin pressed Undo (or the release found it could
--                   not pay). The row goes back to the hand-match pile and is
--                   NEVER auto-matched again — a person said no, so the next
--                   drop must not quietly redo it.
--
-- Who did what is written to the existing admin_audit_log (action
-- 'payment_auto_match_*'), not to a new table.
--
-- RLS is unchanged: the table already has the canonical is_admin() policy and
-- signed-in roles cannot write to it. The server writes with the service role.
-- ============================================================================

BEGIN;

ALTER TABLE public.admin_received_transactions
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

ALTER TABLE public.admin_received_transactions
  ADD COLUMN IF NOT EXISTS auto_undone_at TIMESTAMPTZ;

-- A release can only follow a recorded automatic match.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_received_transactions_release_is_auto'
  ) THEN
    ALTER TABLE public.admin_received_transactions
      ADD CONSTRAINT admin_received_transactions_release_is_auto
      CHECK (released_at IS NULL OR match_kind = 'auto');
  END IF;
END$$;

-- The holds the release job reads: automatic, not yet released, oldest first.
CREATE INDEX IF NOT EXISTS admin_received_transactions_open_holds
  ON public.admin_received_transactions (matched_at)
  WHERE match_kind = 'auto' AND released_at IS NULL;

COMMIT;
