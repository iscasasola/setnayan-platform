-- revoke_orders_payments_insert_from_session_roles
-- ============================================================================
-- SEC-4b — THE SERVER IS THE ONLY MINTER OF MONEY ROWS.
--
-- ⛔ DO NOT `GRANT INSERT ON public.orders` (or public.payments) TO
--    authenticated / anon. Read this header first. Re-granting it re-opens a
--    live "pay ₱1 for a ₱2,999 SKU" hole that no application code can see.
--
-- ── THE ATTACK (verified against prod before writing this file) ─────────────
-- The anon publishable key is public by design and PostgREST is reachable
-- directly, so ANY logged-in user can skip apps/web entirely and POST:
--
--     POST /rest/v1/orders
--     apikey: <public anon key>            Authorization: Bearer <own JWT>
--     { "user_id": "<self>", "event_id": "<their own event>",
--       "service_key": "PAPIC_GUEST", "requested_total_php": 1,
--       "status": "submitted", "reference_code": "SN1A2B3C4D" }
--
-- Every gate on the table lets that through:
--
--   • orders_owner_write (20260513150000:77) is
--     `FOR ALL … WITH CHECK (user_id = auth.uid())` — it authenticates the
--     BUYER and says nothing at all about the AMOUNT.
--   • orders_insert_status_guard (20270920010000) constrains STATUS only, and
--     'submitted' is on its allow-list — which is exactly what the attack uses.
--   • guard_orders_protected_columns (20270226279630) DOES protect
--     requested_total_php / service_key / confirmed_total_php … but it is a
--     `BEFORE UPDATE` trigger. It is structurally incapable of firing on an
--     INSERT, and its body is written entirely in terms of OLD, so it could not
--     be reused there without a rewrite. Net: those columns are immutable after
--     creation and completely free AT creation.
--   • orders_requested_total_php_check only demands `>= 0`, so ₱0 is legal too.
--
-- The attacker then pays ₱1 for real. /admin/payments reconciles the inbound
-- GCash/BDO message against THE ORDER'S OWN asking price — so ₱1 paid against a
-- ₱1 request looks perfectly settled. Approval runs activateOrderSku and they
-- own the SKU. Nothing in the console ever shows a discrepancy.
--
-- public.payments carries the identical shape and is the other half of the same
-- exploit: payments_owner_insert is `WITH CHECK (user_id = auth.uid())` with no
-- amount_php constraint AND no assertion that order_id belongs to the caller
-- (payments_order_id_fkey checks existence only). Revoking orders alone would
-- still leave an authenticated user able to POST an arbitrary-amount pending
-- payment — the very row the reconciliation queue reads. Both are closed here.
--
-- ── WHY A REVOKE AND NOT A PRICE-CHECKING TRIGGER ───────────────────────────
-- Deliberately NOT re-deriving the price in SQL. The authoritative charge spans
-- platform_retail_catalog_v2 + platform_package_catalog + a pax curve keyed to
-- events.estimated_pax + per-event-type Setnayan AI pricing + subscription
-- cycle multiplication (apps/web/lib/v2-catalog.ts + checkout/actions.ts). A
-- SQL price rule would be a SECOND source of truth that drifts from the first —
-- which is the exact failure mode PR #3731 exists to prevent. `is_active` is
-- also OVERLOADED (on SETNAYAN_AI_RENEW it means "not independently sellable",
-- NOT "retired" — see resolveServiceSellability), so a naive "reject inactive
-- SKUs" rule in SQL would break every AI renewal.
--
-- So the fix is a PRIVILEGE fix, not a validation fix: remove the ability to
-- write these tables from a session role at all, and let the code paths that
-- already re-resolve the price server-side do it through service_role.
--
-- ── WHAT MOVES, AND THE AUTHORIZATION THAT REPLACES RLS ─────────────────────
-- Every session-role insert site in apps/web is converted to
-- createAdminClient() in the same PR. service_role bypasses ALL policies, so
-- each converted site stamps its identity columns from SERVER-DERIVED values
-- only (never formData) via apps/web/lib/order-mint-identity.ts, on top of the
-- membership / vendor-role gate it already ran. Sites converted:
--
--   app/dashboard/[eventId]/checkout/actions.ts        (couple checkout)
--   app/dashboard/[eventId]/orders/actions.ts          (logPayment)
--   app/vendor-dashboard/booking-fees/actions.ts       (logBookingFeePayment)
--   app/vendor-dashboard/branches/actions.ts
--   app/vendor-dashboard/team/actions.ts
--   app/vendor-dashboard/deep-search/actions.ts
--   app/vendor-dashboard/subscription/ai-addon-actions.ts
--   app/vendor-dashboard/subscription/booth-addon-actions.ts
--   app/vendor-dashboard/subscription/custom/actions.ts
--   app/vendor-dashboard/clients/[eventId]/photo-challenge-actions.ts
--
-- ── WHAT IS UNAFFECTED ──────────────────────────────────────────────────────
--   • service_role / postgres — untouched (restated explicitly below so this
--     migration is self-sufficient on a freshly-built database).
--   • public.booking_fee_upsert_vendor_order() — the ONLY DB function that
--     inserts into orders. SECURITY DEFINER, owner postgres, EXECUTE granted to
--     postgres + service_role only. A DEFINER function runs as its owner, so it
--     is not affected by a revoke on authenticated/anon.
--   • SELECT / UPDATE / DELETE on both tables — NOT touched here. cancelOrder
--     (a session-role UPDATE to status='cancelled') and every RLS-scoped read
--     keep working exactly as today.
--   • Edge Functions (none exist) and pg_cron (cron.job is empty — this repo is
--     deliberately cron-free).
--
-- ── PROVENANCE OF THE GRANT BEING REMOVED ───────────────────────────────────
-- No migration in this repo has ever GRANTed on orders or payments; the
-- privilege comes entirely from Supabase's platform default privileges
-- (pg_default_acl for schema public, from BOTH postgres and supabase_admin,
-- granting arwdDxtm to anon + authenticated + service_role). Default ACLs apply
-- only at CREATE TABLE time, so they will NOT silently undo this REVOKE on the
-- existing tables — but they WOULD re-grant it if either table were ever
-- dropped and recreated (a `db reset`, a squashed baseline). That is precisely
-- why the belt-and-braces trigger below does not depend on the ACL at all, and
-- why the DB test asserts the LIVE privilege state rather than the presence of
-- this file.
--
-- Data state at time of writing: public.orders holds 0 rows. There is no
-- evidence of exploitation and this carries zero data-migration risk.
--
-- REVERSIBLE (do not): `GRANT INSERT ON public.orders, public.payments TO
-- authenticated, anon;` + `DROP TRIGGER trg_guard_orders_insert_caller …`.
-- ============================================================================

