-- ============================================================================
-- 20260524000000_iteration_0015_home_faq_widget.sql
-- Add the FAQ section as a 15th homepage widget (iteration 0015 § Section
-- 12.5, added 2026-05-20).
--
-- Slot order rationale: FAQ sits BEFORE the dual-CTA conversion module so
-- visitors who scrolled this far still-with-open-questions get them
-- answered, then convert. The pattern matches Stripe / Linear marketing
-- pages — FAQ near the bottom but before the final CTA, not after.
--
-- This bumps two existing widgets one slot:
--   • home_dual_cta_footer  13 → 14
--   • home_platforms        14 → 15
--
-- Cross-references:
--   • 0015_main_website (new Section 12.5)
--   • apps/web/app/page-sections/_FAQ.tsx
--   • apps/web/app/page.tsx (COMPONENT_BY_WIDGET_ID + FALLBACK_WIDGETS)
--   • CLAUDE.md decision log 2026-05-20 (homepage polish)
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Seed the new widget. ON CONFLICT DO NOTHING keeps re-runs safe.
-- ----------------------------------------------------------------------------

INSERT INTO public.site_widgets (widget_id, page, display_order, is_enabled, gate_type, config) VALUES
  ('home_faq', 'home', 13, TRUE, NULL, '{}'::jsonb)
ON CONFLICT (widget_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Re-number display_order for the homepage so FAQ slots in at 13 and
--    the dual-CTA + platforms sections move down one. Statement is
--    idempotent — re-running it on an already-renumbered DB is a no-op
--    because the assignments match what's already there.
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
  WHEN 'home_faq'                 THEN 13
  WHEN 'home_dual_cta_footer'     THEN 14
  WHEN 'home_platforms'           THEN 15
END
WHERE page = 'home'
  AND widget_id IN (
    'home_announcement_bar', 'home_browse_strip', 'home_hero',
    'home_real_numbers', 'home_chaos', 'home_two_sides',
    'home_maria_juan', 'home_in_app_services', 'home_vendor_compat',
    'home_transparent_pricing', 'home_readiness_board', 'home_coverage_map',
    'home_faq', 'home_dual_cta_footer', 'home_platforms'
  );

COMMIT;
