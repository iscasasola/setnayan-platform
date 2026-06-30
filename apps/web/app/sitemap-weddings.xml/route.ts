/**
 * Real Weddings sitemap at /sitemap-weddings.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29) + iteration 0046 (2026-06-13).
 * DB-driven + consent-gated: emits the `/realstories` hub plus each REAL,
 * CONSENT-GATED published editorial's canonical URL — the couple's own `/[slug]`
 * page — from `loadPublishedShowcases()`.
 *
 * SAMPLE-exclusion (2026-07-01): `loadPublishedShowcases()` now also returns the
 * curated Maria & Jose SAMPLE (is_sample) so /realstories is never empty. A
 * sample is a FUTURE-DATED (2026-12-12) demo page representing NO real couple —
 * it must NOT be advertised to search engines as a real editorial. So we FILTER
 * samples out of the real-editorial loop (`!s.isSample`) and surface a sample
 * only via the curated `/realstories/[slug]` fallback path, and only when no
 * real consented editorial exists yet. Every `<lastmod>` is CLAMPED to today so
 * a future event date can never be emitted as a last-modified time (Google
 * ignores future lastmods; we keep the feed honest). The `/realstories` hub
 * lives here (not in sitemap-static) so it isn't duplicated across sitemaps —
 * same hub-in-its-own-child pattern as /help + /blog.
 *
 * Best-effort: the loader degrades to [] on any DB issue, so this route always
 * returns valid XML.
 */

import { ALL_REAL_WEDDINGS, REAL_WEDDINGS_LASTMOD } from '@/lib/real-weddings';
import { loadPublishedShowcases } from '@/lib/showcase-db';

export const revalidate = 3600;

/** Clamp an ISO date to never be later than today (no future <lastmod>). */
function clampLastmod(iso: string, today: string): string {
  return iso > today ? today : iso;
}

export async function GET(): Promise<Response> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const showcases = await loadPublishedShowcases();
  // REAL consent-gated editorials only — never the sample (a future-dated demo
  // page that represents no real couple must not enter the public sitemap as a
  // real /[slug]).
  const realShowcases = showcases.filter((s) => !s.isSample);

  const rows: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [
    {
      loc: `${baseUrl}/realstories`,
      lastmod: clampLastmod(REAL_WEDDINGS_LASTMOD, today),
      changefreq: 'weekly',
      priority: '0.8',
    },
  ];

  if (realShowcases.length > 0) {
    // Real consent-gated editorials → the couple's canonical /[slug] page.
    for (const s of realShowcases) {
      rows.push({
        loc: `${baseUrl}${s.href}`,
        lastmod: clampLastmod(s.eventDate ?? REAL_WEDDINGS_LASTMOD, today),
        changefreq: 'monthly',
        priority: '0.6',
      });
    }
  } else {
    // Fallback: the curated sample(s) at /realstories/[slug] — NEVER the
    // sample's own future-dated /[slug] — until a real wedding exists.
    for (const w of ALL_REAL_WEDDINGS.filter((w) => w.isSample)) {
      rows.push({
        loc: `${baseUrl}/realstories/${w.slug}`,
        lastmod: clampLastmod(w.updatedAt ?? w.publishedAt, today),
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
