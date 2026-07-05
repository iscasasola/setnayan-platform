/**
 * /vendors — "Built to grow your business — free."
 *
 * Rebuilt 2026-07-05 to the owner-approved prototype (vendors_page_v2_final.html):
 * a free-forward, grow-with-us narrative → the full ~90-row tier MATRIX → a
 * "for those who need more" Custom callout → CTA. The persistent glass nav +
 * footer are global site-chrome (SiteChrome) — this page renders neither.
 *
 * Narrative flow (top→bottom):
 *   photographic hero → thesis strip (0% · ₱0 · pay-only-when-it-works) →
 *   run-your-business-here-free hub → Setnayan AI (dark signature: sells for
 *   you + 3 nudge steps + phone mock + flywheel callout) →
 *   never-spend-a-peso-that-doesn't-grow-you → free website that ranks (SEO/GEO)
 *   → analytics + only-inquiries-that-matter → trust earned not bought →
 *   no-fakes → reach that compounds → the tools → get paid your way →
 *   full 5-column tier MATRIX (Free·Verified / Solo / Pro / Enterprise / Custom)
 *   → Custom "for those who need more" → CTA.
 *
 * PRICE SOURCING (owner-locked "prices based on the admin page, not hardcoded"):
 *   Every vendor tier price comes from getVendorPrices() (live vendor_billing_
 *   catalog). force-dynamic keeps it always-live. The narrative sections speak
 *   the "free" thesis and render NO number; the matrix column price tags are the
 *   DB-resolved labels. Custom's "from ₱X" floor is the shared VENDOR_CUSTOM_TIER
 *   constant (composed per plan, not a DB SKU), parsed once — never a fresh
 *   hardcoded literal.
 *
 * The matrix is DATA-DRIVEN (VENDOR_TIER_SECTIONS + TIER_CAPS via
 * VendorTierMatrix) — the ~90 rows are built from the canonical arrays, never
 * hand-hardcoded in JSX. Front-end only: no checkout / entitlement / DB change.
 */

import { VendorGrowHero } from './_components/vendor-grow-hero';
import {
  VendorGrowThesis,
  VendorGrowHub,
  VendorGrowAI,
  VendorGrowFairPay,
  VendorGrowWebsite,
  VendorGrowAnalytics,
  VendorGrowTrust,
  VendorGrowNoFakes,
  VendorGrowReach,
  VendorGrowTools,
  VendorGrowGetPaid,
  VendorGrowCTA,
  VendorGrowStyles,
} from './_components/vendor-grow-sections';
import { VendorTierMatrix } from './_components/vendor-tier-matrix';
import { RevealOnView } from './_components/for-vendors-motion';
import { getVendorPrices } from '@/lib/v2-catalog';

// Per-request rendering (owner 2026-06-08 "make sure these prices are based on
// the admin page and not hardcoded"): the vendor tier prices read the live
// catalog DB via getVendorPrices(). force-dynamic = always-live prices + the CI
// build skips the createAdminClient throw (the /pricing pattern).
export const dynamic = 'force-dynamic';

// DB-driven metadata — the tier prices come from getVendorPrices().
export async function generateMetadata() {
  const p = await getVendorPrices();
  const title = `Setnayan for Vendors · Built to grow your business — free · Solo ${p.soloMonthly} · Pro ${p.proMonthly} · Enterprise ${p.enterpriseMonthly} / 28d`;
  return {
    title,
    description: `Run your whole wedding business here free — import clients, get a search-ready website, get discovered. 0% commission, always. Pay only when a booking comes through us. Solo ${p.soloMonthly}/28d · Pro ${p.proMonthly}/28d · Enterprise ${p.enterpriseMonthly}/28d.`,
    alternates: { canonical: '/vendors' },
    openGraph: {
      title,
      description: `Run your whole business here free · 0% commission, always · pay only when a booking comes through us. Solo ${p.soloMonthly}/28d · Pro ${p.proMonthly}/28d.`,
      url: '/vendors',
      type: 'website',
      siteName: 'Setnayan',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: `Built to grow your business — free. 0% commission. Solo ${p.soloMonthly} · Pro ${p.proMonthly} · Enterprise ${p.enterpriseMonthly}/28d.`,
    },
  };
}

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

