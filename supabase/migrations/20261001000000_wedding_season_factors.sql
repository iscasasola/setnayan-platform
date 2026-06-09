-- Wedding seasonality factors (Budget "Build" Phase 3b · date-aware pricing).
-- Plan: Budget_Build_Pin_Solver_Plan_2026-06-09.md.
--
-- A per-(region, month) price multiplier applied to the budget allocator's BENCHMARK
-- estimates — peak wedding months cost more across the board. Ships NEUTRAL: the table
-- is EMPTY and `resolveAllocationInputs` defaults the factor to 1.0 when no row exists,
-- so there is ZERO pricing effect until an admin seeds real factors (owner-to-set;
-- never invented). Shared by /budget + the Build takeover. REAL vendor medians are
-- never scaled — seasonality only moves the benchmark fallback. Factors are reference
-- data (not couple-specific): authenticated read, admin-only write.

CREATE TABLE IF NOT EXISTS public.wedding_season_factors (
  region      TEXT NOT NULL,
  month       SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  -- Multiplier on benchmark prices for this region+month. 1.0 = neutral.
  factor      NUMERIC(4, 2) NOT NULL DEFAULT 1.0 CHECK (factor > 0 AND factor <= 5),
  note        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (region, month)
);

COMMENT ON TABLE public.wedding_season_factors IS
  'Per-(region, month) benchmark price multiplier for the budget allocator (Budget Build Phase 3b). Empty = neutral (resolver defaults factor=1.0). Admin-seeded; never invented. Design: Budget_Build_Pin_Solver_Plan_2026-06-09.md.';

ALTER TABLE public.wedding_season_factors ENABLE ROW LEVEL SECURITY;

-- Reference data — any authenticated user may read (it shapes their own estimate).
DROP POLICY IF EXISTS read_wedding_season_factors ON public.wedding_season_factors;
CREATE POLICY read_wedding_season_factors ON public.wedding_season_factors
  FOR SELECT TO authenticated
  USING (true);

-- Admin-only write (canonical is_admin() helper). Permissive policies are OR-ed,
-- so SELECT stays open to authenticated via the policy above; writes need is_admin().
DROP POLICY IF EXISTS admin_writes_wedding_season_factors ON public.wedding_season_factors;
CREATE POLICY admin_writes_wedding_season_factors ON public.wedding_season_factors
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
