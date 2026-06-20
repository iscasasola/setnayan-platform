-- 20270128090927_budget_band_config.sql
-- Admin-tunable 7-band budget feel ladder for onboarding screen 9.
-- Replaces the hardcoded onboarding-shell BUDGET_BANDS literal. DB-first w/
-- in-code fallback (apps/web/lib/budget-bands.ts BUDGET_BANDS_FALLBACK).
-- Prefix auto-allocated via `pnpm migration:new` (sorts after every existing
-- migration). Idempotent — safe to re-apply.
BEGIN;
CREATE TABLE IF NOT EXISTS public.budget_band_config (
  band_slug                TEXT PRIMARY KEY
                             CHECK (band_slug IN ('essentials','simple','classic','elevated','premium','luxury','no_limit')),
  label                    TEXT NOT NULL,
  tag                      TEXT NOT NULL DEFAULT '',
  per_head_median_centavos BIGINT NOT NULL DEFAULT 0 CHECK (per_head_median_centavos >= 0),
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.budget_band_config IS 'Admin-tunable 7-band budget feel ladder for onboarding screen 9 (replaces hardcoded onboarding-shell BUDGET_BANDS). per_head_median_centavos x pax = events.estimated_budget_centavos. Authenticated-read, admin-write. DB-first w/ in-code fallback.';
INSERT INTO public.budget_band_config (band_slug, label, tag, per_head_median_centavos, sort_order) VALUES
  ('essentials','Essentials','Lean & intentional',200000,10),
  ('simple','Simple','Comfortable',350000,20),
  ('classic','Classic','The sweet spot',500000,30),
  ('elevated','Elevated','Polished',750000,40),
  ('premium','Premium','Entry luxury',1100000,50),
  ('luxury','Luxury','No-compromise',1500000,60),
  ('no_limit','No limit','No ceiling',0,70)
ON CONFLICT (band_slug) DO NOTHING;
ALTER TABLE public.budget_band_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_band_config_admin_all ON public.budget_band_config;
CREATE POLICY budget_band_config_admin_all ON public.budget_band_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS budget_band_config_read ON public.budget_band_config;
CREATE POLICY budget_band_config_read ON public.budget_band_config FOR SELECT TO authenticated USING (TRUE);
COMMIT;
