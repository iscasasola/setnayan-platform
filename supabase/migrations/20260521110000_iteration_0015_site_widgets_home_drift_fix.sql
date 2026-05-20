-- ============================================================================
-- 20260521110000_iteration_0015_site_widgets_home_drift_fix.sql
-- Fix drift between the admin Website editor (/admin/website) and the live
-- homepage. Two widgets were already shipping in apps/web/app/page.tsx but
-- missing from the original seed in 20260515010000_site_widgets.sql:
--
--   • home_browse_strip        — pre-launch "Browse vendors" entry strip
--                                under the site header (decision-log row 426,
--                                2026-05-19).
--   • home_transparent_pricing — couple-side disclosure of the 5.0% Setnayan
--                                Pay convenience fee (locked 2026-05-16,
--                                spec-corpus decision-log row 9).
--
-- Until this migration, the home page hardcoded all sections in render order
-- and ignored `site_widgets` entirely (see the TODO removed in this PR's
-- page.tsx change). Toggles + reorders in the editor were no-ops on the
-- public site. Re-aligning the seed with the live render order so the first
-- admin edit doesn't visually shuffle the page.
--
-- Safe to overwrite display_order here: the renderer didn't consume it
-- before this PR, so any prior admin reorder was a no-op and no
-- admin-edited state is being lost.
--
-- Cross-references:
--   • 0015_main_website § Widget architecture
--   • 0023_admin_console § 3.10 Website editor
--   • CLAUDE.md decision log 2026-05-15 (widget registry)
--   • CLAUDE.md decision log 2026-05-16 (transparent-pricing section)
--   • CLAUDE.md decision log 2026-05-19 row 426 (browse strip)
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Seed the two missing widgets. ON CONFLICT DO NOTHING keeps re-runs
--    safe: if an operator has already inserted these rows by hand, this
--    statement is a no-op and the UPDATE below still places them in the
--    correct display_order.
-- ----------------------------------------------------------------------------

INSERT INTO public.site_widgets (widget_id, page, display_order, is_enabled, gate_type, config) VALUES
  ('home_browse_strip',        'home',  2, TRUE, NULL, '{}'::jsonb),
  ('home_transparent_pricing', 'home', 10, TRUE, NULL, '{}'::jsonb)
ON CONFLICT (widget_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Renumber display_order for all 14 home widgets to match the live
--    apps/web/app/page.tsx render order.
-- ----------------------------------------------------------------------------

UPDATE public.site_widgets SET display_order = CASE widget_id
  WHEN 'home_announcement_bar'    THEN  1
  WHEN 'home_browse_strip'        THEN  2
  WHEN 'home_hero'                THEN  3
  WHEN 'home_real_numbers'        THEN  4
  WHEN 'home_chaos'               THEN  5
  WHEN 'home_two_sides'           THEN  6
  WHEN 'home_maria_juan'          THEN  7
  WHEN 'home_in_app_services'     THEN  8
  WHEN 'home_vendor_compat'       THEN  9
  WHEN 'home_transparent_pricing' THEN 10
  WHEN 'home_readiness_board'     THEN 11
  WHEN 'home_coverage_map'        THEN 12
  WHEN 'home_dual_cta_footer'     THEN 13
  WHEN 'home_platforms'           THEN 14
END
WHERE page = 'home'
  AND widget_id IN (
    'home_announcement_bar', 'home_browse_strip', 'home_hero',
    'home_real_numbers', 'home_chaos', 'home_two_sides',
    'home_maria_juan', 'home_in_app_services', 'home_vendor_compat',
    'home_transparent_pricing', 'home_readiness_board', 'home_coverage_map',
    'home_dual_cta_footer', 'home_platforms'
  );

COMMIT;
