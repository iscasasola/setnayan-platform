/**
 * /dev/for-suppliers-lab — the REAL `SupplierFrontPage` (the approved /for-suppliers of 6 Nov 2026) with the plan
 * prices filled in, for the side-by-side with the prototype. DEV-ONLY: production builds 404 this route
 * (`the-lab-never-ships.test.ts`), the same kill-switch as every other lab.
 *
 * Why it exists: a local checkout runs on a dummy env (never production's — `a-builders-lab-env-points-at-production`),
 * so `getVendorPrices()` reads nothing and the real page shows "Price unavailable" in Plans — the honest state, but
 * not the one the owner approved. Here the prices are LAB FIXTURES: the prototype's own figures, never read by any
 * shipped page. The fee is the code default schedule. The codes are drawn from the same real addresses as the page.
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

/** LAB FIXTURE — the prototype's figures (prototypes/for_suppliers_2026-11-06/index.html, Plans), not the catalog. */
const LAB_PRICES = {
  soloMonthly: '₱990',
  soloAnnual: '₱9,900',
  proMonthly: '₱2,490',
  proAnnual: '₱24,900',
  enterpriseMonthly: '₱5,990',
  enterpriseAnnual: '₱59,900',
  branch: '₱1,990',
  seat: '₱990',
};

export default async function ForSuppliersLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
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
      <SupplierFrontPage prices={LAB_PRICES} fee={{ schedule: BOOKING_FEE, enabled: true }} codes={codes} />
    </main>
  );
}
