/**
 * price-waits.ts — ON THE CARD A COUPLE'S RECORD SEEDS, THE PRICE BOX WAITS
 * until the photo and what's-included are filled in.
 *
 * Owner, 2026-10-07: *"they must agree to complete these information before
 * they set the price."* Ruled 2026-10-10 ("4-6 do as you recommend"): the
 * supplier's price box waits until the photo and what's included are complete.
 * Drawn in `prototypes/suppliers_add_your_own_2026-10-10.html`, case E3 — the
 * Price fold reads "finish the cover and what's included first" with a "waits"
 * pill.
 *
 * It applies to ONE card: the first card of a supplier who joined through a
 * couple's own link (the maker is opened with the claim token). Every other
 * card keeps the shipped order — the price can be typed at any time and only
 * PUBLISHING asks for a cover, a price and one inclusion
 * (`lib/service-publish-gate.ts`). The price the couple recorded is still
 * SHOWN on the card while it waits; what waits is the box that edits it.
 *
 * PURE: the maker asks, the test executes.
 */

/** What the price is waiting for, in the order the card asks for it. */
export type PriceWaitsFor = 'photo' | 'included';

export function priceWaitsFor(card: {
  /** The maker was opened from a couple's claim link (`claimToken`). */
  fromCoupleLink: boolean;
  /** A cover photo is set — the publish gate's own `coverIsSet` fact. */
  hasCover: boolean;
  /** At least one "what's included" line — the publish gate's `inclusionsAreSet`. */
  hasInclusions: boolean;
}): PriceWaitsFor | null {
  if (!card.fromCoupleLink) return null;
  if (!card.hasCover) return 'photo';
  if (!card.hasInclusions) return 'included';
  return null;
}

/** The sentence the price box shows while it waits. */
export function priceWaitsLine(card: { hasCover: boolean; hasInclusions: boolean }): string {
  if (!card.hasCover && !card.hasInclusions) return 'Your price waits — finish the cover and what’s included first.';
  if (!card.hasCover) return 'Your price waits — add your cover photo first.';
  return 'Your price waits — add what’s included first.';
}
