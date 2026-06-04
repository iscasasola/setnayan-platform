/**
 * Constants + types shared between the venue_directory admin server actions
 * and the admin form components. Sits in its own file (not `actions.ts`)
 * because Next 15's `"use server"` rule forbids non-function exports.
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
  'civil',
] as const;
export type CeremonyType = (typeof CEREMONY_TYPES)[number];
