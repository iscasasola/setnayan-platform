import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { allowanceForCap, readPortfolioAllowance } from '@/lib/portfolio-allowance.server';
import { fetchShopWalletBalance } from '@/lib/shop-wallet.server';
import { portfolioPhotoCap } from '@/lib/vendor-tier-caps';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';

/**
 * The Upload doors' facts — the SAME reads and the same cap Portfolio's page makes (`collections-data.ts`), so the
 * sheet a door opens prices a photo exactly as Portfolio would. `tier` is the caller's own read of `tier_state` (Shop
 * has it on its own row; Today passes its shop-row read). A refused read stays refused: the wallet `null`, the
 * allowance `allowanceUnread` — never a number in their place.
 */
export async function readPortfolioUploadFacts(
  supabase: SupabaseClient,
  vendorProfileId: string,
  storedRefs: string[],
  tier: Promise<string | null | undefined> | string | null | undefined,
): Promise<PortfolioUploadFacts> {
  const [allowance, walletBalance, tierState] = await Promise.all([
    readPortfolioAllowance(supabase, vendorProfileId),
    fetchShopWalletBalance(supabase, vendorProfileId).catch(() => null),
    Promise.resolve(tier).catch(() => null),
  ]);
  return {
    vendorProfileId,
    storedRefs,
    free: portfolioPhotoCap(tierState ?? null, allowanceForCap(allowance)),
    allowanceUnread: !allowance.ok,
    walletBalance,
  };
}
