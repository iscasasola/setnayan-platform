/**
 * 🖼 TODAY'S PORTFOLIO STAT — "12 · photos" (THE ONE BUILD A4). No "of 50" since 2026-11-23: the portfolio cap is dropped
 * and storage is the only limit (owner, *"Yes, drop it"*).
 *
 * The count is the ONE read (`getPortfolioCount`, `lib/portfolio-count.ts` — the same figure the Portfolio tab uses).
 * A refused read is `null` — Today then says it couldn't load, never "0".
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPortfolioCount } from '@/lib/portfolio-count';

export type TodayPortfolioCount = { used: number } | null | undefined;

export async function readTodayPortfolioCount(vendorProfileId: string, client?: SupabaseClient): Promise<TodayPortfolioCount> {
  const c = await getPortfolioCount(vendorProfileId, client);
  return c.ok ? { used: c.photos } : null;
}
