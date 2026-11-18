/**
 * vendor-venue-type.ts — the vocabulary behind `vendor_profiles.venue_type`
 * (migration 20260810000000_vendor_profiles_venue_type.sql), the FINE
 * reception-venue type a shop declares: hotel ballroom vs. events place vs.
 * restaurant vs. garden vs. beach vs. heritage vs. resort.
 *
 * NOT the same vocabulary as `venue_directory.venue_type` (the admin-only
 * `app/admin/venues` directory of actual venues — churches, mosques, civil
 * registrars — used for the couple's ceremony-venue search). The two tables
 * share a column name and a few overlapping words but are different concepts:
 * this one is a SHOP describing itself; that one is Setnayan's own curated
 * venue directory. Do not merge the two lists.
 *
 * The couple's own fine reception pick (onboarding screen-10,
 * `RECEPTION_TO_VENUE_TYPE` in app/onboarding/wedding/actions.ts) already
 * speaks these seven values — kept here as the single source so a vendor's
 * declared value can never drift from what the couple's search filters on.
 */

export const VENDOR_VENUE_TYPES = [
  'hotel_ballroom',
  'events_place',
  'restaurant',
  'heritage',
  'garden',
  'beach',
  'resort',
] as const;

export type VendorVenueType = (typeof VENDOR_VENUE_TYPES)[number];

export const VENDOR_VENUE_TYPE_LABEL: Readonly<Record<string, string>> = {
  hotel_ballroom: 'Hotel ballroom',
  events_place: 'Events place',
  restaurant: 'Restaurant',
  heritage: 'Heritage venue',
  garden: 'Garden',
  beach: 'Beach',
  resort: 'Resort',
};

export const ALLOWED_VENDOR_VENUE_TYPES: ReadonlySet<string> = new Set(VENDOR_VENUE_TYPES);

export function isVendorVenueType(raw: unknown): raw is VendorVenueType {
  return typeof raw === 'string' && ALLOWED_VENDOR_VENUE_TYPES.has(raw);
}

/**
 * W1-B26 (supplier walk, 16 Nov 2026): "What kind of venue are you" was asked of EVERY shop — a cake shop included.
 * It is asked of a venue only: a shop whose `services` carries the coarse `venue` category — the SAME test that offers
 * the venue room-size row (`lib/vendor-profile.ts`, owner 2026-08-07: "a florist has no room"). A shop that somehow
 * already holds a value keeps the question so it can clear it; anything left set filters Explore's venue search.
 */
export const VENUE_TYPE_CATEGORY = 'venue';
export function asksVenueType(services: readonly string[] | null | undefined, current: string | null | undefined): boolean {
  return (services ?? []).includes(VENUE_TYPE_CATEGORY) || Boolean(current && current.trim());
}
