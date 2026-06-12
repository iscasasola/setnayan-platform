/**
 * Help-center sitemap at /sitemap-help.xml.
 *
 * SEO/GEO follow-up (2026-06-13): the help center is 61 high-intent
 * informational Q&A articles that, until now, lived on a single /help URL.
 * Each article now has its own indexable page at /help/[slug] (Article +
 * single-question FAQPage JSON-LD), so each long-tail question can rank on
 * its own. This child sitemap advertises the /help hub + all 61 article URLs.
 *
 * lastmod: the help corpus has no per-row timestamps — every article was
 * authored/last-revised together (GEO Phase G3). `HELP_LASTMOD` is the single
 * honest edit date stamped on every row, NOT a build-time Date() (which Google
 * reads as freshness fraud). Bump HELP_LASTMOD in lib/help.ts when article
 * bodies materially change.
 *
 * The article set is an in-code constant (no DB), so this route can't fail on
 * a DB outage — it's pure string assembly.
 */

import { ALL_HELP_ARTICLES, HELP_LASTMOD } from '@/lib/help';

export const revalidate = 3600;

export function GET(): Response {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  const rows: Array<{ loc: string; changefreq: string; priority: string }> = [
    { loc: `${baseUrl}/help`, changefreq: 'monthly', priority: '0.75' },
    ...ALL_HELP_ARTICLES.map(({ article }) => ({
      loc: `${baseUrl}/help/${article.slug}`,
      changefreq: 'monthly',
      priority: '0.6',
    })),
  ];

  const urls = rows
    .map(
      (r) =>
        `  <url>\n    <loc>${r.loc}</loc>\n    <lastmod>${HELP_LASTMOD}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
    )
    .join('\n');

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
