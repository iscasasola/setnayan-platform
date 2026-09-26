/**
 * /sitemap-suppliers.xml — the supplier landing pages that pass the gate
 * (SEO Playbook §5.1 / line 202 planned it; built 2026-09-27).
 *
 * 🔑 ONLY QUALIFYING PAGES. `qualifyingPages` is the same function the pages
 * use for their own `robots: index`, so the sitemap can never list a page that
 * tells Google not to index it — the contradiction Search Console reports as
 * "Submitted URL marked noindex". The /suppliers index is listed only once at
 * least one page qualifies, for the same reason.
 *
 * Failure mode: an empty `<urlset>` on a read error, like every other child
 * sitemap — a crawler told "nothing here this hour" re-reads next hour; one
 * told the wrong URLs indexes them.
 */
import { loadLandingCards } from '@/lib/supplier-landing-data';
import { pagePath, qualifyingPages } from '@/lib/supplier-landing';

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');
  const now = new Date().toISOString();
  let paths: string[] = [];
  try {
    const source = await loadLandingCards();
    const pages = qualifyingPages(source.cards, source.tileServesEvent);
    if (pages.length > 0) {
      paths = ['/suppliers', ...pages.map((p) => pagePath(p, source.taxonomy.tileSlug))];
    }
  } catch {
    paths = [];
  }
  const urls = paths
    .map(
      (p) =>
        `  <url>\n    <loc>${baseUrl}${p}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>${p === '/suppliers' ? '0.8' : '0.7'}</priority>\n  </url>`,
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
