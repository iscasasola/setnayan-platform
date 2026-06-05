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
 * SECTIONS (matches template `Site` composition order):
 *   1. PromoBar           — pilot announcement (sticky top, above nav)
 *   2. Nav                — sticky nav with brand + search + CTA
 *   3. Hero               — "Set na ʼyan." + HeroCollage dashboard mock
 *   4. ProblemSection     — "Six apps. Twelve spreadsheets." before/after
 *   5. TwoSides           — For couples / For vendors side-by-side
 *   6. MarketplacePreview — verified vendor card grid
 *   7. OnTheDay           — day-of livestream + Same-Day Edit
 *   8. PersonalSite       — phone mock with guest microsite
 *   9. DashboardPreview   — couple dashboard mock
 *   10. PricingSection    — publisher posture (0% commission)
 *   11. FAQSection        — 5 honest Q&A
 *   12. ClosingCTA + Footer
 *
 * v2.1 DRIFT SCRUBS applied throughout (per CLAUDE.md 2026-05-28 11th row):
 *   - "5% platform fee" / "we take a cut" → "0% commission"
 *   - "₱499/wk Pro" → "₱1,999/28 days Pro Vendor"
 *   - "Setnayan Concierge" → "Today's Focus"
 *   - "₱1,499 one-time verification" + "₱499 refresh" preserved
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
  TwoSides,
  MarketplacePreview,
  OnTheDay,
  PersonalSite,
  DashboardPreview,
  PricingSection,
  FAQSection,
  ClosingCTA,
  Footer,
} from '@/app/_components/marketing/_sections';

// GEO Phase G2 (2026-05-28) — brand-first title + value-prop description.
// Carried forward from prior page.tsx so AI answer engines + SERP cards
// keep extracting the same brand + price + 0% commission signals. Pricing
const HOME_TITLE = 'Setnayan · Filipino wedding planning + verified vendors';
const HOME_DESCRIPTION =
  'Filipino-first wedding planning. Free for couples. Verified vendor marketplace. 0% commission. Plan your whole wedding in one place.';

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

// Marketing home is rendered at build time and served from the CDN edge —
// no per-request SSR, no auth roundtrip, no serverless cold start. Carried
// forward from the prior page.tsx. Admin edits to widget toggles would have
// fired `revalidatePath('/')` in the prior implementation; the v2.1 port
// retires the per-widget admin toggle in favour of the canonical
// 12-section composition. `revalidate = false` means the static HTML is
// cached indefinitely; redeploys are the only refresh trigger now.
export const dynamic = 'force-static';
export const revalidate = false;

export default function HomePage() {
  return (
    <main className="bg-[var(--m-paper)] text-[var(--m-ink)]">
      <PromoBar />
      <Nav />
      <Hero />
      <ProblemSection />
      <TwoSides />
      <MarketplacePreview />
      <OnTheDay />
      <PersonalSite />
      <DashboardPreview />
      <PricingSection />
      <FAQSection />
      <ClosingCTA />
      <Footer />
    </main>
  );
}
