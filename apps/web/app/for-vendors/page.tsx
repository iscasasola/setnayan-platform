/**
 * /for-vendors — v2.1 template port from
 * /tmp/setnayan-keynote-template/"Setnayan For Vendors.html".
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 BRIEF LOCKED AS CANONICAL".
 * Owner directive: "this is the template we will use". The prior _sections
 * (hero/operating-system/pricing/testimonials/closing-cta/sticky-mobile-cta)
 * are REPLACED. The template composes a custom VendorHero, then shares the
 * homepage's shared marketing <Nav> (mounted site-wide via SiteChrome) +
 * StackCloseVendor + ForVendors + Voices + Pricing + FAQ + ClosingCTA + Footer.
 * (The bespoke per-page VendorNav was retired 2026-06-14 — commit 238ae4d1 —
 * in favor of the single shared site-wide nav; this page no longer renders its
 * own top nav.)
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
 *   - "Setnayan Concierge matching/matchmaking" → "Setnayan AI matching/matchmaking"
 *   - 0% commission + Setnayan-never-touches-the-money preserved (V2 publisher posture)
 *   - 4-tier matrix (Free / Verified / Pro / Enterprise) intact from template
 *   - Verification FREE during launch (₱1,499 one-time fee removed 2026-06-13) + ₱2,499/28d Pro + ₱5,499/28d Enterprise (28-day cadence locked 2026-05-30)
 *   - Founder bonus (100-token grant before 31 Jan 2027) REMOVED 2026-06-15 (owner)
 *
 * Per [[feedback_setnayan_button_preservation]] — every CTA placement +
 * interaction concept matches the template verbatim. The drift scrubs
 * touched COPY only, not button positions.
 */

import { VendorHero } from './_components/vendor-hero';
import { VendorVision } from './_components/vendor-vision';
import { StackCloseVendor } from './_components/stack-close-vendor';
import { ForVendorsDeepDive } from './_components/for-vendors-deep-dive';
import { EditorialBand } from './_components/editorial-band';
import { VendorDoorScenario } from './_components/vendor-door-scenario';
import { Voices, FAQ, ClosingCTA } from './_components/page-tail';
import { RevealOnView } from './_components/for-vendors-motion';
import { getVendorPrices } from '@/lib/v2-catalog';

// Per-request rendering (owner 2026-06-08 "make sure these prices are based on
// the admin page and not hardcoded"): the vendor tier prices now read the live
// catalog DB via getVendorPrices(). force-dynamic = always-live prices + the CI
// build skips the createAdminClient throw (the /pricing pattern). Was a 1hr ISR
// edge cache (SEO/GEO Bucket 8); the trade-off is no static CDN cache here.
export const dynamic = 'force-dynamic';

// DB-driven metadata (owner 2026-06-08 "prices based on the admin page, not
// hardcoded") — the Pro price comes from getVendorPrices().
export async function generateMetadata() {
  const p = await getVendorPrices();
  const title = `Setnayan for Vendors — Solo ${p.soloMonthly} · Pro ${p.proMonthly} · Enterprise ${p.enterpriseMonthly} / 28d`;
  return {
    title,
    description: `Solo ${p.soloMonthly}/28d · Pro ${p.proMonthly}/28d · Enterprise ${p.enterpriseMonthly}/28d. 0% commission on bookings — we never touch the money. In-app chat, pipeline, reviews.`,
    alternates: { canonical: '/for-vendors' },
    openGraph: {
      title,
      description: `Solo ${p.soloMonthly}/28d · Pro ${p.proMonthly}/28d. 0% commission on bookings — we never touch the money.`,
      url: '/for-vendors',
      type: 'website',
      siteName: 'Setnayan',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: `0% commission. Solo ${p.soloMonthly} · Pro ${p.proMonthly} · Enterprise ${p.enterpriseMonthly}/28d.`,
    },
  };
}

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

