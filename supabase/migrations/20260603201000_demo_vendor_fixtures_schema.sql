-- ============================================================================
-- 20260603201000_demo_vendor_fixtures_schema.sql
--
-- PR 1 of 3 — Marketplace simulation workstream (owner-approved 2026-05-22 evening).
-- Timestamp bumped 20260603200000 → 20260603201000 on 2026-05-22 to resolve a
-- duplicate-prefix collision with 20260603200000_iteration_0008_seating_catalog_
-- realignment.sql (PR #312, merged earlier same day). Both PRs picked the same
-- future-anchored timestamp without rebasing; the `migration timestamp guard`
-- CI workflow at .github/workflows/ci.yml correctly blocked main until one of
-- the two files was renamed. Demo fixtures merged second so it takes the +1000
-- offset; seating keeps the original timestamp. SQL DDL below is unchanged.
-- Spec context: CLAUDE.md 2026-05-22 marketplace-simulation rows (Agent 1
-- ships seed data + admin cleanup UI; Agent 2 gates demo visibility behind
-- ?demo=1; Agent 3 ships compare view).
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
-- 1. Adds two columns to vendor_profiles:
--      • is_demo          BOOLEAN  — true on rows the seed script creates
--      • demo_batch_id    UUID     — groups rows per seed run (cleanup key)
--    Partial index on (is_demo) WHERE is_demo=TRUE keeps the working set
--    cheap to scan from admin UI + cleanup endpoints regardless of how
--    many real vendors the marketplace ends up with.
--
-- 2. Adds two columns to vendor_services:
--      • starts_at_centavos  INTEGER  — centavos-precision "starts at"
--      • package_inclusions  JSONB    — array of line items inside the package
--    Mirrors the spec request (PHP-centavos canon per the project pricing
--    convention) without breaking the existing `starting_price_php` column
--    that /v/[slug]/page.tsx reads today (line 502). The seed script
--    populates BOTH for consistency.
--
-- 3. Backfills `is_demo=TRUE` on the prior 2026-06-01 test-seed rows
--    (business_slug LIKE 'test-%'). Those rows pre-date this column;
--    flagging them means Agent 2's ?demo=1 gate covers everything created
--    for simulation purposes, not just rows seeded by the new script.
--    A synthetic `demo_batch_id` (legacy) is assigned so they show up
--    as their own batch in the admin UI.
--
-- WHY (per feedback_setnayan_document_changes_with_why.md)
-- --------------------------------------------------------
-- Owner needs to dogfood the marketplace surface (compare view, per-category
-- filters, pricing display) before real vendor curation completes. Real
-- vendor onboarding is gated on FREE Pro launch promo + DTI/BIR + 5%
-- Pay enrollment + 12 verification docs (per CLAUDE.md 2026-05-16 row 8) —
-- those bits ramp post-pilot per the pilot-first timeline. Synthetic
-- vendors tagged with `is_demo=TRUE` give the owner a working marketplace
-- to test against without committing to real vendor relationships yet.
--
-- The flag is the single load-bearing primitive:
--   • Agent 2's ?demo=1 query-param gate filters vendors by is_demo=FALSE
--     by default and OR-includes is_demo=TRUE when the flag is set.
--   • Agent 3's compare view loads from the same vendor_profiles table —
--     no schema awareness needed; the existing browse already filters.
--   • The admin "Cleanup ALL Demo Vendors" button DELETEs by is_demo=TRUE,
--     cascading to vendor_services + vendor_service_attributes + vendor_*
--     descendant tables via existing FK ON DELETE CASCADE.
--
-- HARD CLEANUP DEADLINE: December 1, 2026 (public launch).
-- The CI guard at apps/web/scripts/check-no-demo-in-prod.ts enforces a
-- maximum demo-vendor count post-launch (the guard runs only when the
-- ALLOW_DEMO_VENDORS env flag is unset).
--
-- REVERSIBLE
-- ----------
-- Down migration (commented; owner runs manually if rolled back):
--
--   ALTER TABLE public.vendor_services
--     DROP COLUMN IF EXISTS package_inclusions,
--     DROP COLUMN IF EXISTS starts_at_centavos;
--   DROP INDEX IF EXISTS vendor_profiles_is_demo_idx;
--   ALTER TABLE public.vendor_profiles
--     DROP COLUMN IF EXISTS demo_batch_id,
--     DROP COLUMN IF EXISTS is_demo;
--
-- Idempotent — IF NOT EXISTS guards everywhere; re-run is a no-op.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_profiles · is_demo + demo_batch_id
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS demo_batch_id UUID;

COMMENT ON COLUMN public.vendor_profiles.is_demo IS
  'TRUE = synthetic vendor created by scripts/seed-demo-vendors.ts for '
  'marketplace simulation. Filtered out of public browse by default; '
  'shown only when ?demo=1 is passed (Agent 2 PR). Hard cleanup deadline: '
  '2026-12-01 (public launch).';

COMMENT ON COLUMN public.vendor_profiles.demo_batch_id IS
  'UUID grouping demo rows by seed run. NULL on non-demo rows. Lets admin '
  'cleanup-batch endpoint delete a single seed run while leaving other '
  'demo batches alone (e.g., one batch curated for compare-view dogfood, '
  'one for general browse exploration).';

-- Partial index — only demo rows go in here. Working set stays tiny even
-- as the marketplace fills with real vendors.
CREATE INDEX IF NOT EXISTS vendor_profiles_is_demo_idx
  ON public.vendor_profiles (created_at DESC)
  WHERE is_demo = TRUE;

-- Lookup by batch_id for cleanup-batch + admin list view.
CREATE INDEX IF NOT EXISTS vendor_profiles_demo_batch_id_idx
  ON public.vendor_profiles (demo_batch_id)
  WHERE demo_batch_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. vendor_services · starts_at_centavos + package_inclusions
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS starts_at_centavos INTEGER,
  ADD COLUMN IF NOT EXISTS package_inclusions JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vendor_services.starts_at_centavos IS
  'Starts-at price in PHP centavos (matches the project-wide centavos canon, '
  'cf. service_catalog.price_centavos). NULL = inquire-only. Co-exists with '
  'the older `starting_price_php` column the /v/[slug] page reads today; the '
  'seed script and any new write paths SHOULD populate both (centavos as the '
  'source of truth; the integer-PHP column derives by floor-divide /100). '
  'A future migration may drop starting_price_php once read paths migrate.';

COMMENT ON COLUMN public.vendor_services.package_inclusions IS
  'Array of line-item strings describing what the package includes. Example: '
  '["8 hours of coverage","2 photographers","500 edited high-res photos",'
  '"online gallery for 12 months"]. Empty array (default) means no per-line '
  'breakdown — UI shows just the starts-at price + crew + meal fields.';

-- ADD CONSTRAINT IF NOT EXISTS is not portable in standard Postgres for CHECK
-- constraints; use a DROP+ADD pattern wrapped in a DO block to stay idempotent.
DO $$
BEGIN
  ALTER TABLE public.vendor_services
    DROP CONSTRAINT IF EXISTS vendor_services_starts_at_nonneg;
  ALTER TABLE public.vendor_services
    ADD CONSTRAINT vendor_services_starts_at_nonneg
      CHECK (starts_at_centavos IS NULL OR starts_at_centavos >= 0);
END$$;

-- ----------------------------------------------------------------------------
-- 3. Backfill — flag pre-existing 2026-06-01 test seed as demo
--
-- The prior `marketplace_test_seed_960_vendors.sql` migration created ~960
-- rows with `business_slug LIKE 'test-%'`. These ARE demo data; they just
-- pre-date this column. Flagging them with is_demo=TRUE + a synthetic
-- legacy batch_id puts them under the same gate Agent 2 builds and lets
-- the admin Cleanup UI list them as their own retire-able batch.
--
-- The legacy batch UUID is deterministic so a re-run of this migration
-- doesn't churn the value.
-- ----------------------------------------------------------------------------

UPDATE public.vendor_profiles
   SET is_demo = TRUE,
       demo_batch_id = '00000000-0000-0000-0000-000000000001'::uuid
 WHERE business_slug LIKE 'test-%'
   AND is_demo = FALSE;

-- ----------------------------------------------------------------------------
-- 4. Admin RLS — read demo rows
--
-- The existing admin RLS on vendor_profiles only covers unclaimed rows
-- (user_id IS NULL). Demo rows happen to all be unclaimed (the seed
-- script inserts with user_id=NULL), so the existing policy already
-- grants admin read. No new policy needed for SELECT.
--
-- For DELETE the seed script uses the service-role client (bypasses RLS),
-- so no policy is needed for cleanup either. This block is intentionally
-- empty — documenting the analysis so a future reader doesn't add a
-- redundant policy.
-- ----------------------------------------------------------------------------

COMMIT;
