/**
 * manual-venue-address — A VENUE THE COUPLE TYPES IN MUST CARRY ITS ADDRESS.
 * (owner, 2026-09-20: "the ceremony and reception venues to lock needs an
 * exact address if added manually. and yes, both … needs to have an address
 * since they will be used for the event itself.")
 *
 * ── The gap this closes ───────────────────────────────────────────────────
 * `event_manual_vendors` captured business_name + contact_person +
 * contact_number and nothing else. For a florist that is enough — you ring
 * them and they come to you. For the two categories that ARE a place it is
 * not: the ceremony and reception venues are where every guest is sent, where
 * the map pin on the guest site points, and what the supplier brief prints.
 * A couple who books their venue off platform had NO field to put the address
 * in, so every one of those surfaces fell back to the event's free-text
 * `venue_address` — a column nothing in the manual-add flow writes.
 *
 * ── PURE ON PURPOSE ───────────────────────────────────────────────────────
 * The form and the server action must agree, and a rule that lives in only one
 * of them is a rule the other can be walked around. Both import THIS, and
 * `manual-venue-address.test.ts` executes the truth table. (Same reasoning as
 * `lib/supplier-invite-eligibility.ts`: a predicate nobody can import from a
 * unit test is a predicate whose truth table nobody checks.)
 */

import type { VendorCategory } from '@/lib/vendors';

/**
 * The categories that ARE a place rather than a service that travels to one.
 *
 * `venue` is the RECEPTION and `religious_venue` is the CEREMONY — the same
 * two `lib/vendors.ts` already singles out as `VENUE_EXEMPT_SERVICES`, and the
 * same split `lib/std-venues.ts` reads back out for the Save-the-Date.
 *
 * ⚖ `church_fees` is deliberately NOT here. It rides in the ceremony group and
 * `std-venues.ts` treats it as a ceremony signal, but it is a LINE ITEM — a
 * fee paid to a parish — not a second place with its own street address.
 * Demanding one would block a couple recording a fee they already owe.
 */
export const ADDRESS_REQUIRED_CATEGORIES: ReadonlyArray<VendorCategory> = [
  'venue',
  'religious_venue',
];

/**
 * TRUE when a self-added supplier in this category must carry an address.
 *
 * Takes `unknown` deliberately: every caller but one reads the category
 * straight out of a `FormData`, whose entries are `string | File | null`.
 * Narrowing here rather than at four call sites means a `File` posted into the
 * `category` field answers FALSE instead of crashing — and a category we do
 * not recognise never demands an address it cannot justify.
 */
export function manualVendorNeedsAddress(category: unknown): boolean {
  if (typeof category !== 'string') return false;
  return (ADDRESS_REQUIRED_CATEGORIES as ReadonlyArray<string>).includes(category);
}

/** Longest address we store — comfortably past a full Philippine address. */
export const MANUAL_VENUE_ADDRESS_MAX = 240;

/**
 * Shortest string we will accept as an "exact address".
 *
 * ⚠ THIS IS A FLOOR ON EFFORT, NOT A VALIDATOR. No length test can tell a
 * street address from a city name, and pretending otherwise would be the
 * "green-shaped nothing" this repo keeps finding. It exists so that a couple
 * who taps through with "NCR" is asked again, and it is paired with copy that
 * says what is actually wanted. Anything stricter (a regex for house numbers,
 * a geocode round trip) would refuse real Philippine addresses — plenty of
 * them are a barangay and a landmark with no number at all.
 */
export const MANUAL_VENUE_ADDRESS_MIN = 12;

export const MANUAL_VENUE_ADDRESS_LABEL = 'Exact address';

export const MANUAL_VENUE_ADDRESS_HINT =
  'Street, barangay, city — this is where your guests and suppliers are sent.';

export const MANUAL_VENUE_ADDRESS_PLACEHOLDER =
  'e.g. 1 Vertis North Dr, Bagong Pag-asa, Quezon City';

export const MANUAL_VENUE_ADDRESS_MISSING =
  'Add the exact address — a venue you add yourself has no listing for us to read it from.';

export const MANUAL_VENUE_ADDRESS_TOO_SHORT =
  'That looks like an area, not an address. Give the street, barangay and city.';

export type ManualVenueAddressCheck =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

/**
 * THE ONE RULE both the modal and `createManualVendor` / `updateManualVendor`
 * ask.
 *
 * Returns the trimmed address to persist (`null` for a category that does not
 * need one and was given none), or the exact sentence to show the couple.
 *
 * ⚖ A non-venue category may still SUPPLY an address — a caterer's commissary
 * is worth keeping — it is simply not demanded. Only the length ceiling
 * applies there.
 */
export function checkManualVenueAddress(
  category: unknown,
  raw: unknown,
): ManualVenueAddressCheck {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const required = manualVendorNeedsAddress(category);

  if (text.length === 0) {
    return required ? { ok: false, message: MANUAL_VENUE_ADDRESS_MISSING } : { ok: true, value: null };
  }
  if (text.length > MANUAL_VENUE_ADDRESS_MAX) {
    return {
      ok: false,
      message: `${MANUAL_VENUE_ADDRESS_LABEL} must be ${MANUAL_VENUE_ADDRESS_MAX} characters or fewer`,
    };
  }
  if (required && text.length < MANUAL_VENUE_ADDRESS_MIN) {
    return { ok: false, message: MANUAL_VENUE_ADDRESS_TOO_SHORT };
  }
  return { ok: true, value: text };
}
