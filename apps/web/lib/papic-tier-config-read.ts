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
import {
  fetchPapicOneTiers,
  FALLBACK_ONE_TIERS,
  type PapicOneTier,
} from '@/lib/papic-one';

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

/**
 * The live Papic ONE rungs (`papic_one_tiers`), for the same server surfaces.
 *
 * WHY THIS IS A SEPARATE READ FROM `readPapicTierConfig` (2026-07-29). Under the
 * two-type model a One camera holds a LIFETIME bucket of dedicated points, and
 * that number lives in `papic_one_tiers` — NOT in `papic_tier_config.
 * points_per_day`, which is the old per-day meter. On prod the 'mini' row's
 * `points_per_day` is NULL, and NULL means "unlimited" to every copy helper, so
 * a surface that still derived One's capacity from the tier config rendered
 * "unlimited shots per day" for a ₱50 camera that actually holds 50 shots.
 * Reading the rung table is what makes the claim true.
 *
 * `fetchPapicOneTiers` never throws — it falls back to the owner-locked seed —
 * so this only needs to guard the client construction, like its sibling above.
 */
export const readPapicOneTiers = cache(async (): Promise<PapicOneTier[]> => {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // No service-role key (CI `next build` runs with placeholder env) — the
    // module's own documented seed answers, rather than a second copy here.
    return [...FALLBACK_ONE_TIERS];
  }
  return fetchPapicOneTiers(admin);
});
