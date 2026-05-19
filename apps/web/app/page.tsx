import nextDynamic from 'next/dynamic';
import { SiteHeader } from '@/app/_components/site-header';
import { AnnouncementBar } from '@/app/page-sections/_AnnouncementBar';
import { BrowseStrip } from '@/app/page-sections/_BrowseStrip';
import { Hero } from '@/app/page-sections/_Hero';
import { RealNumbers } from '@/app/page-sections/_RealNumbers';
import { Chaos } from '@/app/page-sections/_Chaos';
import { TwoSides } from '@/app/page-sections/_TwoSides';
import { MariaJuan } from '@/app/page-sections/_MariaJuan';
import { InAppServices } from '@/app/page-sections/_InAppServices';
import { TransparentPricing } from '@/app/page-sections/_TransparentPricing';
import { ReadinessBoard } from '@/app/page-sections/_ReadinessBoard';
import { CoverageMap } from '@/app/page-sections/_CoverageMap';
import {
  ConversionModule,
  SiteFooter,
} from '@/app/page-sections/_DualCTAFooter';
import { AvailableEverywhere } from '@/app/page-sections/_AvailableEverywhere';
import { DynamicStickyMobileCTA } from '@/app/page-sections/_StickyMobileCTAClient';

// Section 8 (`_VendorCompat`) is the only below-the-fold section that ships
// real client-side state — a tabbed module with `useState`. Loading its JS
// chunk eagerly with the rest of the route bumps First Load JS for every
// visitor even though the section sits ~6 viewport-heights down on mobile.
// Lazy-import it with `next/dynamic({ ssr: true })` so the SSR HTML still
// contains the section (preserving SEO + above-the-fold layout stability)
// while its hydration JS lands in its own chunk that loads in parallel
// with the rest of the page.
const VendorCompat = nextDynamic(
  () => import('@/app/page-sections/_VendorCompat'),
  {
    // Placeholder height matches the rendered section's intrinsic min so
    // we don't introduce CLS during the brief hydration window.
    loading: () => <div aria-hidden className="min-h-[640px]" />,
  },
);

// Public-marketing-site homepage — iteration 0015 § Section-by-section spec
// (locked 2026-05-15). Twelve sections in spec order:
//   1  Announcement bar
//   2  Hero (three-question framing)
//   3  Real numbers (count-gated)
//   4  The chaos we're fixing
//   5  Built for both sides of the celebration
//   6  Maria & Juan: see how it works
//   7  In-app services (apparatus catalog)
//   8  Vendor compatibility & verification
//   9  Event-type readiness board
//  10  PH coverage map
//  11  Dual CTA conversion module + brand-origin footer
//  12  Available everywhere you plan
//
// Cross-cutting standards baseline:
//   - Mobile-first single-column layouts; multi-column at md/lg.
//   - Sticky thumb-zone primary CTA on mobile (auto-hides over Section 11).
//   - WCAG 2.2 AA — visible focus rings, 44-48px primary tap targets,
//     24px floor on secondary, 4.5:1 / 3:1 contrast.
//   - Taglish-tolerant voice copy where the spec specifies.
//   - Language switcher placeholder in footer with self-names
//     (English · Tagalog · Sugbuanon).
//
// TODO(post-Agent-D-merge): wire sections to site_widgets registry
//   (display_order, is_enabled, gate_type). Currently renders all 12
//   sections statically in spec order. Hide-condition logic for the
//   announcement bar (hide once verified_vendor_count >= 500) and the
//   count-gated stats render (Section 3) also depend on this.
//
// TODO(design-direction): swap placeholder visuals — chaos collage, hero
//   photographic background, coverage SVG basemap, readiness tile covers,
//   dashboard preview — for Filipino-luxe photography and final
//   illustration per owner's art direction. Skeleton-phase only.

const HOME_TITLE = 'Wedding Suppliers & Supplies Philippines';
const HOME_DESCRIPTION =
  "Setnayan is the only Filipino-built platform with real operating tools for both sides — from your guest list to your same-day highlight reel. Built in the Philippines.";

export const metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
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

// Marketing home is rendered at build time and served straight from the CDN
// edge — no per-request SSR, no auth roundtrip, no serverless cold start.
// TTFB drops from ~300 ms (Singapore edge bouncing to US-East compute) to
// ~30 ms (edge cache hit). The signed-in → /dashboard redirect that used
// to live in this file moved to middleware.ts so that this page stays
// statically pre-rendered for the 95%+ of visitors who arrive logged out.
export const dynamic = 'force-static';
export const revalidate = false;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

const HOMEPAGE_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Setnayan',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.svg`,
      description:
        'Filipino-first wedding and life-events platform. Verified Philippine wedding suppliers and supplies with transparent PHP pricing.',
      areaServed: { '@type': 'Country', name: 'Philippines' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: 'Setnayan',
      inLanguage: 'en-PH',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/vendors?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${SITE_URL}/`,
        },
      ],
    },
  ],
};

export default function HomePage() {
  // Signed-in viewers are redirected to /dashboard by middleware.ts
  // before this component runs, so this body only renders for anonymous
  // visitors. Keep it free of `cookies()`, `headers()`, or any other
  // dynamic API — adding one would silently revert this route to
  // per-request SSR and undo the TTFB win.
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_JSONLD) }}
      />
      <main className="min-h-dvh">
        {/* 1 — Announcement bar */}
        <AnnouncementBar />

        <SiteHeader />

        {/* Browse strip — Phase A scaffolding for the public-view-and-search
            lock (CLAUDE.md decision-log row 426, 2026-05-19). Sits between
            chrome and hero so pre-launch visitors who don't want to sign up
            yet still have a clear path into the already-shipped /vendors
            marketplace. The hero below keeps the funnel-first CTAs intact. */}
        <BrowseStrip />

        {/* 2 — Hero (three-question framing) */}
        <Hero />

        {/* 3 — Real numbers (count-gated; pre-threshold placeholder) */}
        <RealNumbers />

        {/* 4 — The chaos we're fixing */}
        <Chaos />

        {/* 5 — Built for both sides of the celebration */}
        <TwoSides />

        {/* 6 — Maria & Juan: see how it works */}
        <MariaJuan />

        {/* 7 — In-app services (apparatus catalog) */}
        <InAppServices />

        {/* 8 — Vendor compatibility & verification */}
        <VendorCompat />

        {/* 8.5 — Transparent pricing (locked 2026-05-16 spec-corpus row 9)
            Couple-side disclosure of the 5.0% Setnayan Pay convenience fee
            added at checkout. Vendor-side "no commission" framing in
            Sections 5 / 8 / /for-vendors stays intact — the 5.0% is
            couple-paid on top of the vendor's listed price, never deducted
            from the vendor's principal. */}
        <TransparentPricing />

        {/* 9 — Event-type readiness board */}
        <ReadinessBoard />

        {/* 10 — PH coverage map */}
        <CoverageMap />

        {/* 11 — Dual CTA conversion module (first half) */}
        <ConversionModule />

        {/* 12 — Available everywhere you plan
            Per spec § Section 12: renders visually between the conversion
            block and the footer chrome. */}
        <AvailableEverywhere />

        {/* 11 — Footer chrome (second half of Section 11) */}
        <SiteFooter />
      </main>

      {/* Cross-cutting: sticky thumb-zone CTA (mobile only).
          Loaded via a thin client wrapper that calls `next/dynamic({
          ssr: false })` — the widget is `lg:hidden`, so desktop visitors
          (lighthouse + most SEO crawlers) never need its JS, and even
          mobile users only need it after hydration. */}
      <DynamicStickyMobileCTA />
    </>
  );
}
