/**
 * Real Weddings sitemap at /sitemap-weddings.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29) + iteration 0046 first slice
 * (2026-06-13). Emits the `/weddings` hub + the curated SAMPLE showcase URLs
 * that ship in-code (`lib/real-weddings.ts`) so the surface is indexable now.
 * Each row carries an honest per-entry `<lastmod>` (`updatedAt ?? publishedAt`),
 * never a build-time `Date()`. (The `/weddings` hub now lives here rather than
 * in sitemap-static — same hub-in-its-own-child pattern as /help + /blog — so
 * it is NOT duplicated across sitemaps.)
 *
 * FUTURE — DB-driven real editorials. The canonical 0046/0002 model is that a
 * real wedding's editorial publishes from the couple's own `events` row at
 * T+30d post-wedding WITH explicit RA 10173 consent (first real one = the
 * founder's Dec 2026 wedding → editorials ~Jan 2027). When that ships, UNION
 * those rows in here (filter `events` by the published/consent columns) and
 * wire `revalidateTag('sitemap-weddings')` from the publish action so new
 * editorials surface within seconds. The in-code samples stay until real ones
 * exist.
 */

import { ALL_REAL_WEDDINGS, REAL_WEDDINGS_LASTMOD } from '@/lib/real-weddings';

export const revalidate = 3600;

export function GET(): Response {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  // Samples are placeholders — emit them only until a real wedding exists
  // (mirrors the /weddings index fallback). Once a real (non-sample) wedding
  // enters the source, the sample drops out of the sitemap too.
  const realWeddings = ALL_REAL_WEDDINGS.filter((w) => !w.isSample);
  const shown = realWeddings.length > 0 ? realWeddings : ALL_REAL_WEDDINGS;

  const rows: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [
    { loc: `${baseUrl}/weddings`, lastmod: REAL_WEDDINGS_LASTMOD, changefreq: 'weekly', priority: '0.8' },
    ...shown.map((w) => ({
      loc: `${baseUrl}/weddings/${w.slug}`,
      lastmod: w.updatedAt ?? w.publishedAt,
      changefreq: 'monthly',
      priority: '0.6',
    })),
  ];

  const urls = rows
    .map(
      (r) =>
        `  <url>\n    <loc>${r.loc}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
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
