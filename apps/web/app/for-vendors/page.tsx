import Link from 'next/link';
import { Apple } from 'lucide-react';
import { SiteHeader } from '@/app/_components/site-header';
import { Logo } from '@/app/_components/logo';
import { Hero } from './_sections/hero';
import { OperatingSystem } from './_sections/operating-system';
import { Pricing } from './_sections/pricing';
import { Testimonials } from './_sections/testimonials';
import { ClosingCta } from './_sections/closing-cta';
import { StickyMobileCta } from './_sections/sticky-mobile-cta';

// Page trim 2026-05-18: dropped Comparison, WhatYouKeep, SponsoredBoost,
// Verification sections to lighten the page (owner directive — "too
// documentary, want light and powerful for vendors to scale"). 17 sections
// → 7. Substance routed elsewhere: Sponsored Boost ladder lives on
// /pricing; verification flow + density rules link to /help; the
// before/after comparison content folded into the hero copy.

// /for-vendors — vendor-side acquisition landing page.
//
// Per iteration 0015 § Routes, /for-vendors is a "vendor-side deep dive
// (verification, payouts, marketing benefits)" page; per CLAUDE.md
// decision log 2026-05-15, it should be at LEAST as polished as the
// homepage and follow the Airbnb host-page convention (lead with
// merchant outcomes, Shopify pattern). This page is the exception to
// the homepage's hide-prices rule — vendors decide on cost, so Pro
// pricing is shown on the page rather than gated behind apply.
//
// Audience: vendors / photographers / florists / planners considering
// listing on Setnayan. Funnel target: /signup?as=vendor.

export const metadata = {
  title: 'Run your wedding business in one app — Setnayan for vendors',
  description:
    'List your wedding business free on Setnayan. One app for calendar, chat, proposals, payments, reviews — built for Filipino vendors. Pro at ₱499/week, paused anytime. BIR receipts handled.',
  alternates: {
    canonical: '/for-vendors',
  },
  openGraph: {
    title: 'Run your wedding business in one app — Setnayan for vendors',
    description:
      'Listing. Calendar. Chat. Proposals. Payments. Reviews. One app for Filipino wedding vendors. Free to list. Pro ₱499/week, paused anytime.',
    url: '/for-vendors',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Run your wedding business in one app — Setnayan for vendors',
    description:
      'Listing, calendar, chat, proposals, payments, reviews. One app for Filipino wedding vendors. Free to list.',
  },
};

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

const FOR_VENDORS_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Setnayan',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.svg`,
      areaServed: { '@type': 'Country', name: 'Philippines' },
    },
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/for-vendors#webpage`,
      url: `${SITE_URL}/for-vendors`,
      name: 'Setnayan for vendors — Run your wedding business in one app',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
      audience: {
        '@type': 'BusinessAudience',
        audienceType: 'Wedding service vendors in the Philippines',
        geographicArea: { '@type': 'Country', name: 'Philippines' },
      },
    },
    {
      '@type': 'Offer',
      '@id': `${SITE_URL}/for-vendors#free-listing`,
      name: 'Free vendor listing on Setnayan',
      description:
        'Free verified business profile on the Setnayan wedding vendor directory. Includes public profile page, in-platform messaging with couples, and coverage-city visibility across the Philippines.',
      price: '0',
      priceCurrency: 'PHP',
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${SITE_URL}/#organization` },
      url: `${SITE_URL}/signup?as=vendor`,
    },
    {
      '@type': 'Offer',
      '@id': `${SITE_URL}/for-vendors#pro-subscription`,
      name: 'Setnayan Pro for vendors (weekly subscription)',
      description:
        'Multi-service authoring, per-service calendars + master calendar, in-app payments with auto-disbursement, proposal builder, team / agent invites, plus free Setnayan Concierge for every couple you book. Billed weekly, paused anytime.',
      price: '499',
      priceCurrency: 'PHP',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '499',
        priceCurrency: 'PHP',
        unitText: 'WEEK',
      },
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${SITE_URL}/#organization` },
      url: `${SITE_URL}/signup?as=vendor`,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/for-vendors#breadcrumb`,
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
          name: 'For Vendors',
          item: `${SITE_URL}/for-vendors`,
        },
      ],
    },
  ],
};

export default function ForVendorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FOR_VENDORS_JSONLD) }}
      />
      <main className="min-h-dvh pb-24 sm:pb-0">
        <SiteHeader />
        <Hero />
        <OperatingSystem />
        <Pricing />
        <Testimonials />
        <ClosingCta />
        <SiteFooter />
      </main>
      <StickyMobileCta />
    </>
  );
}

function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-ink">
          <Logo height={24} />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Setnayan · setnayan.com
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>© 2026 Setnayan</span>
          <span aria-hidden>·</span>
          <span>Made in the Philippines</span>
          <span aria-hidden>·</span>
          <Link href="/help" className="hover:text-ink">
            Help
          </Link>
          <Link href="/download" className="inline-flex items-center gap-1 hover:text-ink">
            <Apple aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Mac app
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup?as=vendor" className="hover:text-ink">
            List your business
          </Link>
        </div>
      </div>
    </footer>
  );
}
