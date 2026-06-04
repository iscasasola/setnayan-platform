-- ============================================================================
-- 20260809000000_vendor_profiles_capacity.sql
--
-- Pax dimension for the Hybrid leaf-match contract (CLAUDE.md 2026-06-04 ·
-- [[project_setnayan_leaf_match_contract]]). Adds reception-venue capacity to
-- vendor_profiles so the marketplace + onboarding matcher can drop venues that
-- physically can't fit the couple's guest count (events.estimated_pax).
--
-- Additive + NULLABLE on purpose: ONLY reception venues populate capacity. Every
-- other vendor (photographer, caterer crew, host, …) stays NULL = "no capacity
-- constraint", which the matcher reads as Hybrid admit-unknown (never hidden).
--
-- Deliberately NOT added to the vendor_market_stats view: the matcher reads
-- capacity via a small candidate-pool lookup on vendor_profiles instead, so the
-- live view (consumed by /vendors + the wizard) is left byte-identical — no
-- CREATE OR REPLACE VIEW, no risk to the marketplace read-path.
-- ============================================================================

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS capacity_min INT,
  ADD COLUMN IF NOT EXISTS capacity_max INT;

COMMENT ON COLUMN public.vendor_profiles.capacity_max IS
  'Reception-venue max seated guests (Pax). NULL = no capacity constraint '
  '(non-venue vendor, or a venue that hasn''t stated it). The leaf-match matcher '
  'excludes a venue when capacity_max < event.estimated_pax (Hybrid: NULL admits).';

COMMENT ON COLUMN public.vendor_profiles.capacity_min IS
  'Reception-venue minimum seated guests (some venues set a floor). Stored for '
  'completeness; V1 matcher filters on capacity_max only.';

-- Partial index: only venue rows carry capacity and the matcher filters on the
-- max, so index just the non-NULL maxes.
CREATE INDEX IF NOT EXISTS vendor_profiles_capacity_max_idx
  ON public.vendor_profiles (capacity_max)
  WHERE capacity_max IS NOT NULL;
