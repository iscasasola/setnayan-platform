/**
 * mall-card.ts — the two facts card 14 (the "mall card") adds to the one service card face.
 *
 * Owner, 20 Nov 2026 (DECISION_LOG "CARD 14 ADDS DISTANCE AND THE GUEST-COUNT PRICE" and "CARD 14 v4 APPROVED"):
 *   · *"Also add its distance from the Current Target Location"* → *"straight line, about X km"* — the straight-line
 *     (haversine) distance from the supplier's nearest place (its HQ or a live branch) to the event's venue. No paid
 *     map or routing service. Either side missing → no number at all; never "0 km".
 *   · *"Adapt the price to the estimated pax … if it is greater"* — a PER-GUEST card whose minimum is below the event's
 *     estimated guest count shows the total for that count ("₱102,000 · for your 120 guests", "₱850 / guest" small).
 *     At or under the minimum it keeps its per-guest price and its minimum. Flat and per-hour prices never change.
 *
 * Pure: no reads, no clock. The haversine is the ONE in `lib/geo.ts` — never a second copy.
 */
import { haversineKm } from '@/lib/geo';
import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';

export type LatLng = { lat: number; lng: number };

/** A per-guest price as the card already stores it (`vendor_services.per_pax_price_php` + `min_pax`). */
export type PerGuestPrice = { pricePhp: number; minPax: number | null };

/** The card's own per-guest price, or null when it is not a per-guest card, has no rate, or the shop hides prices. */
export function perGuestPriceOf(row: {
  pricing_basis?: string | null;
  per_pax_price_php?: number | null;
  min_pax?: number | null;
  category?: string | null;
}, hidePrices: boolean): PerGuestPrice | null {
  if (hidePrices) return null;
  if (row.pricing_basis !== 'per_pax') return null;
  // Crew meals are priced per MEAL for the supplier's crew, not per guest — the guest count says nothing about them.
  if (row.category === 'crew_meals') return null;
  const rate = Number(row.per_pax_price_php);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const min = row.min_pax == null ? null : Number(row.min_pax);
  return { pricePhp: rate, minPax: min != null && Number.isFinite(min) && min > 0 ? min : null };
}

/**
 * The total for the event's guest count — ONLY when the count is a real positive whole number ABOVE the card's minimum.
 * Anything else → null, and the card shows its own price as it is.
 */
export function guestCountTotal(per: PerGuestPrice | null, guests: number | null | undefined): number | null {
  if (!per) return null;
  if (guests == null || !Number.isInteger(guests) || guests <= 0) return null;
  if (per.minPax != null && guests <= per.minPax) return null;
  return per.pricePhp * guests;
}

/** What the price band says. `big` is the large figure; `you` the couple's own line; `note` the small one under it. */
export type MallPrice = { big: string; you: string | null; note: string | null };

/**
 * The price band of card 14.
 *   per-guest, count above the minimum → "₱102,000" · "for your 120 guests" · "₱850 / guest"
 *   per-guest otherwise                → "₱650 / guest" · "min 150 guests"
 *   anything else                      → the card's own price and its own note, unchanged
 */
export function mallPrice(input: {
  perGuest: PerGuestPrice | null;
  guests: number | null | undefined;
  /** The card's own price text as it is today ("from ₱45,999"). */
  price: string | null;
  /** The card's own note under it, as it is today. */
  priceNote: string | null;
}): MallPrice | null {
  const { perGuest, guests } = input;
  if (perGuest) {
    const rate = `${formatPhpRounded(perGuest.pricePhp)} / guest`;
    const total = guestCountTotal(perGuest, guests);
    if (total != null) return { big: formatPhpRounded(total), you: `for your ${formatCount(guests as number)} guests`, note: rate };
    return { big: rate, you: null, note: perGuest.minPax != null ? `min ${formatCount(perGuest.minPax)} guests` : null };
  }
  if (!input.price) return null;
  return { big: input.price, you: null, note: input.priceNote };
}

/** The supplier's nearest place to the venue: its HQ or any live branch. Null when either side has no place. */
export function nearestKm(venue: LatLng | null, places: readonly (LatLng | null | undefined)[]): number | null {
  if (!venue || !Number.isFinite(venue.lat) || !Number.isFinite(venue.lng)) return null;
  let best: number | null = null;
  for (const p of places) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const km = haversineKm(venue.lat, venue.lng, p.lat, p.lng);
    if (best == null || km < best) best = km;
  }
  return best;
}

/** A pin from two nullable numeric columns (`venue_latitude` / `hq_latitude` / `branch_latitude` …). */
export function pinOf(lat: unknown, lng: unknown): LatLng | null {
  if (lat == null || lng == null) return null;
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lng: b } : null;
}

/** The ask drawn when the event has no venue yet (the drawing's "When the event has no venue yet"). */
export const SET_YOUR_VENUE_LINE = 'Set your venue to see distance';

/**
 * "about 12 km from your venue". Straight line, so it is said as an approximation (owner: "about X km").
 * Under 1 km reads "under 1 km" — the card never says "0 km". Unknown → null, and the card says nothing.
 */
export function aboutKmLine(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) return 'under 1 km from your venue';
  return `about ${formatCount(Math.round(km))} km from your venue`;
}

/**
 * 🔖 Card 14's Save on the photo (drawing `.sv`): a 44 press holding a 36 px round dark scrim with a white bookmark — it reads on any photo, light or dark. Saved = the bookmark filled.
 */
const MALL_SAVE_LOOK =
  'grid h-11 w-11 place-items-center rounded-full bg-black/45 bg-clip-content p-1 text-white backdrop-blur-[8px] transition-transform active:scale-95';
export const MALL_SAVE_ON_PHOTO = { className: MALL_SAVE_LOOK, savedClassName: MALL_SAVE_LOOK };

/**
 * 🃏 CARD 14 ON THE SHOP'S OWN LIST (Supplier › Shop › Services, owner 23 Nov: "the suppliers>shop has the service card
 * wrong"). Card 14 is "the one service card everywhere" (DECISION_LOG 20 Nov), so the shop sees its cards as Find draws
 * them. There is no event here, so: no guest-count total (a per-guest card shows its rate and its minimum, as Find does
 * with no event), no distance and no venue ask. The supplier sees its own price even when the shop hides prices.
 */
export function ownShopMall(
  row: {
    pricing_basis?: string | null;
    per_pax_price_php?: number | null;
    min_pax?: number | null;
    category?: string | null;
    starting_price_php?: number | string | null;
  },
  card: { priceLabel: string; priceDetail: string | null },
): { price: MallPrice | null; distance: null; askVenue: false } {
  return {
    price: mallPrice({
      perGuest: perGuestPriceOf(row, false),
      guests: null,
      // "Price on request" is not a price: the face says it in the band's quiet voice (`priceMissing`), as on Find.
      price: Number(row.starting_price_php ?? 0) > 0 ? card.priceLabel : null,
      priceNote: card.priceDetail,
    }),
    distance: null,
    askVenue: false,
  };
}
