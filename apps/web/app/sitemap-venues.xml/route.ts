/**
 * Venues sitemap at /sitemap-venues.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row).
 *
 * Queries `venue_directory` for every published row and emits one URL
 * per `/venue/<slug>` with honest per-row `<lastmod>` sourced from
 * `created_at` (venue_directory has no `updated_at` column · seeded
 * directory rows haven't been touched since admin landed them so
 * `created_at` is the truthful lastmod).
 *
 * Schema (per supabase/migrations/20260526010000_venue_directory_seed.sql):
 *   slug             TEXT NOT NULL UNIQUE
 *   created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *
 * No `is_demo` filter — venue_directory rows are admin-curated real
 * venues (Cebu Marriott, Manila Cathedral, Conrad, etc. per
 * 20260526020000_venue_directory_hero_images.sql backfill). All rows
 * are publicly indexable.
 *
 * RLS: venue_directory has admin-managed RLS; the admin client
 * (used here) bypasses RLS for the read.
 *
 * Failure mode: if Supabase is briefly unreachable at build time OR
 * at request time, return an empty `<urlset>` (valid XML) so the
 * sitemap index continues to function. Logged + swallowed.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  let urls = '';

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('venue_directory')
      .select('slug, created_at')
      .order('created_at', { ascending: false })
      .limit(50_000); // Google's per-sitemap URL cap

    if (error) {
      console.error('[sitemap-venues] supabase error', error.message);
    }

    if (data && data.length > 0) {
      urls = data
        .filter(
          (row): row is { slug: string; created_at: string } =>
            typeof row.slug === 'string' &&
            row.slug.length > 0 &&
            typeof row.created_at === 'string',
        )
        .map(
          (row) =>
            `  <url>\n    <loc>${baseUrl}/venue/${encodeURIComponent(row.slug)}</loc>\n    <lastmod>${new Date(row.created_at).toISOString()}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
        )
        .join('\n');
    }
  } catch (e) {
    // Don't hard-fail the sitemap on transient DB issues.
    console.error('[sitemap-venues] threw', e);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
