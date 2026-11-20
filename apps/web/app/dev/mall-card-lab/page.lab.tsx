/**
 * 🃏 `/dev/mall-card-lab` — card 14 on DISCOVER, drawn by the shipped pieces only: the real production cards' values
 * (`../suppliers-lab/mall-fixtures.ts`, read 20 Nov with a SELECT on prod) through `toServiceCard` → `ServiceCardView`
 * (`layout="mall"`) with the shipped `SaveVendorButton` on the photo, in the explore grid's own classes. Distances and
 * the price go through `lib/mall-card.ts` — never typed. Photos are the app's own marketing photos (prod cards have none).
 *
 *   &venue=none   the event has no venue → "Set your venue to see distance"
 *   &nopin=1      one shop has no place (no HQ, no branch) → no distance line, never "0 km"
 *   &guests=none  no guest count → a per-guest card shows its plain per-guest price
 *   &perguest=1   adds two LAB-ONLY per-guest cards (₱850 min 50 → a total; ₱650 min 250 → per guest)
 *   &saved=1      the first card reads as already saved (the filled bookmark)
 *
 * Dev only (`page.lab.tsx`). Pressing Save here calls the real action, which needs a signed-in session.
 */
import { notFound } from 'next/navigation';
import { ServiceCardView } from '@/app/_components/service-card-view';
import { SaveVendorButton } from '@/app/(shell)/explore/_components/save-vendor-button';
import { toServiceCard } from '@/lib/service-card-view-model';
import type { VendorServiceRow } from '@/lib/vendor-services';
import { MALL_SAVE_ON_PHOTO, aboutKmLine, mallPrice, nearestKm, perGuestPriceOf, pinOf } from '@/lib/mall-card';
import { MALL_REAL_GUESTS, MALL_REAL_VENUE, REAL } from '../suppliers-lab/mall-fixtures';

export const dynamic = 'force-dynamic';

const NOW = new Date('2026-11-20T09:00:00+08:00');
const PHOTO = (k: string) => `/marketing/for-suppliers-2026-11-06/supplier-${k}-hero.webp`;

type LabCard = {
  id: string;
  shop: string;
  city: string;
  title: string;
  from: number;
  verified: boolean;
  hq: [string, string] | null;
  photo: string;
  perPax?: { rate: number; min: number };
};

function row(c: LabCard): VendorServiceRow {
  return {
    vendor_service_id: `00000000-0000-4000-8000-${c.id.padStart(12, '0').slice(-12)}`,
    public_id: null,
    vendor_profile_id: `p-${c.id}`,
    category: 'photo_booth',
    title: c.title,
    starting_price_php: c.from,
    added_pax_price_php: null,
    pricing_basis: c.perPax ? 'per_pax' : 'fixed',
    per_pax_price_php: c.perPax?.rate ?? null,
    min_pax: c.perPax?.min ?? null,
    hour_base_php: null,
    min_hours: null,
    extra_hour_php: null,
    crew_size: null,
    crew_meal_required: false,
    crew_meal_included: false,
    transport_included: true,
    transport_flat_fee_php: null,
    primary_photo_r2_key: null,
    showcase_video_r2_key: null,
    showcase_photo_r2_keys: [],
    is_active: true,
    branch_id: null,
    recommended_lead_time_months: null,
    last_minute_end_months: null,
    last_minute_surcharge_pct: null,
    daily_capacity: null,
    exclusive_perk_text: null,
    includes_setnayan_gift: false,
    base_pax: null,
    coverage_id: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  } as VendorServiceRow;
}

const CITY: Record<string, string> = {
  'r-liwanag': 'Pasig',
  'r-setnaprod': 'Quezon City',
  'r-setnaprod-2': 'Quezon City',
  'r-blooms': 'Makati',
  'r-cakes': 'Quezon City',
};
const PHOTOS: Record<string, string> = {
  'r-liwanag': PHOTO('team'),
  'r-setnaprod': PHOTO('photographer'),
  'r-setnaprod-2': PHOTO('videographer'),
  'r-blooms': PHOTO('florist'),
  'r-cakes': PHOTO('caterer'),
};

export default async function MallCardLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
  const venue = one('venue') === 'none' ? null : MALL_REAL_VENUE;
  const guests = one('guests') === 'none' ? null : MALL_REAL_GUESTS;

  const cards: LabCard[] = REAL.map((r) => ({
    id: r.id,
    shop: r.shop,
    city: CITY[r.id] ?? '',
    title: r.title,
    from: r.from,
    verified: r.verified,
    hq: one('nopin') === '1' && r.id === 'r-blooms' ? null : r.hq,
    photo: PHOTOS[r.id] ?? PHOTO('team'),
  }));
  if (one('perguest') === '1') {
    cards.unshift(
      { id: 'r-lab-pax', shop: 'Lab sample caterer', city: 'Pasig', title: 'LAB ONLY · plated dinner', from: 850 * 50, verified: true, hq: ['14.5605166', '121.0764343'], photo: PHOTO('caterer'), perPax: { rate: 850, min: 50 } },
      { id: 'r-lab-pax-2', shop: 'Lab sample buffet', city: 'Quezon City', title: 'LAB ONLY · buffet', from: 650 * 250, verified: false, hq: ['14.6341654', '121.0352121'], photo: PHOTO('caterer'), perPax: { rate: 650, min: 250 } },
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6" data-mall-card-lab="">
      <p className="text-xs text-ink/55">
        Lab · Discover service cards (card 14) — real production cards · venue {venue ? 'set' : 'not set'} · guests{' '}
        {guests ?? 'not set'}
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-5" data-mall-grid="">
        {cards.map((c, i) => {
          const r = row(c);
          const card = toServiceCard(r, [], [], undefined, { photos: [c.photo], videoUrl: null }, false, null, NOW, null, null, false);
          return (
            <li key={c.id} className="min-w-0">
              <ServiceCardView
                card={card}
                detailsEnabled
                detailsHref="#"
                coverUrl={c.photo}
                shop={{ name: c.shop, href: null, logoUrl: null, verified: c.verified }}
                mall={{
                  price: mallPrice({ perGuest: perGuestPriceOf(r, false), guests, price: card.priceLabel, priceNote: card.priceDetail }),
                  distance: venue ? aboutKmLine(nearestKm(venue, [c.hq ? pinOf(...c.hq) : null])) : null,
                  askVenue: venue === null,
                  save: (
                    <SaveVendorButton
                      vendorProfileId={`p-${c.id}`}
                      initiallySaved={one('saved') === '1' && i === 0}
                      label="Save"
                      iconOnly
                      onPhoto={MALL_SAVE_ON_PHOTO}
                    />
                  ),
                }}
              />
            </li>
          );
        })}
      </ul>
    </main>
  );
}
