/**
 * Find v4 on the lab (owner 2026-10-29) — EVERY CARD of a category, per service, the way `fetchInlineMoreRow` now
 * returns them: Catering (4 services, many shops, some with two or three cards) and Massage Chair (the prototype's
 * second case — "Massage" has no card and is never listed). Deterministic, so a screenshot is the same every run.
 *
 *   &dates=unread   the calendars could not be read (the list says so and shows every card)
 *   &dates=none     the event has no date yet
 *   &cards=fail     the cards could not be read (the ✎ sheet says it could not read the services)
 */
import type { CategoryVendorResult } from '@/app/dashboard/[eventId]/vendors/_actions/category-search';
import type { FindAvailability, FindCardRow, FindService } from '@/lib/find-service-cards';
import { formatPhp } from '@/lib/orders';
import { card, market } from './fixtures';

type Plan = { services: FindService[]; shops: string[]; titles: Record<string, string[]>; perHead: boolean; base: number };

const PLANS: Record<string, Plan> = {
  catering: {
    services: [
      { key: 'catering', label: 'Catering' },
      { key: 'lechonero', label: 'Lechonero' },
      { key: 'chinese_lauriat_caterer', label: 'Chinese Lauriat' },
      { key: 'halal_catering', label: 'Halal Catering' },
    ],
    shops: [
      'Kusina ni Ate', 'Kape at Kain', 'Perlas Catering', 'Lutong Bahay ni Lola', 'Lihim na Lasa', 'Mesa ni Maria',
      'Hapag Events', 'Salu-Salo Co.', 'Tahanan Kitchen', 'Bigas at Ulam', 'Sabaw House', 'Pista Caterers',
      'Ihaw-Ihaw', 'Lamesa Catering', 'Panlasa Events', 'Kain Tayo', 'Handaan Co.', 'Masarap Tables',
      'Dulang Feasts', 'Kalan Kitchen', 'Bilao Events', 'Banquet Lima', 'Hain Catering', 'Laman Tiyan',
    ],
    titles: {
      catering: ['Filipino buffet · 80–200 guests', 'Garden buffet · 120–300 guests', 'Plated 5-course · 80–180 guests'],
      lechonero: ['Lechon + 3 mains · 50–200 guests', 'Lechon belly rolls · 100–120 guests', 'Lechon & carving · 30–120 guests'],
      chinese_lauriat_caterer: ['10-course lauriat · 100–300 guests', 'Lauriat for 8 tables'],
      halal_catering: ['Halal buffet · 80–250 guests', 'Halal plated · 60–150 guests'],
    },
    perHead: true,
    base: 299,
  },
  massage_chair: {
    services: [
      { key: 'massage_chair_station', label: 'Massage Chair Station' },
      { key: 'hair_touchup_station', label: 'Hair Touch-up Station' },
      { key: 'aromatherapy_station', label: 'Aromatherapy Station' },
      { key: 'massage', label: 'Massage' },
    ],
    shops: ['Pause Station', 'Hilot Hub', 'Ginhawa Booth', 'Relax Rentals', 'Kalma Co.', 'Pahinga Events', 'Ayos Buhok', 'Halimuyak', 'Lunas Lounge', 'Banayad', 'Gaan Station', 'Himlay'],
    titles: {
      massage_chair_station: ['2 chairs · 4 hrs', '3 chairs · 5 hrs', '1 chair · 3 hrs'],
      hair_touchup_station: ['Touch-up bar · 4 hrs', 'Two stylists · 5 hrs'],
      aromatherapy_station: ['Scent bar · 3 blends', 'Diffuser corner · 4 hrs'],
      massage: [],
    },
    perHead: false,
    base: 4500,
  },
};

/** A small deterministic generator — the same list every run. */
function rng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

export function labFind(
  tile: string,
  opts: { dates: string | null; cards: string | null },
): {
  results: CategoryVendorResult[];
  cards: FindCardRow[] | null;
  services: FindService[];
  availability: FindAvailability;
  availabilityDays: string[];
  performers: string[] | null;
} | null {
  const plan = PLANS[tile];
  if (!plan) return null;
  const r = rng(tile.length * 97 + 7);
  const results: CategoryVendorResult[] = [];
  const cards: FindCardRow[] = [];
  const live = plan.services.filter((s) => (plan.titles[s.key] ?? []).length > 0);
  plan.shops.forEach((name, i) => {
    const id = `lab-${tile}-${i}`;
    const reviews = r() < 0.2 ? 0 : Math.round(r() * 140);
    results.push(
      market({
        vendorProfileId: id,
        name,
        city: ['Tagaytay', 'Silang', 'Makati', 'Pasig', 'Alfonso'][i % 5] ?? null,
        rating: reviews ? Math.round((4 + r()) * 10) / 10 : null,
        reviewCount: reviews,
        distanceKm: 4 + i * 2,
        // 📍 The ceremony sits across town from the reception, so "Nearest to ceremony" (`&near=both`) reverses it.
        ceremonyDistanceKm: Math.max(1, 30 - i * 2),
      }),
    );
    // Most shops one card; every fourth two services, every seventh three.
    const n = i % 7 === 3 ? 3 : i % 4 === 1 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const svc = live[(i + k) % live.length] as FindService;
      const titles = plan.titles[svc.key] as string[];
      const price = plan.base + Math.round(r() * 12) * (plan.perHead ? 50 : 500);
      cards.push({
        serviceId: `${id}-${svc.key}`,
        profileId: id,
        service: svc.key,
        fromPhp: price,
        card: card({
          name: titles[(i + k) % titles.length] as string,
          priceText: `from ${formatPhp(price)}${plan.perHead ? ' / head' : ''}`,
          coverUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='80' height='112'><rect width='80' height='112' fill='hsl(${(i * 37 + k * 90) % 360} 30% 76%)'/></svg>`)}`,
        }),
      });
    }
  });
  const days = opts.dates === 'none' ? [] : ['2026-12-18'];
  return {
    results,
    cards: opts.cards === 'fail' ? null : cards,
    services: plan.services,
    availability: opts.dates === 'none' ? 'no_date' : opts.dates === 'unread' ? 'unread' : 'checked',
    availabilityDays: days,
    // Performers: a shop with a delivered Setnayan event — here, every shop rated by more than 40 couples.
    performers: opts.dates === 'perffail' ? null : results.filter((r) => (r.reviewCount ?? 0) > 40).map((r) => r.vendorProfileId),
  };
}
