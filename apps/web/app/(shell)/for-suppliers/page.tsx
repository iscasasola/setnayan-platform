/**
 * /for-suppliers — "Built to grow your business — free."
 *
 * 🔀 MOVED 2026-09-30 from /vendors (owner, DECISION_LOG 2026-09-29 "LANE 2 §2C":
 * "supplier sign-up moves /vendors → /for-suppliers with a permanent forward from
 * the old address"). `/vendors` and `/for-vendors` are 308s here in
 * next.config.ts; the old marketplace SUBPATHS `/vendors/*` keep their own 308
 * to /explore in middleware.ts. Component names below still say "Vendor" —
 * code names are frozen; only what a person reads says "supplier".
 *
 * Rebuilt 2026-07-05 to the owner-approved prototype (vendors_page_v2_final.html):
 * a free-forward, grow-with-us narrative → the tier ladder → a "for those who
 * need more" Custom callout → CTA. The ladder now LEADS with per-plan DELTAS
 * (what each plan adds, once) and keeps the ~90-row matrix behind a disclosure
 * inside the same section.
 *
 * 🧭 MOVED INTO `app/(shell)/` 2026-11-04 (owner, on his phone: *"the page is on
 * the wrong shell"*). It used to sit outside the group and wear the older
 * SiteChrome glass nav + reskin footer, while every other public page wears the
 * front-door bar + rail from `app/(shell)/layout.tsx`. Only this `page.tsx`
 * moved — the sections stay in `app/for-suppliers/_components/` (the same split
 * /features uses) — and the route left `NAV_ROUTES` in site-chrome.tsx, so the
 * chrome is drawn once. It is full-bleed (`DOORWAY_BLEED_PATHS`): the photo hero
 * and the dark bands run edge to edge and every section caps its own width.
 * The URL is unchanged; `/vendors` and `/for-vendors` still 308 here.
 * Held by `for-suppliers-wears-the-shell.test.ts` beside this file.
 *
 * Narrative flow (top→bottom) — 🆕 PORTED 2026-11-04 from the owner-approved
 * prototype `prototypes/for_suppliers_2026-11-04.html` (Setnayan-specs; DECISION_LOG
 * 2026-11-04 "THE THREE MARKETING PAGES GO TO CLOUD BUILD"). The prototype is
 * "the TOP of the supplier benefits page"; what it does not redraw stays below it:
 *   hero (aspiring · new · experienced, six trade photos) → Verified only →
 *   twelve problems suppliers face → your package (the couple's free tools +
 *   the gifts you can give, owner 5 Nov) → plans, every tool, climbing →
 *   tier DELTAS + the full matrix ("further down this page", #plan-table) →
 *   couple-pricing pointer → close ("Set na ’yan.").
 *   ⚖ Owner 2026-11-05 (DECISION_LOG "FOR SUPPLIERS … (P)"): the older deeper
 *   sections (one home · Setnayan AI · fair by design · get discovered ·
 *   analytics · trust · merit only · reach · the tools · get paid) are DROPPED —
 *   "the 4 Nov prototype is the page". The thesis strip and the old closing CTA
 *   were retired before them.
 *
 * PRICE SOURCING (owner-locked "prices based on the admin page, not hardcoded"):
 *   Every vendor tier price comes from getVendorPrices() (live vendor_billing_
 *   catalog). force-dynamic keeps it always-live. The narrative sections speak
 *   the "free" thesis and render NO number; the matrix column price tags are the
 *   DB-resolved labels. ⚠ Custom's "from" floor USED to read that it was "the
 *   shared VENDOR_CUSTOM_TIER constant (composed per plan, not a DB SKU)". That
 *   was wrong: `vendor_custom_base` is an active catalog row and is where the
 *   number came from. It now reads the catalog like every other price, as does
 *   the branch dial — neither is typed anywhere.
 *
 * The matrix is DATA-DRIVEN (VENDOR_TIER_SECTIONS + TIER_CAPS via
 * VendorTierMatrix) — the ~90 rows are built from the canonical arrays, never
 * hand-hardcoded in JSX. Front-end only: no checkout / entitlement / DB change.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { VendorGrowHero } from '@/app/for-suppliers/_components/vendor-grow-hero';
import {
  VendorGrowVerifiedOnly,
  VendorGrowProblems,
  VendorGrowCTA,
} from '@/app/for-suppliers/_components/vendor-grow-sections';
import { VendorTierMatrix } from '@/app/for-suppliers/_components/vendor-tier-matrix';
import {
  SupplierSpecialTools,
  TradeEco,
  TradeMarketing,
  TradePlans,
  TradeRewards,
} from '@/app/_components/marketing/trade/trade-widgets';
import { RevealOnView } from '@/app/for-suppliers/_components/for-vendors-motion';
import { getVendorPrices } from '@/lib/v2-catalog';
import { getLiveBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import type { BookingFeeSchedule } from '@/lib/booking-fee';
import { supplierCommissionPromise, supplierCommissionShort } from '@/lib/commission-promise';
import { FIRST_BOOKING_ON_US_CLAUSE } from '@/lib/booking-fee-lock';
import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';

// Per-request rendering (owner 2026-06-08 "make sure these prices are based on
// the admin page and not hardcoded"): the vendor tier prices read the live
// catalog DB via getVendorPrices(). `force-dynamic` now comes from the group
// layout, `app/(shell)/layout.tsx`, which owns it for every shelled page
// (`one-shell-mount.test.ts` forbids a page re-declaring it — the /pricing pattern).

type VendorPrices = Awaited<ReturnType<typeof getVendorPrices>>;

/**
 * "Solo ₱1,000 · Pro ₱2,500" — only the tiers whose price was READ. A tier whose
 * catalog row came back empty is left out of the copy entirely; it is never
 * priced from a typed fallback. `''` when nothing was readable.
 */
