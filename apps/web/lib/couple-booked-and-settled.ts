/**
 * IS THIS SUPPLIER BOOKED — AS THE COUPLE MUST BE TOLD IT? The one pure rule.
 *
 * ⚖ OWNER, 2026-10-07: *"no handshake, no record · no handshake, no access to
 * certain features · no handshake, no confirmation of the event being booked to
 * them · meaning. no booking fee paid to us."* ⚖ 2026-10-12 #1: the fee is made
 * at the supplier's yes. ⚖ 2026-10-12 #14 / R12: the couple is NEVER told
 * about the supplier's fee. Audit `BOOKING_FEE_RULES_AUDIT_2026-10-12.md` F1–F3,
 * F6, C6 / build item 13.
 *
 * So "booked" on the couple's side is: the booking is confirmed AND its fee is
 * settled (paid, or waived — free five, a supplier's own client, a promotion,
 * the launch offer). A billed fee the supplier has not paid yet reads, to the
 * couple, exactly like a supplier who has not finished saying yes — "waiting
 * for their yes" — and NEVER as a fee. That is the whole of what this module
 * decides; every couple surface that must ask asks it.
 *
 * PURE: no database, no `server-only`. The read is
 * `lib/couple-booked-and-settled.server.ts`.
 */
import { FEE_SETTLED_STATUSES, FEE_VOID_STATUSES } from '@/lib/event-access-stage';

/** `event_vendors.status` values that mean a booking was confirmed. */
export const CONFIRMED_BOOKING_STATUSES: ReadonlySet<string> = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

/** What the fee read found for ONE booking. */
export type CoupleFeeFact =
  | { kind: 'none' }
  | { kind: 'unreadable' }
  | { kind: 'charge'; status: string };

export type CoupleBookingFacts = {
  status: string | null | undefined;
  /** `marketplace_vendor_id` is set — an on-platform shop that can be billed. */
  onPlatform: boolean;
  /**
   * The shop's own yes exists: `lock_request_state = 'agreed'`, a claimed
   * Locked QR, or a confirmed payment — the handshakes that MAKE the fee.
   */
  handshaken: boolean;
  fee: CoupleFeeFact;
};

export type CoupleBookingStanding =
  /** Confirmed and settled — or there is no fee to settle. Show it as booked. */
  | 'booked'
  /** Confirmed, but the supplier's side is not finished. Show "waiting for their yes". */
  | 'awaiting_supplier'
  /** Not a confirmed booking at all. */
  | 'not_booked';

/**
 * THE RULE.
 *
 *   · not confirmed                       → not_booked
 *   · fee system off (`feeMinting` false) → booked (no fee can exist; as before)
 *   · an off-platform (manual) supplier   → booked (no fee, ever)
 *   · a settled charge                    → booked
 *   · an UNREADABLE fee                   → booked — a failed read is not a fee
 *                                           owed; telling a couple their booked
 *                                           supplier is not booked because one
 *                                           SELECT failed is the worse lie
 *   · no charge, but the shop handshook   → booked (the fee is being made: the
 *                                           yes, or the dashboard catch-up)
 *   · no charge and no handshake          → awaiting_supplier (a row the couple
 *                                           marked booked by themselves)
 *   · an unsettled charge                 → awaiting_supplier
 */
export function coupleBookingStanding(
  facts: CoupleBookingFacts,
  feeMinting: boolean,
): CoupleBookingStanding {
  if (!facts.status || !CONFIRMED_BOOKING_STATUSES.has(facts.status)) return 'not_booked';
  if (!feeMinting || !facts.onPlatform) return 'booked';
  const fee = facts.fee;
  if (fee.kind === 'unreadable') return 'booked';
  if (fee.kind === 'charge' && FEE_SETTLED_STATUSES.has(fee.status)) return 'booked';
  if (fee.kind === 'none' || (fee.kind === 'charge' && FEE_VOID_STATUSES.has(fee.status))) {
    return facts.handshaken ? 'booked' : 'awaiting_supplier';
  }
  return 'awaiting_supplier';
}

/**
 * The deciding fee status for one booking among its charges: an unsettled
 * primary wins over a settled one (the same order the supplier gate uses); a
 * void row is ignored. Returns `none` when nothing live is left.
 */
export function decidingCoupleFee(statuses: readonly string[]): CoupleFeeFact {
  const live = statuses.filter((s) => !FEE_VOID_STATUSES.has(s));
  if (live.length === 0) return { kind: 'none' };
  const unsettled = live.find((s) => !FEE_SETTLED_STATUSES.has(s));
  return { kind: 'charge', status: unsettled ?? live[0]! };
}

/**
 * Did the mint at the supplier's yes leave a bill the supplier has not paid?
 * (`CollectBookingFeeResult.status` — restated structurally: that type lives in
 * a `server-only` module.) A billed booking is not confirmed to the couple
 * until it settles. Every other answer — waived (`free` / `zero_fee`), the fee
 * system off, an error — is NOT a held-back confirmation: a failure to bill
 * must never silence a real yes.
 */
export function mintLeftAnUnpaidBill(status: string | null | undefined): boolean {
  return (
    status === 'ordered' ||
    status === 'order_exists' ||
    status === 'already_billed' ||
    status === 'no_payer'
  );
}

/** What a couple is told when money cannot be recorded yet. Never a word about a fee (R12). */
export const COUPLE_MONEY_NOT_YET = {
  not_booked: 'Book this supplier first — once they confirm on Setnayan you can record a payment.',
  awaiting_supplier:
    'Your supplier has not finished confirming this booking yet. You can record a payment once they have.',
} as const;
