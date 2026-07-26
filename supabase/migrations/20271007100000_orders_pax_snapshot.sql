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
-- No RLS change: `orders` policies are unchanged and this column inherits
-- them. It is deliberately NOT granted to `authenticated` for write — only the
-- service-role checkout insert sets it.
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

-- ── Revoke write from the client roles ──────────────────────────────────────
-- 20271005100000 revoked table-level UPDATE/INSERT on `events` and granted back
-- an explicit column list. `orders` is not column-granted, so a fresh column
-- inherits whatever table-level privilege the roles hold. Strip this one
-- explicitly: a snapshot the payer can rewrite is not a snapshot.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.orders', 'UPDATE') THEN
    EXECUTE 'REVOKE UPDATE (pax_snapshot) ON public.orders FROM authenticated';
  END IF;
  IF has_table_privilege('authenticated', 'public.orders', 'INSERT') THEN
    EXECUTE 'REVOKE INSERT (pax_snapshot) ON public.orders FROM authenticated';
  END IF;
  IF has_table_privilege('anon', 'public.orders', 'UPDATE') THEN
    EXECUTE 'REVOKE UPDATE (pax_snapshot) ON public.orders FROM anon';
  END IF;
  IF has_table_privilege('anon', 'public.orders', 'INSERT') THEN
    EXECUTE 'REVOKE INSERT (pax_snapshot) ON public.orders FROM anon';
  END IF;
END $$;

-- ── Post-condition: prove the migration actually did something ──────────────
-- A DB test that connects as the table OWNER skips RLS and passes vacuously;
-- this repo has been bitten by that twice. These assertions run as the
-- migration role and check catalog state, not policy behaviour, so they cannot
-- pass vacuously.
DO $$
DECLARE
  bad TEXT[] := '{}';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name = 'pax_snapshot'
  ) THEN
    bad := array_append(bad, 'column-missing');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_pax_snapshot_sane'
  ) THEN
    bad := array_append(bad, 'check-missing');
  END IF;

  -- service_role must still be able to write it (checkout runs as service_role).
  IF NOT has_column_privilege('service_role', 'public.orders', 'pax_snapshot', 'INSERT') THEN
    bad := array_append(bad, 'service_role-lost-insert');
  END IF;

  -- …and the client roles must NOT.
  IF has_column_privilege('authenticated', 'public.orders', 'pax_snapshot', 'UPDATE') THEN
    bad := array_append(bad, 'authenticated-can-still-update');
  END IF;
  IF has_column_privilege('anon', 'public.orders', 'pax_snapshot', 'UPDATE') THEN
    bad := array_append(bad, 'anon-can-still-update');
  END IF;

  IF array_length(bad, 1) > 0 THEN
    RAISE EXCEPTION 'orders_pax_snapshot post-condition failed: %', array_to_string(bad, ', ');
  END IF;
END $$;
