/**
 * site_widgets registry helpers — Decision 6 (2026-05-15).
 *
 * Each row represents one marketing-site widget on one page. The admin
 * Website editor (/admin/website, iteration 0023 § 3.10) lets admins
 * toggle is_enabled + reorder display_order. Per-widget config stays
 * code-locked in V1.
 *
 * See:
 *   • 0015_main_website § Widget architecture
 *   • 0023_admin_console § 3.10 Website editor
 *   • CLAUDE.md decision log 2026-05-15
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type WidgetGateType = 'count' | 'per_tile' | null;

export type SiteWidgetPage = 'home' | 'for_vendors' | 'features' | 'about';

export const SITE_WIDGET_PAGES: ReadonlyArray<{
  key: SiteWidgetPage;
  label: string;
  url: string;
}> = [
  { key: 'home', label: 'Home', url: '/' },
  { key: 'for_vendors', label: 'For vendors', url: '/for-vendors' },
  { key: 'features', label: 'Features', url: '/features' },
  { key: 'about', label: 'About', url: '/about' },
];

export type SiteWidgetRow = {
  widget_id: string;
  page: string;
  display_order: number;
  is_enabled: boolean;
  gate_type: WidgetGateType;
  config: Record<string, unknown>;
  updated_at: string;
  updated_by_admin_id: string | null;
};

/**
 * Human-readable labels for the home-page widgets. Keys MUST match the
 * seeded widget_id values in 20260515010000_site_widgets.sql +
 * 20260521100000_iteration_0015_site_widgets_home_drift_fix.sql.
 */
export const WIDGET_LABEL: Record<string, string> = {
  home_announcement_bar: 'Announcement bar',
  home_browse_strip: 'Browse strip',
  home_hero: 'Hero',
  home_real_numbers: 'Real numbers',
  home_chaos: 'The chaos we’re fixing',
  home_two_sides: 'Built for both sides',
  home_maria_juan: 'Maria & Juan',
  home_in_app_services: 'In-app services',
  home_vendor_compat: 'Vendor compatibility',
  home_transparent_pricing: 'Transparent pricing',
  home_readiness_board: 'Readiness board',
  home_coverage_map: 'Coverage map',
  home_dual_cta_footer: 'Dual CTA footer',
  home_platforms: 'Platforms',
};

export function widgetLabel(widgetId: string): string {
  return WIDGET_LABEL[widgetId] ?? widgetId;
}

/**
 * Fetch all widgets for a given page, ordered by display_order. Caller is
 * expected to use a service-role client (admin surface) — the public
 * marketing-site renderer can use the same query with the anon client.
 */
export async function fetchWidgetsForPage(
  supabase: SupabaseClient,
  page: SiteWidgetPage,
): Promise<SiteWidgetRow[]> {
  const { data, error } = await supabase
    .from('site_widgets')
    .select('widget_id,page,display_order,is_enabled,gate_type,config,updated_at,updated_by_admin_id')
    .eq('page', page)
    .order('display_order', { ascending: true });
  if (error) throw new Error(`fetchWidgetsForPage failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    config: (row.config ?? {}) as Record<string, unknown>,
  })) as SiteWidgetRow[];
}