BEGIN;

-- ── 1 · The privilege fix, with a before/after overreach check ──────────────
-- Table-level, not column-level: there is no legitimate session-role INSERT of
-- ANY column of these tables, so there is nothing to grant back. (Contrast
-- 20271005100000 on public.events, where hosts legitimately write most columns
-- and the fix had to be a computed column allow-list.)
--
-- The revoke is wrapped in a DO block so SELECT / UPDATE / DELETE can be
-- SNAPSHOTTED before and compared after. An absolute assertion ("authenticated
-- must still hold SELECT") would be wrong: it asserts the ENVIRONMENT, not this
-- migration, and it fails on a fresh replay where the platform default
-- privileges have not been emulated yet. A before/after DIFF asserts exactly
-- the thing that matters — that this migration removed INSERT and touched
-- nothing else — and holds on prod and on a freshly-built database alike.
DO $$
DECLARE
  bad        TEXT[] := ARRAY[]::TEXT[];
  t          TEXT;
  r          TEXT;
  before_sel BOOLEAN;
  before_upd BOOLEAN;
  before_del BOOLEAN;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.orders', 'public.payments'] LOOP
    FOREACH r IN ARRAY ARRAY['authenticated', 'anon'] LOOP
      before_sel := has_table_privilege(r, t, 'SELECT');
      before_upd := has_table_privilege(r, t, 'UPDATE');
      before_del := has_table_privilege(r, t, 'DELETE');

      EXECUTE format('REVOKE INSERT ON %s FROM %I', t, r);

      -- (a) INSERT must be gone at BOTH table and column level. Postgres checks
      --     the table privilege first, but a stray column grant would still let
      --     a narrow INSERT through.
      IF has_table_privilege(r, t, 'INSERT') THEN
        bad := array_append(bad, format('%s still holds table INSERT on %s', r, t));
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = split_part(t, '.', 1)
          AND c.table_name   = split_part(t, '.', 2)
          AND has_column_privilege(r, t, c.column_name, 'INSERT')
      ) THEN
        bad := array_append(bad, format('%s still holds a column INSERT on %s', r, t));
      END IF;

      -- (b) NOTHING ELSE may have moved. cancelOrder is a session-role UPDATE
      --     and every dashboard read is a session-role SELECT; an overreaching
      --     revoke would break them in a way no test of the denial path notices.
      IF has_table_privilege(r, t, 'SELECT') <> before_sel THEN
        bad := array_append(bad, format('OVERREACH: %s SELECT on %s changed', r, t));
      END IF;
      IF has_table_privilege(r, t, 'UPDATE') <> before_upd THEN
        bad := array_append(bad, format('OVERREACH: %s UPDATE on %s changed', r, t));
      END IF;
      IF has_table_privilege(r, t, 'DELETE') <> before_del THEN
        bad := array_append(bad, format('OVERREACH: %s DELETE on %s changed', r, t));
      END IF;
    END LOOP;
  END LOOP;

  -- Restate service_role explicitly. It already holds this in prod, so this is
  -- a no-op there — but it stops the migration from ASSUMING how service_role
  -- acquired its grant, and makes it self-sufficient on a fresh database.
  EXECUTE 'GRANT INSERT ON public.orders, public.payments TO service_role';

  FOREACH t IN ARRAY ARRAY['public.orders', 'public.payments'] LOOP
    IF NOT has_table_privilege('service_role', t, 'INSERT') THEN
      bad := array_append(bad, format('service_role LOST INSERT on %s', t));
    END IF;
  END LOOP;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'SEC-4b privilege post-condition failed: %', array_to_string(bad, ', ');
  END IF;
