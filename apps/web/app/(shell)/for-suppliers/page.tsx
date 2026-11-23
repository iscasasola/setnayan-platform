/**
 * /for-suppliers — "Run the business you already have."
 *
 * 🆕 REBUILT 2026-11-20 to the owner-approved drawing `prototypes/for_suppliers_2026-11-20/` (spec corpus), which
 * replaced the 6 Nov page ("Not just a place to sell. A place to stay."). Every line of the drawing ships only once
 * its build is live — see the header of `SupplierFrontPage` (`app/for-suppliers/_components/supplier-front-page.tsx`)
 * for what it shows instead. This file READS what it shows:
 *
 *   · the plan prices, year prices and the branch + seat add-ons → `getVendorPrices()` (the live catalog — never typed);
 *   · the booking fee → `getLiveBookingFeeSchedule()` + `isBookingFeeEnabled()` — the live schedule, never the code
 *     default (`fee-copy-reads-the-live-rate.test.ts`);
 *   (the 20 Nov drawing shows no sample-shop QR codes, so the page no longer draws them).
 *
 * 🧭 In the shell since 2026-11-04 (owner: *"the page is on the wrong shell"*): the front-door bar + rail come from
 * `app/(shell)/layout.tsx`, which also owns `force-dynamic` (`one-shell-mount.test.ts` forbids a page re-declaring
 * it). Full-bleed via `DOORWAY_BLEED_PATHS`. `/vendors` and `/for-vendors` still 308 here. Held by
 * `for-suppliers-wears-the-shell.test.ts` beside this file.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SupplierFrontPage } from '@/app/for-suppliers/_components/supplier-front-page';
import { growSpec } from '@/app/for-suppliers/_components/supplier-front-data';
import { isVendorFeatureGateEnabled } from '@/lib/vendor-feature-gate';
import { getCustomerSkuPrice, getVendorPrices } from '@/lib/v2-catalog';
import { getLiveBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import type { BookingFeeSchedule } from '@/lib/booking-fee';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { supplierCommissionPromise, supplierCommissionShort } from '@/lib/commission-promise';
import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { createAdminClient } from '@/lib/supabase/admin';
import { readSpecialToolsPaidFrom } from '@/lib/special-tools.server';

type VendorPrices = Awaited<ReturnType<typeof getVendorPrices>>;

/** The gift the "How Setnayan earns" row prices from — the smallest single gift a supplier can give (owner, 16 Nov). */
const GIFT_FROM_SKU = 'PAPIC_GUEST_150';

const HEADLINE = 'Run the business you already have.';

/**
 * "Supplier Plus ₱… · Supplier Pro ₱…" — only the tiers whose price was READ. A tier whose
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
  const name = { solo: 'Plus', pro: 'Pro', enterprise: 'Ultra' } as const;
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
  const title = `Setnayan for Suppliers · ${HEADLINE}${allLine ? ` · ${allLine} / month` : ''}`;
  const perBlock = tierPriceCopy(p, all, '/month');
  const perBlockTwo = tierPriceCopy(p, ['solo', 'pro'], '/month');
  return {
    title,
    description: `Your clients, quotes and dates. One free place. Free to start, free to stay. ${supplierCommissionShort(fee)} — your booking is free when you bring the event first.${perBlock ? ` ${perBlock}.` : ''}`,
    alternates: { canonical: '/for-suppliers' },
    openGraph: {
      images: BRAND_OG_IMAGES,
      title,
      description: `Your clients, quotes and dates. One free place · ${supplierCommissionShort(fee)} · free when you bring the event first.${perBlockTwo ? ` ${perBlockTwo}.` : ''}`,
      url: '/for-suppliers',
      type: 'website',
      siteName: 'Setnayan',
    },
    twitter: {
      images: BRAND_TWITTER_IMAGES,
      card: 'summary_large_image',
      title,
      description: `${HEADLINE} ${supplierCommissionShort(fee)}.${allLine ? ` ${allLine}/month.` : ''}`,
    },
  };
}

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

// Schema.org pricing — supplier plan Offers (Supplier Plus / Supplier Pro / Supplier Ultra · prices
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
            billingDuration: 'P1M',
            unitText: 'MONTH',
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
        name: `Setnayan for suppliers · ${HEADLINE}${allLine ? ` · ${allLine} / month` : ''}`,
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
        'Plus (monthly plan)',
        // Lane J: the plan's caps, read (this said "1 marketplace category · solo operator" — Supplier Plus is 2 · 1 seat since 4 Nov).
        `${growSpec('solo')}. ${supplierCommissionPromise(fee)}`,
        p.num.soloMonthly,
      ),
      offer(
        'pro-vendor-subscription',
        'Pro (monthly plan)',
        // Lane J: was "3 marketplace categories · 3 team accounts" — Pro is 8 · 5 since 4 Nov.
        `${growSpec('pro')}. Billed monthly.`,
        p.num.proMonthly,
      ),
      offer(
        'enterprise-subscription',
        'Ultra (monthly plan)',
        // Lane J: was "All marketplace categories · reach up to 100 km" — Ultra is 15 categories, nationwide, since 4 Nov.
        `${growSpec('enterprise')}. Billed monthly.`,
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

export default async function ForSuppliersPage() {
  // 🎁 The lowest single gift's LIST price (owner: Papic 150) for the "How Setnayan earns" gift row — every shop pays the
  // list price (DECISION_LOG 14 Nov "BUY 10, GET 1 FREE"; 16 Nov 03e465e1). Never the withheld gift column.
  // 🧰 The special tools' start date, read by the SAME reader the Cake Maker's gate uses (`readSpecialToolsPaidFrom`):
  // before it the page says the tool is open to every plan; a refused read says nothing either way.
  const [p, fee, papic150, specialTools] = await Promise.all([
    getVendorPrices(),
    getLiveBookingFeeSchedule(),
    getCustomerSkuPrice(GIFT_FROM_SKU),
    readSpecialToolsPaidFrom(createAdminClient()).catch(() => ({ status: 'unread' as const })),
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(forVendorsJsonLd(p, fee)) }}
      />
      <main className="min-h-dvh">
        <SupplierFrontPage
          prices={{
            soloMonthly: p.soloMonthly,
            proMonthly: p.proMonthly,
            enterpriseMonthly: p.enterpriseMonthly,
            branch: p.branch,
            seat: p.seat,
            bySku: p.bySku,
          }}
          giftFrom={papic150 ? `₱${papic150}` : null}
          specialTools={specialTools}
          nowMs={Date.now()}
          paywallOn={isVendorFeatureGateEnabled()}
          fee={{ schedule: fee, enabled: isBookingFeeEnabled() }}
          afterPlans={
            /*
              THE RETURN LEG (owner, 2026-09-22): /pricing points here, and this points back — named for WHOSE prices
              are on the other side, so it never reads as "see my pricing" on the page that is the supplier's pricing.
            */
            <div className="flex flex-wrap items-center gap-3" style={{ paddingTop: 8 }}>
              <p style={{ fontSize: 15, color: 'var(--m-slate-2)', margin: 0 }}>
                Planning your own event, or want to see what couples pay?
              </p>
              <Link href="/pricing" className="m-btn m-btn-ghost inline-flex shrink-0 items-center justify-center gap-2 text-sm">
                Couple pricing
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </div>
          }
        />
      </main>
    </>
  );
}
