/**
 * Venues sitemap at /sitemap-venues.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) + the
 * /venues hub follow-up (2026-06-13): emits the `/venues` hub, one
 * `/venues/[city]` index per distinct city, and one `/venue/<slug>`
 * detail URL per published row — honest per-row `<lastmod>` sourced
 * from `created_at` (venue_directory has no `updated_at` column ·
 * seeded directory rows haven't been touched since admin landed them
 * so `created_at` is the truthful lastmod). Hub + city rows use the
 * max created_at of the rows they index.
 *
 * Demo rows (`is_demo = TRUE`, added by migration 20260604000000) are
 * EXCLUDED — the /venue/[slug] page serves them noindex, so listing
 * them here would be a sitemap/meta contradiction. The select falls
 * back to the legacy column set on environments that predate the
 * reception-support migration (same pattern as /venue/[slug]).
 *
 * RLS: venue_directory has admin-managed RLS; the admin client
 * (used here) bypasses RLS for the read.
 *
 * Failure mode: if Supabase is briefly unreachable at build time OR
 * at request time, return an empty `<urlset>` (valid XML) so the
 * sitemap index continues to function. Logged + swallowed.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { slugifyCity } from '@/app/venues/_lib/venue-directory';

export const revalidate = 3600;

type SitemapRow = {
  slug: string;
  created_at: string;
  location_city: string;
  is_demo?: boolean | null;
};

export async function GET(): Promise<Response> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  const entries: string[] = [];

  try {
    const admin = createAdminClient();
    let data: unknown[] | null = null;
    let errorMessage: string | null = null;

    const fullRes = await admin
      .from('venue_directory')
      .select('slug, created_at, location_city, is_demo')
      .order('created_at', { ascending: false })
      .limit(50_000); // Google's per-sitemap URL cap

    if (fullRes.error && /is_demo/i.test(fullRes.error.message)) {
      const legacyRes = await admin
        .from('venue_directory')
        .select('slug, created_at, location_city')
        .order('created_at', { ascending: false })
        .limit(50_000);
      data = legacyRes.data;
      errorMessage = legacyRes.error?.message ?? null;
    } else {
      data = fullRes.data;
      errorMessage = fullRes.error?.message ?? null;
    }

    if (errorMessage) {
      console.error('[sitemap-venues] supabase error', errorMessage);
    }

    const rows = ((data ?? []) as SitemapRow[]).filter(
      (row) =>
        typeof row.slug === 'string' &&
        row.slug.length > 0 &&
        typeof row.created_at === 'string' &&
        typeof row.location_city === 'string' &&
        row.location_city.length > 0 &&
        row.is_demo !== true,
    );

    const newestRow = rows[0];
    if (newestRow) {
      const newestIso = new Date(newestRow.created_at).toISOString();

      // /venues hub — freshness = newest row overall.
      entries.push(
        `  <url>\n    <loc>${baseUrl}/venues</loc>\n    <lastmod>${newestIso}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
      );

      // /venues/[city] indexes — freshness = newest row in that city.
      const cityNewest = new Map<string, string>();
      for (const row of rows) {
        const citySlug = slugifyCity(row.location_city);
        if (!citySlug) continue;
        const existing = cityNewest.get(citySlug);
        if (!existing || row.created_at > existing) {
          cityNewest.set(citySlug, row.created_at);
        }
      }
      for (const [citySlug, createdAt] of [...cityNewest.entries()].sort()) {
        entries.push(
          `  <url>\n    <loc>${baseUrl}/venues/${citySlug}</loc>\n    <lastmod>${new Date(createdAt).toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.75</priority>\n  </url>`,
        );
      }

      // /venue/[slug] detail pages.
      for (const row of rows) {
        entries.push(
          `  <url>\n    <loc>${baseUrl}/venue/${encodeURIComponent(row.slug)}</loc>\n    <lastmod>${new Date(row.created_at).toISOString()}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
        );
      }
    }
  } catch (e) {
    // Don't hard-fail the sitemap on transient DB issues.
    console.error('[sitemap-venues] threw', e);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">
${entries.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
