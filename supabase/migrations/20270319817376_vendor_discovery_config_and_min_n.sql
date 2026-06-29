-- ============================================================================
-- Wave 2 substrate — vendor-discovery admin config + reusable min-N helper
-- ============================================================================
-- Foundational infra for the Discovery responsiveness signals (First-Look
-- Window + Shortlist Radar). Honors two locks:
--   • prices/thresholds/SLAs/weights are ADMIN-MANAGED, never hardcoded — so the
--     First-Look SLA window + boost weight and the Radar min-N floor + on/off
--     toggle live as admin-editable rows on platform_settings (the canonical
--     single-row global config, id=1, already admin-RLS).
--   • behavioral data is min-N de-identified — ONE reusable suppression helper
--     (public.min_n_ok) that every de-identified aggregate (Shortlist Radar's
--     rival signals, and the whole Wave-6 analytics group) calls instead of
--     re-deriving the floor each time.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE FUNCTION).
-- No RLS change: platform_settings already enables RLS with admin-only writes;
-- new columns inherit it. No code reads these yet — the First-Look / Shortlist
-- Radar PRs add their born-used getters.
-- ----------------------------------------------------------------------------

BEGIN;

-- First-Look Window tunables ------------------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS firstlook_sla_hours    INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS firstlook_boost_weight NUMERIC NOT NULL DEFAULT 0.10,
  -- Shortlist Radar tunables ------------------------------------------------
  ADD COLUMN IF NOT EXISTS radar_min_n_floor      INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS radar_enabled          BOOLEAN NOT NULL DEFAULT TRUE;

-- Guard rails so an admin can't set values that would break score
-- normalization or leak below-floor aggregates.
ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_firstlook_sla_hours_chk;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_firstlook_sla_hours_chk
  CHECK (firstlook_sla_hours BETWEEN 1 AND 720);
ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_firstlook_boost_weight_chk;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_firstlook_boost_weight_chk
  CHECK (firstlook_boost_weight >= 0 AND firstlook_boost_weight <= 0.5);
ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_radar_min_n_floor_chk;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_radar_min_n_floor_chk
  CHECK (radar_min_n_floor >= 1);

COMMENT ON COLUMN public.platform_settings.firstlook_sla_hours IS
  'First-Look Window (Wave 2): a vendor must reply to a new in-region inquiry within this many hours to earn the responsiveness boost. Admin-managed; never hardcode.';
COMMENT ON COLUMN public.platform_settings.firstlook_boost_weight IS
  'First-Look Window (Wave 2): weight (0–0.5) added to compat-score for vendors meeting the SLA. The matcher re-normalizes so COMPAT_WEIGHTS still sum to 1. Admin-managed.';
COMMENT ON COLUMN public.platform_settings.radar_min_n_floor IS
  'Shortlist Radar (Wave 2): minimum sample size for a de-identified rival-signal aggregate to surface (behavioral-data min-N lock). Admin-managed; >= 1.';
COMMENT ON COLUMN public.platform_settings.radar_enabled IS
  'Shortlist Radar (Wave 2): master on/off for the rival-on-your-date radar feed. Admin-managed.';

-- Reusable min-N suppression helper -----------------------------------------
-- Returns TRUE only when an aggregate's sample count clears the floor, so a
-- de-identified rollup can be surfaced without leaking small-cell counts that
-- could re-identify a couple. The floor is clamped to >= 1 so a misconfigured
-- 0/negative floor can never disable suppression entirely. IMMUTABLE + no table
-- access → safe to inline in WHERE clauses across the analytics surfaces.
CREATE OR REPLACE FUNCTION public.min_n_ok(p_count INTEGER, p_floor INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(p_count, 0) >= GREATEST(COALESCE(p_floor, 1), 1);
$$;

REVOKE ALL ON FUNCTION public.min_n_ok(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.min_n_ok(INTEGER, INTEGER) TO authenticated;

COMMIT;
