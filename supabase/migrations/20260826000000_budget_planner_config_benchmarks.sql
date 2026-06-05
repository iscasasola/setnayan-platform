-- Budget Planner — admin-managed engine config + per-leaf benchmark seeds.
-- Design: Budget_Planner_Allocation_Engine_2026-06-05.md §3/§10 (spec corpus).
--
-- The allocation engine (lib/budget-allocation.ts) is pure; these two tables are
-- its admin-tunable FUEL, read server-side by the resolver (lib/budget-allocation-
-- data.ts):
--   • budget_allocation_config  — the engine knobs (min-N, confidence cutoffs,
--     band width, surplus mode). One singleton row.
--   • budget_leaf_benchmarks    — a typical ₱ per service leaf (the 26 PLAN_GROUPS
--     from lib/wedding-plan-groups.ts), used when a leaf has too few real solo
--     vendor prices to median (the founder-only-marketplace reality). The admin
--     SEEDS the prices; they are the ONLY non-market numbers the engine touches,
--     and they are NEVER invented here — rows seed with label only, price NULL,
--     for the admin to fill in /admin/budget-planner.
--
-- RLS: admin manages; any authenticated user may READ (this is non-PII config —
-- the couple's planner reads benchmarks/config server-side to render guidance).
-- Pattern mirrors planning_deadlines (admin-all + authenticated read TRUE).

-- ── 1. Engine config (singleton) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_allocation_config (
  config_key        TEXT PRIMARY KEY DEFAULT 'default',
  min_sample_n      INTEGER NOT NULL DEFAULT 3  CHECK (min_sample_n >= 1),
  high_confidence_n INTEGER NOT NULL DEFAULT 8  CHECK (high_confidence_n >= 1),
  med_confidence_n  INTEGER NOT NULL DEFAULT 3  CHECK (med_confidence_n >= 1),
  band_pct          NUMERIC(4,3) NOT NULL DEFAULT 0.150 CHECK (band_pct >= 0 AND band_pct <= 1),
  surplus_mode      TEXT NOT NULL DEFAULT 'park' CHECK (surplus_mode IN ('park','distribute')),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.budget_allocation_config IS
  'Admin-tunable knobs for the budget allocation engine (lib/budget-allocation.ts DEFAULT_ALLOCATION_CONFIG). Singleton row config_key=default. Non-PII; authenticated-read.';

INSERT INTO public.budget_allocation_config (config_key) VALUES ('default')
ON CONFLICT (config_key) DO NOTHING;

ALTER TABLE public.budget_allocation_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_allocation_config_admin_all ON public.budget_allocation_config;
CREATE POLICY budget_allocation_config_admin_all ON public.budget_allocation_config
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS budget_allocation_config_read ON public.budget_allocation_config;
CREATE POLICY budget_allocation_config_read ON public.budget_allocation_config
  FOR SELECT TO authenticated USING (TRUE);

-- ── 2. Per-leaf benchmark seeds (the 26 PLAN_GROUPS) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_leaf_benchmarks (
  plan_group_id  TEXT PRIMARY KEY,
  label          TEXT NOT NULL,
  -- Admin-set typical/floor/quartile ₱ for this leaf. NULL = not seeded yet
  -- (the engine then has no benchmark and the leaf reads as "not enough data").
  benchmark_php  INTEGER CHECK (benchmark_php IS NULL OR benchmark_php >= 0),
  floor_php      INTEGER CHECK (floor_php IS NULL OR floor_php >= 0),
  p25_php        INTEGER CHECK (p25_php IS NULL OR p25_php >= 0),
  p75_php        INTEGER CHECK (p75_php IS NULL OR p75_php >= 0),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.budget_leaf_benchmarks IS
  'Admin-seeded typical ₱ per wedding service leaf (the 26 PLAN_GROUPS). Engine fallback when real solo vendor prices are too thin to median. Prices are owner/admin-set in /admin/budget-planner — NEVER invented. Non-PII; authenticated-read.';

-- Seed the 26 leaves with label + sort only — PRICES STAY NULL (admin fills them).
INSERT INTO public.budget_leaf_benchmarks (plan_group_id, label, sort_order) VALUES
  ('reception_venue',        'Reception venue',          10),
  ('ceremony_venue',         'Ceremony venue',           20),
  ('catering',               'Catering',                 30),
  ('photography',            'Photography & Video',      40),
  ('coordinator',            'Wedding coordinator',      50),
  ('officiant',              'Officiant',                60),
  ('hair_makeup',            'Hair & Makeup',            70),
  ('attire',                 'Attire',                   80),
  ('florals_decor',          'Florals & Decor',          90),
  ('stylist',                'Stylist',                 100),
  ('live_band',              'Live band',               110),
  ('music_entertainment',    'Band / DJ / Performer',   120),
  ('host_mc',                'Host / MC',               130),
  ('lights_sound',           'Lights & Sound',          140),
  ('led_background',         'LED Background',           150),
  ('cake',                   'Cake',                    160),
  ('cocktail_booths',        'Cocktail Booths',         170),
  ('photobooth',             'Photobooth',              180),
  ('dance_instructor',       'Dance instructor',        190),
  ('after_party_music',      'After-party DJ',          200),
  ('bridal_car',             'Bridal Car',              210),
  ('guest_shuttle',          'Guest Shuttle',           220),
  ('rings',                  'Rings',                   230),
  ('accommodation',          'Accommodation',           240),
  ('invitations_stationery', 'Invitations & Stationery',250),
  ('logistics',              'Logistics & Misc',        260)
ON CONFLICT (plan_group_id) DO NOTHING;

ALTER TABLE public.budget_leaf_benchmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_leaf_benchmarks_admin_all ON public.budget_leaf_benchmarks;
CREATE POLICY budget_leaf_benchmarks_admin_all ON public.budget_leaf_benchmarks
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS budget_leaf_benchmarks_read ON public.budget_leaf_benchmarks;
CREATE POLICY budget_leaf_benchmarks_read ON public.budget_leaf_benchmarks
  FOR SELECT TO authenticated USING (TRUE);
