/**
 * apps/web/lib/papic-tier-config-read.ts
 *
 * SERVER-side convenience wrapper over `fetchPapicTierConfig` for surfaces that
 * have no request-scoped Supabase client of their own (/pricing, the homepage
 * pricing data). Builds an admin client, memoized per request via React
 * `cache()` — the same shape `fetchV2CustomerCatalog` uses.
 *
 * Kept OUT of `lib/papic-tier-copy.ts` on purpose: that module is imported by
 * client components for its pure copy helpers, and must never pull the
 * service-role client into a browser bundle.
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchPapicTierConfig,
  PAPIC_TIER_CONFIG_FALLBACK,
  type PapicTierConfig,
} from '@/lib/papic-tier-copy';

/**
 * The live tier config, or the documented seed mirror when the service-role key
 * is absent (CI `next build` runs with placeholder env). Never throws.
 */
export const readPapicTierConfig = cache(async (): Promise<PapicTierConfig> => {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ...PAPIC_TIER_CONFIG_FALLBACK };
  }
  return fetchPapicTierConfig(admin);
});
