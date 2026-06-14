// Shared venue-directory reads for the /venues hub + /venues/[city] index
// pages (SEO/GEO follow-up to the 2026-05-29 sprint — the 100+ /venue/[slug]
// detail pages were the largest indexable surface on the site but had no hub
// page and no city indexes, so they hung off the sitemap alone as near-orphans;
// the playbook's geo-modified queries — "wedding venues Tagaytay" — had no
// landing URL).
//
// One cached read powers generateMetadata + the page body on both routes
// (React cache() dedupes within a request). Demo rows are excluded here —
// these surfaces are crawler-facing index pages and must never list
// synthetic marketplace-test venues (the /venue/[slug] detail page handles
// demo rows itself with a banner + noindex).

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';

export type VenueIndexRow = {
  slug: string;
  name: string;
  venue_type: string;
  location_city: string;
  hero_image_url: string | null;
  capacity_max?: number | null;
  day_rate_php_min?: number | null;
  day_rate_php_max?: number | null;
  is_demo?: boolean | null;
};

const FULL_SELECT =
  'slug,name,venue_type,location_city,hero_image_url,capacity_max,day_rate_php_min,day_rate_php_max,is_demo';

// Pre-reception-schema fallback — same pattern as /venue/[slug]. Goes
// dormant once every environment carries migration 20260604000000.
const LEGACY_SELECT = 'slug,name,venue_type,location_city,hero_image_url';

export const fetchVenueDirectory = cache(
  async (): Promise<VenueIndexRow[]> => {
    // Swallow-and-empty failure mode, same as the sitemap routes: these are
    // ISR pages, so they prerender at `next build` — environments without
    // SUPABASE env vars (local/CI production-build check) must not fail the
    // build, and a transient DB error at revalidate time must not take the
    // page down. On Vercel the build + runtime always have the env, so the
    // shipped page renders with real rows.
    try {
      const admin = createAdminClient();

      const fullRes = await admin
        .from('venue_directory')
        .select(FULL_SELECT)
        .order('location_city', { ascending: true })
        .order('name', { ascending: true })
        .limit(2000);

      let rows: VenueIndexRow[] | null = fullRes.data as VenueIndexRow[] | null;

      if (
        fullRes.error &&
        /(capacity_max|day_rate_php_min|day_rate_php_max|is_demo)/i.test(
          fullRes.error.message,
        )
      ) {
        const legacyRes = await admin
          .from('venue_directory')
          .select(LEGACY_SELECT)
          .order('location_city', { ascending: true })
          .order('name', { ascending: true })
          .limit(2000);
        rows = legacyRes.data as VenueIndexRow[] | null;
      }

      return (rows ?? []).filter(
        (row) =>
          typeof row.slug === 'string' &&
          row.slug.length > 0 &&
          typeof row.location_city === 'string' &&
          row.location_city.length > 0 &&
          row.is_demo !== true,
      );
    } catch (e) {
      console.error('[venue-directory] read failed', e);
      return [];
    }
  },
);

/** "Cebu City" → "cebu-city" · "Parañaque" → "paranaque". */
export function slugifyCity(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type CityGroup = {
  city: string;
  citySlug: string;
  venues: VenueIndexRow[];
};

/** Group rows by city, largest city first (ties alphabetical). */
export function groupByCity(rows: VenueIndexRow[]): CityGroup[] {
  const byCity = new Map<string, CityGroup>();
  for (const row of rows) {
    const citySlug = slugifyCity(row.location_city);
    if (!citySlug) continue;
    const existing = byCity.get(citySlug);
    if (existing) {
      existing.venues.push(row);
    } else {
      byCity.set(citySlug, { city: row.location_city, citySlug, venues: [row] });
    }
  }
  return [...byCity.values()].sort(
    (a, b) => b.venues.length - a.venues.length || a.city.localeCompare(b.city),
  );
}

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');
