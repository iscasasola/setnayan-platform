import { SiteHeader } from '@/app/_components/site-header';
import { FeaturesHero } from './_sections/_Hero';
import { FeaturesAnchorNav } from './_sections/_AnchorNav';
import { PlanningToolkit } from './_sections/_PlanningToolkit';
import { Communications } from './_sections/_Communications';
import { VendorsLedger } from './_sections/_VendorsLedger';
import { DayOfApparatus } from './_sections/_DayOfApparatus';
import { OutsourcingPacing } from './_sections/_OutsourcingPacing';
import { Compliance } from './_sections/_Compliance';
import { FinalCTA } from './_sections/_FinalCTA';
import { StickyMobileCTA } from './_sections/_StickyMobileCTA';
import { SiteFooter } from './_sections/_SiteFooter';

// /features — the deep-dive feature catalog page. Per iteration 0015 §
// Routes, this is the "features deep-dive (each tab + service explained
// more)" surface for couples who want to read more before applying.
//
// This page is also the recipient of the dropped Section 7 content
// ("Outsourcing, pacing, scheduling") from the homepage Decision 4
// redesign on 2026-05-15 — see § Section-by-section spec in the iteration
// 0015 spec file.
//
// Sections (in order):
// 1. Hero
// 2. Sticky scroll-spy anchor nav
// 3. Planning toolkit (guest list, seating, budget, mood board, schedule)
// 4. Communications (invitations, QR, microsite, RSVP, email)
// 5. Vendors & ledger (vendor mgmt, payment milestones, .ics, contracts)
// 6. Day-of apparatus (Panood, Papic, Pakulay, Pailaw, Pareto, Monogram)
// 7. Outsourcing / pacing / scheduling (the dropped Section 7)
// 8. Compliance & receipts (BIR ORs, RA 10173, EWT, Form 2307)
// 9. Final CTA + soft secondary to /for-vendors
// 10. Footer
//
// Cross-cutting standards (matches other marketing pages):
// - Mobile-first single-column → multi-column at md/lg
// - Sticky thumb-zone primary CTA on mobile (StickyMobileCTA)
// - WCAG 2.2 AA: visible focus rings, 44–48px tap targets, 4.5:1 contrast
// - Taglish-tolerant voice (subtle Tagalog touches, not costume)
// - Burgundy accent via the existing terracotta theme slot
// - In-app service references match locked SKU naming, no PHP figures
//
// The page is a server component (no auth check — couples and vendors
// both reach this page from search and the header nav, so we don't
// short-circuit signed-in users to /dashboard like the homepage does).

export const metadata = {
  title: 'Every Feature in Setnayan — Wedding & Life-Events Platform Philippines',
  description:
    'Guest list, seating, budget, mood board, schedule, vendor ledger, BIR-compliant receipts, plus day-of apparatus (Panood, Papic, Pakulay). The full feature catalog of the Filipino-first events platform.',
};

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

const FEATURES_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Setnayan',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.svg`,
    },
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/features`,
      url: `${SITE_URL}/features`,
      name: 'Features deep-dive — Setnayan',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: {
        '@id': `${SITE_URL}/#organization`,
      },
      inLanguage: 'en-PH',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/features#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${SITE_URL}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Features',
          item: `${SITE_URL}/features`,
        },
      ],
    },
  ],
};

export default function FeaturesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FEATURES_JSONLD) }}
      />
      <main className="min-h-dvh">
        <SiteHeader />
        <FeaturesHero />
        <FeaturesAnchorNav />
        <PlanningToolkit />
        <Communications />
        <VendorsLedger />
        <DayOfApparatus />
        <OutsourcingPacing />
        <Compliance />
        <FinalCTA />
        <SiteFooter />
        <StickyMobileCTA />
      </main>
    </>
  );
}
