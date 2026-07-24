/**
 * Chat "Lock this deal" → booking — the PURE decision (no I/O, no `server-only`),
 * so the branch logic is unit-testable and the server wrapper stays thin.
 *
 * Option A (owner 2026-07-24): the couple's chat "🔒 Lock this deal" tap IS the
 * booking. It advances the real `event_vendors` row into 'contracted' at the
 * NEGOTIATED total and fires the 5% Booking Fee on that exact number — the same
 * verified-gate + `collectBookingFeeAtLock` the vendor-page finalize uses — so
 * the chat price and the charged base can never diverge (they read the one
 * `event_vendors.total_cost_php` we write at lock).
 *
 * The DB-touching wrapper lives in `lib/chat-lock-booking.server.ts` and composes
 * this predicate with `isMarketplaceVendorBookable` + `collectBookingFeeAtLock`.
 */

/**
 * Confirmed/booked statuses — a row here is ALREADY booked, so a chat lock must
 * NOT rewrite it (its fee is frozen; a rewrite would diverge the displayed total
 * from the charged base). Canonical mirror of `CONFIRMED_VENDOR_STATUSES`
 * (lib/events.ts) AND the `enforce_booking_requires_verified_vendor` DB trigger's
 * `v_confirmed` array (migration 20270927437859). Kept local so this pure module
 * stays free of the DB-heavy events.ts.
 */
export const CONFIRMED_LOCK_STATUSES: ReadonlySet<string> = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

export type ChatLockAction =
  // No marketplace `event_vendors` link (off-platform / not-yet-added): the
  // caller records the agreed price on the thread only — no verify, no fee.
  | 'skip_no_link'
  // Marketplace vendor is not verified → block the lock (friendly message). The
  // DB trigger is the hard backstop; this is the pre-check.
  | 'blocked_not_verified'
  // Row is ALREADY booked (a re-lock, or the vendor-page finalize won the race):
  // do NOT rewrite the frozen price — just (idempotently) ensure the fee exists.
  | 'refresh_fee_only'
  // First lock: write the negotiated total + flip to 'contracted', then charge.
  | 'book';

/**
 * Decide what a chat lock should do for its (event, vendor). Pure. `verified` is
 * resolved by the caller (an async `vendor_profiles` read); `currentStatus` is
 * the row's status before the lock.
 */
export function planChatLockBooking(args: {
  marketplaceVendorId: string | null;
  verified: boolean;
  currentStatus: string | null;
}): ChatLockAction {
  if (!args.marketplaceVendorId) return 'skip_no_link';
  if (!args.verified) return 'blocked_not_verified';
  if (args.currentStatus && CONFIRMED_LOCK_STATUSES.has(args.currentStatus)) {
    return 'refresh_fee_only';
  }
  return 'book';
}
