import type { MetadataRoute } from 'next';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Public sitemap. Includes the marketing landing + open public pages
 * (help, privacy, terms, vendor marketplace, vendor-acquisition page).
 * Dashboard/admin routes are deliberately excluded — they're auth-gated
 * and shouldn't appear in search results.
 *
 * Vendor public profiles at /v/[slug] are listed if their is_published
 * flag is on; that requires a DB call, deferred until R2/CDN are wired
 * since vendor profile pages need image hosting to be useful.
 *
 * Venue detail pages at /venue/[slug] are listed for every non-demo
 * row in `venue_directory`. Demo rows (is_demo = TRUE) are excluded
 * because they're synthetic admin-only test data and must not be
 * indexed (matches the metadata `robots: noindex` on the page itself).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/vendors`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/weddings`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/features`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/for-vendors`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/how-it-works`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/help`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/waitlist`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/download`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/signup`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const venueEntries = await fetchVenueSitemapEntries(baseUrl, now);
  return [...staticEntries, ...venueEntries];
}

/**
 * Pull venue slugs out of `venue_directory` for sitemap inclusion. Demo
 * rows (`is_demo = TRUE`) are filtered out — synthetic listings must
 * never be indexed. Defensive against the `is_demo` column not yet
 * existing (parallel PR from Agent A adds it); on schema error we fall
 * back to "all rows" since today's seeded directory contains no demo
 * entries.
 */
async function fetchVenueSitemapEntries(
  baseUrl: string,
  now: Date,
): Promise<MetadataRoute.Sitemap> {
  try {
    const admin = createAdminClient();
    // First attempt — filter out is_demo. If the column doesn't exist
    // yet, PostgREST returns an error; we fall back to the unfiltered
    // query (current prod state has no demo rows anyway).
    const withDemoFilter = await admin
      .from('venue_directory')
      .select('slug')
      .or('is_demo.is.null,is_demo.eq.false')
      .limit(1000);

    let rows = withDemoFilter.data;
    if (
      withDemoFilter.error &&
      /is_demo/i.test(withDemoFilter.error.message)
    ) {
      const fallback = await admin
        .from('venue_directory')
        .select('slug')
        .limit(1000);
      rows = fallback.data;
    }

    if (!rows || rows.length === 0) return [];

    return rows
      .filter((r): r is { slug: string } => typeof r.slug === 'string' && r.slug.length > 0)
      .map((r) => ({
        url: `${baseUrl}/venue/${r.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
  } catch {
    // Build-time sitemap shouldn't hard-fail if Supabase is briefly
    // unreachable. Returning an empty list keeps the rest of the
    // sitemap functional.
    return [];
  }
}
