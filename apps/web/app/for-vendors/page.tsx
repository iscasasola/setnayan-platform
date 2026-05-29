/**
 * /for-vendors — v2.1 template port from
 * /tmp/setnayan-keynote-template/"Setnayan For Vendors.html".
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 BRIEF LOCKED AS CANONICAL".
 * Owner directive: "this is the template we will use". The prior _sections
 * (hero/operating-system/pricing/testimonials/closing-cta/sticky-mobile-cta)
 * are REPLACED. The template composes a custom VendorHero + VendorNav unique
 * to this page, then shares the homepage's StackCloseVendor + ForVendors +
 * Voices + Pricing + FAQ + ClosingCTA + Footer.
 *
 * Parallel-dependency: agent-homepage is porting homepage-* into
 * apps/web/app/_components/marketing/ in parallel. As of branch-cut
 * (origin/main @ 06983a8 · 2026-05-28), the shared marketing/* components
 * had NOT landed. Strategy chosen per orchestrator brief: INLINE the
 * specific sections this page needs into apps/web/app/for-vendors/_components/
 * + flag the duplication in PR body for follow-up dedupe PR once
 * agent-homepage's shared components land.
 *
 * v2.1 drift scrubs applied (CLAUDE.md 2026-05-28 11th row supersedes lead-broker
 * pivot from rows 7-9 same day · further amended 2026-05-30 row § 1(a) +
 * § 4 + § 7(d) Pro 28-day price flip to ₱2,499 + Pro Annual to ₱24,999):
 *   - "Pro at ₱499/wk" (2x in StackCloseVendor) → "Pro at ₱2,499/28d" (2026-05-30)
 *   - "Setnayan Concierge matching/matchmaking" → "Today's Focus matching/matchmaking"
 *   - 0% commission + Setnayan-never-touches-the-money preserved (V2 publisher posture)
 *   - 4-tier matrix (Free / Verified / Pro / Enterprise) intact from template
 *   - ₱1,499 one-time verification + ₱2,499/28d Pro + ₱5,499/28d Enterprise (28-day cadence locked 2026-05-30)
 *   - 100-token founder bonus on verification before 31 Jan 2027 preserved
 *
 * Per [[feedback_setnayan_button_preservation]] — every CTA placement +
 * interaction concept matches the template verbatim. The drift scrubs
 * touched COPY only, not button positions.
 */

import { VendorNav } from './_components/vendor-nav';
import { VendorHero } from './_components/vendor-hero';
import { StackCloseVendor } from './_components/stack-close-vendor';
import { ForVendorsDeepDive } from './_components/for-vendors-deep-dive';
import { ProductionsCatalog } from './_components/productions-catalog';
import { Voices, Pricing, FAQ, ClosingCTA, Footer } from './_components/page-tail';

// SEO/GEO Bucket 8 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — 1hr Vercel
// edge cache so static marketing routes serve Google's crawl rate-limit
// budget without origin pressure. Each page rebuilds at most once per hour.
export const revalidate = 3600;

export const metadata = {
  title: 'Setnayan for Vendors — Free + Pro · ₱2,499/28d',
  description:
    'Free vendor profile + Pro tier ₱2,499/28d. 0% commission on bookings — we never touch the money. In-app chat, pipeline, reviews. Founder bonus 100 tokens on verification (until 31 Jan 2027).',
  alternates: {
    canonical: '/for-vendors',
  },
  openGraph: {
    title: 'Setnayan for Vendors — Free + Pro · ₱2,499/28d',
    description:
      'Free vendor profile + Pro tier ₱2,499/28d. 0% commission on bookings — we never touch the money.',
    url: '/for-vendors',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Setnayan for Vendors — Free + Pro · ₱2,499/28d',
    description:
      '0% commission. Free listing. Pro ₱2,499/28d. 100 founder bonus tokens on verification.',
  },
};

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

