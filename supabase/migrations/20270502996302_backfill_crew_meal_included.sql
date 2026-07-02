-- backfill_crew_meal_included
-- ============================================================================
-- SERVICE-CARD REDESIGN — Phase 3a data backfill. The pricing/media/discounts
-- migration (20270502342558) added crew_meal_included DEFAULT FALSE but did NOT
-- derive it from the legacy crew_meal_required flag, so every pre-Phase-3a row
-- reads "crew meal NOT included" even when the couple was never asked to provide
-- one (crew_meal_required = FALSE). The Phase-3a edit UI keeps the two columns in
-- sync as inverses (crew_meal_required := NOT crew_meal_included); this one-time
-- reconciliation makes that true for existing rows so:
--   • the service card shows the correct "included" state, and
--   • editing a legacy service doesn't flip crew_meal_required (and silently add
--     a crew-meal line to the couple's 0007 budget).
--
-- Pure data UPDATE — no schema change, safe in any deploy order (old code reads
-- crew_meal_required, which is unchanged; new code reads crew_meal_included,
-- which becomes correct). IDEMPOTENT: re-running re-derives the same value
-- (once the bridge holds, crew_meal_required = NOT crew_meal_included, so
-- NOT crew_meal_required = crew_meal_included again). Only touches rows that are
-- currently inconsistent.
-- ============================================================================
UPDATE public.vendor_services
SET crew_meal_included = NOT crew_meal_required
WHERE crew_meal_included IS DISTINCT FROM (NOT crew_meal_required);