// Schema.org pricing — 3-tier vendor matrix (Solo / Pro / Enterprise · 2027-02-18)
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
      '@id': `${SITE_URL}/for-vendors#webpage`,
      url: `${SITE_URL}/for-vendors`,
      name: `Setnayan for vendors — Solo ${p.soloMonthly} · Pro ${p.proMonthly} · Enterprise ${p.enterpriseMonthly} / 28d`,
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
      '@id': `${SITE_URL}/for-vendors#solo-vendor-subscription`,
      name: 'Solo Vendor (28-day prepaid block)',
      description:
        '1 marketplace category · solo operator · verified profile + microsite + in-app chat + pipeline + calendar. Full in-app suite at the entry price. 0% commission — Setnayan never touches the money between you and your couples.',
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
      url: `${SITE_URL}/signup?as=vendor`,
    },
    {
      '@type': 'Offer',
      '@id': `${SITE_URL}/for-vendors#pro-vendor-subscription`,
      name: 'Pro Vendor (28-day prepaid block)',
      description:
        "3 marketplace categories · 3 team accounts · custom website + slug · priority couple matching · AI Proposal Builder · category benchmarks. 28-day prepaid blocks (13 cycles/year).",
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
      url: `${SITE_URL}/signup?as=vendor`,
    },
    {
      '@type': 'Offer',
      '@id': `${SITE_URL}/for-vendors#enterprise-subscription`,
      name: 'Enterprise Vendor (28-day prepaid block)',
      description:
        'Multiple marketplace categories · unlimited team accounts · everything in Pro at extended 100km radius. 28-day prepaid blocks (13 cycles/year).',
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
        `${p.proAnnual}/year instead of ${p.proMonthly} × 13 cycles · save ${p.proAnnualSave}. Same Pro tier · 3 marketplace categories · 3 team accounts · custom website + slug · priority couple matching · AI Proposal Builder · category benchmarks. Single annual payment.`,
      price: String(p.num.proAnnual),
      priceCurrency: 'PHP',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(p.num.proAnnual),
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
        `${p.enterpriseAnnual}/year instead of ${p.enterpriseMonthly} × 13 cycles · save ${p.enterpriseAnnualSave}. Same Enterprise tier · all marketplace categories · unlimited team accounts · extended 100km radius · Single annual payment.`,
      price: String(p.num.enterpriseAnnual),
      priceCurrency: 'PHP',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(p.num.enterpriseAnnual),
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
        <VendorHero />
        {/*
          VendorVision · the "why" spine (owner brief 2026-06-15). The narrative
          that earns the vendor before the proof: the promise (give back your
          time), set-price-once, every-inquiry-counts, never-abuse, and how new
          vendors get discovered. Trimmed in the 2026-06-15 full reflow — the
          tools/tokens/Pro-Enterprise blocks moved to the what-you-get + pricing
          sections below to stop the page repeating itself.
        */}
        <RevealOnView>
          <VendorVision />
        </RevealOnView>
        {/* EditorialBand · one full-bleed photographic breath (owner 2026-06-15
            "use photos if needed") — bridges the vision into the what-you-get
            stack with a real on-brand reception photo. */}
        <EditorialBand />
        {/* VendorDoorScenario · the interactive objection-handler (owner ask
            2026-06-20). Disarms the relationship-first skeptic — "I value the
            personal touch, I don't use apps" — with one peer's story (Marco):
            validate, name the true cost, then show the app filter → match →
            walk the couple to his door → step back. Illustrative/labelled. */}
        <VendorDoorScenario />
        <RevealOnView>
          <StackCloseVendor />
        </RevealOnView>
        <RevealOnView>
          <ForVendorsDeepDive />
        </RevealOnView>
        <RevealOnView>
          <Voices />
        </RevealOnView>
        <RevealOnView>
          <FAQ
            vendorPrices={{
              soloMonthly: p.soloMonthly,
              proMonthly: p.proMonthly,
              enterpriseMonthly: p.enterpriseMonthly,
              tokenUnit: p.tokenUnit,
            }}
          />
        </RevealOnView>
        <RevealOnView>
          <ClosingCTA />
        </RevealOnView>
      </main>
    </>
  );
}