// Schema.org pricing — v2.1 4-tier vendor matrix (CLAUDE.md 2026-05-28 11th row)
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
      name: 'Setnayan for vendors — Free + Pro · ₱2,499/28d',
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
        'Free verified business profile + in-app chat + pipeline + calendar + BIR receipts. 0% commission on every booking — Setnayan never touches the money between you and your couples.',
      price: '0',
      priceCurrency: 'PHP',
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${SITE_URL}/#organization` },
      url: `${SITE_URL}/signup?as=vendor`,
    },
    {
      '@type': 'Offer',
      '@id': `${SITE_URL}/for-vendors#verified-vendor`,
      name: 'Verified Vendor · one-time lifetime badge',
      description:
        'One-time ₱1,499 verification (DTI · BIR · Mayor’s Permit · sample work). Lifetime verified badge + unlimited bids + ratings on profile + video calls with couples.',
      price: '1499',
      priceCurrency: 'PHP',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '1499',
        priceCurrency: 'PHP',
        unitText: 'ONE-TIME',
      },
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${SITE_URL}/#organization` },
      url: `${SITE_URL}/signup?as=vendor`,
    },
    {
      '@type': 'Offer',
      '@id': `${SITE_URL}/for-vendors#pro-vendor-subscription`,
      name: 'Pro Vendor (28-day prepaid block)',
      description:
        "One marketplace category · 5 team accounts · custom website + slug · Today's Focus priority matching · AI Proposal Builder · category benchmarks · 100 complimentary tokens on verification. 28-day prepaid blocks (13 cycles/year).",
      price: '2499',
      priceCurrency: 'PHP',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '2499',
        priceCurrency: 'PHP',
        billingDuration: 'P28D',
        unitText: '28-DAY BLOCK',
      },
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${SITE_URL}/#organization` },
      url: `${SITE_URL}/signup?as=vendor`,
    },
    {
      '@type': 'Offer',
      '@id': `${SITE_URL}/for-vendors#enterprise-subscription`,
      name: 'Enterprise Vendor (28-day prepaid block)',
      description:
        'Multiple marketplace categories · unlimited team accounts · everything in Pro at extended 100km radius. 28-day prepaid blocks (13 cycles/year).',
      price: '5499',
      priceCurrency: 'PHP',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '5499',
        priceCurrency: 'PHP',
        billingDuration: 'P28D',
        unitText: '28-DAY BLOCK',
      },
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${SITE_URL}/#organization` },
      url: `${SITE_URL}/signup?as=vendor`,
    },
    // Annual subscription Offers · added 2026-05-29 per CLAUDE.md eleventh
    // 2026-05-28 row · Pro Annual price updated ₱19,999 → ₱24,999 per
    // CLAUDE.md 2026-05-30 row § 4 (28-day × 13 cycles/year sticker = ₱32,487
    // for Pro · ~23% off with ₱24,999 annual · symmetric with Enterprise
    // ~23% off ₱71,487 sticker). Standard SaaS retention lever · Notion 16% ·
    // Linear 20% · Shopify 25% sit adjacent · 23% lands mid-range. Backed by
    // vendor_billing_catalog rows pro_vendor_annual + enterprise_vendor_annual
    // (price flip via migration 20260530010000_iteration_0006_v2_1_amendment_2).
    // Prevents the eighth-row schema.org JSON-LD undersell trap (annual SKUs
    // invisible to crawlers without their own Offer entries).
    {
      '@type': 'Offer',
      '@id': `${SITE_URL}/for-vendors#pro-vendor-annual-subscription`,
      name: 'Pro Vendor (annual subscription · save 23%)',
      description:
        "₱24,999/year instead of ₱2,499 × 13 cycles = ₱32,487 · save ₱7,488. Same Pro tier · one marketplace category · 5 team accounts · custom website + slug · Today's Focus priority matching · AI Proposal Builder · category benchmarks · 100 complimentary tokens on verification. Single annual payment.",
      price: '24999',
      priceCurrency: 'PHP',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '24999',
        priceCurrency: 'PHP',
        billingDuration: 'P1Y',
        unitText: 'YEAR',
      },
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${SITE_URL}/#organization` },
      url: `${SITE_URL}/signup?as=vendor`,
    },
    {
      '@type': 'Offer',
      '@id': `${SITE_URL}/for-vendors#enterprise-annual-subscription`,
      name: 'Enterprise Vendor (annual subscription · save 23%)',
      description:
        '₱54,999/year instead of ₱5,499 × 13 cycles = ₱71,487 · save ₱16,488. Same Enterprise tier · multiple marketplace categories · unlimited team accounts · extended 100km radius · Single annual payment.',
      price: '54999',
      priceCurrency: 'PHP',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '54999',
        priceCurrency: 'PHP',
        billingDuration: 'P1Y',
        unitText: 'YEAR',
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
      <main className="m-surface min-h-dvh">
        <VendorNav />
        <VendorHero />
        <StackCloseVendor />
        <ForVendorsDeepDive />
        <Voices />
        <Pricing />
        {/*
          ProductionsCatalog · added 2026-05-30 per CLAUDE.md row "For Vendors
          Section 4 · The Complete Offering". Renders the 18 complimentary
          tools + 21 Productions services live from platform_retail_catalog_v2.
          Sits between Pricing (vendor tier comparison) and FAQ so vendors who
          just compared Free/Verified/Pro/Enterprise see what couples actually
          buy next — and recognise the Token-Worthy items they can recommend
          for referral tokens. Auto-updates when admin edits a price in
          /admin/pricing (revalidatePath fired from server action).
        */}
        <ProductionsCatalog />
        <FAQ />
        <ClosingCTA />
        <Footer />
      </main>
    </>
  );
}
