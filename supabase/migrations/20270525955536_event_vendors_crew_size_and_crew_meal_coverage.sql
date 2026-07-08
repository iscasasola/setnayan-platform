-- event_vendors_crew_size_and_crew_meal_coverage
--
-- Crew-Meal Provider Marketplace — coverage & derived quantity (owner-locked
-- 2026-07-09): a booked crew-meal provider covers the crews of OTHER booked
-- vendors. The couple marks which vendors are covered; each covered vendor
-- contributes its crew size; total meals = Σ covered crew sizes. A covered
-- vendor's own per-vendor "crew meal" budget line (food_allowance_php) is
-- superseded (nulled on save) so the crew-meal cost is counted ONCE — in the
-- provider's package — not twice.
--
-- Two additive columns on event_vendors (inherits the existing couple-only RLS
-- — event_vendors_couple_read/write via current_couple_event_ids()). Idempotent.

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS crew_size INTEGER,
  ADD COLUMN IF NOT EXISTS crew_meal_covered BOOLEAN NOT NULL DEFAULT FALSE;

-- crew_size is the number of crew this booked vendor brings that need feeding
-- ("quantity set by vendors" — the couple records each vendor's crew; a
-- marketplace booking can seed it from the vendor's listing crew_size later).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_vendors_crew_size_nonneg'
  ) THEN
    ALTER TABLE public.event_vendors
      ADD CONSTRAINT event_vendors_crew_size_nonneg
      CHECK (crew_size IS NULL OR crew_size >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.event_vendors.crew_size IS
  'Crew this booked vendor brings that need feeding on the day. Feeds the crew-meal provider''s derived meal count (Σ crew_size WHERE crew_meal_covered).';
COMMENT ON COLUMN public.event_vendors.crew_meal_covered IS
  'TRUE = this vendor''s crew is fed by the event''s crew-meal provider (category=crew_meals). When TRUE the couple''s per-vendor food_allowance_php is superseded (nulled on save) to avoid double-counting the crew-meal cost.';
