/**
 * Constants + types shared between the venue_directory admin server actions
 * and the admin form components. Sits in its own file (not `actions.ts`)
 * because Next 15's `"use server"` rule forbids non-function exports.
 */

/**
 * The venue kinds an admin can create.
 *
 * 🔴 THIS LIST WAS THE HOME A RESTAURANT DID NOT HAVE. `venue_directory_type`
 * allows 19 values and this offered 13 — `restaurant` was not one of them, so
 * the directory held ZERO restaurants not because nobody had got round to it
 * but because THE FORM HAD NO SUCH OPTION. A host could pick "Restaurant" as
 * their setting (owner, 2026-08-05) and the marketplace had nothing to show
 * them, permanently.
 *
 * `multi_purpose_hall` was missing for the same reason and is the same class of
 * gap — a parish or barangay hall is where a very large share of Philippine
 * christenings and children's birthdays actually happen.
 *
 * ⚠ FOUR ENUM VALUES ARE STILL DELIBERATELY ABSENT: `banquet_hall`,
 * `garden_estate`, `beach_resort` and `heritage_hacienda` are second-era
 * duplicates of `hotel_ballroom`, `garden`, `beach` and `heritage`. No row in
 * the directory uses any of them. Offering both halves of each pair would let
 * two admins file the same venue under different types and see different
 * results — that is a merge to do on purpose, not a picker to widen.
 */
export const VENUE_TYPES = [
  'catholic_church',
  'christian_church',
  'inc_chapel',
  'mosque',
  'cultural_site',
  'civil_registrar',
  'hotel_ballroom',
  'garden',
  'beach',
  'destination_resort',
  'heritage',
  'outdoor_tent',
  'temple',
  'restaurant',
  'multi_purpose_hall',
] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export const CEREMONY_TYPES = [
  'catholic',
  'christian',
  'inc',
  'muslim',
  'cultural',
  'chinese',
  'jewish',
  'born_again',
  'aglipayan',
  'lds',
  'sda',
  'jw',
  'hindu',
  'sikh',
  'buddhist',
  'orthodox',
  'civil',
] as const;
export type CeremonyType = (typeof CEREMONY_TYPES)[number];
