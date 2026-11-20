/**
 * 🃏 `/dev/suppliers-lab?mall=real` — card 14 on the REAL production cards (read 20 Nov 2026 with a SELECT on prod).
 *
 * Every shop, title, price, verification state and HQ pin below is a row in production today; the venue pin and the
 * guest count (230) are one real event's. The distances are COMPUTED here, through the shipped helper
 * (`nearestKm` → `lib/geo` `haversineKm`), never typed. No production card is priced per guest yet, so the guest-count
 * total cannot show on real data — `&mall=real&perguest=1` adds ONE lab-only per-guest card (said so on its name) to
 * show that state. `&venue=none` draws the event without a venue (the line asks for one).
 */
import type { EventVendorRowInput } from '@/lib/wedding-plan-groups';
import type { VendorEnrichment } from '@/lib/vendors-plan-budget';
import type { BenchServiceCard } from '@/lib/bench-service-card';
import { formatPhpRounded } from '@/lib/php';
import { nearestKm, pinOf } from '@/lib/mall-card';
import type { DateFit } from '@/lib/calendar-truth';
import { TAXONOMY_MAP, type WeddingTile } from '@/lib/taxonomy';
import { categoryForTile } from '@/lib/shortlist-taxonomy';

/** A prod card's taxonomy id → the event_vendors row's own `category` + `category_key` (its Find tile). */
function placeOf(service: string): { category: EventVendorRowInput['category']; category_key: string } {
  const tile = (TAXONOMY_MAP[service]?.tile ?? service) as WeddingTile;
  return { category: categoryForTile(tile), category_key: tile };
}

/** One real event's venue pin and estimated guests (events.venue_latitude/longitude, estimated_pax). */
export const MALL_REAL_VENUE = pinOf('14.6624933', '121.0456594')!;
export const MALL_REAL_GUESTS = 230;

export type Real = {
  id: string;
  shop: string;
  category: string;
  title: string;
  from: number;
  verified: boolean;
  hq: [string, string];
};

export const REAL: Real[] = [
  { id: 'r-liwanag', shop: 'Liwanag Lights & Sound', category: 'lights_sound', title: 'Reception Lights & Sound', from: 45_000, verified: true, hq: ['14.5605166', '121.0764343'] },
  { id: 'r-setnaprod', shop: 'SetnaProd', category: 'photo_booth', title: 'Classic Photo Booth · 3 hours', from: 14_999, verified: true, hq: ['14.6866020', '121.0684130'] },
  { id: 'r-setnaprod-2', shop: 'SetnaProd', category: 'photoman', title: 'Roving Photoman · Instant Prints', from: 9_999, verified: true, hq: ['14.6866020', '121.0684130'] },
  { id: 'r-blooms', shop: 'TEST W1 Baseline Blooms', category: 'florals', title: 'Florals by TEST W1 Baseline Blooms', from: 25_000, verified: false, hq: ['14.5596815', '121.0165998'] },
  { id: 'r-cakes', shop: 'TEST W2 Walk Cakes', category: 'wedding_cake', title: 'Wedding cake by TEST W2 Walk Cakes', from: 18_000, verified: true, hq: ['14.6341654', '121.0352121'] },
];

/**
 * `&savedfirst=1` — the 20 Nov rule on screen: in Photo booth, the real SetnaProd card (saved, in reach, free) leads,
 * ahead of two LAB-ONLY saved booths a plain lens would rank higher (5.0 ★): one out of reach, one with no calendar.
 */
export function mallRealFixtures(opts: { venue: boolean; perGuest: boolean; savedFirst?: boolean; noPin?: boolean }) {
  const venue = opts.venue ? MALL_REAL_VENUE : null;
  const rows: EventVendorRowInput[] = REAL.map((r) => ({
    vendor_id: r.id,
    vendor_name: r.shop,
    ...placeOf(r.category),
    status: 'considering',
    marketplace_vendor_id: `p-${r.id}`,
  }));
  const enrichment = new Map<string, VendorEnrichment>(
    REAL.map((r) => [
      r.id,
      { rating: null, review_count: 0, booked_count: 1, is_verified: r.verified, distance_km: opts.noPin && r.id === 'r-blooms' ? null : nearestKm(venue, [pinOf(...r.hq)]) },
    ]),
  );
  const cards: Record<string, BenchServiceCard> = Object.fromEntries(
    REAL.map((r) => [
      r.id,
      {
        name: r.title,
        priceText: `from ${formatPhpRounded(r.from)}`,
        discountBadge: null,
        includesLine: null,
        notIncluded: [],
        givesSetnayanGift: false,
        coverUrl: null,
        perGuest: null,
      } satisfies BenchServiceCard,
    ]),
  );
  if (opts.perGuest) {
    rows.push({ vendor_id: 'r-lab-pax', vendor_name: 'Lab sample caterer', ...placeOf('catering'), status: 'considering', marketplace_vendor_id: 'p-lab-pax' });
    enrichment.set('r-lab-pax', { rating: null, review_count: 0, booked_count: 0, is_verified: true, distance_km: nearestKm(venue, [pinOf('14.5605166', '121.0764343')]) });
    cards['r-lab-pax'] = {
      name: 'LAB ONLY · plated dinner',
      priceText: `from ${formatPhpRounded(850 * 50)}`,
      discountBadge: null,
      includesLine: null,
      notIncluded: [],
      givesSetnayanGift: false,
      coverUrl: null,
      perGuest: { pricePhp: 850, minPax: 50 },
    };
    rows.push({ vendor_id: 'r-lab-pax-2', vendor_name: 'Lab sample buffet', ...placeOf('catering'), status: 'considering', marketplace_vendor_id: 'p-lab-pax-2' });
    enrichment.set('r-lab-pax-2', { rating: null, review_count: 0, booked_count: 0, is_verified: false, distance_km: nearestKm(venue, [pinOf('14.6341654', '121.0352121')]) });
    cards['r-lab-pax-2'] = {
      name: 'LAB ONLY · buffet',
      priceText: `from ${formatPhpRounded(650 * 250)}`,
      discountBadge: null,
      includesLine: null,
      notIncluded: [],
      givesSetnayanGift: false,
      coverUrl: null,
      perGuest: { pricePhp: 650, minPax: 250 },
    };
  }
  const dateFit = new Map<string, DateFit>();
  if (opts.savedFirst) {
    dateFit.set('r-setnaprod', 'free');
    enrichment.set('r-setnaprod', { ...enrichment.get('r-setnaprod')!, within_radius: true });
    const star = (id: string, name: string, title: string, within: boolean, fit: DateFit | null) => {
      rows.push({ vendor_id: id, vendor_name: name, ...placeOf('photo_booth'), status: 'considering', marketplace_vendor_id: `p-${id}` });
      enrichment.set(id, { rating: 5, review_count: 48, booked_count: 12, is_verified: true, within_radius: within, distance_km: within ? 6 : 64 });
      if (fit) dateFit.set(id, fit);
      cards[id] = { name: title, priceText: `from ${formatPhpRounded(12_000)}`, discountBadge: null, includesLine: null, notIncluded: [], givesSetnayanGift: false, coverUrl: null, perGuest: null };
    };
    star('r-lab-far', 'LAB ONLY · Far Booth Co.', 'LAB ONLY · saved, 64 km away (out of reach)', false, 'free');
    star('r-lab-nocal', 'LAB ONLY · Nocal Booths', 'LAB ONLY · saved, calendar not set', true, 'not_set');
  }
  return { rows, enrichment, cards, dateFit };
}
