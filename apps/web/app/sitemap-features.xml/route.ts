/**
 * Feature-page sitemap at /sitemap-features.xml (DECISION_LOG 2026-10-01
 * "EVERY FEATURE PAGE … CARRY FULL SEARCH + AI-SEARCH TAGGING", item 6).
 *
 * Same shape as `sitemap-blog.xml`: an in-code registry (`lib/feature-pages`),
 * so this route is pure string assembly and cannot fail on a DB outage. Every
 * /features/<slug> and its Tagalog twin /tl/features/<slug>, each row carrying
 * its hreflang pair + x-default (the `xhtml:link` form Google reads in
 * sitemaps) and an honest `<lastmod>` — `FEATURES_LASTMOD`, the date the copy
 * was last edited, never a build-time `Date()`.
 *
 * The hub itself (/features, /tl/features) stays in `sitemap-static.xml`,
 * where `one-explainer-page.test.ts` pins it.
 */

import { FEATURE_PAGES, FEATURES_LASTMOD, featurePaths } from '@/lib/feature-pages';

export const revalidate = 3600;

export function GET(): Response {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

  const urls = FEATURE_PAGES.flatMap((f) => {
    const p = featurePaths(f.slug);
    const en = `${baseUrl}${p.en}`;
    const tl = `${baseUrl}${p.tl}`;
    const alternates =
      `    <xhtml:link rel="alternate" hreflang="en-PH" href="${en}"/>\n` +
      `    <xhtml:link rel="alternate" hreflang="tl-PH" href="${tl}"/>\n` +
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>`;
    return [en, tl].map(
      (loc) =>
        `  <url>\n    <loc>${loc}</loc>\n${alternates}\n    <lastmod>${FEATURES_LASTMOD}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${loc === en ? '0.7' : '0.5'}</priority>\n  </url>`,
    );
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
