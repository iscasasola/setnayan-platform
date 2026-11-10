/**
 * 🔒 WHAT YOU BOOK IS YOUR PRICE — AND THE APP SAYS SO ON BOTH SIDES (owner 10 Nov 2026, verbatim: *"did we make it
 * clear already that whatever you book now will be the pricing so when a supplier changes the price, your booking will
 * not change? if booked already."* — DECISION_LOG 2026-11-10 🔒, Build 5 Lane C).
 *
 * The RULE already stood (DECISION_LOG 2026-11-07: a price change on a couple's purchase is only a proposal until the
 * couple accepts it, through `proposal_amendments`; 2026-11-09: an accepted quotation never expires) and the database
 * holds it — a card's `vendor_services` price lives on the card, a booking's agreed amount on the booking
 * (`event_vendors.total_cost_php`, its change lines, its payment plan, `chat_threads.agreed_price_centavos`), and no
 * trigger copies one onto the other (`tests/db/a-card-price-edit-never-rewrites-a-booking.db.test.ts` proves it). What
 * was missing was a screen that SAID it. These are the two lines, written once: the Card Maker's price row and the
 * couple's booked supplier read them from here, never a typed copy (🔒 `lib/the-booked-price-stays.test.ts`).
 */

/** The supplier's side — the Card Maker's price row, on a card couples have already booked. */
export const BOOKED_PRICE_STAYS_SUPPLIER = 'Couples who already booked keep their price. New bookings use the new price.';

/** The couple's side — a supplier on Setnayan they have booked (Suppliers › Booked). */
export const BOOKED_PRICE_STAYS_COUPLE = 'Your price is set at booking. It changes only if you accept a change.';

/**
 * Does the Card Maker say the supplier line? `booked` is how many bookings this card has, or `null` when that could not
 * be read. A card nobody booked says nothing (the line would be about no one); an UNREAD count says it anyway — the line
 * is the rule, true either way, and a failed read must never look like "nobody booked" (T29, reads are honest).
 */
export function saysBookedPriceStays(booked: number | null): boolean {
  return booked === null || booked > 0;
}
