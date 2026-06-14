/**
 * Real Weddings sitemap at /sitemap-weddings.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29) + iteration 0046 (2026-06-13).
 * DB-driven + consent-gated: emits the `/realstories` hub plus each REAL published
 * editorial's canonical URL — the couple's own `/[slug]` page — from
 * `loadPublishedShowcases()`. Until any real wedding qualifies (the consent +
 * T+30d gate), it falls back to the curated SAMPLE URL (`/realstories/[slug]`),
 * the same priority order as the /realstories index. Honest per-row `<lastmod>`,
 * never a build-time `Date()`. The `/realstories` hub lives here (not in
 * sitemap-static) so it isn't duplicated across sitemaps — same
 * hub-in-its-own-child pattern as /help + /blog.
 *
 * Best-effort: the loader degrades to [] (→ sample) on any DB issue, so this
 * route always returns valid XML.
 */

import { ALL_REAL_WEDDINGS, REAL_WEDDINGS_LASTMOD } from '@/lib/real-weddings';
import { loadPublishedShowcases } from '@/lib/showcase-db';

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  const showcases = await loadPublishedShowcases();

  const rows: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [
    { loc: `${baseUrl}/realstories`, lastmod: REAL_WEDDINGS_LASTMOD, changefreq: 'weekly', priority: '0.8' },
  ];

  if (showcases.length > 0) {
    // Real consent-gated editorials → the couple's canonical /[slug] page.
    for (const s of showcases) {
      rows.push({
        loc: `${baseUrl}${s.href}`,
        lastmod: s.eventDate ?? REAL_WEDDINGS_LASTMOD,
        changefreq: 'monthly',
        priority: '0.6',
      });
    }
  } else {
    // Fallback: the curated sample(s) at /realstories/[slug] until a real wedding exists.
    for (const w of ALL_REAL_WEDDINGS.filter((w) => w.isSample)) {
      rows.push({
        loc: `${baseUrl}/realstories/${w.slug}`,
        lastmod: w.updatedAt ?? w.publishedAt,
        changefreq: 'monthly',
        priority: '0.6',
      });
    }
  }

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
