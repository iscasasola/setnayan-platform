import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { countPortfolioPhotos, portfolioCountLabel, type PortfolioCount } from '@/lib/portfolio-count-label';

export { portfolioCountLabel, type PortfolioCount } from '@/lib/portfolio-count-label';

/**
 * THE PORTFOLIO COUNT — one read for "12 photos" (THE ONE BUILD, spec §9 #17: Today's Portfolio stat and Portfolio's
 * pinned row both read it — one number, one home). Photos = `vendor_profiles.portfolio_r2_keys`, the page gallery.
 *
 * 🔓 No free room and no cap since 2026-11-23 (owner: *"Yes, drop it"* — storage is the only limit), so the count no
 * longer reads the plan or the shop's personal-invite allowance.
 *
 * 🔑 A REFUSED READ IS `{ ok: false }`, NEVER 0. Today prints "couldn't load" for it, never "0 photos".
 */
export async function getPortfolioCount(vendorId: string, client?: SupabaseClient): Promise<PortfolioCount> {
  if (!vendorId) return { ok: false };
  try {
    const supabase = client ?? (await createClient());
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('portfolio_r2_keys')
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();
    if (error) {
      logQueryError('portfolio-count', error, { vendor_profile_id: vendorId }, 'graceful_degrade');
      return { ok: false };
    }
    if (!data) return { ok: false };
    const row = data as { portfolio_r2_keys?: string[] | null };
    const photos = countPortfolioPhotos(row.portfolio_r2_keys);
    return { ok: true, photos, label: portfolioCountLabel(photos) };
  } catch (err) {
    logQueryError('portfolio-count', err, { vendor_profile_id: vendorId });
    return { ok: false };
  }
}
