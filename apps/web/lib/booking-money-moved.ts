/**
 * booking-money-moved.ts — ONE answer to "has money already moved on this
 * booking?", shared by the couple's workspace (which decides whether to offer
 * "Cancel booking" or "Raise a dispute") and `cancelBookingAsHost` (which
 * decides whether a cancel may hard-delete the row).
 *
 * WHY (AREA-COUPLE, 2026-09-19): the two sides each carried their own copy of
 * this test, and both read only `status` and `deposit_paid_php`. But the
 * couple's own "Record deposit" (`recordDeposit`) never writes
 * `deposit_paid_php` — it stamps `deposit_recorded_at` and puts the amount in
 * the payment log. So on the rosa-ben booking (₱2,000 GCash deposit, recorded
 * AND confirmed by the supplier, status still `contracted`) the workspace
 * offered "Cancel booking", and the server then refused it with the
 * logged-payments message. A button that can only ever be refused.
 *
 * `deposit_recorded_at` is the couple's own claim that they paid. It counts
 * even when the supplier has said it never arrived — a refusal does not prove
 * the money did not move (owner 2026-08-27: "they keep their record"), and the
 * dispute flow is exactly where that disagreement belongs.
 *
 * Pure and dependency-free so a test can EXECUTE it.
 */

/** Statuses that mean the booking is already paid into (or past it). */
export const MONEY_MOVED_STATUSES: ReadonlySet<string> = new Set([
  'deposit_paid',
  'delivered',
  'complete',
]);

export type BookingMoneySignals = {
  status: string | null | undefined;
  deposit_paid_php: number | string | null | undefined;
  deposit_recorded_at: string | null | undefined;
};

export function bookingMoneyMoved(row: BookingMoneySignals): boolean {
  if (row.status && MONEY_MOVED_STATUSES.has(row.status)) return true;
  const deposit =
    typeof row.deposit_paid_php === 'string' ? Number(row.deposit_paid_php) : row.deposit_paid_php;
  if (typeof deposit === 'number' && Number.isFinite(deposit) && deposit > 0) return true;
  if (row.deposit_recorded_at) return true;
  return false;
}
