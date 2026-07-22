-- vendor deep search free cycle claim
-- ============================================================================
-- H3 money-integrity fix — make the 1-free-Deep-Search-per-cycle allowance
-- CLAIMABLE ATOMICALLY, before the search runs.
--
-- The buy action (app/vendor-dashboard/deep-search/actions.ts) was read-decide-
-- run: it COUNTED a vendor's uses since the cycle start, priced ₱0 when 0, then
-- ran, and only wrote the vendor_deep_search_uses row AFTER the run finished.
-- Concurrent requests all read 0 → all ran free. This adds the column + index
-- the action needs to CLAIM the free run FIRST (insert the usage row before the
-- run), so a burst of requests serializes on a unique violation and exactly ONE
-- free run per cycle can be minted; the losers fall through to the paid ₱500 path.
--
-- KEEP IDEMPOTENT (may be re-applied): ADD COLUMN IF NOT EXISTS + CREATE UNIQUE
-- INDEX IF NOT EXISTS.
-- ============================================================================

BEGIN;

-- The 28-day cycle bucket a FREE run was claimed against (the app computes it as
-- the current cycle start from vendor_profiles.tier_expires_at —
-- deepSearchCycleStartMs). NULL for paid runs and for legacy free rows written
-- before this migration (so they never participate in the one-free-per-cycle
-- unique constraint below).
ALTER TABLE public.vendor_deep_search_uses
  ADD COLUMN IF NOT EXISTS free_cycle_start TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_deep_search_uses.free_cycle_start IS
  'The 28-day cycle bucket a FREE Deep Search run was claimed against. Set only on the free-run atomic-claim path; NULL for paid runs and pre-migration rows. Enforces one free run per (vendor, cycle) via the partial unique index below.';

-- At most ONE free run per (vendor, cycle). Partial (WHERE was_free AND
-- free_cycle_start IS NOT NULL): paid runs (was_free=false) and legacy free rows
-- (free_cycle_start NULL) are unconstrained, so this can never conflict with the
-- existing per-order unique index or with history. The buy action inserts the
-- free-claim row FIRST; a concurrent second insert trips this and re-prices ₱500.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_deep_search_uses_free_cycle_uidx
  ON public.vendor_deep_search_uses (vendor_profile_id, free_cycle_start)
  WHERE was_free = true AND free_cycle_start IS NOT NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION:
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'vendor_deep_search_uses' AND column_name = 'free_cycle_start';
-- -- Expected: one row.
--
-- SELECT indexname FROM pg_indexes
--   WHERE tablename = 'vendor_deep_search_uses'
--     AND indexname = 'vendor_deep_search_uses_free_cycle_uidx';
-- -- Expected: one row.
-- ============================================================================
