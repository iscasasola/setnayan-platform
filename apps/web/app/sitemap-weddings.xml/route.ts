/**
 * Weddings (Phase 4 editorials) sitemap at /sitemap-weddings.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row).
 *
 * Forward-compatibility surface. The Phase 4 Public Editorial mode
 * (CLAUDE.md 2026-05-19 row 426 + tenth 2026-05-28 row v2.1 brief
 * § "Real Weddings" + iteration 0046 wedding-showcase iteration) is
 * spec-locked but engineering hasn't shipped the `events` table column
 * (`phase4_editorial_published_at` or equivalent) that gates which
 * events are publicly indexable.
 *
 * Today this route returns an empty `<urlset>` — valid XML so the
 * sitemap-index parent stays well-formed, but no URLs surface for
 * Google or AI engines yet. The moment Phase 4 publishing ships:
 *
 *   1. Update the query below to filter `events` by the actual column
 *      (likely `WHERE phase4_editorial_published_at IS NOT NULL` AND
 *      the `users.public_summary_consent_at` join per RA 10173 consent
 *      guardrail · CLAUDE.md 2026-05-19 row 426 "8 RA 10173 safe-harbor
 *      guardrails")
 *   2. Wire `revalidateTag('sitemap-weddings')` from the Phase 4 publish
 *      server action so newly-public editorials surface within seconds
 *
 * Keeping the route live now (even when empty) means crawlers learn
 * the URL exists + AI answer engines warm up the discovery path before
 * content lands. Removes the "404 on sitemap-weddings.xml" signal that
 * would otherwise occur.
 *
 * Pilot 2026-06-01 cohort: 5-20 family/friends per [[project_setnayan_pilot_timeline]].
 * First real wedding through Setnayan ships December 18, 2026 (owner's
 * wedding · per CLAUDE.md tenth 2026-05-28 row § 1). Public editorials
 * therefore start landing ~Jan 18, 2027 (event + 30 days per the
 * locked Phase 4 RA 10173 guardrail · CLAUDE.md 2026-05-19 row 426).
 * This sitemap stays empty until then.
 */

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  // Forward-compat empty urlset. When the events.phase4_editorial_published_at
  // column lands, replace this body with a Supabase query against `events`
  // joining the consent timestamp on users.public_summary_consent_at.
  // See file-level docstring for the full migration trigger.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
