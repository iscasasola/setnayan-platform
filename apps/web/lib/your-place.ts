/**
 * 📍 YOUR PLACE — the two rules of the place sheet on the Suppliers page that are not a picker's own (owner 2026-10-30,
 * on the APPROVED final Suppliers design — corpus DECISION_LOG "APPROVED — THE FINAL EVENT › SUPPLIERS DESIGN (Find ·
 * Build · Booked) IS THE BUILD CONTRACT"; prototype `prototypes/build-contracts-2026-10-30/suppliers-final/`,
 * `_build-src/city.js`):
 *
 *   TOP 10  "we show the top 10 locations in the country … and also allow search city?" — with nothing typed, the
 *           picker lists the TOP 10 IN THE PHILIPPINES: the app's own ranked wedding cities (`wedding-cities.ts`,
 *           `top` 1–10), in rank order. Never a second copy of that list — it is read from the one file.
 *   LOCKED  "once a reception is booked, location changed to the receptions location" — a booked reception SETS the
 *           place: its city, read-only, with one line saying why. The picker is only for before that.
 *
 * Pure: the sheet (`vendors/_components/fact-sheets.tsx`) and the picker (`launch/_components/details-city-pick.tsx`)
 * draw from these; `your-place.test.ts` holds them.
 */
import { CITIES, kmBetween, type WeddingCity } from '@/app/onboarding/wedding/_data/wedding-cities';
import type { PlaceSheetData } from './suppliers-fact-sheets';

/** How many of the ranked cities the picker opens on. */
export const TOP_PLACES = 10;

/** The heading over them. */
export const TOP_PLACES_HEAD = 'Top 10 in the Philippines';

/** The app's own top-ranked wedding cities, rank 1 first (`WeddingCity.top`). */
export function topPlaces(): WeddingCity[] {
  return CITIES.filter((c) => typeof c.top === 'number' && c.top >= 1 && c.top <= TOP_PLACES).sort((a, b) => (a.top ?? 0) - (b.top ?? 0));
}

/** The curated city nearest a pin, by km — the place a pinned venue stands in. (Was `details-city-pick.tsx`'s own.) */
export function nearestCity(at: { lat: number; lng: number }): WeddingCity | null {
  let best: { c: WeddingCity; d: number } | null = null;
  for (const c of CITIES) {
    const d = kmBetween({ lat: at.lat, lon: at.lng }, c);
    if (!best || d < best.d) best = { c, d };
  }
  return best?.c ?? null;
}

/** "Cavite · CALABARZON" → "CALABARZON" (the region half of a curated city's sub-line). */
const regionOf = (r: string) => r.split(' · ').pop() ?? r;

export type LockedPlace = {
  /** "Tagaytay · CALABARZON" — the reception's city; or its address / the stored city when it has no pin. */
  where: string;
  /** The booked reception's name. */
  reception: string;
  /** Find measures km from the reception's pin (`events.venue_latitude/longitude`) — said only when it has one. */
  pinned: boolean;
};

/**
 * The place a booked reception sets, or null while no reception is booked (the picker is shown then).
 * An event with one venue calls its card "Venue" — its slot key is still `reception`.
 */
export function placeLockedByReception(p: Pick<PlaceSheetData, 'city' | 'slots'>): LockedPlace | null {
  const reception = p.slots.find((s) => s.slot === 'reception');
  const booked = reception?.booked;
  if (!booked) return null;
  const pin = booked.pin ?? null;
  const near = pin ? nearestCity(pin) : null;
  const where = near ? `${near.n} · ${regionOf(near.r)}` : p.city?.trim() || booked.address?.trim() || booked.name;
  return { where, reception: booked.name, pinned: pin != null };
}

/** The one line under a locked place. */
export function lockedPlaceWhy(l: LockedPlace): string {
  return l.pinned
    ? `Your reception is booked, so your place is its city — Find measures every km from ${l.reception}. To move it, change the reception from Booked.`
    : `Your reception is booked, so your place is its city. To move it, change the reception from Booked.`;
}
