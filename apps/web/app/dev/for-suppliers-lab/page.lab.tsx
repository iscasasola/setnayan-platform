/**
 * /dev/for-suppliers-lab — the REAL `SupplierFrontPage` (the approved /for-suppliers of 6 Nov 2026) with the plan
 * prices filled in, for the side-by-side with the prototype. DEV-ONLY: production builds 404 this route
 * (`the-lab-never-ships.test.ts`), the same kill-switch as every other lab.
 *
 * Why it exists: a local checkout runs on a dummy env (never production's — `a-builders-lab-env-points-at-production`),
 * so `getVendorPrices()` reads nothing and the real page shows "Price unavailable" in Plans — the honest state, but
 * not the one the owner approved. Here the prices are LAB PLACEHOLDERS (₱ · · ·) so the layout matches; no figure is
 * typed. The fee is the code default schedule. The codes are drawn from the same real addresses as the page.
 */
import { notFound } from 'next/navigation';
import { SupplierFrontPage, type SupplierFrontCodes } from '@/app/for-suppliers/_components/supplier-front-page';
import { SAMPLE_SHOP } from '@/app/for-suppliers/_components/supplier-front-data';
import { BOOKING_FEE } from '@/lib/booking-fee';
import { renderUrlQrSvg } from '@/lib/qr';
import { siteOrigin } from '@/lib/site-origin';
import { checkADateUrl } from '@/lib/check-a-date';
import { myPageUrl } from '@/lib/supplier-qr-codes';
import { buildVendorInviteUrl } from '@/lib/vendor-couple-invite';

/**
 * LAB FIXTURE — a visible placeholder, never a typed price (house rule: prices come only from the admin catalog;
 * `public-price-literals.test.ts` holds it). The live page reads `getVendorPrices()`; the dummy env has none.
 */
const LAB_PRICES = {
  soloMonthly: '₱ · · ·',
  soloAnnual: '₱ · · ·',
  proMonthly: '₱ · · ·',
  proAnnual: '₱ · · ·',
  enterpriseMonthly: '₱ · · ·',
  enterpriseAnnual: '₱ · · ·',
  branch: '₱ · · ·',
  seat: '₱ · · ·',
  // Every SKU the plan table names reads the same placeholder (Build 6 Lane J) — no figure is typed.
  bySku: new Proxy({} as Record<string, string | null>, { get: () => '₱ · · ·' }),
};

export default async function ForSuppliersLabPage({ searchParams }: { searchParams: Promise<{ paywall?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  // `?paywall=1` draws the table as it reads with the plan paywall ON; the default is production's switch, OFF.
  const paywallOn = (await searchParams).paywall === '1';
  const origin = siteOrigin();
  const page = myPageUrl(origin, SAMPLE_SHOP.slug);
  const urls = {
    shortlist: buildVendorInviteUrl(SAMPLE_SHOP.slug),
    dates: checkADateUrl(origin, SAMPLE_SHOP.slug),
    page,
    review: `${page}#reviews`,
  };
  const draw = (url: string) => renderUrlQrSvg(url, 220).catch(() => '');
  const codes: SupplierFrontCodes = {
    shortlist: { url: urls.shortlist, svg: await draw(urls.shortlist) },
    dates: { url: urls.dates, svg: await draw(urls.dates) },
    page: { url: urls.page, svg: await draw(urls.page) },
    review: { url: urls.review, svg: await draw(urls.review) },
  };
  return (
    <main style={{ ['--fd-bar' as string]: '0px' }}>
      <SupplierFrontPage prices={LAB_PRICES} fee={{ schedule: BOOKING_FEE, enabled: true }} codes={codes} paywallOn={paywallOn} />
    </main>
  );
}
