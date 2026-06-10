import { NextResponse } from 'next/server';
import {
  BRAND_SETTINGS_TAG,
  getBrandSettings,
} from '@/lib/brand-settings';
import { DEFAULT_FAVICON_ICO } from './default-favicon';

/**
 * Dynamic /favicon.ico — the cure for the stale orange Safari tab.
 *
 * No real favicon.ico existed before this route: the app declared SVG-only
 * favicons, and Safari (weak SVG-favicon support) always probes the bare
 * /favicon.ico path first, got HTML, and fell back to its STALE cached orange
 * icon from before the 2026-05-31 gold rebrand. Serving a genuine .ico here
 * (content-type image/x-icon) at that exact path fixes it for every browser.
 *
 * Returns the admin-uploaded .ico from platform_settings when set, otherwise
 * the built-in GOLD default (app/favicon.ico/default-favicon.ts, derived from
 * the canonical brand mark). The admin .ico bytes are fetched from their public
 * R2 URL with the same `brand-settings` cache tag so the admin upload action's
 * `revalidateTag` busts both the settings read and this fetch.
 *
 * The root metadata also emits a `<link rel="icon" href="/favicon.ico?v=N">`
 * with a version cache-buster (see app/layout.tsx) so browsers re-fetch past
 * sticky favicon caches whenever the admin changes the icon.
 */
export const runtime = 'nodejs';
export const revalidate = 3600;

const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';

export async function GET(): Promise<Response> {
  let body: Uint8Array = DEFAULT_FAVICON_ICO;

  try {
    const brand = await getBrandSettings();
    if (brand.faviconIcoUrl) {
      const res = await fetch(brand.faviconIcoUrl, {
        next: { revalidate: 3600, tags: [BRAND_SETTINGS_TAG] },
      });
      if (res.ok) {
        body = new Uint8Array(await res.arrayBuffer());
      }
    }
  } catch {
    // Any failure → fall through to the built-in gold default. The tab must
    // never break, and it must never be orange again.
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': 'image/x-icon',
      'Cache-Control': CACHE_CONTROL,
    },
  });
}
