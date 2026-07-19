/**
 * Static-marketing-routes sitemap at /sitemap-static.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row).
 *
 * Carries the 22 curated public marketing routes — the highest-authority
 * pages on the site. Each row gets a hardcoded MEANINGFUL lastmod that
 * reflects when the page's content last materially changed (NOT today's
 * build time). This is the honest fix for the freshness-fraud signal in
 * the prior sitemap.ts implementation where every row shared identical
 * `new Date()` lastmod.
 *
 * Methodology for hardcoded lastmod values:
 *   - Pages with active content (homepage, /vendors browse, /pricing) →
 *     today's date (they DO change frequently as vendors verify + SKUs
 *     evolve).
 *   - Pages locked since v2.1 brief (2026-05-28) → '2026-05-28'.
 *   - Pages locked earlier in V1 development → real iteration drop date
 *     (visible in git log or CLAUDE.md decision rows).
 *
 * Update protocol: when a marketing page receives substantive copy/UX
 * changes, bump its `lastmod` here in the same PR. Mechanical formatting
 * changes don't bump lastmod.
 */

export const revalidate = 3600;

// Per-route honest lastmod. Values anchored to CLAUDE.md decision-log
// dates when the page's last substantive change landed.
const STATIC_ROUTES: ReadonlyArray<{
  path: string;
  lastmod: string;
  changefreq: 'weekly' | 'monthly' | 'yearly' | 'daily';
  priority: string;
}> = [
  // Homepage — updated frequently as v2.1 sections evolve + vendor
  // tile counts increment. Daily changefreq is honest for the current
  // pre-pilot iteration cadence.
  { path: '/', lastmod: '2026-05-29', changefreq: 'daily', priority: '1.0' },

  // /vendors browse — DB-backed catalog. Page itself updates on every
  // verification + new tile lands. Daily.
  { path: '/explore', lastmod: '2026-05-29', changefreq: 'daily', priority: '0.9' },

  // /explore/compare — side-by-side vendor comparison. Was orphaned (indexable
  // but in no sitemap); added 2026-07-10.
  { path: '/explore/compare', lastmod: '2026-07-10', changefreq: 'weekly', priority: '0.6' },

  // /pricing — locked at v2.1 brief (CLAUDE.md tenth + eleventh 2026-05-28
  // rows). Annual SKUs being added in Bucket 7. Weekly until pilot.
  { path: '/pricing', lastmod: '2026-05-29', changefreq: 'weekly', priority: '0.9' },

  // /realstories hub moved to sitemap-weddings.xml (iteration 0046 first slice,
  // 2026-06-13) — kept out of sitemap-static to avoid a duplicate URL across
  // sitemaps (same hub-in-its-own-child pattern as /help + /blog).

  // /features — v2.1 template adoption shipped (CLAUDE.md eleventh
  // 2026-05-28 row PR #581); localized to EN + Taglish 2026-06-13.
  { path: '/features', lastmod: '2026-06-13', changefreq: 'monthly', priority: '0.85' },

  // /tl/features — Taglish edition of /features (localization, 2026-06-13).
  // hreflang reciprocal lives in both pages' metadata.
  { path: '/tl/features', lastmod: '2026-06-13', changefreq: 'monthly', priority: '0.75' },

  // /vendors — v2.1 publisher posture cutover (CLAUDE.md fifth
  // 2026-05-28 row PR #574).
  { path: '/vendors', lastmod: '2026-05-28', changefreq: 'monthly', priority: '0.8' },

  // /open-shop — vendor onboarding ("open your shop"). Was orphaned (indexable
  // but in no sitemap); added 2026-07-10.
  { path: '/open-shop', lastmod: '2026-07-10', changefreq: 'monthly', priority: '0.7' },

  // /creators — public storyteller marketing page ("Everywhere else, they
  // watch. Here, they book."). Shipped 2026-07-16 with the Creator Economy
  // Adventure-Chapter slice; the /vendors sibling for the storyteller side.
  { path: '/creators', lastmod: '2026-07-16', changefreq: 'monthly', priority: '0.8' },

  // /tl/about — Taglish edition of /about (localization first slice,
  // 2026-06-13). hreflang reciprocal with /about lives in the page metadata.
  { path: '/tl/about', lastmod: '2026-06-13', changefreq: 'monthly', priority: '0.7' },

  // /how-it-works — iteration 0015 marketing site.
  { path: '/how-it-works', lastmod: '2026-06-13', changefreq: 'monthly', priority: '0.75' },

  // /tl/how-it-works — Taglish edition of /how-it-works (localization,
  // 2026-06-13). hreflang reciprocal lives in both pages' metadata.
  { path: '/tl/how-it-works', lastmod: '2026-06-13', changefreq: 'monthly', priority: '0.7' },

  // /help moved to its own sitemap-help.xml (2026-06-13) — it now owns the
  // /help hub + 61 per-article /help/[slug] URLs, so listing /help here too
  // would duplicate it across two children.

  // /about — brand/entity page (SEO/GEO, 2026-06-13). Canonical "what is
  // Setnayan" surface for AI grounding; fixes the previously-dead footer link.
  { path: '/about', lastmod: '2026-06-13', changefreq: 'monthly', priority: '0.7' },

  // /our-story — brand-narrative + media-layer story page. Real metadata +
  // AboutPage JSON-LD, but was in NO sitemap before (added 2026-06-20).
  { path: '/our-story', lastmod: '2026-06-18', changefreq: 'monthly', priority: '0.7' },

  // /monogram — FREE no-signup monogram maker (top-of-funnel lead-gen tool,
  // WebApplication JSON-LD). High-intent organic target; was in NO sitemap
  // before (added 2026-06-20).
  { path: '/monogram', lastmod: '2026-06-19', changefreq: 'monthly', priority: '0.7' },

  // /papic — guest photo-gallery differentiator landing page (SoftwareApplication
  // + FAQPage JSON-LD). New 2026-06-20 "lead with the media layer" pass; the
  // SEO/GEO surface for "wedding photo sharing Philippines".
  { path: '/papic', lastmod: '2026-06-20', changefreq: 'monthly', priority: '0.8' },

  // /setnayan-ai — planning-intelligence differentiator landing page
  // (SoftwareApplication + FAQPage JSON-LD). New 2026-06-20; the SEO/GEO surface
  // for "AI wedding planner Philippines" / vendor matchmaking.
  { path: '/setnayan-ai', lastmod: '2026-06-20', changefreq: 'monthly', priority: '0.8' },

  // "Pa-" feature landing pages — five force-static differentiator surfaces, each
  // with SoftwareApplication + FAQPage JSON-LD (owner-approved 2026-06-27; Pa-
  // naming LOCKED; shipped 2026-06-28). SEO/GEO surfaces for live-stream, 3D
  // reception, animated monogram, wedding website, and highlight reels.
  { path: '/panood', lastmod: '2026-06-28', changefreq: 'monthly', priority: '0.8' },
  { path: '/pa3d', lastmod: '2026-06-28', changefreq: 'monthly', priority: '0.7' },
  { path: '/palogo', lastmod: '2026-06-28', changefreq: 'monthly', priority: '0.7' },
  { path: '/pawebsite', lastmod: '2026-06-28', changefreq: 'monthly', priority: '0.8' },
  { path: '/patiktok', lastmod: '2026-06-28', changefreq: 'monthly', priority: '0.7' },

  // /why-setnayan — comparison / differentiation page (WebPage + FAQPage JSON-LD).
  // New 2026-06-20; the GEO/SEO surface for "wedding app comparison" / "best
  // wedding app Philippines" — the citable "three apps in one" frame.
  { path: '/why-setnayan', lastmod: '2026-06-20', changefreq: 'monthly', priority: '0.7' },

  // /waitlist — pre-launch surface. Updated when pilot/launch dates shift.
  { path: '/waitlist', lastmod: '2026-05-28', changefreq: 'weekly', priority: '0.7' },

  // /download — Mac app distribution page (Tauri v0.0.1 per CLAUDE.md
  // 2026-05-14 row). No new platform tiles until Apple/Google approvals.
  { path: '/download', lastmod: '2026-05-14', changefreq: 'monthly', priority: '0.5' },

  // /privacy — RA 10173 disclosures (last meaningful update: 2026-05-28
  // PR #273 + Concierge processing disclosure section).
  { path: '/privacy', lastmod: '2026-06-30', changefreq: 'monthly', priority: '0.5' },

  // /terms — full terms rewrite 2026-06-30 (eligibility, payments/refunds,
  // content license, vendor rules, liability, PH governing law).
  { path: '/terms', lastmod: '2026-06-30', changefreq: 'monthly', priority: '0.5' },

  // Compliance pages added 2026-06-30 — refund/cancellation policy, cookie
  // policy, and acceptable use / community guidelines.
  { path: '/refunds', lastmod: '2026-06-30', changefreq: 'monthly', priority: '0.5' },
  { path: '/cookies', lastmod: '2026-06-30', changefreq: 'monthly', priority: '0.5' },
  { path: '/acceptable-use', lastmod: '2026-06-30', changefreq: 'monthly', priority: '0.5' },

  // /login + /signup — auth surfaces, structurally stable. OAuth providers
  // last updated 2026-05-23 (PR #422 Google + Facebook).
  { path: '/login', lastmod: '2026-05-23', changefreq: 'yearly', priority: '0.5' },
  { path: '/signup', lastmod: '2026-05-23', changefreq: 'yearly', priority: '0.6' },

  // Keynote scroll decks de-listed 2026-06-13 — the 2026-05-28 deck snapshot
  // drifted from the live product (carried retired ₱1,499 verification fee,
  // "BIR-compliant receipts", and "Today's Focus" naming). Also disallowed in
  // robots.ts so AI answer engines stop citing stale copy. Re-list after a
  // deck refresh if /keynote should rank again.
];

export async function GET(): Promise<Response> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';

  const urls = STATIC_ROUTES.map(
    (r) =>
      `  <url>\n    <loc>${baseUrl}${r.path}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
  ).join('\n');

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
