/**
 * budget-bands-read.ts — the budget feel-band ladder, read with a client the
 * CALLER owns.
 *
 * Split out of budget-bands.ts for the same reason budget-bands-shared.ts was:
 * that module builds its own server Supabase client at import time (→
 * next/headers), so anything importing it inherits a server-only dependency.
 * The band ladder is now needed by lib/budget-allocation-data.ts, which is
 * handed a client and must stay agnostic about where it came from.
 *
 * SAFETY is unchanged and deliberate: any error, any empty result → the in-code
 * BUDGET_BANDS_FALLBACK. A budget band that cannot be read must never become
 * "this couple has no budget" — that answer sinks shops.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { BUDGET_BANDS_FALLBACK, type BudgetBand } from './budget-bands-shared';

type BandRow = {
  band_slug: string;
  label: string;
  tag: string | null;
  per_head_median_centavos: number | string;
  sort_order: number;
};

/**
 * Active feel-bands in sort order. `med` is per-head PESOS (centavos / 100, no
 * lossy rounding). Falls back to BUDGET_BANDS_FALLBACK on any failure.
 */
export async function fetchBudgetBands(client: SupabaseClient): Promise<BudgetBand[]> {
  try {
    const { data, error } = await client
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
