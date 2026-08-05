/**
 * venue-settings.ts — the ONE list of the reception settings a host can choose.
 *
 * WHY THIS FILE EXISTS. `events.venue_setting` was hand-written in seven
 * places: the DB CHECK constraint, three server-action allowlists (create-event,
 * the couple's details page, the vendor's compatibility picker), the couple's
 * own `<select>`, and two label maps on Explore. Adding `restaurant` meant
 * editing all seven, and missing any ONE of them fails differently and quietly:
 *
 *   · miss an allowlist  → the couple picks it and the save is rejected
 *   · miss the picker    → the value exists and nobody can choose it
 *   · miss a label map   → the chip renders "restaurant" in raw snake_case
 *   · miss the CHECK     → the write fails at the database
 *
 * None of those throw anywhere a test was looking. So the list lives here now,
 * and `venue-settings.test.ts` fails if any copy drifts from it.
 *
 * ── RESTAURANT (owner, 2026-08-05) ──────────────────────────────────────────
 * Owner: *"we should allow restaurants to be venues as well?"* — asked after
 * finding the product could not describe one. It could not, at four layers
 * at once: no `venue_setting` value, so a couple could not say it; a
 * `venue_directory_type` that DID have the word but zero rows behind it; both
 * mapping functions returning null; and the 3D plan drawing a hotel ballroom.
 *
 * It matters most for the event types opened up the same day (the seat pass and
 * the 3D venue for non-weddings): a christening, birthday or debut reception at
 * a restaurant is arguably the commonest Philippine case, and it was the one
 * shape the product had no way to express.
 */

/**
 * Every reception setting a host may choose, in the order they are offered.
 * `restaurant` sits after the halls because that is where a host looking for an
 * indoor room will scan next, and before the outdoor options.
 */
export const VENUE_SETTINGS = [
  'banquet_hall',
  'restaurant',
  'garden',
  'beach',
  'destination',
  'heritage',
  'outdoor_tent',
  'civil_registrar',
] as const;

export type VenueSetting = (typeof VENUE_SETTINGS)[number];

export function isVenueSetting(value: unknown): value is VenueSetting {
  return typeof value === 'string' && (VENUE_SETTINGS as readonly string[]).includes(value);
}

/** Long form — the couple's picker and Explore's facet chips. */
export const VENUE_SETTING_LABEL: Record<VenueSetting, string> = {
  banquet_hall: 'Hotel Ballroom / Banquet Hall',
  restaurant: 'Restaurant',
  garden: 'Garden Estate',
  beach: 'Beach',
  destination: 'Destination Resort',
  heritage: 'Heritage / Hacienda',
  outdoor_tent: 'Outdoor Tent',
  civil_registrar: "Civil Registrar's Office",
};

/** Short form — inline banner copy ("Restaurant venues only"). */
export const VENUE_SETTING_SHORT_LABEL: Record<VenueSetting, string> = {
  banquet_hall: 'Banquet hall',
  restaurant: 'Restaurant',
  garden: 'Garden',
  beach: 'Beach',
  destination: 'Destination resort',
  heritage: 'Heritage venue',
  outdoor_tent: 'Outdoor tent',
  civil_registrar: 'Civil registrar',
};

/**
 * The couple's setting → the marketplace's `venue_directory_type`.
 *
 * `civil_registrar` is deliberately absent: it is a CEREMONY venue, and the
 * reception filter never offers it. Returning null there is the existing,
 * correct behaviour and is not an oversight.
 */
export const VENUE_SETTING_TO_DIRECTORY_TYPE: Partial<Record<VenueSetting, string>> = {
  banquet_hall: 'hotel_ballroom',
  restaurant: 'restaurant',
  garden: 'garden',
  beach: 'beach',
  destination: 'destination_resort',
  heritage: 'heritage',
  outdoor_tent: 'outdoor_tent',
};
