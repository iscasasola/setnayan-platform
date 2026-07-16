/**
 * Founder seats — up to 10 owner-granted platform-founder accounts
 * (owner-locked 2026-07-16 · migration 20270818135217 · corpus
 * Founder_Account_Token_Free_Inquiry_2026-07-16.md).
 *
 * A seat confers: (1) token-free vendor inquiries — the vendor's accept is
 * comped (unlock row at tokens_burned 0 + comp_reason 'founder', no debit, no
 * hold); (2) every in-app SKU already paid for on the founder's events
 * (eventSkuActive ORs in eventHostHoldsFounderSeat — lib/entitlements.ts);
 * (3) an explicit, SERVER-ASSERTED founder signal to the vendor. The signal
 * must only ever come from the definer helpers backed by the founder_seats
 * table — never from profile text — so it cannot be impersonated.
 *
 * Deliberately distinct from is_internal (§10a): internal is the team/ops
 * flag and may later cover non-founder staff; the vendor-facing "founder of
 * the app" claim is only ever true for owner-granted seats. Ice + Cale hold
 * the first two; the rest are granted from /admin/founder-seats.
 *
 * NOT a 'use client' module — the copy constants below are imported by Server
 * Components (RSC gotcha: value exports from client modules resolve undefined
 * in the prod RSC build).
 */

/** Hard cap — also enforced by the founder_seats.seat_no CHECK (1..10). */
export const FOUNDER_SEAT_CAP = 10;

/** The badge chip text (vendor thread header). */
export const FOUNDER_BADGE_LABEL = 'Setnayan Founder';

/**
 * The explicit signal line next to the badge — the owner's brief verbatim:
 * vendors must know "we are not just clients, we are the founders of the app",
 * and that answering costs them nothing.
 */
export const FOUNDER_INQUIRY_NOTE =
  'This inquiry is from a founder of Setnayan — not just a client, one of the people who built the app. Accepting is token-free.';

/** Title for the vendor_inquiry_received notification (+ its email). */
export const FOUNDER_INQUIRY_NOTIFICATION_TITLE =
  'New booking inquiry — from a Setnayan founder';

/** Prefix for the notification body (the couple's message text follows). */
export const FOUNDER_INQUIRY_NOTIFICATION_PREFIX =
  'This inquiry comes from a founder of Setnayan. Accepting it is token-free. ';