END $$;

-- ── 2 · Defence in depth · a BEFORE INSERT caller guard ─────────────────────
-- The revoke above is the load-bearing control. This trigger exists because the
-- revoke's one realistic regression vector is someone re-issuing the grant — a
-- stray migration, a dashboard click, a restored dump, or the pg_default_acl
-- path described in the header. The trigger does not read the ACL, so a
-- re-grant turns a SILENT re-opening into a loud 42501.
--
-- DENY-LIST on current_user, NOT an allow-list on service_role. This is the
-- established house form (guard_orders_protected_columns,
-- guard_vendor_payment_confirmation, guard_payment_plan_clear all use exactly
-- this predicate) and it is why migrations, seeds, the Supabase SQL editor and
-- psql maintenance — all of which run as `postgres` — pass straight through. An
-- allow-list (`if current_user <> 'service_role' then raise`) would break every
-- one of them.
--
-- SECURITY INVOKER so current_user is the TRUE executing role. It asserts
-- CALLER IDENTITY ONLY — it does not look at requested_total_php, service_key,
-- or is_active, and it must never start to (see "WHY A REVOKE" above).
CREATE OR REPLACE FUNCTION public.guard_money_row_insert_caller()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    RAISE EXCEPTION
      '%: rows are minted by the server only — the price is resolved server-side (SEC-4b)',
      TG_TABLE_NAME
      USING errcode = '42501';
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.guard_money_row_insert_caller() IS
  'SEC-4b. Belt over REVOKE INSERT ON orders/payments FROM authenticated, anon: '
  'a session-role INSERT could set requested_total_php / amount_php to 1 peso for '
  'any SKU (orders_owner_write checks only user_id; the money-column guard is '
  'BEFORE UPDATE and never sees an INSERT). Caller-identity assertion only - '
  'it must never re-derive a price, which would be a second source of truth.';

DROP TRIGGER IF EXISTS trg_guard_orders_insert_caller ON public.orders;
CREATE TRIGGER trg_guard_orders_insert_caller
  BEFORE INSERT ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.guard_money_row_insert_caller();

DROP TRIGGER IF EXISTS trg_guard_payments_insert_caller ON public.payments;
CREATE TRIGGER trg_guard_payments_insert_caller
  BEFORE INSERT ON public.payments FOR EACH ROW
  EXECUTE FUNCTION public.guard_money_row_insert_caller();

COMMIT;

-- ----------------------------------------------------------------------------
-- Post-condition — the guard is really attached. (The privilege half is
-- asserted inline above, where the before/after snapshot lives.)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
  t   TEXT;
BEGIN
  -- The guard must be attached to BOTH tables, on INSERT, per row.
  FOREACH t IN ARRAY ARRAY['trg_guard_orders_insert_caller', 'trg_guard_payments_insert_caller'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger g
      WHERE g.tgname = t AND NOT g.tgisinternal
        AND (g.tgtype & 4) <> 0   -- INSERT
        AND (g.tgtype & 2) <> 0   -- BEFORE
    ) THEN
      bad := array_append(bad, format('trigger %s is missing or not BEFORE INSERT', t));
    END IF;
  END LOOP;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'SEC-4b post-condition failed: %', array_to_string(bad, ', ');
  END IF;
END $$;

-- ============================================================================
-- ⚠ MAINTENANCE NOTE
--
-- A NEW order- or payment-minting code path must use createAdminClient()
-- (service_role) and stamp its identity columns through
-- apps/web/lib/order-mint-identity.ts. It must NOT be "fixed" by granting the
-- session roles INSERT back.
--
-- apps/web/tests/db/orders-payments-insert-revoke.db.test.ts fails loudly if
-- either grant returns, and apps/web/lib/order-price-authority.test.ts fails if
-- a module mints orders without a review note naming its client + price source.
--
-- KNOWN, NOT FIXED HERE (reported in the PR body, same family, out of lane):
--   • orders_owner_write is FOR ALL with no restrictive DELETE counterpart, so
--     an authenticated user can DELETE their own orders at any status. Every
--     app-side rollback DELETE moved to service_role in this PR, so
--     `REVOKE DELETE ON public.orders FROM authenticated, anon` is now a safe
--     one-liner follow-up.
--   • event_vendor_payments / event_vendor_payment_plan / vendor_reviews carry
--     the same BEFORE-UPDATE-only guard shape: their forge-able columns
--     (vendor_confirmed_at, cleared_at, vendor_reply) are unconstrained at
--     INSERT time.
-- ============================================================================
