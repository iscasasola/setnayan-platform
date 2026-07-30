-- SEC-4b (part 2) — CLOSE THE DELETE LANE ON orders + payments.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- WHY THIS EXISTS AS A SECOND MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Migration 20271008178212 (SEC-4b, PR #3738) revoked INSERT on orders/payments
-- from the session roles. Its adversarial review found that DELETE was the other
-- half of the same lane and had been left open; the repair commit that closed it
-- (`9743f1f4f`, "close the DELETE lane, un-vacuum the guards") was written 54
-- minutes BEFORE #3738 merged — and never landed. PR #3738 reads MERGED, the
-- migration is present, and the DELETE half is simply absent.
--
-- Discovered 2026-07-30 while pruning stale worktrees: the branch was not an
-- ancestor of main despite its PR being merged. VERIFIED AGAINST PROD, not
-- inferred from the diff:
--
--   has_table_privilege('authenticated','public.orders','DELETE') -> TRUE
--   has_table_privilege('anon',         'public.orders','DELETE') -> TRUE
--   pg_policies: orders_owner_write  PERMISSIVE  cmd=ALL  {authenticated}
--                USING (user_id = auth.uid())     -- no RESTRICTIVE counterpart
--
-- So a signed-in user could issue
--   DELETE /rest/v1/orders?order_id=eq.<their own PAID order>
-- and it would succeed. `supabase/security/exposure-surface.baseline.txt` records
-- the same fact in its own words: `tpriv  public.orders|authenticated  SUD`.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- WHAT THE DELETE TOOK WITH IT (verified in prod via pg_constraint)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- ON DELETE CASCADE children of public.orders:
--   payments · receipts · order_ledger · vendor_payouts ·
--   discount_code_redemptions · papic_guest_orders · papic_one_orders
--
-- So deleting one paid order erased the payment record, the BIR receipt, and the
-- audit trail in a single request — and freed a spent voucher for re-use. Only
-- order_refunds is RESTRICT (it would block the delete when a refund row exists).
-- That is a records-integrity and BIR-compliance problem as much as a security
-- one: the receipt is the artifact we are legally required to be able to produce.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- WHY THE REVOKE IS SAFE (checked before writing this)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Every orders/payments DELETE in apps/web already runs through a privileged
-- client — `createAdminClient()` or the `moneyWriter` binding — never the user's
-- session client. Grepped over `origin/main`: 13 delete call sites across
-- checkout, vendor-dashboard (branches · team · subscription · deep-search ·
-- photo-challenge), admin/custom-plans, booking-fee-lock and a stress script;
-- all `admin`/`moneyWriter`. service_role is unaffected by a REVOKE on the
-- session roles, and is re-granted explicitly below so the compensating-rollback
-- paths keep working.
--
-- Cancelling an order remains available to users: `cancelOrder` UPDATEs
-- status='cancelled'. Cancel is the supported verb; delete never was.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- ⛔ DO NOT RE-GRANT
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Re-granting DELETE on orders/payments to `authenticated` or `anon` reopens
-- exactly this hole. If a future feature needs to remove an order, route it
-- through service_role behind a server action that re-checks ownership, or add a
-- status transition. A migration numbered ABOVE this one that re-grants would
-- pass CI silently — the verification block below is what makes the regression
-- loud at deploy time instead.

BEGIN;

-- ── 1. Close the lane ───────────────────────────────────────────────────────
REVOKE DELETE ON public.orders   FROM authenticated, anon;
REVOKE DELETE ON public.payments FROM authenticated, anon;

-- ── 2. Keep the privileged writer whole ─────────────────────────────────────
-- Idempotent and explicit: the app's compensating rollbacks (a failed checkout
-- deleting the order row it just minted) run as service_role and must not be
-- collateral damage of step 1.
GRANT INSERT, DELETE ON public.orders, public.payments TO service_role;

-- ── 3. Prove it, do not assume it ───────────────────────────────────────────
-- The lesson the original repair was named for: a control that reads as rigorous
-- and enforces nothing. A REVOKE can be a silent no-op when a privilege is held
-- via another grant path, so assert the end state and fail the migration if the
-- lane is still open.
DO $$
DECLARE
  r    text;
  t    text;
  bad  text[] := ARRAY[]::text[];
BEGIN
  FOREACH r IN ARRAY ARRAY['authenticated', 'anon'] LOOP
    FOREACH t IN ARRAY ARRAY['public.orders', 'public.payments'] LOOP
      IF has_table_privilege(r, t, 'DELETE') THEN
        bad := array_append(bad, format('%s still holds DELETE on %s', r, t));
      END IF;
      -- INSERT was closed by 20271008178212; assert it did not regress since.
      IF has_table_privilege(r, t, 'INSERT') THEN
        bad := array_append(bad, format('%s regained INSERT on %s', r, t));
      END IF;
    END LOOP;
  END LOOP;

  -- service_role must NOT have been caught by the revoke.
  FOREACH t IN ARRAY ARRAY['public.orders', 'public.payments'] LOOP
    IF NOT has_table_privilege('service_role', t, 'DELETE') THEN
      bad := array_append(bad, format('service_role LOST DELETE on %s', t));
    END IF;
  END LOOP;

  IF array_length(bad, 1) > 0 THEN
    RAISE EXCEPTION 'SEC-4b delete-lane migration did not reach its end state: %',
      array_to_string(bad, '; ');
  END IF;
END $$;

COMMENT ON TABLE public.orders IS
  'SEC-4b. INSERT revoked from session roles by 20271008178212; DELETE revoked by '
  '20271024090000 (the repair commit for #3738 never merged, leaving DELETE open in '
  'prod until 2026-07-30). orders_owner_write is PERMISSIVE FOR ALL, so the table '
  'GRANT is the only thing standing between a session role and deleting a PAID order '
  'whose payments/receipts/order_ledger/vendor_payouts all CASCADE. Users cancel '
  '(status=cancelled); only service_role deletes.';

COMMIT;
