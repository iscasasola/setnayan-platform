/**
 * Money › Offers & gifts — everything Setnayan gives away, ONE page with a What ▾ (admin reorg v7, owner call 12,
 * 17 Nov 2026: *"Yes, all 5"* — "Offers & gifts gets /admin/offers, the 5 old addresses forward").
 *
 * Reposition only (owner rule 17 Nov, *"No code everything that is already there"*): each view MOUNTS the shipped
 * page or Studio surface unchanged (`merged-view.ts`). The old addresses — /admin/launch-offer, /admin/discount-codes,
 * /admin/referrals, /admin/gifts, /admin/founder-seats, and the Studio's ?tab=discount-codes / ?tab=referrals — forward
 * here with `?view=` preselected, their query kept (`lib/admin/admin-pages.ts`). No new server action: every save is
 * still the old page's own.
 */
import { requireAdmin } from '@/lib/admin/require-admin';
import { mergedViewKey } from '@/lib/admin/admin-pages';
import { mountView, type SearchParamsRecord } from '../_components/merged-view';
import LaunchOfferPage from '../launch-offer/page';
import GiftsPage from '../gifts/page';
import FounderSeatsPage from '../founder-seats/page';
import { DiscountCodesSurface } from '../studio/_surfaces/discount-codes-surface';
import { ReferralsSurface } from '../studio/_surfaces/referrals-surface';

export const dynamic = 'force-dynamic';

const TITLE: Record<string, string> = {
  'discount-codes': 'Discount codes',
  referrals: 'Referrals',
  gifts: 'Gifts & comps',
  'founder-seats': 'Founder seats',
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const view = mergedViewKey(await searchParams);
  return { title: `${(view && TITLE[view]) || 'Launch offer'} · Offers & gifts · Admin` };
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminOffersPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireAdmin();
  const sp = await searchParams;
  switch (mergedViewKey(sp)) {
    case 'discount-codes':
      return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <DiscountCodesSurface
            filter={first(sp.filter)}
            created={first(sp.created)}
            updated={first(sp.updated)}
            disabled={first(sp.disabled)}
            enabled={first(sp.enabled)}
          />
        </div>
      );
    case 'referrals':
      return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <ReferralsSurface />
        </div>
      );
    case 'gifts':
      return mountView(GiftsPage, sp);
    case 'founder-seats':
      return mountView(FounderSeatsPage, sp);
    default:
      return mountView(LaunchOfferPage, sp);
  }
}
