/**
 * Sitemap-INDEX entry point at /sitemap.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row · pre-sprint
 * audit at SEO_GEO_SPRINT_2026-05-29.md Bucket 3). Replaces the prior
 * single-file `app/sitemap.ts` MetadataRoute.Sitemap implementation
 * which emitted 75 URLs with a SHARED `lastmod = <build-time Date()>`
 * across every row — Google reads that pattern as freshness fraud.
 *
 * Architecture:
 *   /sitemap.xml              ← THIS file · sitemapindex
 *   /sitemap-static.xml       ← marketing routes · hardcoded honest lastmod
 *   /sitemap-help.xml         ← /help hub + 61 per-article URLs · HELP_LASTMOD
 *   /sitemap-venues.xml       ← venue_directory rows · lastmod = created_at
 *   /sitemap-vendors.xml      ← verified vendor_profiles · lastmod = updated_at
 *   /sitemap-weddings.xml     ← Phase 4 editorials (empty until feature ships)
 *
 * The Next.js `app/sitemap.ts` convention collides with manual route
 * handlers at the same URL — that file was deleted in the same PR.
 * robots.ts already declares `sitemap: ${baseUrl}/sitemap.xml` so this
 * URL is what crawlers find.
 *
 * Per-row honest lastmod: each CHILD sitemap emits real per-row
 * `<lastmod>` from DB timestamps (venue_directory.created_at,
 * vendor_profiles.updated_at). The INDEX itself uses a fresh `Date()`
 * because the index lists which children exist, not when the content
 * inside them was last edited.
 *
 * Cache: revalidate=3600 keeps Vercel's edge cache fresh for 1hr.
 * Future enhancement (V1.x · per SEO_GEO_SPRINT_2026-05-29.md Bucket 3):
 * add `revalidateTag('sitemap')` hooks to verifyVendor server action +
 * Phase 4 publish server action so newly-verified vendors / freshly-
 * published editorials surface in the sitemap within seconds instead
 * of waiting for the 1hr revalidate cycle.
 */

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const now = new Date().toISOString();

  // Order matches the SEO Playbook §4.2 recommendation: static first
  // (highest authority pages), then venues + vendors (transactional
  // crawl targets), then weddings (editorial discovery surface).
  const children: ReadonlyArray<{ slug: string; lastmod: string }> = [
    { slug: 'sitemap-static.xml', lastmod: now },
    { slug: 'sitemap-help.xml', lastmod: now },
    { slug: 'sitemap-blog.xml', lastmod: now },
    { slug: 'sitemap-venues.xml', lastmod: now },
    { slug: 'sitemap-vendors.xml', lastmod: now },
    { slug: 'sitemap-weddings.xml', lastmod: now },
  ];

  const sitemapTags = children
    .map(
      (child) =>
        `  <sitemap>\n    <loc>${baseUrl}/${child.slug}</loc>\n    <lastmod>${child.lastmod}</lastmod>\n  </sitemap>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">
${sitemapTags}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Cloudflare/Vercel edge can cache the index itself for 1hr; the
      // children have their own revalidate=3600 too.
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
