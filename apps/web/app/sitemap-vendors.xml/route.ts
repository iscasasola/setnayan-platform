/**
 * Vendors sitemap at /sitemap-vendors.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row).
 *
 * Queries `vendor_profiles` for every publicly-visible non-demo vendor
 * row and emits one URL per `/v/<business_slug>` with honest per-row
 * `<lastmod>` from `updated_at`. This is the compounding-flywheel
 * surface — every newly-verified vendor lands here within the next
 * cache cycle (1hr revalidate · future enhancement: revalidateTag
 * hook on verifyVendor server action).
 *
 * Schema source (per supabase/migrations/20260513120000_iteration_0022_*
 * + 20260515000000_vendor_public_visibility + 20260603201000_demo_vendor_*):
 *   business_slug         TEXT  (the URL slug · NULL allowed but filtered)
 *   public_visibility     TEXT  (= 'verified' means publicly indexable)
 *   is_demo               BOOLEAN  (TRUE on test-seed rows · filtered out)
 *   updated_at            TIMESTAMPTZ NOT NULL
 *
 * Filter chain (must satisfy ALL):
 *   1. business_slug IS NOT NULL                — the URL is constructable
 *   2. public_visibility = 'verified'           — marketplace exposes them
 *   3. is_demo IS NOT TRUE                      — not a test-seed row
 *
 * Per v2.1 brief § 3 + CLAUDE.md tenth 2026-05-28 row: Free vendors get
 * marketplace listing only (no `/v/[slug]` microsite). Verified+ vendors
 * get the microsite. The `public_visibility = 'verified'` filter is the
 * proxy for "this vendor has a real microsite at /v/<slug>".
 *
 * Failure mode: empty `<urlset>` on DB error or empty result.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  let urls = '';

  try {
    const admin = createAdminClient();

    // Primary query: filter by public_visibility='verified' AND is_demo IS NOT TRUE.
    // If is_demo column doesn't yet exist (migrations behind), fall back
    // to the unfiltered visibility check (same defensive pattern the
    // prior sitemap.ts used for venue_directory).
    let rows: { business_slug: string | null; updated_at: string }[] | null = null;

    const primary = await admin
      .from('vendor_profiles')
      .select('business_slug, updated_at')
      .eq('public_visibility', 'verified')
      .or('is_demo.is.null,is_demo.eq.false')
      .order('updated_at', { ascending: false })
      .limit(50_000);

    if (primary.error && /is_demo/i.test(primary.error.message)) {
      // Schema fallback — is_demo column missing in this environment.
      const fallback = await admin
        .from('vendor_profiles')
        .select('business_slug, updated_at')
        .eq('public_visibility', 'verified')
        .order('updated_at', { ascending: false })
        .limit(50_000);
      rows = fallback.data;
      if (fallback.error) {
        console.error('[sitemap-vendors] fallback error', fallback.error.message);
      }
    } else if (primary.error) {
      console.error('[sitemap-vendors] primary error', primary.error.message);
    } else {
      rows = primary.data;
    }

    if (rows && rows.length > 0) {
      urls = rows
        .filter(
          (row): row is { business_slug: string; updated_at: string } =>
            typeof row.business_slug === 'string' && row.business_slug.length > 0,
        )
        .map(
          (row) =>
            `  <url>\n    <loc>${baseUrl}/v/${encodeURIComponent(row.business_slug)}</loc>\n    <lastmod>${new Date(row.updated_at).toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
        )
        .join('\n');
    }
  } catch (e) {
    console.error('[sitemap-vendors] threw', e);
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
