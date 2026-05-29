-- =============================================================================
-- 20260713000000_v2_catalog_audit_columns.sql
-- V2 catalog · audit columns for admin edit governance
-- =============================================================================
--
-- WHY this migration exists.
-- /admin/pricing is migrating from read-only V1 service_catalog to read+write
-- V2 platform_retail_catalog_v2 + platform_package_catalog. The current V2
-- tables (created in 20260628000000_v2_additive_phase_a.sql) are bare-bones:
-- service_code/package_code + title + retail_price_php + saas_overhead_cost_php
-- + is_token_able (retail only). No way to:
--   1. Deactivate a SKU without deleting the row · loses BIR audit trail of
--      historical SKUs that were sold to couples.
--   2. Show "Last edited 3 minutes ago by Ice" on the admin pricing surface ·
--      no last-edited timestamp + no editor identity.
--   3. Distinguish freshly-seeded rows from rows that have been admin-edited ·
--      no created_at.
--
-- This migration adds 4 audit columns to BOTH V2 catalog tables:
--   - is_active BOOLEAN NOT NULL DEFAULT TRUE
--     Allows soft-deactivation. Public-facing surfaces filter to is_active=TRUE.
--     Admin can deactivate without losing the row (preserves audit trail).
--   - created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
--     Backfilled to NOW() on existing rows (best-effort approximation · these
--     rows were seeded by Phase A 2026-06-28 so historical accuracy isn't
--     load-bearing for the audit pattern).
--   - updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
--     Auto-stamped on every UPDATE via trigger. Powers the "Last edited X ago
--     by Y" subtitle on /admin/pricing rows.
--   - updated_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
--     Editor identity for audit. Nullable on creation (seeded rows have no
--     editor). Set by updatePlatformRetailCatalog server action on each edit.
--
-- Plus an auto-update trigger function tg_v2_catalog_set_updated_at that
-- stamps updated_at = NOW() on every UPDATE. Both catalog tables get the
-- trigger.
--
-- Idempotent via ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE FUNCTION +
-- DROP TRIGGER IF EXISTS + CREATE TRIGGER.
--
-- Cross-references:
--   - CLAUDE.md 2026-05-23 row 2 admin Tier 1 follow-ups (admin_audit_log
--     pattern this complements)
--   - CLAUDE.md 2026-05-12 § 9.1 (single-admin audit discipline · two-admin
--     gate deferred V1.x)
--   - CLAUDE.md 2026-05-17 row "Admin Add-on Management" (price-history
--     audit table for >₱500 deltas · deferred V1.x · this row's
--     updated_at/updated_by gives basic audit without the full
--     price_history surface)
--
-- =============================================================================

BEGIN;

-- =============================================================================
-- PASS 1 · platform_retail_catalog_v2 audit columns
-- =============================================================================

ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS updated_by_admin_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.platform_retail_catalog_v2.is_active IS
  'Soft-deactivation flag. Public surfaces filter to is_active=TRUE. Admin '
  'can deactivate without deleting the row (preserves BIR + analytics audit).';

COMMENT ON COLUMN public.platform_retail_catalog_v2.updated_at IS
  'Auto-stamped on UPDATE via tg_v2_catalog_set_updated_at trigger. Powers '
  '"Last edited X ago" UI on /admin/pricing.';

COMMENT ON COLUMN public.platform_retail_catalog_v2.updated_by_admin_id IS
  'Editor identity. Set by updatePlatformRetailCatalog server action on each '
  'admin edit. Nullable on seed (initial rows have no editor).';

-- =============================================================================
-- PASS 2 · platform_package_catalog audit columns
-- =============================================================================

ALTER TABLE public.platform_package_catalog
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.platform_package_catalog
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.platform_package_catalog
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.platform_package_catalog
  ADD COLUMN IF NOT EXISTS updated_by_admin_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.platform_package_catalog.is_active IS
  'Soft-deactivation flag · same semantics as platform_retail_catalog_v2.is_active.';

COMMENT ON COLUMN public.platform_package_catalog.updated_at IS
  'Auto-stamped on UPDATE via tg_v2_catalog_set_updated_at trigger.';

COMMENT ON COLUMN public.platform_package_catalog.updated_by_admin_id IS
  'Editor identity · same semantics as platform_retail_catalog_v2.updated_by_admin_id.';

-- =============================================================================
-- PASS 3 · Auto-update trigger function
-- =============================================================================
-- Shared function used by both catalog tables. Stamps updated_at = NOW() on
-- every UPDATE. updated_by_admin_id is explicitly NOT touched here · the
-- server action sets it via the UPDATE column list. If a row is updated
-- WITHOUT the server action (e.g. a Supabase Studio raw UPDATE), updated_at
-- still moves but updated_by_admin_id stays stale · acceptable trade-off
-- because raw Studio edits are an admin escape hatch we don't want to gate.

CREATE OR REPLACE FUNCTION public.tg_v2_catalog_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_v2_catalog_set_updated_at() IS
  'Trigger function for both V2 catalog tables. Stamps updated_at on UPDATE. '
  'updated_by_admin_id stays as set by the calling SQL (server action sets '
  'it · Studio raw UPDATE leaves it stale).';

-- =============================================================================
-- PASS 4 · Attach trigger to both catalog tables
-- =============================================================================

DROP TRIGGER IF EXISTS platform_retail_catalog_v2_set_updated_at
  ON public.platform_retail_catalog_v2;

CREATE TRIGGER platform_retail_catalog_v2_set_updated_at
  BEFORE UPDATE ON public.platform_retail_catalog_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_v2_catalog_set_updated_at();

DROP TRIGGER IF EXISTS platform_package_catalog_set_updated_at
  ON public.platform_package_catalog;

CREATE TRIGGER platform_package_catalog_set_updated_at
  BEFORE UPDATE ON public.platform_package_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_v2_catalog_set_updated_at();

COMMIT;

-- =============================================================================
-- VERIFICATION (run via supabase studio after push)
--
-- -- (1) Confirm columns exist with correct shape
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name IN ('platform_retail_catalog_v2', 'platform_package_catalog')
--    AND column_name IN ('is_active', 'created_at', 'updated_at', 'updated_by_admin_id')
--  ORDER BY table_name, column_name;
--
-- -- (2) Confirm trigger function exists
-- SELECT proname FROM pg_proc WHERE proname = 'tg_v2_catalog_set_updated_at';
--
-- -- (3) Confirm triggers attached
-- SELECT tgname, tgrelid::regclass FROM pg_trigger
--  WHERE tgname IN ('platform_retail_catalog_v2_set_updated_at',
--                   'platform_package_catalog_set_updated_at');
--
-- -- (4) Smoke test the trigger · UPDATE a row and confirm updated_at moves
-- BEGIN;
--   UPDATE public.platform_retail_catalog_v2
--      SET title = title  -- no-op text change
--    WHERE service_code = 'PAKULAY'
--   RETURNING service_code, updated_at;
-- ROLLBACK;
-- =============================================================================
