import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_LOADER_CONFIG,
  clampInt,
  coerceVariant,
  type LoaderConfig,
} from '@/lib/loader-config';

/**
 * Admin-configurable loading animation — cached read of the loader_* columns on
 * the platform_settings singleton (owner 2026-07-05).
 *
 * Read in the root layout (which gates EVERY page's render), so it's wrapped
 * twice, exactly like lib/brand-settings.ts:
 *   - `unstable_cache` (tag `loader-settings`, 1-hour revalidate) keeps marketing
 *     pages static-capable — the DB isn't hit per request, and the admin save
 *     action busts it with `revalidateTag(LOADER_SETTINGS_TAG)`.
 *   - React `cache()` dedupes any repeated call within one request.
 *
 * Anything missing (columns not migrated yet, no service-role env in CI, DB
 * error) resolves to DEFAULT_LOADER_CONFIG → the shipped `gather` loader with a
 * 90% veil, 1500 ms cadence, and pop on. The feature is purely additive: with no
 * admin override, every surface behaves exactly as it did before this landed.
 */

export const LOADER_SETTINGS_TAG = 'loader-settings';

export { DEFAULT_LOADER_CONFIG, type LoaderConfig };

const SELECT =
  'loader_variant,loader_veil_opacity,loader_step_interval_ms,loader_pop_enabled';

const loadLoaderSettings = unstable_cache(
  async (): Promise<LoaderConfig> => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('platform_settings')
        .select(SELECT)
        .eq('id', 1)
        .maybeSingle();
      if (error || !data) return DEFAULT_LOADER_CONFIG;
      const r = data as Record<string, unknown>;
      return {
        variant: coerceVariant(r.loader_variant),
        veilOpacity: clampInt(r.loader_veil_opacity, 70, 100, DEFAULT_LOADER_CONFIG.veilOpacity),
        stepIntervalMs: clampInt(
          r.loader_step_interval_ms,
          800,
          3000,
          DEFAULT_LOADER_CONFIG.stepIntervalMs,
        ),
        popEnabled:
          typeof r.loader_pop_enabled === 'boolean'
            ? r.loader_pop_enabled
            : DEFAULT_LOADER_CONFIG.popEnabled,
      };
    } catch {
      return DEFAULT_LOADER_CONFIG;
    }
  },
  ['loader-settings-v1'],
  { tags: [LOADER_SETTINGS_TAG], revalidate: 3600 },
);

/** Per-request memoized read of the admin loader-appearance settings. */
export const getLoaderSettings = cache(loadLoaderSettings);
