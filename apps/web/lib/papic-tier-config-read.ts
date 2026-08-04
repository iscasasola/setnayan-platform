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
  fetchPapicFreeGrantPoints,
  PAPIC_TIER_CONFIG_FALLBACK,
  PAPIC_FREE_GRANT_POINTS_FALLBACK,
  type PapicTierConfig,
} from '@/lib/papic-tier-copy';
import {
  fetchPapicOneTiers,
  fetchPapicFreeOneCameraPoints,
  FALLBACK_ONE_TIERS,
  PAPIC_FREE_ONE_POINTS_FALLBACK,
  type PapicOneTier,
} from '@/lib/papic-one';
import { fetchPapicPassTiers, type PapicPassTier } from '@/lib/papic-pass-tiers';

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

/**
 * The live Papic POOL rungs (`papic_pass_tiers`) — the shared-shot-pool sibling
 * of `readPapicOneTiers`, for server surfaces with no request-scoped client.
 *
 * `fetchPapicPassTiers` is the module that already knows the rung shape; unlike
 * its One sibling it can THROW on a transport failure (it does not wrap its own
 * query), so the try/catch here covers the whole call, not just the client
 * construction.
 */
export const readPapicPassTiers = cache(async (): Promise<PapicPassTier[]> => {
  try {
    return await fetchPapicPassTiers(createAdminClient());
  } catch {
    // No service-role key / unreadable table. Returning [] rather than a seed
    // mirror is deliberate for a DISPLAY caller: a rung we cannot price is a
    // rung we must not advertise, and the pool ladder simply doesn't render.
    return [];
  }
});

/**
 * The live free SHARED-POOL allowance
 * (`papic_event_pool_config.free_grant_points`) — the number
 * `ensureFreePapicPoolGrantAdmin` actually mints, so a display surface that
 * quotes it reads the same column the meter does.
 */
export const readPapicFreeGrantPoints = cache(async (): Promise<number> => {
  try {
    return await fetchPapicFreeGrantPoints(createAdminClient());
  } catch {
    return PAPIC_FREE_GRANT_POINTS_FALLBACK;
  }
});

/**
 * The live dedicated-point allowance on the free Papic One camera
 * (`papic_event_pool_config.free_one_camera_points`). Same shape + same
 * degradation as its two siblings above.
 */
export const readPapicFreeOneCameraPoints = cache(async (): Promise<number> => {
  try {
    return await fetchPapicFreeOneCameraPoints(createAdminClient());
  } catch {
    return PAPIC_FREE_ONE_POINTS_FALLBACK;
  }
});
