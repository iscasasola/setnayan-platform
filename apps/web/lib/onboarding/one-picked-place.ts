import { CITIES } from '@/app/onboarding/wedding/_data/wedding-cities';

/**
 * 📍 ONE PICKED AREA IS THE EVENT'S CITY OR AREA (walk 13 Nov 2026, F-W2-02).
 *
 * Wedding sign-up's "Where" keeps up to two picks in `style_preferences.search_areas` (keys like `tagaytay`). The
 * event's City or area — what the Event Hub Maker's Details and the Suppliers place sheet show and edit — is
 * `events.std_film_venue_city`, a listed place's NAME (`lib/listed-place.ts`). Nothing wrote one from the other, so a
 * couple who picked Tagaytay saw an empty City or area. One pick → that place's name; two picks are still two regions
 * being narrowed (owner 2026-10-30, "max of 2 regions until we boil it down to 1 location") → nothing is claimed.
 *
 * Pure: the commit calls it, the test runs it.
 */
export function onePickedPlaceName(places: readonly string[] | null | undefined): string | null {
  const picks = (places ?? []).filter((p) => typeof p === 'string' && p.trim() !== '');
  if (picks.length !== 1) return null;
  return CITIES.find((c) => c.k === picks[0])?.n ?? null;
}
