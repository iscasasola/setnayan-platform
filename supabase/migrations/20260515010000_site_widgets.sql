-- ============================================================================
-- 20260515010000_site_widgets.sql
-- Decision 6 (locked 2026-05-15) — Widget registry generalizing the
-- per-section gating pattern from 0015 § Section 3 (count-gated stats) and
-- § Section 12 (per-tile platform availability) into one extensible table.
--
-- Each row represents one marketing-site widget on one page. Admins (via
-- /admin/website iteration 0023 § 3.10) can toggle is_enabled and reorder
-- display_order; per-widget config stays code-locked in V1.
--
-- Three gate types (governing widget render logic outside the schema):
--   • NULL        — always-on widget; renders iff is_enabled=TRUE
--   • 'count'     — count-threshold gated (Section 3 real numbers)
--   • 'per_tile'  — per-tile gated (Section 12 platforms)
--
-- Seed data: 12 home-page widgets per 0015 § Widget architecture. Idempotent
-- via ON CONFLICT DO NOTHING — re-running this migration on a populated DB
-- never overrides admin edits to display_order or is_enabled.
--
-- Cross-references:
--   • 0015_main_website § Widget architecture
--   • 0023_admin_console § 3.10 Website editor
--   • CLAUDE.md decision log 2026-05-15
--
-- Replaces (logically) the standalone site_visibility_flags table from the
-- earlier 2026-05-15 entry — folded into is_enabled + derived count-gate.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. site_widgets
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_widgets (
  widget_id            TEXT PRIMARY KEY,
  page                 TEXT NOT NULL,
  display_order        INT  NOT NULL,
  is_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  gate_type            TEXT,                            -- NULL | 'count' | 'per_tile'
  config               JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_admin_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT site_widgets_gate_type_check
    CHECK (gate_type IS NULL OR gate_type IN ('count', 'per_tile'))
);

CREATE INDEX IF NOT EXISTS idx_site_widgets_by_page
  ON public.site_widgets(page, display_order);

-- ----------------------------------------------------------------------------
-- 2. RLS — anon can read; admin can write (via service-role typically,
--    authenticated-admin path included for completeness).
-- ----------------------------------------------------------------------------

ALTER TABLE public.site_widgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_widgets_public_read ON public.site_widgets;
CREATE POLICY site_widgets_public_read
  ON public.site_widgets FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS site_widgets_admin_write_update ON public.site_widgets;
CREATE POLICY site_widgets_admin_write_update
  ON public.site_widgets FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS site_widgets_admin_write_insert ON public.site_widgets;
CREATE POLICY site_widgets_admin_write_insert
  ON public.site_widgets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_site_widgets_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS site_widgets_set_updated_at ON public.site_widgets;
CREATE TRIGGER site_widgets_set_updated_at
  BEFORE UPDATE ON public.site_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_site_widgets_set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Seed — 12 home-page widgets per 0015 § Widget architecture.
--
-- Idempotent via ON CONFLICT DO NOTHING — admin edits to display_order /
-- is_enabled / config survive re-runs.
-- ----------------------------------------------------------------------------

INSERT INTO public.site_widgets (widget_id, page, display_order, is_enabled, gate_type, config) VALUES
  ('home_announcement_bar', 'home',  1, TRUE, NULL,       '{"hide_when_verified_vendors_gte": 500}'::jsonb),
  ('home_hero',             'home',  2, TRUE, NULL,       '{"variant": "three_question"}'::jsonb),
  ('home_real_numbers',     'home',  3, TRUE, 'count',    '{"thresholds": {"vendors": 100, "events": 25, "couples": 1000, "cities": 5}}'::jsonb),
  ('home_chaos',            'home',  4, TRUE, NULL,       '{}'::jsonb),
  ('home_two_sides',        'home',  5, TRUE, NULL,       '{}'::jsonb),
  ('home_maria_juan',       'home',  6, TRUE, NULL,       '{}'::jsonb),
  ('home_in_app_services',  'home',  7, TRUE, NULL,       '{}'::jsonb),
  ('home_vendor_compat',    'home',  8, TRUE, NULL,       '{}'::jsonb),
  ('home_readiness_board',  'home',  9, TRUE, NULL,       '{"post_launch_swap": "social_proof_when_stats_visible"}'::jsonb),
  ('home_coverage_map',     'home', 10, TRUE, NULL,       '{}'::jsonb),
  ('home_dual_cta_footer',  'home', 11, TRUE, NULL,       '{}'::jsonb),
  ('home_platforms',        'home', 12, TRUE, 'per_tile', '{"platforms": ["web", "windows", "macos", "ios", "ipados", "android"]}'::jsonb)
ON CONFLICT (widget_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. platform_availability (sibling table for the home_platforms widget)
--
-- Per 0015 § Widget architecture, this is a logically-linked sibling table
-- (NOT a foreign-key relationship — the widget_id is referenced by
-- convention). Each row controls one platform tile on the home_platforms
-- widget. Web defaults to visible; native platforms default hidden until
-- the owner sets a store_url.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_availability (
  platform_id  TEXT PRIMARY KEY,                          -- web | windows | macos | ios | ipados | android
  label        TEXT NOT NULL,
  store_url    TEXT,
  is_visible   BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_availability_public_read ON public.platform_availability;
CREATE POLICY platform_availability_public_read
  ON public.platform_availability FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS platform_availability_admin_write_update ON public.platform_availability;
CREATE POLICY platform_availability_admin_write_update
  ON public.platform_availability FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.platform_availability (platform_id, label, store_url, is_visible, display_order) VALUES
  ('web',     'Web',         '/',  TRUE,  1),
  ('windows', 'Windows',     NULL, FALSE, 2),
  ('macos',   'macOS',       NULL, FALSE, 3),
  ('ios',     'iOS',         NULL, FALSE, 4),
  ('ipados',  'iPadOS',      NULL, FALSE, 5),
  ('android', 'Android',     NULL, FALSE, 6)
ON CONFLICT (platform_id) DO NOTHING;

COMMIT;
