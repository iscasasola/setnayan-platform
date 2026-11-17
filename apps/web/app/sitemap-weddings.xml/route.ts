/**
 * Stories sitemap at /sitemap-weddings.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29) + iteration 0046 (2026-06-13).
 * DB-driven + consent-gated: emits each REAL, CONSENT-GATED published editorial's canonical URL — the couple's own
 * `/[slug]` page — from `loadPublishedShowcases()`. Samples (`isSample`) are never listed: a sample is a future-dated
 * demo representing no real couple.
 *
 * 🗞✂ 2026-11-16 — THE STORIES HUB AND ITS SAMPLE PAGES ARE RETIRED (owner, DECISION_LOG "THE BLOG AND REAL STORIES
 * ARE RETIRED"; the old hub address forwards to Discover). This file used to list the hub and, when no real
 * editorial existed, every sample under it — both are gone. A sitemap that outlives its page rots silently, so
 * nothing here points at the retired address any more. Every `<lastmod>` is clamped to today (no future lastmods).
 *
 * Best-effort: the loader degrades to [] on any DB issue, so this route always returns valid XML.
 */

import { REAL_WEDDINGS_LASTMOD } from '@/lib/real-weddings';
import { loadPublishedShowcases } from '@/lib/showcase-db';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicEventUrl, resolveEventOwnerSlug } from '@/lib/public-event-url';

export const revalidate = 3600;

/** Clamp an ISO date to never be later than today (no future <lastmod>). */
function clampLastmod(iso: string, today: string): string {
  return iso > today ? today : iso;
}

export async function GET(): Promise<Response> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const showcases = await loadPublishedShowcases();
  // REAL consent-gated editorials only — never the sample (a future-dated demo
  // page that represents no real couple must not enter the public sitemap as a
  // real /[slug]).
  const realShowcases = showcases.filter((s) => !s.isSample);

  const rows: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];

  if (realShowcases.length > 0) {
    // Real consent-gated editorials → the couple's CANONICAL event URL. Nested
    // /u/{owner}/{slug} under the URL-nesting cutover (so the sitemap lists the
    // final URL, not a redirecting bare one), bare root otherwise —
    // resolveEventOwnerSlug self-noops to null while the flag is OFF, so
    // publicEventUrl degrades to today's `${baseUrl}/${slug}` with zero queries.
    const admin = createAdminClient();
    for (const s of realShowcases) {
      const ownerSlug = await resolveEventOwnerSlug(admin, s.eventId);
      rows.push({
        loc: publicEventUrl(baseUrl, s.slug, ownerSlug),
        lastmod: clampLastmod(s.eventDate ?? REAL_WEDDINGS_LASTMOD, today),
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