function tierPriceCopy(
  p: VendorPrices,
  tiers: readonly ('solo' | 'pro' | 'enterprise')[],
  perEach = '',
): string {
  const price = {
    solo: p.soloMonthly,
    pro: p.proMonthly,
    enterprise: p.enterpriseMonthly,
  } as const;
  const name = { solo: 'Solo', pro: 'Pro', enterprise: 'Ultra' } as const;
  return tiers
    .filter((t) => price[t] !== null)
    .map((t) => `${name[t]} ${price[t]}${perEach}`)
    .join(' · ');
}

// DB-driven metadata — the tier prices come from getVendorPrices().
export async function generateMetadata() {
  // The LIVE booking-fee schedule, never the code default (audit 2026-10-12, item 5).
  const [p, fee] = await Promise.all([getVendorPrices(), getLiveBookingFeeSchedule()]);
  const all = ['solo', 'pro', 'enterprise'] as const;
  const allLine = tierPriceCopy(p, all);
  const title = `Setnayan for Suppliers · Built to grow your business — free${allLine ? ` · ${allLine} / 28d` : ''}`;
  const perBlock = tierPriceCopy(p, all, '/28d');
  const perBlockTwo = tierPriceCopy(p, ['solo', 'pro'], '/28d');
  return {
    title,
    description: `Run your whole wedding business here free — import clients, get a search-ready Setnayan page, get discovered. Free to join. ${supplierCommissionShort(fee)} — ${FIRST_BOOKING_ON_US_CLAUSE}, and your own clients always stay free.${perBlock ? ` ${perBlock}.` : ''}`,
    alternates: { canonical: '/for-suppliers' },
    openGraph: {
      images: BRAND_OG_IMAGES,
      title,
      description: `Run your whole business here free · ${supplierCommissionShort(fee)} · your own clients always free.${perBlockTwo ? ` ${perBlockTwo}.` : ''}`,
      url: '/for-suppliers',
      type: 'website',
      siteName: 'Setnayan',
    },
    twitter: {
      images: BRAND_TWITTER_IMAGES,
      card: 'summary_large_image',
      title,
      description: `Built to grow your business — free. ${supplierCommissionShort(fee)}.${allLine ? ` ${allLine}/28d.` : ''}`,
    },
  };
}

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

