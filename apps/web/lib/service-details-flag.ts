/**
 * SERVICE DETAILS SHEET — feature flag.
 *
 * Gates ONE wave with two couple-facing seams on the public vendor profile
 * (`/v/[slug]`):
 *
 *   1. The per-service DETAILS SHEET. Slice D shipped the gallery card but
 *      explicitly handed the details screen over unbuilt
 *      (`changelog.d/marketplace-d-card.md`). With this flag on, a service card
 *      becomes a doorway: it opens a sheet showing the FULL card — every
 *      showcase photo, the clip, every inclusion (no "+N more" truncation), the
 *      not-included flags, the serves line, the price + discount, and the card
 *      record (which carries the booked count) when that flag is also on.
 *   2. "Inquire about this" from inside that sheet, which points the inquiry
 *      composer at the service the couple is ACTUALLY looking at. Today the
 *      composer always opens on `activeServices[0]` regardless of which card
 *      was read, so a couple reading the fifth card inquires about the first.
 *   3. The lock modal's secondary "Ask the vendor about this build instead" —
 *      the couple who customized a package but is not ready to pay can send
 *      their picks to the vendor as an inquiry instead of a money action.
 *
 * ONE flag for all three because they are one seam: a couple who can open the
 * details of a card expects the Inquire inside it to be about THAT card, and a
 * couple who can customize expects to be able to ask instead of pay.
 *
 * OFF (the default) ⇒ every one of those surfaces renders byte-identically to
 * today: the service card is the same static `<div>`, the composer keeps its
 * `activeServices[0]` initial, the lock modal shows only its Lock CTA, and the
 * page runs not one extra query.
 *
 * NEXT_PUBLIC_ because the mounting surfaces are server components that read it
 * to decide whether to FETCH (the per-category requirements for every service,
 * not just the first), so the check has to survive the client bundle boundary
 * the same way every other launch flag here does. Only the exact truthy strings
 * enable it; anything else (including a missing var) is OFF, so this ships dark
 * and the owner flips it on.
 */
export function serviceDetailsEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_SERVICE_DETAILS_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
