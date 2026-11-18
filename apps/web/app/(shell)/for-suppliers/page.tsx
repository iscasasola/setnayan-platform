/**
 * /for-suppliers — "Not just a place to sell. A place to stay."
 *
 * 🆕 REBUILT 2026-11-06 to the owner-approved page (`prototypes/for_suppliers_2026-11-06/index.html` in the spec
 * corpus; DECISION_LOG "SUPPLIER FRONT PAGE (/for-suppliers): ONE STORY FOR EVERYONE — APPROVED"). The page itself is
 * `SupplierFrontPage` (`app/for-suppliers/_components/supplier-front-page.tsx`); this file READS what it shows:
 *
 *   · the plan prices, year prices and the branch + seat add-ons → `getVendorPrices()` (the live catalog — never typed);
 *   · the booking fee → `getLiveBookingFeeSchedule()` + `isBookingFeeEnabled()` — the live schedule, never the code
 *     default (`fee-copy-reads-the-live-rate.test.ts`);
 *   · the sample shop's four codes → its REAL addresses (`buildVendorInviteUrl`, `checkADateUrl`, `myPageUrl`), drawn
 *     by the same `renderUrlQrSvg` the Promote screen uses.
 *
 * ⚠ THE SAMPLE SHOP (`SAMPLE_SHOP`, `setnayan-production`) does not exist under that address in production yet — the
 * demo shop is `setnaprod`, and it is a demo shop, which the public shop page opens to nobody. Until the owner renames
 * and opens it, every code and "See a real shop" lead to a closed page. Owner task, flagged in the PR.
 *
 * 🧭 In the shell since 2026-11-04 (owner: *"the page is on the wrong shell"*): the front-door bar + rail come from
 * `app/(shell)/layout.tsx`, which also owns `force-dynamic` (`one-shell-mount.test.ts` forbids a page re-declaring
 * it). Full-bleed via `DOORWAY_BLEED_PATHS`. `/vendors` and `/for-vendors` still 308 here. Held by
 * `for-suppliers-wears-the-shell.test.ts` beside this file.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SupplierFrontPage, type SupplierFrontCodes } from '@/app/for-suppliers/_components/supplier-front-page';
import { SAMPLE_SHOP, growSpec } from '@/app/for-suppliers/_components/supplier-front-data';
import { isVendorFeatureGateEnabled } from '@/lib/vendor-feature-gate';
import { getVendorPrices } from '@/lib/v2-catalog';
import { getLiveBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import type { BookingFeeSchedule } from '@/lib/booking-fee';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { supplierCommissionPromise, supplierCommissionShort } from '@/lib/commission-promise';
import { FIRST_BOOKING_ON_US_CLAUSE } from '@/lib/booking-fee-lock';
import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { renderUrlQrSvg } from '@/lib/qr';
import { siteOrigin } from '@/lib/site-origin';
import { checkADateUrl } from '@/lib/check-a-date';
import { myPageUrl } from '@/lib/supplier-qr-codes';
import { buildVendorInviteUrl } from '@/lib/vendor-couple-invite';

type VendorPrices = Awaited<ReturnType<typeof getVendorPrices>>;

const HEADLINE = 'Not just a place to sell. A place to stay.';

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
  const title = `Setnayan for Suppliers · ${HEADLINE}${allLine ? ` · ${allLine} / 28d` : ''}`;
  const perBlock = tierPriceCopy(p, all, '/28d');
  const perBlockTwo = tierPriceCopy(p, ['solo', 'pro'], '/28d');
  return {
    title,
    description: `Your shop, your calendar, your clients and your event day, in one place. Free to start. ${supplierCommissionShort(fee)} — ${FIRST_BOOKING_ON_US_CLAUSE}, and your own clients always stay free.${perBlock ? ` ${perBlock}.` : ''}`,
    alternates: { canonical: '/for-suppliers' },
    openGraph: {
      images: BRAND_OG_IMAGES,
      title,
      description: `Your shop, your calendar, your clients and your event day, in one place · ${supplierCommissionShort(fee)} · your own clients always free.${perBlockTwo ? ` ${perBlockTwo}.` : ''}`,
      url: '/for-suppliers',
      type: 'website',
      siteName: 'Setnayan',
    },
    twitter: {
      images: BRAND_TWITTER_IMAGES,
      card: 'summary_large_image',
      title,
      description: `${HEADLINE} ${supplierCommissionShort(fee)}.${allLine ? ` ${allLine}/28d.` : ''}`,
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
        name: `Setnayan for suppliers · ${HEADLINE}${allLine ? ` · ${allLine} / 28d` : ''}`,
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
        'Plus (28-day prepaid block)',
        // Lane J: the plan's caps, read (this said "1 marketplace category · solo operator" — Supplier Plus is 2 · 1 seat since 4 Nov).
        `${growSpec('solo')}. ${supplierCommissionPromise(fee)}`,
        p.num.soloMonthly,
      ),
      offer(
        'pro-vendor-subscription',
        'Pro (28-day prepaid block)',
        // Lane J: was "3 marketplace categories · 3 team accounts" — Pro is 8 · 5 since 4 Nov.
        `${growSpec('pro')}. 28-day prepaid blocks.`,
        p.num.proMonthly,
      ),
      offer(
        'enterprise-subscription',
        'Ultra (28-day prepaid block)',
        // Lane J: was "All marketplace categories · reach up to 100 km" — Ultra is 15 categories, nationwide, since 4 Nov.
        `${growSpec('enterprise')}. 28-day prepaid blocks.`,
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

/** The sample shop's four scannable codes, at their real addresses. A code that fails to draw draws nothing. */
async function sampleShopCodes(): Promise<SupplierFrontCodes> {
  const origin = siteOrigin();
  const page = myPageUrl(origin, SAMPLE_SHOP.slug);
  const urls = {
    shortlist: buildVendorInviteUrl(SAMPLE_SHOP.slug),
    dates: checkADateUrl(origin, SAMPLE_SHOP.slug),
    page,
    review: `${page}#reviews`,
  };
  const draw = (url: string) => renderUrlQrSvg(url, 220).catch(() => '');
  const [shortlist, dates, pageSvg, review] = await Promise.all([
    draw(urls.shortlist),
    draw(urls.dates),
    draw(urls.page),
    draw(urls.review),
  ]);
  return {
    shortlist: { url: urls.shortlist, svg: shortlist },
    dates: { url: urls.dates, svg: dates },
    page: { url: urls.page, svg: pageSvg },
    review: { url: urls.review, svg: review },
  };
}

export default async function ForSuppliersPage() {
  const [p, fee, codes] = await Promise.all([getVendorPrices(), getLiveBookingFeeSchedule(), sampleShopCodes()]);
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
            soloAnnual: p.soloAnnual,
            soloAnnualSave: p.soloAnnualSave,
            proMonthly: p.proMonthly,
            proAnnual: p.proAnnual,
            proAnnualSave: p.proAnnualSave,
            enterpriseMonthly: p.enterpriseMonthly,
            enterpriseAnnual: p.enterpriseAnnual,
            enterpriseAnnualSave: p.enterpriseAnnualSave,
            branch: p.branch,
            seat: p.seat,
            bySku: p.bySku,
          }}
          paywallOn={isVendorFeatureGateEnabled()}
          fee={{ schedule: fee, enabled: isBookingFeeEnabled() }}
          codes={codes}
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