// Schema.org pricing — vendor tier Offers (Solo / Pro / Enterprise · prices
// from the live catalog, never hardcoded).
function forVendorsJsonLd(p: VendorPrices, fee: BookingFeeSchedule | null) {
  // An Offer is emitted only for a tier whose price was actually read.
  const offer = (
    id: string,
    name: string,
    description: string,
    price: number | null,
  ) =>
    price === null
      ? null
      : {
          '@type': 'Offer',
          '@id': `${SITE_URL}/for-suppliers#${id}`,
          name,
          description,
          price: String(price),
          priceCurrency: 'PHP',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: String(price),
            priceCurrency: 'PHP',
            billingDuration: 'P28D',
            unitText: '28-DAY BLOCK',
          },
          availability: 'https://schema.org/InStock',
          seller: { '@id': `${SITE_URL}/#organization` },
          url: `${SITE_URL}/open-shop`,
        };
  const allLine = tierPriceCopy(p, ['solo', 'pro', 'enterprise']);
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
        '@id': `${SITE_URL}/for-suppliers#webpage`,
        url: `${SITE_URL}/for-suppliers`,
        name: `Setnayan for suppliers · Built to grow your business — free${allLine ? ` · ${allLine} / 28d` : ''}`,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#organization` },
        audience: {
          '@type': 'BusinessAudience',
          audienceType: 'Wedding & event service suppliers in the Philippines',
          geographicArea: { '@type': 'Country', name: 'Philippines' },
        },
      },
      offer(
        'solo-vendor-subscription',
        'Solo Supplier (28-day prepaid block)',
        `1 marketplace category · solo operator · verified profile + microsite + in-app chat + pipeline + calendar. Full in-app suite at the entry price. ${supplierCommissionPromise(fee)}`,
        p.num.soloMonthly,
      ),
      offer(
        'pro-vendor-subscription',
        'Pro Supplier (28-day prepaid block)',
        '3 marketplace categories · 3 team accounts · custom Setnayan page + slug · priority couple matching · Demand Radar · category benchmarks. 28-day prepaid blocks.',
        p.num.proMonthly,
      ),
      offer(
        'enterprise-subscription',
        'Ultra Supplier (28-day prepaid block)',
        'All marketplace categories · up to 10 team accounts + multi-admin · flagship page + video films · reach up to 100 km. 28-day prepaid blocks.',
        p.num.enterpriseMonthly,
      ),
      {
        '@type': 'BreadcrumbList',
        '@id': `${SITE_URL}/for-suppliers#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'For Suppliers', item: `${SITE_URL}/for-suppliers` },
        ],
      },
    ].filter((node) => node !== null),
  };
}

export default async function ForVendorsPage() {
  const [p, fee] = await Promise.all([getVendorPrices(), getLiveBookingFeeSchedule()]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(forVendorsJsonLd(p, fee)) }}
      />
      <main className="m-surface min-h-dvh">
        <VendorGrowHero fee={fee} />
        <RevealOnView>
          <VendorGrowVerifiedOnly />
        </RevealOnView>
        <VendorGrowProblems fee={fee} />
        {/* ══ THE FIVE SHARED WIDGETS (controller's prototype, artifact WAh2zYfLCurgknopQBf9WV v3; owner 5 Nov:
            build them here, shared with /for-coordinators). They replace the plan lines, the "Your package" section
            (folded into Marketing) and the per-plan deltas; the full matrix lives inside Plans, behind a fold. */}
        <RevealOnView>
          <TradeEco trade="supplier" />
        </RevealOnView>
        <RevealOnView>
          <TradePlans
            trade="supplier"
            prices={{ soloMonthly: p.soloMonthly, proMonthly: p.proMonthly, enterpriseMonthly: p.enterpriseMonthly }}
            fee={fee}
            fullTable={
              <VendorTierMatrix
                feeSchedule={fee}
                prices={{
                  soloMonthly: p.soloMonthly,
                  proMonthly: p.proMonthly,
                  enterpriseMonthly: p.enterpriseMonthly,
                  customFrom: p.customFrom,
                  branch: p.branch,
                }}
              />
            }
          />
        </RevealOnView>
        <RevealOnView>
          <SupplierSpecialTools />
        </RevealOnView>
        <RevealOnView>
          <TradeMarketing lede="Everything a supplier hands out at a bridal fair, a booth or the event itself, made from your shop." />
        </RevealOnView>
        <RevealOnView>
          <TradeRewards lede="Run your service for your clients and their guests inside Setnayan, and every booking, review and milestone earns you a badge. Most come with a gift for your next client: more for their guests to enjoy, on us." />
        </RevealOnView>
        {/*
          THE RETURN LEG — added 2026-09-22 at the owner's instruction.

          `/pricing` has carried a "Vendor? See the free business offering +
          your plans" pointer at `/vendors` for a long time. Nothing pointed
          back. So a supplier reading their own plans here had no route to the
          couple-facing catalogue — the prices their clients actually see, and
          the software a couple buys — and the two pricing surfaces were a
          one-way street.

          🔑 IT NAMES WHOSE PRICES ARE ON THE OTHER SIDE. "See pricing" would
          read, on this page, as "see MY pricing", which is the page the
          supplier is already on. The whole value of the link is that it leads
          somewhere different.

          Mirrors the /pricing pointer's own shape deliberately — same card,
          same ghost button, same arrow — so the pair reads as one crossing
          rather than two unrelated boxes.
        */}
        <section style={{ borderTop: '1px solid var(--m-hair)' }}>
          <div
            style={{
              maxWidth: 1120,
              margin: '0 auto',
              padding: '40px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                borderRadius: 'var(--m-r-lg)',
                border: '1px solid var(--m-hair)',
                background: 'var(--m-cream)',
                padding: 20,
              }}
              className="sn-vendors-pricing-pointer"
            >
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--m-ink)', margin: 0 }}>
                Planning your own event, or want to see what couples pay?
              </p>
              <Link
                href="/pricing"
                className="m-btn m-btn-ghost inline-flex shrink-0 items-center justify-center gap-2 text-sm"
              >
                Couple pricing
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </section>
        <RevealOnView>
          <VendorGrowCTA />
        </RevealOnView>
      </main>
    </>
  );
}
