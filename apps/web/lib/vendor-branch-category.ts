import type { VendorCategory } from '@/lib/vendors';

/**
 * BRANCH (tier-2 tile) → coarse `vendor_category`.
 *
 * WHY THIS EXISTS. The product has two service vocabularies that do not line up:
 * the admin taxonomy (15 parents → 70 branches → 246 leaves) is what a vendor
 * NAVIGATES, and `vendor_category` (a 51-value Postgres enum) is what actually
 * gets STORED on `vendor_profiles.services` and drives every marketplace filter.
 * The only bridge that existed was `PACKAGE_CANONICAL_TO_VENDOR_CATEGORY`, a
 * LEAF-keyed map built for packages. Measured 2026-08-09: it covers **52 of 246**
 * live leaves. The other 194 fell through `resolveVendorCategory`'s `?? 'misc'`.
 *
 * Owner, on being shown that: *"fix the taxonomy if needed. we do not like
 * having categories under misc."*
 *
 * 🔑 THE FIX IS TO MAP AT THE BRANCH, NOT THE LEAF. A leaf map needs 246 entries
 * and grows every time an admin adds a service — which is exactly how it fell
 * 194 behind. A branch map needs 70, and a NEW LEAF INHERITS ITS BRANCH
 * AUTOMATICALLY. The admin can add services all day without anyone touching
 * code, and nothing lands in `misc`.
 *
 * KEYED ON `tile_id`, NEVER THE LABEL. Labels are admin-editable free text —
 * renaming "Photo Booth" to "Photo & Video Booth" would silently break a
 * label-keyed map with no error anywhere. The ids are stable identifiers.
 *
 * The leaf map still wins where it is more specific than the branch: the
 * "Photo & Video" branch holds both photography and videography leaves, and only
 * the leaf knows which. See `vendorCategoryForLeaf`.
 *
 * ⚠ EVERY BRANCH LIVE IN PRODUCTION ON 2026-08-09 IS LISTED. A missing branch is
 * caught by `tests/db/no-service-lands-in-misc.db.test.ts`, which reads the LIVE
 * taxonomy — so this cannot quietly fall behind the database the way the leaf
 * map did.
 */
export const BRANCH_TO_VENDOR_CATEGORY: Readonly<Record<string, VendorCategory>> = {
  // ── Venue ────────────────────────────────────────────────────────────────
  reception: 'venue',
  ceremony_venue: 'religious_venue',
  accommodation: 'accommodation',

  // ── Planning ─────────────────────────────────────────────────────────────
  coordinator: 'planner_coordinator',
  // A date / feng-shui specialist advises on WHEN to hold the event — planning
  // counsel, not a separate trade with its own marketplace filter.
  date_specialist: 'planner_coordinator',

  // ── Feast ────────────────────────────────────────────────────────────────
  cake: 'cake_maker',
  catering: 'catering',
  stations: 'catering',
  crew_meals: 'crew_meals',

  // ── Design ───────────────────────────────────────────────────────────────
  stylist_decorator: 'reception_decor',
  florist: 'florist',
  lights_sound: 'lights_and_sound',
  dance_floor: 'reception_decor',
  outdoor: 'reception_decor',
  fireworks: 'reception_decor',
  led_wall: 'led_screens',
  // Motion graphics / digital content for screens — produced and run by the same
  // people who run the AV, not a design trade the couple books separately.
  digital_services: 'av_production',

  // ── Program ──────────────────────────────────────────────────────────────
  live_band: 'band_dj',
  choir: 'choir',
  orchestra: 'string_quartet',
  wedding_singer: 'performers',
  dj: 'band_dj',
  choreographer: 'choreographer',
  performers: 'performers',
  host_mc: 'host_emcee',
  av_production: 'av_production',
  speaker_talent: 'speaker_talent',
  kids_entertainer: 'kids_entertainer',

  // ── Documentary ──────────────────────────────────────────────────────────
  // Mixed branch: the LEAF map splits photography from videography and wins.
  // This is the fallback for a new leaf nobody has classified yet — photographer
  // is the safer default, since a video-only shop is the rarer case.
  photo_video: 'photographer',
  editorial: 'photographer',

  // ── Look ─────────────────────────────────────────────────────────────────
  brides_attire: 'gown_designer',
  grooms_attire: 'suit_designer',
  womens_attire: 'gown_designer',
  mens_attire: 'suit_designer',
  filipiniana_barongs: 'suit_designer',
  hmua: 'makeup_artist',
  grooming: 'hair_stylist',
  wellness_fitness: 'wellness_fitness',
  jewelleries_accessories: 'rings',

  // ── Booths ───────────────────────────────────────────────────────────────
  // Drinks and food booths belong with the trade that supplies them; the rest
  // are guest ACTIVITIES, which is what `guest_booth` was added for.
  mobile_bar: 'mobile_bar',
  coffee_espresso: 'mobile_bar',
  mocktail: 'mobile_bar',
  food_truck: 'catering',
  dessert: 'cake_maker',
  food_cart: 'catering',
  photo_booth: 'photobooth',
  massage_chair: 'guest_booth',
  perfume_bar: 'guest_booth',
  arcade_games: 'guest_booth',
  henna_tattoo: 'guest_booth',
  mini_nail_bar: 'guest_booth',
  tarot_astrology_palmistry: 'guest_booth',
  caricature_calligraphy_painting: 'guest_booth',
  engraving_embroidery: 'gifts_and_giveaways',

  // ── Prints ───────────────────────────────────────────────────────────────
  printing: 'invitations_stationery',
  souvenir_giveaways: 'gifts_and_giveaways',
  trophies_awards: 'gifts_and_giveaways',

  // ── Transport ────────────────────────────────────────────────────────────
  bridal_car: 'transportation',
  guest_shuttle: 'transportation',
  transfers_rentals: 'transportation',
  // An escort detail is a security service that happens to travel.
  escort: 'security',

  // ── Experience · Dining · Logistics · Insurance · Specialty ───────────────
  tour_activity: 'tour_activity',
  tour_guide: 'tour_guide',
  restaurant_reservation: 'restaurant_reservation',
  referee_official: 'referee_official',
  event_medic: 'event_medic',
  event_insurance: 'event_insurance',
  personal_accident_insurance: 'personal_accident_insurance',
  travel_insurance: 'travel_insurance',
  reveal_element: 'reveal_element',
};

/** The coarse category for a branch, or null when the branch is unknown here. */
export function categoryForBranch(tileId: string | null | undefined): VendorCategory | null {
  if (!tileId) return null;
  return BRANCH_TO_VENDOR_CATEGORY[tileId] ?? null;
}
