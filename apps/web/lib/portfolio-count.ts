import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { portfolioPhotoCap } from '@/lib/vendor-tier-caps';
import { allowanceForCap, readPortfolioAllowance } from '@/lib/portfolio-allowance.server';
import { portfolioCountLabel, type PortfolioCount } from '@/lib/portfolio-count-label';

export { portfolioCountLabel, type PortfolioCount } from '@/lib/portfolio-count-label';

/**
 * THE PORTFOLIO COUNT — one read for "N of 50 free photos" (THE ONE BUILD, spec §9 #17: C4 exposes it, C1's Today
 * Portfolio stat and C4's Portfolio pinned row both read it — one number, one home).
 *
 * 🔑 THE SAME FIGURES THE UPLOADER USES. Photos = `vendor_profiles.portfolio_r2_keys` (the page gallery, the only store
 * the free-50 rule counts — `lib/shop-portfolio-credits.ts`); free room = `portfolioPhotoCap(tier, allowance)`, the cap
 * `collections-data.ts` hands `GalleryMedia`. Storage purchase is OFF (spec §1 / §4: "N of 50 free photos while storage
 * purchase is off"), so there is no GB meter here — that is Phase B, out of this build.
 *
 * 🔑 A REFUSED READ IS `{ ok: false }`, NEVER 0. Today prints "couldn't load" for it (A2 A4), never "0 of 50". The
 * allowance read is its own select (`portfolio-allowance.server.ts` says why); while it is unread the free room is not
 * known either, so the whole answer is unread rather than a smaller "of 50" that may not be true.
 */
export async function getPortfolioCount(vendorId: string, client?: SupabaseClient): Promise<PortfolioCount> {
  if (!vendorId) return { ok: false };
  try {
    const supabase = client ?? (await createClient());
    const rowRead = supabase
      .from('vendor_profiles')
      .select('portfolio_r2_keys, tier_state')
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();
    const [{ data, error }, allowance] = await Promise.all([rowRead, readPortfolioAllowance(supabase, vendorId)]);
    if (error) {
      logQueryError('portfolio-count', error, { vendor_profile_id: vendorId }, 'graceful_degrade');
      return { ok: false };
    }
    if (!data || !allowance.ok) return { ok: false };
    const row = data as { portfolio_r2_keys?: string[] | null; tier_state?: string | null };
    const photos = new Set((row.portfolio_r2_keys ?? []).filter(Boolean)).size;
    const free = portfolioPhotoCap(row.tier_state ?? null, allowanceForCap(allowance));
    return { ok: true, photos, free, label: portfolioCountLabel(photos, free) };
  } catch (err) {
    logQueryError('portfolio-count', err, { vendor_profile_id: vendorId });
    return { ok: false };
  }
}
