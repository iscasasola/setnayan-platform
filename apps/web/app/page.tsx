/**
 * v2.1 marketing homepage · /
 *
 * WHY: CLAUDE.md 2026-05-28 10th + 11th rows — v2.1 brief LOCKED AS CANONICAL
 * + the keynote-template `Setnayan Site.html` is now the canonical homepage
 * layout. Owner directive "this is the template we will use" → replace the
 * prior `page-sections/*` composition wholesale with the v2.1 12-section
 * narrative ported from /tmp/setnayan-keynote-template/components/
 * homepage-*.jsx.
 *
 * SECTIONS (premium couple-centric redesign · owner brief 2026-06-13 —
 * homepage is strictly couple-centric; vendor doorway = VendorBand + footer):
 *   1. PromoBar           — pilot announcement (sticky top, above nav)
 *   2. Nav                — sticky nav with brand + search + CTA + mobile menu
 *   3. Hero               — "Goodbye, Viber chaos. Hello, Set na 'yan." +
 *                           chaos-vs-clean HeroCollage
 *   4. ProblemSection     — "Bakit Setnayan?" Six apps / twelve spreadsheets
 *   5. ForCouples         — couple feature showcase (replaced TwoSides)
 *   6. MarketplacePreview — verified vendor card grid
 *   7. OnTheDay           — day-of livestream + Same-Day Edit
 *   8. PersonalSite       — phone mock with guest microsite
 *   9. DashboardPreview   — couple dashboard mock
 *   10. PricingSection    — publisher posture (0% commission)
 *   11. FAQSection        — honest Q&A
 *   12. ClosingCTA + VendorBand + Footer
 *
 * v2.1 DRIFT SCRUBS applied throughout (per CLAUDE.md 2026-05-28 11th row):
 *   - "5% platform fee" / "we take a cut" → "0% commission"
 *   - "₱499/wk Pro" → "₱1,999/28 days Pro Vendor"
 *   - "Setnayan Concierge" → "Setnayan AI"
 *   - Vendor verification is FREE during launch (the old "₱1,499 one-time
 *     verification" + "₱499 refresh" fee was removed 2026-06-13 — stale)
 *
 * Per [[feedback_setnayan_button_preservation]] all CTAs match template
 * placement + concept verbatim. Per [[feedback_setnayan_orphan_prevention]]
 * every CTA links to a real shipped route (/, /vendors, /for-vendors,
 * /signup, /login, /pricing, /privacy, /help, /features).
 *
 * REPLACES: the prior 17-section composition (page-sections/_*). Those
 * page-sections files retire — see CLAUDE.md decision-log row for this PR.
 * Per the prior file's metadata + JSON-LD + force-static behaviour: kept
 * the static rendering + GEO Phase G2 metadata + the homepage JSON-LD
 * Organization + WebSite + BreadcrumbList + SoftwareApplication graph so
 * AI answer engines + SERP cards keep their extractable surface intact.
 */

import {
  PromoBar,
  Nav,
  Hero,
  ProblemSection,
  ForCouples,
  MarketplacePreview,
  OnTheDay,
  PersonalSite,
  DashboardPreview,
  PricingSection,
  FAQSection,
  ClosingCTA,
  VendorBand,
  Footer,
} from '@/app/_components/marketing/_sections';

// GEO Phase G2 (2026-05-28) — brand-first title + value-prop description.
// Carried forward from prior page.tsx so AI answer engines + SERP cards
// keep extracting the same brand + price + 0% commission signals. Pricing
const HOME_TITLE = 'Setnayan · Filipino wedding planning + verified vendors';
const HOME_DESCRIPTION =
  'Filipino-first wedding planning. Free to start. Verified vendor marketplace. 0% commission. Plan your whole wedding in one place.';

export const metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: '/' },
  keywords: [
    'Filipino wedding planning',
    'Philippines wedding vendors',
    'wedding marketplace Manila',
    'Filipino wedding app',
    'Setnayan',
    'verified Filipino vendors',
    "Set na 'yan",
    'Filipino wedding software',
  ],
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: '/',
  },
  twitter: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
};

// Per-request rendering (owner 2026-06-08): the PricingSection reads live prices
// from the admin-managed catalog DB (fetchV2BundleCatalog / fetchV2CustomerCatalog
// via createAdminClient), the same way /pricing does. force-dynamic skips static
// prerender so (a) admin price edits show immediately with no redeploy, and (b)
// the CI build never hits the createAdminClient "missing service key" throw.
// Trade-off accepted: the homepage loses static CDN caching. (Was force-static.)
export const dynamic = 'force-dynamic';

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

// Homepage JSON-LD graph — RESTORED 2026-06-13. The v2.1 marketing port
// (e0a739b8) dropped the WebSite + SoftwareApplication graph this file's header
// (lines 40-42) still claims to emit; only the layout-level basic Organization
// survived. Consequences: the homepage stopped naming any product to AI answer
// engines (so they describe Setnayan as a generic "guest list + marketplace"
// tool), and the site-wide `${SITE_URL}/#website` node that /about references via
// `isPartOf` was left dangling (defined nowhere). This restores both: the
// canonical WebSite node + a SoftwareApplication whose featureList enumerates the
// differentiated capture/media layer (Papic, Panood, Setnayan AI, Pakanta,
// Animated Monogram) so ChatGPT / Perplexity / Claude / Gemini ground on the moat.
// Facts only — no SKU prices (those drift; /pricing is the source of truth); the
// free couple baseline is expressed as a single ₱0 Offer.
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: 'Setnayan',
  inLanguage: 'en-PH',
  publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
};

const softwareAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#software`,
  name: 'Setnayan',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Web, iOS, Android, macOS, Windows',
  inLanguage: 'en-PH',
  publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
  isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
  description:
    "The Philippines-first wedding platform. Couples plan free, then add the moments that set the day apart — Papic guest photo-and-video capture with auto-tagged galleries and personal reels, Panood livestream on the event page, the Setnayan AI planner, a custom Pakanta song, and an Animated Monogram. 0% commission on verified vendor bookings.",
  featureList: [
    // 2026-06-13 reprice scrub (Pricing.md § 00.D): RSVP is a paid SKU —
    // the "Free" prefix stays only on tools the ₱0 tier actually includes.
    'Guest list & RSVP management (guest list free with every account)',
    'Seating chart editor (free)',
    'Budget tracker with payment-deadline calendar export (free)',
    'Pakulay mood board (free)',
    'Personal event website with branded QR invitations',
    'Papic — guests’ phones become a coordinated photo-and-video crew, with QR + face-detection auto-tagged galleries and per-guest personal highlight reels',
    'Panood — day-of livestream embedded on the event website',
    'Setnayan AI — assisted planner that drafts timelines and matches verified vendors',
    'Pakanta — a custom Filipino-style wedding song produced for the couple',
    'Animated Monogram — a bespoke monogram + animation across invites, website, and signage',
    'Verified Filipino wedding vendor marketplace with 0% commission on every booking',
  ],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'PHP',
    description:
      'Free baseline planning tools for couples; premium services priced individually in PHP.',
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      <main className="bg-[var(--m-paper)] text-[var(--m-ink)]">
      <PromoBar />
      <Nav />
      <Hero />
      <ProblemSection />
      <ForCouples />
      <MarketplacePreview />
      <OnTheDay />
      <PersonalSite />
      <DashboardPreview />
      <PricingSection />
      <FAQSection />
      <ClosingCTA />
      <VendorBand />
      <Footer />
      </main>
    </>
  );
}