// Schema.org pricing — vendor tier Offers (Solo / Pro / Enterprise · prices
// from the live catalog, never hardcoded).
function forVendorsJsonLd(p: Awaited<ReturnType<typeof getVendorPrices>>) {
  return {
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
        '@id': `${SITE_URL}/vendors#webpage`,
        url: `${SITE_URL}/vendors`,
        name: `Setnayan for vendors · Built to grow your business — free · Solo ${p.soloMonthly} · Pro ${p.proMonthly} · Enterprise ${p.enterpriseMonthly} / 28d`,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#organization` },
        audience: {
          '@type': 'BusinessAudience',
          audienceType: 'Wedding & event service vendors in the Philippines',
          geographicArea: { '@type': 'Country', name: 'Philippines' },
        },
      },
      {
        '@type': 'Offer',
        '@id': `${SITE_URL}/vendors#solo-vendor-subscription`,
        name: 'Solo Vendor (28-day prepaid block)',
        description:
          '1 marketplace category · solo operator · verified profile + microsite + in-app chat + pipeline + calendar. Full in-app suite at the entry price. 0% commission. Setnayan never touches the money between you and your couples.',
        price: String(p.num.soloMonthly),
        priceCurrency: 'PHP',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: String(p.num.soloMonthly),
          priceCurrency: 'PHP',
          billingDuration: 'P28D',
          unitText: '28-DAY BLOCK',
        },
        availability: 'https://schema.org/InStock',
        seller: { '@id': `${SITE_URL}/#organization` },
        url: `${SITE_URL}/open-shop`,
      },
      {
        '@type': 'Offer',
        '@id': `${SITE_URL}/vendors#pro-vendor-subscription`,
        name: 'Pro Vendor (28-day prepaid block)',
        description:
          '3 marketplace categories · 3 team accounts · custom website + slug · priority couple matching · Demand Radar · category benchmarks. 28-day prepaid blocks.',
        price: String(p.num.proMonthly),
        priceCurrency: 'PHP',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: String(p.num.proMonthly),
          priceCurrency: 'PHP',
          billingDuration: 'P28D',
          unitText: '28-DAY BLOCK',
        },
        availability: 'https://schema.org/InStock',
        seller: { '@id': `${SITE_URL}/#organization` },
        url: `${SITE_URL}/open-shop`,
      },
      {
        '@type': 'Offer',
        '@id': `${SITE_URL}/vendors#enterprise-subscription`,
        name: 'Enterprise Vendor (28-day prepaid block)',
        description:
          'All marketplace categories · up to 10 team accounts + multi-admin · flagship page + video films · reach up to 100 km. 28-day prepaid blocks.',
        price: String(p.num.enterpriseMonthly),
        priceCurrency: 'PHP',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: String(p.num.enterpriseMonthly),
          priceCurrency: 'PHP',
          billingDuration: 'P28D',
          unitText: '28-DAY BLOCK',
        },
        availability: 'https://schema.org/InStock',
        seller: { '@id': `${SITE_URL}/#organization` },
        url: `${SITE_URL}/open-shop`,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${SITE_URL}/vendors#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'For Vendors', item: `${SITE_URL}/vendors` },
        ],
      },
    ],
  };
}

export default async function ForVendorsPage() {
  const p = await getVendorPrices();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(forVendorsJsonLd(p)) }}
      />
      <main className="m-surface min-h-dvh">
        <VendorGrowHero />
        <VendorGrowThesis />
        <RevealOnView>
          <VendorGrowHub />
        </RevealOnView>
        <VendorGrowAI />
        <RevealOnView>
          <VendorGrowFairPay />
        </RevealOnView>
        <RevealOnView>
          <VendorGrowWebsite />
        </RevealOnView>
        <RevealOnView>
          <VendorGrowAnalytics />
        </RevealOnView>
        <RevealOnView>
          <VendorGrowTrust />
        </RevealOnView>
        <VendorGrowNoFakes />
        <RevealOnView>
          <VendorGrowReach />
        </RevealOnView>
        <RevealOnView>
          <VendorGrowTools />
        </RevealOnView>
        <RevealOnView>
          <VendorGrowGetPaid />
        </RevealOnView>
        {/* The full ~90-row tier MATRIX — data-driven from VENDOR_TIER_SECTIONS +
            TIER_CAPS, 5 columns (Free·Verified / Solo / Pro / Enterprise /
            Custom). Column price tags read the live catalog via getVendorPrices
            (never hardcoded); the Custom "from" floor is the shared
            VENDOR_CUSTOM_TIER constant. The section already carries its own
            "for those who need more" Custom callout. */}
        <RevealOnView>
          <VendorTierMatrix
            prices={{
              soloMonthly: p.soloMonthly,
              proMonthly: p.proMonthly,
              enterpriseMonthly: p.enterpriseMonthly,
            }}
          />
        </RevealOnView>
        <VendorGrowCTA />
        <VendorGrowStyles />
      </main>
    </>
  );
}
