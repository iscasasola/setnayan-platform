import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_APPLE_TOUCH,
  DEFAULT_BRAND_MARK_SVG,
  DEFAULT_ICON_SVG_192,
  DEFAULT_ICON_SVG_512,
} from '@/lib/brand-constants';

/**
 * Admin-controlled brand icon — cached read of the brand_* columns on the
 * platform_settings singleton (owner 2026-06-10).
 *
 * Read on the hot path (root layout, generateMetadata, the /favicon.ico route),
 * so it's wrapped twice:
 *   - `unstable_cache` (tag `brand-settings`, 1-hour revalidate) keeps marketing
 *     pages static-capable — the DB isn't hit per request, and the admin upload
 *     action busts it with `revalidateTag(BRAND_SETTINGS_TAG)`.
 *   - React `cache()` dedupes the layout + generateMetadata calls within one
 *     request.
 *
 * Anything missing (columns not migrated yet, no service-role env in CI, DB
 * error) resolves to FALLBACK → the built-in gold default everywhere. The
 * feature is purely additive: with no admin icon set, every surface shows the
 * canonical /brand/setnayan-mark.svg gold mark.
 */

export const BRAND_SETTINGS_TAG = 'brand-settings';

// Re-export the built-in gold defaults (defined in the client-safe
// brand-constants module) so server callers can keep importing them from here.
export {
  DEFAULT_APPLE_TOUCH,
  DEFAULT_BRAND_MARK_SVG,
  DEFAULT_ICON_SVG_192,
  DEFAULT_ICON_SVG_512,
};

export type BrandSettings = {
  masterUrl: string | null;
  faviconIcoUrl: string | null;
  appleTouchUrl: string | null;
  png512Url: string | null;
  svgUrl: string | null;
  version: number;
};

const FALLBACK: BrandSettings = {
  masterUrl: null,
  faviconIcoUrl: null,
  appleTouchUrl: null,
  png512Url: null,
  svgUrl: null,
  version: 0,
};

const SELECT =
  'brand_icon_master_url,brand_favicon_ico_url,brand_apple_touch_url,brand_icon_png_512_url,brand_icon_svg_url,brand_icon_version';

const loadBrandSettings = unstable_cache(
  async (): Promise<BrandSettings> => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('platform_settings')
        .select(SELECT)
        .eq('id', 1)
        .maybeSingle();
      if (error || !data) return FALLBACK;
      const r = data as Record<string, unknown>;
      return {
        masterUrl: (r.brand_icon_master_url as string | null) ?? null,
        faviconIcoUrl: (r.brand_favicon_ico_url as string | null) ?? null,
        appleTouchUrl: (r.brand_apple_touch_url as string | null) ?? null,
        png512Url: (r.brand_icon_png_512_url as string | null) ?? null,
        svgUrl: (r.brand_icon_svg_url as string | null) ?? null,
        version:
          typeof r.brand_icon_version === 'number' ? r.brand_icon_version : 0,
      };
    } catch {
      return FALLBACK;
    }
  },
  ['brand-settings-v1'],
  { tags: [BRAND_SETTINGS_TAG], revalidate: 3600 },
);

/** Per-request memoized read of the admin brand-icon settings. */
export const getBrandSettings = cache(loadBrandSettings);

/** Append the icon version as a cache-buster so browsers re-fetch on change. */
export function withBrandVersion(url: string, version: number): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${version}`;
}

/**
 * Mark URL for the in-app <Logo>/<LogoMark>, or null to use the built-in gold
 * default. Prefers the crisp SVG passthrough, then the 512 PNG.
 */
export function resolveBrandMarkUrl(s: BrandSettings): string | null {
  const u = s.svgUrl ?? s.png512Url;
  return u ? withBrandVersion(u, s.version) : null;
}
