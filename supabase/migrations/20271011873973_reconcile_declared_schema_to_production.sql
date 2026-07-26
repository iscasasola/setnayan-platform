-- Reconcile the DECLARED schema to what production actually has.
--
-- Every statement in this file is a guarded NO-OP against production. Nothing
-- here changes a single byte of prod. What it changes is what a FRESH database
-- built from these migrations looks like — bringing the declaration into line
-- with reality so `supabase/migrations` becomes a faithful record.
--
-- Companion guard: apps/web/tests/db/schema-drift.db.test.ts, which replays the
-- migrations and diffs the result against supabase/security/prod-schema.snapshot.txt.
--
-- ============================================================================
-- BACKGROUND — how the declaration and reality came apart
-- ============================================================================
-- `CREATE TABLE IF NOT EXISTS` silently no-ops when the table already exists in
-- a different shape. The columns inside never land, but the statement SUCCEEDS,
-- `supabase db push` reports success, and the version is written to
-- schema_migrations. The ledger says applied; the schema disagrees.
--
-- 20260628000000_v2_additive_phase_a.sql:392 declares `manual_payment_logs`
-- that way. The table already existed in prod (created out of band — prod's PK
-- is `id`, which NO migration declares), so the whole body was skipped.
--
-- ============================================================================
-- PART A — manual_payment_logs: the declaration is fiction, so retire it
-- ============================================================================
-- The declared table and the real table are incompatible in THREE independent
-- ways, and the live code depends on the REAL one:
--
--   1. PK name          declared `manual_payment_id`   · prod `id`
--   2. items_ordered    declared `JSONB`               · prod `text[]`
--   3. payment_status   declared CHECK (…5 values…)    · prod has NO CHECK
--
-- public.verify_and_activate_manual_payment() — live, and repointed as recently
-- as 20260903000000 — does BOTH of these:
--
--     UPDATE public.manual_payment_logs SET payment_status = 'VERIFIED_AND_ACTIVATED' …
--     FOREACH v_item IN ARRAY v_items_array LOOP        -- v_items_array is TEXT[]
--
-- Against the DECLARED shape that function is broken twice over:
-- 'VERIFIED_AND_ACTIVATED' is not in the declared CHECK, and you cannot FOREACH
-- over a jsonb. So the drift is not merely cosmetic — a fresh environment built
-- from these migrations would have a BROKEN manual-payment activation path,
-- while prod works precisely BECAUSE the declaration never landed.
--
-- That rules out the tempting fix of `ADD COLUMN`-ing the seven missing columns
-- to make the diff quiet: it would ship an unused half-feature AND leave the
-- type/CHECK incompatibility in place. Prod is the source of truth here, so the
-- declaration is corrected down to prod instead.
--
-- ⚠ WHAT THIS GIVES UP — SURFACED DELIBERATELY, NOT SWEPT UP:
-- The declaration was the only place in SQL where two behaviours specified by
-- iteration 0034 were written down. Retiring it does not remove them from prod
-- (they were never there); it removes the false impression that they exist:
--
--   · the 7-day pending-payment expiry (`expires_at`) — pending manual payments
--     have never expired, and still do not;
--   · the admin reconciliation audit trail (`verified_at`,
--     `verified_by_admin_id`, `rejection_reason`) — there is none;
--   · `customer_user_id` — a row cannot be attributed to a person directly,
--     only indirectly through `event_id`.
--
-- If those behaviours are wanted, they should be built on the real payments
-- spine (orders / payments / order_ledger), not bolted onto this vestigial
-- Maya-branch tracking table. Tracked in the PR that introduced this file.
-- The RA 10173 classifications that described the imaginary columns are
-- corrected in the same change.
--
-- Safety: `manual_payment_logs` holds 0 rows in prod and has exactly one
-- writer (app/api/v1/billing/initialize-maya/route.ts), which inserts only the
-- five columns prod actually has.

