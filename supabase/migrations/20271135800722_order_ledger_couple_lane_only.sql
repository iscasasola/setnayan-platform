-- ============================================================================
-- A COUPLE MAY WRITE THEIR OWN THREE LEDGER EVENTS, ON THEIR OWN ORDER.
-- NOT "SERVICE ACTIVATED", AND NOT ON SOMEBODY ELSE'S ORDER.
-- ============================================================================
--
-- Eighth and last instance from the 2026-08-11/12 authority-column sweep. Unlike
-- its siblings this one is not a column left writable by oversight — the table
-- is browser-writable BY DESIGN. `order_ledger` is append-only evidence, and the
-- couple's own checkout legitimately writes to it under their own session
-- (app/dashboard/[eventId]/checkout/actions.ts:894, 904, 918 — the ONLY
-- RLS-client `appendLedger` call sites in the codebase; all fifteen others pass
-- the service-role `admin` client).
--
-- What was missing is any constraint on WHICH row and WHICH event:
--
--   order_ledger_authenticated_insert  WITH CHECK (actor_user_id = auth.uid())
--
-- That pins WHO is writing and nothing else. `order_id` was unconstrained (any
-- order, not just your own), `event_type` could be any of the eight the CHECK
-- allows including 'service_activated' and 'order_refunded', `actor_role` could
-- be 'admin' or 'system', and `amount_centavos`/`metadata` were free.
--
-- ── WHY A FORGED ROW IS NOT JUST A FALSE AUDIT LINE ───────────────────────
-- The ledger is MACHINE-READ. Four activation paths in lib/sku-activation.ts
-- (lines ~364, ~488, ~584, ~662) each do:
--
--     .eq('event_type', 'service_activated') … if (prior) return;
--
-- — an idempotency guard, so a replayed webhook cannot activate twice. Planting
-- a `service_activated` row against your own order BEFORE paying therefore makes
-- the real activation short-circuit: the couple pays, admin approves, and the
-- thing they bought silently never switches on. There is no error for anyone to
-- see; the guard did exactly what it was written to do, on a lie.
--
-- ⚠ A second consequence is reported but NOT verified here:
-- `deactivateVendorAddonWindow` (~line 1574) is said to read the LATEST
-- 'service_activated' row's forgeable `metadata` to decide a refund-time
-- rollback, which would let a far-future stamped expiry make the rollback a
-- no-op — money back, entitlement kept. The four short-circuits above are
-- confirmed by reading the code; that one is not, and the fix below closes it
-- either way, so it is recorded as a claim rather than asserted as fact.
--
-- ── THE FIX: TIGHTEN THE POLICY, TOUCH NO GRANT ───────────────────────────
-- `event_type` is NOT NULL with no default and the couple's client legitimately
-- names it, so a column revoke would break checkout loudly and there is nothing
-- to derive — three of the eight verbs are genuinely theirs. The POLICY is the
-- right control here, exactly as `status` on vendor_verification_applications
-- (20271135231726) kept its grant and gained a policy constraint instead.
--
-- The new WITH CHECK admits precisely what checkout sends and nothing else:
--   • actor_user_id = auth.uid()          (unchanged — who)
--   • actor_role = 'couple'               (not 'admin', not 'system')
--   • event_type IN the three couple verbs
--   • the order is theirs                 (mirrors order_ledger_couple_read_own,
--                                          which already uses o.user_id)
--
-- The five privileged verbs — payment_approved, payment_rejected,
-- payment_resubmit_requested, service_activated, order_refunded — become
-- service-role only. Every writer of those already is.
--
-- UPDATE and DELETE were revoked from `authenticated` back in 20260529020000 and
-- stay revoked: append-only is intact, and nothing here loosens it.
--
-- Prod: 0 order_ledger rows.
-- ============================================================================

DROP POLICY IF EXISTS order_ledger_authenticated_insert ON public.order_ledger;

CREATE POLICY order_ledger_authenticated_insert
  ON public.order_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- WHO: unchanged from the original policy.
    actor_user_id = auth.uid()
    -- AS WHAT: a couple session may only ever speak as the couple. 'admin' and
    -- 'system' are the other two values the CHECK constraint allows, and both
    -- would make a forged line read as ours.
    AND actor_role = 'couple'
    -- WHICH EVENT: the three that checkout writes. Everything else — payment
    -- decisions, activation, refunds — is the server's to record.
    AND event_type IN ('order_created', 'voucher_applied', 'payment_uploaded')
    -- WHOSE ORDER: the original policy never asked. An order id seen anywhere
    -- (a receipt, a URL, a support thread) was enough to write onto a stranger's
    -- order. Mirrors order_ledger_couple_read_own so read and write scope agree.
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.order_id = order_ledger.order_id
         AND o.user_id = auth.uid()
    )
  );

COMMENT ON COLUMN public.order_ledger.event_type IS
  'Append-only order history, MACHINE-READ: four paths in lib/sku-activation.ts '
  'short-circuit activation when a prior ''service_activated'' row exists for the '
  'order. A couple session may only insert order_created / voucher_applied / '
  'payment_uploaded, as actor_role=''couple'', on an order they own '
  '(order_ledger_authenticated_insert). The privileged verbs are service-role '
  'only. Before 20271135800722 the policy pinned only actor_user_id, so a couple '
  'could plant a ''service_activated'' row and make the thing they paid for '
  'silently never activate.';
