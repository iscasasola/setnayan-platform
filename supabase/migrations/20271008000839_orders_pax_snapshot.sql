-- orders_pax_snapshot
-- ============================================================================
-- SEC-3 · the pax money bug. Freeze the pax an order was priced at, on the
-- order row, at insert time.
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
-- `events` UPDATE RLS is ROW-level, never column-level, and the Supabase anon
-- key is public — so an authenticated host can PATCH any host-writable column
-- on their own event straight through PostgREST, skipping every server action.
-- 20271005100000_events_column_update_privileges.sql closed 45 columns that
-- way, but `estimated_pax` is LEGITIMATELY host-written (the couple types their
-- guest estimate), so it had to stay in the grant allow-list — see the note at
-- apps/web/lib/security/events-column-privileges.ts:43-47, "a grant cannot
-- close those without breaking the product, and they need their own fixes."
--
-- Checkout re-read that column at charge time
-- (lib/v2-catalog.ts · resolvePaxPricedOrderCentavos), so the attack was:
--
--     PATCH events { "estimated_pax": 1 }   →  buy a pax-priced SKU at the
--     floor price  →  PATCH events { "estimated_pax": 500 }
--
-- ── WHAT THIS MIGRATION DOES (and what it does NOT) ─────────────────────────
-- The behavioural fix is in application code: the charge no longer trusts the
-- raw estimate, it uses resolveLivePax() — final_pax when the guest list is
-- frozen (already a LOCKED column, service-role only, guarded by
-- guard_pax_finalize_columns), else max(estimated_pax, live headcount). A
-- deflated estimate is floored by the guest list the host actually has.
--
-- This column is the durability half: the pax the order was PRICED at, written
-- once at insert and never recomputed. It follows the precedent already on this
-- table — `setnayan_fee_bps` (20260516210000) is the same idea, a mutable
-- platform config frozen per-order so historical orders keep their original
-- terms — and the `papic_limited_snapshots.frozen_bill_php` pattern
-- (20270305788856).
--
-- NOTE: an audit of every post-order money path (approval, receipt issuance,
-- payout scheduling, refunds, SKU activation, budget rollups) confirmed that
-- none of them re-derive an amount from live `events` columns; they all read
-- the stored orders.requested_total_php / confirmed_total_php. So this column
-- is not load-bearing for correctness TODAY — it exists so that the pax an
-- order was billed on is auditable and can never be re-derived from a row the
-- payer can still edit.
--
-- ── SCOPE ───────────────────────────────────────────────────────────────────
-- Nullable with no default and no backfill: NULL means "not a pax-priced
-- order" (which is every order in history — the PAPIC_GUEST pax curve was
-- retired by 20270828140000_papic_one_tiers.sql and no catalog row currently
-- has is_pax_priced = TRUE). Writers set it only when the resolver reports a
-- pax-priced SKU.
--
-- No RLS change: `orders` policies are unchanged and this column inherits them.
--
-- ── WHY THERE IS NO COLUMN REVOKE HERE (corrected before merge) ─────────────
-- An earlier revision of this file tried to strip write on this one column:
--
--     REVOKE UPDATE (pax_snapshot) ON public.orders FROM authenticated;
--
-- That is wrong twice over, and both were verified rather than assumed:
--
--   1. IT IS A NO-OP. Postgres cannot subtract a column from a table-level
--      grant. `authenticated` holds table-level INSERT/UPDATE on public.orders
--      via Supabase's platform default privileges, so after the column REVOKE
--      has_column_privilege('authenticated','public.orders','pax_snapshot',
--      'UPDATE') is STILL true. This is the same trap documented at the top of
--      20271006100000_events_facebook_watch_url.sql, and it is exactly why
--      20271005100000 had to REVOKE the table-level privilege first and GRANT
--      an explicit column list back. A snapshot the payer can still rewrite is
--      not a snapshot — so this file must not claim to have frozen it.
--
--   2. IF IT WORKED IT WOULD BREAK CHECKOUT. The only writer of this column,
--      app/dashboard/[eventId]/checkout/actions.ts:602 (submitOrderAction),
--      inserts through `createClient()` — the session-bound AUTHENTICATED
--      client, not `createAdminClient()`. Denying `authenticated` INSERT on
--      pax_snapshot would reject every pax-priced order at the till.
--
-- So this column is an AUDIT/LINEAGE record, exactly as the note above says
-- ("not load-bearing for correctness TODAY"). The behavioural money fix for
-- SEC-3 ② is in application code — resolvePaxPricedOrderCentavos now charges
-- against resolveLivePax() instead of the raw host-writable estimate — and it
-- is unaffected by any of this.
--
-- ⚠ OPEN ITEM, DELIBERATELY NOT TAKEN HERE (needs owner + coordination):
-- making pax_snapshot genuinely un-forgeable means restructuring the grants on
-- public.orders the way 20271005100000 did for public.events (table-level
-- REVOKE + explicit column re-GRANT), and/or moving the order INSERT to the
-- service-role client. Both land squarely in the checkout/orders work in
-- flight, and the row already has a strictly larger hole in the same place —
-- requested_total_php is client-supplied on this very INSERT (see the PR body,
-- "createOrder takes the price straight from the client"). Hardening one audit
-- column while the amount beside it is still client-typed would buy nothing.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pax_snapshot INTEGER;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_pax_snapshot_sane;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_pax_snapshot_sane
  CHECK (pax_snapshot IS NULL OR (pax_snapshot >= 0 AND pax_snapshot <= 1000000));

COMMENT ON COLUMN public.orders.pax_snapshot IS
  'SEC-3: the guest count this order was PRICED at, frozen at insert. NULL for '
  'non-pax-priced orders. Never recomputed — events.estimated_pax stays '
  'host-writable, so the billed pax must not be re-derivable from it.';

-- ── Post-condition: prove the migration actually did something ──────────────
-- A DB test that connects as the table OWNER skips RLS and passes vacuously;
-- this repo has been bitten by that twice. These assertions run as the
-- migration role and check catalog state, not policy behaviour, so they cannot
-- pass vacuously.
--
-- They assert CATALOG SHAPE ONLY — deliberately no has_*_privilege() checks.
-- Role grants are environment state, not something this file establishes:
-- Supabase's platform default privileges grant the API roles ALL on public
-- tables, while the migration-replay harness (apps/web/tests/db/replay-
-- migrations.ts) mirrors that GRANT only AFTER the whole corpus has replayed.
-- A privilege assertion here therefore reads a different world in each
-- environment and asserts nothing about what this migration did. The earlier
-- revision failed exactly that way in both directions: 'service_role-lost-
-- insert' under replay (no grants yet, which reds the entire DB-replay test
-- suite), and 'authenticated-can-still-update' against prod (grants present,
-- column REVOKE a no-op), which would have aborted `supabase db push`.
DO $$
DECLARE
  bad TEXT[] := '{}';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name = 'pax_snapshot'
      AND data_type = 'integer'
  ) THEN
    bad := array_append(bad, 'column-missing');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_pax_snapshot_sane'
      AND contype = 'c'
  ) THEN
    bad := array_append(bad, 'check-missing');
  END IF;

  IF array_length(bad, 1) > 0 THEN
    RAISE EXCEPTION 'orders_pax_snapshot post-condition failed: %', array_to_string(bad, ', ');
  END IF;
END $$;