DO $$
BEGIN
  -- A1. PK name: declared `manual_payment_id` → prod's `id`.
  --     On prod `manual_payment_id` does not exist, so this never fires.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'manual_payment_logs'
       AND column_name = 'manual_payment_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'manual_payment_logs'
       AND column_name = 'id'
  ) THEN
    ALTER TABLE public.manual_payment_logs RENAME COLUMN manual_payment_id TO id;
  END IF;

  -- A2. items_ordered: declared jsonb → prod's text[]. Guarded on the CURRENT
  --     type, so on prod (already text[]) it never fires.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'manual_payment_logs'
       AND column_name = 'items_ordered' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.manual_payment_logs ALTER COLUMN items_ordered DROP DEFAULT;
    -- `USING` may not contain a subquery, so the jsonb-array → text[] conversion
    -- is done with a scalar expression: '["A","B"]' → '{"A","B"}' → text[].
    ALTER TABLE public.manual_payment_logs
      ALTER COLUMN items_ordered TYPE TEXT[]
      USING translate(items_ordered::TEXT, '[]', '{}')::TEXT[];
  END IF;
END $$;

-- A3. The columns the declaration invented. `IF EXISTS` → no-op on prod, where
--     they have never existed.
ALTER TABLE public.manual_payment_logs
  DROP COLUMN IF EXISTS customer_user_id,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS verified_by_admin_id,
  DROP COLUMN IF EXISTS rejection_reason,
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS updated_at;

-- A4. CHECK constraints prod does not have. The payment_status one is the
--     dangerous half: it forbids 'VERIFIED_AND_ACTIVATED', the exact value the
--     live activation function writes.
ALTER TABLE public.manual_payment_logs
  DROP CONSTRAINT IF EXISTS manual_payment_logs_payment_status_check,
  DROP CONSTRAINT IF EXISTS manual_payment_logs_amount_php_check;

COMMENT ON TABLE public.manual_payment_logs IS
  'Manual QR/bank payment tracking for /api/v1/billing/initialize-maya (Branch A). '
  'SHAPE IS PRODUCTION-AUTHORITATIVE: this table was created out of band, and the '
  'richer declaration in 20260628000000 never landed (CREATE TABLE IF NOT EXISTS '
  'no-opped). It has NO expiry, NO reconciliation audit trail and NO direct '
  'customer_user_id — see 20271011873973 before assuming otherwise.';

-- ============================================================================
-- PART B — back-fill six columns that exist in prod but no migration declares
-- ============================================================================
-- Applied out of band at some point; the migrations never recorded them. Types
-- and defaults below are copied from prod's pg_catalog, NOT reconstructed from
-- memory — `ADD COLUMN IF NOT EXISTS` matches on NAME ONLY, so a back-fill with
-- the wrong type would no-op on prod, take effect on a fresh database, and
-- create a *type* divergence that a column-name diff can never see. That is the
-- same trap as the one this file closes, so it is worth spelling out.
--
-- Verified against prod 2026-07-26:
--   users.concierge_banned                         boolean NOT NULL DEFAULT false
--   users.concierge_banned_at                      timestamptz NULL
--   users.concierge_banned_by                      uuid NULL
--   users.concierge_banned_reason                  text NULL
--   platform_settings.onboarding_bg_music_r2_keys  text[] NOT NULL DEFAULT '{}'
--   vendor_services.per_guest_delivery             boolean NOT NULL DEFAULT false

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS concierge_banned        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS concierge_banned_at     TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS concierge_banned_by     UUID,
  ADD COLUMN IF NOT EXISTS concierge_banned_reason TEXT;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS onboarding_bg_music_r2_keys TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS per_guest_delivery BOOLEAN NOT NULL DEFAULT FALSE;

-- NOT back-filled here, deliberately: the two prod-only TABLES
-- (`event_service_deliveries`, `pioneer_incentive_logs`). They carry RLS,
-- policies, grants, indexes and FKs, and adding them to the replay also widens
-- the exposure surface, which would fail the freeze in
-- apps/web/tests/db/exposure-freeze.db.test.ts. That is its own reviewable
-- change, not a footnote to this one. They are allow-listed with that reason in
-- apps/web/tests/db/schema-snapshot.ts (KNOWN_GAPS).
