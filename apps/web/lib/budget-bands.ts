/**
 * budget-bands.ts — DB-backed read-through for the onboarding budget feel-band
 * ladder (screen 9), owner-approved 2026-06-19.
 *
 * Reads budget_band_config (migration 20270128090927) and reconstructs the SAME
 * BudgetBand[] shape the onboarding shell's old hardcoded BUDGET_BANDS literal
 * exposed, so the onboarding renders DB-sourced bands that update the moment an
 * admin edits them at /admin/budget-planner — no deploy. SAFETY: any error /
 * empty result FALLS BACK to BUDGET_BANDS_FALLBACK (the seed source), so
 * behaviour is preserved even if the table is unseeded. This mirrors the
 * getOnboardingRefinements() DB-first pattern in lib/onboarding-refinements.ts.
 *
 * `med` is in PESOS (per-head median); the DB stores centavos, so we divide by
 * 100 with NO lossy rounding. per_head_median_centavos × pax (peso form ×100)
 * = events.estimated_budget_centavos.
 */
import { createClient } from './supabase/server';
import { BUDGET_BANDS_FALLBACK, type BudgetBand } from './budget-bands-shared';

// Re-exported so existing server-side importers of '@/lib/budget-bands' keep the
// same API (type + fallback). The client-safe definitions now live in
// budget-bands-shared.ts so CLIENT components import them from there WITHOUT
// pulling in the server-only Supabase client imported above (which had reached
// the client/pages bundle and broken the production build).
export { BUDGET_BANDS_FALLBACK } from './budget-bands-shared';
export type { BudgetBand } from './budget-bands-shared';

type BandRow = {
  band_slug: string;
  label: string;
  tag: string | null;
  per_head_median_centavos: number | string;
  sort_order: number;
};

/**
 * Fetch the active budget feel-bands ordered by sort_order. DB-first; on ANY
 * error or empty result returns BUDGET_BANDS_FALLBACK. `med` is centavos/100
 * (pesos) with no lossy rounding.
 */
export async function getBudgetBands(): Promise<BudgetBand[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('budget_band_config')
      .select('band_slug,label,tag,per_head_median_centavos,sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return BUDGET_BANDS_FALLBACK;
    return (data as BandRow[]).map((r) => ({
      value: r.band_slug,
      label: r.label,
      tag: r.tag ?? '',
      med: Number(r.per_head_median_centavos) / 100,
    }));
  } catch {
    return BUDGET_BANDS_FALLBACK;
  }
}
