/**
 * 🖼 TODAY'S PORTFOLIO STAT — "N of 50 · free photos" (THE ONE BUILD A4, spec §4: "Portfolio stat = 'N of 50 free
 * photos' while storage purchase is off").
 *
 * The count is C4's ONE read (`getPortfolioCount`, `lib/portfolio-count.ts` — the same figures the uploader and the
 * Portfolio tab use; spec §9 #17), swapped in for C1's typed stub at integration. Mapped to `{ used, free }`; a refused
 * read is `null` — Today then says it couldn't load, never "0 of 50".
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPortfolioCount } from '@/lib/portfolio-count';

export type TodayPortfolioCount = { used: number; free: number } | null | undefined;

export async function readTodayPortfolioCount(vendorProfileId: string, client?: SupabaseClient): Promise<TodayPortfolioCount> {
  const c = await getPortfolioCount(vendorProfileId, client);
  return c.ok ? { used: c.photos, free: c.free } : null;
}
